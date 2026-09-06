import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL } from './fixtures';

const PROGRESS_URL = /\/api\/progress(\?|$)/;

/** The Hungarian word printed on the card that is currently on screen. */
async function visibleWord(page: Page): Promise<string> {
  return (await page.locator('[data-flashcard] span').first().innerText()).trim();
}

/**
 * The study page used to reshuffle the deck whenever the filtered word list
 * changed identity, which it does on every progress update and on every tick
 * of the 30-second clock, even when the deck held exactly the same words. The
 * card then changed underneath the reader between seeing a word and answering
 * it. These cases make each of those two things happen while a card is on
 * screen and assert that the card stays put.
 */
test.describe('deck stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/progress');
  });

  test('the visible card survives a slow progress response', async ({ page }) => {
    // Vocabulary wins the race and the card renders; progress lands after it.
    await page.route(PROGRESS_URL, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    const progressLoaded = page.waitForResponse(PROGRESS_URL);

    await page.goto(STUDY_URL);
    await expect(page.locator('[data-flashcard]')).toBeVisible();
    const shown = await visibleWord(page);

    await progressLoaded;
    // Long enough for the state update and any re-render it triggers.
    await page.waitForTimeout(500);
    expect(await visibleWord(page)).toBe(shown);
  });

  test('the visible card survives the clock tick that refreshes due words', async ({ page }) => {
    await page.clock.install();
    await page.goto(STUDY_URL);
    await expect(page.locator('[data-flashcard]')).toBeVisible();
    const shown = await visibleWord(page);

    // `useNow(30_000)` feeds the due-word filter; its tick used to reshuffle.
    await page.clock.fastForward('01:05');
    await page.waitForTimeout(500);
    expect(await visibleWord(page)).toBe(shown);
  });
});
