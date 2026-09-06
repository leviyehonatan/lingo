import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const prisma = { dailyRecord: { upsert: vi.fn() } };

vi.mock('@/lib/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/prisma', () => ({ prisma }));

const { POST } = await import('./route');

const USER = { user: { id: 'user-1' } };
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);

function post(body: unknown, raw?: string) {
  const req = new Request('http://localhost/api/progress/daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST(req as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  auth.mockResolvedValue(USER);
  prisma.dailyRecord.upsert.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/progress/daily', () => {
  it('rejects an anonymous request', async () => {
    auth.mockResolvedValue(null);
    expect((await post({ count: 1 })).status).toBe(401);
    expect(prisma.dailyRecord.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing count', {}],
    ['a string count', { count: '3' }],
    ['a fractional count', { count: 1.5 }],
    ['zero', { count: 0 }],
    ['a negative count', { count: -4 }],
  ])('rejects %s', async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(prisma.dailyRecord.upsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed body instead of throwing', async () => {
    expect((await post(null, '{')).status).toBe(400);
  });

  it("increments today's row and returns the running total", async () => {
    prisma.dailyRecord.upsert.mockResolvedValue({ count: 8 });

    const res = await post({ count: 1 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 8 });
    expect(prisma.dailyRecord.upsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: 'user-1', date: '2026-09-06' } },
      update: { count: { increment: 1 } },
      create: { userId: 'user-1', date: '2026-09-06', count: 1 },
    });
  });

  it('treats the body count as a delta, not a total', async () => {
    await post({ count: 5 });
    expect(prisma.dailyRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { count: { increment: 5 } } })
    );
  });
});
