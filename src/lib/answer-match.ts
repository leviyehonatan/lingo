/**
 * Grading a spoken or typed answer against the expected one. Pure, no React,
 * no browser APIs, so the study page and its tests share one definition of
 * "close enough".
 *
 * The method notes in `docs/learning/` set the rules this implements: any
 * correct answer passes, grading is by concept rather than by exact string,
 * and a near miss that a listener would accept should not be marked wrong.
 * What it must never do is accept a fragment: an earlier version matched when
 * either string contained the other, so a single spoken syllable scored a word
 * correct.
 */

/** Below this length a word is too short for one edit to be a near miss. */
const MIN_FUZZY_LENGTH = 5;

/** Similarity above which two normalized strings count as the same answer. */
export const DEFAULT_THRESHOLD = 0.8;

/** Hebrew vowel points and cantillation, which speech engines never emit. */
const HEBREW_MARKS = /[֑-ֽֿ-ׇ]/g;

/** Punctuation to drop. Anything that separates words becomes a space. */
const SEPARATORS = /[־\-–—_/\\|]+/g;
const PUNCTUATION = /["'`´’‘“”״׳.,;:!?¿¡()[\]{}…]+/g;

/**
 * Case-folded, punctuation-free, single-spaced form used for every comparison.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(HEBREW_MARKS, '')
    .replace(SEPARATORS, ' ')
    .replace(PUNCTUATION, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The answers a card actually accepts.
 *
 * Vocabulary entries carry alternatives separated by a slash, and qualifiers in
 * parentheses that say which sense is meant rather than forming part of the
 * word. Both the qualified and the bare form count as correct, because the
 * learner is being asked for the word, not for the annotation.
 */
export function expectedVariants(expected: string): string[] {
  const variants = new Set<string>();
  for (const part of expected.split(/[/|]/)) {
    const full = normalize(part);
    if (full) variants.add(full);
    const withoutQualifiers = normalize(part.replace(/\([^)]*\)/g, ' '));
    if (withoutQualifiers) variants.add(withoutQualifiers);
  }
  return [...variants];
}

/** Levenshtein edit distance between two strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** Edit distance as a 0-to-1 ratio, where 1 means identical. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}

/**
 * Does `spoken` contain the whole of `expected` as consecutive words?
 *
 * Speech engines pad an answer with filler and false starts, so a transcript
 * that says the answer plus noise is still a correct answer. The whole expected
 * phrase has to be there: this is deliberately not a substring test.
 */
function containsPhrase(spoken: string, expected: string): boolean {
  const words = spoken.split(' ').filter(Boolean);
  const target = expected.split(' ').filter(Boolean);
  if (!target.length || target.length > words.length) return false;
  for (let start = 0; start + target.length <= words.length; start++) {
    if (target.every((word, offset) => words[start + offset] === word)) return true;
  }
  return false;
}

function matchesVariant(spoken: string, variant: string, threshold: number): boolean {
  if (!spoken || !variant) return false;
  if (spoken === variant) return true;
  if (containsPhrase(spoken, variant)) return true;
  // One edit in a short word is usually a different word, so only longer
  // answers are graded on similarity.
  if (variant.length < MIN_FUZZY_LENGTH) return false;
  return similarity(spoken, variant) >= threshold;
}

/** Is this one transcript an acceptable answer for this card? */
export function matchesExpected(
  spoken: string,
  expected: string,
  threshold: number = DEFAULT_THRESHOLD
): boolean {
  const heard = normalize(spoken);
  if (!heard) return false;
  return expectedVariants(expected).some((variant) =>
    matchesVariant(heard, variant, threshold)
  );
}

/**
 * Speech recognition returns several candidate transcripts for one utterance
 * and the best one is not always first, so any of them may carry the answer.
 */
export function matchesAnyAlternative(
  alternatives: readonly string[],
  expected: string,
  threshold: number = DEFAULT_THRESHOLD
): boolean {
  return alternatives.some((alternative) =>
    matchesExpected(alternative, expected, threshold)
  );
}

export interface WordMatch {
  word: string;
  heard: boolean;
}

/**
 * Which words of an answer were heard, so feedback can point at the one that
 * went wrong instead of failing the whole utterance.
 *
 * Speak does this by lighting up the words it matched and leaving the rest
 * neutral, which is far more use on a phrase than a single verdict. Order is
 * ignored deliberately: a learner who says the right words in a clumsy order
 * has still produced them, and the whole-answer grade already judges the rest.
 */
export function matchedWords(spoken: string, expected: string): WordMatch[] {
  const heard = normalize(spoken).split(' ').filter(Boolean);
  const target = normalize(expected).split(' ').filter(Boolean);
  const pool = [...heard];

  return target.map((word) => {
    const at = pool.findIndex(
      (candidate) =>
        candidate === word ||
        (word.length >= 5 && similarity(candidate, word) >= DEFAULT_THRESHOLD)
    );
    if (at === -1) return { word, heard: false };
    // Each spoken word can only account for one expected word.
    pool.splice(at, 1);
    return { word, heard: true };
  });
}

/**
 * Fill in part of an answer, as a step between meeting a word and recalling it
 * cold. Speak fades its scaffolding the same way, covering more of a sentence
 * each time rather than switching from shown to hidden.
 *
 * `revealed` is the share of each word left visible, from 0 to 1. Letters are
 * kept from the start, since that is what a learner reaches for first.
 */
export function maskAnswer(answer: string, revealed = 0.4): string {
  return answer
    .split(' ')
    .map((word) => {
      const characters = [...word];
      if (characters.length <= 1) return word;
      const keep = Math.max(1, Math.round(characters.length * revealed));
      return (
        characters.slice(0, keep).join('') +
        characters
          .slice(keep)
          .map((character) => (/\s/.test(character) ? character : '·'))
          .join('')
      );
    })
    .join(' ');
}
