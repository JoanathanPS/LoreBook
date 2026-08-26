import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.section}>
      <div className={styles.cover}>
        <Image
          src="/brand/lore-mark.png"
          alt=""
          width={220}
          height={275}
          priority
          className={styles.mark}
          aria-hidden="true"
        />

        <span className={styles.eyebrow} data-anim="fade-up">
          A study workspace, not another app to manage
        </span>

        <h1 className={styles.headline} data-anim="headline">
          lore<span className={styles.dot}>.</span>book
        </h1>

        <p className={styles.subhead} data-anim="fade-up">
          Upload the PDF, the lecture recording, or the photo of your notes.
          LoreBook reads it, cites the exact page or timestamp when it
          answers, and turns the material into flashcards, quizzes, and a
          concept map you can watch fill in.
        </p>

        <div className={styles.ctaRow} data-anim="fade-up">
          <span data-magnetic className={styles.magneticWrap}>
            <Button
              render={<Link href="/login?mode=signup" />}
              nativeButton={false}
              size="lg"
            >
              Start your first chapter
              <ArrowRight />
            </Button>
          </span>
          <Button
            render={<a href="#chapters" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            See what&rsquo;s inside
          </Button>
        </div>
      </div>

      <div className={styles.panel} data-anim="fade-up">
        <div className={styles.panelChrome}>
          <span className={styles.chromeLabel}>
            thermodynamics-week6.pdf — chat
          </span>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.bubbleUser}>
            why does entropy increase in an irreversible process?
          </div>
          <div className={styles.bubbleAi}>
            <span>
              Because irreversible processes generate entropy internally —
              the Clausius inequality gives dS &gt; δQ/T, so total entropy
              (system + surroundings) always rises.
            </span>
            <span className={styles.citation}>
              <FileText size={12} />
              p. 14, eq. 6.2
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
