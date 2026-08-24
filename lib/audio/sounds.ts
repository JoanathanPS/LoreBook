"use client";

// Ultra-subtle UI sounds (PLAN.md §6) — synthesized via Web Audio API rather
// than shipped as audio files, so there's nothing to license or download.
// Muted by default; toggled via useSoundMuted / SoundToggle.

const MUTE_KEY = "lorebook:sound-muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MUTE_KEY) !== "false"; // muted by default
}

export function setSoundMuted(muted: boolean): void {
  localStorage.setItem(MUTE_KEY, String(muted));
  window.dispatchEvent(new CustomEvent("lorebook:sound-muted-changed", { detail: muted }));
}

function tone(
  freq: number,
  duration: number,
  opts: { type?: OscillatorType; gain?: number; delay?: number } = {},
): void {
  const audioCtx = getCtx();
  if (!audioCtx || isSoundMuted()) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const now = audioCtx.currentTime + (opts.delay ?? 0);
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(opts.gain ?? 0.06, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gainNode).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playFlip(): void {
  tone(520, 0.08, { type: "sine", gain: 0.05 });
}

export function playCorrect(): void {
  tone(660, 0.1, { gain: 0.06 });
  tone(880, 0.12, { gain: 0.06, delay: 0.08 });
}

export function playIncorrect(): void {
  tone(220, 0.18, { type: "triangle", gain: 0.05 });
}

export function playSwipe(): void {
  const audioCtx = getCtx();
  if (!audioCtx || isSoundMuted()) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
  gainNode.gain.setValueAtTime(0.04, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  osc.connect(gainNode).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.17);
}
