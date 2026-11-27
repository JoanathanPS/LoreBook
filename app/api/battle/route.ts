import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { quizId?: string; courseId?: string }
    | null;
  const quizId = body?.quizId;
  const courseId = body?.courseId;
  if (!quizId || !courseId) {
    return NextResponse.json({ error: "quizId and courseId are required" }, { status: 400 });
  }

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
    // 42501 = the insert policy rejected it: the quiz isn't readable by this
    // user, isn't in this course, or isn't finished generating.
    if (error?.code === "42501") {
      return NextResponse.json(
        { error: "You can only start a battle on a finished quiz in one of your courses." },
        { status: 403 },
      );
    }
    console.error("battle create failed", error);
    return NextResponse.json({ error: "Could not create the battle. Try again." }, { status: 500 });
  }

  return NextResponse.json({ id: battle.id });
}
