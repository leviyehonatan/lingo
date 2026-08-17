import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const pairs = await prisma.languagePair.findMany();
  return NextResponse.json(pairs);
}
