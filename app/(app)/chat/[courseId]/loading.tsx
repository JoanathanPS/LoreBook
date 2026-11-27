import { Skeleton } from "@/components/ui/skeleton";
import s from "../../route-skeletons.module.css";

/** Mirrors ChatPanel's sidebar + message column + composer. */
export default function ChatLoading() {
  return (
    <div className={s.chat} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading chat…</span>
      <aside className={s.chatSidebar}>
        <Skeleton style={{ width: "70%", height: "1.5rem" }} />
        <Skeleton style={{ width: "50%", height: "0.875rem" }} />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} style={{ height: "2.25rem" }} />
        ))}
      </aside>
      <div className={s.chatMain}>
        <div className={s.chatMessages}>
          <Skeleton className={s.bubbleUser} />
          <Skeleton className={s.bubbleAssistant} />
          <Skeleton className={s.bubbleUser} />
          <Skeleton className={s.bubbleAssistant} />
        </div>
        <div className={s.chatComposer}>
          <Skeleton style={{ height: "3.25rem", borderRadius: "1rem" }} />
        </div>
      </div>
    </div>
  );
}
