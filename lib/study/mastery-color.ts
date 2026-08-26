import { interpolateRgb } from "d3-interpolate";

// Resolved hex twins of --destructive / --gilt / --chart-2 (globals.css) —
// SVG/canvas contexts (react-flow's minimap, d3 interpolation) can't
// resolve CSS custom properties, so the raw values are duplicated here.
export const MASTERY_STOPS = {
  low: "#a13b2e",
  mid: "#a07c3e",
  high: "#4b6a4e",
} as const;
const { low: LOW, mid: MID, high: HIGH } = MASTERY_STOPS;

/** Smooth continuous mastery → color, for graph nodes/minimap. */
export function masteryColor(mastery: number): string {
  if (mastery < 0.5) return interpolateRgb(LOW, MID)(mastery / 0.5);
  return interpolateRgb(MID, HIGH)((mastery - 0.5) / 0.5);
}
