import { redirect } from "next/navigation";

/** The real post-auth landing is /library (Phase 2) — this is a compatibility redirect. */
export default function DashboardPage() {
  redirect("/library");
}
