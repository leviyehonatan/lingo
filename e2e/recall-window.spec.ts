import { expect, test } from '@playwright/test';
import { STUDY_URL, TOPIC_ID } from './fixtures';
import { disableSpeech } from './speech';
import { progress, seedWord, words } from './session';

/**
 * The method gives a review five to ten seconds and means the ceiling. Running
 * out is not a failure, though: the learner is offered the same choices a
 * mishearing offers, because hesitating is not the same as forgetting.
 */
test.describe('the recall window', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/progress');
    await disableSpeech(page);
    await page.clock.install();
  });

  async function askOneWord(page: import('@playwright/test').Page) {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');
    await page.goto(STUDY_URL);
    await page.locator('[data-options-toggle]').click();
    await page.locator('[data-deck="known"]').click();
    await page.locator('[data-session-start]').click();
    await expect(page.locator('[data-flashcard]')).toBeVisible();
    return word;
  }

  test('stays out of the way, then counts down', async ({ page }) => {
    await askOneWord(page);
    await expect(page.locator('[data-recall-window]')).toHaveCount(0);

    await page.clock.fastForward(5000);
    await expect(page.locator('[data-recall-window]')).toBeVisible();
    await expect(page.locator('[data-recall-window]')).toContainText('שניות');
  });

  test('running out asks what happened rather than failing the card', async ({ page }) => {
    await askOneWord(page);
    await page.clock.fastForward(11_000);

    await expect(page.locator('[data-time-up]')).toBeVisible();
    // Nothing recorded: hesitating is not forgetting.
    expect((await progress(page)).progress[0].review_count).toBe(1);

    await page.locator('[data-miss-didnt]').click();
    await expect(page.locator('[data-verdict]')).toHaveAttribute(
      'data-verdict-status',
      'unknown'
    );
  });

  test('a learner who knew it can say so after running out', async ({ page }) => {
    await askOneWord(page);
    await page.clock.fastForward(11_000);
    await page.locator('[data-miss-knew]').click();

    await expect(page.locator('[data-verdict]')).toHaveAttribute(
      'data-verdict-status',
      'known'
    );
  });

  test('does not run while a word is being met', async ({ page }) => {
    await page.goto(STUDY_URL);
    await page.locator('[data-session-start]').click();
    await expect(page.locator('[data-teach-badge]')).toBeVisible();

    await page.clock.fastForward(15_000);
    // Meeting a word is not a test, so there is nothing to run out of.
    await expect(page.locator('[data-time-up]')).toHaveCount(0);
    await expect(page.locator('[data-recall-window]')).toHaveCount(0);
  });
});
