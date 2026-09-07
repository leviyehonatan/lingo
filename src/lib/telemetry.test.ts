import { describe, expect, it } from 'vitest';
import { isLapse, parseTelemetry } from './telemetry';

const valid = { direction: 'forward', mode: 'review', source: 'speech' };

describe('parseTelemetry', () => {
  it('keeps a well-formed report', () => {
    expect(parseTelemetry({ ...valid, latencyMs: 2500, spokenAttempts: 2 })).toEqual({
      direction: 'forward',
      mode: 'review',
      source: 'speech',
      latencyMs: 2500,
      spokenAttempts: 2,
    });
  });

  it('accepts a report with only the required fields', () => {
    expect(parseTelemetry(valid)).toEqual(valid);
  });

  it('rejects unknown values rather than storing them', () => {
    expect(parseTelemetry({ ...valid, direction: 'sideways' })).toBeNull();
    expect(parseTelemetry({ ...valid, mode: 'guess' })).toBeNull();
    expect(parseTelemetry({ ...valid, source: 'telepathy' })).toBeNull();
    expect(parseTelemetry(null)).toBeNull();
    expect(parseTelemetry('forward')).toBeNull();
  });

  it('drops a malformed timing instead of failing the review', () => {
    expect(parseTelemetry({ ...valid, latencyMs: -5 })?.latencyMs).toBeUndefined();
    expect(parseTelemetry({ ...valid, latencyMs: 'slow' })?.latencyMs).toBeUndefined();
    expect(parseTelemetry({ ...valid, latencyMs: NaN })?.latencyMs).toBeUndefined();
  });

  it('caps a timing from a learner who walked away', () => {
    expect(parseTelemetry({ ...valid, latencyMs: 9_999_999 })?.latencyMs).toBe(3_600_000);
  });

  it('rounds a fractional timing', () => {
    expect(parseTelemetry({ ...valid, latencyMs: 1234.6 })?.latencyMs).toBe(1235);
  });

  it('caps the number of spoken attempts', () => {
    expect(parseTelemetry({ ...valid, spokenAttempts: 5000 })?.spokenAttempts).toBe(100);
  });
});

describe('isLapse', () => {
  it('counts a known word coming back unknown', () => {
    expect(isLapse('known', 'unknown')).toBe(true);
  });

  it('does not count a word that was never known', () => {
    // A stored middle grade from before D20 was never a recall.
    expect(isLapse('learning', 'unknown')).toBe(false);
    expect(isLapse(undefined, 'unknown')).toBe(false);
  });

  it('does not count a word that stayed known or improved', () => {
    expect(isLapse('known', 'known')).toBe(false);
    expect(isLapse('unknown', 'known')).toBe(false);
  });
});
