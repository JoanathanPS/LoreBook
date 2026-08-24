"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinCourse(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("course_members").upsert(
    { course_id: courseId, user_id: user.id },
    { onConflict: "course_id,user_id", ignoreDuplicates: true },
  );

  redirect("/library");
}
