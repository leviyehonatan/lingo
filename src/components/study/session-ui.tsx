'use client';

/**
 * The screens of a guided study session: what you are about to do, what you are
 * doing right now, and what it cost.
 *
 * Every screen states its task in a sentence. The previous study screen showed
 * fifteen controls at once and never said which of them the moment called for.
 */

import { useState } from 'react';
import type { WordStatus } from '@/lib/progress';
import type { FilterMode } from '@/lib/study';
import { humanizeInterval } from '@/lib/interval';
import type { SessionAnswer, SessionCard, SessionStage, SessionSummary } from '@/lib/session';
import { formatDelay, he as t } from '@/i18n/translations';

export type Direction = 'forward' | 'reverse';
export type Activity = 'cards' | 'quiz' | 'writing';

const DECKS: readonly FilterMode[] = ['due', 'unknown', 'learning', 'known', 'all'];

const DECK_LABELS: Record<FilterMode, string> = {
  due: t.filterDue,
  unknown: t.filterUnknown,
  learning: t.filterLearning,
  known: t.filterKnown,
  all: t.filterAll,
};

const ACTIVITIES: readonly { id: Activity; label: string; hint: string }[] = [
  { id: 'cards', label: t.activityCards, hint: t.activityCardsHint },
  { id: 'quiz', label: t.activityQuiz, hint: t.activityQuizHint },
  { id: 'writing', label: t.activityWriting, hint: t.activityWritingHint },
];

const VERDICT: Record<WordStatus, { label: string; tone: string }> = {
  known: { label: t.verdictKnown, tone: 'text-emerald-300' },
  learning: { label: t.verdictLearning, tone: 'text-amber-300' },
  unknown: { label: t.verdictUnknown, tone: 'text-red-300' },
};

const GRADES: readonly { status: WordStatus; label: string; key: string; tone: string }[] = [
  { status: 'unknown', label: t.dontKnow, key: '1', tone: 'bg-red-900/30 text-red-300 hover:bg-red-900/60' },
  { status: 'learning', label: t.learning, key: '2', tone: 'bg-amber-900/30 text-amber-300 hover:bg-amber-900/60' },
  { status: 'known', label: t.know, key: '3', tone: 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/60' },
];

/** Direction decides which language is on the prompt side of every card. */
export function promptIsHungarian(direction: Direction): boolean {
  return direction === 'forward';
}

function dirAttr(isHungarian: boolean): 'ltr' | 'rtl' {
  return isHungarian ? 'ltr' : 'rtl';
}

/* ------------------------------------------------------------------ setup */

export function SessionSetup({
  topicName,
  deckCounts,
  direction,
  onDirectionChange,
  deck,
  onDeckChange,
  activity,
  onActivityChange,
  todayCount,
  dailyGoal,
  sessionSize,
  onStart,
  onReset,
}: {
  topicName: string;
  deckCounts: Record<FilterMode, number>;
  direction: Direction;
  onDirectionChange: (d: Direction) => void;
  deck: FilterMode;
  onDeckChange: (f: FilterMode) => void;
  activity: Activity;
  onActivityChange: (a: Activity) => void;
  todayCount: number;
  dailyGoal: number;
  /** Cap on one sitting, so the button promises what the session delivers. */
  sessionSize: number;
  onStart: () => void;
  onReset: () => void;
}) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const available = Math.min(deckCounts[deck], sessionSize);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8" data-session-setup>
      <h1 className="text-2xl font-bold">{t.sessionSetupTitle}</h1>
      <p className="mt-1 text-sm text-slate-400">{topicName}</p>
      <p className="mt-1 text-xs text-slate-500">
        {t.sessionToday(todayCount, dailyGoal)}
      </p>

      <Fieldset legend={t.sessionDirection}>
        <div className="grid gap-2">
          {(['forward', 'reverse'] as const).map((d) => (
            <Choice
              key={d}
              selected={direction === d}
              onClick={() => onDirectionChange(d)}
              data-direction={d}
              label={d === 'forward' ? t.directionForward : t.directionReverse}
            />
          ))}
        </div>
      </Fieldset>

      <Fieldset legend={t.sessionDeck}>
        <div className="grid gap-2 sm:grid-cols-2">
          {DECKS.map((f) => (
            <Choice
              key={f}
              selected={deck === f}
              onClick={() => onDeckChange(f)}
              data-deck={f}
              label={DECK_LABELS[f]}
              hint={t.deckCount(deckCounts[f])}
            />
          ))}
        </div>
      </Fieldset>

      <Fieldset legend={t.sessionActivity}>
        <div className="grid gap-2">
          {ACTIVITIES.map((a) => (
            <Choice
              key={a.id}
              selected={activity === a.id}
              onClick={() => onActivityChange(a.id)}
              data-activity={a.id}
              label={a.label}
              hint={a.hint}
            />
          ))}
        </div>
      </Fieldset>

      {available === 0 ? (
        <p className="mt-8 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-center text-sm text-slate-400">
          {t.sessionEmpty}
        </p>
      ) : (
        <button
          data-session-start
          onClick={onStart}
          className="mt-8 w-full rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
        >
          {t.sessionStart(available)}
        </button>
      )}

      <div className="mt-10 border-t border-slate-800 pt-4">
        {confirmingReset ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400">{t.resetConfirm}</span>
            <button
              data-reset-confirm
              onClick={() => {
                setConfirmingReset(false);
                onReset();
              }}
              className="rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/70"
            >
              {t.resetDo}
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800"
            >
              {t.resetCancel}
            </button>
          </div>
        ) : (
          <button
            data-reset-open
            onClick={() => setConfirmingReset(true)}
            className="text-xs text-slate-600 transition hover:text-red-400"
          >
            {t.resetProgress}
          </button>
        )}
      </div>
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {legend}
      </h2>
      {children}
    </section>
  );
}

function Choice({
  selected,
  onClick,
  label,
  hint,
  ...rest
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
} & React.ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3 text-right transition ${
        selected
          ? 'border-indigo-500 bg-indigo-600/20 text-white'
          : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
      }`}
    >
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
    </button>
  );
}

/* -------------------------------------------------------------- in session */

export function SessionHeader({
  topicName,
  position,
  total,
  onEnd,
}: {
  topicName: string;
  position: number;
  total: number;
  onEnd: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round(((position - 1) / total) * 100);
  return (
    <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      {/* The account chip floats over the inline-end corner, so the session's
          own controls stay on the start side and the row keeps that corner
          clear. */}
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3 pe-40">
        <button
          data-session-end
          onClick={onEnd}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          {t.sessionEnd}
        </button>
        <div className="min-w-0 flex-1">
          {/* On a narrow screen the chip owns that corner; the position is
              what the learner needs mid-session, so the topic name gives way. */}
          <p className="hidden truncate text-sm font-medium sm:block">{topicName}</p>
          <p data-session-position className="text-xs text-slate-400">
            {t.sessionCardPosition(position, total)}
          </p>
        </div>
      </div>
      <div className="h-1 bg-slate-800">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GuidedCard({
  card,
  stage,
  answer,
  direction,
  onSpeak,
  onReveal,
  onGrade,
  onOverride,
  onNext,
}: {
  card: SessionCard;
  stage: SessionStage;
  answer: SessionAnswer | undefined;
  direction: Direction;
  onSpeak: () => void;
  onReveal: () => void;
  onGrade: (status: WordStatus) => void;
  onOverride: (status: WordStatus) => void;
  onNext: () => void;
}) {
  const promptHu = promptIsHungarian(direction);
  const task =
    stage === 'prompt' ? t.taskRecall : stage === 'reveal' ? t.taskGrade : t.taskVerdict;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <p data-session-task className="mb-5 text-center text-sm text-slate-400">
        {task}
      </p>

      <div
        data-flashcard
        className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-10 text-center"
      >
        <span
          data-card-prompt
          className="block text-3xl font-medium"
          dir={dirAttr(promptHu)}
        >
          {card.prompt}
        </span>
        <button
          data-speak
          onClick={onSpeak}
          className="mt-3 rounded-full p-2 text-lg transition hover:bg-slate-700"
          title={t.keySpeak}
        >
          🔊
        </button>

        {stage !== 'prompt' && (
          <>
            <div className="mx-auto my-5 h-px w-16 bg-slate-700" />
            <span
              data-card-answer
              className="block text-3xl font-medium text-indigo-200"
              dir={dirAttr(!promptHu)}
            >
              {card.answer}
            </span>
          </>
        )}
      </div>

      {stage === 'prompt' && (
        <button
          data-session-reveal
          onClick={onReveal}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
        >
          {t.revealAnswer}
        </button>
      )}

      {stage === 'reveal' && (
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {GRADES.map((grade) => (
            <button
              key={grade.status}
              data-grade={grade.status}
              onClick={() => onGrade(grade.status)}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${grade.tone}`}
            >
              {grade.label}
              <span className="ms-2 text-xs opacity-60">{grade.key}</span>
            </button>
          ))}
        </div>
      )}

      {stage === 'feedback' && answer && (
        <Verdict answer={answer} onOverride={onOverride} onNext={onNext} />
      )}
    </div>
  );
}

function Verdict({
  answer,
  onOverride,
  onNext,
}: {
  answer: SessionAnswer;
  onOverride: (status: WordStatus) => void;
  onNext: () => void;
}) {
  const verdict = VERDICT[answer.status];
  const others = GRADES.filter((g) => g.status !== answer.status);

  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <p data-verdict className={`text-center text-sm font-medium ${verdict.tone}`}>
        {verdict.label}
        {answer.nextReview !== null && (
          <>
            {' · '}
            <span data-verdict-interval className="text-slate-300">
              {t.verdictReturn(
                formatDelay(t, humanizeInterval(answer.nextReview - answer.answeredAt))
              )}
            </span>
          </>
        )}
      </p>
      {answer.nextReview === null && (
        <p className="mt-1 text-center text-xs text-red-400">{t.verdictUnsaved}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-slate-500">
          {answer.corrected ? t.overrideDone : t.overrideAsk}
        </span>
        {others.map((grade) => (
          <button
            key={grade.status}
            data-override={grade.status}
            onClick={() => onOverride(grade.status)}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500"
          >
            {grade.label}
          </button>
        ))}
      </div>

      <button
        data-session-next
        onClick={onNext}
        className="mt-5 w-full rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
      >
        {t.sessionNext}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- summary */

export function SessionSummaryScreen({
  summary,
  onAgain,
  onLeave,
}: {
  summary: SessionSummary;
  onAgain: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10" data-session-summary>
      <h1 className="text-2xl font-bold">{t.summaryTitle}</h1>

      {summary.total === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t.summaryNothing}</p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            <Tally tone="text-emerald-300" label={t.know} value={summary.known} attr="known" />
            <Tally tone="text-amber-300" label={t.learning} value={summary.learning} attr="learning" />
            <Tally tone="text-red-300" label={t.dontKnow} value={summary.unknown} attr="unknown" />
          </dl>
          {summary.soonestDelay !== null && (
            <p data-summary-next className="mt-6 text-sm text-slate-400">
              {t.summaryNext(formatDelay(t, humanizeInterval(summary.soonestDelay)))}
            </p>
          )}
        </>
      )}

      <div className="mt-8 flex gap-3">
        <button
          data-summary-again
          onClick={onAgain}
          className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          {t.summaryAgain}
        </button>
        <button
          data-summary-leave
          onClick={onLeave}
          className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          {t.summaryTopics}
        </button>
      </div>
    </div>
  );
}

function Tally({
  label,
  value,
  tone,
  attr,
}: {
  label: string;
  value: number;
  tone: string;
  attr: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd data-tally={attr} className={`mt-1 text-2xl font-bold ${tone}`}>
        {value}
      </dd>
    </div>
  );
}
