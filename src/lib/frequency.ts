/**
 * How common a word is, as an ordering for words not yet met.
 *
 * The method's argument is that the first words you learn should be the ones
 * you will actually meet, and that a beginner's list ordered by theme rather
 * than by use spends its early sittings on words that almost never come up.
 * We order *within* a topic only — which topic you study is still your choice
 * (see docs/learning/decisions.md).
 *
 * Ranks come from `src/data/frequency.ts`, which is generated; see
 * `scripts/build-frequency.ts`.
 */

import { frequencyRank } from '../data/frequency';

/**
 * Lower is more common. A word the source list does not cover ranks last,
 * rather than first: we would rather delay a word we cannot vouch for than
 * lead with it.
 */
export function rankOf(wordId: string): number {
  return frequencyRank[wordId] ?? Number.POSITIVE_INFINITY;
}

/**
 * Most common first. Stable, so words with no rank — and any tie — keep the
 * curated order they came in with.
 */
export function byFrequency(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => rankOf(a) - rankOf(b));
}
