import styles from "./GradientMesh.module.css";

/**
 * Static ambient backdrop — three blurred mesh blobs + grain + vignette.
 * Purely decorative (aria-hidden). The slow 60s+ drift loop from §6 is a
 * Phase 8 addition; this is the static base it will animate on top of.
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
