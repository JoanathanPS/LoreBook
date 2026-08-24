import styles from "./Footer.module.css";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Modules", href: "#modules" },
      { label: "How it works", href: "#how-it-works" },
    ],
  },
  {
    title: "Modules",
    links: [
      { label: "Chat & citations", href: "#modules" },
      { label: "Study Reels", href: "#modules" },
      { label: "Concept graph", href: "#modules" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/login?mode=signup" },
    ],
  },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className={styles.columnTitle}>{col.title}</div>
              <div className={styles.columnLinks}>
                {col.links.map((link) => (
                  <a key={link.label} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.wordmark} aria-hidden="true">
          LOREBOOK
        </div>

        <div className={styles.bottom}>
          <span>© {year} LoreBook. A capstone project.</span>
          <span>Built for engineering students.</span>
        </div>
      </div>
    </footer>
  );
}
