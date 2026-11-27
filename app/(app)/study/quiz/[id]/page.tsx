import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session-user";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { QuizRunner } from "@/components/study/QuizRunner";
import type { QuizQuestion } from "@/lib/ai/generate";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // The session check and the data read are independent (RLS scopes the read
  // to the same JWT), so start both at once and redirect after.
  const [user, { data: artifact }] = await Promise.all([
    getSessionUser(supabase),
    supabase
      .from("study_artifacts")
      .select("id, title, status, error_message, content, course_id")
      .eq("id", id)
      .single(),
  ]);
  if (!user) redirect("/login");

  if (!artifact) notFound();

  const questions =
    artifact.status === "ready"
      ? (artifact.content as { questions: QuizQuestion[] }).questions
      : [];

  return (
    <>
      <GradientMesh />
      <QuizRunner
        quizId={artifact.id}
        courseId={artifact.course_id}
        title={artifact.title}
        status={artifact.status}
        errorMessage={artifact.error_message}
        questions={questions}
      />
    </>
  );
}
