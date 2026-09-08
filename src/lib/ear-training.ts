/**
 * The ear-training drill: hear one word, say which of two it was.
 *
 * Pure. The page owns the audio element and the clock; this owns what is
 * asked, in what order, and what the answer was worth.
 *
 * The drill is deliberately not part of the study session and writes no
 * progress. It is a stage the learner passes through before vocabulary, not a
 * deck to review, and giving it a schedule would make it compete with the
 * words for the same sitting. See P4 in `docs/learning/decisions.md`.
 */

import type { Contrast, MinimalPair } from '../data/minimal-pairs';

export interface Question {
  pair: MinimalPair;
  /** Which half was played. The learner picks between `pair.a` and `pair.b`. */
  played: 'a' | 'b';
}

export interface Drill {
  questions: readonly Question[];
  /** How many have been answered, which is also the index of the current one. */
  answered: number;
  correct: number;
  /** The answer to the question just graded, until the next one starts. */
  last: { chosen: 'a' | 'b'; correct: boolean } | null;
}

/**
 * `random` is passed in rather than reached for, so a test can pin the drill
 * and the page can hand it `Math.random`.
 */
export function buildDrill(
  pairs: readonly MinimalPair[],
  length: number,
  random: () => number,
  contrast?: Contrast
): Drill {
  const pool = contrast ? pairs.filter((p) => p.contrast === contrast) : [...pairs];
  const questions: Question[] = [];
  // Sampling with replacement once the pool runs out: hearing the same pair
  // twice is fine, and a short pool should not shorten the drill.
  const shuffled = shuffleWith(pool, random);
  for (let i = 0; i < length && pool.length > 0; i += 1) {
    const pair = shuffled[i % shuffled.length];
    questions.push({ pair, played: random() < 0.5 ? 'a' : 'b' });
  }
  return { questions, answered: 0, correct: 0, last: null };
}

function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function currentQuestion(drill: Drill): Question | null {
  return drill.questions[drill.answered] ?? null;
}

/**
 * Grade the current question. A wrong answer is not punished beyond being told
 * — the point is to hear it again, immediately, knowing which one it was.
 */
export function answer(drill: Drill, chosen: 'a' | 'b'): Drill {
  const question = currentQuestion(drill);
  if (!question || drill.last) return drill;
  const correct = chosen === question.played;
  return {
    ...drill,
    correct: drill.correct + (correct ? 1 : 0),
    last: { chosen, correct },
  };
}

/** Move past the graded question. No-op until something has been graded. */
export function next(drill: Drill): Drill {
  if (!drill.last) return drill;
  return { ...drill, answered: drill.answered + 1, last: null };
}

export function isFinished(drill: Drill): boolean {
  return drill.last === null && drill.answered >= drill.questions.length;
}

/** The word that was actually played, for showing after the answer. */
export function playedWord(question: Question): { word: string; he: string } {
  return question.played === 'a' ? question.pair.a : question.pair.b;
}
