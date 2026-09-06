import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { level: { findMany: vi.fn() } },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from './route';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/vocabulary', () => {
  it('returns 400 when the pair query parameter is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/vocabulary'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Missing pair parameter' });
    expect(prismaMock.level.findMany).not.toHaveBeenCalled();
  });

  it('queries levels for the pair and maps DB columns to the client shape', async () => {
    prismaMock.level.findMany.mockResolvedValue([
      {
        id: 'A1',
        name: 'A1 - Kezdő',
        nameHe: 'A1 - מתחילים',
        sourceLang: 'hu',
        targetLang: 'he',
        pairId: 'hu-he',
        topics: [
          {
            id: 'a1-greetings',
            levelId: 'A1',
            name: 'Köszönések',
            nameHe: 'ברכות',
            words: [
              { id: 'a1-g-1', topicId: 'a1-greetings', sourceText: 'igen', targetText: 'כן' },
            ],
          },
        ],
      },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/vocabulary?pair=hu-he'));

    expect(res.status).toBe(200);
    expect(prismaMock.level.findMany).toHaveBeenCalledWith({
      where: { pairId: 'hu-he' },
      include: { topics: { include: { words: true } } },
    });
    expect(await res.json()).toEqual([
      {
        id: 'A1',
        name: 'A1 - Kezdő',
        nameHe: 'A1 - מתחילים',
        sourceLang: 'hu',
        targetLang: 'he',
        pairId: 'hu-he',
        topics: [
          {
            id: 'a1-greetings',
            levelId: 'A1',
            name: 'Köszönések',
            nameHe: 'ברכות',
            words: [{ id: 'a1-g-1', topicId: 'a1-greetings', hungarian: 'igen', hebrew: 'כן' }],
          },
        ],
      },
    ]);
  });

  it('returns an empty list for an unknown pair', async () => {
    prismaMock.level.findMany.mockResolvedValue([]);
    const res = await GET(new NextRequest('http://localhost/api/vocabulary?pair=xx-yy'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
