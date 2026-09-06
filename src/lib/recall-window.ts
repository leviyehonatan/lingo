/**
 * How long a learner gets to produce an answer.
 *
 * The method is specific: a review gets five to ten seconds, and the ceiling is
 * the point rather than a convenience. Recall that arrives instantly says the
 * interval was too short; recall that takes a minute is not recall, it is
 * working it out. Pimsleur builds the same idea into its recordings as a pause
 * you cannot extend.
 */

export const RECALL_WINDOW_MS = 10_000;

/** Below this, a countdown is noise rather than information. */
const SHOW_FROM_MS = 6_000;

export interface WindowState {
  /** Milliseconds left, never negative. */
  remainingMs: number;
  /** Whether the learner has run out of time. */
  expired: boolean;
  /** Whether it is worth drawing, so the bar appears as time gets short. */
  visible: boolean;
  /** 0 to 1, for a progress bar. */
  fraction: number;
}

export function windowState(
  startedAt: number | null,
  now: number,
  windowMs = RECALL_WINDOW_MS
): WindowState {
  if (startedAt === null) {
    return { remainingMs: windowMs, expired: false, visible: false, fraction: 1 };
  }
  const remainingMs = Math.max(0, startedAt + windowMs - now);
  return {
    remainingMs,
    expired: remainingMs === 0,
    visible: remainingMs <= SHOW_FROM_MS,
    fraction: windowMs === 0 ? 0 : remainingMs / windowMs,
  };
}

/** Whole seconds left, for telling the learner. */
export function secondsLeft(state: WindowState): number {
  return Math.ceil(state.remainingMs / 1000);
}
