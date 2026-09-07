import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "#chapters", label: "Chapters" },
  { href: "#how-it-works", label: "How it works" },
];

export function Nav() {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/brand/lore-header-v2.png"
            alt="LoreBook"
            width={150}
            height={40}
            priority
            className={styles.logoImg}
          />
        </Link>

        <nav className={styles.links}>
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            Sign in
          </Button>
          <Button
            render={<Link href="/login?mode=signup" />}
            nativeButton={false}
            size="sm"
          >
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
}
