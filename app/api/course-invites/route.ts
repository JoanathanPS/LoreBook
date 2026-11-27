import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { courseId?: string } | null;
  const courseId = body?.courseId;
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: invite, error } = await supabase
    .from("course_invites")
    .insert({ course_id: courseId, created_by: user.id })
    .select("id")
    .single();

  if (error || !invite) {
    if (error?.code === "42501") {
      return NextResponse.json(
        { error: "Only the course owner can create invite links." },
        { status: 403 },
      );
    }
    console.error("invite create failed", error);
    return NextResponse.json({ error: "Could not create an invite link. Try again." }, { status: 500 });
  }

  return NextResponse.json({ id: invite.id });
}
