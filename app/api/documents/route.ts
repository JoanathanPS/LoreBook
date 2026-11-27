import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { detectDocumentType } from "@/lib/ingest/detect-type";
import { enqueueDocument, workerConfigured } from "@/lib/ingest/enqueue";
import { kickIngest } from "@/lib/ingest/worker";

// The request itself returns as soon as the document is queued. maxDuration
// covers the after() kick that starts processing straight away, so small
// files are ready in seconds instead of waiting for the next cron tick.
export const maxDuration = 60;
export const runtime = "nodejs";

/** Queue the new document and start working on it after the response is sent. */
async function enqueueAndKick(supabase: SupabaseClient, request: Request, documentId: string) {
  await enqueueDocument(supabase, documentId);
  if (workerConfigured()) {
    const origin = new URL(request.url).origin;
    after(() => kickIngest(documentId, origin));
  } else {
    console.warn("[upload] SUPABASE_SERVICE_ROLE_KEY missing: document queued but no worker can run.");
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const contentType = request.headers.get("content-type") ?? "";

    // Direct upload pattern (browser uploaded directly to Supabase Storage)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { documentId, courseId, title, storagePath, isExamPaper } = body as {
        documentId: string;
        courseId: string;
        title: string;
        storagePath: string;
        isExamPaper?: boolean;
      };

      if (!documentId || !courseId || !title || !storagePath) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const type = detectDocumentType(title);
      if (!type) {
        return NextResponse.json(
          { error: `Unsupported file type: ${title.split(".").pop()}` },
          { status: 400 },
        );
      }

      const { data: doc, error: insertError } = await supabase
        .from("documents")
        .insert({
          id: documentId,
          course_id: courseId,
          user_id: user.id,
          type,
          title,
          storage_path: storagePath,
          status: "uploaded",
          is_exam_paper: !!isExamPaper,
        })
        .select("id, title, type, status")
        .single();

      if (insertError) {
        console.error("[upload] db insert error:", insertError);
        return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 });
      }

      await enqueueAndKick(supabase, request, doc.id);
      return NextResponse.json({ document: { ...doc, status: "processing", stage: "queued" } });
    }

    // Fallback: FormData upload
    const formData = await request.formData();
    const file = formData.get("file");
    const courseId = formData.get("course_id");
    const isExamPaper = formData.get("is_exam_paper") === "true";

    if (!(file instanceof File) || typeof courseId !== "string") {
      return NextResponse.json({ error: "Missing file or course_id" }, { status: 400 });
    }

    const type = detectDocumentType(file.name);
    if (!type) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.name.split(".").pop()}` },
        { status: 400 },
      );
    }

    const documentId = crypto.randomUUID();
    const storagePath = `${user.id}/${documentId}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, { contentType: file.type || undefined, upsert: true });

    if (uploadError) {
      console.error("[upload] storage upload error:", uploadError);
      return NextResponse.json({ error: `Storage error: ${uploadError.message}` }, { status: 500 });
    }

    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        course_id: courseId,
        user_id: user.id,
        type,
        title: file.name,
        storage_path: storagePath,
        status: "uploaded",
        is_exam_paper: isExamPaper,
      })
      .select("id, title, type, status")
      .single();

    if (insertError) {
      console.error("[upload] db insert error:", insertError);
      return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 });
    }

    await enqueueAndKick(supabase, request, doc.id);
    return NextResponse.json({ document: { ...doc, status: "processing", stage: "queued" } });
  } catch (err) {
    console.error("[upload] fatal error:", err);
    const message = err instanceof Error ? err.message : "Document upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
