import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const progress = await prisma.wordProgress.findMany({
    where: { userId: session.user.id },
  });

  const result = progress.map((p) => ({
    id: p.id,
    wordId: p.wordId,
    userId: p.userId,
    status: p.status,
    lastReviewed: p.lastReviewed.toString(),
    reviewCount: p.reviewCount,
    nextReview: p.nextReview.toString(),
  }));

  return NextResponse.json(result);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { wordId, status, lastReviewed, reviewCount, nextReview } = body;

  if (!wordId) {
    return NextResponse.json({ error: 'Missing wordId' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (lastReviewed !== undefined) data.lastReviewed = BigInt(lastReviewed);
  if (reviewCount !== undefined) data.reviewCount = reviewCount;
  if (nextReview !== undefined) data.nextReview = BigInt(nextReview);

  const progress = await prisma.wordProgress.upsert({
    where: {
      wordId_userId: {
        wordId,
        userId: session.user.id,
      },
    },
    update: data,
    create: {
      wordId,
      userId: session.user.id,
      ...(data as {
        status?: string;
        lastReviewed?: bigint;
        reviewCount?: number;
        nextReview?: bigint;
      }),
    },
  });

  return NextResponse.json({
    id: progress.id,
    wordId: progress.wordId,
    userId: progress.userId,
    status: progress.status,
    lastReviewed: progress.lastReviewed.toString(),
    reviewCount: progress.reviewCount,
    nextReview: progress.nextReview.toString(),
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.wordProgress.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
