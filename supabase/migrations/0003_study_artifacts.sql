-- Phase 4: study artifact generation + SM-2 spaced repetition (PLAN.md §7 step 4).
-- Run this once in the Supabase SQL editor, after 0001 and 0002.

create table if not exists public.study_artifacts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('summary', 'flashcard_deck', 'quiz', 'formula_sheet')),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists study_artifacts_course_id_idx on public.study_artifacts (course_id);

alter table public.study_artifacts enable row level security;

drop policy if exists "study_artifacts_owner_all" on public.study_artifacts;
create policy "study_artifacts_owner_all" on public.study_artifacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- flashcards
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.study_artifacts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  front text not null,
  back text not null,
  ease numeric not null default 2.5,
  interval_days numeric not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists flashcards_deck_id_idx on public.flashcards (deck_id);
create index if not exists flashcards_due_at_idx on public.flashcards (user_id, due_at);

alter table public.flashcards enable row level security;

drop policy if exists "flashcards_owner_all" on public.flashcards;
create policy "flashcards_owner_all" on public.flashcards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------- quiz_attempts
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.study_artifacts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric not null,
  answers jsonb not null,
  taken_at timestamptz not null default now()
);

create index if not exists quiz_attempts_quiz_id_idx on public.quiz_attempts (quiz_id);

alter table public.quiz_attempts enable row level security;

drop policy if exists "quiz_attempts_owner_all" on public.quiz_attempts;
create policy "quiz_attempts_owner_all" on public.quiz_attempts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
