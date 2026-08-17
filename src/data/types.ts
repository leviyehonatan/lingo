export interface Word {
  id: string;
  hungarian: string;
  hebrew: string;
  partOfSpeech?: string;
}

export interface Topic {
  id: string;
  name: string;
  nameHe: string;
  words: Word[];
}

export interface Level {
  id: string;
  name: string;
  nameHe: string;
  topics: Topic[];
}

export type WordStatus = 'known' | 'unknown' | 'learning';

export interface WordProgress {
  status: WordStatus;
  lastReviewed: number;
  reviewCount: number;
  nextReview: number;
}

export type Progress = Record<string, WordProgress>;

export interface DailyRecord {
  date: string;
  count: number;
}

export type FilterMode = 'all' | 'unknown' | 'learning' | 'known' | 'due';

export type StudyMode = 'flashcards' | 'quiz' | 'writing';
