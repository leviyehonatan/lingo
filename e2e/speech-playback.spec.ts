import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL } from './fixtures';
import { disableSpeech } from './speech';

/**
 * The app reads Hungarian with the browser's own synthesis, which costs nothing
 * per word and can be slowed down. The catch it has to handle: a browser asked
 * for a language it has no voice for reads the text in some other accent
 * instead of refusing, which teaches the wrong sound.
 */

interface Spoken {
  text: string;
  rate: number;
  voice: string | null;
}

/** Replace speech synthesis with one that records what it was asked to say. */
async function recordSpeech(page: Page, voices: { name: string; lang: string }[]) {
  await page.addInitScript((available) => {
    (window as never as { __spoken: Spoken[] }).__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        getVoices: () => available,
        addEventListener() {},
        removeEventListener() {},
        speak(utterance: { text: string; rate: number; voice: { name: string } | null }) {
          (window as never as { __spoken: Spoken[] }).__spoken.push({
            text: utterance.text,
            rate: utterance.rate,
            voice: utterance.voice?.name ?? null,
          });
        },
      },
    });
    (window as never as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      class {
        text: string;
        lang = '';
        rate = 1;
        voice: unknown = null;
        constructor(text: string) {
          this.text = text;
        }
      };
  }, voices);
}

async function spoken(page: Page): Promise<Spoken[]> {
  return page.evaluate(() => (window as never as { __spoken: Spoken[] }).__spoken);
}

const hungarian = [
  { name: 'Tünde', lang: 'hu-HU' },
  { name: 'Carmit', lang: 'he-IL' },
];

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
  await disableSpeech(page);
});

test('reads the word with a Hungarian voice', async ({ page }) => {
  await recordSpeech(page, hungarian);
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();

  const shown = (await page.locator('[data-card-prompt]').innerText()).trim();
  await expect.poll(async () => (await spoken(page))[0]?.text).toBe(shown);
  expect((await spoken(page))[0].voice).toBe('Tünde');
});

test('says nothing at all rather than in the wrong accent', async ({ page }) => {
  await recordSpeech(page, [{ name: 'Carmit', lang: 'he-IL' }]);
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-card-prompt]')).toBeVisible();

  await page.waitForTimeout(500);
  expect(await spoken(page)).toEqual([]);

  // And it says why, instead of leaving a silent button that looks broken.
  await page.locator('[data-session-end]').click();
  await page.locator('[data-summary-again]').click();
  await page.locator('[data-options-toggle]').click();
  await expect(page.locator('[data-no-voice]')).toBeVisible();
});

test('reads at the speed the learner picked, and remembers it', async ({ page }) => {
  await recordSpeech(page, hungarian);
  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-rate="0.6"]').click();
  await page.locator('[data-session-start]').click();

  await expect.poll(async () => (await spoken(page))[0]?.rate).toBe(0.6);

  await page.reload();
  await page.locator('[data-options-toggle]').click();
  await expect(page.locator('[data-rate="0.6"]')).toHaveAttribute('aria-pressed', 'true');
});
