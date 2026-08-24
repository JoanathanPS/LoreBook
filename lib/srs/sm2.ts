export type Grade = "again" | "hard" | "good" | "easy";

// Classic SM-2 quality scale (0-5), collapsed to 4 review buttons.
const QUALITY: Record<Grade, number> = { again: 0, hard: 3, good: 4, easy: 5 };

export interface CardState {
  ease: number;
  intervalDays: number;
  repetitions: number;
}

export interface ScheduleResult extends CardState {
  dueAt: Date;
}

/** Standard SM-2: given a card's current state and a review grade, returns its next state. */
export function schedule(state: CardState, grade: Grade): ScheduleResult {
  const q = QUALITY[grade];

  let { ease, repetitions } = state;
  let intervalDays: number;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(state.intervalDays * ease);
    repetitions += 1;
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const dueAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

  return { ease, intervalDays, repetitions, dueAt };
}
