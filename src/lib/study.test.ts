import { describe, expect, it } from 'vitest';
import {
  computeStats,
  dueWordIds,
  filterWordIds,
  sameIdSet,
  shuffle,
  type ProgressByWord,
} from './study';

const NOW = 1_700_000_000_000;
const ids = ['a', 'b', 'c', 'd'];

const byWord: ProgressByWord = {
  a: { status: 'known', nextReview: NOW + 1000 },
  b: { status: 'unknown', nextReview: NOW - 1000 },
  c: { status: 'unknown', nextReview: NOW + 1000 },
  // 'd' has never been reviewed.
};

describe('dueWordIds', () => {
  it('includes never-reviewed words and words whose time has come', () => {
    expect([...dueWordIds(ids, byWord, NOW)]).toEqual(['b', 'd']);
  });

  it('returns everything when no progress has been recorded', () => {
    expect([...dueWordIds(ids, {}, NOW)]).toEqual(ids);
  });
});

describe('filterWordIds', () => {
  it('passes everything through for "all"', () => {
    expect(filterWordIds(ids, byWord, 'all', NOW)).toEqual(ids);
  });

  it('selects only due words for "due"', () => {
    expect(filterWordIds(ids, byWord, 'due', NOW)).toEqual(['b', 'd']);
  });

  it('treats a missing progress row as unknown', () => {
    expect(filterWordIds(ids, byWord, 'unknown', NOW)).toEqual(['d']);
  });

  it('matches recorded statuses exactly', () => {
    expect(filterWordIds(ids, byWord, 'known', NOW)).toEqual(['a']);
  });

  it('preserves the original word order', () => {
    expect(filterWordIds(['d', 'b', 'a'], byWord, 'all', NOW)).toEqual(['d', 'b', 'a']);
  });
});

describe('computeStats', () => {
  it('counts a due word as unknown whatever its last status was', () => {
    expect(computeStats(ids, byWord, NOW)).toEqual({ known: 1, unknown: 3 });
  });


  it('counts every word exactly once', () => {
    const { known, unknown } = computeStats(ids, byWord, NOW);
    expect(known + unknown).toBe(ids.length);
  });

  it('reports zeroes for an empty topic', () => {
    expect(computeStats([], byWord, NOW)).toEqual({ known: 0, unknown: 0 });
  });
});

describe('shuffle', () => {
  it('keeps every element and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, () => 0.5);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic given a deterministic random source', () => {
    const seq = () => {
      let i = 0;
      const values = [0.1, 0.9, 0.4, 0.7, 0.2];
      return () => values[i++ % values.length];
    };
    expect(shuffle(['a', 'b', 'c', 'd', 'e'], seq())).toEqual(
      shuffle(['a', 'b', 'c', 'd', 'e'], seq())
    );
  });
});

describe('sameIdSet', () => {
  it('accepts the same array', () => {
    expect(sameIdSet(ids, ids)).toBe(true);
  });

  it('accepts a fresh array with the same ids', () => {
    expect(sameIdSet(ids, [...ids])).toBe(true);
  });

  it('ignores order', () => {
    expect(sameIdSet(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });

  it('rejects a deck that lost a word', () => {
    expect(sameIdSet(ids, ['a', 'b', 'c'])).toBe(false);
  });

  it('rejects a deck that gained a word', () => {
    expect(sameIdSet(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });

  it('rejects a swap that keeps the length', () => {
    expect(sameIdSet(['a', 'b'], ['a', 'z'])).toBe(false);
  });

  it('treats two empty decks as the same', () => {
    expect(sameIdSet([], [])).toBe(true);
  });

  it('compares positionally when a list repeats an id', () => {
    expect(sameIdSet(['a', 'a', 'b'], ['a', 'b', 'b'])).toBe(false);
    expect(sameIdSet(['a', 'a', 'b'], ['a', 'a', 'b'])).toBe(true);
  });
});
