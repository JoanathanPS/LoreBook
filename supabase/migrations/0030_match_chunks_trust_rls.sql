-- Migration 0030: RAG retrieval must follow course sharing again.
-- Run after 0001-0018 (the ingest-queue migration 0018 recreates this
-- function too, so this one has to come later).
--
-- 0010 removed `and c.user_id = auth.uid()` from match_document_chunks on
-- purpose: with it, chat in a shared course only ever retrieved chunks the
-- caller had uploaded. 0014 recreated the function for vector(768) and put
-- that line back by accident, and 0018 kept 0014's body (adding only the
-- `c.embedding is not null` guard for chunks the queue hasn't embedded yet).
--
-- The function is security invoker, so the document_chunks RLS policies
-- already decide what the caller may read:
--   * document_chunks_owner_all      - chunks the caller uploaded
--   * document_chunks_member_select  - chunks of documents in any course the
--                                      caller owns or is a member of (0010's
--                                      is_course_participant)
-- A course member therefore gets the owner's chunks, the owner gets members'
-- chunks, and someone outside the course gets nothing. Do NOT make this
-- function security definer: RLS is the only access check left in it.
--
-- `create or replace` keeps the existing EXECUTE grants; the signature
-- (vector(768), uuid, int) and return type are unchanged.

create or replace function public.match_document_chunks(
  query_embedding vector(768),
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
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
