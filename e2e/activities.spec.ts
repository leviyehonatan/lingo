import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL, TOPIC_ID } from './fixtures';
import { seedWord, words } from './session';

/**
 * Quiz and writing ask the question their own way, then hand over to the same
 * reveal, verdict and schedule as the cards. Grading used to be attributed to
 * whichever word the outer deck happened to be on rather than the one being
 * answered, so these check the answer lands on the word that was asked.
 */

/**
 * Quiz and writing only ever ask about words the learner has met, so each case
 * seeds one and drills that group.
 */
async function openActivity(page: Page, activity: 'quiz' | 'writing') {
  const seeded = (await words(page, TOPIC_ID)).slice(0, 4);
  for (const word of seeded) await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator(`[data-activity="${activity}"]`).click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-card-prompt]')).toBeVisible();
}

/**
 * The word this answer landed on. Every word in the deck was seeded with one
 * review, so the one just answered is the one with two.
 */
async function reviewedTwice(page: Page): Promise<string[]> {
  const res = await page.request.get('/api/progress');
  const body = (await res.json()) as {
    progress: { word_id: string; review_count: number }[];
  };
  return body.progress.filter((row) => row.review_count === 2).map((row) => row.word_id);
}

async function idFor(page: Page, hungarian: string): Promise<string> {
  const all = await words(page, TOPIC_ID);
  return all.find((w) => w.hungarian === hungarian)?.id ?? '';
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
  await expect.poll(() => reviewedTwice(page)).toEqual([await idFor(page, asked)]);
});

test('writing accepts the answer and records the word it asked about', async ({ page }) => {
  await openActivity(page, 'writing');
  const asked = (await page.locator('[data-card-prompt]').innerText()).trim();

  // Answer it correctly by reading the expected answer off the vocabulary API.
  const answer = (await words(page, TOPIC_ID)).find((w) => w.hungarian === asked)!.hebrew;

  await page.locator('[data-writing-input]').fill(answer);
  await page.locator('[data-writing-check]').click();

  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'learning'
  );
  await expect(page.locator('[data-card-answer]')).toBeVisible();
  await expect.poll(() => reviewedTwice(page)).toEqual([await idFor(page, asked)]);
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
