-- =====================================================================
-- 0010 — social phase 2: member directory + friends
-- =====================================================================
-- `profiles` is a public, readable mirror of auth.users (which lives in the auth
-- schema and isn't queryable via the API) so members can find each other.
-- `friendships` is one canonical row per pair (user_low < user_high).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '플레이어',
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
-- Only the service role (server actions) writes profiles.

create table if not exists public.friendships (
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);

alter table public.friendships enable row level security;
create policy friendships_select on public.friendships
  for select to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);
-- Only the service role (server actions) writes friendships.
