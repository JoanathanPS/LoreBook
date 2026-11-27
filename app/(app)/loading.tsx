import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the instant a link inside the app is clicked, while the server
 * renders the real page. Also what <Link> prefetches for dynamic routes, so
 * a click swaps to this with no network wait at all.
 */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" style={{ minHeight: "100dvh" }}>
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          style={{
            marginInline: "auto",
            maxWidth: "var(--container-max)",
            paddingInline: "var(--container-pad-x)",
            height: "4rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Skeleton style={{ width: "7rem", height: "1.75rem" }} />
          <Skeleton style={{ width: "5rem", height: "2rem" }} />
        </div>
      </div>
      <main
        style={{
          marginInline: "auto",
          maxWidth: "var(--container-max)",
          paddingInline: "var(--container-pad-x)",
          paddingBlock: "3rem",
          display: "grid",
          gap: "1.5rem",
        }}
      >
        <span className="sr-only">Loading…</span>
        <Skeleton style={{ width: "min(22rem, 70%)", height: "2.25rem" }} />
        <Skeleton style={{ width: "min(34rem, 90%)", height: "1rem" }} />
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
            marginTop: "1rem",
          }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} style={{ height: "7.5rem", borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      </main>
    </div>
  );
}
