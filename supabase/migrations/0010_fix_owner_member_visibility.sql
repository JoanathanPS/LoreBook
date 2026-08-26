-- Fix: course owner can't see content created by an invited member, and a
-- member's chat can't retrieve chunks from documents the owner uploaded.
--
-- Root cause: every *_member_select policy (0008/0009) grants visibility
-- via public.is_course_member(), which only checks the course_members
-- table — but the course *owner* is never a row in course_members (they
-- own the course row directly, via courses.user_id). So "member can see
-- owner's stuff" worked, but "owner can see member's stuff" silently
-- didn't, and match_document_chunks's hardcoded `c.user_id = auth.uid()`
-- filter bypassed the sharing model entirely — only the uploader's own
-- chunks were ever returned, regardless of course membership.
--
-- Fix: a combined is_course_participant() (owner OR member), used in place
-- of is_course_member() for every read policy below, plus removing the
-- RPC's hardcoded uploader-only filter in favor of the RLS the query now
-- correctly enforces.
--
-- Run after 0001-0009.

create or replace function public.is_course_participant(cid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_course_owner(cid, uid) or public.is_course_member(cid, uid);
$$;

revoke all on function public.is_course_participant(uuid, uuid) from public;
grant execute on function public.is_course_participant(uuid, uuid) to authenticated;

-- ---- widen every *_member_select policy to owner-or-member ----

drop policy if exists "documents_member_select" on public.documents;
create policy "documents_member_select" on public.documents
  for select
  using (public.is_course_participant(documents.course_id, auth.uid()));

drop policy if exists "document_chunks_member_select" on public.document_chunks;
create policy "document_chunks_member_select" on public.document_chunks
  for select
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and public.is_course_participant(d.course_id, auth.uid())
    )
  );

drop policy if exists "study_artifacts_member_select" on public.study_artifacts;
create policy "study_artifacts_member_select" on public.study_artifacts
  for select
  using (public.is_course_participant(study_artifacts.course_id, auth.uid()));

drop policy if exists "flashcards_member_select" on public.flashcards;
create policy "flashcards_member_select" on public.flashcards
  for select
  using (
    exists (
      select 1 from public.study_artifacts a
      where a.id = flashcards.deck_id
        and public.is_course_participant(a.course_id, auth.uid())
    )
  );

drop policy if exists "flashcards_member_review" on public.flashcards;
create policy "flashcards_member_review" on public.flashcards
  for update
  using (
    exists (
      select 1 from public.study_artifacts a
      where a.id = flashcards.deck_id
        and public.is_course_participant(a.course_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.study_artifacts a
      where a.id = flashcards.deck_id
        and public.is_course_participant(a.course_id, auth.uid())
    )
  );

drop policy if exists "concepts_member_select" on public.concepts;
create policy "concepts_member_select" on public.concepts
  for select
  using (public.is_course_participant(concepts.course_id, auth.uid()));

drop policy if exists "concept_links_member_select" on public.concept_links;
create policy "concept_links_member_select" on public.concept_links
  for select
  using (
    exists (
      select 1 from public.concepts c
      where c.id = concept_links.concept_id
        and public.is_course_participant(c.course_id, auth.uid())
    )
  );

drop policy if exists "reel_cards_member_select" on public.reel_cards;
create policy "reel_cards_member_select" on public.reel_cards
  for select
  using (
    exists (
      select 1 from public.study_artifacts a
      where a.id = reel_cards.reel_id
        and public.is_course_participant(a.course_id, auth.uid())
    )
  );

-- document_concepts (Exam Predictor, 0006) has the same owner-only gap —
-- add the missing member/participant read policy so a shared member's
-- Predictor view (and the owner's, for member-uploaded exam papers) works.
drop policy if exists "document_concepts_participant_select" on public.document_concepts;
create policy "document_concepts_participant_select" on public.document_concepts
  for select
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_concepts.document_id
        and public.is_course_participant(d.course_id, auth.uid())
    )
  );

-- ---- RAG retrieval: stop hardcoding "uploader only", trust RLS instead ----
-- document_chunks_member_select above (now participant-scoped) plus the
-- existing document_chunks_owner_all policy together already express the
-- correct visibility rule — security invoker means this query is subject
-- to both, so the manual `c.user_id = auth.uid()` filter was strictly
-- wrong: it hid every other participant's material from chat retrieval.
create or replace function public.match_document_chunks(
  query_embedding vector(1024),
  match_course_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_ref int,
  timestamp_ref numeric,
  document_title text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.page_ref,
    c.timestamp_ref,
    d.title as document_title,
    1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  join documents d on d.id = c.document_id
  where d.course_id = match_course_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
