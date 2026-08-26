import styles from "./FeaturesBento.module.css";

interface Chapter {
  numeral: string;
  title: string;
  desc: string;
}

const CHAPTERS: Chapter[] = [
  {
    numeral: "I",
    title: "Ingestion",
    desc: "PDFs, slides, lecture video and audio, and photographed notes — read, transcribed, and chunked for retrieval.",
  },
  {
    numeral: "II",
    title: "Chat with citations",
    desc: "Ask questions scoped to a document or a whole course. Every answer cites the source page or timestamp.",
  },
  {
    numeral: "III",
    title: "Study artifacts",
    desc: "One click makes summaries, flashcards, quizzes, and formula sheets, feeding a spaced-repetition schedule.",
  },
  {
    numeral: "IV",
    title: "Reels",
    desc: "Any topic, decomposed into a swipeable stack of bite-sized cards with a recall check at the end.",
  },
  {
    numeral: "V",
    title: "Concept graph",
    desc: "A map linking concepts across everything you've uploaded, coloured by how well you know each one.",
  },
  {
    numeral: "VI",
    title: "Dashboard",
    desc: "Study time, quiz trends, topic mastery, and your review queue, in one place.",
  },
];

export function FeaturesBento() {
  return (
    <section id="chapters" className={styles.section}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>What&rsquo;s inside</span>
        <h2 className={styles.title}>Six chapters, one pipeline.</h2>
      </div>

      <div className={styles.grid}>
        {CHAPTERS.map((c) => (
          <article key={c.title} className={styles.card} data-reveal>
            <span className={styles.numeral}>{c.numeral}</span>
            <div>
              <h3 className={styles.cardTitle}>{c.title}</h3>
              <p className={styles.cardDesc}>{c.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
