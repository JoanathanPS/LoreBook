-- Fix: battle mode and course invites (docs/REVIVAL_PLAN.md, Phase 3).
-- Run after 0001-0019.
--
-- Battle
--   * A guest who isn't a course member can't read study_artifacts under RLS,
--     so they saw zero questions and could "win" with an empty submission.
--     get_battle_questions() returns prompts + choices (never correct answers)
--     to either participant.
--   * Scores were a racy client read-modify-write, and any participant could
--     write any score. join_battle() and submit_battle_answers() now do this
--     atomically in SQL; submit_battle_answers() grades server-side and marks
--     the battle finished once both players have submitted. Clients can no
--     longer UPDATE battle_sessions directly.
--   * A battle can only be created for a quiz the host can read, in the
--     course it belongs to, so the questions RPC can't be used to read
--     someone else's quiz.
--
-- Invites
--   * joinCourse ignored the invite and anyone could insert themselves into
--     any course. Membership is now only granted through accept_course_invite(),
--     which checks the invite exists, matches the course, hasn't expired and
--     hasn't run out of uses.
--   * course_invites was readable by every user (select using (true)), which
--     let anyone list every invite. The invitee now resolves an invite through
--     get_invite_preview(), which also returns the real course name.

-- ===================================================================== battle

drop policy if exists "battle_sessions_host_insert" on public.battle_sessions;
create policy "battle_sessions_host_insert" on public.battle_sessions
  for insert
  with check (
    auth.uid() = host_id
    and guest_id is null
    and status = 'waiting'
    and scores = '{}'::jsonb
    -- Evaluated under the host's own RLS: they must be able to read the quiz.
    and exists (
      select 1 from public.study_artifacts a
      where a.id = quiz_id
        and a.course_id = battle_sessions.course_id
        and a.kind = 'quiz'
        and a.status = 'ready'
    )
  );

-- All writes after creation go through the functions below.
drop policy if exists "battle_sessions_participant_update" on public.battle_sessions;

create or replace function public.get_battle_questions(p_battle_id uuid)
returns table (title text, questions jsonb)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  b public.battle_sessions%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into b from public.battle_sessions where id = p_battle_id;
  if not found then
    raise exception 'Battle not found' using errcode = 'P0002';
  end if;
  if uid <> b.host_id and uid is distinct from b.guest_id then
    raise exception 'Join the battle to see its questions' using errcode = '42501';
  end if;

  return query
    select
      a.title,
      coalesce(
        (
          select jsonb_agg(
                   jsonb_build_object('prompt', q.value -> 'prompt', 'choices', q.value -> 'choices')
                   order by q.ord
                 )
          from jsonb_array_elements(coalesce(a.content -> 'questions', '[]'::jsonb))
               with ordinality as q(value, ord)
        ),
        '[]'::jsonb
      )
    from public.study_artifacts a
    where a.id = b.quiz_id;
end;
$$;

create or replace function public.join_battle(p_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b public.battle_sessions%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into b from public.battle_sessions where id = p_battle_id for update;
  if not found then
    raise exception 'Battle not found' using errcode = 'P0002';
  end if;
  if b.guest_id = uid then
    return; -- already joined
  end if;
  if b.host_id = uid then
    raise exception 'You can''t join your own battle — send the link to a friend' using errcode = '22023';
  end if;
  if b.guest_id is not null or b.status <> 'waiting' then
    raise exception 'This battle already has two players' using errcode = '22023';
  end if;

  update public.battle_sessions
     set guest_id = uid, status = 'active'
   where id = p_battle_id;
end;
$$;

create or replace function public.submit_battle_answers(p_battle_id uuid, p_answers int[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b public.battle_sessions%rowtype;
  qs jsonb;
  total int;
  correct int;
  score int;
  new_scores jsonb;
  new_status text;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Row lock serialises the two players' submissions, so neither can
  -- overwrite the other's score and "finished" is set exactly once.
  select * into b from public.battle_sessions where id = p_battle_id for update;
  if not found then
    raise exception 'Battle not found' using errcode = 'P0002';
  end if;
  if uid <> b.host_id and uid is distinct from b.guest_id then
    raise exception 'You are not in this battle' using errcode = '42501';
  end if;
  if b.status <> 'active' then
    raise exception 'This battle is not in progress' using errcode = '22023';
  end if;
  if b.scores ? uid::text then
    raise exception 'You already submitted your answers' using errcode = '22023';
  end if;

  select coalesce(a.content -> 'questions', '[]'::jsonb) into qs
    from public.study_artifacts a where a.id = b.quiz_id;
  total := coalesce(jsonb_array_length(qs), 0);
  if total = 0 then
    raise exception 'This quiz has no questions' using errcode = '22023';
  end if;
  if coalesce(array_length(p_answers, 1), 0) <> total then
    raise exception 'Answer all % questions before submitting', total using errcode = '22023';
  end if;

  select count(*) into correct
    from jsonb_array_elements(qs) with ordinality as q(value, ord)
   where (q.value ->> 'correctIndex')::int = p_answers[q.ord];

  score := round(correct * 100.0 / total);
  new_scores := b.scores || jsonb_build_object(uid::text, score);
  new_status := case
    when b.guest_id is not null
     and new_scores ? b.host_id::text
     and new_scores ? b.guest_id::text
    then 'finished' else 'active' end;

  update public.battle_sessions
     set scores = new_scores,
         answers = answers || jsonb_build_object(uid::text, to_jsonb(p_answers)),
         status = new_status
   where id = p_battle_id;

  return jsonb_build_object(
    'score', score,
    'correct', correct,
    'total', total,
    'status', new_status,
    'scores', new_scores
  );
end;
$$;

revoke all on function public.get_battle_questions(uuid) from public;
revoke all on function public.join_battle(uuid) from public;
revoke all on function public.submit_battle_answers(uuid, int[]) from public;
grant execute on function public.get_battle_questions(uuid) to authenticated;
grant execute on function public.join_battle(uuid) to authenticated;
grant execute on function public.submit_battle_answers(uuid, int[]) to authenticated;

-- ==================================================================== invites

alter table public.course_invites
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists max_uses int check (max_uses is null or max_uses > 0),
  add column if not exists use_count int not null default 0;

-- Only the course owner (or the invite's creator) can list invites.
drop policy if exists "course_invites_select" on public.course_invites;
create policy "course_invites_select" on public.course_invites
  for select
  using (auth.uid() = created_by or public.is_course_owner(course_id, auth.uid()));

-- Users can no longer add themselves to arbitrary courses.
drop policy if exists "course_members_self_insert" on public.course_members;

-- Members may still leave a course on their own.
drop policy if exists "course_members_self_delete" on public.course_members;
create policy "course_members_self_delete" on public.course_members
  for delete
  using (auth.uid() = user_id);

-- status: 'ok' | 'expired' | 'used_up' | 'owner' | 'member'. No row = no such invite.
create or replace function public.get_invite_preview(p_invite_id uuid)
returns table (course_id uuid, course_name text, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  return query
    select
      i.course_id,
      c.name,
      case
        when c.user_id = uid then 'owner'
        when public.is_course_member(i.course_id, uid) then 'member'
        when i.expires_at <= now() then 'expired'
        when i.max_uses is not null and i.use_count >= i.max_uses then 'used_up'
        else 'ok'
      end,
      i.expires_at
    from public.course_invites i
    join public.courses c on c.id = i.course_id
    where i.id = p_invite_id;
end;
$$;

create or replace function public.accept_course_invite(p_invite_id uuid, p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.course_invites%rowtype;
  inserted int;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into inv from public.course_invites where id = p_invite_id for update;
  if not found then
    raise exception 'This invite link is not valid' using errcode = 'P0002';
  end if;
  if inv.course_id <> p_course_id then
    raise exception 'This invite is for a different course' using errcode = '22023';
  end if;

  if public.is_course_owner(inv.course_id, uid) or public.is_course_member(inv.course_id, uid) then
    return inv.course_id; -- nothing to do
  end if;

  if inv.expires_at <= now() then
    raise exception 'This invite has expired — ask for a new link' using errcode = '22023';
  end if;
  if inv.max_uses is not null and inv.use_count >= inv.max_uses then
    raise exception 'This invite has already been used — ask for a new link' using errcode = '22023';
  end if;

  insert into public.course_members (course_id, user_id)
  values (inv.course_id, uid)
  on conflict (course_id, user_id) do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.course_invites set use_count = use_count + 1 where id = inv.id;
  end if;

  return inv.course_id;
end;
$$;

revoke all on function public.get_invite_preview(uuid) from public;
revoke all on function public.accept_course_invite(uuid, uuid) from public;
grant execute on function public.get_invite_preview(uuid) to authenticated;
grant execute on function public.accept_course_invite(uuid, uuid) to authenticated;
