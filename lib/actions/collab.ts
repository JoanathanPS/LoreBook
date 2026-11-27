"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error: string | null };

/**
 * Accepts a course invite. Validation (invite exists, matches the course,
 * not expired, not used up) happens in the accept_course_invite RPC — it is
 * the only way to become a course member.
 */
export async function joinCourse(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const inviteId = String(formData.get("inviteId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!inviteId || !courseId) return { error: "This invite link is incomplete." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/join/${inviteId}`);

  const { data: joinedCourseId, error } = await supabase.rpc("accept_course_invite", {
    p_invite_id: inviteId,
    p_course_id: courseId,
  });

  if (error) return { error: error.message };

  redirect(`/chat/${joinedCourseId ?? courseId}`);
}
