import Image from "next/image";
import styles from "./Footer.module.css";

const COLUMNS = [
  {
    title: "Read",
    links: [
      { label: "Chapters", href: "#chapters" },
      { label: "How it works", href: "#how-it-works" },
    ],
  },
  {
    title: "Chapters",
    links: [
      { label: "Chat & citations", href: "#chapters" },
      { label: "Reels", href: "#chapters" },
      { label: "Concept graph", href: "#chapters" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Start your first chapter", href: "/login?mode=signup" },
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

        <div className={styles.colophon}>
          <Image
            src="/brand/lore-mark.png"
            alt="LoreBook"
            width={28}
            height={35}
            className={styles.mark}
          />
          <span>© {year} LoreBook — free for every classroom.</span>
        </div>
      </div>
    </footer>
  );
}
