import styles from "./AuthorNote.module.css";

const RESUME_HREF = "https://joanathan.in";

export function AuthorNote() {
  return (
    <section className={styles.section} data-reveal>
      <span className={styles.eyebrow}>The author&rsquo;s note</span>
      <hr className={styles.rule} />

      <p className={styles.body}>
        I built LoreBook because studying engineering material meant
        re-reading the same PDF five times, then rebuilding flashcards by
        hand at 1am before an exam. The material was never the hard part —
        turning it into something you could actually be quizzed on was.
      </p>
      <p className={styles.body}>
        Every answer LoreBook gives you points back to the page or the
        timestamp it came from, because a study tool that can&rsquo;t show
        its work isn&rsquo;t one you should trust with your grade. It&rsquo;s
        free to use, it stays out of your way, and it was built for a
        classroom, not a demo.
      </p>

      <div className={styles.signoff}>
        <span className={styles.name}>Joanathan</span>
        <a
          className={styles.resume}
          href={RESUME_HREF}
          target="_blank"
          rel="noreferrer"
        >
          Read my résumé →
        </a>
      </div>
    </section>
  );
}
