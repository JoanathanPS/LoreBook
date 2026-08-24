import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: artifact } = await supabase
    .from("study_artifacts")
    .select("id, title, status, error_message, content")
    .eq("id", id)
    .single();

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
        title={artifact.title}
        status={artifact.status}
        errorMessage={artifact.error_message}
        questions={questions}
      />
    </>
  );
}
