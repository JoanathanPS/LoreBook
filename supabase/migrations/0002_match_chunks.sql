-- Phase 3: vector similarity search for RAG chat (PLAN.md §7 step 3).
-- Run this once in the Supabase SQL editor, after 0001_ingestion.sql.

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
    and c.user_id = auth.uid()
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
