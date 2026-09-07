"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; success?: string | null };

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const redirectTo = String(formData.get("redirectTo") ?? "/library");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect(redirectTo);
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  redirect("/login?confirmEmail=1");
}

export async function resendConfirmationEmail(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Please enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { error: null, success: "Verification email sent! Please check your inbox." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccount(): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Try calling the PostgreSQL RPC function (migration 0013)
  const { error: rpcError } = await supabase.rpc("delete_user_account");

  if (rpcError) {
    console.warn("RPC delete_user_account failed, attempting cascade fallback:", rpcError.message);
    // Fallback: delete user data from public tables
    await supabase.from("courses").delete().eq("user_id", user.id);
    await supabase.from("streaks").delete().eq("user_id", user.id);
    await supabase.from("mastery_scores").delete().eq("user_id", user.id);
    await supabase.from("quiz_attempts").delete().eq("user_id", user.id);
    await supabase.from("flashcards").delete().eq("user_id", user.id);
    await supabase.from("study_artifacts").delete().eq("user_id", user.id);
    await supabase.from("documents").delete().eq("user_id", user.id);
  }

  await supabase.auth.signOut();
  redirect("/login");
}
