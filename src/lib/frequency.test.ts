import { describe, expect, it } from 'vitest';
import { byFrequency, rankOf } from './frequency';

describe('rankOf', () => {
  it('ranks a word the list covers', () => {
    // `nem` is the second most common word in Hungarian subtitles.
    expect(rankOf('a1-g-2')).toBe(2);
  });

  it('puts an unknown word last rather than first', () => {
    expect(rankOf('not-a-word')).toBe(Number.POSITIVE_INFINITY);
  });

  it('rates a phrase by its rarest word', () => {
    // `jó napot`: `jó` is far more common than `napot`, and the phrase is only
    // as common as the harder half.
    expect(rankOf('a1-g-5')).toBeGreaterThan(rankOf('a1-g-1'));
  });
});

describe('byFrequency', () => {
  it('orders the common word first', () => {
    expect(byFrequency(['a1-g-6', 'a1-g-2'])).toEqual(['a1-g-2', 'a1-g-6']);
  });

  it('leaves unranked words in their curated order, at the end', () => {
    expect(byFrequency(['x', 'y', 'a1-g-2'])).toEqual(['a1-g-2', 'x', 'y']);
  });

  it('does not mutate its input', () => {
    const ids = ['a1-g-6', 'a1-g-2'];
    byFrequency(ids);
    expect(ids).toEqual(['a1-g-6', 'a1-g-2']);
  });
});
