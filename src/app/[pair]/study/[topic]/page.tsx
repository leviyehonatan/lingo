'use client';

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

type WordStatus = 'known' | 'unknown' | 'learning';
type FilterMode = 'all' | 'unknown' | 'learning' | 'known' | 'due';
type StudyMode = 'flashcards' | 'quiz' | 'writing';

interface Word {
  id: string;
  hungarian: string;
  hebrew: string;
}

interface ProgressState {
  byWord: Record<string, { status: WordStatus; nextReview: number }>;
  todayCount: number;
}

let sDailyGoal = 20;
try {
  const saved = typeof window !== 'undefined' ? localStorage?.getItem('hungarian-daily-goal') : null;
  if (saved) sDailyGoal = parseInt(saved, 10);
} catch {}

const DAILY_GOAL = sDailyGoal;

function shuffleWords(arr: readonly Word[]): Word[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptions(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function StudyPageInner() {
  const params = useParams();
  const router = useRouter();
  const pair = (params.pair as string) ?? 'hu-he';
  const topicId = (params.topic as string) ?? '';

  const [levels, setLevels] = useState<LevelData[]>([]);
  const [progress, setProgress] = useState<ProgressState>({
    byWord: {},
    todayCount: 0,
  });
  const [dailyGoal] = useState(DAILY_GOAL);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [mode, setMode] = useState<StudyMode>('flashcards');
  const [showHelp, setShowHelp] = useState(false);

  const [shuffled, setShuffled] = useState<Word[]>([]);

  const now = useNow(30_000);

  useEffect(() => {
    let cancelled = false;
    fetchVocabulary(pair)
      .then((data) => {
        if (!cancelled) setLevels(data);
      })
      .catch(() => {});
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
          byWord[p.word_id] = {
            status: p.status,
            nextReview: p.next_review,
          };
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
      const found = level.topics.find((t) => t.id === topicId);
      if (found) return found;
    }
    return null;
  }, [levels, topicId]);

  const words = useMemo(
    () =>
      (topic?.words ?? []).map((w) => ({
        id: w.id,
        hungarian: w.hungarian,
        hebrew: w.hebrew,
      })),
    [topic]
  );

  const wordIds = useMemo(() => words.map((w) => w.id), [words]);

  const dueWordIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of wordIds) {
      const p = progress.byWord[id];
      if (!p || p.nextReview <= now) ids.add(id);
    }
    return ids;
  }, [wordIds, progress.byWord, now]);

  const getStatus = useCallback(
    (wordId: string): WordStatus | undefined =>
      progress.byWord[wordId]?.status,
    [progress.byWord]
  );

  const filteredWordIds = useMemo(() => {
    return wordIds.filter((id) => {
      if (filter === 'all') return true;
      if (filter === 'due') return dueWordIds.has(id);
      const status = getStatus(id);
      if (filter === 'unknown') return !status;
      return status === filter;
    });
  }, [wordIds, filter, getStatus, dueWordIds]);

  const filteredWords = useMemo(
    () => words.filter((w) => filteredWordIds.includes(w.id)),
    [words, filteredWordIds]
  );

  useEffect(() => {
    // shuffleWords is impure (Math.random), so we defer the setState
    queueMicrotask(() => {
      setShuffled(shuffleWords(filteredWords));
    });
  }, [filteredWords]);

  const stats = useMemo(() => {
    let known = 0;
    let learning = 0;
    let unknown = 0;
    for (const id of wordIds) {
      const p = progress.byWord[id];
      if (!p || p.status === 'unknown' || p.nextReview <= now) {
        unknown++;
      } else if (p.status === 'learning') {
        learning++;
      } else if (p.status === 'known') {
        known++;
      }
    }
    return { known, learning, unknown };
  }, [wordIds, progress.byWord, now]);

  const currentWord = shuffled[currentIndex];
  const total = shuffled.length;

  const updateProgressState = useCallback(
    async (wordId: string, status: WordStatus) => {
      try {
        const result = await updateProgress(wordId, status);
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
    []
  );

  const recordDailyCount = useCallback(async (count: number) => {
    try {
      const result = await recordDaily(count);
      setProgress((prev) => ({ ...prev, todayCount: result.count }));
    } catch {}
  }, []);

  const goNext = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((i) => (i + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const handleMark = useCallback(
    (status: WordStatus) => {
      if (!currentWord) return;
      updateProgressState(currentWord.id, status);
      recordDailyCount(1);
      goNext();
    },
    [currentWord, updateProgressState, goNext, recordDailyCount]
  );

  const handleQuizCorrect = useCallback(() => {
    if (!currentWord) return;
    updateProgressState(currentWord.id, 'learning');
    recordDailyCount(1);
  }, [currentWord, updateProgressState, recordDailyCount]);

  const handleQuizWrong = useCallback(() => {
    if (!currentWord) return;
    updateProgressState(currentWord.id, 'unknown');
    recordDailyCount(1);
  }, [currentWord, updateProgressState, recordDailyCount]);

  const markRef = useRef(handleMark);
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  const showHelpRef = useRef(showHelp);

  useEffect(() => {
    markRef.current = handleMark;
  }, [handleMark]);

  useEffect(() => {
    goNextRef.current = goNext;
  }, [goNext]);

  useEffect(() => {
    goPrevRef.current = goPrev;
  }, [goPrev]);

  useEffect(() => {
    showHelpRef.current = showHelp;
  }, [showHelp]);

  useEffect(() => {
    if (mode !== 'flashcards') return;
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goNextRef.current();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goPrevRef.current();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        const el = document.querySelector<HTMLElement>('[data-flashcard]');
        el?.click();
      } else if (e.key === '1') markRef.current('unknown');
      else if (e.key === '2') markRef.current('learning');
      else if (e.key === '3') markRef.current('known');
      else if (e.key === 's') {
        e.preventDefault();
        const btn = document.querySelector<HTMLElement>('[data-speak]');
        btn?.click();
      } else if (e.key === 'v') {
        e.preventDefault();
        const btn = document.querySelector<HTMLElement>('[data-voice-he]');
        btn?.click();
      } else if (e.key === 'p') {
        e.preventDefault();
        const btn = document.querySelector<HTMLElement>('[data-voice-hu]');
        btn?.click();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowHelp((h) => !h);
      } else if (e.key === 'Escape') setShowHelp(false);
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [mode]);

  const handleFilterChange = useCallback((f: FilterMode) => {
    setFilter(f);
    setCurrentIndex(0);
  }, []);

  const handleModeChange = useCallback((m: StudyMode) => {
    setMode(m);
    setCurrentIndex(0);
  }, []);

  const handleResetProgress = useCallback(async () => {
    try {
      await resetProgress();
      setProgress({ byWord: {}, todayCount: 0 });
    } catch {}
  }, []);

  const goalPct = Math.min(
    100,
    Math.round((progress.todayCount / dailyGoal) * 100)
  );

  const filterLabels: Record<FilterMode, string> = {
    all: 'All',
    due: 'Due',
    unknown: 'New',
    learning: 'Learning',
    known: 'Known',
  };

  const currentPairLabel = pair.toUpperCase().replace('-', ' → ');

  if (!topic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push('/')}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ← Back
          </button>
          <div className="flex-1">
            <h2 className="text-sm font-medium">{topic.name_he}</h2>
            <p className="text-xs text-slate-400">{currentPairLabel}</p>
          </div>
          <div className="text-sm font-mono text-slate-400">
            {total > 0 ? `${currentIndex + 1}/${total}` : '--'}
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">
              {progress.todayCount}/{dailyGoal}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
            {wordIds.length > 0 && (
              <>
                <div
                  className="inline-block h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${(stats.known / wordIds.length) * 100}%`,
                  }}
                />
                <div
                  className="inline-block h-full bg-amber-500 transition-all"
                  style={{
                    width: `${(stats.learning / wordIds.length) * 100}%`,
                  }}
                />
              </>
            )}
          </div>
          <div className="mt-1 flex gap-3 text-xs text-slate-500">
            <span>✅ {stats.known}</span>
            <span>📖 {stats.learning}</span>
            <span>⬜ {stats.unknown}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1">
            {(['flashcards', 'quiz', 'writing'] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  mode === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {m === 'flashcards'
                  ? '📇 Cards'
                  : m === 'quiz'
                  ? '❓ Quiz'
                  : '✍️ Write'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ? Help
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={reverse}
              onChange={(e) => setReverse(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 accent-indigo-600"
            />
            Reverse
          </label>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(filterLabels) as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  filter === f
                    ? 'bg-indigo-600/30 text-indigo-300'
                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>
          <button
            onClick={handleResetProgress}
            className="ml-auto rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-500 transition hover:bg-red-900/30 hover:text-red-400"
          >
            Reset
          </button>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-slate-400">
              🎉 All words learned with this filter!
            </p>
            <button
              onClick={() => handleFilterChange('all')}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Show All
            </button>
          </div>
        ) : mode === 'flashcards' ? (
          <>
            <Flashcard
              word={currentWord}
              reverse={reverse}
              onMark={handleMark}
              currentStatus={getStatus(currentWord.id)}
            />
            <div className="mt-4 flex justify-center gap-3">
              <VoiceButton
                expectedText={currentWord.hebrew}
                lang="he-IL"
                label={'🇮🇱 Hebrew'}
                onCorrect={handleQuizCorrect}
                onWrong={handleQuizWrong}
                dataAttr="data-voice-he"
              />
              <VoiceButton
                expectedText={currentWord.hungarian}
                lang="hu-HU"
                label={'🇭🇺 Hungarian'}
                onCorrect={handleQuizCorrect}
                onWrong={handleQuizWrong}
                dataAttr="data-voice-hu"
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={goPrev}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
              >
                ◀ Prev
              </button>
              <span className="text-xs text-slate-600">? = help</span>
              <button
                onClick={goNext}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
              >
                Next ▶
              </button>
            </div>
          </>
        ) : mode === 'quiz' ? (
          <QuizMode
            words={shuffled}
            reverse={reverse}
            onCorrect={handleQuizCorrect}
            onWrong={handleQuizWrong}
          />
        ) : (
          <WritingMode
            words={shuffled}
            reverse={reverse}
            onCorrect={handleQuizCorrect}
            onWrong={handleQuizWrong}
          />
        )}
      </div>

      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}

function Flashcard({
  word,
  reverse,
  onMark,
  currentStatus,
}: {
  word: Word;
  reverse: boolean;
  onMark: (status: WordStatus) => void;
  currentStatus?: WordStatus;
}) {
  const [flipped, setFlipped] = useState(false);

  const handleSpeak = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.hungarian);
    utterance.lang = 'hu-HU';
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }, [word.hungarian]);

  const frontText = reverse ? word.hebrew : word.hungarian;
  const backText = reverse ? word.hungarian : word.hebrew;

  return (
    <div className="flex flex-col items-center">
      <div
        data-flashcard
        onClick={() => setFlipped((f) => !f)}
        className="group relative w-full max-w-md cursor-pointer select-none"
      >
        <div
          className={`relative min-h-[200px] rounded-2xl border border-slate-700 bg-slate-800 p-8 transition-all duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center gap-4 [backface-visibility:hidden]">
            <span
              className="text-center text-3xl font-medium"
              dir={reverse ? 'rtl' : 'ltr'}
            >
              {frontText}
            </span>
            <div className="flex items-center gap-2">
              <button
                data-speak
                onClick={handleSpeak}
                className="rounded-full p-2 text-xl transition hover:bg-slate-700"
                title="Speak (S)"
              >
                🔊
              </button>
              <span className="text-xs text-slate-500">
                {reverse ? 'Click for Hungarian' : 'Click for translation'}
              </span>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span
              className="text-center text-3xl font-medium"
              dir={reverse ? 'ltr' : 'rtl'}
            >
              {backText}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => onMark('unknown')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            currentStatus === 'unknown'
              ? 'bg-red-600 text-white'
              : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
          }`}
        >
          Don't know ❌ (1)
        </button>
        <button
          onClick={() => onMark('learning')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            currentStatus === 'learning'
              ? 'bg-amber-600 text-white'
              : 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50'
          }`}
        >
          Learning 📖 (2)
        </button>
        <button
          onClick={() => onMark('known')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            currentStatus === 'known'
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
          }`}
        >
          Know ✅ (3)
        </button>
      </div>
    </div>
  );
}

function QuizMode({
  words,
  reverse,
  onCorrect,
  onWrong,
}: {
  words: Word[];
  reverse: boolean;
  onCorrect: () => void;
  onWrong: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [options, setOptions] = useState<string[]>([]);

  const currentWord = words[currentIndex];
  const total = words.length;
  const question = reverse ? currentWord.hebrew : currentWord.hungarian;
  const answer = reverse ? currentWord.hungarian : currentWord.hebrew;

  useEffect(() => {
    // shuffle functions are impure (Math.random), so defer setState
    queueMicrotask(() => {
      const others = words.filter((w) => w.id !== currentWord.id);
      const shuffledOthers = shuffleWords(others);
      const distractors = shuffledOthers
        .slice(0, 3)
        .map((w) => (reverse ? w.hungarian : w.hebrew));
      setOptions(shuffleOptions([...distractors, answer]));
    });
  }, [currentWord.id, answer, words, reverse]);

  const handleSelect = useCallback(
    (option: string) => {
      if (feedback) return;
      setSelected(option);
      if (option === answer) {
        setFeedback('correct');
        onCorrect();
      } else {
        setFeedback('wrong');
        onWrong();
      }
      setTimeout(() => {
        setSelected(null);
        setFeedback(null);
        setCurrentIndex((i) => (i + 1) % total);
      }, 800);
    },
    [answer, feedback, onCorrect, onWrong, total]
  );

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 text-center">
        <div className="mb-2 text-sm text-slate-400">
          {reverse ? 'Translate to Hungarian' : 'What is the translation?'}
        </div>
        <div
          className="text-3xl font-medium"
          dir={reverse ? 'rtl' : 'ltr'}
        >
          {question}
        </div>
      </div>
      <div className="grid w-full max-w-md grid-cols-1 gap-3">
        {options.map((opt) => {
          let cls =
            'rounded-xl border px-5 py-3 text-lg font-medium transition';
          if (feedback && opt === answer) {
            cls += ' border-emerald-500 bg-emerald-500/20 text-emerald-300';
          } else if (feedback && opt === selected && opt !== answer) {
            cls += ' border-red-500 bg-red-500/20 text-red-300';
          } else {
            cls +=
              ' border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-700';
          }
          const firstChar = opt[0] ?? '';
          const isRtl = /[֐-׿]/.test(firstChar);
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={feedback !== null}
              className={cls}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <div className="mt-4 text-sm text-slate-500">
        {currentIndex + 1} / {total}
      </div>
    </div>
  );
}

function WritingMode({
  words,
  reverse,
  onCorrect,
  onWrong,
}: {
  words: Word[];
  reverse: boolean;
  onCorrect: () => void;
  onWrong: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentWord = words[currentIndex];
  const total = words.length;

  const prompt = reverse ? currentWord.hebrew : currentWord.hungarian;
  const answer = reverse ? currentWord.hungarian : currentWord.hebrew;

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentIndex]);

  const check = useCallback(() => {
    if (showAnswer) {
      setShowAnswer(false);
      setInput('');
      setFeedback(null);
      setCurrentIndex((i) => (i + 1) % total);
      return;
    }

    const normalized = input.trim().toLowerCase();
    const correct = answer.toLowerCase();

    if (normalized === correct) {
      setFeedback('correct');
      onCorrect();
      setTimeout(() => {
        setShowAnswer(false);
        setInput('');
        setFeedback(null);
        setCurrentIndex((i) => (i + 1) % total);
      }, 600);
    } else {
      setFeedback('wrong');
      setShowAnswer(true);
      onWrong();
    }
  }, [input, answer, showAnswer, onCorrect, onWrong, total]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') check();
  };

  const firstAnswerChar = answer[0] ?? '';
  const answerIsRtl = /[֐-׿]/.test(firstAnswerChar);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 text-center">
        <div className="mb-2 text-sm text-slate-400">
          {reverse ? 'Write in Hungarian' : 'Write the translation'}
        </div>
        <div
          className="text-3xl font-medium"
          dir={reverse ? 'rtl' : 'ltr'}
        >
          {prompt}
        </div>
      </div>
      <div className="flex w-full max-w-md gap-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type here..."
          disabled={feedback === 'correct'}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          dir={reverse ? 'ltr' : answerIsRtl ? 'rtl' : 'ltr'}
          className={`flex-1 rounded-xl border px-4 py-3 text-lg bg-transparent outline-none transition ${
            feedback === 'correct'
              ? 'border-emerald-500 text-emerald-300'
              : feedback === 'wrong'
              ? 'border-red-500 text-red-300'
              : 'border-slate-700 text-slate-200 focus:border-indigo-500'
          }`}
        />
        <button
          onClick={check}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          {showAnswer ? 'Next ▶' : 'Check ✓'}
        </button>
      </div>
      {showAnswer && (
        <div className="mt-4 text-center">
          <span className="text-sm text-slate-400">Answer: </span>
          <span
            className="text-xl font-medium"
            dir={reverse ? 'ltr' : 'rtl'}
          >
            {answer}
          </span>
        </div>
      )}
      <div className="mt-4 text-sm text-slate-500">
        {currentIndex + 1} / {total}
      </div>
    </div>
  );
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: Array<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
}

interface SpeechRecognitionError {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function useVoiceRecognition({
  expectedText,
  lang,
  onCorrect,
  onWrong,
}: {
  expectedText: string;
  lang: string;
  onCorrect: () => void;
  onWrong: () => void;
}) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    transcript: string;
    correct: boolean;
  } | null>(null);
  const [partial, setPartial] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const listeningRef = useRef(false);
  const callbacksRef = useRef({ onCorrect, onWrong, expectedText, lang });

  useEffect(() => {
    callbacksRef.current = { onCorrect, onWrong, expectedText, lang };
  });

  const start = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setResult({
        transcript: 'Browser not supported - try Chrome',
        correct: false,
      });
      window.setTimeout(() => setResult(null), 3000);
      return;
    }
    if (listeningRef.current) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = callbacksRef.current.lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      transcript = transcript.trim();

      const expected = callbacksRef.current.expectedText
        .replace(/[\/\(\)]/g, '')
        .trim()
        .toLowerCase();
      const spoken = transcript
        .replace(/[\.\,\?\!]/g, '')
        .trim()
        .toLowerCase();
      const correct =
        spoken.includes(expected) || expected.includes(spoken);

      setPartial(transcript);

      if (correct) {
        setProcessing(false);
        setResult({ transcript, correct: true });
        setPartial(null);
        callbacksRef.current.onCorrect();
        try {
          recognition.stop();
        } catch {}
        window.setTimeout(() => setResult(null), 2500);
      } else if (isFinal && transcript.length > 0) {
        setProcessing(false);
        setResult({ transcript, correct: false });
        setPartial(null);
        callbacksRef.current.onWrong();
        try {
          recognition.stop();
        } catch {}
        window.setTimeout(() => setResult(null), 2500);
      }
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      setListening(false);
      listeningRef.current = false;
      const err = event.error || 'unknown';
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone denied',
        'no-speech': 'No speech detected',
        aborted: 'Aborted',
        network: 'Network error',
        'audio-capture': 'No microphone found',
        'service-not-allowed': 'Blocked by browser',
      };
      setResult({
        transcript: messages[err] || `Error: ${err}`,
        correct: false,
      });
      window.setTimeout(() => setResult(null), 4000);
    };

    recognition.onend = () => {
      setListening(false);
      setProcessing(true);
      listeningRef.current = false;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setResult({ transcript: 'Microphone error', correct: false });
      window.setTimeout(() => setResult(null), 3000);
      return;
    }
    listeningRef.current = true;
    setListening(true);
    setProcessing(false);
    setResult(null);
    setPartial(null);

    window.setTimeout(() => {
      try {
        recognition.stop();
      } catch {}
    }, 8000);
  }, []);

  const stop = useCallback(() => {
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
    } catch {}
    setListening(false);
    listeningRef.current = false;
  }, []);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  return { listening, processing, result, partial, toggle } as const;
}

function VoiceButton({
  expectedText,
  lang,
  label,
  onCorrect,
  onWrong,
  dataAttr,
}: {
  expectedText: string;
  lang: string;
  label: string;
  onCorrect: () => void;
  onWrong: () => void;
  dataAttr: string;
}) {
  const { listening, processing, result, partial, toggle } =
    useVoiceRecognition({ expectedText, lang, onCorrect, onWrong });

  let btnClass =
    'rounded-lg px-4 py-2 text-sm font-medium transition min-w-[140px]';
  let display = label;

  if (result?.correct) {
    btnClass += ' bg-emerald-600 text-white';
    display = '✅';
  } else if (result && !result.correct) {
    btnClass += ' bg-red-600 text-white';
    display = '❌';
  } else if (listening) {
    btnClass += ' bg-red-600 text-white animate-pulse';
    display = '\uD83C\uDF99\uFE0F Recording...';
  } else if (processing) {
    btnClass += ' bg-slate-700 text-slate-300';
    display = '\u23F3 Processing...';
  } else {
    btnClass += ' bg-slate-800 text-slate-300 hover:bg-slate-700';
  }

  const extraProps: Record<string, string> = {};
  extraProps[dataAttr] = 'true';

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        {...extraProps}
        onClick={toggle}
        onContextMenu={(e) => e.preventDefault()}
        className={btnClass}
      >
        {display}
      </button>
      {listening && !result && (
        <div className="text-xs text-slate-400">
          \uD83D\uDD34 Recording &mdash; speak now
          {partial && (
            <span>
              {' '}
              &mdash; heard: <em>{partial}</em>
            </span>
          )}
        </div>
      )}
      {processing && !result && (
        <div className="text-xs text-slate-500">\u23F3 Identifying...</div>
      )}
      {result && (
        <div
          className={`text-xs ${
            result.correct ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {result.correct ? '✅ Correct' : '❌ Incorrect'}
          {' \u2014 '}
          heard: <strong>{result.transcript}</strong>
        </div>
      )}
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:text-white"
          >
            \u2715
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {([
              ['◀ ▶', 'Navigate cards'],
              ['Space', 'Flip card'],
              ['1', "Don't know"],
              ['2', 'Learning'],
              ['3', 'Know'],
              ['S', 'Speak aloud'],
              ['V', 'Record Hebrew'],
              ['P', 'Record Hungarian'],
              ['?', 'Show/hide help'],
              ['Esc', 'Close'],
            ] as const).map(([key, desc]) => (
              <tr
                key={key}
                className="border-b border-slate-700 last:border-b-0"
              >
                <td className="py-2 pr-4 font-mono font-bold text-indigo-400">
                  {key}
                </td>
                <td className="py-2 text-slate-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
          <p>Loading...</p>
        </div>
      }
    >
      <StudyPageInner />
    </Suspense>
  );
}
