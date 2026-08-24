import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: courses }, { data: documents }, { data: concepts }, { data: artifacts }] =
    await Promise.all([
      supabase.from("courses").select("id, name"),
      supabase.from("documents").select("id, title, course_id"),
      supabase.from("concepts").select("id, name, course_id"),
      supabase.from("study_artifacts").select("id, title, kind, course_id"),
    ]);

  return NextResponse.json({
    courses: courses ?? [],
    documents: documents ?? [],
    concepts: concepts ?? [],
    artifacts: artifacts ?? [],
  });
}
