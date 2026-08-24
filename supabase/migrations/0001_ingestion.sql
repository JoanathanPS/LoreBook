-- Phase 2: ingestion pipeline schema (PLAN.md §4, §7).
-- Run this once in the Supabase SQL editor (Database > SQL Editor) for the
-- LoreBook project. Safe to re-run — everything is IF NOT EXISTS / OR REPLACE.

create extension if not exists vector;

-- ---------------------------------------------------------------- courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

drop policy if exists "courses_owner_all" on public.courses;
create policy "courses_owner_all" on public.courses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------- documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('pdf', 'docx', 'pptx', 'image', 'audio', 'video', 'note')),
  title text not null,
  storage_path text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists documents_course_id_idx on public.documents (course_id);

alter table public.documents enable row level security;

drop policy if exists "documents_owner_all" on public.documents;
create policy "documents_owner_all" on public.documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------ chunks
-- 1024 dims matches Voyage's voyage-3 embedding model (lib/ai/embeddings.ts).
-- If you switch embedding models, this column's dimension must match.
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1024),
  page_ref int,
  timestamp_ref numeric,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);
create index if not exists document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.document_chunks enable row level security;

drop policy if exists "document_chunks_owner_all" on public.document_chunks;
create policy "document_chunks_owner_all" on public.document_chunks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------ storage
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_bucket_owner_all" on storage.objects;
create policy "documents_bucket_owner_all" on storage.objects
  for all
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
