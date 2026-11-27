-- Migration 0018: resumable ingestion job queue (docs/REVIVAL_PLAN.md, Phase 1).
--
-- Processing used to be one long HTTP request. If it timed out, the document
-- stayed `processing` forever. Now an upload enqueues a row in ingest_jobs,
-- and a worker (/api/ingest/tick) claims jobs and runs one bounded step per
-- claim: extract+chunk, then embed one batch at a time, then mark ready, then
-- optional concept enrichment. A crash costs one step, never the document.
--
-- Run once in the Supabase SQL editor after 0001-0017. Safe to re-run.

-- ------------------------------------------------------------ documents
alter table public.documents
  add column if not exists stage text,
  add column if not exists progress int not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists content_sha256 text;

alter table public.documents drop constraint if exists documents_progress_range;
alter table public.documents
  add constraint documents_progress_range check (progress between 0 and 100);

-- Dedupe lookups: "does this user already have a ready copy of this file?"
create index if not exists documents_user_sha256_idx
  on public.documents (user_id, content_sha256)
  where content_sha256 is not null;

-- ------------------------------------------------------- document_chunks
-- Chunks are inserted first with a NULL embedding, then filled batch by batch.
alter table public.document_chunks alter column embedding drop not null;
alter table public.document_chunks add column if not exists embedding_model text;

-- The embed step asks for "the next N chunks with no embedding" for a document.
create index if not exists document_chunks_pending_embedding_idx
  on public.document_chunks (document_id, chunk_index)
  where embedding is null;

-- Retrieval must skip chunks that are still pending. The body is otherwise
-- identical to the latest definition (0014).
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
    and c.user_id = auth.uid()
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ----------------------------------------------------------- ingest_jobs
create table if not exists public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  -- Consecutive failed or crashed steps. Reset to 0 after any successful step,
  -- so a long document that takes 50 steps never hits the limit by itself.
  attempts int not null default 0,
  locked_at timestamptz,
  -- Not before this time (backoff after a rate limit or a transient error).
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ingest_jobs_runnable_idx
  on public.ingest_jobs (run_after)
  where status in ('queued', 'running');

alter table public.ingest_jobs enable row level security;

-- Owners can see their own jobs (status, last error). All writes go through
-- enqueue_ingest_job() or the service-role worker, never direct client writes.
drop policy if exists "ingest_jobs_owner_select" on public.ingest_jobs;
create policy "ingest_jobs_owner_select" on public.ingest_jobs
  for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------ enqueue (callable by users)
-- Puts a document (back) on the queue and resets its visible progress.
-- Used by upload, by "Retry", and by the legacy /process endpoint.
create or replace function public.enqueue_ingest_job(p_document_id uuid)
returns public.ingest_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_job public.ingest_jobs;
begin
  select user_id into v_owner from public.documents where id = p_document_id;
  if v_owner is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if auth.role() is distinct from 'service_role' and auth.uid() is distinct from v_owner then
    raise exception 'Not allowed to process this document' using errcode = '42501';
  end if;

  update public.documents
     set status = 'processing',
         stage = 'queued',
         progress = 0,
         error_message = null,
         processing_started_at = now()
   where id = p_document_id;

  insert into public.ingest_jobs (document_id, user_id)
  values (p_document_id, v_owner)
  on conflict (document_id) do update
     set status = 'queued',
         attempts = 0,
         locked_at = null,
         run_after = now(),
         last_error = null,
         updated_at = now()
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.enqueue_ingest_job(uuid) from public, anon;
grant execute on function public.enqueue_ingest_job(uuid) to authenticated, service_role;

-- ------------------------------------------------------ claim (worker only)
-- Claims one runnable job: queued and due, or running but locked for more
-- than 10 minutes (its worker died, so it is re-queued). SKIP LOCKED lets
-- several workers run at once without claiming the same job.
-- p_document_id narrows the claim to one document (the post-upload kick).
create or replace function public.claim_ingest_job(p_document_id uuid default null)
returns setof public.ingest_jobs
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.ingest_jobs j
     set status = 'running',
         locked_at = now(),
         attempts = j.attempts + 1,
         updated_at = now()
   where j.id = (
     select q.id
       from public.ingest_jobs q
      where (p_document_id is null or q.document_id = p_document_id)
        and (
          (q.status = 'queued' and q.run_after <= now())
          or (q.status = 'running' and q.locked_at < now() - interval '10 minutes')
        )
      order by q.run_after
      limit 1
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function public.claim_ingest_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_ingest_job(uuid) to service_role;

-- ------------------------------------------------ write a batch of embeddings
-- PostgREST cannot bulk-update different values per row, so the embed step
-- sends ids and vectors (as '[0.1,0.2,...]' text) in one call.
create or replace function public.set_chunk_embeddings(
  p_ids uuid[],
  p_embeddings text[],
  p_model text
)
returns int
language sql
security invoker
set search_path = public
as $$
  with updated as (
    update public.document_chunks c
       set embedding = x.e::vector(768),
           embedding_model = p_model
      from unnest(p_ids, p_embeddings) as x(id, e)
     where c.id = x.id
    returning 1
  )
  select count(*)::int from updated;
$$;

revoke all on function public.set_chunk_embeddings(uuid[], text[], text) from public, anon, authenticated;
grant execute on function public.set_chunk_embeddings(uuid[], text[], text) to service_role;

-- ------------------------------------------------- dedupe: copy ready chunks
-- When the same user uploads a file whose sha256 matches a ready document,
-- copy that document's chunks (embeddings included) instead of re-embedding.
create or replace function public.copy_document_chunks(p_source uuid, p_target uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.document_chunks where document_id = p_target;

  insert into public.document_chunks
    (document_id, user_id, chunk_index, content, embedding, embedding_model, page_ref, timestamp_ref)
  select p_target, t.user_id, s.chunk_index, s.content, s.embedding, s.embedding_model, s.page_ref, s.timestamp_ref
    from public.document_chunks s
    cross join (select user_id from public.documents where id = p_target) t
   where s.document_id = p_source;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.copy_document_chunks(uuid, uuid) from public, anon, authenticated;
grant execute on function public.copy_document_chunks(uuid, uuid) to service_role;

-- ------------------------------------------------------------- realtime
-- The library page subscribes to UPDATEs on the user's documents rows to show
-- stage and progress. Realtime applies RLS, so users only see rows they can read.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;
