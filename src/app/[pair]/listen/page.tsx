'use client';

/**
 * The ear trainer: hear a word, say which of two it was.
 *
 * The method's first stage, and the only screen in the app that asks for
 * nothing but a judgement about a sound. It writes no progress — see
 * `src/lib/ear-training.ts` for why.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  answer,
  buildDrill,
  currentQuestion,
  isFinished,
  next as nextQuestion,
  playedWord,
  type Drill,
} from '@/lib/ear-training';
import { clips, minimalPairs, type Contrast } from '@/data/minimal-pairs';
import { he as t } from '@/i18n/translations';

const ROUND = 10;

const CONTRASTS: { id: Contrast | 'all'; label: string }[] = [
  { id: 'all', label: t.earContrastAll },
  { id: 'length', label: t.earContrastLength },
  { id: 'rounded', label: t.earContrastRounded },
  { id: 'sibilant', label: t.earContrastSibilant },
];

export default function ListenPage() {
  const params = useParams<{ pair: string }>();
  const pair = params?.pair ?? '';
  const [drill, setDrill] = useState<Drill | null>(null);
  const [contrast, setContrast] = useState<Contrast | 'all'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const question = drill ? currentQuestion(drill) : null;
  const file = question ? clips[playedWord(question).word].file : null;

  const play = useCallback(() => {
    const element = audioRef.current;
    if (!element) return;
    element.currentTime = 0;
    // A browser that refuses to play (no gesture yet, or a codec it dislikes)
    // must not take the page down with it: the replay button is right there.
    void element.play().catch(() => {});
  }, []);

  // Each new question plays itself once. The learner can replay as often as
  // they like; hearing it again is the entire exercise.
  useEffect(() => {
    if (file) play();
  }, [file, play]);

  const start = () => {
    setDrill(
      buildDrill(
        minimalPairs,
        ROUND,
        Math.random,
        contrast === 'all' ? undefined : contrast
      )
    );
  };

  const credits = useMemo(() => {
    const authors = [...new Set(Object.values(clips).map((clip) => clip.author))];
    return authors.sort().join(', ');
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-xl px-4 py-8">
        <Link href={`/${pair}`} className="mb-6 inline-block text-sm text-slate-400 hover:text-slate-200">
          {t.back}
        </Link>

        <h1 className="text-center text-2xl font-bold">{t.earTitle}</h1>
        <p className="mt-2 text-center text-sm text-slate-400">{t.earIntro}</p>

        {file && (
          // Deliberately not `controls`: the waveform in a player is a picture
          // of the answer, and the length contrast is exactly what it shows.
          <audio ref={audioRef} src={file} preload="auto" data-ear-audio />
        )}

        {drill === null && (
          <div data-ear-setup className="mt-8">
            <div className="grid gap-2">
              {CONTRASTS.map((option) => (
                <button
                  key={option.id}
                  data-ear-contrast={option.id}
                  onClick={() => setContrast(option.id)}
                  className={`rounded-xl border px-4 py-3 text-right transition ${
                    contrast === option.id
                      ? 'border-indigo-500 bg-indigo-600/20'
                      : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              data-ear-start
              onClick={start}
              className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-4 font-medium text-white transition hover:bg-indigo-500"
            >
              {t.earStart}
            </button>
          </div>
        )}

        {drill && !isFinished(drill) && question && (
          <div data-ear-question className="mt-8">
            {/* Forced ltr: in an rtl page "1 / 10" renders as "10 / 1". */}
            <p dir="ltr" className="text-center text-xs text-slate-500">
              {drill.answered + 1} / {drill.questions.length}
            </p>
            <p data-ear-task className="mt-4 text-center text-sm text-slate-400">
              {t.earTask}
            </p>

            <button
              data-ear-replay
              onClick={play}
              className="mx-auto mt-5 block rounded-full border border-slate-700 px-6 py-3 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              {t.earReplay}
            </button>

            <div className="mt-6 grid gap-3">
              {(['a', 'b'] as const).map((side) => {
                const option = question.pair[side];
                const chosen = drill.last?.chosen === side;
                const isPlayed = question.played === side;
                const graded = drill.last !== null;
                return (
                  <button
                    key={side}
                    data-ear-option={side}
                    disabled={graded}
                    onClick={() => setDrill(answer(drill, side))}
                    className={`rounded-xl border px-5 py-4 text-center text-2xl transition disabled:opacity-100 ${
                      graded && isPlayed
                        ? 'border-emerald-400 bg-emerald-900 text-emerald-50'
                        : graded && chosen
                          ? 'border-rose-400 bg-rose-950 text-rose-100'
                          : graded
                            ? 'border-slate-800 bg-slate-900 text-slate-500'
                            : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <span dir="ltr" className="block font-medium">
                      {graded && isPlayed && '✓ '}
                      {option.word}
                    </span>
                    {/* The meaning appears only once the answer is in: this is
                        a question about a sound, not about vocabulary. */}
                    {graded && (
                      <span dir="rtl" className="mt-1 block text-sm text-slate-400">
                        {option.he}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {drill.last && (
              <div className="mt-6 text-center">
                <p
                  data-ear-verdict={drill.last.correct ? 'right' : 'wrong'}
                  className={`text-sm ${drill.last.correct ? 'text-emerald-300' : 'text-amber-300'}`}
                >
                  {drill.last.correct ? t.earRight : t.earWrong(playedWord(question).word)}
                </p>
                <button
                  data-ear-next
                  onClick={() => setDrill(nextQuestion(drill))}
                  className="mt-4 w-full rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-500"
                >
                  {t.earNext}
                </button>
              </div>
            )}
          </div>
        )}

        {drill && isFinished(drill) && (
          <div data-ear-summary className="mt-10 text-center">
            <p data-ear-score className="text-3xl font-semibold">
              {t.earScore(drill.correct, drill.questions.length)}
            </p>
            <button
              data-ear-again
              onClick={() => setDrill(null)}
              className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-500"
            >
              {t.earAgain}
            </button>
            <Link
              href={`/${pair}/study/all`}
              className="mt-3 block rounded-xl border border-slate-700 px-6 py-3 text-sm text-slate-300 transition hover:border-slate-500"
            >
              {t.earToStudy}
            </Link>
          </div>
        )}

        <p className="mt-12 text-center text-xs text-slate-600">
          {t.earCredit} · {credits}
        </p>
      </div>
    </div>
  );
}
