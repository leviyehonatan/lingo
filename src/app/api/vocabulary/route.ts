import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get('pair');

  if (!pair) {
    return NextResponse.json({ error: 'Missing pair parameter' }, { status: 400 });
  }

  const levels = await prisma.level.findMany({
    where: {
      pairId: pair,
    },
    include: {
      topics: {
        include: {
          words: true,
        },
      },
    },
  });

  const result = levels.map((level) => ({
    id: level.id,
    name: level.name,
    nameHe: level.nameHe,
    sourceLang: level.sourceLang,
    targetLang: level.targetLang,
    pairId: level.pairId,
    topics: level.topics.map((topic) => ({
      id: topic.id,
      levelId: topic.levelId,
      name: topic.name,
      nameHe: topic.nameHe,
      words: topic.words.map((word) => ({
        id: word.id,
        topicId: word.topicId,
        hungarian: word.sourceText,
        hebrew: word.targetText,
      })),
    })),
  }));

  return NextResponse.json(result);
}
