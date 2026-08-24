import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectDocumentType } from "@/lib/ingest/detect-type";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const courseId = formData.get("course_id");

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
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
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
    })
    .select("id, title, type, status")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ document: doc });
}
