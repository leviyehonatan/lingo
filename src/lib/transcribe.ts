/**
 * How a Hungarian word sounds, worked out from its spelling.
 *
 * Hungarian spelling is shallow: with a handful of digraphs and the rule that
 * stress is always on the first syllable, the sound follows from the letters.
 * That is what makes this possible without a dictionary, and it is also why
 * the method rates a transcription as low priority for this language. It is
 * still worth having for a Hebrew reader, who otherwise reads `s` as /s/ and
 * `sz` as two sounds: the spelling-contaminated pronunciation the method warns
 * about. Two renderings come out of one tokenizer:
 *
 * - IPA, which is exact.
 * - Hebrew letters with vowel points, which a Hebrew reader can say without
 *   learning anything, and which is an approximation where Hebrew lacks the
 *   sound: the front rounded vowels ö/ő and ü/ű are rendered as e and i.
 *
 * Pure, and deliberately rule-based: a word that breaks the rules (loanwords,
 * `h` silent at the end of a few words, assimilation across a boundary) gets
 * the regular reading, which is still closer than the spelling.
 */

type Vowel = {
  ipa: string;
  /** Vowel point placed on the carrying consonant, or '' when a mater does the work. */
  mark: string;
  /** Letter written after the carrier to show the vowel (mater lectionis). */
  after: string;
  /** Letter written when the vowel ends a word, so the word does not look cut off. */
  final: string;
};

const VOWELS: Record<string, Vowel> = {
  a: { ipa: 'ɒ', mark: 'ָ', after: '', final: 'ה' },
  á: { ipa: 'aː', mark: 'ָ', after: 'א', final: '' },
  e: { ipa: 'ɛ', mark: 'ֶ', after: '', final: 'ה' },
  é: { ipa: 'eː', mark: 'ֵ', after: 'י', final: '' },
  i: { ipa: 'i', mark: 'ִ', after: 'י', final: '' },
  í: { ipa: 'iː', mark: 'ִ', after: 'י', final: '' },
  o: { ipa: 'o', mark: '', after: 'וֹ', final: '' },
  ó: { ipa: 'oː', mark: '', after: 'וֹ', final: '' },
  ö: { ipa: 'ø', mark: 'ֶ', after: '', final: 'ה' },
  ő: { ipa: 'øː', mark: 'ֶ', after: '', final: 'ה' },
  u: { ipa: 'u', mark: '', after: 'וּ', final: '' },
  ú: { ipa: 'uː', mark: '', after: 'וּ', final: '' },
  ü: { ipa: 'y', mark: 'ִ', after: 'י', final: '' },
  ű: { ipa: 'yː', mark: 'ִ', after: 'י', final: '' },
};

type Consonant = {
  ipa: string;
  /** Hebrew letters, one unit each; the last one carries the following vowel. */
  hebrew: readonly string[];
};

/** Longest spellings first, so `dzs` wins over `dz` and `sz` over `s`. */
const CONSONANTS: readonly [string, Consonant][] = [
  ['dzs', { ipa: 'dʒ', hebrew: ['ג׳'] }],
  ['cs', { ipa: 'tʃ', hebrew: ['צ׳'] }],
  ['dz', { ipa: 'dz', hebrew: ['ד', 'ז'] }],
  ['gy', { ipa: 'ɟ', hebrew: ['ד', 'י'] }],
  ['ly', { ipa: 'j', hebrew: ['י'] }],
  ['ny', { ipa: 'ɲ', hebrew: ['נ', 'י'] }],
  ['sz', { ipa: 's', hebrew: ['ס'] }],
  ['ty', { ipa: 'c', hebrew: ['ט', 'י'] }],
  ['zs', { ipa: 'ʒ', hebrew: ['ז׳'] }],
  ['b', { ipa: 'b', hebrew: ['ב'] }],
  ['c', { ipa: 'ts', hebrew: ['צ'] }],
  ['d', { ipa: 'd', hebrew: ['ד'] }],
  ['f', { ipa: 'f', hebrew: ['פ'] }],
  ['g', { ipa: 'g', hebrew: ['ג'] }],
  ['h', { ipa: 'h', hebrew: ['ה'] }],
  ['j', { ipa: 'j', hebrew: ['י'] }],
  ['k', { ipa: 'k', hebrew: ['ק'] }],
  ['l', { ipa: 'l', hebrew: ['ל'] }],
  ['m', { ipa: 'm', hebrew: ['מ'] }],
  ['n', { ipa: 'n', hebrew: ['נ'] }],
  ['p', { ipa: 'p', hebrew: ['פ'] }],
  ['q', { ipa: 'k', hebrew: ['ק'] }],
  ['r', { ipa: 'r', hebrew: ['ר'] }],
  ['s', { ipa: 'ʃ', hebrew: ['שׁ'] }],
  ['t', { ipa: 't', hebrew: ['ט'] }],
  ['v', { ipa: 'v', hebrew: ['ו'] }],
  ['w', { ipa: 'v', hebrew: ['ו'] }],
  ['x', { ipa: 'ks', hebrew: ['ק', 'ס'] }],
  ['y', { ipa: 'i', hebrew: ['י'] }],
  ['z', { ipa: 'z', hebrew: ['ז'] }],
];

type Token =
  | { kind: 'vowel'; vowel: Vowel }
  | { kind: 'consonant'; consonant: Consonant; long: boolean }
  | { kind: 'other'; text: string };

/**
 * A doubled consonant is one long sound. For a digraph the spelling doubles
 * only the first letter: `ssz`, `ggy`, `nny`.
 */
function tokenize(word: string): Token[] {
  const text = word.toLowerCase();
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const vowel = VOWELS[text[i]];
    if (vowel) {
      tokens.push({ kind: 'vowel', vowel });
      i += 1;
      continue;
    }
    // `ssz`, `ggy`, `nny`: a long digraph doubles its first letter only, so
    // it has to be recognised before `s` alone would claim the first letter.
    const doubled = CONSONANTS.find(
      ([spelling]) =>
        spelling.length > 1 && text[i] === spelling[0] && text.startsWith(spelling, i + 1)
    );
    if (doubled) {
      tokens.push({ kind: 'consonant', consonant: doubled[1], long: true });
      i += 1 + doubled[0].length;
      continue;
    }
    const match = CONSONANTS.find(([spelling]) => text.startsWith(spelling, i));
    if (match) {
      const [spelling, consonant] = match;
      i += spelling.length;
      let long = false;
      if (text.startsWith(spelling, i)) {
        // `tt`, `ll`: the whole spelling written twice.
        long = true;
        i += spelling.length;
      }
      tokens.push({ kind: 'consonant', consonant, long });
      continue;
    }
    tokens.push({ kind: 'other', text: text[i] });
    i += 1;
  }
  return tokens;
}

/** Split on whitespace, keeping it, so stress and word-final rules apply per word. */
function words(text: string): string[] {
  return text.split(/(\s+)/);
}

/** Exact pronunciation. Stress is always initial in Hungarian, so every word gets it. */
export function toIpa(text: string): string {
  return words(text)
    .map((word) => {
      if (/^\s*$/.test(word)) return word;
      const tokens = tokenize(word);
      let out = '';
      let stressed = false;
      for (const token of tokens) {
        if (token.kind === 'other') {
          out += token.text;
          continue;
        }
        if (!stressed) {
          out += 'ˈ';
          stressed = true;
        }
        if (token.kind === 'vowel') out += token.vowel.ipa;
        else out += token.consonant.ipa + (token.long ? 'ː' : '');
      }
      return out;
    })
    .join('');
}

const FINAL_FORMS: Record<string, string> = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };
const SHVA = 'ְ';

type Unit = { letter: string; mark: string; carrier: boolean; mater: boolean };

/**
 * Hebrew letters with vowel points. A vowel sits on the consonant before it;
 * a vowel with nothing to sit on (word-initial, or after another vowel) gets
 * an alef to carry it. Consonants with no vowel take a shva, except at the end
 * of a word, where they take their final form instead.
 */
export function toHebrew(text: string): string {
  return words(text)
    .map((word) => {
      if (/^\s*$/.test(word)) return word;
      const units: Unit[] = [];
      let out = '';
      let lastVowelAtEnd: Vowel | null = null;

      const flush = () => {
        for (let i = 0; i < units.length; i++) {
          const unit = units[i];
          const last = i === units.length - 1;
          let letter = unit.letter;
          let mark = unit.mark;
          if (!unit.mater && !unit.carrier && mark === '') {
            if (last) letter = finalForm(letter);
            else mark = SHVA;
          }
          out += withMark(letter, mark);
        }
        if (lastVowelAtEnd) out += lastVowelAtEnd.final;
        units.length = 0;
        lastVowelAtEnd = null;
      };

      for (const token of tokenize(word)) {
        if (token.kind === 'other') {
          flush();
          out += token.text;
          continue;
        }
        lastVowelAtEnd = null;
        if (token.kind === 'consonant') {
          for (const letter of token.consonant.hebrew) {
            units.push({ letter, mark: '', carrier: false, mater: false });
          }
          continue;
        }
        const { vowel } = token;
        const carrier = units.at(-1);
        // A consonant with no vowel yet carries it; so does the yod left by a
        // preceding i or é, which is how Hebrew writes `szia` and `fiú`.
        const canCarry =
          carrier &&
          carrier.mark === '' &&
          !carrier.carrier &&
          (!carrier.mater || carrier.letter === 'י');
        if (canCarry) {
          carrier.mark = vowel.mark || ' ';
        } else {
          units.push({ letter: 'א', mark: vowel.mark || ' ', carrier: true, mater: false });
        }
        if (vowel.after) units.push({ letter: vowel.after, mark: '', carrier: false, mater: true });
        lastVowelAtEnd = vowel;
      }
      flush();
      return out;
    })
    .join('');
}

function finalForm(letter: string): string {
  // The geresh of צ׳ follows the letter; swap only the letter.
  const base = letter[0];
  const rest = letter.slice(1);
  return (FINAL_FORMS[base] ?? base) + rest;
}

/** A mark of ' ' means "voweled by a mater, nothing to write". */
function withMark(letter: string, mark: string): string {
  if (mark === '' || mark === ' ') return letter;
  // Points go on the base letter, before any geresh or shin dot that follows.
  return letter[0] + mark + letter.slice(1);
}
