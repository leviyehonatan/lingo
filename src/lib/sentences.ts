/**
 * The example sentence shown when a word is introduced, if we have one.
 *
 * Only on the teaching card. A sentence on a recall card would carry the
 * answer, and the point of the recall is that nothing on screen carries it.
 * See P3 in `docs/learning/decisions.md`.
 */

import { examples, type Example } from '../data/sentences';

export function exampleFor(wordId: string): Example | null {
  return examples[wordId] ?? null;
}
