import * as d3 from "d3";
import styles from "./AccuracyTrend.module.css";

interface Attempt {
  score: number;
  taken_at: string;
}

const WIDTH = 480;
const HEIGHT = 160;
const PAD = 24;

/** Static SVG line chart — no client JS needed, computed with d3-scale/d3-shape at render time. */
export function AccuracyTrend({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) {
    return <p className={styles.empty}>No quiz attempts yet.</p>;
  }

  const sorted = [...attempts].sort(
    (a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime(),
  );

  const x = d3
    .scaleLinear()
    .domain([0, Math.max(1, sorted.length - 1)])
    .range([PAD, WIDTH - PAD]);
  const y = d3.scaleLinear().domain([0, 1]).range([HEIGHT - PAD, PAD]);

  const line = d3
    .line<Attempt>()
    .x((_d, i) => x(i))
    .y((d) => y(d.score))
    .curve(d3.curveMonotoneX);

  const path = line(sorted) ?? "";
  const area =
    d3
      .area<Attempt>()
      .x((_d, i) => x(i))
      .y0(HEIGHT - PAD)
      .y1((d) => y(d.score))
      .curve(d3.curveMonotoneX)(sorted) ?? "";

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg}>
      <line x1={PAD} x2={WIDTH - PAD} y1={y(0.5)} y2={y(0.5)} className={styles.gridline} />
      <path d={area} className={styles.area} />
      <path d={path} className={styles.line} />
      {sorted.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.score)} r={3} className={styles.dot} />
      ))}
    </svg>
  );
}
