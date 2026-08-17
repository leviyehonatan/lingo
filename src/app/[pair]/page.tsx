import { prisma } from '@/lib/prisma';
import { TopicsList } from '@/components/TopicsList';

const FLAG_MAP: Record<string, string> = {
  hu: '🇭🇺', he: '🇮🇱', en: '🇬🇧', fr: '🇫🇷',
  de: '🇩🇪', es: '🇪🇸', it: '🇮🇹', ru: '🇷🇺',
};

function getFlag(code: string) { return FLAG_MAP[code] ?? '🌐'; }

interface PageProps {
  params: Promise<{ pair: string }>;
}

export default async function PairPage({ params }: PageProps) {
  const { pair } = await params;
  const [sourceLang, targetLang] = pair.split('-');

  let pairInfo: { sourceName: string; targetName: string } | null = null;
  let levels: { id: string; name: string; nameHe: string; topics: { id: string; name: string; nameHe: string; wordCount: number }[] }[] = [];

  try {
    const dbPair = await prisma.languagePair.findUnique({ where: { id: pair } });
    if (dbPair) pairInfo = { sourceName: dbPair.sourceName, targetName: dbPair.targetName };

    const dbLevels = await prisma.level.findMany({
      where: { sourceLang, targetLang },
      include: { topics: { include: { _count: { select: { words: true } } } } },
      orderBy: { id: 'asc' },
    });

    levels = dbLevels.map((l) => ({
      id: l.id,
      name: l.name,
      nameHe: l.nameHe,
      topics: l.topics.map((t) => ({
        id: t.id,
        name: t.name,
        nameHe: t.nameHe,
        wordCount: t._count.words,
      })),
    }));
  } catch {}

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <a href="/" className="text-sm text-slate-400 hover:text-slate-200 mb-6 inline-block">🔙 חזרה</a>

        {pairInfo && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">
              {getFlag(sourceLang)} {pairInfo.targetName} ← {pairInfo.sourceName}
            </h1>
          </div>
        )}

        {levels.length === 0 ? (
          <p className="text-center text-slate-500">אין תוכן לצמד הזה</p>
        ) : (
          <TopicsList levels={levels} pairId={pair} />
        )}
      </div>
    </div>
  );
}
