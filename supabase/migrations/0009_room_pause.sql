-- =====================================================================
-- 0009 — host can pause a room between rounds to change settings
-- =====================================================================
-- While paused, the auto-next-round loop stops, so the host can adjust max bet,
-- deck count, currency, etc. and have it take effect on the NEXT round (round
-- config is snapshotted per round, so live edits never disturb a round in play).

alter table public.rooms
  add column if not exists paused boolean not null default false;
