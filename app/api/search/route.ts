import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [coursesRes, documentsRes, conceptsRes, artifactsRes] =
    await Promise.all([
      supabase.from("courses").select("id, name"),
      supabase.from("documents").select("id, title, course_id"),
      supabase.from("concepts").select("id, name, course_id"),
      supabase.from("study_artifacts").select("id, title, kind, course_id"),
    ]);

  const failed = [coursesRes, documentsRes, conceptsRes, artifactsRes].find((r) => r.error);
  if (failed?.error) {
    console.error("search index load failed", failed.error);
    return NextResponse.json({ error: "Couldn't load search results." }, { status: 500 });
  }

  return NextResponse.json(
    {
      courses: coursesRes.data ?? [],
      documents: documentsRes.data ?? [],
      concepts: conceptsRes.data ?? [],
      artifacts: artifactsRes.data ?? [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
