-- Fix: infinite recursion between courses <-> course_members RLS policies.
--
-- courses_member_select queried course_members, and course_members_select
-- queried courses — each triggering the other's RLS evaluation in a loop
-- (Postgres error 42P17). Standard fix: move the cross-table checks into
-- SECURITY DEFINER helper functions, which bypass RLS on their *internal*
-- queries, breaking the cycle. This is the pattern Supabase's own docs
-- recommend for exactly this situation.
--
-- Run after 0001-0008.

create or replace function public.is_course_owner(cid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.courses c where c.id = cid and c.user_id = uid);
$$;

create or replace function public.is_course_member(cid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.course_members m where m.course_id = cid and m.user_id = uid);
$$;

revoke all on function public.is_course_owner(uuid, uuid) from public;
revoke all on function public.is_course_member(uuid, uuid) from public;
grant execute on function public.is_course_owner(uuid, uuid) to authenticated;
grant execute on function public.is_course_member(uuid, uuid) to authenticated;

-- ---- course_members: replace the recursive owner check ----
drop policy if exists "course_members_select" on public.course_members;
create policy "course_members_select" on public.course_members
  for select
  using (auth.uid() = user_id or public.is_course_owner(course_id, auth.uid()));

drop policy if exists "course_members_owner_delete" on public.course_members;
create policy "course_members_owner_delete" on public.course_members
  for delete
  using (public.is_course_owner(course_id, auth.uid()));

-- ---- course_invites: same owner check, same fix ----
drop policy if exists "course_invites_owner_insert" on public.course_invites;
create policy "course_invites_owner_insert" on public.course_invites
  for insert
  with check (auth.uid() = created_by and public.is_course_owner(course_id, auth.uid()));

-- ---- every *_member_select policy: replace the raw course_members EXISTS ----
drop policy if exists "courses_member_select" on public.courses;
create policy "courses_member_select" on public.courses
  for select
  using (public.is_course_member(id, auth.uid()));

drop policy if exists "documents_member_select" on public.documents;
create policy "documents_member_select" on public.documents
  for select
  using (public.is_course_member(documents.course_id, auth.uid()));

drop policy if exists "document_chunks_member_select" on public.document_chunks;
create policy "document_chunks_member_select" on public.document_chunks
  for select
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and public.is_course_member(d.course_id, auth.uid())
    )
  );

drop policy if exists "study_artifacts_member_select" on public.study_artifacts;
create policy "study_artifacts_member_select" on public.study_artifacts
  for select
  using (public.is_course_member(study_artifacts.course_id, auth.uid()));

drop policy if exists "flashcards_member_select" on public.flashcards;
create policy "flashcards_member_select" on public.flashcards
  for select
  using (
    exists (
      select 1 from public.study_artifacts a
      where a.id = flashcards.deck_id
        and public.is_course_member(a.course_id, auth.uid())
    )
  );

drop policy if exists "flashcards_member_review" on public.flashcards;
create policy "flashcards_member_review" on public.flashcards
  for update
  using (
    exists (
      select 1 from public.study_artifacts a
      where a.id = flashcards.deck_id
        and public.is_course_member(a.course_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.study_artifacts a
      where a.id = flashcards.deck_id
        and public.is_course_member(a.course_id, auth.uid())
    )
  );

drop policy if exists "concepts_member_select" on public.concepts;
create policy "concepts_member_select" on public.concepts
  for select
  using (public.is_course_member(concepts.course_id, auth.uid()));

drop policy if exists "concept_links_member_select" on public.concept_links;
create policy "concept_links_member_select" on public.concept_links
  for select
  using (
    exists (
      select 1 from public.concepts c
      where c.id = concept_links.concept_id
        and public.is_course_member(c.course_id, auth.uid())
    )
  );

drop policy if exists "reel_cards_member_select" on public.reel_cards;
create policy "reel_cards_member_select" on public.reel_cards
  for select
  using (
    exists (
      select 1 from public.study_artifacts a
      where a.id = reel_cards.reel_id
        and public.is_course_member(a.course_id, auth.uid())
    )
  );
