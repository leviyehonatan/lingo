'use client';

/**
 * How a question is asked, and the speech-recognition plumbing the answers use.
 *
 * Each activity asks about exactly one card and reports whether the learner got
 * it right. Revealing the answer, grading and the verdict are the session's job,
 * not theirs, so all three activities end in the same place.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { shuffle } from '@/lib/study';
import { matchesAnyAlternative, matchesExpected } from '@/lib/answer-match';
import type { SessionCard } from '@/lib/session';
import { he as t } from '@/i18n/translations';

export interface Word {
  id: string;
  hungarian: string;
  hebrew: string;
}

/** How many wrong options a multiple-choice question offers. */
const DISTRACTORS = 3;

export function QuizMode({
  card,
  pool,
  onAnswer,
}: {
  card: SessionCard;
  /** Answers of the other cards in this session, used as wrong options. */
  pool: readonly string[];
  onAnswer: (correct: boolean) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  // One shuffle per card: options must not move while the learner reads them.
  const options = useMemo(() => {
    const wrong = shuffle(pool.filter((answer) => answer !== card.answer)).slice(
      0,
      DISTRACTORS
    );
    return shuffle([...wrong, card.answer]);
  }, [card.answer, pool]);

  const pick = (option: string) => {
    if (chosen) return;
    setChosen(option);
    onAnswer(option === card.answer);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <p data-session-task className="mb-5 text-center text-sm text-slate-400">
        {t.quizTranslate}
      </p>
      <div
        data-flashcard
        className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-8 text-center"
      >
        <span data-card-prompt className="block text-3xl font-medium" dir="auto">
          {card.prompt}
        </span>
      </div>
      <div className="mt-6 grid gap-2">
        {options.map((option) => (
          <button
            key={option}
            data-quiz-option
            disabled={chosen !== null}
            onClick={() => pick(option)}
            dir="auto"
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-lg text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WritingMode({
  card,
  onAnswer,
}: {
  card: SessionCard;
  onAnswer: (correct: boolean) => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // State resets because the page keys these by card id; the effect only moves
  // the cursor into the box.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The same grader the spoken answers use, so typing and speaking agree on
  // what counts as the right answer.
  const check = () => onAnswer(matchesExpected(input, card.answer));

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <p data-session-task className="mb-5 text-center text-sm text-slate-400">
        {t.writingTranslate}
      </p>
      <div
        data-flashcard
        className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-8 text-center"
      >
        <span data-card-prompt className="block text-3xl font-medium" dir="auto">
          {card.prompt}
        </span>
      </div>
      <div className="mt-6 flex gap-3">
        <input
          ref={inputRef}
          data-writing-input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
          placeholder={t.writingPlaceholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          dir="auto"
          className="flex-1 rounded-xl border border-slate-700 bg-transparent px-4 py-3 text-lg text-slate-200 outline-none transition focus:border-indigo-500"
        />
        <button
          data-writing-check
          onClick={check}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          {t.writingCheck}
        </button>
      </div>
    </div>
  );
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  /** How many candidate transcripts this result carries. */
  length: number;
  [index: number]: SpeechRecognitionAlternative | undefined;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: Array<SpeechRecognitionResult>;
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

/** Nothing to listen with: Safari and Firefox ship no usable recognizer. */
export function speechAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export interface SpokenResult {
  heard: string;
  accepted: boolean;
}

type ListenState = 'idle' | 'listening' | 'thinking';

/**
 * One utterance, judged against what the card expects.
 *
 * The hook reports the outcome instead of deciding what it means: the session
 * decides whether an utterance was practice or the graded recall.
 */
function useListening({
  expectedText,
  lang,
  onResult,
}: {
  expectedText: string;
  lang: string;
  onResult: (result: SpokenResult) => void;
}) {
  const [state, setState] = useState<ListenState>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const settledRef = useRef(false);
  const latest = useRef({ expectedText, lang, onResult });

  useEffect(() => {
    latest.current = { expectedText, lang, onResult };
  });

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const start = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setError(t.errNoBrowser);
      return;
    }
    try {
      recognitionRef.current?.abort();
    } catch {}

    const recognition = new Ctor();
    recognition.lang = latest.current.lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    settledRef.current = false;

    const settle = (heard: string, accepted: boolean) => {
      if (settledRef.current) return;
      settledRef.current = true;
      setState('idle');
      setPartial('');
      latest.current.onResult({ heard, accepted });
      try {
        recognition.stop();
      } catch {}
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) isFinal = true;
      }
      transcript = transcript.trim();

      // The engine ranks several candidates and the answer is not always the
      // one it ranks first, so every candidate gets a chance.
      const candidates = new Set<string>();
      if (transcript) candidates.add(transcript);
      const newest = event.results[event.results.length - 1];
      for (let a = 0; a < (newest?.length ?? 0); a++) {
        const alternative = newest[a]?.transcript?.trim();
        if (alternative) candidates.add(alternative);
      }

      setPartial(transcript);
      const accepted = matchesAnyAlternative([...candidates], latest.current.expectedText);
      // A wrong guess is only final once the learner has stopped talking.
      if (accepted || (isFinal && transcript)) settle(transcript, accepted);
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      const messages: Record<string, string> = {
        'not-allowed': t.errNotAllowed,
        'no-speech': t.errNoSpeech,
        aborted: t.errAborted,
        network: t.errNetwork,
        'audio-capture': t.errAudioCapture,
        'service-not-allowed': t.errServiceNotAllowed,
      };
      setError(messages[event.error] ?? event.error);
      setState('idle');
      settledRef.current = true;
    };

    recognition.onend = () => {
      if (settledRef.current) return;
      // Silence counts as an answer the learner could not produce.
      settle('', false);
    };

    recognitionRef.current = recognition;
    setError(null);
    setPartial('');
    try {
      recognition.start();
    } catch {
      setError(t.errMicStart);
      return;
    }
    setState('listening');
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
    };
  }, []);

  return { state, partial, error, start, stop } as const;
}

/**
 * A button that listens once. `tone` says whether this utterance is the graded
 * one, because the learner should know that before pressing it.
 */
export function SpeakButton({
  expectedText,
  lang,
  label,
  hint,
  graded,
  dataAttr,
  listeningLabel,
  autoStartDelayMs = null,
  autoStartKey = 0,
  onResult,
}: {
  expectedText: string;
  lang: string;
  label: string;
  hint: string;
  /**
   * What the learner should say, shown while the microphone is open. A card
   * asks for one thing, and this is where it says which.
   */
  listeningLabel: string;
  graded: boolean;
  dataAttr: string;
  /**
   * Start listening on its own after this long, for hands-free study. Null
   * leaves it waiting to be pressed. The delay is what keeps the microphone
   * from opening while the app is still speaking.
   */
  autoStartDelayMs?: number | null;
  /**
   * Changes every time the caller wants another automatic listen. Without it,
   * a second miss with the same delay would leave the effect unchanged and the
   * microphone would never reopen.
   */
  autoStartKey?: number;
  onResult: (result: SpokenResult) => void;
}) {
  const { state, partial, error, start, stop } = useListening({
    expectedText,
    lang,
    onResult,
  });

  useEffect(() => {
    if (autoStartDelayMs === null) return;
    const id = setTimeout(start, autoStartDelayMs);
    return () => clearTimeout(id);
  }, [autoStartDelayMs, autoStartKey, start]);

  const listening = state === 'listening';
  const attrs: Record<string, string> = { [dataAttr]: 'true' };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        {...attrs}
        data-listening={listening ? 'true' : undefined}
        onClick={listening ? stop : start}
        className={`w-full rounded-xl px-5 py-4 text-base font-semibold transition ${
          listening
            ? 'animate-pulse border-2 border-red-400 bg-red-600 text-white'
            : graded
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
        }`}
      >
        <span className="block">{listening ? listeningLabel : label}</span>
        <span className="mt-1 block text-xs font-normal opacity-80">
          {listening ? t.listeningNow : hint}
        </span>
      </button>
      {partial && (
        <span data-voice-partial className="text-xs text-slate-400">
          {t.voiceHeard} {partial}
        </span>
      )}
      {error && (
        <span data-voice-error className="text-xs text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
