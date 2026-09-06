'use client';

/**
 * A study session, start to finish.
 *
 * The screen used to be a control panel: every filter, mode, counter and
 * grading button visible at once, with nothing saying what the learner was
 * meant to be doing. It is now three screens with one job each — choose the
 * session, run it one card at a time, see what it cost — driven by the pure
 * machine in `src/lib/session.ts`.
 */

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  fetchVocabulary,
  fetchProgress,
  updateProgress,
  recordDaily,
  resetProgress,
} from '@/lib/api';
import type { LevelData, ProgressData } from '@/lib/api';
import { computeStats, filterWordIds, shuffle } from '@/lib/study';
import type { FilterMode } from '@/lib/study';
import type { WordStatus } from '@/lib/progress';
import {
  advance,
  attachSchedule,
  correctAnswer,
  currentCard,
  endSession,
  lastAnswer,
  recordAnswer,
  revealAnswer,
  sessionProgress,
  startSession,
  summarize,
  type SessionCard,
  type SessionState,
} from '@/lib/session';
import {
  GuidedCard,
  SessionHeader,
  SessionSetup,
  SessionSummaryScreen,
  promptIsHungarian,
  type Activity,
  type Direction,
} from '@/components/study/session-ui';
import { QuizMode, WritingMode, VoiceButton, type Word } from '@/components/study/modes';
import { he as t } from '@/i18n/translations';

/** How many cards one sitting runs, before the learner is told they are done. */
const SESSION_SIZE = 20;

/**
 * A clock that ticks, so the counts on the setup screen stay current while it
 * sits open. Nothing during a session reads it: the deck is fixed when the
 * session starts, so a tick can no longer move a card under the learner.
 */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface ProgressState {
  byWord: Record<string, { status: WordStatus; nextReview: number }>;
  todayCount: number;
}

let savedGoal = 20;
try {
  const saved = typeof window !== 'undefined' ? localStorage?.getItem('hungarian-daily-goal') : null;
  if (saved) savedGoal = parseInt(saved, 10);
} catch {}

const DAILY_GOAL = savedGoal;

function StudyPageInner() {
  const params = useParams();
  const router = useRouter();
  const pair = (params.pair as string) ?? 'hu-he';
  const topicId = (params.topic as string) ?? '';

  const [levels, setLevels] = useState<LevelData[]>([]);
  const [progress, setProgress] = useState<ProgressState>({ byWord: {}, todayCount: 0 });
  const [loaded, setLoaded] = useState(false);

  const [direction, setDirection] = useState<Direction>('forward');
  const [deck, setDeck] = useState<FilterMode>('due');
  const [activity, setActivity] = useState<Activity>('cards');
  const [session, setSession] = useState<SessionState | null>(null);

  const now = useNow(30_000);

  useEffect(() => {
    let cancelled = false;
    fetchVocabulary(pair)
      .then((data) => {
        if (!cancelled) setLevels(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pair]);

  useEffect(() => {
    let cancelled = false;
    fetchProgress()
      .then((data: ProgressData) => {
        if (cancelled) return;
        const byWord: ProgressState['byWord'] = {};
        for (const p of data.progress) {
          byWord[p.word_id] = { status: p.status, nextReview: p.next_review };
        }
        const today = new Date().toISOString().slice(0, 10);
        const todayEntry = data.daily.find((d) => d.date === today);
        setProgress({ byWord, todayCount: todayEntry?.count ?? 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const topic = useMemo(() => {
    for (const level of levels) {
      const found = level.topics.find((tp) => tp.id === topicId);
      if (found) return found;
    }
    return null;
  }, [levels, topicId]);

  const words: Word[] = useMemo(
    () =>
      (topic?.words ?? []).map((w) => ({
        id: w.id,
        hungarian: w.hungarian,
        hebrew: w.hebrew,
      })),
    [topic]
  );

  const wordIds = useMemo(() => words.map((w) => w.id), [words]);

  // Read only by the setup screen, which is never on screen mid-session.
  const deckCounts = useMemo(() => {
    const counts = {} as Record<FilterMode, number>;
    for (const filter of ['all', 'due', 'unknown', 'learning', 'known'] as FilterMode[]) {
      counts[filter] = filterWordIds(wordIds, progress.byWord, filter, now).length;
    }
    return counts;
  }, [wordIds, progress.byWord, now]);

  const stats = useMemo(
    () => computeStats(wordIds, progress.byWord, now),
    [wordIds, progress.byWord, now]
  );

  /* ------------------------------------------------------------- session */

  const buildCards = useCallback((): SessionCard[] => {
    const ids = new Set(filterWordIds(wordIds, progress.byWord, deck, Date.now()));
    const chosen = shuffle(words.filter((w) => ids.has(w.id))).slice(0, SESSION_SIZE);
    const promptHu = promptIsHungarian(direction);
    return chosen.map((w) => ({
      id: w.id,
      prompt: promptHu ? w.hungarian : w.hebrew,
      answer: promptHu ? w.hebrew : w.hungarian,
    }));
  }, [words, wordIds, progress.byWord, deck, direction]);

  const beginSession = useCallback(() => {
    setSession(startSession(buildCards()));
  }, [buildCards]);

  const card = session ? currentCard(session) : undefined;
  const verdict = session ? lastAnswer(session) : undefined;

  const writeProgress = useCallback(
    async (
      wordId: string,
      status: WordStatus,
      correction = false
    ): Promise<number | null> => {
      try {
        const result = await updateProgress(wordId, status, correction);
        setProgress((prev) => ({
          ...prev,
          byWord: {
            ...prev.byWord,
            [wordId]: { status, nextReview: result.nextReview },
          },
        }));
        return result.nextReview;
      } catch {
        return null;
      }
    },
    []
  );

  const countToday = useCallback(async () => {
    try {
      const result = await recordDaily(1);
      setProgress((prev) => ({ ...prev, todayCount: result.count }));
    } catch {}
  }, []);

  const grade = useCallback(
    async (status: WordStatus) => {
      if (!card) return;
      // The verdict appears at once; the schedule it names arrives with the
      // server's answer, so a slow write never blocks the session.
      setSession((prev) => (prev ? recordAnswer(prev, status, null, Date.now()) : prev));
      const [nextReview] = await Promise.all([writeProgress(card.id, status), countToday()]);
      setSession((prev) => (prev ? attachSchedule(prev, card.id, nextReview) : prev));
    },
    [card, writeProgress, countToday]
  );

  const override = useCallback(
    async (status: WordStatus) => {
      if (!card) return;
      setSession((prev) => (prev ? correctAnswer(prev, status, null, Date.now()) : prev));
      const nextReview = await writeProgress(card.id, status, true);
      setSession((prev) => (prev ? attachSchedule(prev, card.id, nextReview) : prev));
    },
    [card, writeProgress]
  );

  const speak = useCallback(() => {
    if (!card) return;
    const hungarian = promptIsHungarian(direction) ? card.prompt : card.answer;
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(hungarian);
      utterance.lang = 'hu-HU';
      utterance.rate = 0.85;
      speechSynthesis.speak(utterance);
    } catch {}
  }, [card, direction]);

  const handleReset = useCallback(async () => {
    try {
      await resetProgress();
      setProgress({ byWord: {}, todayCount: 0 });
    } catch {}
  }, []);

  /* ---------------------------------------------------------- shortcuts */

  const stage = session?.stage;
  const shortcuts = useRef({ stage, grade, session });
  useEffect(() => {
    shortcuts.current = { stage, grade, session };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const state = shortcuts.current;
      if (state.stage === 'prompt' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setSession((prev) => (prev ? revealAnswer(prev) : prev));
      } else if (state.stage === 'reveal' && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const status = ({ '1': 'unknown', '2': 'learning', '3': 'known' } as const)[
          e.key as '1' | '2' | '3'
        ];
        void state.grade(status);
      } else if (state.stage === 'feedback' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setSession((prev) => (prev ? advance(prev) : prev));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ------------------------------------------------------------- render */

  if (!loaded || !topic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        <p className="text-slate-400">…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <TopBar onBack={() => router.push(`/${pair}`)} stats={stats} />
        <SessionSetup
          topicName={topic.nameHe}
          deckCounts={deckCounts}
          direction={direction}
          onDirectionChange={setDirection}
          deck={deck}
          onDeckChange={setDeck}
          activity={activity}
          onActivityChange={setActivity}
          todayCount={progress.todayCount}
          dailyGoal={DAILY_GOAL}
          sessionSize={SESSION_SIZE}
          onStart={beginSession}
          onReset={handleReset}
        />
      </div>
    );
  }

  if (session.stage === 'done') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <SessionSummaryScreen
          summary={summarize(session)}
          onAgain={() => setSession(null)}
          onLeave={() => router.push(`/${pair}`)}
        />
      </div>
    );
  }

  const { position, total } = sessionProgress(session);
  // Quiz and writing ask the question themselves; every activity shares the
  // reveal and the verdict that follow.
  const asking = session.stage === 'prompt';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <SessionHeader
        topicName={topic.nameHe}
        position={position}
        total={total}
        onEnd={() => setSession((prev) => (prev ? endSession(prev) : prev))}
      />

      {asking && activity === 'quiz' && card ? (
        <QuizMode
          key={card.id}
          card={card}
          pool={session.cards.map((c) => c.answer)}
          onAnswer={(correct) => void grade(correct ? 'learning' : 'unknown')}
        />
      ) : asking && activity === 'writing' && card ? (
        <WritingMode
          key={card.id}
          card={card}
          onAnswer={(correct) => void grade(correct ? 'learning' : 'unknown')}
        />
      ) : card ? (
        <GuidedCard
          card={card}
          stage={session.stage}
          answer={verdict}
          direction={direction}
          onSpeak={speak}
          onReveal={() => setSession((prev) => (prev ? revealAnswer(prev) : prev))}
          onGrade={(status) => void grade(status)}
          onOverride={(status) => void override(status)}
          onNext={() => setSession((prev) => (prev ? advance(prev) : prev))}
        />
      ) : null}

      {card && session.stage !== 'prompt' && (
        <div className="mx-auto flex max-w-xl justify-center gap-3 px-4 pb-10">
          <VoiceButton
            expectedText={promptIsHungarian(direction) ? card.answer : card.prompt}
            lang="he-IL"
            label={t.voiceHe}
            onCorrect={() => {}}
            onWrong={() => {}}
            dataAttr="data-voice-he"
          />
          <VoiceButton
            expectedText={promptIsHungarian(direction) ? card.prompt : card.answer}
            lang="hu-HU"
            label={t.voiceHu}
            onCorrect={() => {}}
            onWrong={() => {}}
            dataAttr="data-voice-hu"
          />
        </div>
      )}

    </div>
  );
}

function TopBar({
  onBack,
  stats,
}: {
  onBack: () => void;
  stats: { known: number; learning: number; unknown: number };
}) {
  return (
    <div className="border-b border-slate-800">
      <div className="mx-auto flex max-w-xl items-center gap-4 px-4 py-3 pe-40">
        <button
          onClick={onBack}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          {t.back}
        </button>
        <div className="flex gap-3 text-xs text-slate-500">
          <span>{t.statKnown(stats.known)}</span>
          <span>{t.statLearning(stats.learning)}</span>
          <span>{t.statRemaining(stats.unknown)}</span>
        </div>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={null}>
      <StudyPageInner />
    </Suspense>
  );
}
