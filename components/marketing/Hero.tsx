import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeOrbLoader } from "./KnowledgeOrbLoader";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.section}>
      <div className={styles.orb} aria-hidden="true">
        <KnowledgeOrbLoader />
      </div>

      <div className={styles.copy}>
        <span className={styles.eyebrow}>
          <span className={styles.dot} />
          Built for engineering coursework
        </span>

        <h1 className={styles.headline} data-anim="headline">
          Turn your course material into a{" "}
          <span className={styles.accentText}>study workspace</span> that
          talks back.
        </h1>

        <p className={styles.subhead} data-anim="fade-up">
          Upload PDFs, lecture recordings, and photographed notes. LoreBook
          reads the diagrams, cites the exact page or timestamp, and turns
          any topic into flashcards, quizzes, and a concept map you can
          actually track mastery against.
        </p>

        <div className={styles.ctaRow} data-anim="fade-up">
          <span data-magnetic className={styles.magneticWrap}>
            <Button
              render={<Link href="/login?mode=signup" />}
              nativeButton={false}
              size="lg"
            >
              Get started
              <ArrowRight />
            </Button>
          </span>
          <Button
            render={<a href="#modules" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            See how it works
          </Button>
        </div>
      </div>

      <div className={styles.panel} data-anim="fade-up">
        <div className={styles.panelChrome}>
          <span className={styles.chromeDot} />
          <span className={styles.chromeDot} />
          <span className={styles.chromeDot} />
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
