import { describe, expect, it } from 'vitest';
import {
  answer,
  buildDrill,
  currentQuestion,
  isFinished,
  next,
  playedWord,
} from './ear-training';
import { existsSync } from 'node:fs';
import { clips, minimalPairs } from '../data/minimal-pairs';

/** A `random` that walks a fixed list, so a drill is reproducible. */
function fixed(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('buildDrill', () => {
  it('asks for the length it was given', () => {
    const drill = buildDrill(minimalPairs, 8, fixed([0.1, 0.9]));
    expect(drill.questions).toHaveLength(8);
  });

  it('can be narrowed to one contrast', () => {
    const drill = buildDrill(minimalPairs, 6, fixed([0.3, 0.7]), 'sibilant');
    expect(drill.questions.every((q) => q.pair.contrast === 'sibilant')).toBe(true);
  });

  it('repeats pairs rather than cutting the drill short', () => {
    // Only two sibilant pairs exist, and a six-question drill is still six.
    const drill = buildDrill(minimalPairs, 6, fixed([0.3, 0.7]), 'sibilant');
    expect(drill.questions).toHaveLength(6);
  });

  it('is empty, not broken, when nothing matches', () => {
    const drill = buildDrill([], 5, fixed([0.5]));
    expect(drill.questions).toEqual([]);
    expect(isFinished(drill)).toBe(true);
  });
});

describe('answering', () => {
  const drill = buildDrill(minimalPairs, 3, fixed([0.2, 0.4]));

  it('counts a right answer and holds the verdict until the next question', () => {
    const played = drill.questions[0].played;
    const graded = answer(drill, played);
    expect(graded.correct).toBe(1);
    expect(graded.last).toEqual({ chosen: played, correct: true });
    // Still the same question: the learner is looking at the verdict.
    expect(currentQuestion(graded)).toBe(currentQuestion(drill));

    const moved = next(graded);
    expect(moved.last).toBeNull();
    expect(moved.answered).toBe(1);
  });

  it('counts a wrong answer without ending anything', () => {
    const wrong = drill.questions[0].played === 'a' ? 'b' : 'a';
    const graded = answer(drill, wrong);
    expect(graded.correct).toBe(0);
    expect(graded.last?.correct).toBe(false);
    expect(isFinished(graded)).toBe(false);
  });

  it('ignores a second answer to the same question', () => {
    const graded = answer(drill, 'a');
    expect(answer(graded, 'b')).toBe(graded);
  });

  it('is finished only once the last verdict has been dismissed', () => {
    let d = drill;
    for (let i = 0; i < 3; i += 1) d = next(answer(d, 'a'));
    expect(isFinished(d)).toBe(true);
  });
});

describe('the recordings', () => {
  it('exist for both halves of every pair', () => {
    for (const pair of minimalPairs) {
      expect(clips[pair.a.word], pair.a.word).toBeTruthy();
      expect(clips[pair.b.word], pair.b.word).toBeTruthy();
    }
  });

  it('are spoken by the same person within a pair', () => {
    // Two voices can be told apart without hearing the contrast at all, which
    // would make the drill pass without teaching anything.
    for (const pair of minimalPairs) {
      expect(clips[pair.a.word].author, `${pair.a.word}/${pair.b.word}`).toBe(
        clips[pair.b.word].author
      );
    }
  });

  it('all carry an author and a licence, since we redistribute them', () => {
    for (const [word, clip] of Object.entries(clips)) {
      expect(clip.author, word).not.toBe('');
      expect(clip.license, word).not.toBe('');
      expect(clip.file, word).toMatch(/^\/audio\/hu\/[a-z]+\.ogg$/);
    }
  });

  it('has no clip that no pair uses', () => {
    const used = new Set(minimalPairs.flatMap((p) => [p.a.word, p.b.word]));
    expect(Object.keys(clips).filter((w) => !used.has(w))).toEqual([]);
  });

  it('are actually on disk', () => {
    // The data is generated from what was downloaded; this is the check that
    // the download and the data have not drifted apart.
    for (const [word, clip] of Object.entries(clips)) {
      expect(existsSync(`public${clip.file}`), word).toBe(true);
    }
  });

  it('names two different words in every pair', () => {
    for (const pair of minimalPairs) expect(pair.a.word).not.toBe(pair.b.word);
  });
});

describe('playedWord', () => {
  it('reports the half that was played', () => {
    const pair = minimalPairs[0];
    expect(playedWord({ pair, played: 'b' })).toEqual(pair.b);
  });
});
