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

  const userId = session.user.id;
  const existing = await prisma.wordProgress.findUnique({
    where: { wordId_userId: { wordId, userId } },
    select: { reviewCount: true },
  });

  const now = Date.now();
  const reviewCount = (existing?.reviewCount ?? 0) + 1;
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
