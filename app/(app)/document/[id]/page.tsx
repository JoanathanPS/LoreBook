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
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
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

  let signedUrl: string | null = null;
  if (isMedia && doc.storage_path) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    signedUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <div className={styles.inner}>
          <Link href={`/chat/${doc.course_id}`} className={styles.backLink}>
            ← Back to chat
          </Link>
          <h1 className={styles.title}>{doc.title}</h1>

          {isMedia && signedUrl ? (
            <MediaPlayer
              src={signedUrl}
              kind={doc.type as "audio" | "video"}
              startAt={t ? Number(t) : undefined}
            />
          ) : (
            <div className={styles.fallback}>
              {isMedia
                ? "This file isn't available for playback right now."
                : `LoreBook doesn't have a live viewer for ${doc.type} files yet — citations still tell you exactly where to look in your own copy.`}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
