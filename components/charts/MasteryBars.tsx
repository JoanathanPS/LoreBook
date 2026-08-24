import styles from "./MasteryBars.module.css";

interface MasteryRow {
  name: string;
  score: number;
}

function colorFor(score: number): string {
  if (score < 0.4) return "#d66b6b";
  if (score < 0.7) return "#f2b341";
  return "#3fae82";
}

export function MasteryBars({ rows }: { rows: MasteryRow[] }) {
  if (rows.length === 0) {
    return <p className={styles.empty}>No concepts tracked yet — generate some study material.</p>;
  }

  return (
    <div className={styles.list}>
      {rows.map((row) => (
        <div key={row.name} className={styles.row}>
          <span className={styles.name}>{row.name}</span>
          <div className={styles.track}>
            <div
              className={styles.fill}
              style={{ width: `${Math.round(row.score * 100)}%`, background: colorFor(row.score) }}
            />
          </div>
          <span className={styles.value}>{Math.round(row.score * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
