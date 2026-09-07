"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import styles from "./AuthCard.module.css";


function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

const initialState: AuthState = { error: null };

export function AuthCard({
  defaultMode,
  confirmEmail,
  redirectTo,
}: {
  defaultMode: "signin" | "signup";
  confirmEmail: boolean;
  redirectTo: string;
}) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setOauthError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        setOauthError(error.message);
        setGoogleLoading(false);
      }
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "Google sign in failed");
      setGoogleLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Back to LoreBook
      </Link>

      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.brandLogo}>
            lore<span className={styles.brandDot}>.</span>book
          </Link>
          <span className={styles.subtitle}>
            Sign in to pick up where you left off, or create an account.
          </span>
        </div>

        {confirmEmail && (
          <p className={styles.notice}>
            Check your email to confirm your account before signing in.
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className={styles.oauthButton}
        >
          {googleLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          <span>Continue with Google</span>
        </Button>

        {oauthError && <p className={styles.error}>{oauthError}</p>}

        <div className={styles.divider}>
          <span>or continue with email</span>
        </div>

        <Tabs defaultValue={defaultMode}>
          <TabsList className="w-full">
            <TabsTrigger value="signin" className="flex-1">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form action={signInAction} className={styles.form}>
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className={styles.field}>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className={styles.field}>
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {signInState.error && (
                <p className={styles.error}>{signInState.error}</p>
              )}
              <Button type="submit" disabled={signInPending} className="w-full">
                {signInPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form action={signUpAction} className={styles.form}>
              <div className={styles.field}>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className={styles.field}>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              {signUpState.error && (
                <p className={styles.error}>{signUpState.error}</p>
              )}
              <Button type="submit" disabled={signUpPending} className="w-full">
                {signUpPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
