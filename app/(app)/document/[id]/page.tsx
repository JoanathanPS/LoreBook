import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { MediaPlayer } from "@/components/document/MediaPlayer";
import styles from "./page.module.css";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; page?: string }>;
}) {
  const { id } = await params;
  const { t, page } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, type, storage_path, course_id, status")
    .eq("id", id)
    .single();

  if (!doc) notFound();

  const isMedia = doc.type === "audio" || doc.type === "video";
  const isPdf = doc.type === "pdf";

  let signedUrl: string | null = null;
  if ((isMedia || isPdf) && doc.storage_path) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    signedUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap} data-wide={isPdf ? "true" : undefined}>
        <div className={styles.inner}>
          <Link href={`/chat/${doc.course_id}`} className={styles.backLink}>
            ← Back to chat
          </Link>
          <h1 className={styles.title}>
            {doc.title}
            {isPdf && page ? <span className={styles.pageBadge}>p. {page}</span> : null}
          </h1>

          {isMedia && signedUrl ? (
            <MediaPlayer
              src={signedUrl}
              kind={doc.type as "audio" | "video"}
              startAt={t ? Number(t) : undefined}
            />
          ) : isPdf && signedUrl ? (
            <iframe
              key={page ?? "1"}
              src={`${signedUrl}#page=${page ?? "1"}`}
              className={styles.pdfFrame}
              title={doc.title}
            />
          ) : (
            <div className={styles.fallback}>
              {isMedia || isPdf
                ? "This file isn't available for viewing right now."
                : `LoreBook doesn't have a live viewer for ${doc.type} files yet — citations still tell you exactly where to look in your own copy.`}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
