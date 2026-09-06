/**
 * Pure spaced-repetition logic. No I/O, no Prisma, no Next.
 *
 * The server is the only place that decides when a word is next due: the
 * client sends a status, the server answers with `nextReview`.
 */

export type WordStatus = 'known' | 'unknown' | 'learning';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Interval ladder in milliseconds, indexed by the current run of successes.
 *
 * Position comes from the streak, not from a lifetime count of reviews, so a
 * word that has been answered many times and then forgotten starts its climb
 * again rather than jumping back to a long interval it no longer deserves. That
 * is what every working scheduler does: Babbel sends a missed item back to the
 * next day whatever its history.
 */
const LADDERS: Record<WordStatus, readonly number[]> = {
  // Wrong or not yet learned: come back within the same session.
  unknown: [MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE],
  // Partly known: hours, then a day or two.
  learning: [10 * MINUTE, HOUR, 6 * HOUR, DAY, 2 * DAY],
  // Known: the classic expanding schedule.
  known: [DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY],
};

export const VALID_STATUSES: readonly WordStatus[] = ['known', 'unknown', 'learning'];

export function isWordStatus(value: unknown): value is WordStatus {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

/**
 * How long to wait before showing this word again.
 *
 * `streak` is the run of successes *including* the answer being recorded, so a
 * word recalled for the first time has a streak of 1 and lands on rung 0.
 * Streaks below 1 clamp to the first rung, streaks past the end repeat the last.
 */
export function reviewInterval(status: WordStatus, streak: number): number {
  const ladder = LADDERS[status];
  const rung = Math.min(Math.max(Math.floor(streak) - 1, 0), ladder.length - 1);
  return ladder[rung];
}

/**
 * The streak after an answer.
 *
 * A recall extends the run. A miss ends it, which is what sends the word back
 * to the bottom of its ladder. A half-recall holds position: the learner did
 * not fail, but they did not earn a longer wait either.
 */
export function nextStreak(previous: number, status: WordStatus): number {
  const held = Math.max(0, Math.floor(previous));
  if (status === 'known') return held + 1;
  if (status === 'unknown') return 0;
  return Math.max(held, 1);
}

/**
 * Absolute epoch-millisecond timestamp at which the word becomes due again.
 */
export function computeNextReview(
  status: WordStatus,
  streak: number,
  now: number
): number {
  return now + reviewInterval(status, streak);
}

/** A word with no recorded review at all is due; otherwise compare the clock. */
export function isDue(nextReview: number | undefined, now: number): boolean {
  return nextReview === undefined || nextReview <= now;
}

/** `YYYY-MM-DD` in UTC, the key used by the DailyRecord table. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
