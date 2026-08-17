export interface WordData {
  id: string;
  hungarian: string;
  hebrew: string;
}

export interface TopicData {
  id: string;
  name: string;
  name_he: string;
  words: WordData[];
}

export interface LevelData {
  id: string;
  name: string;
  nameHe: string;
  sourceLang: string;
  targetLang: string;
  topics: TopicData[];
}

export interface LangPair {
  id: string;
  source_lang: string;
  target_lang: string;
  source_name: string;
  target_name: string;
}

export interface ProgressEntry {
  word_id: string;
  status: 'known' | 'unknown' | 'learning';
  last_reviewed: number;
  review_count: number;
  next_review: number;
}

export interface DailyEntry {
  date: string;
  count: number;
}

export interface ProgressData {
  progress: ProgressEntry[];
  daily: DailyEntry[];
}

export interface UpdateProgressResponse {
  nextReview: number;
}

export interface RecordDailyResponse {
  count: number;
}
