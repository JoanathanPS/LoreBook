import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: course }, { data: concepts }, { data: historyMessages }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, documents(id, title, status, type)")
      .eq("id", courseId)
      .single(),
    supabase
      .from("concepts")
      .select("id, name")
      .eq("course_id", courseId)
      .limit(30),
    supabase
      .from("chat_messages")
      .select("id, role, content, metadata, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  if (!course) notFound();

  const initialMessages = (historyMessages ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    parts: [{ type: "text" as const, text: m.content }],
    metadata: m.metadata ?? undefined,
  }));

  return (
    <ChatPanel
      courseId={course.id}
      courseName={course.name}
      documents={course.documents ?? []}
      concepts={concepts ?? []}
      initialMessages={initialMessages}
    />
  );
}
