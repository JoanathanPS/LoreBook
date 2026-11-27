import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session-user";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Button } from "@/components/ui/button";
import { JoinCourseForm } from "./JoinCourseForm";
import styles from "./page.module.css";

type InviteStatus = "ok" | "expired" | "used_up" | "owner" | "member";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(`/login?redirectTo=/join/${id}`);

  // The invitee isn't a member yet, so RLS hides both the invite and the
  // course row; this security-definer RPC resolves them for the invitee.
  const { data: invite, error } = await supabase
    .rpc("get_invite_preview", { p_invite_id: id })
    .maybeSingle<{ course_id: string; course_name: string; status: InviteStatus }>();

  if (error) throw new Error(`Couldn't load this invite: ${error.message}`);
  if (!invite) notFound();

  const name = invite.course_name;
  let title: string;
  let body: React.ReactNode;

  switch (invite.status) {
    case "owner":
    case "member":
      title = `You're already in "${name}"`;
      body = (
        <Button render={<Link href={`/chat/${invite.course_id}`} />} nativeButton={false}>
          Open course
        </Button>
      );
      break;
    case "expired":
      title = "This invite has expired";
      body = <p className={styles.hint}>Ask whoever shared &quot;{name}&quot; for a new link.</p>;
      break;
    case "used_up":
      title = "This invite has already been used";
      body = <p className={styles.hint}>Ask whoever shared &quot;{name}&quot; for a new link.</p>;
      break;
    default:
      title = `Join "${name}"?`;
      body = (
        <>
          <p className={styles.hint}>
            You&apos;ll be able to browse its material, chat, take quizzes, and review
            flashcards alongside whoever invited you.
          </p>
          <JoinCourseForm inviteId={id} courseId={invite.course_id} />
        </>
      );
  }

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {body}
        </div>
      </div>
    </>
  );
}
