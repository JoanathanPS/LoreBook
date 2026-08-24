import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nudgeMastery } from "@/lib/study/mastery";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { correctCount, total } = (await request.json()) as {
    correctCount: number;
    total: number;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: artifact } = await supabase
    .from("study_artifacts")
    .select("content")
    .eq("id", id)
    .eq("kind", "reel")
    .single();

  const conceptIds = (artifact?.content as { conceptIds?: string[] } | null)?.conceptIds ?? [];
  const accuracy = total > 0 ? correctCount / total : 0.5;

  await nudgeMastery(supabase, user.id, conceptIds, accuracy);

  return NextResponse.json({ ok: true });
}
