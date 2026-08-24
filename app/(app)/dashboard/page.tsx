import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Button } from "@/components/ui/button";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Phase 1 — auth check</p>
          <h1 className={styles.title}>You&apos;re in, {user.email}.</h1>
          <p className={styles.body}>
            Supabase Auth is wired end to end — middleware protects this
            route, and this page reads your session server-side. The real
            dashboard (bento analytics, library, course switcher) lands in
            Phase 7.
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
