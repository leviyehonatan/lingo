import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL, TOPIC_ID } from './fixtures';
import { fakeSpeech, say } from './speech';
import { progress, seedWord, words } from './session';

/**
 * How strictly the app listens, and whether it listens at all, are the
 * learner's business. Rosetta Stone has a precision slider and a switch that
 * turns speech off; this is the same idea.
 */

async function openOptions(page: Page) {
  await page.goto(STUDY_URL);
  await page.locator('[data-options-toggle]').click();
}

async function askSeededWord(page: Page) {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');
  return word;
}

/**
 * A word long enough for a single wrong letter to be a near miss rather than a
 * different word. Short answers are graded exactly, whatever the setting.
 */
async function askLongWord(page: Page) {
  const word = (await words(page, TOPIC_ID)).find(
    (candidate) => candidate.hebrew.trim().length >= 6 && !/[()/]/.test(candidate.hebrew)
  )!;
  await seedWord(page, word.id, 'known');
  return word;
}

/** The same answer with one letter changed. */
function oneLetterOff(answer: string): string {
  const letters = [...answer.trim()];
  letters[letters.length - 1] = letters[letters.length - 1] === 'ז' ? 'ר' : 'ז';
  return letters.join('');
}

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
  await fakeSpeech(page);
});

test('a forgiving setting accepts an answer a strict one refuses', async ({ page }) => {
  const word = await askLongWord(page);

  await openOptions(page);
  await page.locator('[data-strictness="strict"]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  // One letter wrong: too far for strict, close enough for forgiving.
  const mangled = oneLetterOff(word.hebrew);
  await page.locator('[data-speak-answer]').click();
  await say(page, mangled);
  await expect(page.locator('[data-speak-missed]')).toBeVisible();

  await page.locator('[data-session-end]').click();
  await page.locator('[data-summary-again]').click();
  await page.locator('[data-options-toggle]').click();
  await page.locator('[data-strictness="easy"]').click();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  await page.locator('[data-speak-answer]').click();
  await say(page, mangled);
  await expect(page.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict-status',
    'known'
  );
});

test('a learner who cannot speak right now says so, and the mic goes away', async ({
  page,
}) => {
  await askSeededWord(page);
  await openOptions(page);
  await page.locator('[data-silent-toggle]').check();
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  await expect(page.locator('[data-speak-answer]')).toHaveCount(0);
  await expect(page.locator('[data-session-reveal]')).toBeVisible();

  // And the choice is remembered.
  await page.reload();
  await page.locator('[data-options-toggle]').click();
  await expect(page.locator('[data-silent-toggle]')).toBeChecked();
});

test('after three unheard tries it says why, and offers a way on', async ({ page }) => {
  await askSeededWord(page);
  await openOptions(page);
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator('[data-speak-answer]').click();
    await say(page, 'משהו אחר');
  }

  await expect(page.locator('[data-cannot-hear]')).toBeVisible();
  await page.locator('[data-go-silent]').click();
  await expect(page.locator('[data-speak-answer]')).toHaveCount(0);
});

test('the round is as long as the learner asks for', async ({ page }) => {
  await openOptions(page);
  await page.locator('[data-size="5"]').click();
  await expect(page.locator('[data-session-start]')).toContainText('5 מילים');

  await page.locator('[data-size="10"]').click();
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-session-position]')).toContainText('מתוך 5 מילים');
});

test('a word met this round is asked with the start of its answer available', async ({
  page,
}) => {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();

  // Meet three, and the first is back as a question.
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-teach-got]').click();
    await page.locator('[data-session-next]').click();
  }

  await expect(page.locator('[data-hint-show]')).toBeVisible();
  await expect(page.locator('[data-hint]')).toHaveCount(0);
  await page.locator('[data-hint-show]').click();
  // Masked: the opening letters, not the answer.
  await expect(page.locator('[data-hint]')).toContainText('·');
});

test('shows which words of a spoken answer landed', async ({ page }) => {
  // A phrase whose every word is needed: an answer with a one-word alternative
  // would be accepted on that alternative alone, which is correct but useless
  // here.
  const phrase = (await words(page, TOPIC_ID)).find(
    (candidate) => candidate.hebrew.trim().includes(' ') && !/[()/]/.test(candidate.hebrew)
  )!;
  await seedWord(page, phrase.id, 'known');

  await openOptions(page);
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  const [firstWord] = phrase.hebrew.split(' ');
  await page.locator('[data-speak-answer]').click();
  await say(page, `${firstWord} משהו`);

  await page.locator('[data-miss-didnt]').click();
  await expect(page.locator('[data-word-feedback]')).toBeVisible();
  await expect(page.locator('[data-word-heard="true"]').first()).toHaveText(firstWord);
  await expect(page.locator('[data-word-heard="false"]').first()).toBeVisible();
  await expect
    .poll(async () => (await progress(page)).progress[0]?.status)
    .toBe('unknown');
});

test('an instant recall waits longer than a considered one', async ({ page }) => {
  const [word] = await words(page, TOPIC_ID);
  await seedWord(page, word.id, 'known');

  await openOptions(page);
  await page.locator('[data-deck="known"]').click();
  await page.locator('[data-session-start]').click();

  // Answered the moment it appeared, which the schedule reads as the wait
  // having been too short.
  await page.locator('[data-speak-answer]').click();
  await say(page, word.hebrew);
  await expect(page.locator('[data-verdict-interval]')).toBeVisible();

  const { progress: rows } = await progress(page);
  // Rung two is three days; an effortless recall stretches it.
  expect(rows[0].next_review - rows[0].last_reviewed).toBeGreaterThan(
    3 * 24 * 60 * 60 * 1000
  );
});
