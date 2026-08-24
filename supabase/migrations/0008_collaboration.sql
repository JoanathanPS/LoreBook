-- Stretch: Collaboration (PLAN.md §7 step 11) — shared course spaces.
-- Run after 0001-0007.
--
-- Model: view/study a shared course (documents, chunks, generated
-- artifacts, flashcards, concepts, reels) as a member; personal progress
-- tables (quiz_attempts, mastery_scores, streaks) stay strictly per-user
-- even inside a shared course. Sharing is "anyone with the invite link,
-- while logged in" — no email lookup needed client-side.

create table if not exists public.course_members (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

alter table public.course_members enable row level security;

drop policy if exists "course_members_select" on public.course_members;
create policy "course_members_select" on public.course_members
  for select
  using (
    auth.uid() = user_id
    or auth.uid() = (select user_id from public.courses c where c.id = course_id)
  );

drop policy if exists "course_members_self_insert" on public.course_members;
create policy "course_members_self_insert" on public.course_members
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "course_members_owner_delete" on public.course_members;
create policy "course_members_owner_delete" on public.course_members
  for delete
  using (auth.uid() = (select user_id from public.courses c where c.id = course_id));

-- Invite links: the id itself is the unguessable token. Any authenticated
-- user can read one (to resolve what they're joining) — same trust model
-- as battle_sessions.
create table if not exists public.course_invites (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.course_invites enable row level security;

drop policy if exists "course_invites_select" on public.course_invites;
create policy "course_invites_select" on public.course_invites
  for select
  using (true);

drop policy if exists "course_invites_owner_insert" on public.course_invites;
create policy "course_invites_owner_insert" on public.course_invites
  for insert
  with check (auth.uid() = created_by and auth.uid() = (select user_id from public.courses c where c.id = course_id));

-- ---- additional (OR'd) member-read policies on shared tables ----
-- These ADD to the existing owner-only policies from prior migrations;
-- Postgres RLS combines multiple permissive policies with OR, so nothing
-- here weakens the existing owner access.

drop policy if exists "courses_member_select" on public.courses;
create policy "courses_member_select" on public.courses
  for select
  using (exists (select 1 from public.course_members m where m.course_id = id and m.user_id = auth.uid()));

drop policy if exists "documents_member_select" on public.documents;
create policy "documents_member_select" on public.documents
  for select
  using (exists (select 1 from public.course_members m where m.course_id = documents.course_id and m.user_id = auth.uid()));

drop policy if exists "document_chunks_member_select" on public.document_chunks;
create policy "document_chunks_member_select" on public.document_chunks
  for select
  using (
    exists (
      select 1 from public.documents d
      join public.course_members m on m.course_id = d.course_id
      where d.id = document_chunks.document_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "study_artifacts_member_select" on public.study_artifacts;
create policy "study_artifacts_member_select" on public.study_artifacts
  for select
  using (exists (select 1 from public.course_members m where m.course_id = study_artifacts.course_id and m.user_id = auth.uid()));

drop policy if exists "flashcards_member_select" on public.flashcards;
create policy "flashcards_member_select" on public.flashcards
  for select
  using (
    exists (
      select 1 from public.study_artifacts a
      join public.course_members m on m.course_id = a.course_id
      where a.id = flashcards.deck_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "flashcards_member_review" on public.flashcards;
create policy "flashcards_member_review" on public.flashcards
  for update
  using (
    exists (
      select 1 from public.study_artifacts a
      join public.course_members m on m.course_id = a.course_id
      where a.id = flashcards.deck_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.study_artifacts a
      join public.course_members m on m.course_id = a.course_id
      where a.id = flashcards.deck_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "concepts_member_select" on public.concepts;
create policy "concepts_member_select" on public.concepts
  for select
  using (exists (select 1 from public.course_members m where m.course_id = concepts.course_id and m.user_id = auth.uid()));

drop policy if exists "concept_links_member_select" on public.concept_links;
create policy "concept_links_member_select" on public.concept_links
  for select
  using (
    exists (
      select 1 from public.concepts c
      join public.course_members m on m.course_id = c.course_id
      where c.id = concept_links.concept_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "reel_cards_member_select" on public.reel_cards;
create policy "reel_cards_member_select" on public.reel_cards
  for select
  using (
    exists (
      select 1 from public.study_artifacts a
      join public.course_members m on m.course_id = a.course_id
      where a.id = reel_cards.reel_id and m.user_id = auth.uid()
    )
  );
