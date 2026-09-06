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

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  Suspense,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  fetchVocabulary,
  fetchProgress,
  fetchStats,
  updateProgress,
  recordDaily,
  resetProgress,
} from '@/lib/api';
import type { LearnerStats } from '@/lib/stats';
import {
  readPreferences,
  writePreferences,
  type Preferences,
} from '@/lib/preferences';
import type { ReviewSource } from '@/lib/telemetry';
import type { LevelData, ProgressData } from '@/lib/api';
import { computeStats, filterWordIds, shuffle } from '@/lib/study';
import { modeFor, planSession } from '@/lib/plan';
import { similarity, normalize } from '@/lib/answer-match';
import type { FilterMode } from '@/lib/study';
import type { WordStatus } from '@/lib/progress';
import {
  advance,
  attachSchedule,
  attemptsFor,
  correctAnswer,
  currentCard,
  endSession,
  lastAnswer,
  noteAttempt,
  recordAnswer,
  revealAnswer,
  sessionProgress,
  startSession,
  summarize,
  type Schedule,
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
import {
  QuizMode,
  WritingMode,
  speechAvailable,
  type SpokenResult,
  type Word,
} from '@/components/study/modes';
import { he as t } from '@/i18n/translations';

/** Whether the browser can hear is fixed for the life of the page. */
const NEVER_CHANGES = () => () => {};

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
  // Null means the recommended sitting; a filter means the learner overrode it.
  const [deck, setDeck] = useState<FilterMode | null>(null);
  const [activity, setActivity] = useState<Activity>('cards');
  const [session, setSession] = useState<SessionState | null>(null);
  const [learnerStats, setLearnerStats] = useState<LearnerStats | null>(null);

  const now = useNow(30_000);

  // Safari and Firefox ship no usable recognizer, so the spoken path has to be
  // optional. It is a fact about the browser, not state: the server renders it
  // as absent and the client fills it in on hydration.
  const canListen = useSyncExternalStore(
    NEVER_CHANGES,
    speechAvailable,
    () => false
  );

  // How the learner wants the session to behave: hands-free, how strictly it
  // listens, whether they can speak at all right now, and how long a sitting
  // runs. Remembered per browser.
  const [preferences, setPreferences] = useState(readPreferences);
  /** Speaking needs a browser that can hear and a learner willing to talk. */
  const speaking = canListen && !preferences.silent;
  const updatePreferences = useCallback((change: Partial<Preferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...change };
      writePreferences(next);
      return next;
    });
  }, []);

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

  // Reloaded whenever the setup screen comes back, so the numbers reflect the
  // sitting that just finished rather than the state at page load.
  useEffect(() => {
    if (session !== null) return;
    let cancelled = false;
    fetchStats()
      .then((data) => {
        if (!cancelled) setLearnerStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

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
  const byId = useMemo(() => new Map(words.map((word) => [word.id, word])), [words]);

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

  /**
   * Whether two words are too alike to meet on the same day. Judged on both
   * sides, since a pair can collide either in what is shown or in what has to
   * be produced, and it is the collision that does the damage.
   */
  const confusable = useCallback(
    (a: string, b: string) => {
      const first = byId.get(a);
      const second = byId.get(b);
      if (!first || !second) return false;
      return (
        similarity(normalize(first.hungarian), normalize(second.hungarian)) >= 0.6 ||
        similarity(normalize(first.hebrew), normalize(second.hebrew)) >= 0.6
      );
    },
    [byId]
  );

  /** The recommended sitting: what is due, then a few new words. */
  const plan = useMemo(
    () =>
      planSession({
        wordIds,
        byWord: progress.byWord,
        now,
        newLimit: preferences.newPerSession,
        size: preferences.sessionSize,
        confusable,
      }),
    [
      wordIds,
      progress.byWord,
      now,
      preferences.newPerSession,
      preferences.sessionSize,
      confusable,
    ]
  );

  const buildCards = useCallback((): SessionCard[] => {
    const promptHu = promptIsHungarian(direction);
    const toCard = (id: string, mode: 'teach' | 'review'): SessionCard | null => {
      const word = byId.get(id);
      if (!word) return null;
      return {
        id,
        prompt: promptHu ? word.hungarian : word.hebrew,
        answer: promptHu ? word.hebrew : word.hungarian,
        mode,
      };
    };

    const chosen =
      deck === null
        ? // The plan is already ordered: due first, then new. Do not shuffle it.
          plan.cards
        : shuffle(
            words.filter((w) =>
              new Set(
                filterWordIds(wordIds, progress.byWord, deck, Date.now())
              ).has(w.id)
            )
          )
            .slice(0, preferences.sessionSize)
            .map((w) => ({ id: w.id, mode: modeFor(progress.byWord, w.id) }));

    // Words come back by being put back into the queue as the sitting runs,
    // which is what lets a missed word return a few cards later rather than
    // tomorrow. See `REINSERT_GAP` in `src/lib/session.ts`.
    return chosen
      .map((planned) => toCard(planned.id, planned.mode))
      .filter((card): card is SessionCard => card !== null);
  }, [
    byId,
    words,
    wordIds,
    progress.byWord,
    deck,
    direction,
    plan,
    preferences.sessionSize,
  ]);

  const beginSession = useCallback(() => {
    setSession(startSession(buildCards()));
  }, [buildCards]);

  const card = session ? currentCard(session) : undefined;
  const verdict = session ? lastAnswer(session) : undefined;

  /**
   * What is on screen and since when, so an answer can be timed and attributed.
   * A ref rather than state: none of it should cause a render, and it is
   * stamped with the card id so a slow write can never report the wrong word.
   */
  const showing = useRef<{
    cardId: string;
    mode: 'teach' | 'review';
    at: number;
    spoken: number;
  } | null>(null);

  const cardId = card?.id;
  const cardMode = card?.mode;
  useEffect(() => {
    if (!cardId || !cardMode) return;
    showing.current = { cardId, mode: cardMode, at: Date.now(), spoken: 0 };
  }, [cardId, cardMode]);

  const writeProgress = useCallback(
    async (
      wordId: string,
      status: WordStatus,
      correction = false,
      source: ReviewSource = 'buttons'
    ): Promise<Schedule | null> => {
      const shown = showing.current;
      const onThisCard = shown?.cardId === wordId ? shown : null;
      try {
        const result = await updateProgress(wordId, status, correction, {
          direction,
          mode: onThisCard?.mode ?? 'review',
          source,
          latencyMs: onThisCard ? Date.now() - onThisCard.at : undefined,
          spokenAttempts: onThisCard?.spoken ?? 0,
        });
        setProgress((prev) => ({
          ...prev,
          byWord: {
            ...prev.byWord,
            [wordId]: { status, nextReview: result.nextReview },
          },
        }));
        return result;
      } catch {
        return null;
      }
    },
    [direction]
  );

  const countToday = useCallback(async () => {
    try {
      const result = await recordDaily(1);
      setProgress((prev) => ({ ...prev, todayCount: result.count }));
    } catch {}
  }, []);

  const grade = useCallback(
    async (status: WordStatus, source: ReviewSource = 'buttons') => {
      if (!card) return;
      // The verdict appears at once; the schedule it names arrives with the
      // server's answer, so a slow write never blocks the session.
      setSession((prev) => (prev ? recordAnswer(prev, status, null, Date.now()) : prev));
      const [schedule] = await Promise.all([
        writeProgress(card.id, status, false, source),
        countToday(),
      ]);
      setSession((prev) => (prev ? attachSchedule(prev, card.id, schedule) : prev));
    },
    [card, writeProgress, countToday]
  );

  const override = useCallback(
    async (status: WordStatus) => {
      if (!card) return;
      setSession((prev) => (prev ? correctAnswer(prev, status, null, Date.now()) : prev));
      const schedule = await writeProgress(card.id, status, true, 'buttons');
      setSession((prev) => (prev ? attachSchedule(prev, card.id, schedule) : prev));
    },
    [card, writeProgress]
  );

  /**
   * The graded utterance: the learner said the answer before seeing it.
   *
   * A match grades the card at once. A miss does not: recognition is wrong
   * often enough that treating it as a failed recall would poison the
   * schedule, so the attempt is recorded and the card stays open for another
   * go, or for the learner to say what actually happened.
   */
  const handleSpoken = useCallback(
    (result: SpokenResult) => {
      setSession((prev) =>
        prev ? noteAttempt(prev, 'recall', result.heard, result.accepted, Date.now()) : prev
      );
      if (showing.current) showing.current.spoken += 1;
      if (result.accepted) void grade('known', 'speech');
    },
    [grade]
  );

  /** Saying the word already on screen. Practice only; it never grades. */
  const handlePractice = useCallback((result: SpokenResult) => {
    if (showing.current) showing.current.spoken += 1;
    setSession((prev) =>
      prev
        ? noteAttempt(prev, 'pronunciation', result.heard, result.accepted, Date.now())
        : prev
    );
  }, []);

  /**
   * A word has been met. It enters the schedule as something being learned
   * rather than something answered: there was no question to get right.
   */
  const handleTaught = useCallback(() => {
    void grade('learning', 'speech');
  }, [grade]);

  /**
   * Asking for the answer is allowed, and it is an admission: with a microphone
   * available it records the card as not known, which the learner can overturn
   * with the next click. Without one there is nothing to demonstrate with, so
   * it falls back to revealing and self-grading.
   */
  const handleShowAnswer = useCallback(() => {
    if (speaking) {
      void grade('unknown', 'reveal');
    } else {
      setSession((prev) => (prev ? revealAnswer(prev) : prev));
    }
  }, [speaking, grade]);

  /**
   * Speak the Hungarian side of the card, whichever side that is.
   *
   * Chrome drops an utterance queued in the same tick as a cancel, which is
   * what made the replay button do nothing the second time, so the two are
   * separated. A Hungarian voice is picked when the system has one; without it
   * the browser reads Hungarian with whatever default it has.
   */
  const speak = useCallback(() => {
    if (!card) return;
    const hungarian = promptIsHungarian(direction) ? card.prompt : card.answer;
    try {
      speechSynthesis.cancel();
      setTimeout(() => {
        // The timer runs outside the try above, and playback is a nicety: a
        // browser that cannot do it must not take the session down with it.
        try {
          const utterance = new SpeechSynthesisUtterance(hungarian);
          utterance.lang = 'hu-HU';
          utterance.rate = 0.85;
          const voice = speechSynthesis
            .getVoices?.()
            ?.find((candidate) => candidate.lang.toLowerCase().startsWith('hu'));
          if (voice) utterance.voice = voice;
          speechSynthesis.speak(utterance);
        } catch {}
      }, 0);
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
          plan={plan}
          deckCounts={deckCounts}
          direction={direction}
          onDirectionChange={setDirection}
          deck={deck}
          onDeckChange={setDeck}
          activity={activity}
          onActivityChange={setActivity}
          todayCount={progress.todayCount}
          dailyGoal={DAILY_GOAL}
          sessionSize={preferences.sessionSize}
          canListen={canListen}
          preferences={preferences}
          onPreferencesChange={updatePreferences}
          stats={learnerStats}
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

  const { settled, total } = sessionProgress(session);
  // A word met earlier in this sitting is asked with the start of its answer
  // available, rather than cold.
  const metThisSitting = new Set(
    session.cards.filter((queued) => queued.mode === 'teach').map((queued) => queued.id)
  );
  // Quiz and writing ask the question themselves; every activity shares the
  // reveal and the verdict that follow. A word being met for the first time is
  // never asked, whatever the activity: there is nothing to answer with yet.
  const asking = session.stage === 'prompt' && card?.mode === 'review';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <SessionHeader
        topicName={topic.nameHe}
        settled={settled}
        total={total}
        onEnd={() => setSession((prev) => (prev ? endSession(prev) : prev))}
      />

      {asking && activity === 'quiz' && card ? (
        <QuizMode
          key={card.id}
          card={card}
          pool={session.cards.map((c) => c.answer)}
          onAnswer={(correct) => void grade(correct ? 'learning' : 'unknown', 'quiz')}
        />
      ) : asking && activity === 'writing' && card ? (
        <WritingMode
          key={card.id}
          card={card}
          onAnswer={(correct) => void grade(correct ? 'learning' : 'unknown', 'writing')}
        />
      ) : card ? (
        <GuidedCard
          // A new card starts with a clean slate: no half-finished repetition
          // carried over from the last one.
          key={card.id}
          card={card}
          stage={session.stage}
          answer={verdict}
          heard={attemptsFor(session, card.id, 'recall').at(-1)}
          comesBack={session.cards
            .slice(session.index + 1)
            .some((queued) => queued.id === card.id)}
          direction={direction}
          canListen={speaking}
          handsFree={preferences.handsFree && speaking}
          strictness={preferences.strictness}
          hinted={metThisSitting.has(card.id)}
          onSpeak={handleSpoken}
          onSpeakPractice={handlePractice}
          onHear={speak}
          onShowAnswer={handleShowAnswer}
          onGoSilent={() => updatePreferences({ silent: true })}
          onTaught={handleTaught}
          onGrade={(status) => void grade(status)}
          onOverride={(status) => void override(status)}
          onNext={() => setSession((prev) => (prev ? advance(prev) : prev))}
        />
      ) : null}

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
