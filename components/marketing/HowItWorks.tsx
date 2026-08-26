import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    numeral: "I",
    title: "Upload what you study from",
    desc: "PDFs, slides, lecture video or audio, or a photo of your notes — dropped into a course.",
  },
  {
    numeral: "II",
    title: "Ask, or let it generate",
    desc: "Chat with citations, or generate a summary, quiz, flashcard deck, or Reel for a topic.",
  },
  {
    numeral: "III",
    title: "Watch mastery build",
    desc: "Every quiz and recall check feeds the concept graph and the spaced-repetition queue.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>How it works</span>
        <h2 className={styles.title}>Three chapters, in order.</h2>
      </div>

      <div className={styles.steps}>
        {STEPS.map((step) => (
          <div key={step.title} className={styles.step} data-reveal>
            <span className={styles.numeral}>{step.numeral}</span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDesc}>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
