import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText, FileText, MessageSquare, Sparkles, Share2, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createCourse } from "@/lib/actions/courses";
import { signOut } from "@/lib/actions/auth";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { DocumentStatusBadge } from "@/components/library/DocumentStatusBadge";
import { ArtifactGenerator } from "@/components/library/ArtifactGenerator";
import { CommandPaletteTrigger } from "@/components/command/CommandPaletteTrigger";
import { artifactHref } from "@/lib/study/artifact-links";
import styles from "./page.module.css";

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  status: string;
  error_message: string | null;
  document_chunks: { count: number }[];
}

interface ArtifactRow {
  id: string;
  kind: string;
  title: string;
  status: string;
}

interface CourseRow {
  id: string;
  name: string;
  documents: DocumentRow[];
  study_artifacts: ArtifactRow[];
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, name, documents(id, title, type, status, error_message, document_chunks(count)), study_artifacts(id, kind, title, status)",
    )
    .order("created_at", { ascending: true })
    .returns<CourseRow[]>();

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand}>
              <BookOpenText size={16} style={{ display: "inline", marginRight: 6 }} />
              LoreBook
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CommandPaletteTrigger />
              <Button render={<Link href="/dashboard" />} nativeButton={false} variant="ghost" size="sm">
                <LayoutDashboard size={14} />
                Dashboard
              </Button>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <h1 className={styles.title}>Library</h1>

          <form action={createCourse} className={styles.createForm}>
            <Input name="name" placeholder="New course name (e.g. Thermodynamics)" required />
            <Button type="submit">Create</Button>
          </form>

          {!courses || courses.length === 0 ? (
            <div className={styles.empty}>
              No courses yet — create one above, then upload the material you want to
              study from into it.
            </div>
          ) : (
            <div className={styles.courses}>
              {courses.map((course) => (
                <div key={course.id} className={styles.courseCard}>
                  <div className={styles.courseHeader}>
                    <div className={styles.courseName}>{course.name}</div>
                    <div className={styles.courseActions}>
                      <Button
                        render={<Link href={`/chat/${course.id}`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        <MessageSquare size={14} />
                        Chat
                      </Button>
                      <Button
                        render={<Link href={`/graph/${course.id}`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        <Share2 size={14} />
                        Graph
                      </Button>
                    </div>
                  </div>

                  <UploadDropzone courseId={course.id} />

                  {course.documents.length > 0 && (
                    <div className={styles.docList}>
                      {course.documents.map((doc) => (
                        <div key={doc.id} className={styles.docRow}>
                          <FileText size={14} />
                          <span className={styles.docTitle}>{doc.title}</span>
                          <span className={styles.docType}>{doc.type}</span>
                          {doc.status === "error" && doc.error_message ? (
                            <span className={styles.docError}>{doc.error_message}</span>
                          ) : doc.status === "ready" ? (
                            <span className={styles.docMeta}>
                              {doc.document_chunks[0]?.count ?? 0} chunks
                            </span>
                          ) : null}
                          <DocumentStatusBadge status={doc.status} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.studySection}>
                    <div className={styles.studyLabel}>
                      <Sparkles size={13} />
                      Study tools
                    </div>
                    <ArtifactGenerator courseId={course.id} courseName={course.name} />

                    {course.study_artifacts.length > 0 && (
                      <div className={styles.docList}>
                        {course.study_artifacts.map((artifact) => (
                          <Link
                            key={artifact.id}
                            href={artifactHref(artifact.kind, artifact.id)}
                            className={`${styles.docRow} hover-lift`}
                          >
                            <span className={styles.docTitle}>{artifact.title}</span>
                            <DocumentStatusBadge status={artifact.status} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
