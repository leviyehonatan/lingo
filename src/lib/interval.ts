/**
 * Turning a scheduling delay into something a learner can read.
 *
 * The study session tells the learner when a word will come back, because a
 * schedule nobody can see is a schedule nobody trusts. This picks the unit; the
 * wording lives in `src/i18n`.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export type DelayUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface HumanDelay {
  value: number;
  unit: DelayUnit;
}

/**
 * The coarsest unit that still describes the delay honestly, so a week reads as
 * a week rather than as seven days. Anything under a minute rounds up to one,
 * because "in 0 minutes" says nothing.
 */
export function humanizeInterval(ms: number): HumanDelay {
  const delay = Math.max(0, ms);
  if (delay < HOUR) return { value: Math.max(1, Math.round(delay / MINUTE)), unit: 'minute' };
  if (delay < DAY) return { value: Math.round(delay / HOUR), unit: 'hour' };
  if (delay < WEEK) return { value: Math.round(delay / DAY), unit: 'day' };
  if (delay < MONTH) return { value: Math.round(delay / WEEK), unit: 'week' };
  return { value: Math.round(delay / MONTH), unit: 'month' };
}

/** The same thing for an absolute timestamp the server sent back. */
export function humanizeUntil(nextReview: number, now: number): HumanDelay {
  return humanizeInterval(nextReview - now);
}
