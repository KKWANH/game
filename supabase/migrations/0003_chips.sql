-- Service-role-only chip movement that is independent of the round version
-- (used for betting during the betting phase, where many seats act at once and
-- must not contend on game_rounds.version). Atomic ledger row + stack update.

create or replace function public.record_chip_movement(
  p_seat_id uuid,
  p_round_id uuid,
  p_hand_id uuid,
  p_type text,
  p_amount bigint
) returns bigint
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_id uuid;
  v_stack bigint;
begin
  select room_id into v_room_id from public.seats where id = p_seat_id;
  if v_room_id is null then
    raise exception 'seat not found';
  end if;
  v_stack := private.record_ledger(v_room_id, p_seat_id, p_round_id, p_hand_id, p_type, p_amount);
  return v_stack;
end;
$$;

revoke all on function public.record_chip_movement(uuid, uuid, uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.record_chip_movement(uuid, uuid, uuid, text, bigint) to service_role;
