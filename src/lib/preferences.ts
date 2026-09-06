/**
 * How the learner wants the session to behave, remembered per browser.
 *
 * Rosetta Stone has a precision slider and a switch that turns speaking off;
 * Duolingo lets a learner put speaking aside for a while. Both are the same
 * admission: whether you can speak, and how forgiving the grader should be, are
 * the learner's business and not the app's.
 */

import { DEFAULT_THRESHOLD } from './answer-match';

export const STRICTNESS_LEVELS = ['easy', 'normal', 'strict'] as const;
export type Strictness = (typeof STRICTNESS_LEVELS)[number];

/**
 * What each setting means to the grader. Forgiving is not sloppy: it still
 * demands the whole answer, only with more room for a mangled ending.
 */
export const STRICTNESS_THRESHOLD: Record<Strictness, number> = {
  easy: 0.65,
  normal: DEFAULT_THRESHOLD,
  strict: 0.95,
};

export interface Preferences {
  handsFree: boolean;
  /** True when the learner has said they cannot speak at the moment. */
  silent: boolean;
  strictness: Strictness;
  /** Words in one sitting. */
  sessionSize: number;
  /** New words one sitting may introduce. */
  newPerSession: number;
}

export const SESSION_SIZES = [5, 10, 20, 40] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  handsFree: false,
  silent: false,
  strictness: 'normal',
  sessionSize: 20,
  newPerSession: 5,
};

const KEY = 'lingo-preferences';

function isStrictness(value: unknown): value is Strictness {
  return typeof value === 'string' && (STRICTNESS_LEVELS as readonly string[]).includes(value);
}

/**
 * Read what was stored, keeping only fields that still make sense. Anything
 * missing or malformed falls back to the default rather than failing: these are
 * conveniences, and a broken one must not stop somebody studying.
 */
export function parsePreferences(raw: unknown): Preferences {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_PREFERENCES;
  const stored = raw as Record<string, unknown>;
  const size = Number(stored.sessionSize);
  const fresh = Number(stored.newPerSession);
  return {
    handsFree: stored.handsFree === true,
    silent: stored.silent === true,
    strictness: isStrictness(stored.strictness) ? stored.strictness : DEFAULT_PREFERENCES.strictness,
    sessionSize: (SESSION_SIZES as readonly number[]).includes(size)
      ? size
      : DEFAULT_PREFERENCES.sessionSize,
    newPerSession:
      Number.isFinite(fresh) && fresh >= 0 && fresh <= 20
        ? Math.round(fresh)
        : DEFAULT_PREFERENCES.newPerSession,
  };
}

export function readPreferences(): Preferences {
  try {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    const stored = localStorage.getItem(KEY);
    return stored ? parsePreferences(JSON.parse(stored)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {}
}
