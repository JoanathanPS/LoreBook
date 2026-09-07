-- Delete User Account function
-- Allows an authenticated user to delete their own account and cascade delete all their data.

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Deleting from auth.users cascades to courses, documents, study_artifacts,
  -- flashcards, quiz_attempts, mastery_scores, streaks, etc.
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
