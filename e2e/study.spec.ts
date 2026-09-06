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

/** Opens the topic and stops on the screen that sets the session up. */
async function openSetup(page: Page) {
  await page.goto(STUDY_URL);
  await expect(page.locator('[data-session-setup]')).toBeVisible();
}

/** Sets a session going and waits for the first card. */
async function startSession(page: Page, deck?: string) {
  if (deck) await page.locator(`[data-deck="${deck}"]`).click();
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-flashcard]')).toBeVisible();
}

async function promptWord(page: Page): Promise<string> {
  return (await page.locator('[data-card-prompt]').innerText()).trim();
}

test.describe('study session', () => {
  test.beforeEach(async ({ page }) => {
    // Every case starts from a clean slate; the specs share one test user.
    await page.request.delete('/api/progress');
  });

  test('names the topic before anything is asked', async ({ page }) => {
    await openSetup(page);
    // Regression guard: the header used to read a field the API never sent.
    await expect(page.locator('[data-session-setup]')).toContainText(
      'ברכות וביטויים בסיסיים'
    );
  });

  test('starts with no recorded progress', async ({ page }) => {
    await openSetup(page);
    expect(await readProgress(page)).toEqual({ progress: [], daily: [] });
  });

  test('says what it is asking for at every step', async ({ page }) => {
    await openSetup(page);
    await startSession(page);

    // Being asked: no answer and no grading on screen yet.
    await expect(page.locator('[data-session-task]')).toHaveText(
      'נזכרים בתשובה ואומרים אותה בקול'
    );
    await expect(page.locator('[data-card-answer]')).toHaveCount(0);
    await expect(page.locator('[data-grade="known"]')).toHaveCount(0);

    await page.locator('[data-session-reveal]').click();
    await expect(page.locator('[data-session-task]')).toHaveText(
      'ידעתם? דרגו את עצמכם בכנות'
    );
    await expect(page.locator('[data-card-answer]')).toBeVisible();
    await expect(page.locator('[data-grade="known"]')).toBeVisible();
  });

  test('grading a card persists it and says when it comes back', async ({ page }) => {
    const idsByWord = await wordIdsByHungarian(page);
    await openSetup(page);
    await startSession(page);

    const shown = await promptWord(page);
    const expectedId = idsByWord.get(shown);
    expect(expectedId, `"${shown}" should be a seeded word`).toBeTruthy();

    const before = Date.now();
    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();

    // The verdict names the schedule the server just chose.
    await expect(page.locator('[data-verdict-interval]')).toHaveText('חוזרת בעוד יום');

    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);
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
    await openSetup(page);
    await startSession(page);
    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);

    // Back to setup, where the "known" deck now holds exactly that one word.
    await page.locator('[data-session-end]').click();
    await page.locator('[data-summary-again]').click();
    await expect(page.locator('[data-deck="known"]')).toContainText('1 מילים');

    await startSession(page, 'known');
    await expect(page.locator('[data-session-position]')).toHaveText('כרטיס 1 מתוך 1');

    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect
      .poll(async () => (await readProgress(page)).progress[0]?.review_count)
      .toBe(2);

    const { progress, daily } = await readProgress(page);
    expect(progress).toHaveLength(1);
    // Rung two of the "known" ladder, computed by the server, not the client.
    expect(progress[0].next_review - progress[0].last_reviewed).toBe(3 * DAY);
    expect(daily[0].count).toBe(2);
    await expect(page.locator('[data-verdict-interval]')).toHaveText('חוזרת בעוד 3 ימים');
  });

  test('a wrong verdict can be overturned', async ({ page }) => {
    await openSetup(page);
    await startSession(page);
    const shown = await promptWord(page);

    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="unknown"]').click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);
    expect((await readProgress(page)).progress[0].status).toBe('unknown');

    await page.locator('[data-override="known"]').click();
    await expect
      .poll(async () => (await readProgress(page)).progress[0]?.status)
      .toBe('known');

    // The card did not move, and the verdict now shows the longer schedule.
    expect(await promptWord(page)).toBe(shown);
    await expect(page.locator('[data-verdict-interval]')).toHaveText('חוזרת בעוד יום');
  });

  test('progress survives a reload and drives the deck counts', async ({ page }) => {
    await openSetup(page);
    await startSession(page);
    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);

    await page.reload();
    await expect(page.locator('[data-session-setup]')).toBeVisible();
    await expect(page.locator('[data-deck="known"]')).toContainText('1 מילים');
  });

  test('the session ends with a summary of what was answered', async ({ page }) => {
    await openSetup(page);
    await startSession(page);
    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect(page.locator('[data-verdict-interval]')).toBeVisible();
    await page.locator('[data-session-next]').click();

    await page.locator('[data-session-end]').click();
    await expect(page.locator('[data-session-summary]')).toBeVisible();
    await expect(page.locator('[data-tally="known"]')).toHaveText('1');
    await expect(page.locator('[data-tally="unknown"]')).toHaveText('0');
    await expect(page.locator('[data-summary-next]')).toContainText('בעוד יום');
  });

  test('resetting clears progress, and asks first', async ({ page }) => {
    await openSetup(page);
    await startSession(page);
    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(1);

    await page.locator('[data-session-end]').click();
    await page.locator('[data-summary-again]').click();

    // One click no longer wipes anything; it asks.
    await page.locator('[data-reset-open]').click();
    await expect(page.locator('[data-reset-confirm]')).toBeVisible();
    expect((await readProgress(page)).progress).toHaveLength(1);

    await page.locator('[data-reset-confirm]').click();
    await expect.poll(async () => (await readProgress(page)).progress.length).toBe(0);
    expect(await readProgress(page)).toEqual({ progress: [], daily: [] });
  });
});
