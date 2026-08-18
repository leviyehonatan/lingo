import { prisma } from '@/lib/prisma';
import Link from 'next/link';

// Reads the DB per-request — must not be statically prerendered at build time.
export const dynamic = 'force-dynamic';

const FLAG_MAP: Record<string, string> = {
  hu: '🇭🇺', he: '🇮🇱', en: '🇬🇧', fr: '🇫🇷',
  de: '🇩🇪', es: '🇪🇸', it: '🇮🇹', ru: '🇷🇺',
  ar: '🇸🇦', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', pt: '🇵🇹',
};

function getFlag(code: string) { return FLAG_MAP[code] ?? '🌐'; }

export default async function Home() {
  let pairs: { id: string; sourceLang: string; targetLang: string; sourceName: string; targetName: string }[] = [];
  try {
    const db = await prisma.languagePair.findMany();
    pairs = db.map((p) => ({ id: p.id, sourceLang: p.sourceLang, targetLang: p.targetLang, sourceName: p.sourceName, targetName: p.targetName }));
  } catch {}

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl font-bold mb-2">לימוד שפות</h1>
      <p className="text-slate-400 mb-10">בחר שפה ללימוד</p>

      {pairs.length === 0 ? (
        <p className="text-slate-500">אין צמדי שפות במערכת</p>
      ) : (
        <div className="grid gap-4 w-full max-w-sm">
          {pairs.map((p) => (
            <Link
              key={p.id}
              href={`/${p.id}`}
              className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-5 hover:border-indigo-500 hover:bg-slate-800 transition"
            >
              <span className="text-4xl">{getFlag(p.sourceLang)}</span>
              <div>
                <div className="font-medium text-lg">{p.targetName} ← {p.sourceName}</div>
                <div className="text-sm text-slate-400">{p.targetLang} ← {p.sourceLang}</div>
              </div>
              <span className="mr-auto text-slate-500 text-xl">◀</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
