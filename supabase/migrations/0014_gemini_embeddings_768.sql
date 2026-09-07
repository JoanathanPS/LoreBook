-- Migration 0014: Switch vector dimension to 768 for Gemini text-embedding-004
-- Run this once in the Supabase SQL editor (Database > SQL Editor).

-- 1. Drop existing index that uses 1024 dimensions
drop index if exists public.document_chunks_embedding_idx;

-- 2. Clear previous 1024-dim chunks to allow type alter
truncate table public.document_chunks;

-- 3. Alter document_chunks embedding column to 768 dims
alter table public.document_chunks
  alter column embedding type vector(768);

-- 4. Re-create the HNSW vector index for 768 dims
create index if not exists document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- 5. Re-create match_document_chunks function with vector(768)
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
as \$\$
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
\$\$;
