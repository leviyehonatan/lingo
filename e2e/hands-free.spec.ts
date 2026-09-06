import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL, TOPIC_ID } from './fixtures';
import { fakeSpeech, say } from './speech';
import { seedWord, words } from './session';

/**
 * Hands-free: the app says the word, opens the microphone itself, and moves on
 * once the learner has spoken. Driven here by a fake recognizer, since CI has
 * no microphone.
 */

async function enableHandsFree(page: Page) {
  await page.locator('[data-hands-free-toggle]').check();
}

async function spokenWords(page: Page) {
  return page.evaluate(() => (window as never as { __spokenLog: string[] }).__spokenLog);
}

/** Record what the page asks the browser to say aloud. */
async function recordPlayback(page: Page) {
  await page.addInitScript(() => {
    (window as never as { __spokenLog: string[] }).__spokenLog = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        getVoices: () => [],
        speak(utterance: { text: string }) {
          (window as never as { __spokenLog: string[] }).__spokenLog.push(utterance.text);
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
  });
}

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
  await fakeSpeech(page);
  await recordPlayback(page);
});

test('says each word once, not twice over itself', async ({ page }) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  const shown = (await page.locator('[data-card-prompt]').innerText()).trim();

  await expect.poll(async () => (await spokenWords(page)).length).toBe(1);
  expect(await spokenWords(page)).toEqual([shown]);
});

test('opens the microphone on its own, after it has finished speaking', async ({
  page,
}) => {
  await page.goto(STUDY_URL);
  await enableHandsFree(page);
  await page.locator('[data-session-start]').click();

  // It waits: the word is read first, and the microphone opens after a beat.
  await expect(page.locator('[data-teach-repeat]')).not.toHaveAttribute(
    'data-listening',
    'true'
  );
  await expect(page.locator('[data-teach-repeat]')).toHaveAttribute(
    'data-listening',
    'true',
    { timeout: 5000 }
  );
  await expect(page.locator('[data-teach-repeat]')).toContainText(
    'חזרו על המילה בהונגרית'
  );
});

test('a spoken answer carries the session forward without a click', async ({ page }) => {
  const seeded = (await words(page, TOPIC_ID)).slice(0, 2);
  for (const word of seeded) await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await enableHandsFree(page);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  const first = (await page.locator('[data-card-prompt]').innerText()).trim();
  const answer = seeded.find((w) => w.hungarian === first)!.hebrew;

  await expect(page.locator('[data-speak-answer]')).toHaveAttribute(
    'data-listening',
    'true',
    { timeout: 5000 }
  );
  await say(page, answer);

  // Graded, and then carried on to the next card with nothing clicked.
  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'known'
  );
  // One word finished, and the session moved to the next without a click.
  await expect(page.locator('[data-session-position]')).toHaveText('1 מתוך 2 מילים', {
    timeout: 6000,
  });
});

test('stays put after a mishearing, rather than racing on', async ({ page }) => {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await enableHandsFree(page);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  await expect(page.locator('[data-speak-answer]')).toHaveAttribute(
    'data-listening',
    'true',
    { timeout: 5000 }
  );
  await say(page, 'משהו אחר');

  await expect(page.locator('[data-speak-missed]')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-speak-missed]')).toBeVisible();
  await expect(page.locator('[data-verdict]')).toHaveCount(0);
});

test('the preference is remembered', async ({ page }) => {
  await page.goto(STUDY_URL);
  await enableHandsFree(page);
  await page.reload();
  await expect(page.locator('[data-hands-free-toggle]')).toBeChecked();
});

test('listens again by itself after a mishearing', async ({ page }) => {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await enableHandsFree(page);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  const button = page.locator('[data-speak-answer]');
  await expect(button).toHaveAttribute('data-listening', 'true', { timeout: 5000 });
  await say(page, 'משהו אחר');

  // Nothing is recorded, and the microphone opens again without being pressed.
  await expect(page.locator('[data-speak-missed]')).toBeVisible();
  await expect(button).toHaveAttribute('data-listening', 'true', { timeout: 5000 });
});

test('gives up and moves on after three misses, rather than waiting', async ({ page }) => {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await enableHandsFree(page);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  const button = page.locator('[data-speak-answer]');
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(button).toHaveAttribute('data-listening', 'true', { timeout: 6000 });
    await say(page, 'משהו אחר');
  }

  // The failure is acknowledged and recorded, and the session carries on.
  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'unknown'
  );
  await expect
    .poll(async () => {
      const res = await page.request.get('/api/progress');
      const body = (await res.json()) as { progress: { status: string }[] };
      return body.progress[0]?.status;
    })
    .toBe('unknown');
});
