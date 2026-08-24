import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { quizId, courseId } = (await request.json()) as { quizId: string; courseId: string };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: battle, error } = await supabase
    .from("battle_sessions")
    .insert({ course_id: courseId, quiz_id: quizId, host_id: user.id })
    .select("id")
    .single();

  if (error || !battle) {
    return NextResponse.json({ error: error?.message ?? "Could not create battle" }, { status: 500 });
  }

  return NextResponse.json({ id: battle.id });
}
