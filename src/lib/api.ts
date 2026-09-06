import type { ReviewTelemetry } from './telemetry';
import type { LearnerStats } from './stats';
import type {
  LangPair,
  LevelData,
  ProgressData,
  ProgressEntry,
  UpdateProgressResponse,
  RecordDailyResponse,
} from './api-types';

export type { LangPair, LevelData, ProgressData, ProgressEntry, UpdateProgressResponse, RecordDailyResponse };

const BASE = '/api';

export async function fetchPairs(): Promise<LangPair[]> {
  const res = await fetch(`${BASE}/vocabulary/pairs`);
  if (!res.ok) throw new Error('Failed to fetch pairs');
  return res.json();
}

export async function fetchVocabulary(pair: string): Promise<LevelData[]> {
  const res = await fetch(`${BASE}/vocabulary?pair=${encodeURIComponent(pair)}`);
  if (!res.ok) throw new Error('Failed to fetch vocabulary');
  return res.json();
}

export async function fetchProgress(): Promise<ProgressData> {
  const res = await fetch(`${BASE}/progress`);
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
}

/**
 * Record one review. `correction` re-grades the review just recorded rather
 * than adding another, so overturning a verdict does not advance the ladder.
 *
 * `telemetry` says how the answer arrived and how long it took. It is optional
 * and never load-bearing: a review is recorded either way.
 */
export async function updateProgress(
  wordId: string,
  status: string,
  correction = false,
  telemetry?: ReviewTelemetry
): Promise<UpdateProgressResponse> {
  const res = await fetch(`${BASE}/progress/${wordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      ...(correction ? { correction: true } : {}),
      ...(telemetry ?? {}),
    }),
  });
  if (!res.ok) throw new Error('Failed to update progress');
  return res.json();
}

export async function resetProgress(): Promise<void> {
  const res = await fetch(`${BASE}/progress`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to reset progress');
}

export async function recordDaily(count: number): Promise<RecordDailyResponse> {
  const res = await fetch(`${BASE}/progress/daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });
  if (!res.ok) throw new Error('Failed to record daily');
  return res.json();
}

/** How the learner is doing overall, for the setup screen. */
export async function fetchStats(): Promise<LearnerStats> {
  const res = await fetch(`${BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}
