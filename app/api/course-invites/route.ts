import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { courseId } = (await request.json()) as { courseId: string };

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
    return NextResponse.json({ error: error?.message ?? "Could not create invite" }, { status: 500 });
  }

  return NextResponse.json({ id: invite.id });
}
