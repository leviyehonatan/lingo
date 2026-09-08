/**
 * The whole vocabulary as one pool, so a sitting is not confined to a theme.
 *
 * D22 orders new words by how common they are, but only among the words the
 * screen was already looking at — one topic's list. The method's argument is
 * stronger than that: the first words you learn should be the commonest ones
 * you will actually meet, whatever theme they belong to, and a themed list is
 * itself the interference pattern the book warns about. Pooling every topic
 * and letting the frequency order pick is what makes that true.
 *
 * Topics stay: they are a good way to drill a set on purpose. They are just no
 * longer the only way in. See P8 in `docs/learning/decisions.md`.
 */

import type { LevelData, TopicData } from './api-types';

/** The topic id that means "everything", in `/[pair]/study/[topic]`. */
export const EVERYTHING = 'all';

/**
 * Every word in the pair, in curated order. Duplicates are dropped by id: a
 * word that appears in two topics is one word, and meeting it twice in a
 * sitting would be a bug the learner sees.
 */
export function everythingTopic(levels: readonly LevelData[]): TopicData {
  const seen = new Set<string>();
  const words = [];
  for (const level of levels) {
    for (const topic of level.topics) {
      for (const word of topic.words) {
        if (seen.has(word.id)) continue;
        seen.add(word.id);
        words.push(word);
      }
    }
  }
  return {
    id: EVERYTHING,
    name: 'Minden szó',
    nameHe: 'כל המילים',
    words,
  };
}
