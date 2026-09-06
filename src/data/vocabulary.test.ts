import { describe, expect, it } from 'vitest';
import { levels } from '@/data';
import type { Level, Topic, Word } from '@/data';

const HEBREW_LETTER = /[֐-׿]/;

function allTopics(): { level: Level; topic: Topic }[] {
  return levels.flatMap((level) => level.topics.map((topic) => ({ level, topic })));
}

function allWords(): { level: Level; topic: Topic; word: Word }[] {
  return allTopics().flatMap(({ level, topic }) =>
    topic.words.map((word) => ({ level, topic, word }))
  );
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dups.add(v);
    seen.add(v);
  }
  return [...dups];
}

describe('vocabulary data', () => {
  it('ships the three CEFR levels in order', () => {
    expect(levels.map((l) => l.id)).toEqual(['A1', 'A2', 'B1']);
  });

  it('every level is named in both languages and has a sane number of topics and words', () => {
    for (const level of levels) {
      expect(level.name, level.id).toMatch(/\S/);
      expect(level.nameHe, level.id).toMatch(HEBREW_LETTER);
      expect(level.topics.length, `${level.id} topics`).toBeGreaterThanOrEqual(5);
      const wordCount = level.topics.reduce((n, t) => n + t.words.length, 0);
      expect(wordCount, `${level.id} words`).toBeGreaterThanOrEqual(200);
    }
  });

  it('every topic has an id, names in both languages and at least 10 words', () => {
    for (const { level, topic } of allTopics()) {
      expect(topic.id, `${level.id} topic id`).toMatch(/^[a-z0-9-]+$/);
      expect(topic.name, topic.id).toMatch(/\S/);
      expect(topic.nameHe, topic.id).toMatch(HEBREW_LETTER);
      expect(topic.words.length, `${topic.id} words`).toBeGreaterThanOrEqual(10);
    }
  });

  it('every word has an id, a Hungarian term and a Hebrew translation', () => {
    for (const { topic, word } of allWords()) {
      expect(word.id, `${topic.id} word id`).toMatch(/^[a-z0-9-]+$/);
      expect(word.hungarian.trim(), word.id).not.toBe('');
      expect(word.hebrew, word.id).toMatch(HEBREW_LETTER);
    }
  });

  it('topic and word ids are namespaced by their level', () => {
    for (const { level, topic } of allTopics()) {
      const prefix = `${level.id.toLowerCase()}-`;
      expect(topic.id, `${topic.id} in ${level.id}`).toMatch(new RegExp(`^${prefix}`));
      for (const word of topic.words) {
        expect(word.id, `${word.id} in ${level.id}`).toMatch(new RegExp(`^${prefix}`));
      }
    }
  });

  it('level, topic and word ids are unique across the whole vocabulary', () => {
    expect(duplicates(levels.map((l) => l.id))).toEqual([]);
    expect(duplicates(allTopics().map(({ topic }) => topic.id))).toEqual([]);
    expect(duplicates(allWords().map(({ word }) => word.id))).toEqual([]);
  });

  it('does not repeat a Hungarian term within a topic', () => {
    for (const { topic } of allTopics()) {
      expect(duplicates(topic.words.map((w) => w.hungarian)), topic.id).toEqual([]);
    }
  });
});
