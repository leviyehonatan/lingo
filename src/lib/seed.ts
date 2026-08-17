import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { levelA1 } from '@/data/levelA1';
import { levelA2 } from '@/data/levelA2';
import { levelB1 } from '@/data/levelB1';

export async function seed() {
  console.log('Seeding database...');

  await prisma.languagePair.upsert({
    where: { id: 'hu-he' },
    update: {},
    create: {
      id: 'hu-he',
      sourceLang: 'hu',
      targetLang: 'he',
      sourceName: 'הונגרית',
      targetName: 'עברית',
    },
  });

  const levels = [
    { data: levelA1, id: 'A1' },
    { data: levelA2, id: 'A2' },
    { data: levelB1, id: 'B1' },
  ];

  for (const { data, id } of levels) {
    await prisma.level.upsert({
      where: { id },
      update: {
        name: data.name,
        nameHe: data.nameHe,
      },
      create: {
        id,
        name: data.name,
        nameHe: data.nameHe,
        sourceLang: 'hu',
        targetLang: 'he',
        pairId: 'hu-he',
      },
    });

    for (const topic of data.topics) {
      await prisma.topic.upsert({
        where: { id: topic.id },
        update: {
          name: topic.name,
          nameHe: topic.nameHe,
        },
        create: {
          id: topic.id,
          levelId: id,
          name: topic.name,
          nameHe: topic.nameHe,
        },
      });

      for (const word of topic.words) {
        await prisma.word.upsert({
          where: { id: word.id },
          update: {
            sourceText: word.hungarian,
            targetText: word.hebrew,
          },
          create: {
            id: word.id,
            topicId: topic.id,
            sourceText: word.hungarian,
            targetText: word.hebrew,
          },
        });
      }
    }
  }

  console.log('Seeding complete.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
