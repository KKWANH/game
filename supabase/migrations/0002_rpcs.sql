-- =====================================================================
-- Authoritative mutation RPCs.
--
-- Concurrency model: OPTIMISTIC. Server actions (service-role) read the
-- round + the secret deck, compute the entire next state in tested TS, then
-- call commit_round_mutation() which — in a single transaction — locks the
-- round row (FOR UPDATE), verifies the expected version, applies the patch,
-- and bumps the version. Two racing actions (double-click, or a timeout firing
-- alongside a player action) collide on the version: the loser gets a conflict
-- and the caller refetches. The secret deck is read only by the server; clients
-- never receive it.
--
-- These RPCs are callable only by service_role.
-- =====================================================================

-- Atomic chip movement: append a ledger row and update the seat's cached stack.
create or replace function private.record_ledger(
  p_room_id uuid,
  p_seat_id uuid,
  p_round_id uuid,
  p_hand_id uuid,
  p_type text,
  p_amount bigint
) returns bigint
language plpgsql
as $$
declare
  v_new_stack bigint;
begin
  update public.seats
     set chip_stack = chip_stack + p_amount,
         total_buy_in = total_buy_in + (case when p_type = 'buy_in' then p_amount else 0 end)
   where id = p_seat_id
   returning chip_stack into v_new_stack;

  insert into public.chip_ledger
    (room_id, seat_id, round_id, hand_id, type, amount, balance_after)
  values
    (p_room_id, p_seat_id, p_round_id, p_hand_id, p_type, p_amount, v_new_stack);

  return v_new_stack;
end;
$$;

-- Buy in chips to a seat (top-up). Returns the new stack.
create or replace function public.apply_buy_in(p_seat_id uuid, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_id uuid;
  v_stack bigint;
begin
  if p_amount <= 0 then
    raise exception 'buy-in must be positive';
  end if;
  select room_id into v_room_id from public.seats where id = p_seat_id;
  if v_room_id is null then
    raise exception 'seat not found';
  end if;
  v_stack := private.record_ledger(v_room_id, p_seat_id, null, null, 'buy_in', p_amount);
  return v_stack;
end;
$$;

-- ---------------------------------------------------------------------
-- The core atomic applier. `patch` shape (all keys optional):
-- {
--   "round":        { "phase","active_hand_id","turn_deadline","dealer_hand_id" },
--   "deck_cursor":  int,
--   "reveal_hole":  bool,                         -- clears private hole card
--   "insert_hands": [ { full hands row } ],
--   "update_hands": [ { "id", ...fields } ],
--   "insert_cards": [ { "hand_id","card_index","rank","suit" } ],
--   "ledger":       [ { "seat_id","round_id","hand_id","type","amount" } ],
--   "seat_status":  [ { "id","status" } ]
-- }
-- Returns { "version": <new version> }. Raises 'version_conflict' on mismatch.
-- ---------------------------------------------------------------------
create or replace function public.commit_round_mutation(
  p_round_id uuid,
  p_expected_version bigint,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_id uuid;
  v_version bigint;
  v_new_version bigint;
  v_round jsonb := p_patch -> 'round';
  rec jsonb;
begin
  -- Lock the round and check version.
  select room_id, version into v_room_id, v_version
    from public.game_rounds
   where id = p_round_id
   for update;

  if v_room_id is null then
    raise exception 'round_not_found';
  end if;
  if v_version <> p_expected_version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  -- Insert new hands (e.g. split-off hands) first so cards/updates can target them.
  if p_patch ? 'insert_hands' then
    for rec in select * from jsonb_array_elements(p_patch -> 'insert_hands') loop
      insert into public.hands (
        id, round_id, seat_id, is_dealer, parent_hand_id, split_depth,
        bet_amount, insurance_bet, is_doubled, is_split_aces, status, seat_order
      ) values (
        (rec->>'id')::uuid,
        (rec->>'round_id')::uuid,
        nullif(rec->>'seat_id','')::uuid,
        coalesce((rec->>'is_dealer')::boolean, false),
        nullif(rec->>'parent_hand_id','')::uuid,
        coalesce((rec->>'split_depth')::int, 0),
        coalesce((rec->>'bet_amount')::bigint, 0),
        coalesce((rec->>'insurance_bet')::bigint, 0),
        coalesce((rec->>'is_doubled')::boolean, false),
        coalesce((rec->>'is_split_aces')::boolean, false),
        coalesce(rec->>'status', 'active'),
        coalesce((rec->>'seat_order')::int, 0)
      );
    end loop;
  end if;

  -- Insert revealed cards. Upsert so a split can overwrite a hand's index-1
  -- card when the second card moves to the new hand.
  if p_patch ? 'insert_cards' then
    for rec in select * from jsonb_array_elements(p_patch -> 'insert_cards') loop
      insert into public.hand_cards (hand_id, card_index, rank, suit)
      values (
        (rec->>'hand_id')::uuid,
        (rec->>'card_index')::int,
        rec->>'rank',
        rec->>'suit'
      )
      on conflict (hand_id, card_index)
      do update set rank = excluded.rank, suit = excluded.suit;
    end loop;
  end if;

  -- Update existing hands.
  if p_patch ? 'update_hands' then
    for rec in select * from jsonb_array_elements(p_patch -> 'update_hands') loop
      update public.hands set
        status       = coalesce(rec->>'status', status),
        outcome      = coalesce(rec->>'outcome', outcome),
        payout       = coalesce((rec->>'payout')::bigint, payout),
        bet_amount   = coalesce((rec->>'bet_amount')::bigint, bet_amount),
        insurance_bet= coalesce((rec->>'insurance_bet')::bigint, insurance_bet),
        is_doubled   = coalesce((rec->>'is_doubled')::boolean, is_doubled)
      where id = (rec->>'id')::uuid;
    end loop;
  end if;

  -- Seat status changes (e.g. sit-out).
  if p_patch ? 'seat_status' then
    for rec in select * from jsonb_array_elements(p_patch -> 'seat_status') loop
      update public.seats set status = rec->>'status' where id = (rec->>'id')::uuid;
    end loop;
  end if;

  -- Ledger movements (bets, payouts, insurance) — atomic with stack update.
  if p_patch ? 'ledger' then
    for rec in select * from jsonb_array_elements(p_patch -> 'ledger') loop
      perform private.record_ledger(
        v_room_id,
        (rec->>'seat_id')::uuid,
        nullif(rec->>'round_id','')::uuid,
        nullif(rec->>'hand_id','')::uuid,
        rec->>'type',
        (rec->>'amount')::bigint
      );
    end loop;
  end if;

  -- Advance the secret deck cursor / reveal the hole card.
  if p_patch ? 'deck_cursor' then
    update private.round_secrets
       set deck_cursor = (p_patch->>'deck_cursor')::int
     where round_id = p_round_id;
  end if;
  if coalesce((p_patch->>'reveal_hole')::boolean, false) then
    update private.round_secrets set dealer_hole_card = null where round_id = p_round_id;
  end if;

  -- Finally, update the round and bump version.
  v_new_version := v_version + 1;
  update public.game_rounds set
    phase          = coalesce(v_round->>'phase', phase),
    active_hand_id = case when v_round ? 'active_hand_id'
                          then nullif(v_round->>'active_hand_id','')::uuid
                          else active_hand_id end,
    turn_deadline  = case when v_round ? 'turn_deadline'
                          then nullif(v_round->>'turn_deadline','')::timestamptz
                          else turn_deadline end,
    dealer_hand_id = case when v_round ? 'dealer_hand_id'
                          then nullif(v_round->>'dealer_hand_id','')::uuid
                          else dealer_hand_id end,
    version        = v_new_version
  where id = p_round_id;

  return jsonb_build_object('version', v_new_version);
end;
$$;

-- Lock down EXECUTE: only the server (service_role) may call these.
revoke all on function public.commit_round_mutation(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.apply_buy_in(uuid, bigint) from public, anon, authenticated;
grant execute on function public.commit_round_mutation(uuid, bigint, jsonb) to service_role;
grant execute on function public.apply_buy_in(uuid, bigint) to service_role;

-- =====================================================================
-- pg_cron safety net: auto-advance rounds whose turn timer expired.
-- The server's /api/cron/sweep endpoint does the actual work (it has the
-- engine); this just nudges. Enable pg_cron in the Supabase dashboard, then:
--
--   select cron.schedule('blackjack-timeout-sweep', '15 seconds',
--     $$ select net.http_post(
--          url := 'https://game.kwanho.dev/api/cron/sweep',
--          headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
--        ); $$);
--
-- Left as documentation so the client-triggered timeout works without it.
-- =====================================================================
