import { expect, test, type Page } from '@playwright/test';
import { PAIR, STUDY_URL, TOPIC_ID } from './fixtures';

interface ProgressEntry {
  word_id: string;
  status: string;
  last_reviewed: number;
  review_count: number;
  next_review: number;
}

interface ProgressPayload {
  progress: ProgressEntry[];
  daily: { date: string; count: number }[];
}

const DAY = 24 * 60 * 60 * 1000;

async function readProgress(page: Page): Promise<ProgressPayload> {
  const res = await page.request.get('/api/progress');
  expect(res.status()).toBe(200);
  return res.json();
}

/** Maps the Hungarian word shown on a card back to its id. */
async function wordIdsByHungarian(page: Page): Promise<Map<string, string>> {
  const res = await page.request.get(`/api/vocabulary?pair=${PAIR}`);
  expect(res.status()).toBe(200);
  const levels = (await res.json()) as {
    topics: { id: string; words: { id: string; hungarian: string }[] }[];
  }[];
  const topic = levels.flatMap((l) => l.topics).find((t) => t.id === TOPIC_ID);
  expect(topic, `topic ${TOPIC_ID} should be seeded`).toBeTruthy();
  return new Map(topic!.words.map((w) => [w.hungarian, w.id]));
}

async function openStudyPage(page: Page) {
  await page.goto(STUDY_URL);
  // The card only appears once vocabulary and progress have loaded.
  await expect(page.locator('[data-flashcard]')).toBeVisible();
}

test.describe('study session', () => {
  test.beforeEach(async ({ page }) => {
    // Every case starts from a clean slate; the specs share one test user.
    await page.request.delete('/api/progress');
  });

  test('shows the topic name in the header', async ({ page }) => {
    await openStudyPage(page);
    // Regression guard: the header used to read a field the API never sent.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      'ברכות וביטויים בסיסיים'
    );
  });

  test('starts with no recorded progress', async ({ page }) => {
    await openStudyPage(page);
    expect(await readProgress(page)).toEqual({ progress: [], daily: [] });
  });

  test('marking a card as Known persists it', async ({ page }) => {
    const idsByWord = await wordIdsByHungarian(page);
    await openStudyPage(page);

    const shownWord = (await page.locator('[data-flashcard] span').first().innerText()).trim();
    const expectedId = idsByWord.get(shownWord);
    expect(expectedId, `"${shownWord}" should be a seeded word`).toBeTruthy();

    const before = Date.now();
    await page.getByRole('button', { name: /Know ✅/ }).click();

    // Poll until the write lands: the click fires the request in the background.
    await expect
      .poll(async () => (await readProgress(page)).progress.length)
      .toBe(1);

    const { progress, daily } = await readProgress(page);
    const entry = progress[0];

    expect(entry.word_id).toBe(expectedId);
    expect(entry.status).toBe('known');
    expect(entry.review_count).toBe(1);
    expect(entry.last_reviewed).toBeGreaterThanOrEqual(before);

    // A first "known" answer is scheduled a day out by the interval ladder.
    expect(entry.next_review - entry.last_reviewed).toBe(DAY);

    const today = new Date().toISOString().slice(0, 10);
    expect(daily).toEqual([{ date: today, count: 1 }]);
  });

  test('a second review of the same word advances the schedule', async ({ page }) => {
    await openStudyPage(page);

    await page.getByRole('button', { name: /Know ✅/ }).click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);

    // The Known filter leaves exactly the card that was just marked, so the
    // next click is a second review of the same word.
    await page.getByRole('button', { name: 'Known', exact: true }).click();
    await expect(page.getByText('1/1')).toBeVisible();

    await page.getByRole('button', { name: /Know ✅/ }).click();
    await expect
      .poll(async () => (await readProgress(page)).progress[0]?.review_count)
      .toBe(2);

    const { progress, daily } = await readProgress(page);
    expect(progress).toHaveLength(1);
    // Rung two of the "known" ladder, computed by the server, not the client.
    expect(progress[0].next_review - progress[0].last_reviewed).toBe(3 * DAY);
    expect(daily[0].count).toBe(2);
  });

  test('progress survives a reload and drives the Known filter', async ({ page }) => {
    await openStudyPage(page);
    await page.getByRole('button', { name: /Know ✅/ }).click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);

    const { progress } = await readProgress(page);
    const knownId = progress[0].word_id;

    await page.reload();
    await expect(page.locator('[data-flashcard]')).toBeVisible();

    await page.getByRole('button', { name: 'Known', exact: true }).click();
    await expect(page.locator('[data-flashcard]')).toBeVisible();

    // Exactly one card sits in the Known filter after the reload.
    await expect(page.getByText('1/1')).toBeVisible();
    expect(knownId).toBeTruthy();
  });

  test('resetting clears progress and the daily count', async ({ page }) => {
    await openStudyPage(page);
    await page.getByRole('button', { name: /Know ✅/ }).click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);

    const res = await page.request.delete('/api/progress');
    expect(res.status()).toBe(200);

    expect(await readProgress(page)).toEqual({ progress: [], daily: [] });
  });
});
