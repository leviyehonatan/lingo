'use client';

interface Topic {
  id: string;
  name: string;
  nameHe: string;
  wordCount: number;
}

interface Level {
  id: string;
  name: string;
  nameHe: string;
  topics: Topic[];
}

export function TopicsList({ levels, pairId }: { levels: Level[]; pairId: string }) {
  return (
    <div className="space-y-3">
      {levels.map((level) => (
        <details key={level.id} className="rounded-xl border border-slate-700 bg-slate-800/50" open>
          <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-800 list-none">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">{level.id}</span>
            <span className="font-medium">{level.nameHe}</span>
            <span className="mr-auto text-slate-400 text-xs">{level.topics.length} נושאים</span>
          </summary>
          <div className="grid grid-cols-1 gap-2 px-5 pb-4 sm:grid-cols-2">
            {level.topics.map((topic) => (
              <a
                key={topic.id}
                href={`/${pairId}/study/${topic.id}`}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 transition hover:border-indigo-500/50 hover:bg-slate-700/80"
              >
                <div className="font-medium">{topic.nameHe}</div>
                <div className="text-sm text-slate-400">{topic.name}</div>
                <div className="mt-1 text-xs text-slate-500">{topic.wordCount} מילים</div>
              </a>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
