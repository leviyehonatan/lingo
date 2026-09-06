import { expect, test } from '@playwright/test';
import { levels } from '../src/data';
import { PAIR, STUDY_URL, TOPIC_ID } from './fixtures';

// The global setup signs every test in; these specs exercise what an anonymous
// visitor sees, so start them from an empty storage state instead.
test.use({ storageState: { cookies: [], origins: [] } });

const TOPIC_COUNT = levels.reduce((n, level) => n + level.topics.length, 0);
const GREETINGS_WORDS = levels
  .flatMap((level) => level.topics)
  .find((topic) => topic.id === TOPIC_ID)!.words.length;

test.describe('public pages', () => {
  test('home page lists the Hungarian → Hebrew pair', async ({ page }) => {
    await page.goto('/');
    const pairLink = page.locator(`a[href="/${PAIR}"]`);
    await expect(pairLink).toBeVisible();
    await expect(pairLink).toContainText('הונגרית');
    await expect(pairLink).toContainText('עברית');
  });

  test('pair page lists every seeded topic grouped by level', async ({ page }) => {
    await page.goto(`/${PAIR}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('הונגרית');

    // The seed upserts exactly the topics in src/data, so the page must show
    // every one of them and nothing else.
    const topicLinks = page.locator(`a[href^="/${PAIR}/study/"]`);
    await expect(topicLinks).toHaveCount(TOPIC_COUNT);

    const greetings = page.locator(`a[href="${STUDY_URL}"]`);
    await expect(greetings).toBeVisible();
    await expect(greetings).toContainText(`${GREETINGS_WORDS} מילים`);
  });

  test('study page sends anonymous visitors to login with a callbackUrl', async ({ page }) => {
    await page.goto(STUDY_URL);
    await expect(page).toHaveURL(
      new RegExp(`/login\\?callbackUrl=${encodeURIComponent(STUDY_URL)}$`)
    );
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  });
});
