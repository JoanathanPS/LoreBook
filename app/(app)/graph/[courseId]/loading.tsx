import { Skeleton } from "@/components/ui/skeleton";
import s from "../../route-skeletons.module.css";

/** Mirrors ConceptGraphView: header bar, graph canvas, inspector panel. */
export default function GraphLoading() {
  return (
    <div className={s.graph} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading concept map…</span>
      <div className={s.graphHeader}>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <Skeleton style={{ width: "8rem", height: "0.875rem" }} />
          <Skeleton style={{ width: "min(22rem, 60vw)", height: "1.75rem" }} />
        </div>
        <Skeleton style={{ width: "11rem", height: "2.25rem" }} />
      </div>
      <div className={s.graphBody}>
        <Skeleton className={s.graphCanvas} />
        <aside className={s.graphPanel}>
          <Skeleton style={{ width: "60%", height: "1.25rem" }} />
          <Skeleton style={{ height: "5rem" }} />
          <Skeleton style={{ height: "2.75rem" }} />
        </aside>
      </div>
    </div>
  );
}
