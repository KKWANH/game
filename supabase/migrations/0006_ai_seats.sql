-- AI players: a seat can be an AI (user_id stays null) with a difficulty.
alter table public.seats add column if not exists is_ai boolean not null default false;
alter table public.seats add column if not exists ai_difficulty text not null default 'normal'
  check (ai_difficulty in ('easy', 'normal', 'hard'));
