"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import styles from "./AuthCard.module.css";

const initialState: AuthState = { error: null };

export function AuthCard({
  defaultMode,
  confirmEmail,
}: {
  defaultMode: "signin" | "signup";
  confirmEmail: boolean;
}) {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Back to LoreBook
      </Link>

      <div className={styles.card}>
        <div className={styles.header}>
          <BookOpenText size={20} strokeWidth={2.25} />
          <span className={styles.title}>Welcome to LoreBook</span>
          <span className={styles.subtitle}>
            Sign in to pick up where you left off, or create an account.
          </span>
        </div>

        {confirmEmail && (
          <p className={styles.notice}>
            Check your email to confirm your account before signing in.
          </p>
        )}

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
