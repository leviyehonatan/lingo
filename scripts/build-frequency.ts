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

  const entries: [string, number][] = [];
  let unranked = 0;
  for (const level of levels) {
    for (const topic of level.topics) {
      for (const word of topic.words) {
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
 * cover are absent, and keep their curated order.
 */

export const frequencyRank: Readonly<Record<string, number>> = {
${body}
};
`;
  writeFileSync(new URL('../src/data/frequency.ts', import.meta.url), file);
  console.log(`${entries.length} ranked, ${unranked} unranked`);
}

main();
