import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectDocumentType } from "@/lib/ingest/detect-type";

export const maxDuration = 60;

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

      return NextResponse.json({ document: doc });
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

    return NextResponse.json({ document: doc });
  } catch (err) {
    console.error("[upload] fatal error:", err);
    const message = err instanceof Error ? err.message : "Document upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
