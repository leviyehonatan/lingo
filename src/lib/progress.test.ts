import { describe, expect, it } from 'vitest';
import {
  computeNextReview,
  dayKey,
  isDue,
  isWordStatus,
  reviewInterval,
} from './progress';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = 1_700_000_000_000;

describe('reviewInterval', () => {
  it('starts each status on its first rung', () => {
    expect(reviewInterval('unknown', 1)).toBe(MINUTE);
    expect(reviewInterval('learning', 1)).toBe(10 * MINUTE);
    expect(reviewInterval('known', 1)).toBe(DAY);
  });

  it('climbs the ladder as the review count grows', () => {
    expect(reviewInterval('known', 2)).toBe(3 * DAY);
    expect(reviewInterval('known', 3)).toBe(7 * DAY);
    expect(reviewInterval('learning', 2)).toBe(HOUR);
    expect(reviewInterval('learning', 3)).toBe(6 * HOUR);
  });

  it('never decreases as the review count grows', () => {
    for (const status of ['known', 'unknown', 'learning'] as const) {
      let previous = 0;
      for (let count = 1; count <= 12; count++) {
        const interval = reviewInterval(status, count);
        expect(interval).toBeGreaterThanOrEqual(previous);
        previous = interval;
      }
    }
  });

  it('repeats the last rung once the ladder runs out', () => {
    expect(reviewInterval('known', 6)).toBe(90 * DAY);
    expect(reviewInterval('known', 99)).toBe(90 * DAY);
    expect(reviewInterval('unknown', 50)).toBe(10 * MINUTE);
  });

  it('clamps counts below one to the first rung', () => {
    expect(reviewInterval('known', 0)).toBe(DAY);
    expect(reviewInterval('known', -5)).toBe(DAY);
  });

  it('schedules a known word further out than a learning or unknown one', () => {
    expect(reviewInterval('known', 1)).toBeGreaterThan(reviewInterval('learning', 1));
    expect(reviewInterval('learning', 1)).toBeGreaterThan(reviewInterval('unknown', 1));
  });
});

describe('computeNextReview', () => {
  it('returns an absolute timestamp relative to now', () => {
    expect(computeNextReview('known', 1, NOW)).toBe(NOW + DAY);
    expect(computeNextReview('unknown', 1, NOW)).toBe(NOW + MINUTE);
  });

  it('is always in the future', () => {
    for (const status of ['known', 'unknown', 'learning'] as const) {
      expect(computeNextReview(status, 1, NOW)).toBeGreaterThan(NOW);
    }
  });
});

describe('isDue', () => {
  it('treats a word with no recorded review as due', () => {
    expect(isDue(undefined, NOW)).toBe(true);
  });

  it('is due once the timestamp has passed, including exactly now', () => {
    expect(isDue(NOW - 1, NOW)).toBe(true);
    expect(isDue(NOW, NOW)).toBe(true);
  });

  it('is not due while the timestamp is still ahead', () => {
    expect(isDue(NOW + 1, NOW)).toBe(false);
  });
});

describe('isWordStatus', () => {
  it('accepts the three known statuses', () => {
    expect(isWordStatus('known')).toBe(true);
    expect(isWordStatus('learning')).toBe(true);
    expect(isWordStatus('unknown')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isWordStatus('mastered')).toBe(false);
    expect(isWordStatus('')).toBe(false);
    expect(isWordStatus(null)).toBe(false);
    expect(isWordStatus(3)).toBe(false);
  });
});

describe('dayKey', () => {
  it('formats a UTC calendar day', () => {
    expect(dayKey(Date.UTC(2026, 8, 6, 13, 45))).toBe('2026-09-06');
  });

  it('is stable across a whole UTC day', () => {
    expect(dayKey(Date.UTC(2026, 8, 6, 0, 0, 0))).toBe(
      dayKey(Date.UTC(2026, 8, 6, 23, 59, 59))
    );
  });
});
