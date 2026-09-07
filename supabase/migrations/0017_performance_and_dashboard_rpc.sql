-- Migration 0017: Performance Indexes & Dashboard RPC Function
-- Accelerates dashboard rendering from 6+ sequential roundtrips to 1 single instant query.

-- Ensure chat_messages table exists (from 0015) in case it was not run yet
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_course_idx on public.chat_messages (course_id, user_id, created_at asc);
alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_owner_all" on public.chat_messages;
create policy "chat_messages_owner_all" on public.chat_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 1. High-impact query indexes
create index if not exists flashcards_user_due_idx on public.flashcards (user_id, due_at);
create index if not exists quiz_attempts_user_taken_idx on public.quiz_attempts (user_id, taken_at desc);
create index if not exists mastery_scores_user_updated_idx on public.mastery_scores (user_id, updated_at desc);
create index if not exists concepts_course_id_idx on public.concepts (course_id);
create index if not exists chat_messages_course_created_idx on public.chat_messages (course_id, created_at asc);
create index if not exists study_artifacts_course_created_idx on public.study_artifacts (course_id, created_at desc);

-- 2. Consolidated dashboard summary RPC
create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_streak record;
  v_attempts jsonb;
  v_mastery jsonb;
  v_due_count bigint := 0;
  v_doc_count bigint := 0;
  v_artifact_count bigint := 0;
begin
  if v_user_id is null then
    return null;
  end if;

  -- Streaks
  select current_streak, longest_streak, xp into v_streak
  from public.streaks
  where user_id = v_user_id
  limit 1;

  -- Quiz attempts (recent 20)
  select coalesce(jsonb_agg(sub), '[]'::jsonb) into v_attempts
  from (
    select score, taken_at
    from public.quiz_attempts
    where user_id = v_user_id
    order by taken_at desc
    limit 20
  ) sub;

  -- Mastery scores with concepts (recent 12)
  select coalesce(jsonb_agg(sub), '[]'::jsonb) into v_mastery
  from (
    select m.score, c.name as concept_name
    from public.mastery_scores m
    left join public.concepts c on c.id = m.concept_id
    where m.user_id = v_user_id
    order by m.updated_at desc
    limit 12
  ) sub;

  -- Flashcards due
  select count(*) into v_due_count
  from public.flashcards
  where user_id = v_user_id and due_at <= now();

  -- Documents count
  select count(*) into v_doc_count
  from public.documents
  where user_id = v_user_id;

  -- Artifacts count
  select count(*) into v_artifact_count
  from public.study_artifacts
  where user_id = v_user_id;

  return jsonb_build_object(
    'streak', jsonb_build_object(
      'current_streak', coalesce(v_streak.current_streak, 0),
      'longest_streak', coalesce(v_streak.longest_streak, 0),
      'xp', coalesce(v_streak.xp, 0)
    ),
    'attempts', v_attempts,
    'mastery', v_mastery,
    'due_count', v_due_count,
    'document_count', v_doc_count,
    'artifact_count', v_artifact_count
  );
end;
$$;
