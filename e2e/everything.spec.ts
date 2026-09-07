import { expect, test } from '@playwright/test';
import { PAIR } from './fixtures';
import { disableSpeech } from './speech';
import { promptWord } from './session';
import { byFrequency } from '../src/lib/frequency';
import { EVERYTHING, everythingTopic } from '../src/lib/everything';
import type { LevelData } from '../src/lib/api-types';

/**
 * Studying everything at once, which is what makes frequency ordering mean
 * "the commonest words you have not met" rather than "the commonest words in
 * this theme". See P8 in docs/learning/decisions.md.
 */

const ALL_URL = `/${PAIR}/study/${EVERYTHING}`;

test.beforeEach(async ({ page }) => {
  await page.request.delete('/api/progress');
  await disableSpeech(page);
});

test('the pair page offers everything before it offers a topic', async ({ page }) => {
  await page.goto(`/${PAIR}`);
  const offered = page.locator(`a[href="${ALL_URL}"]`);
  await expect(offered).toBeVisible();

  // It comes before the themed lists, because it is the recommended path.
  const links = page.locator('a[href*="/study/"]');
  await expect(links.first()).toHaveAttribute('href', ALL_URL);
});

test('introduces the commonest word in the whole vocabulary first', async ({ page }) => {
  const res = await page.request.get(`/api/vocabulary?pair=${PAIR}`);
  const levels = (await res.json()) as LevelData[];
  const pool = everythingTopic(levels);
  const first = pool.words.find((w) => w.id === byFrequency(pool.words.map((w) => w.id))[0]);
  expect(first, 'the pool should not be empty').toBeTruthy();

  await page.goto(ALL_URL);
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-flashcard]')).toBeVisible();

  expect([first!.hungarian, first!.hebrew]).toContain(await promptWord(page));
});

test('shows the new word in a sentence, and never on a recall card', async ({ page }) => {
  await page.goto(ALL_URL);
  await page.locator('[data-session-start]').click();
  await expect(page.locator('[data-flashcard]')).toBeVisible();

  // The commonest word in the vocabulary is `nem`, which has an example.
  await expect(page.locator('[data-teach-badge]')).toBeVisible();
  await expect(page.locator('[data-example-hu]')).toHaveText('Nem tudom.');

  // Walk to the first card that asks for something back. The sentence carries
  // the answer, so it must be gone by then.
  for (let i = 0; i < 20; i += 1) {
    if ((await page.locator('[data-teach-badge]').count()) === 0) break;
    await page.locator('[data-teach-got]').click();
    await expect(page.locator('[data-flashcard]')).toBeVisible();
  }
  await expect(page.locator('[data-teach-badge]')).toHaveCount(0);
  await expect(page.locator('[data-example]')).toHaveCount(0);
});
