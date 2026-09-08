import { describe, expect, it } from 'vitest';
import { exampleFor } from './sentences';
import { examples } from '../data/sentences';
import { levels } from '../data';
import { byFrequency } from './frequency';

const words = new Map(
  levels.flatMap((level) =>
    level.topics.flatMap((topic) => topic.words.map((word) => [word.id, word] as const))
  )
);

describe('exampleFor', () => {
  it('returns the sentence for a word that has one', () => {
    expect(exampleFor('a1-g-2')).toEqual({ hu: 'Nem tudom.', he: 'אני לא יודע.' });
  });

  it('returns null rather than throwing for a word that has none', () => {
    expect(exampleFor('a1-g-25')).toBeNull();
    expect(exampleFor('not-a-word')).toBeNull();
  });
});

describe('the sentences themselves', () => {
  it('are all attached to a word that exists', () => {
    const orphans = Object.keys(examples).filter((id) => !words.has(id));
    expect(orphans).toEqual([]);
  });

  it('carry both languages', () => {
    for (const [id, example] of Object.entries(examples)) {
      expect(example.hu.trim(), id).not.toBe('');
      expect(example.he.trim(), id).not.toBe('');
    }
  });

  it('stay short enough to read at a glance', () => {
    // A sentence that needs parsing teaches the grammar instead of the word.
    for (const [id, example] of Object.entries(examples)) {
      expect(example.hu.split(/\s+/).length, id).toBeLessThanOrEqual(6);
    }
  });

  it('cover the words a learner meets first', () => {
    // Coverage is partial on purpose, but it has to be partial at the *end* of
    // the frequency order, not the start: these are the words that actually
    // come up in the first sittings.
    const opening = byFrequency([...words.keys()]).slice(0, 40);
    expect(opening.filter((id) => !exampleFor(id))).toEqual([]);
  });
});
