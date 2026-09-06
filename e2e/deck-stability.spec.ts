import { expect, test, type Page } from '@playwright/test';
import { STUDY_URL, TOPIC_ID } from './fixtures';
import { disableSpeech } from './speech';
import { promptWord, seedWord, words } from './session';

const PROGRESS_URL = /\/api\/progress(\?|$)/;

/**
 * The study page once rebuilt and reshuffled its deck whenever the filtered
 * word list changed identity, which it did on every progress update and every
 * tick of the clock, so the card changed underneath the reader between seeing a
 * word and answering it. A session now fixes its deck when it starts, and these
 * hold that down by making the old triggers happen mid-session.
 */
test.describe('deck stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/progress');
    await disableSpeech(page);
  });

  async function startSession(page: Page) {
    await page.goto(STUDY_URL);
    await page.locator('[data-session-start]').click();
    await expect(page.locator('[data-flashcard]')).toBeVisible();
  }

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

  test('the visible card survives the clock tick that refreshes the plan', async ({
    page,
  }) => {
    await page.clock.install();
    await startSession(page);
    const shown = await promptWord(page);

    // The setup screen's plan follows the clock; a running session must not.
    await page.clock.fastForward('01:05');
    await page.waitForTimeout(500);
    expect(await promptWord(page)).toBe(shown);
  });

  test('grading a card leaves it on screen until the learner moves on', async ({ page }) => {
    const [word] = await words(page, TOPIC_ID);
    await seedWord(page, word.id, 'known');

    await page.goto(STUDY_URL);
    await page.locator('[data-options-toggle]').click();
    await page.locator('[data-deck="all"]').click();
    await page.locator('[data-session-start]').click();
    await expect(page.locator('[data-flashcard]')).toBeVisible();
    const shown = await promptWord(page);

    // Whatever card came up, answering it writes progress, which used to
    // reshuffle the whole deck immediately.
    const teaching = await page.locator('[data-teach-got]').count();
    if (teaching) {
      await page.locator('[data-teach-got]').click();
    } else {
      await page.locator('[data-session-reveal]').click();
      await page.locator('[data-grade="known"]').click();
    }
    await expect(page.locator('[data-verdict-interval]')).toBeVisible();
    expect(await promptWord(page)).toBe(shown);

    await page.locator('[data-session-next]').click();
    expect(await promptWord(page)).not.toBe(shown);
  });
});
