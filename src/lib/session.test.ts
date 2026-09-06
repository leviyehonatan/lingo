import { describe, expect, it } from 'vitest';
import {
  advance,
  attachSchedule,
  correctAnswer,
  currentCard,
  endSession,
  lastAnswer,
  recordAnswer,
  revealAnswer,
  sessionProgress,
  startSession,
  summarize,
  type SessionCard,
} from './session';

const cards: SessionCard[] = [
  { id: 'a', prompt: 'igen', answer: 'כן' },
  { id: 'b', prompt: 'nem', answer: 'לא' },
];

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('startSession', () => {
  it('asks the first card', () => {
    const state = startSession(cards);
    expect(state.stage).toBe('prompt');
    expect(currentCard(state)).toEqual(cards[0]);
    expect(sessionProgress(state)).toEqual({ position: 1, total: 2, answered: 0 });
  });

  it('is already finished when there is nothing to study', () => {
    const state = startSession([]);
    expect(state.stage).toBe('done');
    expect(currentCard(state)).toBeUndefined();
    expect(sessionProgress(state)).toEqual({ position: 0, total: 0, answered: 0 });
  });
});

describe('one card, start to finish', () => {
  it('walks prompt, reveal, feedback, next', () => {
    let state = startSession(cards);
    state = revealAnswer(state);
    expect(state.stage).toBe('reveal');

    state = recordAnswer(state, 'known', NOW + DAY, NOW);
    expect(state.stage).toBe('feedback');
    expect(lastAnswer(state)).toEqual({
      cardId: 'a',
      status: 'known',
      nextReview: NOW + DAY,
      answeredAt: NOW,
      corrected: false,
    });

    state = advance(state);
    expect(state.stage).toBe('prompt');
    expect(currentCard(state)).toEqual(cards[1]);
    expect(sessionProgress(state)).toEqual({ position: 2, total: 2, answered: 1 });
  });

  it('finishes after the last card', () => {
    let state = startSession([cards[0]]);
    state = advance(recordAnswer(revealAnswer(state), 'known', NOW + DAY, NOW));
    expect(state.stage).toBe('done');
    expect(currentCard(state)).toBeUndefined();
  });
});

describe('guards', () => {
  it('does not reveal outside the question', () => {
    const state = recordAnswer(revealAnswer(startSession(cards)), 'known', null, NOW);
    expect(revealAnswer(state)).toBe(state);
  });

  it('grades a card only once before moving on', () => {
    const graded = recordAnswer(revealAnswer(startSession(cards)), 'known', null, NOW);
    expect(recordAnswer(graded, 'unknown', null, NOW)).toBe(graded);
    expect(graded.answers).toHaveLength(1);
  });

  it('grades straight from the question, for a learner who did not need the answer', () => {
    const state = recordAnswer(startSession(cards), 'known', NOW + DAY, NOW);
    expect(state.stage).toBe('feedback');
    expect(state.answers).toHaveLength(1);
  });

  it('ignores an override when no verdict is on screen', () => {
    const state = startSession(cards);
    expect(correctAnswer(state, 'known', NOW, NOW)).toBe(state);
  });

  it('advancing a finished session changes nothing', () => {
    const done = startSession([]);
    expect(advance(done)).toBe(done);
  });
});

describe('correctAnswer', () => {
  it('replaces the verdict without adding a second answer', () => {
    let state = recordAnswer(revealAnswer(startSession(cards)), 'unknown', NOW + 60_000, NOW);
    state = correctAnswer(state, 'known', NOW + DAY, NOW);

    expect(state.answers).toHaveLength(1);
    expect(lastAnswer(state)).toEqual({
      cardId: 'a',
      status: 'known',
      nextReview: NOW + DAY,
      answeredAt: NOW,
      corrected: true,
    });
  });
});

describe('summarize', () => {
  it('counts each card once, under its final grade', () => {
    let state = startSession(cards);
    state = advance(recordAnswer(revealAnswer(state), 'unknown', NOW + 60_000, NOW));
    state = recordAnswer(revealAnswer(state), 'unknown', NOW + 60_000, NOW);
    state = correctAnswer(state, 'known', NOW + DAY, NOW);

    expect(summarize(state)).toEqual({
      total: 2,
      known: 1,
      learning: 0,
      unknown: 1,
      corrected: 1,
      soonestDelay: 60_000,
    });
  });

  it('reports nothing for a session that graded nothing', () => {
    expect(summarize(startSession(cards))).toEqual({
      total: 0,
      known: 0,
      learning: 0,
      unknown: 0,
      corrected: 0,
      soonestDelay: null,
    });
  });

  it('survives a failed write, which has no next review', () => {
    const state = recordAnswer(revealAnswer(startSession(cards)), 'known', null, NOW);
    expect(summarize(state).soonestDelay).toBeNull();
  });
});

describe('endSession', () => {
  it('keeps what was answered before stopping early', () => {
    let state = advance(recordAnswer(revealAnswer(startSession(cards)), 'known', NOW + DAY, NOW));
    state = endSession(state);
    expect(state.stage).toBe('done');
    expect(summarize(state).total).toBe(1);
  });
});

describe('attachSchedule', () => {
  it('fills in the delay without calling it a correction', () => {
    let state = recordAnswer(revealAnswer(startSession(cards)), 'known', null, NOW);
    state = attachSchedule(state, 'a', NOW + DAY);

    expect(lastAnswer(state)).toEqual({
      cardId: 'a',
      status: 'known',
      nextReview: NOW + DAY,
      answeredAt: NOW,
      corrected: false,
    });
    expect(summarize(state).corrected).toBe(0);
    expect(summarize(state).soonestDelay).toBe(DAY);
  });

  it('ignores a schedule that arrives for an earlier card', () => {
    const state = recordAnswer(revealAnswer(startSession(cards)), 'known', null, NOW);
    expect(attachSchedule(state, 'b', NOW + DAY)).toBe(state);
  });

  it('keeps a correction marked as one', () => {
    let state = recordAnswer(revealAnswer(startSession(cards)), 'unknown', null, NOW);
    state = correctAnswer(state, 'known', null, NOW);
    state = attachSchedule(state, 'a', NOW + DAY);
    expect(lastAnswer(state)?.corrected).toBe(true);
  });
});
