/**
 * Pure study-session logic shared by the study page. No React, no I/O.
 */

import { isDue, type WordStatus } from './progress';

export type FilterMode = 'all' | 'unknown' | 'learning' | 'known' | 'due';

export interface WordProgressState {
  status: WordStatus;
  nextReview: number;
}

export type ProgressByWord = Record<string, WordProgressState | undefined>;

export interface StudyStats {
  known: number;
  learning: number;
  unknown: number;
}

/** Word ids that are ready to be shown again at `now`. */
export function dueWordIds(
  wordIds: readonly string[],
  byWord: ProgressByWord,
  now: number
): Set<string> {
  return new Set(wordIds.filter((id) => isDue(byWord[id]?.nextReview, now)));
}

/**
 * Apply the study filter. A word with no progress row counts as `unknown`,
 * which is why the filter checks the absence of a row rather than the string.
 */
export function filterWordIds(
  wordIds: readonly string[],
  byWord: ProgressByWord,
  filter: FilterMode,
  now: number
): string[] {
  if (filter === 'all') return [...wordIds];
  if (filter === 'due') {
    const due = dueWordIds(wordIds, byWord, now);
    return wordIds.filter((id) => due.has(id));
  }
  return wordIds.filter((id) => {
    const status = byWord[id]?.status;
    if (filter === 'unknown') return !status;
    return status === filter;
  });
}

/**
 * Header counters. A word that has fallen due again counts as `unknown`
 * regardless of the status it was last given, so the counts track what is
 * left to do rather than what was once answered.
 */
export function computeStats(
  wordIds: readonly string[],
  byWord: ProgressByWord,
  now: number
): StudyStats {
  const stats: StudyStats = { known: 0, learning: 0, unknown: 0 };
  for (const id of wordIds) {
    const entry = byWord[id];
    if (!entry || entry.status === 'unknown' || entry.nextReview <= now) {
      stats.unknown++;
    } else if (entry.status === 'learning') {
      stats.learning++;
    } else if (entry.status === 'known') {
      stats.known++;
    }
  }
  return stats;
}

/**
 * Fisher-Yates. Impure by nature, so `random` is injectable for tests.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Do two id lists describe the same deck? Used to decide whether a change to
 * the filtered word list is a real deck change (topic, filter, a word leaving
 * the filter) or only a new array holding the same words, which happens on
 * every progress update and every clock tick. Order is ignored: the deck is
 * shuffled anyway, so a reordering of the same ids is not a new deck.
 */
export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  if (seen.size !== a.length) {
    // Duplicate ids would make the set comparison lossy; fall back to order.
    return a.every((id, i) => id === b[i]);
  }
  return b.every((id) => seen.has(id));
}
