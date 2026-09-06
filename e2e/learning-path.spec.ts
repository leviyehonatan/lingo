import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL } from './fixtures';
import { disableSpeech } from './speech';

/**
 * A learner cannot say a word they have never met, so the session teaches
 * before it tests, and it decides the sitting itself rather than handing over a
 * grid of filters.
 */

async function progressRows(page: Page) {
  const res = await page.request.get('/api/progress');
  return ((await res.json()) as { progress: { word_id: string; status: string }[] })
    .progress;
}

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
  await disableSpeech(page);
});

test('offers one sitting, and says what is in it', async ({ page }) => {
  await page.goto(STUDY_URL);
  // Nothing has been met yet, so the whole sitting is new words.
  await expect(page.locator('[data-plan-headline]')).toHaveText('5 מילים חדשות');
  await expect(page.locator('[data-session-start]')).toContainText('5');

  // The filters still exist, but out of the way.
  await expect(page.locator('[data-session-options]')).toHaveCount(0);
  await page.locator('[data-options-toggle]').click();
  await expect(page.locator('[data-session-options]')).toBeVisible();
});

test('teaches a word it has never asked about, instead of testing it', async ({ page }) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();

  await expect(page.locator('[data-teach-badge]')).toBeVisible();
  await expect(page.locator('[data-session-task]')).toHaveText(
    'הכירו את המילה ואמרו אותה בקול'
  );
  // The answer is on screen from the start: this is not a question.
  await expect(page.locator('[data-card-answer]')).toBeVisible();
  // And the app offers to say it, having already said it once.
  await expect(page.locator('[data-speak]')).toBeVisible();
  await expect(page.locator('[data-session-reveal]')).toHaveCount(0);
  await expect(page.locator('[data-grade="known"]')).toHaveCount(0);
});

test('a word met this sitting comes back as a question before it ends', async ({ page }) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  const taught = (await page.locator('[data-card-prompt]').innerText()).trim();

  // Meeting it puts it on the schedule as something being learned. It is not
  // a grade, so there is nothing to correct and nothing calling it "almost".
  await page.locator('[data-teach-got]').click();
  await expect(page.locator('[data-introduced]')).toHaveText('נוסף למילים שלכם');
  await expect(page.locator('[data-verdict]')).toHaveCount(0);
  await expect(page.locator('[data-override="known"]')).toHaveCount(0);
  await expect(page.locator('[data-verdict-interval]')).toHaveText('חוזרת בעוד 10 דקות');
  await expect.poll(async () => (await progressRows(page))[0]?.status).toBe('learning');

  // The sitting grew by one: the word returns at the end, as a question.
  await expect(page.locator('[data-session-position]')).toHaveText('כרטיס 1 מתוך 6');

  await page.locator('[data-session-next]').click();
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-teach-got]').click();
    await page.locator('[data-session-next]').click();
  }

  await expect(page.locator('[data-card-prompt]')).toHaveText(taught);
  await expect(page.locator('[data-teach-badge]')).toHaveCount(0);
  await expect(page.locator('[data-card-answer]')).toHaveCount(0);
  await expect(page.locator('[data-session-reveal]')).toBeVisible();
});

test('the second sitting does not re-teach what the first one taught', async ({ page }) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  const taught = (await page.locator('[data-card-prompt]').innerText()).trim();
  await page.locator('[data-teach-got]').click();
  await expect.poll(async () => (await progressRows(page)).length).toBe(1);

  await page.locator('[data-session-end]').click();
  await page.locator('[data-summary-again]').click();

  // It is not due for ten minutes, so the next sitting introduces new words
  // instead, and the plan says as much.
  await expect(page.locator('[data-plan-headline]')).toHaveText('5 מילים חדשות');
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-card-prompt]')).not.toHaveText(taught);
});

test('says so when there is nothing to practise, without pretending otherwise', async ({
  page,
}) => {
  // Meet every word the sitting offers, then keep going until none are due.
  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await expect(page.locator('[data-plan-empty]')).toBeVisible();
  await expect(page.locator('[data-plan-ahead]')).toBeVisible();
});

test('says the Hungarian aloud when it is on screen, and never leaks an answer', async ({
  page,
}) => {
  const spoken: string[] = [];
  await page.exposeFunction('__spoke', (text: string) => {
    spoken.push(text);
  });
  await page.addInitScript(() => {
    // Speech synthesis has no observable effect in a headless browser, so
    // record what the page asks it to say.
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: { text: string }) {
          (window as never as { __spoke: (t: string) => void }).__spoke(utterance.text);
        },
      },
    });
    (window as never as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      class {
        text: string;
        lang = '';
        rate = 1;
        constructor(text: string) {
          this.text = text;
        }
      };
  });

  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  const shown = (await page.locator('[data-card-prompt]').innerText()).trim();

  // A new word is read to the learner before they are asked to repeat it.
  // React re-runs effects in development, and each utterance cancels the last,
  // so assert what was said rather than how many times.
  await expect.poll(() => spoken.length).toBeGreaterThan(0);
  expect(new Set(spoken)).toEqual(new Set([shown]));

  const before = spoken.length;
  await page.locator('[data-speak]').click();
  await expect.poll(() => spoken.length).toBeGreaterThan(before);
  expect(new Set(spoken)).toEqual(new Set([shown]));
});
