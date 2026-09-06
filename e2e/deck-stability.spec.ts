import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL } from './fixtures';
import { disableSpeech } from './speech';

const PROGRESS_URL = /\/api\/progress(\?|$)/;

async function promptWord(page: Page): Promise<string> {
  return (await page.locator('[data-card-prompt]').innerText()).trim();
}

async function startSession(page: Page) {
  await page.goto(STUDY_URL);
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-flashcard]')).toBeVisible();
}

/**
 * The study page once rebuilt and reshuffled its deck whenever the filtered
 * word list changed identity, which it did on every progress update and every
 * tick of the clock. The card changed underneath the reader between seeing a
 * word and answering it. A session now fixes its deck when it starts, and these
 * cases hold that down by making the old triggers happen mid-session.
 */
test.describe('deck stability', () => {
  test.beforeEach(async ({ page }) => {
    // These cover scheduling and the deck, through the self-grading path a
    // browser without speech recognition gets. The spoken path, which grades
    // from what it hears, is covered in speaking.spec.ts.
    await disableSpeech(page);
    await page.request.delete('/api/progress');
  });

  test('the visible card survives a slow progress response', async ({ page }) => {
    await page.route(PROGRESS_URL, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    const progressLoaded = page.waitForResponse(PROGRESS_URL);

    await startSession(page);
    const shown = await promptWord(page);

    await progressLoaded;
    // Long enough for the state update and any re-render it causes.
    await page.waitForTimeout(500);
    expect(await promptWord(page)).toBe(shown);
  });

  test('the visible card survives the clock tick that refreshes due words', async ({ page }) => {
    await page.clock.install();
    await startSession(page);
    const shown = await promptWord(page);

    // The setup screen's counts follow the clock; a running session must not.
    await page.clock.fastForward('01:05');
    await page.waitForTimeout(500);
    expect(await promptWord(page)).toBe(shown);
  });

  test('grading a card leaves it on screen until the learner moves on', async ({ page }) => {
    await startSession(page);
    const shown = await promptWord(page);

    await page.locator('[data-session-reveal]').click();
    await page.locator('[data-grade="known"]').click();
    await expect(page.locator('[data-verdict-interval]')).toBeVisible();

    // Grading writes progress, which used to reshuffle the deck immediately.
    expect(await promptWord(page)).toBe(shown);

    await page.locator('[data-session-next]').click();
    await expect(page.locator('[data-session-position]')).toHaveText('כרטיס 2 מתוך 20');
    expect(await promptWord(page)).not.toBe(shown);
  });
});
