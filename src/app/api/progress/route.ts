import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import type { ProgressData } from '@/lib/api-types';
import type { WordStatus } from '@/lib/progress';

export const runtime = 'nodejs';

/**
 * `GET /api/progress` — everything the study page needs to restore a session:
 * one entry per reviewed word plus the daily counters. Timestamps are numbers
 * (the DB stores them as BigInt) and fields are snake_case, matching
 * `ProgressData` in `src/lib/api-types.ts`.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [progress, daily] = await Promise.all([
    prisma.wordProgress.findMany({ where: { userId: session.user.id } }),
    prisma.dailyRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'asc' },
    }),
  ]);

  const body: ProgressData = {
    progress: progress.map((p) => ({
      word_id: p.wordId,
      status: p.status as WordStatus,
      last_reviewed: Number(p.lastReviewed),
      review_count: p.reviewCount,
      next_review: Number(p.nextReview),
    })),
    daily: daily.map((d) => ({ date: d.date, count: d.count })),
  };

  return NextResponse.json(body);
}

/** `DELETE /api/progress` — start over: drop reviews and daily counters alike. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.wordProgress.deleteMany({ where: { userId: session.user.id } }),
    prisma.dailyRecord.deleteMany({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ success: true });
}
