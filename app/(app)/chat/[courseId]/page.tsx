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

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, documents(id, title, status)")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  return (
    <ChatPanel courseId={course.id} courseName={course.name} documents={course.documents} />
  );
}
