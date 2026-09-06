import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL } from './fixtures';

/**
 * Quiz and writing ask the question their own way, then hand over to the same
 * reveal, verdict and schedule as the cards. Grading used to be attributed to
 * whichever word the outer deck happened to be on rather than the one being
 * answered, so these check the answer lands on the word that was asked.
 */

async function openActivity(page: Page, activity: 'quiz' | 'writing') {
  await page.goto(STUDY_URL);
  await page.locator(`[data-activity="${activity}"]`).click();
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-card-prompt]')).toBeVisible();
}

async function answeredWordId(page: Page): Promise<string> {
  const res = await page.request.get('/api/progress');
  const body = (await res.json()) as { progress: { word_id: string }[] };
  return body.progress[0]?.word_id ?? '';
}

async function idFor(page: Page, hungarian: string): Promise<string> {
  const res = await page.request.get('/api/vocabulary?pair=hu-he');
  const levels = (await res.json()) as {
    topics: { words: { id: string; hungarian: string }[] }[];
  }[];
  const word = levels
    .flatMap((l) => l.topics)
    .flatMap((t) => t.words)
    .find((w) => w.hungarian === hungarian);
  return word?.id ?? '';
}

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
});

test('quiz records the word it asked about', async ({ page }) => {
  await openActivity(page, 'quiz');
  const asked = (await page.locator('[data-card-prompt]').innerText()).trim();

  const options = page.locator('[data-quiz-option]');
  await expect(options).toHaveCount(4);
  await options.first().click();

  // Whatever was picked, the verdict and the write are about the asked word.
  await expect(page.locator('[data-verdict]')).toBeVisible();
  await expect.poll(() => answeredWordId(page)).toBe(await idFor(page, asked));
});

test('writing accepts the answer and records the word it asked about', async ({ page }) => {
  await openActivity(page, 'writing');
  const asked = (await page.locator('[data-card-prompt]').innerText()).trim();

  // Answer it correctly by reading the expected answer off the vocabulary API.
  const res = await page.request.get('/api/vocabulary?pair=hu-he');
  const levels = (await res.json()) as {
    topics: { words: { hungarian: string; hebrew: string }[] }[];
  }[];
  const answer = levels
    .flatMap((l) => l.topics)
    .flatMap((t) => t.words)
    .find((w) => w.hungarian === asked)!.hebrew;

  await page.locator('[data-writing-input]').fill(answer);
  await page.locator('[data-writing-check]').click();

  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'learning'
  );
  await expect(page.locator('[data-card-answer]')).toBeVisible();
  await expect.poll(() => answeredWordId(page)).toBe(await idFor(page, asked));
});

test('a wrong typed answer is graded as not known', async ({ page }) => {
  await openActivity(page, 'writing');
  await page.locator('[data-writing-input]').fill('זהלאהתשובה');
  await page.locator('[data-writing-check]').click();
  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'unknown'
  );
});
