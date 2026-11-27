import type { SupabaseClient } from "@supabase/supabase-js";
import { hasAdminConfig } from "@/lib/supabase/admin";

/**
 * Puts a document on the ingest queue (or back on it, for a retry) through
 * the enqueue_ingest_job RPC, which checks that the caller owns the document
 * and resets its status, stage and progress in the same transaction.
 *
 * Pass the user's own (RLS-scoped) Supabase client.
 */
export async function enqueueDocument(supabase: SupabaseClient, documentId: string): Promise<void> {
  const { error } = await supabase.rpc("enqueue_ingest_job", { p_document_id: documentId });
  if (error) {
    const hint = /enqueue_ingest_job/.test(error.message)
      ? " (has migration 0018_ingest_jobs.sql been applied?)"
      : "";
    throw new Error(`Could not queue document for processing: ${error.message}${hint}`);
  }
}

/** Whether the worker can run at all in this deployment. */
export function workerConfigured(): boolean {
  return hasAdminConfig();
}
