import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { computeNextReview, isWordStatus, nextStreak } from '@/lib/progress';
import { isLapse, parseTelemetry } from '@/lib/telemetry';
import type { UpdateProgressResponse } from '@/lib/api-types';

export const runtime = 'nodejs';

/**
 * `PUT /api/progress/:wordId` — record one review.
 *
 * The client sends only the status it just gave the word. The review count,
 * the review time and the next due date are all decided here, so the schedule
 * cannot be forged or skewed by a stale client clock.
 *
 * The interval comes from the word's streak of recalls, so a miss sends it back
 * to the bottom of its ladder however many times it has been answered before.
 *
 * With `correction: true` the body replaces the review that was just recorded
 * instead of adding another one. The learner overturning a verdict changed
 * their mind about one review; counting it twice would march the word up its
 * interval ladder for an answer they only gave once.
 *
 * The body may also carry telemetry: which direction was being studied, whether
 * the word was being met or asked for, how the answer arrived, how long it took
 * and how often the learner spoke. It is written to `ReviewEvent`, so the
 * schedule can later be judged against what actually happened rather than
 * against the last button pressed.
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
    select: {
      reviewCount: true,
      seenCount: true,
      lapses: true,
      status: true,
      streak: true,
      previousStreak: true,
    },
  });

  const now = Date.now();
  // A correction re-grades the review already counted, so the count only moves
  // for a genuinely new one. Correcting a word with no reviews yet still counts
  // as its first.
  const reviewCount = correction
    ? Math.max(existing?.reviewCount ?? 0, 1)
    : (existing?.reviewCount ?? 0) + 1;

  // A correction re-grades the answer already recorded, so it is applied to the
  // run as it stood *before* that answer. Reading back from the current streak
  // would not work: a miss resets it to zero and destroys what it replaced.
  const runBefore = correction ? (existing?.previousStreak ?? 0) : (existing?.streak ?? 0);
  const streak = nextStreak(runBefore, status);
  const previousStreak = runBefore;
  const nextReview = computeNextReview(status, streak, now);

  // A correction re-grades a card the learner has already been shown, so it is
  // not another sighting. A lapse is judged against the status being replaced.
  const seenCount = correction
    ? Math.max(existing?.seenCount ?? 0, 1)
    : (existing?.seenCount ?? 0) + 1;
  const lapses = (existing?.lapses ?? 0) + (isLapse(existing?.status, status) ? 1 : 0);

  const telemetry = parseTelemetry(body);

  await prisma.$transaction([
    prisma.wordProgress.upsert({
      where: { wordId_userId: { wordId, userId } },
      update: {
        status,
        reviewCount,
        seenCount,
        lapses,
        streak,
        previousStreak,
        lastReviewed: BigInt(now),
        nextReview: BigInt(nextReview),
      },
      create: {
        wordId,
        userId,
        status,
        reviewCount,
        seenCount,
        lapses,
        streak,
        previousStreak,
        lastReviewed: BigInt(now),
        nextReview: BigInt(nextReview),
      },
    }),
    // The log is written in the same transaction as the state it explains, so
    // the two can never disagree about what happened.
    ...(telemetry
      ? [
          prisma.reviewEvent.create({
            data: {
              userId,
              wordId,
              direction: telemetry.direction,
              mode: telemetry.mode,
              source: telemetry.source,
              status,
              corrected: correction,
              latencyMs: telemetry.latencyMs ?? null,
              spokenAttempts: telemetry.spokenAttempts ?? 0,
              reviewedAt: BigInt(now),
            },
          }),
        ]
      : []),
  ]);

  const response: UpdateProgressResponse = { nextReview };
  return NextResponse.json(response);
}
