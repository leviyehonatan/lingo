import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL } from './fixtures';
import { fakeSpeech, say, saySilence } from './speech';

/**
 * Speaking is how a learner demonstrates they know a word, so it decides the
 * grade. There is no microphone in CI, so these install a fake recognizer
 * before the page loads and make it say what each case needs.
 *
 * `window.__say(transcript)` speaks; `window.__silence()` hears nothing.
 */
async function startSession(page: Page) {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-flashcard]')).toBeVisible();
}

/** The Hebrew the card is expecting, looked up from the vocabulary API. */
async function expectedAnswer(page: Page): Promise<string> {
  const shown = (await page.locator('[data-card-prompt]').innerText()).trim();
  const res = await page.request.get('/api/vocabulary?pair=hu-he');
  const levels = (await res.json()) as {
    topics: { words: { hungarian: string; hebrew: string }[] }[];
  }[];
  return levels
    .flatMap((l) => l.topics)
    .flatMap((t) => t.words)
    .find((w) => w.hungarian === shown)!.hebrew;
}

async function progressRows(page: Page) {
  const res = await page.request.get('/api/progress');
  return ((await res.json()) as { progress: { status: string }[] }).progress;
}

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
  await fakeSpeech(page);
});

test('the card asks to be answered aloud before it shows anything', async ({ page }) => {
  await startSession(page);
  await expect(page.locator('[data-session-task]')).toHaveText('אמרו את התשובה בקול');
  await expect(page.locator('[data-speak-answer]')).toBeVisible();
  await expect(page.locator('[data-speak-practice]')).toBeVisible();
  // Nothing is graded and nothing is revealed until the learner acts.
  await expect(page.locator('[data-card-answer]')).toHaveCount(0);
  expect(await progressRows(page)).toHaveLength(0);
});

test('saying the answer marks it known and shows what was heard', async ({ page }) => {
  await startSession(page);
  const answer = await expectedAnswer(page);

  await page.locator('[data-speak-answer]').click();
  await say(page, answer);

  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'known'
  );
  await expect(page.locator('[data-verdict-heard]')).toContainText(answer);
  await expect(page.locator('[data-verdict-interval]')).toHaveText('חוזרת בעוד יום');
  await expect.poll(async () => (await progressRows(page))[0]?.status).toBe('known');
});

test('saying the wrong thing marks it not known, and can be overturned', async ({ page }) => {
  await startSession(page);

  await page.locator('[data-speak-answer]').click();
  await say(page, 'משהו אחר');

  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'unknown'
  );
  await expect(page.locator('[data-verdict-heard]')).toContainText('משהו אחר');
  await expect.poll(async () => (await progressRows(page))[0]?.status).toBe('unknown');

  await page.locator('[data-override="known"]').click();
  await expect.poll(async () => (await progressRows(page))[0]?.status).toBe('known');
});

test('silence counts as not knowing it', async ({ page }) => {
  await startSession(page);
  await page.locator('[data-speak-answer]').click();
  await saySilence(page);

  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'unknown'
  );
  await expect(page.locator('[data-verdict-heard]')).toHaveText('לא שמענו כלום');
});

test('pronunciation practice never touches the schedule', async ({ page }) => {
  await startSession(page);
  const shown = (await page.locator('[data-card-prompt]').innerText()).trim();

  await page.locator('[data-speak-practice]').click();
  await say(page, shown);

  // Still being asked, nothing graded, nothing written.
  await expect(page.locator('[data-session-task]')).toHaveText('אמרו את התשובה בקול');
  await expect(page.locator('[data-verdict]')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await progressRows(page)).toHaveLength(0);
});

test('asking for the answer admits you did not know it', async ({ page }) => {
  await startSession(page);
  await expect(page.locator('[data-session-reveal]')).toContainText('לא נזכרתי');

  await page.locator('[data-session-reveal]').click();
  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'unknown'
  );
  await expect(page.locator('[data-card-answer]')).toBeVisible();
  await expect.poll(async () => (await progressRows(page))[0]?.status).toBe('unknown');
});

test('the summary counts what was said aloud', async ({ page }) => {
  await startSession(page);
  const answer = await expectedAnswer(page);
  await page.locator('[data-speak-answer]').click();
  await say(page, answer);
  await expect(page.locator('[data-verdict]')).toBeVisible();

  await page.locator('[data-session-end]').click();
  await expect(page.locator('[data-summary-spoken]')).toContainText('1 אמרתם בקול');
});

test('a browser that cannot hear falls back to self-grading', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });
  await startSession(page);

  await expect(page.locator('[data-no-speech]')).toBeVisible();
  await expect(page.locator('[data-speak-answer]')).toHaveCount(0);

  // The three grades are still there, as the manual path.
  await page.locator('[data-session-reveal]').click();
  await expect(page.locator('[data-grade="known"]')).toBeVisible();
  await page.locator('[data-grade="known"]').click();
  await expect.poll(async () => (await progressRows(page))[0]?.status).toBe('known');
});
