"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { joinCourse, type JoinState } from "@/lib/actions/collab";
import styles from "./page.module.css";

export function JoinCourseForm({ inviteId, courseId }: { inviteId: string; courseId: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinCourse, {
    error: null,
  });

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <input type="hidden" name="courseId" value={courseId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Join course"}
      </Button>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
