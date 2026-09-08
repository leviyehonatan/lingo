/**
 * Minimal pairs for the ear, and the recordings that say them.
 *
 * The method's first stage, before any vocabulary. A learner who cannot *hear*
 * the difference between two words cannot store them as two words, and spends
 * every later review fighting a distinction their ears are throwing away.
 * Hungarian gives a Hebrew speaker three worth drilling: vowel length, which
 * Hebrew does not mark; the front rounded vowels ö and ü, which Hebrew does
 * not have; and s/sz, which Hungarian spelling swaps round from the Latin
 * habit a Hebrew reader has met in English.
 *
 * The recordings are real, not synthesised. One engine saying both halves of a
 * pair gives them the same idiosyncrasies, so the task stops being the one the
 * learner needs to pass (D18). Both halves of a pair are also spoken by the
 * same person, for the same reason in reverse: two voices can be told apart
 * without hearing the contrast at all.
 *
 * Files come from Wikimedia Commons, are stored in `public/audio/hu`, and keep
 * their author and licence here so the trainer can show them. See P4 in
 * `docs/learning/decisions.md`.
 */

export type Contrast = 'length' | 'rounded' | 'sibilant';

export interface Clip {
  /** Public path, served from `public/audio/hu`. */
  file: string;
  author: string;
  license: string;
  licenseUrl: string;
}

export interface MinimalPair {
  contrast: Contrast;
  a: { word: string; he: string };
  b: { word: string; he: string };
}

/** One recording per word, keyed by the word itself. */
export const clips: Readonly<Record<string, Clip>> = {
  'agy': { file: '/audio/hu/agy.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'fő': { file: '/audio/hu/foee.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'fű': { file: '/audio/hu/fuee.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'hal': { file: '/audio/hu/hal.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'hál': { file: '/audio/hu/haal.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'kar': { file: '/audio/hu/kar.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'kerek': { file: '/audio/hu/kerek.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'kerék': { file: '/audio/hu/kereek.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'kor': { file: '/audio/hu/kor.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'kár': { file: '/audio/hu/kaar.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'kór': { file: '/audio/hu/koor.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'kör': { file: '/audio/hu/koer.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'les': { file: '/audio/hu/les.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'lesz': { file: '/audio/hu/lesz.ogg', author: 'Panda10', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' },
  'mer': { file: '/audio/hu/mer.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'mér': { file: '/audio/hu/meer.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'sor': { file: '/audio/hu/sor.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'szel': { file: '/audio/hu/szel.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'szél': { file: '/audio/hu/szeel.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'szó': { file: '/audio/hu/szoo.ogg', author: 'Sourcerror', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5' },
  'só': { file: '/audio/hu/soo.ogg', author: 'Sourcerror', license: 'CC BY-SA 2.5', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5' },
  'sör': { file: '/audio/hu/soer.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'tag': { file: '/audio/hu/tag.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'tág': { file: '/audio/hu/taag.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'vad': { file: '/audio/hu/vad.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'ver': { file: '/audio/hu/ver.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'vád': { file: '/audio/hu/vaad.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'vér': { file: '/audio/hu/veer.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'ágy': { file: '/audio/hu/aagy.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'ól': { file: '/audio/hu/ool.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'öl': { file: '/audio/hu/oel.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
  'ül': { file: '/audio/hu/uel.ogg', author: 'Panda10', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0' },
};

export const minimalPairs: readonly MinimalPair[] = [
  { contrast: 'length', a: { word: 'kar', he: 'זרוע' }, b: { word: 'kár', he: 'נזק' } },
  { contrast: 'length', a: { word: 'hal', he: 'דג' }, b: { word: 'hál', he: 'לן' } },
  { contrast: 'length', a: { word: 'tag', he: 'חבר' }, b: { word: 'tág', he: 'רחב' } },
  { contrast: 'length', a: { word: 'agy', he: 'מוח' }, b: { word: 'ágy', he: 'מיטה' } },
  { contrast: 'length', a: { word: 'vad', he: 'פראי' }, b: { word: 'vád', he: 'האשמה' } },
  { contrast: 'length', a: { word: 'ver', he: 'מכה' }, b: { word: 'vér', he: 'דם' } },
  { contrast: 'length', a: { word: 'kerek', he: 'עגול' }, b: { word: 'kerék', he: 'גלגל' } },
  { contrast: 'length', a: { word: 'mer', he: 'מעז' }, b: { word: 'mér', he: 'מודד' } },
  { contrast: 'length', a: { word: 'szel', he: 'פורס' }, b: { word: 'szél', he: 'רוח' } },
  { contrast: 'length', a: { word: 'kor', he: 'גיל' }, b: { word: 'kór', he: 'מחלה' } },
  { contrast: 'rounded', a: { word: 'ül', he: 'יושב' }, b: { word: 'öl', he: 'חיק' } },
  { contrast: 'rounded', a: { word: 'öl', he: 'חיק' }, b: { word: 'ól', he: 'דיר' } },
  { contrast: 'rounded', a: { word: 'sör', he: 'בירה' }, b: { word: 'sor', he: 'שורה' } },
  { contrast: 'rounded', a: { word: 'kör', he: 'מעגל' }, b: { word: 'kor', he: 'גיל' } },
  { contrast: 'rounded', a: { word: 'fű', he: 'דשא' }, b: { word: 'fő', he: 'ראשי' } },
  { contrast: 'sibilant', a: { word: 'só', he: 'מלח' }, b: { word: 'szó', he: 'מילה' } },
  { contrast: 'sibilant', a: { word: 'les', he: 'מארב' }, b: { word: 'lesz', he: 'יהיה' } },
];
