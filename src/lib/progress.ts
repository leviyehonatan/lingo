/**
 * Pure spaced-repetition logic. No I/O, no Prisma, no Next.
 *
 * The server is the only place that decides when a word is next due: the
 * client sends a status, the server answers with `nextReview`.
 */

/**
 * Two grades, not three. The method wants pass or fail, and the middle grade
 * we had ("almost knew it") was a way of not deciding: it neither reset the
 * run nor extended it. See D20 in docs/learning/decisions.md.
 */
export type WordStatus = 'known' | 'unknown';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

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
  // Known: the classic expanding schedule.
  known: [DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY],
};

export const VALID_STATUSES: readonly WordStatus[] = ['known', 'unknown'];

/**
 * Rows written before D20 may still say `learning`. Read them as not known:
 * the word was, by the learner's own account, not recalled.
 */
export function readStatus(stored: string): WordStatus {
  return stored === 'known' ? 'known' : 'unknown';
}

export function isWordStatus(value: unknown): value is WordStatus {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

/**
 * What the log knows about a word beyond the grade just given.
 *
 * The ladder is the same for every word and every learner, which is the last
 * thing the schedule cannot adapt. These two signals are the ones the method
 * names: a word that keeps being forgotten is harder than its rung says, and an
 * answer that arrives instantly says the wait was too short.
 */
export interface ReviewSignals {
  /** Times this word has been forgotten after being known. */
  lapses?: number;
  /** How long the answer took, when it was measured. */
  latencyMs?: number | null;
}

/** Each lapse shortens the wait by this much, compounding. */
const LAPSE_PENALTY = 0.75;

/** However often a word has been forgotten, it keeps this share of its wait. */
const MIN_LAPSE_FACTOR = 0.4;

/**
 * An answer this quick was not recalled so much as still in mind, which the
 * method reads as the interval having been too short.
 */
const EFFORTLESS_MS = 2_500;

/** How much an effortless recall stretches the wait. */
const EFFORTLESS_BONUS = 1.3;

/**
 * How the signals change a wait. Separated from the ladder so the adjustment
 * can be reasoned about, and tested, on its own.
 */
export function difficultyFactor(status: WordStatus, signals: ReviewSignals = {}): number {
  const lapses = Math.max(0, Math.floor(signals.lapses ?? 0));
  const penalty = Math.max(MIN_LAPSE_FACTOR, LAPSE_PENALTY ** lapses);
  const latency = signals.latencyMs;
  // Only a recall can be effortless. Answering "I did not know it" quickly says
  // nothing about the interval.
  const effortless =
    status === 'known' && typeof latency === 'number' && latency >= 0 && latency < EFFORTLESS_MS;
  return penalty * (effortless ? EFFORTLESS_BONUS : 1);
}

/**
 * How long to wait before showing this word again.
 *
 * `streak` is the run of successes *including* the answer being recorded, so a
 * word recalled for the first time has a streak of 1 and lands on rung 0.
 * Streaks below 1 clamp to the first rung, streaks past the end repeat the last.
 */
export function reviewInterval(
  status: WordStatus,
  streak: number,
  signals: ReviewSignals = {}
): number {
  const ladder = LADDERS[status];
  const rung = Math.min(Math.max(Math.floor(streak) - 1, 0), ladder.length - 1);
  const adjusted = Math.round(ladder[rung] * difficultyFactor(status, signals));
  // Never shorter than the ladder's first rung, and never past its last: the
  // signals nudge the schedule, they do not replace it.
  return Math.min(Math.max(adjusted, ladder[0]), ladder[ladder.length - 1]);
}

/**
 * The streak after an answer.
 *
 * A recall extends the run. A miss ends it, which is what sends the word back
 * to the bottom of its ladder.
 */
export function nextStreak(previous: number, status: WordStatus): number {
  const held = Math.max(0, Math.floor(previous));
  return status === 'known' ? held + 1 : 0;
}

/**
 * Absolute epoch-millisecond timestamp at which the word becomes due again.
 */
export function computeNextReview(
  status: WordStatus,
  streak: number,
  now: number,
  signals: ReviewSignals = {}
): number {
  return now + reviewInterval(status, streak, signals);
}

/** A word with no recorded review at all is due; otherwise compare the clock. */
export function isDue(nextReview: number | undefined, now: number): boolean {
  return nextReview === undefined || nextReview <= now;
}

/** `YYYY-MM-DD` in UTC, the key used by the DailyRecord table. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
