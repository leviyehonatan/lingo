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
import type { CardMode } from './plan';

export type SessionStage = 'prompt' | 'reveal' | 'feedback' | 'done';

/**
 * How far ahead a word goes when it has to come back inside this sitting,
 * measured in cards.
 *
 * The interval ladder's short rungs are minutes long, which no sitting built as
 * a fixed list can ever reach: a word missed at the start could not return
 * until the next day. Pimsleur's schedule fires four of its rungs before a
 * lesson ends, and Duolingo will not let a lesson finish while an item is still
 * wrong. This is that idea, measured in cards rather than seconds, because a
 * card is what a learner actually experiences as distance.
 */
export const REINSERT_GAP: Record<WordStatus, number | null> = {
  // Missed: bring it back soon, while the answer is still fresh.
  unknown: 3,
  // Half known, or just met: far enough that it has to be recalled again.
  // Recalled: the schedule takes it from here.
  known: null,
};

/**
 * How many times one word may appear in a single sitting, the first showing
 * included. A word that keeps failing has to stop eating the session; the
 * schedule will bring it back soon enough.
 */
export const MAX_APPEARANCES = 3;

/** One card, already resolved to the direction being studied. */
export interface SessionCard {
  id: string;
  prompt: string;
  answer: string;
  /**
   * `teach` for a word the learner has never met: it is shown with its answer
   * and said aloud, never asked for. `review` is the graded recall.
   */
  mode: CardMode;
}

/** What the server decided about a word, as it reported it. */
export interface Schedule {
  nextReview: number;
  intervalMs: number;
}

export interface SessionAnswer {
  cardId: string;
  status: WordStatus;
  /** When the server says the word comes back. Null if the write failed. */
  nextReview: number | null;
  /**
   * How long that wait is, as the server measured it. Kept separately because
   * the browser's clock cannot be trusted to subtract from the server's.
   */
  intervalMs: number | null;
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
  schedule: Schedule | null,
  now: number
): SessionState {
  const card = currentCard(state);
  if (!card || state.stage === 'done' || state.stage === 'feedback') return state;
  const answered: SessionState = {
    ...state,
    stage: 'feedback',
    answers: [
      ...state.answers,
      {
        cardId: card.id,
        status,
        nextReview: schedule?.nextReview ?? null,
        intervalMs: schedule?.intervalMs ?? null,
        answeredAt: now,
        corrected: false,
      },
    ],
  };
  return requeue(answered, status);
}

/**
 * Put the card that was just answered back into the queue, if that grade says
 * it should come back. Inserting rather than appending is the point: a missed
 * word returns a few cards later, not at some unreachable end.
 */
function requeue(state: SessionState, status: WordStatus): SessionState {
  const card = currentCard(state);
  const gap = REINSERT_GAP[status];
  if (!card || gap === null) return state;

  const appearances = state.cards.filter((other) => other.id === card.id).length;
  if (appearances >= MAX_APPEARANCES) return state;

  const at = Math.min(state.index + gap, state.cards.length);
  const cards = [...state.cards];
  // It comes back as a question whatever it was: a word already met is never
  // introduced twice.
  cards.splice(at, 0, { ...card, mode: 'review' });
  return { ...state, cards };
}

/**
 * Fill in the schedule once the server has answered. This is not a correction:
 * the learner's grade is unchanged, only the delay it earned is now known.
 */
export function attachSchedule(
  state: SessionState,
  cardId: string,
  schedule: Schedule | null
): SessionState {
  const previous = state.answers[state.answers.length - 1];
  if (!previous || previous.cardId !== cardId) return state;
  return {
    ...state,
    answers: [
      ...state.answers.slice(0, -1),
      {
        ...previous,
        nextReview: schedule?.nextReview ?? null,
        intervalMs: schedule?.intervalMs ?? null,
      },
    ],
  };
}

/**
 * Overturn the verdict just given. Speech recognition is wrong often enough,
 * especially in Hebrew, that the grader must never have the last word.
 */
export function correctAnswer(
  state: SessionState,
  status: WordStatus,
  schedule: Schedule | null,
  now: number
): SessionState {
  if (state.stage !== 'feedback' || state.answers.length === 0) return state;
  const answers = state.answers.slice(0, -1);
  const previous = state.answers[state.answers.length - 1];
  return {
    ...state,
    answers: [
      ...answers,
      {
        ...previous,
        status,
        nextReview: schedule?.nextReview ?? null,
        intervalMs: schedule?.intervalMs ?? null,
        answeredAt: now,
        corrected: true,
      },
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
  /** Distinct words in the sitting. Fixed once it starts. */
  total: number;
  /** Words with nothing left to do. */
  settled: number;
  /** Words still to come, the one on screen included. */
  remaining: number;
  answered: number;
}

/**
 * Progress is counted in words, not cards.
 *
 * The queue grows as words are missed and put back, so a card count would climb
 * under the learner. The number of words in the sitting never changes, and a
 * word is done when it has no appearance left ahead of it.
 */
export function sessionProgress(state: SessionState): SessionProgress {
  const total = new Set(state.cards.map((card) => card.id)).size;
  const remaining = new Set(
    state.cards.slice(state.index).map((card) => card.id)
  ).size;
  return {
    total,
    settled: total - remaining,
    remaining,
    answered: state.answers.length,
  };
}

export interface SessionSummary {
  total: number;
  /** Words met for the first time in this sitting. */
  taught: number;
  known: number;
  unknown: number;
  corrected: number;
  /** Cards whose meaning the learner said out loud and the grader accepted. */
  recalledAloud: number;
  /** Cards the learner practised pronouncing, whatever the outcome. */
  pronounced: number;
  /**
   * How long until the soonest word from this session comes back, as the
   * server measured it. Null when nothing was graded, or when every write
   * failed.
   */
  soonestDelay: number | null;
}

/**
 * What the learner did, counted once per card. A card answered twice, because
 * the verdict was overturned, still counts once and counts as its final grade.
 * A word met for the first time is counted as taught, not as a miss: there was
 * no question to get wrong.
 */
export function summarize(state: SessionState): SessionSummary {
  const taught = new Set(
    state.cards.filter((card) => card.mode === 'teach').map((card) => card.id)
  );
  const summary: SessionSummary = {
    total: state.answers.length,
    taught: state.answers.filter((answer) => taught.has(answer.cardId)).length,
    known: 0,
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
    if (!taught.has(answer.cardId)) summary[answer.status]++;
    if (answer.corrected) summary.corrected++;
    if (answer.intervalMs !== null) {
      summary.soonestDelay =
        summary.soonestDelay === null
          ? answer.intervalMs
          : Math.min(summary.soonestDelay, answer.intervalMs);
    }
  }
  return summary;
}
