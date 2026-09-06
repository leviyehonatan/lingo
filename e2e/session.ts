import { expect, type Page } from '@playwright/test';
import { PAIR, STUDY_URL } from './fixtures';

/**
 * Helpers for driving a study session.
 *
 * A session decides its own contents: words that are due, then a few new ones.
 * A spec that needs a word already met has to say so, which is what
 * `seedWord` is for, and a spec that needs a specific group opens the options
 * and picks it.
 */

export interface ProgressEntry {
  word_id: string;
  status: string;
  last_reviewed: number;
  review_count: number;
  next_review: number;
}

export async function progress(page: Page) {
  const res = await page.request.get('/api/progress');
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    progress: ProgressEntry[];
    daily: { date: string; count: number }[];
  };
}

/** Record a review through the API, so a word counts as already met. */
export async function seedWord(page: Page, wordId: string, status: string) {
  const res = await page.request.put(`/api/progress/${wordId}`, { data: { status } });
  expect(res.status()).toBe(200);
}

export async function words(page: Page, topicId: string) {
  const res = await page.request.get(`/api/vocabulary?pair=${PAIR}`);
  const levels = (await res.json()) as {
    topics: { id: string; words: { id: string; hungarian: string; hebrew: string }[] }[];
  }[];
  const topic = levels.flatMap((l) => l.topics).find((t) => t.id === topicId);
  expect(topic, `topic ${topicId} should be seeded`).toBeTruthy();
  return topic!.words;
}

export async function openSetup(page: Page) {
  await page.goto(STUDY_URL);
  await expect(page.locator('[data-session-setup]')).toBeVisible();
}

/** Start the sitting the app recommends. */
export async function startPlanned(page: Page) {
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-flashcard]')).toBeVisible();
}

/** Override the sitting and drill one group instead. */
export async function startDeck(page: Page, deck: string) {
  await page.locator('[data-options-toggle]').click();
  await page.locator(`[data-deck="${deck}"]`).click();
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-flashcard]')).toBeVisible();
}

export async function promptWord(page: Page): Promise<string> {
  return (await page.locator('[data-card-prompt]').innerText()).trim();
}

/** Back to the setup screen from inside a sitting. */
export async function endSession(page: Page) {
  await page.locator('[data-session-end]').click();
  await page.locator('[data-summary-again]').click();
  await expect(page.locator('[data-session-setup]')).toBeVisible();
}

/**
 * Take a moment before answering, so the schedule does not read the answer as
 * effortless.
 *
 * An answer under a couple of seconds is evidence the interval was too short,
 * and stretches it. A test that clicks in milliseconds looks exactly like a
 * learner who knew the word instantly, which is not what these cases are about.
 *
 * The page's clock is moved rather than the test being made to wait: the app
 * measures the delay with `Date.now()` inside the page, so this is the same
 * measurement a real pause would produce, and it costs no time. Needs
 * `useTestClock` in the spec's setup.
 */
export async function answerAtHumanSpeed(page: Page, ms = 3000) {
  await page.clock.fastForward(ms);
}

/**
 * Install the controllable clock. Call before navigating, so the page reads it
 * from the start.
 */
export async function useTestClock(page: Page) {
  await page.clock.install();
}
