// Deterministic per-course accent, picked from the app's own qualitative
// palette (--chart-1..5, already tuned to sit against the parchment
// background) so a course's color is stable across reloads without storing
// one.
const ACCENT_COUNT = 5;

export function courseAccent(courseId: string): string {
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash * 31 + courseId.charCodeAt(i)) | 0;
  }
  const index = (Math.abs(hash) % ACCENT_COUNT) + 1;
  return `var(--chart-${index})`;
}
