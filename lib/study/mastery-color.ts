import { interpolateRgb } from "d3-interpolate";

// Resolved hex twins of --destructive / --gilt / --chart-2 (globals.css) —
// SVG/canvas contexts (react-flow's minimap, d3 interpolation) can't
// resolve CSS custom properties, so the raw values are duplicated here.
export const MASTERY_STOPS = {
  low: "#7b3232",
  mid: "#a07c3e",
  high: "#4b6a4e",
} as const;

export const RISK_STOPS = {
  high: "#7b3232",
  moderate: "#a07c3e",
  low: "#4b6a4e",
} as const;

const { low: LOW, mid: MID, high: HIGH } = MASTERY_STOPS;

/** Smooth continuous mastery → color, for graph nodes/minimap. */
export function masteryColor(mastery: number): string {
  if (mastery < 0.5) return interpolateRgb(LOW, MID)(mastery / 0.5);
  return interpolateRgb(MID, HIGH)((mastery - 0.5) / 0.5);
}

/** Risk-based color calculation: priority score >= 2.5 is high risk, 1.0-2.4 is moderate, < 1.0 is low */
export function riskColor(riskScore: number): string {
  if (riskScore >= 2.5) return RISK_STOPS.high;
  if (riskScore >= 1.0) return RISK_STOPS.moderate;
  return RISK_STOPS.low;
}
