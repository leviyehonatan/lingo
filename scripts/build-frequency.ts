/**
 * Regenerates `src/data/frequency.ts` — a rank per vocabulary word, so that
 * new words can be introduced most-useful-first (see docs/learning/method.md).
 *
 * The ranks come from the OpenSubtitles-derived Hungarian list in
 * hermitdave/FrequencyWords (CC BY-SA 4.0). That list is *not* vendored: this
 * script fetches it, and only the derived map for our own 925 words is
 * committed. Re-run it after adding vocabulary:
 *
 *   npx tsx --tsconfig tsconfig.json scripts/build-frequency.ts
 *
 * Pass a local path as the first argument to work offline.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { levels } from '../src/data';

/**
 * Entries whose form is counted in the list, but mostly for a *different*
 * word. The list counts wordforms, not senses, so these ranks are evidence
 * about a word we are not teaching. We would rather claim nothing than claim
 * something false, so they are left unranked and keep their curated position.
 * This list is not exhaustive; add to it when you find another. See P9.
 */
const WRONG_SENSE: Record<string, string> = {
  'a1-b-12': 'hát — ranked as the discourse particle "well…", not the back',
  'a1-b-16': 'fog — ranked as the future auxiliary, not the tooth',
  'a1-w-7': 'ég — ranked largely as the verb "burns", not the sky',
  'b1-ab-8': 'ok — the form collides with unaccented spellings of ők',
  'a1-n-7': 'hat — also the verb "to have an effect"',
  'a2-j-30': 'keres — ranked mostly as "looks for", not "earns"',
};

const SOURCE_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/hu/hu_50k.txt';

/** Lowercase, drop the punctuation our entries carry (`hogy vagy?`, `a nevem...`). */
function tokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

async function load(): Promise<string> {
  const local = process.argv[2];
  if (local) return readFileSync(local, 'utf8');
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`${SOURCE_URL} responded ${response.status}`);
  return response.text();
}

async function main() {
  const text = await load();
  const rankOfToken = new Map<string, number>();
  let rank = 0;
  for (const line of text.split('\n')) {
    const word = line.split(' ')[0]?.trim();
    if (!word) continue;
    rank += 1;
    if (!rankOfToken.has(word)) rankOfToken.set(word, rank);
  }

  // A headword our data uses for two different meanings — `hét` for both
  // "seven" and "week", `fél` for both "half" and "afraid" — cannot take one
  // rank, because the count belongs to both at once and we cannot say in what
  // proportion. Two entries with the *same* meaning are a duplicate, not an
  // ambiguity, and still rank.
  const meanings = new Map<string, Set<string>>();
  for (const level of levels) {
    for (const topic of level.topics) {
      for (const word of topic.words) {
        const key = word.hungarian.toLowerCase();
        const seen = meanings.get(key) ?? new Set<string>();
        seen.add(word.hebrew);
        meanings.set(key, seen);
      }
    }
  }

  const entries: [string, number][] = [];
  let unranked = 0;
  for (const level of levels) {
    for (const topic of level.topics) {
      for (const word of topic.words) {
        if (WRONG_SENSE[word.id]) {
          unranked += 1;
          continue;
        }
        if ((meanings.get(word.hungarian.toLowerCase())?.size ?? 0) > 1) {
          unranked += 1;
          continue;
        }
        const parts = tokens(word.hungarian);
        const ranks = parts.map((part) => rankOfToken.get(part));
        // A phrase is only as common as its rarest word: `nem értem` is no
        // easier to earn than `értem`. An unknown part makes the whole phrase
        // unranked rather than optimistically ranking it by the words we found.
        if (parts.length === 0 || ranks.some((r) => r === undefined)) {
          unranked += 1;
          continue;
        }
        entries.push([word.id, Math.max(...(ranks as number[]))]);
      }
    }
  }

  const body = entries.map(([id, r]) => `  '${id}': ${r},`).join('\n');
  const file = `/**
 * How common each word is, lowest rank = most common. Generated — do not edit
 * by hand; run \`npx tsx --tsconfig tsconfig.json scripts/build-frequency.ts\`.
 *
 * Derived from the OpenSubtitles Hungarian frequency list in
 * hermitdave/FrequencyWords (CC BY-SA 4.0), which this repo does not vendor.
 * A multi-word entry takes its rarest word's rank. Words the list does not
 * cover are absent, and keep their curated order — as are words whose form is
 * counted for a different sense than the one we teach (see P9).
 */

export const frequencyRank: Readonly<Record<string, number>> = {
${body}
};
`;
  writeFileSync(new URL('../src/data/frequency.ts', import.meta.url), file);
  console.log(`${entries.length} ranked, ${unranked} unranked`);
}

main();
