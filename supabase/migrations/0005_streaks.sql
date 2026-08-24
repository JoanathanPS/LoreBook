-- Phase 7: analytics dashboard — streaks/XP.
-- Run this once in the Supabase SQL editor, after 0001-0004.

create table if not exists public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  xp int not null default 0,
  last_active_at date
);

alter table public.streaks enable row level security;

drop policy if exists "streaks_owner_all" on public.streaks;
create policy "streaks_owner_all" on public.streaks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
