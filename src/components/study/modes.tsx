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
        transcript: t.errNoBrowser,
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
        transcript += event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) isFinal = true;
      }
      transcript = transcript.trim();

      // The engine ranks several candidates per utterance and the answer is
      // not always the one it ranks first, so every candidate for the latest
      // segment gets a chance alongside the transcript shown to the learner.
      const candidates = new Set<string>();
      if (transcript) candidates.add(transcript);
      const latest = event.results[event.results.length - 1];
      for (let a = 0; a < (latest?.length ?? 0); a++) {
        const alternative = latest[a]?.transcript?.trim();
        if (alternative) candidates.add(alternative);
      }

      const correct = matchesAnyAlternative(
        [...candidates],
        callbacksRef.current.expectedText
      );

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
        'not-allowed': t.errNotAllowed,
        'no-speech': t.errNoSpeech,
        aborted: t.errAborted,
        network: t.errNetwork,
        'audio-capture': t.errAudioCapture,
        'service-not-allowed': t.errServiceNotAllowed,
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
      setResult({ transcript: t.errMicStart, correct: false });
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

export function VoiceButton({
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
    display = t.voiceRecording;
  } else if (processing) {
    btnClass += ' bg-slate-700 text-slate-300';
    display = t.voiceProcessing;
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
          {t.voiceListeningMsg}
          {partial && (
            <span>
              {' '}
              &mdash; {t.voiceHeard} <em>{partial}</em>
            </span>
          )}
        </div>
      )}
      {processing && !result && (
        <div className="text-xs text-slate-500">{t.voiceProcessing}</div>
      )}
      {result && (
        <div
          className={`text-xs ${
            result.correct ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {result.correct ? t.voiceCorrect : t.voiceWrong}
          {' \u2014 '}
          {t.voiceHeard} <strong>{result.transcript}</strong>
        </div>
      )}
    </div>
  );
}
