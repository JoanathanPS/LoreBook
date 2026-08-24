import {
  Layers,
  MessagesSquare,
  Sparkles,
  Share2,
  LayoutDashboard,
  GraduationCap,
} from "lucide-react";
import styles from "./FeaturesBento.module.css";

type ModuleSpan = "wide" | "tall" | undefined;

interface ModuleCard {
  icon: typeof Layers;
  title: string;
  desc: string;
  span?: ModuleSpan;
  badge?: string;
}

const MODULES: ModuleCard[] = [
  {
    icon: Layers,
    title: "Ingestion pipeline",
    desc: "PDFs, slides, lecture video/audio, and photographed notes — read, transcribed, and chunked for retrieval.",
    span: "wide",
  },
  {
    icon: MessagesSquare,
    title: "Chat over your material",
    desc: "Ask questions scoped to a document or a whole course. Every answer cites the source page or timestamp.",
    span: "tall",
  },
  {
    icon: Sparkles,
    title: "Study artifact generator",
    desc: "One click → summaries, flashcards, quizzes, and formula sheets, feeding a spaced-repetition scheduler.",
  },
  {
    icon: GraduationCap,
    badge: "Reels",
    title: "Study Reels",
    desc: "Any topic, decomposed into a swipeable stack of bite-sized cards with a recall check at the end.",
  },
  {
    icon: Share2,
    title: "Concept graph",
    desc: "A force-directed map linking concepts across every document you've uploaded, colored by mastery.",
  },
  {
    icon: LayoutDashboard,
    title: "Analytics dashboard",
    desc: "Study time, quiz trends, topic mastery, and your spaced-repetition queue in one bento view.",
  },
];

export function FeaturesBento() {
  return (
    <section id="modules" className={styles.section}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>What it does</span>
        <h2 className={styles.title}>
          One pipeline, six ways to actually study.
        </h2>
      </div>

      <div className={styles.grid}>
        {MODULES.map((m) => {
          const Icon = m.icon;
          const spanClass =
            m.span === "wide"
              ? styles.wide
              : m.span === "tall"
                ? styles.tall
                : "";
          return (
            <article
              key={m.title}
              className={`${styles.card} ${spanClass} hover-lift`}
              data-reveal
            >
              <span className={styles.icon}>
                <Icon size={18} strokeWidth={2} />
              </span>
              <div>
                <h3 className={styles.cardTitle}>
                  {m.title}
                  {m.badge ? (
                    <span className={styles.badge}>{m.badge}</span>
                  ) : null}
                </h3>
                <p className={styles.cardDesc}>{m.desc}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
