import styles from "./ProgressBar.module.css";

/** Thin determinate bar; `value` is 0–100. Indeterminate while `value` is null. */
export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  const clamped = value === null ? null : Math.max(0, Math.min(100, value));
  return (
    <span
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped ?? undefined}
      data-indeterminate={clamped === null}
    >
      <span className={styles.fill} style={clamped === null ? undefined : { width: `${clamped}%` }} />
    </span>
  );
}
