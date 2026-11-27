import { Skeleton } from "@/components/ui/skeleton";
import s from "../../route-skeletons.module.css";

/** Mirrors the document reader: back link, title, then the page/viewer. */
export default function DocumentLoading() {
  return (
    <div className={s.doc} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading document…</span>
      <div className={s.docInner}>
        <div className={s.docHeaderRow}>
          <Skeleton style={{ width: "8rem", height: "1rem" }} />
          <Skeleton style={{ width: "9rem", height: "1rem" }} />
        </div>
        <Skeleton style={{ width: "min(28rem, 80%)", height: "2.25rem" }} />
        <Skeleton className={s.docPage} />
      </div>
    </div>
  );
}
