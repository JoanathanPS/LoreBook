import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, MessageSquare, Sparkles, Share2, LayoutDashboard, Target } from "lucide-react";
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
import { SoundToggle } from "@/components/audio/SoundToggle";
import { InviteButton } from "@/components/collab/InviteButton";
import { DeleteCourseButton } from "@/components/library/DeleteCourseButton";
import { DocumentRowActions } from "@/components/library/DocumentRowActions";
import { artifactHref } from "@/lib/study/artifact-links";
import { courseAccent } from "@/lib/study/course-accent";
import styles from "./page.module.css";

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  status: string;
  error_message: string | null;
  user_id: string;
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
  user_id: string;
  documents: DocumentRow[];
  study_artifacts: ArtifactRow[];
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select(
      "id, name, user_id, documents(id, title, type, status, error_message, user_id, document_chunks(count)), study_artifacts(id, kind, title, status)",
    )
    .order("created_at", { ascending: true })
    .returns<CourseRow[]>();

  if (coursesError) {
    // A courses row can genuinely exist while this query still fails (RLS
    // policy error, bad migration state, etc.) — showing the empty state
    // in that case hides a real problem, so surface it instead.
    console.error("[library] failed to load courses:", coursesError);
  }

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="dashboard" className={styles.brand}>
              lore.book
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CommandPaletteTrigger />
              <SoundToggle />
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
          <h1 className={styles.title}>The shelf.</h1>

          <form action={createCourse} className={styles.createForm}>
            <Input name="name" placeholder="New course name (e.g. Thermodynamics)" required />
            <Button type="submit">Create</Button>
          </form>

          {coursesError ? (
            <div className={styles.empty}>
              Couldn&rsquo;t load your courses ({coursesError.message}). If you can see
              rows in the Supabase table editor but not here, your database is
              likely missing a migration — check that every file in
              supabase/migrations has been run, especially 0009_fix_rls_recursion.sql.
            </div>
          ) : !courses || courses.length === 0 ? (
            <div className={styles.empty}>
              No courses yet — create one above, then upload the material you want to
              study from into it.
            </div>
          ) : (
            <div className={styles.courses}>
              {courses.map((course) => {
                const isOwner = course.user_id === user.id;
                return (
                <div
                  key={course.id}
                  className={styles.courseCard}
                  style={{ borderLeftColor: courseAccent(course.id) }}
                >
                  <div className={styles.courseHeader}>
                    <div className={styles.courseName}>
                      {course.name}
                      {!isOwner && <span className={styles.sharedBadge}>Shared</span>}
                    </div>
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
                      <Button
                        render={<Link href={`/predict/${course.id}`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        <Target size={14} />
                        Predict
                      </Button>
                      {isOwner && <InviteButton courseId={course.id} />}
                      {isOwner && (
                        <DeleteCourseButton courseId={course.id} courseName={course.name} />
                      )}
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
                          {doc.user_id === user.id && (
                            <DocumentRowActions
                              documentId={doc.id}
                              documentTitle={doc.title}
                              status={doc.status}
                            />
                          )}
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
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
