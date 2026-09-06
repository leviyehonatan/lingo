import { describe, expect, it } from 'vitest';
import { RECALL_WINDOW_MS, secondsLeft, windowState } from './recall-window';

const NOW = 1_700_000_000_000;

describe('windowState', () => {
  it('is idle before the clock starts', () => {
    expect(windowState(null, NOW)).toEqual({
      remainingMs: RECALL_WINDOW_MS,
      expired: false,
      visible: false,
      fraction: 1,
    });
  });

  it('stays out of the way while there is plenty of time', () => {
    expect(windowState(NOW, NOW + 1000).visible).toBe(false);
  });

  it('appears as the time gets short', () => {
    expect(windowState(NOW, NOW + 5000).visible).toBe(true);
  });

  it('expires exactly once the window has passed', () => {
    expect(windowState(NOW, NOW + RECALL_WINDOW_MS - 1).expired).toBe(false);
    expect(windowState(NOW, NOW + RECALL_WINDOW_MS).expired).toBe(true);
  });

  it('never counts below zero, however late the learner is', () => {
    const late = windowState(NOW, NOW + 10 * RECALL_WINDOW_MS);
    expect(late.remainingMs).toBe(0);
    expect(late.fraction).toBe(0);
  });

  it('honours a different window', () => {
    expect(windowState(NOW, NOW + 4000, 5000).remainingMs).toBe(1000);
  });
});

describe('secondsLeft', () => {
  it('rounds up, so the last second is shown as one and not zero', () => {
    expect(secondsLeft(windowState(NOW, NOW + 8200))).toBe(2);
    expect(secondsLeft(windowState(NOW, NOW + 9999))).toBe(1);
    expect(secondsLeft(windowState(NOW, NOW + RECALL_WINDOW_MS))).toBe(0);
  });
});
