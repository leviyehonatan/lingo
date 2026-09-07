import { describe, expect, it } from 'vitest';
import { EVERYTHING, everythingTopic } from './everything';
import type { LevelData } from './api-types';
import { byFrequency } from './frequency';
import { levels as vocabulary } from '../data';

function level(id: string, topics: [string, string[]][]): LevelData {
  return {
    id,
    name: id,
    nameHe: id,
    sourceLang: 'hu',
    targetLang: 'he',
    topics: topics.map(([topicId, ids]) => ({
      id: topicId,
      name: topicId,
      nameHe: topicId,
      words: ids.map((wordId) => ({ id: wordId, hungarian: wordId, hebrew: wordId })),
    })),
  };
}

describe('everythingTopic', () => {
  it('pools every topic of every level, in curated order', () => {
    const pooled = everythingTopic([
      level('A1', [['greetings', ['w1', 'w2']], ['numbers', ['w3']]]),
      level('A2', [['food', ['w4']]]),
    ]);
    expect(pooled.id).toBe(EVERYTHING);
    expect(pooled.words.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
  });

  it('counts a word that appears in two topics once', () => {
    const pooled = everythingTopic([
      level('A1', [['greetings', ['w1', 'w2']], ['polite', ['w2', 'w3']]]),
    ]);
    expect(pooled.words.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
  });

  it('is empty, not broken, when there is no vocabulary yet', () => {
    expect(everythingTopic([]).words).toEqual([]);
  });
});

describe('the real vocabulary, pooled', () => {
  const ids = vocabulary.flatMap((level) =>
    level.topics.flatMap((topic) => topic.words.map((word) => word.id))
  );
  const topicOf = new Map(
    vocabulary.flatMap((level) =>
      level.topics.flatMap((topic) => topic.words.map((word) => [word.id, topic.id] as const))
    )
  );

  it('opens a sitting with words from more than one theme', () => {
    // The point of pooling: the first handful of new words is chosen by how
    // common they are, so it does not all come from whichever topic happens to
    // be first in the curated list.
    const opening = byFrequency(ids).slice(0, 5);
    expect(new Set(opening.map((id) => topicOf.get(id))).size).toBeGreaterThan(1);
  });
});
