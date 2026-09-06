import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const prisma = {
  wordProgress: { findUnique: vi.fn(), upsert: vi.fn() },
  reviewEvent: { create: vi.fn() },
  // The route writes the state and the log together; the mock just collects
  // whatever operations it was handed.
  $transaction: vi.fn(async (ops: unknown[]) => ops),
};

vi.mock('@/lib/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/prisma', () => ({ prisma }));

const { PUT } = await import('./route');

const USER = { user: { id: 'user-1' } };
const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function request(body: unknown, raw?: string) {
  return new Request('http://localhost/api/progress/w1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

const ctx = (wordId = 'w1') => ({ params: Promise.resolve({ wordId }) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const put = (body: unknown, wordId?: string) => PUT(request(body), ctx(wordId) as any);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  auth.mockResolvedValue(USER);
  prisma.wordProgress.findUnique.mockResolvedValue(null);
  prisma.wordProgress.upsert.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PUT /api/progress/[wordId]', () => {
  it('rejects an anonymous request', async () => {
    auth.mockResolvedValue(null);
    expect((await put({ status: 'known' })).status).toBe(401);
    expect(prisma.wordProgress.upsert).not.toHaveBeenCalled();
  });

  it('rejects an unrecognised status', async () => {
    const res = await put({ status: 'mastered' });
    expect(res.status).toBe(400);
    expect(prisma.wordProgress.upsert).not.toHaveBeenCalled();
  });

  it('rejects a body with no status at all', async () => {
    expect((await put({})).status).toBe(400);
  });

  it('rejects a malformed body instead of throwing', async () => {
    const res = await PUT(
      request(null, 'not json'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx() as any
    );
    expect(res.status).toBe(400);
  });

  it('answers with the computed next review, not with anything the client sent', async () => {
    const res = await put({ status: 'known', nextReview: 42 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nextReview: NOW + DAY, intervalMs: DAY });
  });

  it('stores the first review with a count of one and the server clock', async () => {
    await put({ status: 'known' });

    expect(prisma.wordProgress.upsert).toHaveBeenCalledWith({
      where: { wordId_userId: { wordId: 'w1', userId: 'user-1' } },
      update: {
        status: 'known',
        reviewCount: 1,
        seenCount: 1,
        lapses: 0,
        streak: 1,
        previousStreak: 0,
        lastReviewed: BigInt(NOW),
        nextReview: BigInt(NOW + DAY),
      },
      create: {
        wordId: 'w1',
        userId: 'user-1',
        status: 'known',
        reviewCount: 1,
        seenCount: 1,
        lapses: 0,
        streak: 1,
        previousStreak: 0,
        lastReviewed: BigInt(NOW),
        nextReview: BigInt(NOW + DAY),
      },
    });
  });

  it('advances the ladder on a repeat review', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({ reviewCount: 1, streak: 1 });

    const res = await put({ status: 'known' });

    expect(await res.json()).toEqual({
      nextReview: NOW + 3 * DAY,
      intervalMs: 3 * DAY,
    });
    expect(prisma.wordProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ reviewCount: 2 }) })
    );
  });

  it('schedules an unknown word for another try within the session', async () => {
    const res = await put({ status: 'unknown' });
    const { nextReview } = await res.json();
    expect(nextReview).toBeGreaterThan(NOW);
    expect(nextReview).toBeLessThan(NOW + 60 * 60 * 1000);
  });

  it('scopes the lookup to the signed-in user and the routed word', async () => {
    await put({ status: 'learning' }, 'a1-colors-3');
    expect(prisma.wordProgress.findUnique).toHaveBeenCalledWith({
      where: { wordId_userId: { wordId: 'a1-colors-3', userId: 'user-1' } },
      select: {
        reviewCount: true,
        seenCount: true,
        lapses: true,
        status: true,
        streak: true,
        previousStreak: true,
      },
    });
  });
});

describe('PUT /api/progress/[wordId] corrections', () => {
  it('re-grades the review just recorded instead of counting another', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({ reviewCount: 1, streak: 1 });
    const res = await put({ status: 'known', correction: true });
    expect(res.status).toBe(200);

    const write = prisma.wordProgress.upsert.mock.calls[0][0];
    // Still one review, so the word stays on the first rung of the known ladder.
    expect(write.update.reviewCount).toBe(1);
    expect((await res.json()).nextReview).toBe(NOW + DAY);
  });

  it('counts a correction on an unreviewed word as its first review', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue(null);
    const res = await put({ status: 'known', correction: true });
    expect(res.status).toBe(200);
    expect(prisma.wordProgress.upsert.mock.calls[0][0].create.reviewCount).toBe(1);
  });

  it('still advances the ladder for a review that is not a correction', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({ reviewCount: 1, streak: 1 });
    await put({ status: 'known' });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.reviewCount).toBe(2);
  });

  it('ignores a correction flag that is not exactly true', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({ reviewCount: 1, streak: 1 });
    await put({ status: 'known', correction: 'yes' });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.reviewCount).toBe(2);
  });
});

describe('PUT /api/progress/[wordId] telemetry', () => {
  const telemetry = {
    direction: 'forward',
    mode: 'review',
    source: 'speech',
    latencyMs: 4200,
    spokenAttempts: 2,
  };

  it('logs how the answer arrived alongside the state it produced', async () => {
    await put({ status: 'known', ...telemetry });

    expect(prisma.reviewEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        wordId: 'w1',
        direction: 'forward',
        mode: 'review',
        source: 'speech',
        status: 'known',
        corrected: false,
        latencyMs: 4200,
        spokenAttempts: 2,
        reviewedAt: BigInt(NOW),
      },
    });
    // Written together, so the log and the state cannot disagree.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('records a review with no telemetry rather than refusing it', async () => {
    const res = await put({ status: 'known' });
    expect(res.status).toBe(200);
    expect(prisma.reviewEvent.create).not.toHaveBeenCalled();
    expect(prisma.wordProgress.upsert).toHaveBeenCalled();
  });

  it('drops telemetry it does not recognise, and still records the review', async () => {
    const res = await put({ status: 'known', ...telemetry, direction: 'sideways' });
    expect(res.status).toBe(200);
    expect(prisma.reviewEvent.create).not.toHaveBeenCalled();
    expect(prisma.wordProgress.upsert).toHaveBeenCalled();
  });

  it('counts a sighting for every showing, and none for a correction', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 2,
      seenCount: 3,
      lapses: 0,
      status: 'known',
    });

    await put({ status: 'known', ...telemetry });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.seenCount).toBe(4);

    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 2,
      seenCount: 3,
      lapses: 0,
      status: 'known',
    });
    await put({ status: 'unknown', correction: true, ...telemetry });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.seenCount).toBe(3);
    expect(prisma.reviewEvent.create.mock.calls[0][0].data.corrected).toBe(true);
  });

  it('counts a lapse when a known word comes back unknown', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 4,
      seenCount: 4,
      lapses: 1,
      status: 'known',
    });

    await put({ status: 'unknown', ...telemetry });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.lapses).toBe(2);
  });

  it('does not count a lapse for a word that was never known', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 1,
      seenCount: 1,
      lapses: 0,
      status: 'learning',
    });

    await put({ status: 'unknown', ...telemetry });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.lapses).toBe(0);
  });
});

describe('PUT /api/progress/[wordId] streaks', () => {
  it('sends a forgotten word back to the bottom of its ladder', async () => {
    // Long history, high up the ladder, and then forgotten.
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 9,
      seenCount: 9,
      lapses: 0,
      status: 'known',
      streak: 5,
      previousStreak: 4,
    });

    await put({ status: 'unknown' });
    const write = prisma.wordProgress.upsert.mock.calls[0][0];
    expect(write.update.streak).toBe(0);
    // The shortest rung, not the one nine reviews would once have bought.
    expect(Number(write.update.nextReview) - NOW).toBe(60_000);
  });

  it('climbs again from the bottom after the miss', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 10,
      seenCount: 10,
      lapses: 1,
      status: 'unknown',
      streak: 0,
      previousStreak: 4,
    });

    const res = await put({ status: 'known' });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.streak).toBe(1);
    expect(await res.json()).toEqual({ nextReview: NOW + DAY, intervalMs: DAY });
  });

  it('holds position for a half recall', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 4,
      seenCount: 4,
      lapses: 0,
      status: 'known',
      streak: 3,
      previousStreak: 2,
    });

    await put({ status: 'learning' });
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.streak).toBe(3);
  });

  it('does not let a correction count as another success', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 3,
      seenCount: 3,
      lapses: 0,
      status: 'known',
      streak: 3,
      previousStreak: 2,
    });

    await put({ status: 'known', correction: true });
    // The answer being corrected already earned its place in the run.
    expect(prisma.wordProgress.upsert.mock.calls[0][0].update.streak).toBe(3);
  });

  it('rebuilds the run a miss destroyed, when that miss is overturned', async () => {
    // Answered wrong a moment ago: the streak was reset, but the run before it
    // is remembered, and the correction is applied to that.
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 2,
      seenCount: 2,
      lapses: 1,
      status: 'unknown',
      streak: 0,
      previousStreak: 1,
    });

    const res = await put({ status: 'known', correction: true });
    const write = prisma.wordProgress.upsert.mock.calls[0][0];
    expect(write.update.streak).toBe(2);
    // Rung two of the known ladder, shortened because the word has lapsed once.
    const { nextReview } = await res.json();
    expect(nextReview - NOW).toBe(Math.round(3 * DAY * 0.75));
  });
});

describe('PUT /api/progress/[wordId] adapts to what the log knows', () => {
  const telemetry = { direction: 'forward', mode: 'review', source: 'speech' };

  it('brings a repeatedly forgotten word back sooner than its rung says', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 6,
      seenCount: 6,
      lapses: 2,
      status: 'learning',
      streak: 2,
      previousStreak: 1,
    });

    const res = await put({ status: 'known', ...telemetry, latencyMs: 6000 });
    const { nextReview } = await res.json();
    // Three recalls in a row reaches rung three, a week; two lapses cut it back
    // towards the rung below.
    expect(nextReview - NOW).toBeLessThan(7 * DAY);
    expect(nextReview - NOW).toBeGreaterThan(3 * DAY);
  });

  it('waits longer when the answer came instantly', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 2,
      seenCount: 2,
      lapses: 0,
      status: 'known',
      streak: 1,
      previousStreak: 0,
    });

    const res = await put({ status: 'known', ...telemetry, latencyMs: 700 });
    const { nextReview } = await res.json();
    expect(nextReview - NOW).toBeGreaterThan(3 * DAY);
  });

  it('reads nothing into speed when the learner did not recall it', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 2,
      seenCount: 2,
      lapses: 0,
      status: 'known',
      streak: 1,
      previousStreak: 0,
    });

    const res = await put({ status: 'unknown', ...telemetry, latencyMs: 300 });
    const { nextReview } = await res.json();
    expect(nextReview - NOW).toBe(60_000);
  });

  it('schedules a review with no telemetry from the ladder alone', async () => {
    prisma.wordProgress.findUnique.mockResolvedValue({
      reviewCount: 1,
      seenCount: 1,
      lapses: 0,
      status: 'known',
      streak: 1,
      previousStreak: 0,
    });

    const res = await put({ status: 'known' });
    expect((await res.json()).nextReview - NOW).toBe(3 * DAY);
  });
});

describe('PUT /api/progress/[wordId] reports the wait it chose', () => {
  it('answers with the delay as well as the moment', async () => {
    const res = await put({ status: 'known' });
    const body = await res.json();

    // The browser's clock may be well off the server's, so the delay is not
    // something the client should be working out for itself.
    expect(body.intervalMs).toBe(DAY);
    expect(body.nextReview - body.intervalMs).toBe(NOW);
  });
});
