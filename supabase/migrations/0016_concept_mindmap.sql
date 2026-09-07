-- 0016_concept_mindmap.sql
-- Add hierarchical parent-child relationships, descriptions, and underlying concept data

alter table public.concepts
  add column if not exists parent_id uuid references public.concepts(id) on delete cascade,
  add column if not exists description text,
  add column if not exists underlying_data jsonb,
  add column if not exists level int not null default 1;

create index if not exists concepts_parent_id_idx on public.concepts(parent_id);
create index if not exists concepts_course_level_idx on public.concepts(course_id, level);
