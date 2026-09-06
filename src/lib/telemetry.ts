/**
 * What a review records about itself, beyond the grade.
 *
 * A schedule can only be as good as what it knows. Status alone cannot say
 * whether a word is getting easier, whether the learner hesitated, or how it
 * was answered, so every answered card reports these and the server keeps them.
 */

export const DIRECTIONS = ['forward', 'reverse'] as const;
export type ReviewDirection = (typeof DIRECTIONS)[number];

export const CARD_MODES = ['teach', 'review'] as const;
export type ReviewMode = (typeof CARD_MODES)[number];

/**
 * How the answer arrived. `reveal` is the learner asking for the answer, which
 * is an admission rather than a recall, and worth telling apart from the rest.
 */
export const REVIEW_SOURCES = ['speech', 'buttons', 'quiz', 'writing', 'reveal'] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export interface ReviewTelemetry {
  direction: ReviewDirection;
  mode: ReviewMode;
  source: ReviewSource;
  /** Time from the card appearing to the answer. Omitted if unmeasurable. */
  latencyMs?: number;
  /** How many times the learner spoke on this card before it was settled. */
  spokenAttempts?: number;
}

/** An hour. Anything longer is a learner who walked away, not a slow answer. */
const MAX_LATENCY_MS = 60 * 60 * 1000;

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/**
 * Read telemetry off a request body, keeping only what is well formed.
 *
 * Nothing here is load-bearing for the schedule, so a malformed field is
 * dropped rather than failing the review the learner just did.
 */
export function parseTelemetry(body: unknown): ReviewTelemetry | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;
  if (
    !isOneOf(DIRECTIONS, raw.direction) ||
    !isOneOf(CARD_MODES, raw.mode) ||
    !isOneOf(REVIEW_SOURCES, raw.source)
  ) {
    return null;
  }

  const telemetry: ReviewTelemetry = {
    direction: raw.direction,
    mode: raw.mode,
    source: raw.source,
  };

  const latency = raw.latencyMs;
  if (typeof latency === 'number' && Number.isFinite(latency) && latency >= 0) {
    telemetry.latencyMs = Math.min(Math.round(latency), MAX_LATENCY_MS);
  }

  const spoken = raw.spokenAttempts;
  if (typeof spoken === 'number' && Number.isFinite(spoken) && spoken >= 0) {
    telemetry.spokenAttempts = Math.min(Math.round(spoken), 100);
  }

  return telemetry;
}

/**
 * A word the learner had known coming back unknown. Worth counting separately:
 * it is the signal that a word is not sticking, which the current status hides
 * as soon as the next answer overwrites it.
 */
export function isLapse(previous: string | undefined, next: string): boolean {
  return previous === 'known' && next === 'unknown';
}
