import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import type { ProgressData } from '@/lib/api-types';
import { readStatus } from '@/lib/progress';

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
      status: readStatus(p.status),
      last_reviewed: Number(p.lastReviewed),
      review_count: p.reviewCount,
      next_review: Number(p.nextReview),
      seen_count: p.seenCount,
      lapses: p.lapses,
    })),
    daily: daily.map((d) => ({ date: d.date, count: d.count })),
  };

  return NextResponse.json(body);
}

/**
 * `DELETE /api/progress` — start over.
 *
 * Drops the review log as well as the schedule and the daily counters. A
 * learner who resets their progress has not merely forgotten the words; the
 * history of how they answered them describes a run that no longer exists, and
 * leaving it behind would keep it in their statistics.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.wordProgress.deleteMany({ where: { userId: session.user.id } }),
    prisma.dailyRecord.deleteMany({ where: { userId: session.user.id } }),
    prisma.reviewEvent.deleteMany({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ success: true });
}
