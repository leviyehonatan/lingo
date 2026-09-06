import { describe, expect, it } from 'vitest';
import {
  editDistance,
  expectedVariants,
  matchesAnyAlternative,
  matchesExpected,
  normalize,
  similarity,
} from './answer-match';

describe('normalize', () => {
  it('folds case and collapses whitespace', () => {
    expect(normalize('  Jó   Napot ')).toBe('jó napot');
  });

  it('drops punctuation that speech engines add', () => {
    expect(normalize('Nem értem.')).toBe('nem értem');
    expect(normalize('hogy vagy?')).toBe('hogy vagy');
  });

  it('keeps Hungarian diacritics, which distinguish words', () => {
    expect(normalize('húsz')).toBe('húsz');
    expect(normalize('húsz')).not.toBe(normalize('husz'));
  });

  it('strips Hebrew vowel points, which speech engines never emit', () => {
    expect(normalize('שָׁלוֹם')).toBe('שלום');
  });

  it('treats a hyphen as a word break', () => {
    expect(normalize('jó-napot')).toBe('jó napot');
  });

  it('returns an empty string for punctuation alone', () => {
    expect(normalize('  ?! ')).toBe('');
  });
});

describe('expectedVariants', () => {
  it('accepts either side of a slash', () => {
    expect(expectedVariants('בשמחה / על לא דבר')).toEqual(['בשמחה', 'על לא דבר']);
  });

  it('accepts a word with or without its sense qualifier', () => {
    expect(expectedVariants('שלום (לא רשמי)')).toEqual(['שלום לא רשמי', 'שלום']);
  });

  it('returns one variant for a plain word', () => {
    expect(expectedVariants('köszönöm')).toEqual(['köszönöm']);
  });
});

describe('editDistance and similarity', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('alma', 'alma')).toBe(0);
    expect(similarity('alma', 'alma')).toBe(1);
  });

  it('counts single edits', () => {
    expect(editDistance('alma', 'elma')).toBe(1);
    expect(editDistance('alma', 'almaa')).toBe(1);
    expect(editDistance('alma', 'ala')).toBe(1);
  });

  it('is symmetric and handles empty input', () => {
    expect(editDistance('', 'alma')).toBe(4);
    expect(similarity('', '')).toBe(1);
  });
});

describe('matchesExpected', () => {
  it('accepts the exact answer', () => {
    expect(matchesExpected('köszönöm', 'köszönöm')).toBe(true);
  });

  it('accepts an answer whose only difference is punctuation or case', () => {
    expect(matchesExpected('Nem értem!', 'nem értem')).toBe(true);
  });

  it('rejects a fragment of the answer', () => {
    // The bug this module exists to fix: "a" used to score "alma" correct.
    expect(matchesExpected('a', 'alma')).toBe(false);
    expect(matchesExpected('kö', 'köszönöm')).toBe(false);
  });

  it('rejects an empty or silent transcript', () => {
    expect(matchesExpected('', 'alma')).toBe(false);
    expect(matchesExpected('   ', 'alma')).toBe(false);
  });

  it('accepts the answer spoken with filler around it', () => {
    expect(matchesExpected('azt hiszem jó napot', 'jó napot')).toBe(true);
  });

  it('does not accept filler that merely contains the letters', () => {
    expect(matchesExpected('jonapotkivanok', 'jó napot')).toBe(false);
  });

  it('forgives one dropped diacritic in a longer word', () => {
    expect(matchesExpected('koszonom', 'köszönöm')).toBe(false);
    expect(matchesExpected('köszonöm', 'köszönöm')).toBe(true);
  });

  it('demands an exact match for a short word', () => {
    // Hungarian numbers differ by one letter, so near misses are other words.
    expect(matchesExpected('hat', 'hét')).toBe(false);
    expect(matchesExpected('két', 'hét')).toBe(false);
    expect(matchesExpected('husz', 'húsz')).toBe(false);
  });

  it('never confuses two different Hebrew answers', () => {
    expect(matchesExpected('לא', 'כן')).toBe(false);
    expect(matchesExpected('כאן', 'כן')).toBe(false);
  });

  it('accepts either alternative of a slashed answer', () => {
    expect(matchesExpected('בשמחה', 'בשמחה / על לא דבר')).toBe(true);
    expect(matchesExpected('על לא דבר', 'בשמחה / על לא דבר')).toBe(true);
  });

  it('accepts a qualified answer with or without the qualifier', () => {
    expect(matchesExpected('שלום', 'שלום (לא רשמי)')).toBe(true);
    expect(matchesExpected('שלום לא רשמי', 'שלום (לא רשמי)')).toBe(true);
  });

  it('honours a stricter threshold', () => {
    expect(matchesExpected('köszonöm', 'köszönöm', 1)).toBe(false);
  });
});

describe('matchesAnyAlternative', () => {
  it('accepts the answer when it is not the first candidate', () => {
    expect(matchesAnyAlternative(['kis onon', 'köszönöm'], 'köszönöm')).toBe(true);
  });

  it('rejects when no candidate is the answer', () => {
    expect(matchesAnyAlternative(['kis onon', 'nem'], 'köszönöm')).toBe(false);
  });

  it('rejects an empty candidate list', () => {
    expect(matchesAnyAlternative([], 'köszönöm')).toBe(false);
  });
});
