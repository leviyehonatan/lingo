import { describe, expect, it } from 'vitest';
import { summarize, type ReviewRecord, type WordStanding } from './stats';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const standings: WordStanding[] = [
  { status: 'known', seenCount: 4, lapses: 0 },
  { status: 'known', seenCount: 6, lapses: 2 },
  { status: 'unknown', seenCount: 2, lapses: 0 },
  { status: 'unknown', seenCount: 1, lapses: 0 },
];

function review(over: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    status: 'known',
    mode: 'review',
    source: 'speech',
    corrected: false,
    latencyMs: 3000,
    reviewedAt: NOW - DAY,
    ...over,
  };
}

describe('summarize', () => {
  it('counts where the words stand', () => {
    const stats = summarize(standings, [], NOW);
    expect(stats).toMatchObject({ met: 4, known: 2, shaky: 1 });
  });

  it('measures accuracy over answers, not over introductions', () => {
    const stats = summarize(standings, [
      review(),
      review({ status: 'unknown' }),
      review({ mode: 'teach', status: 'unknown' }),
    ], NOW);

    expect(stats.reviews).toBe(2);
    expect(stats.accuracy).toBe(0.5);
  });

  it('leaves corrections out of accuracy, since they re-grade a counted answer', () => {
    const stats = summarize(standings, [review(), review({ corrected: true })], NOW);
    expect(stats.reviews).toBe(1);
    expect(stats.accuracy).toBe(1);
  });

  it('ignores answers older than the window', () => {
    const stats = summarize(standings, [review({ reviewedAt: NOW - 40 * DAY })], NOW);
    expect(stats.reviews).toBe(0);
    expect(stats.accuracy).toBeNull();
  });

  it('takes the median time, so one walk-away does not move it', () => {
    const stats = summarize(standings, [
      review({ latencyMs: 2000 }),
      review({ latencyMs: 3000 }),
      review({ latencyMs: 3_600_000 }),
    ], NOW);
    expect(stats.medianLatencyMs).toBe(3000);
  });

  it('averages the middle pair when there is an even number of times', () => {
    const stats = summarize(standings, [
      review({ latencyMs: 2000 }),
      review({ latencyMs: 5000 }),
    ], NOW);
    expect(stats.medianLatencyMs).toBe(3500);
  });

  it('reports no time at all rather than zero when nothing was measured', () => {
    const stats = summarize(standings, [review({ latencyMs: null })], NOW);
    expect(stats.medianLatencyMs).toBeNull();
  });

  it('counts the days something was studied, introductions included', () => {
    const stats = summarize(standings, [
      review({ reviewedAt: NOW - DAY }),
      review({ reviewedAt: NOW - DAY - 1000 }),
      review({ mode: 'teach', reviewedAt: NOW - 3 * DAY }),
    ], NOW);
    expect(stats.activeDays).toBe(2);
  });

  it('says nothing rather than guessing for a learner who has done nothing', () => {
    expect(summarize([], [], NOW)).toEqual({
      met: 0,
      known: 0,
      shaky: 0,
      reviews: 0,
      accuracy: null,
      medianLatencyMs: null,
      activeDays: 0,
    });
  });
});
