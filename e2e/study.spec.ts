import { expect, test } from '@playwright/test';
import { TOPIC_ID } from './fixtures';
import { disableSpeech } from './speech';
import {
  endSession,
  openSetup,
  progress,
  promptWord,
  seedWord,
  startDeck,
  words,
} from './session';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Scheduling and persistence, through the self-grading path a browser without
 * speech recognition gets. The spoken path is covered in speaking.spec.ts, and
 * teaching a word for the first time in learning-path.spec.ts.
 *
 * These need words the learner has already met, since a session only asks
 * about those, so each case seeds one through the API and then drills that
 * group.
 */
test.describe('study session', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/progress');
    await disableSpeech(page);
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
    expect(await progress(page)).toEqual({ progress: [], daily: [] });
  });

  test('says what it is asking for at every step', async ({ page }) => {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');
    await openSetup(page);
    await startDeck(page, 'known');

    // Being asked: no answer and no grading on screen yet.
    await expect(page.locator('[data-session-task]')).toHaveText(
      'נזכרו במשמעות בעברית'
    );
    await expect(page.locator('[data-no-speech]')).toBeVisible();
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
    const [word] = await words(page, TOPIC_ID);
    // One review already, so this is the second rung of the known ladder.
    await seedWord(page, word.id, 'known');
    await openSetup(page);
    await startDeck(page, 'known');
    expect(await promptWord(page)).toBe(word.hungarian);

    const before = Date.now();
    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();

    await expect(page.locator('[data-verdict-interval]')).toHaveText('חוזרת בעוד 3 ימים');

    await expect.poll(async () => (await progress(page)).progress[0]?.review_count).toBe(2);
    const { progress: rows, daily } = await progress(page);
    const entry = rows[0];

    expect(rows).toHaveLength(1);
    expect(entry.word_id).toBe(word.id);
    expect(entry.status).toBe('known');
    expect(entry.last_reviewed).toBeGreaterThanOrEqual(before);
    // Rung two of the known ladder, computed by the server, not the client.
    expect(entry.next_review - entry.last_reviewed).toBe(3 * DAY);

    const today = new Date().toISOString().slice(0, 10);
    expect(daily).toEqual([{ date: today, count: 1 }]);
  });

  test('each review advances the schedule', async ({ page }) => {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');
    await openSetup(page);
    await startDeck(page, 'known');

    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect.poll(async () => (await progress(page)).progress[0]?.review_count).toBe(2);

    await endSession(page);
    await startDeck(page, 'known');
    await expect(page.locator('[data-session-position]')).toHaveText('כרטיס 1 מתוך 1');

    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect.poll(async () => (await progress(page)).progress[0]?.review_count).toBe(3);

    const { progress: rows, daily } = await progress(page);
    // Rung three: a week.
    expect(rows[0].next_review - rows[0].last_reviewed).toBe(7 * DAY);
    expect(daily[0].count).toBe(2);
    await expect(page.locator('[data-verdict-interval]')).toHaveText('חוזרת בעוד שבוע');
  });

  test('a wrong verdict can be overturned without charging a second review', async ({
    page,
  }) => {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');
    await openSetup(page);
    await startDeck(page, 'known');
    const shown = await promptWord(page);

    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="unknown"]').click();
    await expect.poll(async () => (await progress(page)).progress[0]?.status).toBe('unknown');

    await page.locator('[data-override="known"]').click();
    await expect.poll(async () => (await progress(page)).progress[0]?.status).toBe('known');

    const { progress: rows } = await progress(page);
    // Two reviews in total: the seeded one and this one. The correction is not
    // a third, so the word stays on the rung it earned.
    expect(rows[0].review_count).toBe(2);
    expect(rows[0].next_review - rows[0].last_reviewed).toBe(3 * DAY);

    // The card did not move underneath the learner.
    expect(await promptWord(page)).toBe(shown);
  });

  test('progress survives a reload and drives the plan', async ({ page }) => {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');

    await openSetup(page);
    await page.reload();
    await expect(page.locator('[data-session-setup]')).toBeVisible();

    await page.locator('[data-options-toggle]').click();
    await expect(page.locator('[data-deck="known"]')).toContainText('1 מילים');
  });

  test('the session ends with a summary of what was answered', async ({ page }) => {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');
    await openSetup(page);
    await startDeck(page, 'known');

    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect(page.locator('[data-verdict-interval]')).toBeVisible();
    await page.locator('[data-session-next]').click();

    // One card in this deck, so answering it ends the sitting on its own.
    await expect(page.locator('[data-session-summary]')).toBeVisible();
    await expect(page.locator('[data-tally="known"]')).toHaveText('1');
    await expect(page.locator('[data-tally="unknown"]')).toHaveText('0');
    await expect(page.locator('[data-summary-next]')).toContainText('בעוד 3 ימים');
  });

  test('resetting clears progress, and asks first', async ({ page }) => {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');
    await openSetup(page);

    // One click no longer wipes anything; it asks.
    await page.locator('[data-reset-open]').click();
    await expect(page.locator('[data-reset-confirm]')).toBeVisible();
    expect((await progress(page)).progress).toHaveLength(1);

    await page.locator('[data-reset-confirm]').click();
    await expect.poll(async () => (await progress(page)).progress.length).toBe(0);
    expect(await progress(page)).toEqual({ progress: [], daily: [] });
  });
});
