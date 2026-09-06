/**
 * The study session as a state machine. Pure: no React, no I/O, no clock.
 *
 * A session is a finite, ordered run through a fixed set of cards. It exists so
 * the learner always knows which of four things is happening: being asked,
 * seeing the answer, being told what the answer cost, or finished. The old
 * screen showed every control at once and never said which of those it was.
 *
 * See `docs/learning/method.md` for why a review is graded once, immediately,
 * with the consequence shown.
 */

import type { WordStatus } from './progress';

export type SessionStage = 'prompt' | 'reveal' | 'feedback' | 'done';

/** One card, already resolved to the direction being studied. */
export interface SessionCard {
  id: string;
  prompt: string;
  answer: string;
}

export interface SessionAnswer {
  cardId: string;
  status: WordStatus;
  /** When the server says the word comes back. Null if the write failed. */
  nextReview: number | null;
  /** When the learner answered, so the delay can be described without a clock. */
  answeredAt: number;
  /** True when the learner overturned the first verdict. */
  corrected: boolean;
}

/**
 * What the learner said out loud, and whether the grader accepted it.
 *
 * `recall` is the real test: saying the answer before it is shown. It decides
 * the grade. `pronunciation` is saying the word that is already on screen,
 * which practises the mouth and must never touch the schedule.
 */
export type AttemptKind = 'pronunciation' | 'recall';

export interface SessionAttempt {
  cardId: string;
  kind: AttemptKind;
  /** The transcript, so the learner can see what the app thought it heard. */
  heard: string;
  accepted: boolean;
  at: number;
}

export interface SessionState {
  cards: readonly SessionCard[];
  index: number;
  stage: SessionStage;
  answers: readonly SessionAnswer[];
  attempts: readonly SessionAttempt[];
}

/** A session over no cards is already finished; there is nothing to ask. */
export function startSession(cards: readonly SessionCard[]): SessionState {
  return {
    cards,
    index: 0,
    stage: cards.length === 0 ? 'done' : 'prompt',
    answers: [],
    attempts: [],
  };
}

export function currentCard(state: SessionState): SessionCard | undefined {
  return state.cards[state.index];
}

/** Show the answer. Only meaningful while the learner is being asked. */
export function revealAnswer(state: SessionState): SessionState {
  if (state.stage !== 'prompt') return state;
  return { ...state, stage: 'reveal' };
}

/**
 * Record how the learner graded themselves and move to the verdict, where the
 * consequence is shown and can still be overturned.
 */
export function recordAnswer(
  state: SessionState,
  status: WordStatus,
  nextReview: number | null,
  now: number
): SessionState {
  const card = currentCard(state);
  if (!card || state.stage === 'done' || state.stage === 'feedback') return state;
  return {
    ...state,
    stage: 'feedback',
    answers: [
      ...state.answers,
      { cardId: card.id, status, nextReview, answeredAt: now, corrected: false },
    ],
  };
}

/**
 * Fill in the schedule once the server has answered. This is not a correction:
 * the learner's grade is unchanged, only the delay it earned is now known.
 */
export function attachSchedule(
  state: SessionState,
  cardId: string,
  nextReview: number | null
): SessionState {
  const previous = state.answers[state.answers.length - 1];
  if (!previous || previous.cardId !== cardId) return state;
  return {
    ...state,
    answers: [...state.answers.slice(0, -1), { ...previous, nextReview }],
  };
}

/**
 * Overturn the verdict just given. Speech recognition is wrong often enough,
 * especially in Hebrew, that the grader must never have the last word.
 */
export function correctAnswer(
  state: SessionState,
  status: WordStatus,
  nextReview: number | null,
  now: number
): SessionState {
  if (state.stage !== 'feedback' || state.answers.length === 0) return state;
  const answers = state.answers.slice(0, -1);
  const previous = state.answers[state.answers.length - 1];
  return {
    ...state,
    answers: [
      ...answers,
      { ...previous, status, nextReview, answeredAt: now, corrected: true },
    ],
  };
}

/** The verdict has been read; ask the next card, or finish. */
export function advance(state: SessionState): SessionState {
  if (state.stage === 'done') return state;
  const next = state.index + 1;
  if (next >= state.cards.length) {
    return { ...state, index: state.cards.length, stage: 'done' };
  }
  return { ...state, index: next, stage: 'prompt' };
}

/** Stop early. Whatever was answered still counts. */
export function endSession(state: SessionState): SessionState {
  return { ...state, stage: 'done' };
}

/**
 * Record something the learner said. Attempts are kept whatever the outcome,
 * so the session can show what it heard rather than only whether it approved.
 */
export function noteAttempt(
  state: SessionState,
  kind: AttemptKind,
  heard: string,
  accepted: boolean,
  now: number
): SessionState {
  const card = currentCard(state);
  if (!card || state.stage === 'done') return state;
  return {
    ...state,
    attempts: [...state.attempts, { cardId: card.id, kind, heard, accepted, at: now }],
  };
}

/** What the learner has said about this card so far, in order. */
export function attemptsFor(
  state: SessionState,
  cardId: string,
  kind?: AttemptKind
): SessionAttempt[] {
  return state.attempts.filter(
    (a) => a.cardId === cardId && (kind === undefined || a.kind === kind)
  );
}

/** The verdict currently on screen, if any. */
export function lastAnswer(state: SessionState): SessionAnswer | undefined {
  return state.stage === 'feedback' ? state.answers[state.answers.length - 1] : undefined;
}

export interface SessionProgress {
  /** 1-based position of the card being asked, capped at the deck size. */
  position: number;
  total: number;
  answered: number;
}

export function sessionProgress(state: SessionState): SessionProgress {
  return {
    position: Math.min(state.index + 1, state.cards.length),
    total: state.cards.length,
    answered: state.answers.length,
  };
}

export interface SessionSummary {
  total: number;
  known: number;
  learning: number;
  unknown: number;
  corrected: number;
  /** Cards whose meaning the learner said out loud and the grader accepted. */
  recalledAloud: number;
  /** Cards the learner practised pronouncing, whatever the outcome. */
  pronounced: number;
  /**
   * How long until the soonest word from this session comes back, measured
   * from when it was answered. Null when nothing was graded, or when every
   * write failed. A delay rather than a timestamp, so the summary can be
   * rendered without reading the clock.
   */
  soonestDelay: number | null;
}

/**
 * What the learner did, counted once per card. A card answered twice, because
 * the verdict was overturned, still counts once and counts as its final grade.
 */
export function summarize(state: SessionState): SessionSummary {
  const summary: SessionSummary = {
    total: state.answers.length,
    known: 0,
    learning: 0,
    unknown: 0,
    corrected: 0,
    recalledAloud: 0,
    pronounced: 0,
    soonestDelay: null,
  };
  const recalled = new Set<string>();
  const pronounced = new Set<string>();
  for (const attempt of state.attempts) {
    if (attempt.kind === 'pronunciation') pronounced.add(attempt.cardId);
    else if (attempt.accepted) recalled.add(attempt.cardId);
  }
  summary.recalledAloud = recalled.size;
  summary.pronounced = pronounced.size;
  for (const answer of state.answers) {
    summary[answer.status]++;
    if (answer.corrected) summary.corrected++;
    if (answer.nextReview !== null) {
      const delay = answer.nextReview - answer.answeredAt;
      summary.soonestDelay =
        summary.soonestDelay === null ? delay : Math.min(summary.soonestDelay, delay);
    }
  }
  return summary;
}
