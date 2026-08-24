import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Button } from "@/components/ui/button";
import { joinCourse } from "@/lib/actions/collab";
import styles from "./page.module.css";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/join/${id}`);

  const { data: invite } = await supabase
    .from("course_invites")
    .select("id, course_id")
    .eq("id", id)
    .single();

  if (!invite) notFound();

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", invite.course_id)
    .maybeSingle();

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
