-- =====================================================================
-- 0008 — per-room currency + flexible stake ratio
-- =====================================================================
-- Generalizes the 0007 "1칩 = N원" model into "X coins = Y <currency>" so a
-- host can run a room in any currency at any ratio (e.g. 100 coins = €1).
-- Default stays 1 coin = 1 KRW. Supersedes rooms.chip_value_krw (kept, unused).

alter table public.rooms
  add column if not exists currency text not null default 'KRW';
alter table public.rooms
  add column if not exists unit_chips integer not null default 1 check (unit_chips >= 1);
alter table public.rooms
  add column if not exists unit_amount numeric not null default 1 check (unit_amount >= 0);

-- Carry over any rate already set via 0007 (1 chip = chip_value_krw KRW).
update public.rooms
  set unit_amount = chip_value_krw, unit_chips = 1, currency = 'KRW'
  where chip_value_krw is not null and chip_value_krw > 0;

-- Snapshot the stake on each settlement so history is stable if the room
-- changes its stake later.
alter table public.settlements
  add column if not exists currency text;
alter table public.settlements
  add column if not exists unit_chips integer;
alter table public.settlements
  add column if not exists unit_amount numeric;
