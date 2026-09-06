'use client';

/**
 * The screens of a guided study session: what you are about to do, what you are
 * doing right now, and what it cost.
 *
 * Every screen states its task in a sentence. The previous study screen showed
 * fifteen controls at once and never said which of them the moment called for.
 */

import { useEffect, useRef, useState } from 'react';
import type { WordStatus } from '@/lib/progress';
import type { FilterMode } from '@/lib/study';
import { humanizeInterval } from '@/lib/interval';
import { RECALL_WINDOW_MS, secondsLeft, windowState } from '@/lib/recall-window';
import { maskAnswer, matchedWords } from '@/lib/answer-match';
import {
  SESSION_SIZES,
  STRICTNESS_LEVELS,
  STRICTNESS_THRESHOLD,
  type Preferences,
  type Strictness,
} from '@/lib/preferences';
import { SPEECH_RATES } from '@/lib/speech-voice';
import type { SessionPlan } from '@/lib/plan';
import type { LearnerStats } from '@/lib/stats';
import type {
  SessionAnswer,
  SessionAttempt,
  SessionCard,
  SessionStage,
  SessionSummary,
} from '@/lib/session';
import { SpeakButton, type SpokenResult } from '@/components/study/modes';
import { formatDelay, he as t } from '@/i18n/translations';

export type Direction = 'forward' | 'reverse';
export type Activity = 'cards' | 'quiz' | 'writing';

const DECKS: readonly FilterMode[] = ['due', 'unknown', 'learning', 'known', 'all'];

/**
 * How many times a card listens before it stops asking. Hands-free has to end
 * somewhere: one mishearing is not evidence of forgetting, but three in a row
 * with nothing else happening means the learner cannot be heard, and the
 * session should carry on rather than sit there listening.
 */
const MAX_SPOKEN_ATTEMPTS = 3;

/** How long to wait before listening again after a miss. */
const RETRY_DELAY_MS = 1200;

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
  plan,
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
  canListen,
  canSpeakHungarian,
  preferences,
  onPreferencesChange,
  stats,
  onStart,
  onReset,
}: {
  topicName: string;
  /** What the recommended sitting holds, before any override. */
  plan: SessionPlan;
  deckCounts: Record<FilterMode, number>;
  direction: Direction;
  onDirectionChange: (d: Direction) => void;
  /** Null while the learner is on the recommended path. */
  deck: FilterMode | null;
  onDeckChange: (f: FilterMode | null) => void;
  activity: Activity;
  onActivityChange: (a: Activity) => void;
  todayCount: number;
  dailyGoal: number;
  sessionSize: number;
  /** Whether the browser can hear at all, before the learner's own choice. */
  canListen: boolean;
  /** Whether the device has a Hungarian voice to read words with. */
  canSpeakHungarian: boolean;
  preferences: Preferences;
  onPreferencesChange: (change: Partial<Preferences>) => void;
  /** How the learner is doing, or null while it is still being fetched. */
  stats: LearnerStats | null;
  onStart: () => void;
  onReset: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const planned = plan.cards.length;
  const overridden = deck !== null;
  const available = overridden
    ? Math.min(deckCounts[deck], sessionSize)
    : planned;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8" data-session-setup>
      <h1 className="text-2xl font-bold">{t.sessionSetupTitle}</h1>
      <p className="mt-1 text-sm text-slate-400">{topicName}</p>
      <p className="mt-1 text-xs text-slate-500">
        {t.sessionToday(todayCount, dailyGoal)}
      </p>

      {/* One recommended sitting, described in a line. The learner should not
          have to assemble their own out of filters. */}
      <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
        {available === 0 ? (
          <>
            <p data-plan-empty className="text-sm text-slate-300">
              {t.planNothing}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t.planNothingHint(plan.waiting)}
            </p>
            <button
              data-plan-ahead
              onClick={() => {
                onDeckChange('all');
                setShowOptions(true);
              }}
              className="mt-4 w-full rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 transition hover:border-slate-500"
            >
              {t.planAheadCta}
            </button>
          </>
        ) : (
          <>
            <p data-plan-headline className="text-lg font-semibold">
              {overridden
                ? `${DECK_LABELS[deck]} · ${t.deckCount(available)}`
                : t.planHeadline(
                    plan.cards.filter((c) => c.mode === 'review').length,
                    plan.cards.filter((c) => c.mode === 'teach').length
                  )}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {overridden ? DECK_LABELS[deck] : t.planExplain}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {direction === 'forward' ? t.directionForward : t.directionReverse}
            </p>
            {canListen && !preferences.silent && (
              <label
                data-hands-free
                className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 p-3"
              >
                <input
                  type="checkbox"
                  data-hands-free-toggle
                  checked={preferences.handsFree}
                  onChange={(e) => onPreferencesChange({ handsFree: e.target.checked })}
                  className="mt-0.5 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-medium">{t.handsFree}</span>
                  <span className="block text-xs text-slate-400">
                    {t.handsFreeHint}
                  </span>
                </span>
              </label>
            )}
            <button
              data-session-start
              onClick={onStart}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
            >
              {t.sessionStart(available)}
            </button>
          </>
        )}
      </div>

      <button
        data-options-toggle
        onClick={() => setShowOptions((open) => !open)}
        className="mt-6 text-xs text-slate-500 transition hover:text-slate-300"
      >
        {showOptions ? t.optionsClose : t.optionsOpen}
      </button>

      {showOptions && (
        <div data-session-options>
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
              <Choice
                selected={!overridden}
                onClick={() => onDeckChange(null)}
                data-deck="plan"
                label={t.planExplain}
                hint={t.deckCount(planned)}
              />
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

          {canListen && (
            <Fieldset legend={t.strictness}>
              <div className="grid gap-2 sm:grid-cols-3">
                {STRICTNESS_LEVELS.map((level) => (
                  <Choice
                    key={level}
                    selected={preferences.strictness === level}
                    onClick={() => onPreferencesChange({ strictness: level })}
                    data-strictness={level}
                    label={
                      level === 'easy'
                        ? t.strictnessEasy
                        : level === 'normal'
                          ? t.strictnessNormal
                          : t.strictnessStrict
                    }
                  />
                ))}
              </div>
              <label
                data-silent
                className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 p-3"
              >
                <input
                  type="checkbox"
                  data-silent-toggle
                  checked={preferences.silent}
                  onChange={(e) => onPreferencesChange({ silent: e.target.checked })}
                  className="mt-0.5 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-medium">{t.silentMode}</span>
                  <span className="block text-xs text-slate-400">{t.silentModeHint}</span>
                </span>
              </label>
            </Fieldset>
          )}

          <Fieldset legend={t.speechRate}>
            {canSpeakHungarian ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {SPEECH_RATES.map((rate) => (
                  <Choice
                    key={rate}
                    selected={preferences.speechRate === rate}
                    onClick={() => onPreferencesChange({ speechRate: rate })}
                    data-rate={rate}
                    label={
                      rate === 0.6
                        ? t.speechSlow
                        : rate === 0.85
                          ? t.speechNormal
                          : t.speechFast
                    }
                  />
                ))}
              </div>
            ) : (
              <p data-no-voice className="rounded-xl border border-slate-700 p-3 text-xs">
                <span className="block font-medium text-amber-300">
                  {t.noHungarianVoice}
                </span>
                <span className="mt-1 block text-slate-400">
                  {t.noHungarianVoiceHint}
                </span>
              </p>
            )}
          </Fieldset>

          <Fieldset legend={t.sessionLength}>
            <div className="grid gap-2 sm:grid-cols-4">
              {SESSION_SIZES.map((size) => (
                <Choice
                  key={size}
                  selected={preferences.sessionSize === size}
                  onClick={() => onPreferencesChange({ sessionSize: size })}
                  data-size={size}
                  label={t.deckCount(size)}
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
        </div>
      )}

      {stats && <Progress stats={stats} />}

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

/**
 * The numbers that say whether this is working. Accuracy carries the method's
 * own reading of itself: a schedule holding between 90 and 95 percent is right,
 * and anything else is the intervals being wrong rather than the learner.
 */
function Progress({ stats }: { stats: LearnerStats }) {
  const pct = stats.accuracy === null ? null : Math.round(stats.accuracy * 100);
  const verdict =
    pct === null
      ? null
      : pct < 85
        ? t.statsAccuracyLow
        : pct > 97
          ? t.statsAccuracyHigh
          : t.statsAccuracyGood;

  return (
    <section data-stats className="mt-8 rounded-2xl border border-slate-800 p-4">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {t.statsTitle}
      </h2>
      {stats.met === 0 ? (
        <p className="text-xs text-slate-500">{t.statsEmpty}</p>
      ) : (
        <ul className="space-y-1 text-xs text-slate-400">
          <li data-stats-met>
            {t.statsMet(stats.met)} · {t.statsKnown(stats.known)}
            {stats.shaky > 0 && ` · ${t.statsShaky(stats.shaky)}`}
          </li>
          {pct !== null && (
            <li data-stats-accuracy>
              {t.statsAccuracy(pct)}
              <span className="ms-2 text-slate-600">{verdict}</span>
            </li>
          )}
          {stats.medianLatencyMs !== null && (
            <li data-stats-speed>
              {t.statsSpeed((stats.medianLatencyMs / 1000).toFixed(1))}
            </li>
          )}
          {stats.activeDays > 0 && <li>{t.statsDays(stats.activeDays)}</li>}
        </ul>
      )}
    </section>
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
  settled,
  total,
  onEnd,
}: {
  topicName: string;
  /** Words finished. Counted in words because the card queue grows. */
  settled: number;
  total: number;
  onEnd: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((settled / total) * 100);
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
            {t.sessionWordsLeft(settled, total)}
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
  heard,
  comesBack,
  direction,
  canListen,
  handsFree,
  strictness,
  hinted,
  onSpeak,
  onSpeakPractice,
  onHear,
  onShowAnswer,
  onGoSilent,
  onTaught,
  onGrade,
  onOverride,
  onNext,
}: {
  card: SessionCard;
  stage: SessionStage;
  answer: SessionAnswer | undefined;
  /** The last thing the learner said about this card, if anything. */
  heard: SessionAttempt | undefined;
  /** True when this word will be asked again before the round ends. */
  comesBack: boolean;
  direction: Direction;
  canListen: boolean;
  /** Listen without being asked, and move on once the learner has spoken. */
  handsFree: boolean;
  strictness: Strictness;
  /** True for a word met in this same sitting, which gets a look at the start
   * of its answer rather than being asked for it cold. */
  hinted: boolean;
  onSpeak: (result: SpokenResult) => void;
  onSpeakPractice: (result: SpokenResult) => void;
  /** Say the Hungarian aloud. */
  onHear: () => void;
  onShowAnswer: () => void;
  /** The learner giving up on being heard, for now. */
  onGoSilent: () => void;
  /** A new word has been met; it enters the schedule rather than being graded. */
  onTaught: () => void;
  onGrade: (status: WordStatus) => void;
  onOverride: (status: WordStatus) => void;
  onNext: () => void;
}) {
  const promptHu = promptIsHungarian(direction);
  const teaching = card.mode === 'teach' && stage === 'prompt';

  // What the learner said when repeating a new word, so a miss can say what it
  // heard and invite another go rather than silently doing nothing. Keyed by
  // card id below, so a new card starts with a clean slate.
  const [repeated, setRepeated] = useState<SpokenResult | null>(null);

  /**
   * A rejected utterance is not a failure to know the word: recognition is
   * unreliable, especially in Hebrew, and the learner may well have said it
   * right. Nothing is recorded until they say so.
   */
  const [missed, setMissed] = useState<SpokenResult | null>(null);
  const [attempts, setAttempts] = useState(0);

  /**
   * The recall window. It runs while the learner is being asked and nothing
   * else is happening, and running out counts as a miss rather than a failure:
   * the card stays, with the same choices a mishearing offers.
   */
  const [timedOut, setTimedOut] = useState(false);
  const asking = stage === 'prompt' && card.mode === 'review';
  useEffect(() => {
    if (!asking || timedOut || missed) return;
    const id = setTimeout(() => setTimedOut(true), RECALL_WINDOW_MS);
    return () => clearTimeout(id);
  }, [asking, timedOut, missed, card.id]);
  const spent = attempts >= MAX_SPOKEN_ATTEMPTS;

  const handleSpeak = (result: SpokenResult) => {
    setTimedOut(false);
    setMissed(result.accepted ? null : result);
    if (!result.accepted) {
      const used = attempts + 1;
      setAttempts(used);
      // Hands-free means hands-free even when it goes wrong: it listens again
      // on its own, and when it has run out of tries it records the failure
      // and carries on rather than waiting to be rescued.
      if (handsFree && used >= MAX_SPOKEN_ATTEMPTS) onGrade('unknown');
    }
    onSpeak(result);
  };

  const handleRepeat = (result: SpokenResult) => {
    setRepeated(result);
    onSpeakPractice(result);
    // A good repetition is the whole of this step, so it moves on by itself.
    if (result.accepted) {
      onTaught();
      return;
    }
    const used = attempts + 1;
    setAttempts(used);
    // Failing to be heard must not trap a learner on a word they are only
    // being introduced to; hands-free moves them on once it has tried.
    if (handsFree && used >= MAX_SPOKEN_ATTEMPTS) onTaught();
  };

  // Ears before mouth: the app says the Hungarian first, so the learner has
  // something to imitate rather than guessing from the spelling. Only when the
  // Hungarian is already on screen, so a review never leaks its own answer.
  const hungarianOnScreen = promptHu || card.mode === 'teach';
  const saidThisCard = useRef<string | null>(null);
  useEffect(() => {
    // Once per card. React runs effects twice in development, which is what
    // made the word play twice over itself with no gap.
    if (saidThisCard.current === card.id) return;
    saidThisCard.current = card.id;
    if (hungarianOnScreen && stage === 'prompt') onHear();
  }, [card.id, hungarianOnScreen, stage, onHear]);

  /**
   * How long to wait before opening the microphone on its own: long enough for
   * the app to finish saying the word, and to leave a beat of silence after it
   * so the learner is not talking over a voice.
   */
  const autoListenDelay = handsFree ? (hungarianOnScreen ? 1800 : 600) : null;

  /** After a miss, hands-free waits a moment and listens again by itself. */
  const handsFreeRetryDelay = handsFree ? RETRY_DELAY_MS : null;

  // Hands-free means the verdict is read, not clicked past. A new word gets
  // longer, because that panel is where its meaning is shown one last time.
  useEffect(() => {
    if (!handsFree || stage !== 'feedback') return;
    const id = setTimeout(onNext, card.mode === 'teach' ? 3500 : 2200);
    return () => clearTimeout(id);
  }, [handsFree, stage, onNext, card.id, card.mode]);
  // Which language the learner is being asked to produce, said out loud in the
  // task line rather than left to be inferred from the card.
  const answerIsHebrew = promptHu;
  const task = teaching
    ? t.teachLearnThis
    : stage === 'prompt'
      ? canListen
        ? answerIsHebrew
          ? t.taskSayMeaning
          : t.taskSayWord
        : answerIsHebrew
          ? t.taskRecallMeaning
          : t.taskRecallWord
      : stage === 'reveal'
        ? t.taskGrade
        : t.taskVerdict;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      {teaching && (
        <p
          data-teach-badge
          className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-indigo-300"
        >
          {t.teachTitle}
        </p>
      )}
      <p data-session-task className="mb-5 text-center text-sm text-slate-400">
        {task}
      </p>

      <div
        data-flashcard
        className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-10 text-center"
      >
        <span className="mb-1 block text-[0.7rem] uppercase tracking-wide text-slate-500">
          {promptHu ? t.langHungarian : t.langHebrew}
        </span>
        <span
          data-card-prompt
          className="block text-3xl font-medium"
          dir={dirAttr(promptHu)}
        >
          {card.prompt}
        </span>
        {hungarianOnScreen && (
          <button
            data-speak
            onClick={onHear}
            className="mx-auto mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-700 hover:text-white"
          >
            🔊 {t.hearAgain}
          </button>
        )}

        {(teaching || stage !== 'prompt') && (
          <>
            <div className="mx-auto my-5 h-px w-16 bg-slate-700" />
            <span className="mb-1 block text-[0.7rem] uppercase tracking-wide text-slate-500">
              {promptHu ? t.langHebrew : t.langHungarian}
              {' · '}
              {promptHu ? t.sideMeaning : t.sideWord}
            </span>
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

      {asking && hinted && <AnswerHint answer={card.answer} rtl={!promptHu} />}

      {asking && <RecallCountdown cardId={card.id} stopped={timedOut || Boolean(missed)} />}

      {asking && (
        <div className="mt-4">
        {timedOut && !missed && (
          <div
            data-time-up
            className="rounded-xl border border-amber-700/50 bg-amber-900/10 p-3"
          >
            <p className="text-center text-xs text-amber-300">{t.timeUp}</p>
            <p className="mt-1 text-center text-[0.7rem] text-slate-500">
              {t.timeUpHint}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                data-miss-knew
                onClick={() => onGrade('known')}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-emerald-300 transition hover:border-emerald-500"
              >
                {t.missKnew}
              </button>
              <button
                data-miss-didnt
                onClick={() => onGrade('unknown')}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-red-300 transition hover:border-red-500"
              >
                {t.missDidnt}
              </button>
            </div>
          </div>
        )}

        </div>
      )}

      {teaching && (
        <div className="mt-6 grid gap-3">
          {canListen ? (
            <>
              {/* Hearing a word teaches nothing on its own. Saying it back is
                  the step, so it is the primary action and it moves the card on
                  by itself when it lands. */}
              <SpeakButton
                key={card.id}
                expectedText={promptHu ? card.prompt : card.answer}
                lang="hu-HU"
                label={t.teachRepeatHu}
                hint={t.teachRepeatHint}
                listeningLabel={t.listeningRepeat}
                threshold={STRICTNESS_THRESHOLD[strictness]}
                graded
                dataAttr="data-teach-repeat"
                autoStartDelayMs={
                  spent ? null : repeated ? handsFreeRetryDelay : autoListenDelay
                }
                autoStartKey={attempts}
                onResult={handleRepeat}
              />
              {repeated && !repeated.accepted && (
                <p data-teach-retry className="text-center text-xs text-amber-300">
                  {t.teachRetry(repeated.heard)}
                  <span className="ms-2 text-slate-500">
                    {t.attemptCount(Math.min(attempts, MAX_SPOKEN_ATTEMPTS), MAX_SPOKEN_ATTEMPTS)}
                  </span>
                </p>
              )}
              <button
                data-teach-got
                onClick={onTaught}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-400 transition hover:border-slate-500"
              >
                {t.teachSkip}
              </button>
            </>
          ) : (
            <button
              data-teach-got
              onClick={onTaught}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
            >
              {t.teachGot}
            </button>
          )}
        </div>
      )}

      {!teaching && stage === 'prompt' && (
        <div className="mt-6 grid gap-3">
          {canListen ? (
            <>
              {/* The graded utterance: the answer, said before it is shown. */}
              <SpeakButton
                expectedText={card.answer}
                lang={promptHu ? 'he-IL' : 'hu-HU'}
                label={answerIsHebrew ? t.speakMeaningHe : t.speakWordHu}
                hint={t.speakAnswerHint}
                listeningLabel={answerIsHebrew ? t.listeningMeaning : t.listeningWord}
                threshold={STRICTNESS_THRESHOLD[strictness]}
                graded
                dataAttr="data-speak-answer"
                autoStartDelayMs={
                  spent ? null : missed ? handsFreeRetryDelay : autoListenDelay
                }
                autoStartKey={attempts}
                onResult={handleSpeak}
              />

              {spent && (
                <div
                  data-cannot-hear
                  className="rounded-xl border border-slate-700 bg-slate-800/60 p-3"
                >
                  <p className="text-center text-xs text-slate-300">{t.cannotHear}</p>
                  <p className="mt-1 text-center text-[0.7rem] text-slate-500">
                    {t.cannotHearHints}
                  </p>
                  <button
                    data-go-silent
                    onClick={onGoSilent}
                    className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500"
                  >
                    {t.cannotHearSwitch}
                  </button>
                </div>
              )}

              {missed && (
                <div
                  data-speak-missed
                  className="rounded-xl border border-amber-700/50 bg-amber-900/10 p-3"
                >
                  <p className="text-center text-xs text-amber-300">
                    {t.teachRetry(missed.heard)}
                  </p>
                  <p className="mt-1 text-center text-[0.7rem] text-slate-500">
                    {handsFree && !spent
                      ? t.attemptCount(
                          Math.min(attempts, MAX_SPOKEN_ATTEMPTS),
                          MAX_SPOKEN_ATTEMPTS
                        )
                      : t.missRetryHint}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      data-miss-knew
                      onClick={() => onGrade('known')}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-emerald-300 transition hover:border-emerald-500"
                    >
                      {t.missKnew}
                    </button>
                    <button
                      data-miss-didnt
                      onClick={() => onGrade('unknown')}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-red-300 transition hover:border-red-500"
                    >
                      {t.missDidnt}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p data-no-speech className="text-center text-xs text-slate-500">
              {t.noSpeech}
            </p>
          )}

          <button
            data-session-reveal
            onClick={onShowAnswer}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 transition hover:border-slate-500"
          >
            <span className="block font-medium">
              {canListen ? t.showAnswerCost : t.revealAnswer}
            </span>
            {canListen && (
              <span className="mt-0.5 block text-xs opacity-70">
                {t.showAnswerCostHint}
              </span>
            )}
          </button>
        </div>
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

      {stage === 'feedback' &&
        answer &&
        (card.mode === 'teach' ? (
          <Introduced
            card={card}
            promptHu={promptHu}
            answer={answer}
            spokeWell={repeated?.accepted ?? false}
            onNext={onNext}
          />
        ) : (
          <Verdict
            answer={answer}
            heard={heard}
            expected={card.answer}
            comesBack={comesBack}
            onOverride={onOverride}
            onNext={onNext}
          />
        ))}
    </div>
  );
}

/**
 * What a learner sees after meeting a word. No grade and no correction row:
 * they were not asked anything, so there is nothing to have got wrong.
 */
function Introduced({
  card,
  promptHu,
  answer,
  spokeWell,
  onNext,
}: {
  card: SessionCard;
  promptHu: boolean;
  answer: SessionAnswer;
  spokeWell: boolean;
  onNext: () => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      {/* The pair, once more and together: this is the last look before the
          word is asked for later in the sitting. */}
      <p data-introduced-pair className="mb-3 text-center text-lg">
        <span dir={dirAttr(promptHu)}>{card.prompt}</span>
        <span className="mx-2 text-slate-500">=</span>
        <span className="text-indigo-200" dir={dirAttr(!promptHu)}>
          {card.answer}
        </span>
      </p>
      {spokeWell && (
        <p data-teach-spoke className="mb-1 text-center text-xs text-emerald-300">
          {t.teachSpokeWell}
        </p>
      )}
      <p data-introduced className="text-center text-sm font-medium text-indigo-200">
        {t.teachRecorded}
      </p>
      <p className="mt-1 text-center text-xs text-slate-400">{t.teachRequeued}</p>
      {answer.intervalMs !== null && (
        <p className="mt-1 text-center text-xs text-slate-500">
          <span data-verdict-interval>
            {t.verdictReturn(formatDelay(t, humanizeInterval(answer.intervalMs)))}
          </span>
        </p>
      )}
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

/**
 * The last seconds of the recall window, drawn only once they are worth
 * knowing about. Earlier than that it would rush a learner who is answering
 * perfectly well.
 */
/**
 * The start of the answer, for a word met earlier in this same sitting.
 *
 * Speak fades its scaffolding rather than switching it off: the sentence is
 * shown, then progressively covered, then asked for cold. This is the middle
 * rung, and it exists because meeting a word and then being asked for it with
 * nothing at all is a cliff.
 */
function AnswerHint({ answer, rtl }: { answer: string; rtl: boolean }) {
  const [shown, setShown] = useState(false);

  if (!shown) {
    return (
      <button
        data-hint-show
        onClick={() => setShown(true)}
        className="mx-auto mt-4 block rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-500"
      >
        {t.hintShow}
      </button>
    );
  }

  return (
    <p data-hint className="mt-4 text-center text-sm text-slate-400">
      <span className="text-slate-600">{t.hintLabel}: </span>
      <span className="font-mono text-lg text-slate-300" dir={rtl ? 'rtl' : 'ltr'}>
        {maskAnswer(answer)}
      </span>
    </p>
  );
}

function RecallCountdown({ cardId, stopped }: { cardId: string; stopped: boolean }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [stopped, cardId]);

  const state = windowState(stopped ? null : startedAt, now);
  if (!state.visible) return null;

  return (
    <div data-recall-window className="mt-4">
      <div className="h-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-amber-500 transition-all duration-200"
          style={{ width: `${Math.round(state.fraction * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-center text-[0.7rem] text-slate-500">
        {t.windowHint(secondsLeft(state))}
      </p>
    </div>
  );
}

function Verdict({
  answer,
  heard,
  expected,
  comesBack,
  onOverride,
  onNext,
}: {
  answer: SessionAnswer;
  heard: SessionAttempt | undefined;
  /** The answer the utterance was judged against, for per-word feedback. */
  expected: string;
  /** True when this word is queued to be asked again before the round ends. */
  comesBack: boolean;
  onOverride: (status: WordStatus) => void;
  onNext: () => void;
}) {
  const verdict = VERDICT[answer.status];
  const others = GRADES.filter((g) => g.status !== answer.status);

  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      {heard && (
        <p data-verdict-heard className="mb-2 text-center text-xs text-slate-400">
          {heard.heard ? t.verdictHeard(heard.heard) : t.verdictHeardNothing}
        </p>
      )}
      {heard?.heard && expected && (
        <p data-word-feedback className="mb-2 text-center text-sm">
          {matchedWords(heard.heard, expected).map((match, index) => (
            <span
              key={`${match.word}-${index}`}
              data-word-heard={match.heard ? 'true' : 'false'}
              className={`mx-1 ${match.heard ? 'text-emerald-300' : 'text-slate-500 line-through'}`}
            >
              {match.word}
            </span>
          ))}
        </p>
      )}
      <p
        data-verdict
        data-verdict-status={answer.status}
        className={`text-center text-sm font-medium ${verdict.tone}`}
      >
        <span data-verdict-label>{verdict.label}</span>
        {answer.intervalMs !== null && (
          <>
            {' · '}
            <span data-verdict-interval className="text-slate-300">
              {t.verdictReturn(formatDelay(t, humanizeInterval(answer.intervalMs)))}
            </span>
          </>
        )}
      </p>
      {answer.intervalMs === null && (
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

      {comesBack && (
        <p data-verdict-again className="mt-3 text-center text-xs text-indigo-300">
          {t.sessionWordBack}
        </p>
      )}

      <p className="mt-2 text-center text-[0.7rem] text-slate-600">
        {t.overrideHint}
      </p>

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
          <p data-summary-spoken className="mt-4 text-center text-xs text-slate-500">
            {t.summarySpoken(summary.recalledAloud)}
            {summary.pronounced > 0 && ` · ${t.summaryPronounced(summary.pronounced)}`}
          </p>
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
