import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Library, LayoutDashboard, UserCheck, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Button } from "@/components/ui/button";
import { CommandPaletteTrigger } from "@/components/command/CommandPaletteTrigger";
import { SoundToggle } from "@/components/audio/SoundToggle";
import { DeleteAccountModal } from "@/components/settings/DeleteAccountModal";
import styles from "./page.module.css";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const provider = user.app_metadata?.provider ?? "email";
  const createdDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link href="/library" className={styles.brand}>
            <Image
              src="/brand/lore-header-v2.png"
              alt="LoreBook"
              width={150}
              height={40}
              priority
              className={styles.logoImg}
            />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CommandPaletteTrigger />
            <SoundToggle />
            <Button render={<Link href="/library" />} nativeButton={false} variant="ghost" size="sm">
              <Library size={14} />
              Library
            </Button>
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
        </header>

        <main className={styles.main}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Preferences &amp; Profile</span>
            <h1 className={styles.title}>Account settings.</h1>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <UserCheck size={18} className="text-primary" />
              <span>Profile Information</span>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{user.email ?? "No email"}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Sign-in Provider</span>
                <span className={styles.infoValue} style={{ textTransform: "capitalize" }}>
                  {provider}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Member Since</span>
                <span className={styles.infoValue}>{createdDate}</span>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Volume2 size={18} className="text-primary" />
              <span>Audio &amp; Feedback</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)" }}>
                  Sound Effects
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                  Toggle ambient audio and synthesized UI sounds during card flips and study sessions.
                </p>
              </div>
              <SoundToggle />
            </div>
          </div>

          <DeleteAccountModal userEmail={user.email ?? "your account"} />
        </main>
      </div>
    </>
  );
}
