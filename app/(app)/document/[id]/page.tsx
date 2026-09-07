import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { MediaPlayer } from "@/components/document/MediaPlayer";
import { SlideViewer } from "@/components/document/SlideViewer";
import { DocumentReader } from "@/components/document/DocumentReader";
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
  const isImage = doc.type === "image";
  const isPptx = doc.type === "pptx";
  const isDocxOrNote = doc.type === "docx" || doc.type === "note";

  let signedUrl: string | null = null;
  if (doc.storage_path) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    signedUrl = data?.signedUrl ?? null;
  }

  // Fetch document chunks for text/slide preview
  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("content, page_ref, chunk_index, timestamp_ref")
    .eq("document_id", id)
    .order("chunk_index", { ascending: true })
    .limit(100);

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap} data-wide={isPdf || isImage || isPptx || isDocxOrNote ? "true" : undefined}>
        <div className={styles.inner}>
          <div className={styles.headerRow}>
            <Link href="/library" className={styles.backLink}>
              ← Back to library
            </Link>
            {signedUrl && (
              <a href={signedUrl} download={doc.title} target="_blank" rel="noreferrer" className={styles.downloadLink}>
                Download original ↗
              </a>
            )}
          </div>

          <h1 className={styles.title}>
            {doc.title}
            {isPdf && page ? <span className={styles.pageBadge}>p. {page}</span> : null}
            {isPptx && page ? <span className={styles.pageBadge}>Slide {page}</span> : null}
            {isDocxOrNote && page ? <span className={styles.pageBadge}>p. {page}</span> : null}
            <span className={styles.typeBadge}>{doc.type.toUpperCase()}</span>
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
          ) : isImage && signedUrl ? (
            <div className={styles.imageViewerWrap}>
              <img src={signedUrl} alt={doc.title} className={styles.imageViewer} />
            </div>
          ) : isPptx ? (
            <div style={{ minHeight: "680px", height: "75vh", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(160, 124, 62, 0.2)" }}>
              <SlideViewer
                chunks={chunks ?? []}
                initialSlide={page ? Number(page) : 1}
                title={doc.title}
                signedUrl={signedUrl}
              />
            </div>
          ) : isDocxOrNote || (chunks && chunks.length > 0) || signedUrl ? (
            <div style={{ minHeight: "680px", height: "75vh", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(160, 124, 62, 0.2)" }}>
              <DocumentReader
                chunks={chunks ?? []}
                initialPage={page ? Number(page) : 1}
                title={doc.title}
                signedUrl={signedUrl}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
