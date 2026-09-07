import { describe, expect, it } from 'vitest';
import { computeNextReview, dayKey, difficultyFactor, isDue, isWordStatus, nextStreak, reviewInterval } from './progress';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = 1_700_000_000_000;

describe('reviewInterval', () => {
  it('starts each status on its first rung', () => {
    expect(reviewInterval('unknown', 1)).toBe(MINUTE);
    expect(reviewInterval('known', 1)).toBe(DAY);
  });

  it('climbs the ladder as the review count grows', () => {
    expect(reviewInterval('known', 2)).toBe(3 * DAY);
    expect(reviewInterval('known', 3)).toBe(7 * DAY);
  });

  it('never decreases as the review count grows', () => {
    for (const status of ['known', 'unknown'] as const) {
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

});

describe('computeNextReview', () => {
  it('returns an absolute timestamp relative to now', () => {
    expect(computeNextReview('known', 1, NOW)).toBe(NOW + DAY);
    expect(computeNextReview('unknown', 1, NOW)).toBe(NOW + MINUTE);
  });

  it('is always in the future', () => {
    for (const status of ['known', 'unknown'] as const) {
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
    // The middle grade is gone (D20); a stale client sending it is rejected.
    expect(isWordStatus('learning')).toBe(false);
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

describe('nextStreak', () => {
  it('extends a run of recalls', () => {
    expect(nextStreak(0, 'known')).toBe(1);
    expect(nextStreak(3, 'known')).toBe(4);
  });

  it('ends the run on a miss, whatever the history', () => {
    expect(nextStreak(9, 'unknown')).toBe(0);
    expect(nextStreak(0, 'unknown')).toBe(0);
  });

  it('ignores a nonsensical stored streak', () => {
    expect(nextStreak(-4, 'known')).toBe(1);
    expect(nextStreak(2.7, 'known')).toBe(3);
  });
});

describe('a forgotten word starts its climb again', () => {
  it('does not jump back to a long interval after a miss', () => {
    // Eight successful reviews, then forgotten, then recalled once.
    const afterMiss = nextStreak(8, 'unknown');
    const afterRecall = nextStreak(afterMiss, 'known');

    expect(reviewInterval('known', afterRecall)).toBe(DAY);
    // Which is where it would have been on its very first recall.
    expect(reviewInterval('known', 1)).toBe(DAY);
  });
});

describe('difficultyFactor', () => {
  it('leaves a word with no history alone', () => {
    expect(difficultyFactor('known')).toBe(1);
    expect(difficultyFactor('known', { lapses: 0, latencyMs: 9000 })).toBe(1);
  });

  it('shortens the wait for a word that keeps being forgotten', () => {
    expect(difficultyFactor('known', { lapses: 1 })).toBeCloseTo(0.75);
    expect(difficultyFactor('known', { lapses: 2 })).toBeCloseTo(0.5625);
  });

  it('stops shortening, so a hard word does not collapse to nothing', () => {
    expect(difficultyFactor('known', { lapses: 20 })).toBe(0.4);
  });

  it('stretches the wait when a recall was effortless', () => {
    expect(difficultyFactor('known', { latencyMs: 900 })).toBeCloseTo(1.3);
  });

  it('reads nothing into a quick answer that was not a recall', () => {
    expect(difficultyFactor('unknown', { latencyMs: 900 })).toBe(1);
  });

  it('ignores a missing or nonsensical timing', () => {
    expect(difficultyFactor('known', { latencyMs: null })).toBe(1);
    expect(difficultyFactor('known', { latencyMs: -50 })).toBe(1);
  });

  it('lets a hard word that is suddenly easy pull back up', () => {
    expect(difficultyFactor('known', { lapses: 1, latencyMs: 800 })).toBeCloseTo(0.975);
  });
});

describe('reviewInterval with signals', () => {
  it('brings a repeatedly forgotten word back sooner', () => {
    const plain = reviewInterval('known', 3);
    expect(reviewInterval('known', 3, { lapses: 2 })).toBeLessThan(plain);
  });

  it('pushes an effortless recall further out', () => {
    const plain = reviewInterval('known', 2);
    expect(reviewInterval('known', 2, { latencyMs: 500 })).toBeGreaterThan(plain);
  });

  it('never goes below the ladder it belongs to', () => {
    expect(reviewInterval('known', 1, { lapses: 9 })).toBe(DAY);
  });

  it('never goes beyond the end of the ladder', () => {
    expect(reviewInterval('known', 99, { latencyMs: 100 })).toBe(90 * DAY);
  });
});
