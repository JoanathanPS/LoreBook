"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Deletes the signed-in user's account.
 *
 * 1. Remove their uploaded files from storage while their session can still
 *    pass the bucket's owner-only RLS (the folder is `${user.id}/...`), since
 *    deleting the auth user doesn't touch storage.
 * 2. Delete the auth user via the delete_user_account RPC (migration 0013),
 *    which cascades to all their rows.
 * 3. Confirm with the auth server that the user is really gone before
 *    reporting success.
 */
export async function deleteAccount(): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const storageError = await removeUserStorage(supabase, user.id);
  if (storageError) {
    return {
      error: `Couldn't delete your uploaded files (${storageError}). Your account was not deleted — please try again.`,
    };
  }

  const { error: rpcError } = await supabase.rpc("delete_user_account");
  if (rpcError) {
    console.error("delete_user_account failed", rpcError);
    return {
      error: `Your account couldn't be deleted (${rpcError.message}). Your uploaded files were removed, but your account and other data are still there — please try again or contact support.`,
    };
  }

  // getUser() asks the auth server, so it fails once the user row is gone.
  const { data: stillThere } = await supabase.auth.getUser();
  if (stillThere.user) {
    return {
      error: "Your account still exists after the delete request. Please try again or contact support.",
    };
  }

  // The session's user no longer exists; clear the cookies locally.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  redirect("/login");
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const DOCUMENTS_BUCKET = "documents";

/** Removes every object under `${userId}/` in the documents bucket. Returns an error message or null. */
async function removeUserStorage(supabase: ServerSupabase, userId: string): Promise<string | null> {
  const bucket = supabase.storage.from(DOCUMENTS_BUCKET);
  const paths = new Set<string>();

  // Paths recorded on documents rows (covers anything outside the usual layout).
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("user_id", userId)
    .not("storage_path", "is", null);
  if (docsError) return docsError.message;
  for (const d of docs ?? []) if (d.storage_path) paths.add(d.storage_path as string);

  // Anything else in the user's folder, e.g. orphaned uploads. Layout is
  // `${userId}/${documentId}/${filename}`; list() isn't recursive, so walk it.
  const listError = await collectFolder(bucket, userId, paths, 0);
  if (listError) return listError;

  const all = [...paths];
  for (let i = 0; i < all.length; i += 100) {
    const { error } = await bucket.remove(all.slice(i, i + 100));
    if (error) return error.message;
  }
  return null;
}

async function collectFolder(
  bucket: ReturnType<ServerSupabase["storage"]["from"]>,
  prefix: string,
  out: Set<string>,
  depth: number,
): Promise<string | null> {
  if (depth > 4) return null;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error) return error.message;
    if (!data || data.length === 0) return null;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back with a null id.
      if (entry.id === null) {
        const err = await collectFolder(bucket, path, out, depth + 1);
        if (err) return err;
      } else {
        out.add(path);
      }
    }
    if (data.length < 1000) return null;
  }
}
