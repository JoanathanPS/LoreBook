-- Phase 5 (Study Reels) + groundwork for Phase 6 (concept graph).
-- Run this once in the Supabase SQL editor, after 0001-0003.

alter table public.study_artifacts drop constraint if exists study_artifacts_kind_check;
alter table public.study_artifacts add constraint study_artifacts_kind_check
  check (kind in ('summary', 'flashcard_deck', 'quiz', 'formula_sheet', 'reel'));

-- ----------------------------------------------------------------- reel_cards
create table if not exists public.reel_cards (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.study_artifacts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  order_index int not null,
  hook text not null,
  body text not null,
  visual_hint text,
  created_at timestamptz not null default now()
);

create index if not exists reel_cards_reel_id_idx on public.reel_cards (reel_id, order_index);

alter table public.reel_cards enable row level security;

drop policy if exists "reel_cards_owner_all" on public.reel_cards;
create policy "reel_cards_owner_all" on public.reel_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------- concepts
create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (course_id, name)
);

alter table public.concepts enable row level security;

drop policy if exists "concepts_owner_all" on public.concepts;
create policy "concepts_owner_all" on public.concepts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------- concept_links
-- Links a concept to whichever artifact/reel introduced or tested it — this
-- is what Phase 6's concept graph will render as edges.
create table if not exists public.concept_links (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts (id) on delete cascade,
  artifact_id uuid not null references public.study_artifacts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (concept_id, artifact_id)
);

alter table public.concept_links enable row level security;

drop policy if exists "concept_links_owner_all" on public.concept_links;
create policy "concept_links_owner_all" on public.concept_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- mastery_scores
create table if not exists public.mastery_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  score numeric not null default 0.5 check (score >= 0 and score <= 1),
  updated_at timestamptz not null default now(),
  unique (user_id, concept_id)
);

alter table public.mastery_scores enable row level security;

drop policy if exists "mastery_scores_owner_all" on public.mastery_scores;
create policy "mastery_scores_owner_all" on public.mastery_scores
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
