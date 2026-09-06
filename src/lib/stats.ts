/**
 * Turning a log of reviews into the few numbers that say how a learner is
 * doing. Pure: the route fetches, this decides what the fetched rows mean.
 */

import type { WordStatus } from './progress';

export interface ReviewRecord {
  status: WordStatus;
  mode: 'teach' | 'review';
  source: string;
  corrected: boolean;
  latencyMs: number | null;
  reviewedAt: number;
}

export interface WordStanding {
  status: WordStatus;
  seenCount: number;
  lapses: number;
}

export interface LearnerStats {
  /** Words met at least once. */
  met: number;
  known: number;
  learning: number;
  /** Words met, then forgotten: the ones that are not sticking. */
  shaky: number;
  /** Answers given in the window, excluding introductions and corrections. */
  reviews: number;
  /**
   * Share of those answers that were recalled, 0 to 1, or null when there is
   * nothing to divide by. The method aims for 0.9 to 0.95: much lower means
   * the intervals are too long, much higher means they are too short.
   */
  accuracy: number | null;
  /** Typical time to answer, in milliseconds. Median, not mean: one walk-away
   * should not move it. */
  medianLatencyMs: number | null;
  /** Days in the window on which anything at all was reviewed. */
  activeDays: number;
}

const DAY = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

/**
 * `windowDays` bounds what counts as recent, so a learner's numbers reflect how
 * they are doing now rather than averaging in the week they started.
 */
export function summarize(
  standings: readonly WordStanding[],
  events: readonly ReviewRecord[],
  now: number,
  windowDays = 30
): LearnerStats {
  const since = now - windowDays * DAY;
  // Introductions are not tests, and a correction re-grades an answer already
  // counted, so neither belongs in an accuracy figure.
  const recent = events.filter(
    (event) => event.reviewedAt >= since && event.mode === 'review' && !event.corrected
  );

  const recalled = recent.filter((event) => event.status === 'known').length;
  const latencies = recent
    .map((event) => event.latencyMs)
    .filter((value): value is number => value !== null);

  const days = new Set(
    events
      .filter((event) => event.reviewedAt >= since)
      .map((event) => new Date(event.reviewedAt).toISOString().slice(0, 10))
  );

  return {
    met: standings.length,
    known: standings.filter((word) => word.status === 'known').length,
    learning: standings.filter((word) => word.status === 'learning').length,
    shaky: standings.filter((word) => word.lapses > 0).length,
    reviews: recent.length,
    accuracy: recent.length === 0 ? null : recalled / recent.length,
    medianLatencyMs: median(latencies),
    activeDays: days.size,
  };
}
