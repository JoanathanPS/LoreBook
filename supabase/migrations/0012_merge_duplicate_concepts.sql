-- Fixes the concept graph showing near-duplicate nodes side by side
-- ("Diffusion Model" / "Diffusion Models", "Autoregressive Transformer" /
-- "Autoregressive Transformers", etc). Root cause: lib/study/mastery.ts
-- matched concepts by exact name, so each artifact-generation call (which
-- independently re-extracts concept names via the LLM) could mint a fresh
-- near-duplicate row instead of reusing the existing one whenever the model
-- phrased a concept slightly differently (singular vs plural, casing).
--
-- This migration merges any such duplicates already in the database, keyed
-- by a normalized form of the name (lowercased, whitespace-collapsed, a
-- trailing "s" stripped for simple pluralization). The application-level
-- fix (matching future concepts the same way before creating a new row)
-- lives in lib/study/mastery.ts.

-- 1. Compute, per course, which concept row to keep for each normalized
--    name (the oldest one), and which rows are the duplicates to merge away.
create temporary table concept_merge_map as
with normalized as (
  select
    id,
    course_id,
    name,
    regexp_replace(lower(trim(name)), '\s+', ' ', 'g') as norm
  from public.concepts
),
keyed as (
  select
    id,
    course_id,
    case
      when norm ~ '(ss|us|is)$' then norm
      when length(norm) > 3 and norm ~ 's$' then left(norm, length(norm) - 1)
      else norm
    end as merge_key
  from normalized
),
ranked as (
  select
    id,
    course_id,
    merge_key,
    first_value(id) over (
      partition by course_id, merge_key order by id
    ) as keep_id
  from keyed
)
select id as old_id, keep_id
from ranked
where id <> keep_id;

-- 2. Repoint child rows to the surviving concept, dropping any that would
--    collide with a row the survivor already has (unique constraints on
--    concept_links(concept_id, artifact_id), document_concepts(concept_id,
--    document_id), mastery_scores(user_id, concept_id)).
delete from public.concept_links cl
using concept_merge_map m
where cl.concept_id = m.old_id
  and exists (
    select 1 from public.concept_links cl2
    where cl2.concept_id = m.keep_id and cl2.artifact_id = cl.artifact_id
  );

update public.concept_links cl
set concept_id = m.keep_id
from concept_merge_map m
where cl.concept_id = m.old_id;

delete from public.document_concepts dc
using concept_merge_map m
where dc.concept_id = m.old_id
  and exists (
    select 1 from public.document_concepts dc2
    where dc2.concept_id = m.keep_id and dc2.document_id = dc.document_id
  );

update public.document_concepts dc
set concept_id = m.keep_id
from concept_merge_map m
where dc.concept_id = m.old_id;

-- Keep the higher of the two mastery scores rather than an arbitrary one.
update public.mastery_scores ms
set score = greatest(ms.score, keep.score)
from concept_merge_map m
join public.mastery_scores keep
  on keep.concept_id = m.keep_id and keep.user_id = ms.user_id
where ms.concept_id = m.old_id and ms.user_id = keep.user_id;

delete from public.mastery_scores ms
using concept_merge_map m
where ms.concept_id = m.old_id
  and exists (
    select 1 from public.mastery_scores keep
    where keep.concept_id = m.keep_id and keep.user_id = ms.user_id
  );

update public.mastery_scores ms
set concept_id = m.keep_id
from concept_merge_map m
where ms.concept_id = m.old_id;

-- 3. Drop the now-unreferenced duplicate concept rows.
delete from public.concepts c
using concept_merge_map m
where c.id = m.old_id;

drop table concept_merge_map;
