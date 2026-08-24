import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { SimpleMarkdown } from "@/components/study/SimpleMarkdown";
import styles from "./page.module.css";

export default async function SummaryPage({
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
    .select("title, status, error_message, content")
    .eq("id", id)
    .single();

  if (!artifact) notFound();

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <div className={styles.inner}>
          <Link href="/library" className={styles.backLink}>
            ← Back to library
          </Link>
          <h1 className={styles.title}>{artifact.title}</h1>

          <div className={styles.card}>
            {artifact.status === "generating" && (
              <p className={styles.pending}>Generating…</p>
            )}
            {artifact.status === "error" && (
              <p className={styles.error}>{artifact.error_message}</p>
            )}
            {artifact.status === "ready" && (
              <SimpleMarkdown text={(artifact.content as { text: string }).text} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
