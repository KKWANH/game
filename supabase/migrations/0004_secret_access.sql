-- =====================================================================
-- Server-only access to the secret shoe via SECURITY DEFINER RPCs.
--
-- PostgREST only exposes the `public` schema, so the server cannot reach
-- `private.round_secrets` through the REST client directly (it returns
-- "Invalid schema: private"). Rather than EXPOSE the private schema (which
-- would widen the API surface), we provide three public RPCs that run with
-- definer rights and are EXECUTE-granted only to service_role. The private
-- schema stays completely invisible to the API — the strongest anti-cheat.
-- =====================================================================

-- Create the secret row for a new round (fresh shuffled shoe).
create or replace function public.create_round_secret(p_round_id uuid, p_deck jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.round_secrets (round_id, deck, deck_cursor, dealer_hole_card)
  values (p_round_id, p_deck, 0, null);
end;
$$;

-- Read the secret state for the server engine (deck, cursor, hole card).
create or replace function public.get_round_secret(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  r private.round_secrets;
begin
  select * into r from private.round_secrets where round_id = p_round_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'deck', r.deck,
    'deck_cursor', r.deck_cursor,
    'dealer_hole_card', r.dealer_hole_card
  );
end;
$$;

-- Stash the dealer hole card at deal time.
create or replace function public.set_dealer_hole_card(p_round_id uuid, p_card jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update private.round_secrets set dealer_hole_card = p_card where round_id = p_round_id;
end;
$$;

revoke all on function public.create_round_secret(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_round_secret(uuid) from public, anon, authenticated;
revoke all on function public.set_dealer_hole_card(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_round_secret(uuid, jsonb) to service_role;
grant execute on function public.get_round_secret(uuid) to service_role;
grant execute on function public.set_dealer_hole_card(uuid, jsonb) to service_role;
