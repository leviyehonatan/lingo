import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { computeNextReview, isWordStatus } from '@/lib/progress';
import type { UpdateProgressResponse } from '@/lib/api-types';

export const runtime = 'nodejs';

/**
 * `PUT /api/progress/:wordId` — record one review.
 *
 * The client sends only the status it just gave the word. The review count,
 * the review time and the next due date are all decided here, so the schedule
 * cannot be forged or skewed by a stale client clock.
 *
 * With `correction: true` the body replaces the review that was just recorded
 * instead of adding another one. The learner overturning a verdict changed
 * their mind about one review; counting it twice would march the word up its
 * interval ladder for an answer they only gave once.
 */
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/progress/[wordId]'>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { wordId } = await ctx.params;
  if (!wordId) {
    return NextResponse.json({ error: 'Missing wordId' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = (body as { status?: unknown } | null)?.status;
  if (!isWordStatus(status)) {
    return NextResponse.json(
      { error: 'status must be one of known, learning, unknown' },
      { status: 400 }
    );
  }

  const correction = (body as { correction?: unknown } | null)?.correction === true;

  const userId = session.user.id;
  const existing = await prisma.wordProgress.findUnique({
    where: { wordId_userId: { wordId, userId } },
    select: { reviewCount: true },
  });

  const now = Date.now();
  // A correction re-grades the review already counted, so the count only moves
  // for a genuinely new one. Correcting a word with no reviews yet still counts
  // as its first.
  const reviewCount = correction
    ? Math.max(existing?.reviewCount ?? 0, 1)
    : (existing?.reviewCount ?? 0) + 1;
  const nextReview = computeNextReview(status, reviewCount, now);

  await prisma.wordProgress.upsert({
    where: { wordId_userId: { wordId, userId } },
    update: {
      status,
      reviewCount,
      lastReviewed: BigInt(now),
      nextReview: BigInt(nextReview),
    },
    create: {
      wordId,
      userId,
      status,
      reviewCount,
      lastReviewed: BigInt(now),
      nextReview: BigInt(nextReview),
    },
  });

  const response: UpdateProgressResponse = { nextReview };
  return NextResponse.json(response);
}
