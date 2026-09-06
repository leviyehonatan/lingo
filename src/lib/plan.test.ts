import { describe, expect, it } from 'vitest';
import { modeFor, planSession } from './plan';
import type { ProgressByWord } from './study';

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

const ids = ['a', 'b', 'c', 'd', 'e'];

const byWord: ProgressByWord = {
  a: { status: 'known', nextReview: NOW - 5 * MINUTE },
  b: { status: 'learning', nextReview: NOW - 60 * MINUTE },
  c: { status: 'known', nextReview: NOW + 60 * MINUTE },
  // 'd' and 'e' have never been met.
};

const plan = (over: Partial<Parameters<typeof planSession>[0]> = {}) =>
  planSession({ wordIds: ids, byWord, now: NOW, newLimit: 5, size: 20, ...over });

describe('planSession', () => {
  it('puts due reviews first, most overdue first', () => {
    expect(plan().cards.slice(0, 2)).toEqual([
      { id: 'b', mode: 'review' },
      { id: 'a', mode: 'review' },
    ]);
  });

  it('teaches words that have never been met', () => {
    expect(plan().cards.slice(2)).toEqual([
      { id: 'd', mode: 'teach' },
      { id: 'e', mode: 'teach' },
    ]);
  });

  it('leaves out words that are not due yet', () => {
    expect(plan().cards.map((c) => c.id)).not.toContain('c');
  });

  it('counts what it found, including what it left out', () => {
    const { due, fresh, waiting } = plan();
    expect({ due, fresh, waiting }).toEqual({ due: 2, fresh: 2, waiting: 1 });
  });

  it('caps the new words a sitting introduces', () => {
    expect(plan({ newLimit: 1 }).cards.filter((c) => c.mode === 'teach')).toEqual([
      { id: 'd', mode: 'teach' },
    ]);
  });

  it('caps the sitting as a whole, keeping reviews', () => {
    const cards = plan({ size: 2 }).cards;
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.mode === 'review')).toBe(true);
  });

  it('introduces nothing when the reviews already fill the sitting', () => {
    expect(plan({ size: 2, newLimit: 5 }).cards.some((c) => c.mode === 'teach')).toBe(false);
  });

  it('is empty when everything met is scheduled ahead and nothing is new', () => {
    const scheduled: ProgressByWord = {
      a: { status: 'known', nextReview: NOW + MINUTE },
      b: { status: 'known', nextReview: NOW + MINUTE },
    };
    const result = planSession({
      wordIds: ['a', 'b'],
      byWord: scheduled,
      now: NOW,
      newLimit: 5,
      size: 20,
    });
    expect(result.cards).toEqual([]);
    expect(result.waiting).toBe(2);
  });

  it('teaches everything on a first ever session', () => {
    const result = planSession({
      wordIds: ids,
      byWord: {},
      now: NOW,
      newLimit: 3,
      size: 20,
    });
    expect(result.cards).toEqual([
      { id: 'a', mode: 'teach' },
      { id: 'b', mode: 'teach' },
      { id: 'c', mode: 'teach' },
    ]);
    expect(result.due).toBe(0);
    expect(result.fresh).toBe(5);
  });
});

describe('modeFor', () => {
  it('teaches an unmet word however it was chosen', () => {
    expect(modeFor(byWord, 'd')).toBe('teach');
  });

  it('reviews a word that has been met, even if it was forgotten', () => {
    expect(modeFor(byWord, 'b')).toBe('review');
  });
});

describe('words that look alike are not met together', () => {
  const numbers = ['one', 'two', 'three', 'four'];
  // "one" and "two" clash; nothing else does.
  const confusable = (a: string, b: string) =>
    [a, b].every((id) => id === 'one' || id === 'two');

  const meetAll = (over: Partial<Parameters<typeof planSession>[0]> = {}) =>
    planSession({
      wordIds: numbers,
      byWord: {},
      now: NOW,
      newLimit: 4,
      size: 20,
      confusable,
      ...over,
    });

  it('skips a new word that clashes with one already chosen', () => {
    expect(meetAll().cards.map((card) => card.id)).toEqual(['one', 'three', 'four']);
  });

  it('still fills the sitting from words that do not clash', () => {
    expect(meetAll({ newLimit: 2 }).cards.map((card) => card.id)).toEqual([
      'one',
      'three',
    ]);
  });

  it('meets one anyway rather than teaching nothing at all', () => {
    const everythingClashes = () => true;
    const plan = planSession({
      wordIds: numbers,
      byWord: {},
      now: NOW,
      newLimit: 3,
      size: 20,
      confusable: everythingClashes,
    });
    expect(plan.cards.map((card) => card.id)).toEqual(['one']);
  });

  it('leaves the plan alone when nothing is said about confusability', () => {
    const plan = planSession({
      wordIds: numbers,
      byWord: {},
      now: NOW,
      newLimit: 4,
      size: 20,
    });
    expect(plan.cards).toHaveLength(4);
  });

  it('never holds back a review, however alike two due words are', () => {
    const due: ProgressByWord = {
      one: { status: 'known', nextReview: NOW - 1000 },
      two: { status: 'known', nextReview: NOW - 1000 },
    };
    const plan = planSession({
      wordIds: ['one', 'two'],
      byWord: due,
      now: NOW,
      newLimit: 5,
      size: 20,
      confusable,
    });
    expect(plan.cards).toHaveLength(2);
  });
});
