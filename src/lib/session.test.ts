import { describe, expect, it } from 'vitest';
import {
  advance,
  attachSchedule,
  attemptsFor,
  correctAnswer,
  currentCard,
  endSession,
  lastAnswer,
  MAX_APPEARANCES,
  noteAttempt,
  recordAnswer,
  revealAnswer,
  sessionProgress,
  startSession,
  summarize,
  type SessionCard,
} from './session';

const cards: SessionCard[] = [
  { id: 'a', prompt: 'igen', answer: 'כן', mode: 'review' },
  { id: 'b', prompt: 'nem', answer: 'לא', mode: 'review' },
];

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

/** What the server reports back: when the word returns, and the wait it chose. */
const schedule = (intervalMs: number) => ({
  nextReview: NOW + intervalMs,
  intervalMs,
});

describe('startSession', () => {
  it('asks the first card', () => {
    const state = startSession(cards);
    expect(state.stage).toBe('prompt');
    expect(currentCard(state)).toEqual(cards[0]);
    expect(sessionProgress(state)).toEqual({
      total: 2,
      settled: 0,
      remaining: 2,
      answered: 0,
    });
  });

  it('is already finished when there is nothing to study', () => {
    const state = startSession([]);
    expect(state.stage).toBe('done');
    expect(currentCard(state)).toBeUndefined();
    expect(sessionProgress(state)).toEqual({
      total: 0,
      settled: 0,
      remaining: 0,
      answered: 0,
    });
  });
});

describe('one card, start to finish', () => {
  it('walks prompt, reveal, feedback, next', () => {
    let state = startSession(cards);
    state = revealAnswer(state);
    expect(state.stage).toBe('reveal');

    state = recordAnswer(state, 'known', schedule(DAY), NOW);
    expect(state.stage).toBe('feedback');
    expect(lastAnswer(state)).toEqual({
      cardId: 'a',
      status: 'known',
      nextReview: NOW + DAY,
      intervalMs: DAY,
      answeredAt: NOW,
      corrected: false,
    });

    state = advance(state);
    expect(state.stage).toBe('prompt');
    expect(currentCard(state)).toEqual(cards[1]);
    expect(sessionProgress(state)).toEqual({
      total: 2,
      settled: 1,
      remaining: 1,
      answered: 1,
    });
  });

  it('finishes after the last card', () => {
    let state = startSession([cards[0]]);
    state = advance(recordAnswer(revealAnswer(state), 'known', schedule(DAY), NOW));
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
    const state = recordAnswer(startSession(cards), 'known', schedule(DAY), NOW);
    expect(state.stage).toBe('feedback');
    expect(state.answers).toHaveLength(1);
  });

  it('ignores an override when no verdict is on screen', () => {
    const state = startSession(cards);
    expect(correctAnswer(state, 'known', schedule(0), NOW)).toBe(state);
  });

  it('advancing a finished session changes nothing', () => {
    const done = startSession([]);
    expect(advance(done)).toBe(done);
  });
});

describe('correctAnswer', () => {
  it('replaces the verdict without adding a second answer', () => {
    let state = recordAnswer(revealAnswer(startSession(cards)), 'unknown', schedule(60_000), NOW);
    state = correctAnswer(state, 'known', schedule(DAY), NOW);

    expect(state.answers).toHaveLength(1);
    expect(lastAnswer(state)).toEqual({
      cardId: 'a',
      status: 'known',
      nextReview: NOW + DAY,
      intervalMs: DAY,
      answeredAt: NOW,
      corrected: true,
    });
  });
});

describe('summarize', () => {
  it('counts each card once, under its final grade', () => {
    let state = startSession(cards);
    state = advance(recordAnswer(revealAnswer(state), 'unknown', schedule(60_000), NOW));
    state = recordAnswer(revealAnswer(state), 'unknown', schedule(60_000), NOW);
    state = correctAnswer(state, 'known', schedule(DAY), NOW);

    expect(summarize(state)).toEqual({
      total: 2,
      known: 1,
      unknown: 1,
      taught: 0,
      corrected: 1,
      recalledAloud: 0,
      pronounced: 0,
      soonestDelay: 60_000,
    });
  });

  it('reports nothing for a session that graded nothing', () => {
    expect(summarize(startSession(cards))).toEqual({
      total: 0,
      known: 0,
      unknown: 0,
      taught: 0,
      corrected: 0,
      recalledAloud: 0,
      pronounced: 0,
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
    let state = advance(recordAnswer(revealAnswer(startSession(cards)), 'known', schedule(DAY), NOW));
    state = endSession(state);
    expect(state.stage).toBe('done');
    expect(summarize(state).total).toBe(1);
  });
});

describe('attachSchedule', () => {
  it('fills in the delay without calling it a correction', () => {
    let state = recordAnswer(revealAnswer(startSession(cards)), 'known', null, NOW);
    state = attachSchedule(state, 'a', schedule(DAY));

    expect(lastAnswer(state)).toEqual({
      cardId: 'a',
      status: 'known',
      nextReview: NOW + DAY,
      intervalMs: DAY,
      answeredAt: NOW,
      corrected: false,
    });
    expect(summarize(state).corrected).toBe(0);
    expect(summarize(state).soonestDelay).toBe(DAY);
  });

  it('ignores a schedule that arrives for an earlier card', () => {
    const state = recordAnswer(revealAnswer(startSession(cards)), 'known', null, NOW);
    expect(attachSchedule(state, 'b', schedule(DAY))).toBe(state);
  });

  it('keeps a correction marked as one', () => {
    let state = recordAnswer(revealAnswer(startSession(cards)), 'unknown', null, NOW);
    state = correctAnswer(state, 'known', null, NOW);
    state = attachSchedule(state, 'a', schedule(DAY));
    expect(lastAnswer(state)?.corrected).toBe(true);
  });
});

describe('spoken attempts', () => {
  it('keeps what was heard, accepted or not', () => {
    let state = startSession(cards);
    state = noteAttempt(state, 'pronunciation', 'igen', true, NOW);
    state = noteAttempt(state, 'recall', 'לא', false, NOW + 1000);

    expect(attemptsFor(state, 'a')).toHaveLength(2);
    expect(attemptsFor(state, 'a', 'recall')).toEqual([
      { cardId: 'a', kind: 'recall', heard: 'לא', accepted: false, at: NOW + 1000 },
    ]);
  });

  it('attaches attempts to the card being asked', () => {
    let state = noteAttempt(startSession(cards), 'recall', 'כן', true, NOW);
    state = advance(recordAnswer(state, 'known', schedule(DAY), NOW));
    state = noteAttempt(state, 'recall', 'לא', true, NOW);

    expect(attemptsFor(state, 'a', 'recall')).toHaveLength(1);
    expect(attemptsFor(state, 'b', 'recall')).toHaveLength(1);
  });

  it('ignores anything said after the session is over', () => {
    const done = startSession([]);
    expect(noteAttempt(done, 'recall', 'כן', true, NOW)).toBe(done);
  });

  it('counts cards, not utterances, and only counts accepted recalls', () => {
    let state = startSession(cards);
    state = noteAttempt(state, 'recall', 'לא', false, NOW);
    state = noteAttempt(state, 'recall', 'כן', true, NOW);
    state = noteAttempt(state, 'pronunciation', 'igen', false, NOW);
    state = advance(recordAnswer(state, 'known', schedule(DAY), NOW));
    state = noteAttempt(state, 'recall', 'לא', false, NOW);
    state = recordAnswer(state, 'unknown', schedule(60_000), NOW);

    const summary = summarize(state);
    expect(summary.recalledAloud).toBe(1);
    expect(summary.pronounced).toBe(1);
    expect(summary.total).toBe(2);
  });
});

describe('taught words', () => {
  it('counts the new words a sitting actually got through', () => {
    const mixed: SessionCard[] = [
      { id: 'a', prompt: 'igen', answer: 'כן', mode: 'teach' },
      { id: 'b', prompt: 'nem', answer: 'לא', mode: 'review' },
    ];
    let state = startSession(mixed);
    state = advance(recordAnswer(state, 'unknown', schedule(60_000), NOW));
    expect(summarize(state).taught).toBe(1);

    state = recordAnswer(state, 'known', schedule(DAY), NOW);
    const summary = summarize(state);
    expect(summary.taught).toBe(1);
    expect(summary.total).toBe(2);
    // Meeting a word is not failing it.
    expect(summary.unknown).toBe(0);
  });
});


describe('a missed word comes back inside the sitting', () => {
  const deck: SessionCard[] = [
    { id: 'a', prompt: 'igen', answer: 'כן', mode: 'review' },
    { id: 'b', prompt: 'nem', answer: 'לא', mode: 'review' },
    { id: 'c', prompt: 'talán', answer: 'אולי', mode: 'review' },
    { id: 'd', prompt: 'soha', answer: 'לעולם לא', mode: 'review' },
    { id: 'e', prompt: 'mindig', answer: 'תמיד', mode: 'review' },
  ];

  it('puts a missed word back a few cards later, not at the end', () => {
    const state = recordAnswer(startSession(deck), 'unknown', schedule(60_000), NOW);
    expect(state.cards.map((card) => card.id)).toEqual(['a', 'b', 'c', 'a', 'd', 'e']);
  });

  it('lets a recalled word go, leaving the sitting to the schedule', () => {
    const state = recordAnswer(startSession(deck), 'known', schedule(DAY), NOW);
    expect(state.cards.map((card) => card.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('brings a word met for the first time back as a question', () => {
    const teaching: SessionCard[] = [
      { id: 'a', prompt: 'igen', answer: 'כן', mode: 'teach' },
      ...deck.slice(1),
    ];
    const state = recordAnswer(startSession(teaching), 'unknown', schedule(60_000), NOW);
    expect(state.cards[3]).toEqual({
      id: 'a',
      prompt: 'igen',
      answer: 'כן',
      mode: 'review',
    });
  });

  it('clamps the gap to the end of a short sitting', () => {
    const short = [deck[0], deck[1]];
    const state = recordAnswer(startSession(short), 'unknown', schedule(60_000), NOW);
    expect(state.cards.map((card) => card.id)).toEqual(['a', 'b', 'a']);
  });

  it('stops requeuing a word that keeps failing, so it cannot eat the sitting', () => {
    let state = startSession(deck);
    for (let round = 0; round < 5; round++) {
      // Answer the same word wrong every time it comes round again.
      while (currentCard(state)?.id !== 'a' && state.stage !== 'done') {
        state = advance(recordAnswer(state, 'known', schedule(DAY), NOW));
      }
      if (state.stage === 'done') break;
      state = advance(recordAnswer(state, 'unknown', schedule(60_000), NOW));
    }
    expect(state.cards.filter((card) => card.id === 'a')).toHaveLength(MAX_APPEARANCES);
  });
});

describe('progress is counted in words, not cards', () => {
  const deck: SessionCard[] = [
    { id: 'a', prompt: 'igen', answer: 'כן', mode: 'review' },
    { id: 'b', prompt: 'nem', answer: 'לא', mode: 'review' },
  ];

  it('does not grow when a missed word is put back', () => {
    const before = sessionProgress(startSession(deck)).total;
    const state = recordAnswer(startSession(deck), 'unknown', schedule(60_000), NOW);
    expect(sessionProgress(state).total).toBe(before);
  });

  it('counts a word as done only when nothing of it is left ahead', () => {
    let state = recordAnswer(startSession(deck), 'unknown', schedule(60_000), NOW);
    state = advance(state);
    // 'a' is still queued behind 'b', so one word is settled, not two.
    expect(sessionProgress(state)).toMatchObject({ total: 2, settled: 0, remaining: 2 });

    state = advance(recordAnswer(state, 'known', schedule(DAY), NOW));
    expect(sessionProgress(state)).toMatchObject({ settled: 1, remaining: 1 });
  });
});
