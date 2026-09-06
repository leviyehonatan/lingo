import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL, TOPIC_ID } from './fixtures';
import { disableSpeech } from './speech';
import { seedWord, words } from './session';

/**
 * The app records how a review went, not only how it ended: how many times a
 * word has been shown, how long the answer took, how it arrived, and how often
 * a known word came back forgotten.
 */

async function progressRow(page: Page, wordId: string) {
  const res = await page.request.get('/api/progress');
  const body = (await res.json()) as {
    progress: { word_id: string; seen_count: number; lapses: number }[];
  };
  return body.progress.find((row) => row.word_id === wordId);
}

async function stats(page: Page) {
  const res = await page.request.get('/api/stats');
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    met: number;
    known: number;
    shaky: number;
    reviews: number;
    accuracy: number | null;
    medianLatencyMs: number | null;
    activeDays: number;
  };
}

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
  await disableSpeech(page);
});

test('counts every showing, including the one that introduced the word', async ({
  page,
}) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  const taught = (await page.locator('[data-card-prompt]').innerText()).trim();
  const wordId = (await words(page, TOPIC_ID)).find((w) => w.hungarian === taught)!.id;

  await page.locator('[data-teach-got]').click();
  await expect.poll(async () => (await progressRow(page, wordId))?.seen_count).toBe(1);

  // The same word, asked for later in the sitting, is a second showing.
  await page.locator('[data-session-next]').click();
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-teach-got]').click();
    await page.locator('[data-session-next]').click();
  }
  await page.locator('[data-session-reveal]').click();
  await page.locator('[data-grade="known"]').click();

  await expect.poll(async () => (await progressRow(page, wordId))?.seen_count).toBe(2);
});

test('times the answer, and says how it arrived', async ({ page }) => {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  // Take a beat before answering, so the recorded time is unmistakably real.
  await page.waitForTimeout(1200);
  await page.locator('[data-session-reveal]').click();
  await page.locator('[data-grade="known"]').click();

  await expect.poll(async () => (await stats(page)).reviews).toBe(1);
  const measured = await stats(page);
  expect(measured.medianLatencyMs).toBeGreaterThan(1000);
  expect(measured.medianLatencyMs).toBeLessThan(60_000);
  expect(measured.accuracy).toBe(1);
});

test('counts a word that was known and came back forgotten', async ({ page }) => {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();
  await page.locator('[data-session-reveal]').click();
  await page.locator('[data-grade="unknown"]').click();

  await expect.poll(async () => (await progressRow(page, word.id))?.lapses).toBe(1);
  await expect.poll(async () => (await stats(page)).shaky).toBe(1);
});

test('shows the learner how it is going, once there is something to show', async ({
  page,
}) => {
  await page.goto(STUDY_URL);
  await expect(page.locator('[data-stats]')).toContainText('עוד אין מספיק נתונים');

  await page.locator('[data-session-start]').click();
  await page.locator('[data-teach-got]').click();
  await page.locator('[data-session-end]').click();
  await page.locator('[data-summary-again]').click();

  await expect(page.locator('[data-stats-met]')).toContainText('1 מילים פגשתם');
});

test('an anonymous visitor gets no statistics', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const res = await page.request.get('/api/stats');
  expect(res.status()).toBe(401);
  await context.close();
});
