import styles from "./GradientMesh.module.css";

/**
 * Ambient backdrop — three blurred mesh blobs (each drifting on its own
 * slow CSS loop, §6) + grain + vignette. Purely decorative (aria-hidden).
 * Plain CSS rather than GSAP since it's a simple infinite loop needed on
 * every page, not just the scroll-driven landing sequence.
 */
export function GradientMesh() {
  return (
    <div className={styles.mesh} aria-hidden="true">
      <div className={styles.blobGreen} />
      <div className={styles.blobPurple} />
      <div className={styles.blobAmber} />
      <div className={`${styles.grainLayer} grain`} />
      <div className={styles.vignette} />
    </div>
  );
}
