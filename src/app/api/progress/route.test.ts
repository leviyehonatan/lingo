import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const prisma = {
  wordProgress: { findMany: vi.fn(), deleteMany: vi.fn() },
  reviewEvent: { deleteMany: vi.fn() },
  dailyRecord: { findMany: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('@/lib/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/prisma', () => ({ prisma }));

const { GET, DELETE } = await import('./route');

const USER = { user: { id: 'user-1' } };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockResolvedValue([]);
});

describe('GET /api/progress', () => {
  it('rejects an anonymous request', async () => {
    auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(prisma.wordProgress.findMany).not.toHaveBeenCalled();
  });

  it('returns snake_case entries with numeric timestamps and the daily counts', async () => {
    auth.mockResolvedValue(USER);
    prisma.wordProgress.findMany.mockResolvedValue([
      {
        wordId: 'a1-greet-1',
        userId: 'user-1',
        status: 'known',
        lastReviewed: BigInt('1700000000000'),
        reviewCount: 2,
        nextReview: BigInt('1700259200000'),
      },
    ]);
    prisma.dailyRecord.findMany.mockResolvedValue([{ date: '2026-09-06', count: 7 }]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      progress: [
        {
          word_id: 'a1-greet-1',
          status: 'known',
          last_reviewed: 1_700_000_000_000,
          review_count: 2,
          next_review: 1_700_259_200_000,
        },
      ],
      daily: [{ date: '2026-09-06', count: 7 }],
    });
  });

  it('returns empty collections rather than null for a new user', async () => {
    auth.mockResolvedValue(USER);
    prisma.wordProgress.findMany.mockResolvedValue([]);
    prisma.dailyRecord.findMany.mockResolvedValue([]);

    expect(await (await GET()).json()).toEqual({ progress: [], daily: [] });
  });

  it('only reads the signed-in user rows', async () => {
    auth.mockResolvedValue(USER);
    prisma.wordProgress.findMany.mockResolvedValue([]);
    prisma.dailyRecord.findMany.mockResolvedValue([]);

    await GET();
    expect(prisma.wordProgress.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.dailyRecord.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { date: 'asc' },
    });
  });
});

describe('DELETE /api/progress', () => {
  it('rejects an anonymous request', async () => {
    auth.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('clears reviews and daily counters together', async () => {
    auth.mockResolvedValue(USER);
    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(prisma.wordProgress.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.dailyRecord.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe('DELETE /api/progress clears the history too', () => {
  it('drops the review log alongside the schedule', async () => {
    auth.mockResolvedValue(USER);
    await DELETE();

    // Resetting progress must not leave a learner's old answers behind to
    // keep showing up in their statistics.
    expect(prisma.reviewEvent.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
