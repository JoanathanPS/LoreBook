import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "#modules", label: "Modules" },
  { href: "#how-it-works", label: "How it works" },
];

export function Nav() {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark}>
            <BookOpenText size={16} strokeWidth={2.25} />
          </span>
          LoreBook
        </Link>

        <nav className={styles.links}>
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <Button render={<Link href="/login" />} variant="ghost" size="sm">
            Sign in
          </Button>
          <Button render={<Link href="/login?mode=signup" />} size="sm">
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
}
