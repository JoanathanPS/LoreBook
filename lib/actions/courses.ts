"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCourse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("courses").insert({ user_id: user.id, name });
  revalidatePath("/library");
}

export async function deleteCourse(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (courses_owner_all) already restricts this to the owner; documents,
  // study_artifacts, etc. all reference courses with `on delete cascade`.
  await supabase.from("courses").delete().eq("id", courseId);
  revalidatePath("/library");
}
