-- Stretch: Battle Mode (PLAN.md §7 step 11) — live 1v1 quiz via Realtime.
-- Run after 0001-0006.

create table if not exists public.battle_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  quiz_id uuid not null references public.study_artifacts (id) on delete cascade,
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid references auth.users (id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  scores jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists battle_sessions_course_id_idx on public.battle_sessions (course_id);

alter table public.battle_sessions enable row level security;

-- Anyone can read a battle by its (unguessable) id to see if it's joinable —
-- mirrors a "anyone with the link" share model.
drop policy if exists "battle_sessions_select" on public.battle_sessions;
create policy "battle_sessions_select" on public.battle_sessions
  for select
  using (true);

drop policy if exists "battle_sessions_host_insert" on public.battle_sessions;
create policy "battle_sessions_host_insert" on public.battle_sessions
  for insert
  with check (auth.uid() = host_id);

-- A participant can update their own battle; a non-participant may only
-- update it to claim the open guest slot (and nothing else about the row
-- changes ownership away from host/guest after their update).
drop policy if exists "battle_sessions_participant_update" on public.battle_sessions;
create policy "battle_sessions_participant_update" on public.battle_sessions
  for update
  using (auth.uid() = host_id or auth.uid() = guest_id or guest_id is null)
  with check (auth.uid() = host_id or auth.uid() = guest_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'battle_sessions'
  ) then
    alter publication supabase_realtime add table public.battle_sessions;
  end if;
end $$;
