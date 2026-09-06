import { describe, expect, it } from 'vitest';
import { humanizeInterval, humanizeUntil } from './interval';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('humanizeInterval', () => {
  it('describes the rungs of the unknown ladder in minutes', () => {
    expect(humanizeInterval(MINUTE)).toEqual({ value: 1, unit: 'minute' });
    expect(humanizeInterval(10 * MINUTE)).toEqual({ value: 10, unit: 'minute' });
  });

  it('describes the learning ladder in hours', () => {
    expect(humanizeInterval(HOUR)).toEqual({ value: 1, unit: 'hour' });
    expect(humanizeInterval(6 * HOUR)).toEqual({ value: 6, unit: 'hour' });
  });

  it('describes the known ladder in the coarsest honest unit', () => {
    expect(humanizeInterval(DAY)).toEqual({ value: 1, unit: 'day' });
    expect(humanizeInterval(3 * DAY)).toEqual({ value: 3, unit: 'day' });
    expect(humanizeInterval(7 * DAY)).toEqual({ value: 1, unit: 'week' });
    expect(humanizeInterval(14 * DAY)).toEqual({ value: 2, unit: 'week' });
    expect(humanizeInterval(30 * DAY)).toEqual({ value: 1, unit: 'month' });
    expect(humanizeInterval(90 * DAY)).toEqual({ value: 3, unit: 'month' });
  });

  it('never says zero', () => {
    expect(humanizeInterval(0)).toEqual({ value: 1, unit: 'minute' });
    expect(humanizeInterval(-5000)).toEqual({ value: 1, unit: 'minute' });
  });

  it('works from an absolute timestamp', () => {
    const now = 1_700_000_000_000;
    expect(humanizeUntil(now + 3 * DAY, now)).toEqual({ value: 3, unit: 'day' });
  });
});
