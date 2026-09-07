import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { summarize, type ReviewRecord, type WordStanding } from '@/lib/stats';
import { readStatus } from '@/lib/progress';

export const runtime = 'nodejs';

/** How far back the numbers look, so they describe now rather than ever. */
const WINDOW_DAYS = 30;

/**
 * `GET /api/stats` — how the learner is doing, rather than where each word is.
 *
 * Reads the review log, so it can say things a status column cannot: how often
 * answers are landing, how long they take, and how many words keep slipping
 * back after being known.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const since = BigInt(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [rows, events] = await Promise.all([
    prisma.wordProgress.findMany({
      where: { userId },
      select: { status: true, seenCount: true, lapses: true },
    }),
    prisma.reviewEvent.findMany({
      where: { userId, reviewedAt: { gte: since } },
      select: {
        status: true,
        mode: true,
        source: true,
        corrected: true,
        latencyMs: true,
        reviewedAt: true,
      },
    }),
  ]);

  const standings: WordStanding[] = rows.map((row) => ({
    status: readStatus(row.status),
    seenCount: row.seenCount,
    lapses: row.lapses,
  }));

  const records: ReviewRecord[] = events.map((event) => ({
    status: readStatus(event.status),
    mode: event.mode === 'teach' ? 'teach' : 'review',
    source: event.source,
    corrected: event.corrected,
    latencyMs: event.latencyMs,
    reviewedAt: Number(event.reviewedAt),
  }));

  return NextResponse.json(summarize(standings, records, Date.now(), WINDOW_DAYS));
}
