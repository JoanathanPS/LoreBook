import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { courseId } = (await request.json()) as { courseId?: string };
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  await supabase
    .from("chat_messages")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
