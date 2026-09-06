import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL, TOPIC_ID } from './fixtures';
import { disableSpeech, fakeSpeech, say } from './speech';
import { promptWord, seedWord, words } from './session';

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
  // Nothing has been met yet, so the whole sitting is new words: five to meet,
  // and the same five asked for afterwards, which is ten cards.
  await expect(page.locator('[data-plan-headline]')).toHaveText('5 מילים חדשות');
  await expect(page.locator('[data-session-start]')).toContainText('5 מילים');

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
    'זו המילה החדשה והמשמעות שלה'
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

  // Progress is counted in words, so putting the word back into the queue does
  // not move the number: it is not finished with until it has been asked.
  await expect(page.locator('[data-session-position]')).toHaveText('0 מתוך 5 מילים');
  await expect(page.locator('[data-introduced-pair]')).toBeVisible();

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
        // A device with a Hungarian voice: without one the app stays silent
        // rather than reading Hungarian in another accent.
        getVoices: () => [{ name: 'Tünde', lang: 'hu-HU', localService: true }],
        addEventListener() {},
        removeEventListener() {},
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

  // The replay button used to do nothing, because Chrome drops an utterance
  // queued in the same tick as the cancel that precedes it.
  const before = spoken.length;
  await page.locator('[data-speak]').click();
  await expect.poll(() => spoken.length).toBeGreaterThan(before);
  await page.locator('[data-speak]').click();
  await expect.poll(() => spoken.length).toBeGreaterThan(before + 1);
  expect(new Set(spoken)).toEqual(new Set([shown]));
});

test('teaching asks the learner to say the word, not just to click past it', async ({
  page,
}) => {
  await fakeSpeech(page);
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  const shown = (await page.locator('[data-card-prompt]').innerText()).trim();

  // The repetition is the step; clicking past it is the secondary way out.
  await expect(page.locator('[data-teach-repeat]')).toBeVisible();
  await expect(page.locator('[data-teach-got]')).toContainText('להמשיך בלי לומר');

  // A miss says what it heard and leaves the learner on the card to try again.
  await page.locator('[data-teach-repeat]').click();
  await say(page, 'valami más');
  await expect(page.locator('[data-teach-retry]')).toContainText('valami más');
  await expect(page.locator('[data-introduced]')).toHaveCount(0);

  // Saying it is what moves the card on.
  await page.locator('[data-teach-repeat]').click();
  await say(page, shown);
  await expect(page.locator('[data-teach-spoke]')).toBeVisible();
  await expect(page.locator('[data-introduced]')).toBeVisible();
});

test('says which language it wants, on both sides of every card', async ({ page }) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();

  // A new word: both languages are labelled, and the meaning is on screen.
  const card = page.locator('[data-flashcard]');
  await expect(card).toContainText('הונגרית');
  await expect(card).toContainText('עברית · המשמעות');

  // Meeting it, then reaching the question, which names the language wanted.
  await page.locator('[data-teach-got]').click();
  await page.locator('[data-session-next]').click();
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-teach-got]').click();
    await page.locator('[data-session-next]').click();
  }

  await expect(page.locator('[data-session-task]')).toHaveText(
    'נזכרו במשמעות בעברית'
  );
});

test('asks in Hungarian when the direction is reversed', async ({ page }) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-direction="reverse"]').click();
  await page.locator('[data-session-start]').click();

  await expect(page.locator('[data-flashcard]')).toContainText('עברית');
  await expect(page.locator('[data-flashcard]')).toContainText('הונגרית · המילה');

  await page.locator('[data-teach-got]').click();
  await page.locator('[data-session-next]').click();
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-teach-got]').click();
    await page.locator('[data-session-next]').click();
  }

  await expect(page.locator('[data-session-task]')).toHaveText(
    'נזכרו במילה בהונגרית'
  );
});

test('a missed word comes back before the round ends', async ({ page }) => {
  const [first, second] = await words(page, TOPIC_ID);
  await seedWord(page, first.id, 'known');
  await seedWord(page, second.id, 'known');

  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  const missed = (await page.locator('[data-card-prompt]').innerText()).trim();
  await page.locator('[data-session-reveal]').click();
  await page.locator('[data-grade="unknown"]').click();

  // The verdict says the word is coming back, so its return is expected.
  await expect(page.locator('[data-verdict-again]')).toBeVisible();
  await page.locator('[data-session-next]').click();

  // The other word, then the missed one again, rather than tomorrow.
  expect(await promptWord(page)).not.toBe(missed);
  await page.locator('[data-session-reveal]').click();
  await page.locator('[data-grade="known"]').click();
  await page.locator('[data-session-next]').click();

  expect(await promptWord(page)).toBe(missed);
  await expect(page.locator('[data-session-position]')).toHaveText('1 מתוך 2 מילים');
});

test('a word recalled first time is not asked again in the same round', async ({
  page,
}) => {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');

  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  await page.locator('[data-session-reveal]').click();
  await page.locator('[data-grade="known"]').click();
  await expect(page.locator('[data-verdict-again]')).toHaveCount(0);
  await page.locator('[data-session-next]').click();

  await expect(page.locator('[data-session-summary]')).toBeVisible();
});
