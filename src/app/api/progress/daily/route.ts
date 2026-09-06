import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { dayKey } from '@/lib/progress';
import type { RecordDailyResponse } from '@/lib/api-types';

export const runtime = 'nodejs';

/**
 * `POST /api/progress/daily` — add to today's card count.
 *
 * The body's `count` is a delta, not a total; the response is the new running
 * total for today, which is what the daily-goal bar shows.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const count = (body as { count?: unknown } | null)?.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
    return NextResponse.json(
      { error: 'count must be a positive integer' },
      { status: 400 }
    );
  }

  const date = dayKey(Date.now());
  const record = await prisma.dailyRecord.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    update: { count: { increment: count } },
    create: { userId: session.user.id, date, count },
  });

  const response: RecordDailyResponse = { count: record.count };
  return NextResponse.json(response);
}
