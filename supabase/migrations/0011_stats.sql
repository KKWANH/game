-- =====================================================================
-- 0011 — per-account lifetime stats (win rate & totals)
-- =====================================================================
-- Accumulated as each round settles (rooms/hands get deleted, so we can't
-- recompute later — we increment a persistent per-user row).

create table if not exists public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hands bigint not null default 0,
  wins bigint not null default 0,
  losses bigint not null default 0,
  pushes bigint not null default 0,
  blackjacks bigint not null default 0,
  net bigint not null default 0, -- chips (payout − bet) summed across all hands
  updated_at timestamptz not null default now()
);

alter table public.player_stats enable row level security;
-- Readable by any signed-in user (so friends can compare); writes via service role.
create policy player_stats_select on public.player_stats
  for select to authenticated using (true);

-- Atomic increment so concurrent round settlements never clobber each other.
create or replace function public.bump_player_stats(
  p_user_id uuid,
  p_hands bigint,
  p_wins bigint,
  p_losses bigint,
  p_pushes bigint,
  p_blackjacks bigint,
  p_net bigint
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.player_stats (user_id, hands, wins, losses, pushes, blackjacks, net, updated_at)
  values (p_user_id, p_hands, p_wins, p_losses, p_pushes, p_blackjacks, p_net, now())
  on conflict (user_id) do update set
    hands = player_stats.hands + excluded.hands,
    wins = player_stats.wins + excluded.wins,
    losses = player_stats.losses + excluded.losses,
    pushes = player_stats.pushes + excluded.pushes,
    blackjacks = player_stats.blackjacks + excluded.blackjacks,
    net = player_stats.net + excluded.net,
    updated_at = now();
$$;
