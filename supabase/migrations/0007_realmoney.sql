-- =====================================================================
-- 0007 — real-money small stakes + persisted interim settlements
-- =====================================================================
-- Lets a host run the table for real (소액) money: a chip is worth a fixed
-- number of KRW, and mid-game settlements are recorded so "중간 정산 완료" is
-- visible to everyone (not just computed and thrown away).

-- Real-money value of one chip in KRW. 0 = off (display chips only).
alter table public.rooms
  add column if not exists chip_value_krw integer not null default 0;

-- Distinguish a recorded mid-game settlement from the final one. Existing rows
-- (and inserts that omit it) default to 'final', so older code keeps working.
alter table public.settlements
  add column if not exists kind text not null default 'final'
    check (kind in ('interim', 'final'));

-- The settlement value can change with the room's stake (snapshot at compute
-- time so a later rate change doesn't rewrite history).
alter table public.settlements
  add column if not exists chip_value_krw integer not null default 0;

-- Fast "latest interim settlement for this room" lookups + history.
create index if not exists settlements_room_kind_idx
  on public.settlements (room_id, kind, computed_at desc);
