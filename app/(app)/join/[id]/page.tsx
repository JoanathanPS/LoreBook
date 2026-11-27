import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session-user";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Button } from "@/components/ui/button";
import { joinCourse } from "@/lib/actions/collab";
import styles from "./page.module.css";

interface InviteRow {
  id: string;
  course_id: string;
  courses: { name: string } | { name: string }[] | null;
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // The session check and the data read are independent (RLS scopes the read
  // to the same JWT), so start both at once and redirect after.
  const [user, { data: invite }] = await Promise.all([
    getSessionUser(supabase),
    supabase
      .from("course_invites")
      .select("id, course_id, courses(name)")
      .eq("id", id)
      .returns<InviteRow[]>()
      .single(),
  ]);
  if (!user) redirect(`/login?redirectTo=/join/${id}`);

  if (!invite) notFound();

  // Embedded via the course_id FK: same RLS as a separate courses query,
  // one round trip instead of two.
  const course = Array.isArray(invite.courses) ? invite.courses[0] : invite.courses;

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>Join &quot;{course?.name ?? "this course"}&quot;?</h1>
          <p className={styles.hint}>
            You&apos;ll be able to browse its material, chat, take quizzes, and review
            flashcards alongside whoever invited you.
          </p>
          <form action={joinCourse}>
            <input type="hidden" name="courseId" value={invite.course_id} />
            <Button type="submit">Join course</Button>
          </form>
        </div>
      </div>
    </>
  );
}
