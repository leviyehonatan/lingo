import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  STRICTNESS_THRESHOLD,
  parsePreferences,
} from './preferences';

describe('parsePreferences', () => {
  it('reads a stored set back', () => {
    expect(
      parsePreferences({
        handsFree: true,
        silent: true,
        strictness: 'strict',
        sessionSize: 10,
        newPerSession: 3,
        speechRate: 0.6,
      })
    ).toEqual({
      handsFree: true,
      silent: true,
      strictness: 'strict',
      sessionSize: 10,
      newPerSession: 3,
      speechRate: 0.6,
    });
  });

  it('falls back to the defaults for anything missing', () => {
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('handsFree')).toEqual(DEFAULT_PREFERENCES);
  });

  it('refuses a session size that is not on offer', () => {
    expect(parsePreferences({ sessionSize: 137 }).sessionSize).toBe(
      DEFAULT_PREFERENCES.sessionSize
    );
  });

  it('refuses a strictness it does not recognise', () => {
    expect(parsePreferences({ strictness: 'brutal' }).strictness).toBe('normal');
  });

  it('bounds how many new words a sitting may introduce', () => {
    expect(parsePreferences({ newPerSession: -1 }).newPerSession).toBe(5);
    expect(parsePreferences({ newPerSession: 999 }).newPerSession).toBe(5);
    expect(parsePreferences({ newPerSession: 0 }).newPerSession).toBe(0);
  });
});

describe('strictness', () => {
  it('is ordered, so forgiving really is more forgiving', () => {
    expect(STRICTNESS_THRESHOLD.easy).toBeLessThan(STRICTNESS_THRESHOLD.normal);
    expect(STRICTNESS_THRESHOLD.normal).toBeLessThan(STRICTNESS_THRESHOLD.strict);
  });
});

describe('speech rate', () => {
  it('refuses a rate that is not on offer', () => {
    expect(parsePreferences({ speechRate: 3 }).speechRate).toBe(
      DEFAULT_PREFERENCES.speechRate
    );
  });
});
