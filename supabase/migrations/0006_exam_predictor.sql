-- Stretch: Exam Predictor (PLAN.md §7 step 11).
-- Run after 0001-0005.

alter table public.documents
  add column if not exists is_exam_paper boolean not null default false;

-- Links concepts to the *documents* they came from (not just artifacts) so
-- every upload contributes to the concept graph immediately, and so exam
-- papers specifically can be queried for recurring-concept frequency.
create table if not exists public.document_concepts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (document_id, concept_id)
);

create index if not exists document_concepts_document_id_idx on public.document_concepts (document_id);
create index if not exists document_concepts_concept_id_idx on public.document_concepts (concept_id);

alter table public.document_concepts enable row level security;

drop policy if exists "document_concepts_owner_all" on public.document_concepts;
create policy "document_concepts_owner_all" on public.document_concepts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
