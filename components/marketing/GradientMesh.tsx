import styles from "./GradientMesh.module.css";

/**
 * Ambient backdrop, used on every page: flat parchment, a faint top
 * vignette, and paper grain — no blurred color blobs. Named GradientMesh
 * for historical reasons (it predates the "nostalgia" redesign); it's the
 * one shared background layer app-wide now.
 */
export function GradientMesh() {
  return (
    <div className={styles.mesh} aria-hidden="true">
      <div className={`${styles.grainLayer} grain`} />
      <div className={styles.vignette} />
    </div>
  );
}
