-- =====================================================================
-- Blackjack — schema, RLS, grants.
-- public  : client-readable (sanitized) via RLS.
-- private : SERVER-ONLY. No grants to anon/authenticated. Never published
--           to Realtime. The shuffled shoe + dealer hole card live here.
-- =====================================================================

create extension if not exists "pgcrypto";

create schema if not exists private;

-- Lock the private schema down hard. Only service_role (and postgres) may touch it.
revoke all on schema private from anon, authenticated, public;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------
-- ENUM-like domains kept as text + checks for easy migration.
-- ---------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby'
    check (status in ('lobby', 'active', 'settled', 'closed')),
  dealer_type text not null default 'ai'
    check (dealer_type in ('ai', 'human')),
  dealer_seat_id uuid,
  current_round_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_config (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  num_decks int not null default 6 check (num_decks between 1 and 8),
  min_bet bigint not null default 10 check (min_bet > 0),
  max_bet bigint not null default 1000 check (max_bet >= min_bet),
  blackjack_payout_num int not null default 3,
  blackjack_payout_den int not null default 2,
  dealer_hits_soft_17 boolean not null default false,
  allow_double boolean not null default true,
  allow_double_after_split boolean not null default true,
  allow_split boolean not null default true,
  max_splits int not null default 3 check (max_splits between 0 and 4),
  surrender text not null default 'late' check (surrender in ('none', 'late', 'early')),
  allow_insurance boolean not null default true,
  split_aces_one_card boolean not null default true,
  turn_timer_seconds int not null default 30 check (turn_timer_seconds between 5 and 120),
  max_seats int not null default 6 check (max_seats between 1 and 7),
  play_direction text not null default 'cw' check (play_direction in ('cw', 'ccw'))
);

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat_index int not null,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  is_dealer boolean not null default false,
  chip_stack bigint not null default 0,
  total_buy_in bigint not null default 0,
  status text not null default 'seated'
    check (status in ('seated', 'sitting_out', 'left')),
  joined_at timestamptz not null default now(),
  unique (room_id, seat_index)
);

-- One active seat per user per room.
create unique index seats_one_active_per_user
  on public.seats (room_id, user_id)
  where (status <> 'left' and user_id is not null);

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_number int not null,
  phase text not null default 'betting'
    check (phase in ('betting', 'dealing', 'player_turns', 'dealer_turn', 'settlement', 'complete')),
  active_hand_id uuid,
  turn_deadline timestamptz,
  config_snapshot jsonb not null,
  dealer_hand_id uuid,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, round_number)
);

create table public.hands (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds (id) on delete cascade,
  seat_id uuid references public.seats (id) on delete cascade,
  is_dealer boolean not null default false,
  parent_hand_id uuid references public.hands (id) on delete cascade,
  split_depth int not null default 0,
  bet_amount bigint not null default 0,
  insurance_bet bigint not null default 0,
  is_doubled boolean not null default false,
  is_split_aces boolean not null default false,
  status text not null default 'active'
    check (status in ('betting', 'active', 'stood', 'busted', 'blackjack', 'surrendered', 'settled')),
  outcome text check (outcome in ('win', 'lose', 'push', 'blackjack', 'surrender')),
  payout bigint,
  seat_order int not null default 0,
  created_at timestamptz not null default now()
);

create index hands_round_idx on public.hands (round_id);

-- VISIBLE cards only. The dealer hole card is inserted here only at reveal.
create table public.hand_cards (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references public.hands (id) on delete cascade,
  card_index int not null,
  rank text not null check (rank in ('A','2','3','4','5','6','7','8','9','10','J','Q','K')),
  suit text not null check (suit in ('S','H','D','C')),
  created_at timestamptz not null default now(),
  unique (hand_id, card_index)
);

create index hand_cards_hand_idx on public.hand_cards (hand_id);

-- Append-only money ledger — the source of truth for chips.
create table public.chip_ledger (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat_id uuid not null references public.seats (id) on delete cascade,
  round_id uuid references public.game_rounds (id) on delete set null,
  hand_id uuid references public.hands (id) on delete set null,
  type text not null
    check (type in ('buy_in','bet','payout','insurance','insurance_payout','refund')),
  amount bigint not null,
  balance_after bigint not null,
  created_at timestamptz not null default now()
);

create index chip_ledger_room_idx on public.chip_ledger (room_id);
create index chip_ledger_seat_idx on public.chip_ledger (seat_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  computed_at timestamptz not null default now(),
  net_by_seat jsonb not null,
  transfers jsonb not null
);

-- Deferred FKs that reference later tables.
alter table public.rooms
  add constraint rooms_dealer_seat_fk
  foreign key (dealer_seat_id) references public.seats (id) on delete set null;
alter table public.rooms
  add constraint rooms_current_round_fk
  foreign key (current_round_id) references public.game_rounds (id) on delete set null;
alter table public.game_rounds
  add constraint rounds_active_hand_fk
  foreign key (active_hand_id) references public.hands (id) on delete set null;
alter table public.game_rounds
  add constraint rounds_dealer_hand_fk
  foreign key (dealer_hand_id) references public.hands (id) on delete set null;

-- ---------------------------------------------------------------------
-- private (server-only) — the secrets.
-- ---------------------------------------------------------------------
create table private.round_secrets (
  round_id uuid primary key references public.game_rounds (id) on delete cascade,
  deck jsonb not null,            -- remaining shuffled shoe: [{rank,suit}, ...]
  deck_cursor int not null default 0,
  dealer_hole_card jsonb,         -- {rank,suit} until revealed, then null
  shuffle_seed text
);

revoke all on private.round_secrets from anon, authenticated, public;
grant all on private.round_secrets to service_role;

-- =====================================================================
-- RLS — read-scoping for clients. NO write policies on game tables, so
-- only service_role (which bypasses RLS) can mutate them.
-- =====================================================================

-- Helper: is the current user a (non-left) member of this room?
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seats s
    where s.room_id = p_room_id
      and s.user_id = auth.uid()
      and s.status <> 'left'
  );
$$;

alter table public.rooms enable row level security;
alter table public.room_config enable row level security;
alter table public.seats enable row level security;
alter table public.game_rounds enable row level security;
alter table public.hands enable row level security;
alter table public.hand_cards enable row level security;
alter table public.chip_ledger enable row level security;
alter table public.settlements enable row level security;

-- rooms: discoverable while in lobby, otherwise members only.
create policy rooms_select on public.rooms
  for select to authenticated
  using (status = 'lobby' or is_room_member(id));

create policy room_config_select on public.room_config
  for select to authenticated
  using (
    is_room_member(room_id)
    or exists (select 1 from public.rooms r where r.id = room_id and r.status = 'lobby')
  );

create policy seats_select on public.seats
  for select to authenticated
  using (
    is_room_member(room_id)
    or exists (select 1 from public.rooms r where r.id = room_id and r.status = 'lobby')
  );

create policy rounds_select on public.game_rounds
  for select to authenticated using (is_room_member(room_id));

create policy hands_select on public.hands
  for select to authenticated
  using (exists (
    select 1 from public.game_rounds gr
    where gr.id = round_id and is_room_member(gr.room_id)
  ));

create policy hand_cards_select on public.hand_cards
  for select to authenticated
  using (exists (
    select 1 from public.hands h
    join public.game_rounds gr on gr.id = h.round_id
    where h.id = hand_id and is_room_member(gr.room_id)
  ));

create policy ledger_select on public.chip_ledger
  for select to authenticated using (is_room_member(room_id));

create policy settlements_select on public.settlements
  for select to authenticated using (is_room_member(room_id));

-- =====================================================================
-- Realtime publication — public game tables only. NEVER add private.*.
-- =====================================================================
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.seats;
alter publication supabase_realtime add table public.game_rounds;
alter publication supabase_realtime add table public.hands;
alter publication supabase_realtime add table public.hand_cards;
alter publication supabase_realtime add table public.chip_ledger;
alter publication supabase_realtime add table public.settlements;
