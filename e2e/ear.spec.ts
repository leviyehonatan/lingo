import { expect, test, type Page } from '@playwright/test';
import { PAIR } from './fixtures';
import { clips } from '../src/data/minimal-pairs';

/**
 * The ear trainer. The method's first stage: hear a word, say which of two it
 * was. See P4 in docs/learning/decisions.md.
 */

const LISTEN_URL = `/${PAIR}/listen`;

/** Which button is the right one, read from the clip the page loaded. */
async function correctSide(page: Page): Promise<'a' | 'b'> {
  const src = await page.locator('[data-ear-audio]').getAttribute('src');
  const word = Object.entries(clips).find(([, clip]) => clip.file === src)?.[0];
  expect(word, `no clip matches ${src}`).toBeTruthy();
  const a = await page.locator('[data-ear-option="a"]').innerText();
  return a.split('\n')[0].trim() === word ? 'a' : 'b';
}

test('is offered from the pair page, before the words', async ({ page }) => {
  await page.goto(`/${PAIR}`);
  await expect(page.locator(`a[href="${LISTEN_URL}"]`)).toBeVisible();
});

test('plays a word and grades the choice', async ({ page }) => {
  await page.goto(LISTEN_URL);
  await page.locator('[data-ear-contrast="sibilant"]').click();
  await page.locator('[data-ear-start]').click();

  await expect(page.locator('[data-ear-question]')).toBeVisible();
  await expect(page.locator('[data-ear-audio]')).toHaveAttribute('src', /\/audio\/hu\//);

  // The meanings are not on screen yet: the question is about a sound.
  await expect(page.locator('[data-ear-option="a"]')).not.toContainText('מלח');

  const right = await correctSide(page);
  await page.locator(`[data-ear-option="${right}"]`).click();
  await expect(page.locator('[data-ear-verdict="right"]')).toBeVisible();
  // Now they may see what the words meant.
  await expect(page.locator('[data-ear-option="a"]')).toContainText(/[֐-׿]/);
});

test('says which word it was when the answer is wrong', async ({ page }) => {
  await page.goto(LISTEN_URL);
  await page.locator('[data-ear-start]').click();
  const right = await correctSide(page);
  await page.locator(`[data-ear-option="${right === 'a' ? 'b' : 'a'}"]`).click();
  await expect(page.locator('[data-ear-verdict="wrong"]')).toBeVisible();
});

test('ends with a score, and a way back to the words', async ({ page }) => {
  await page.goto(LISTEN_URL);
  await page.locator('[data-ear-start]').click();

  let correct = 0;
  for (let i = 0; i < 10; i += 1) {
    await expect(page.locator('[data-ear-question]')).toBeVisible();
    // Answer the first half right and the rest wrong, so the score has to be
    // counted rather than assumed.
    const right = await correctSide(page);
    const pick = i < 5 ? right : right === 'a' ? 'b' : 'a';
    if (i < 5) correct += 1;
    await page.locator(`[data-ear-option="${pick}"]`).click();
    await page.locator('[data-ear-next]').click();
  }

  await expect(page.locator('[data-ear-score]')).toHaveText(`${correct} מתוך 10`);
  await expect(page.locator(`a[href="/${PAIR}/study/all"]`)).toBeVisible();
});

test('writes no progress: it is a stage, not a deck', async ({ page }) => {
  await page.request.delete('/api/progress');
  await page.goto(LISTEN_URL);
  await page.locator('[data-ear-start]').click();
  await page.locator('[data-ear-option="a"]').click();

  const res = await page.request.get('/api/progress');
  const data = (await res.json()) as { progress: unknown[] };
  expect(data.progress).toEqual([]);
});
