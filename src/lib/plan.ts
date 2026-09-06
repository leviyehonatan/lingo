/**
 * What a sitting should contain, and in what order. Pure: no React, no clock.
 *
 * The learner should not have to plan their own session. The method is explicit
 * about the shape: clear what is due first, then meet a limited number of new
 * words, and stop. See `docs/learning/method.md`.
 *
 * It is also explicit that a word you have never met cannot be tested. A word
 * with no progress is *taught* — shown with its answer, said aloud — and only
 * asked for once it has been met.
 */

import { isDue } from './progress';
import type { ProgressByWord } from './study';

export type CardMode = 'teach' | 'review';

export interface PlannedCard {
  id: string;
  mode: CardMode;
}

export interface SessionPlan {
  cards: PlannedCard[];
  /** Words already met whose time has come. */
  due: number;
  /** Words never met, that this session would introduce. */
  fresh: number;
  /** Words already met but not due yet, which is why a session can be empty. */
  waiting: number;
}

export interface PlanOptions {
  wordIds: readonly string[];
  byWord: ProgressByWord;
  now: number;
  /** Cap on new words in one sitting. */
  newLimit: number;
  /** Cap on the sitting as a whole. */
  size: number;
  /**
   * Whether two words are too alike to meet on the same day.
   *
   * The method is blunt about this: learning six and seven together, or green
   * and yellow, is what makes them stick to each other instead of to their
   * meanings. Our words are grouped by topic, which is exactly the arrangement
   * that produces those pairs, so the plan keeps them apart even though the
   * pool cannot.
   */
  confusable?: (a: string, b: string) => boolean;
}

/**
 * A word counts as met once it has a progress row, whatever its status: the
 * row is the record that it was introduced.
 */
function hasBeenMet(byWord: ProgressByWord, id: string): boolean {
  return byWord[id] !== undefined;
}

/**
 * Reviews first, oldest due first, then new words in the order given.
 *
 * Reviews come first because they are the ones about to be forgotten, and
 * because meeting new words is the reward for clearing them rather than a way
 * to avoid them.
 */
export function planSession(options: PlanOptions): SessionPlan {
  const { wordIds, byWord, now, newLimit, size } = options;
  const met = wordIds.filter((id) => hasBeenMet(byWord, id));
  const due = met
    .filter((id) => isDue(byWord[id]?.nextReview, now))
    .sort((a, b) => (byWord[a]?.nextReview ?? 0) - (byWord[b]?.nextReview ?? 0));
  const fresh = wordIds.filter((id) => !hasBeenMet(byWord, id));

  const cards: PlannedCard[] = due
    .slice(0, size)
    .map((id) => ({ id, mode: 'review' as const }));

  const room = Math.max(0, Math.min(size - cards.length, newLimit));
  const introduced: string[] = [];
  for (const id of fresh) {
    if (introduced.length >= room) break;
    const clashes = introduced.some((chosen) => options.confusable?.(chosen, id));
    if (!clashes) introduced.push(id);
  }
  // If every remaining word clashes with one already chosen, meet one anyway:
  // a sitting with nothing new in it is worse than a pair that look alike.
  if (introduced.length === 0 && room > 0 && fresh.length > 0) {
    introduced.push(fresh[0]);
  }
  for (const id of introduced) {
    cards.push({ id, mode: 'teach' });
  }

  return {
    cards,
    due: due.length,
    fresh: fresh.length,
    waiting: met.length - due.length,
  };
}

/**
 * The mode for a word picked some other way, such as an explicit choice to
 * drill one group. The rule does not change: unmet words are taught.
 */
export function modeFor(byWord: ProgressByWord, id: string): CardMode {
  return hasBeenMet(byWord, id) ? 'review' : 'teach';
}
