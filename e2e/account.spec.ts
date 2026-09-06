import { expect, test } from '@playwright/test';
import { PAIR, STUDY_URL, TEST_USER_EMAIL } from './fixtures';

/**
 * Until now the only signal that a session existed was that the study page did
 * not redirect, and there was no way to sign out at all.
 */
test.describe('account chip', () => {
  test('names the signed-in user on every page', async ({ page }) => {
    for (const path of ['/', `/${PAIR}`, STUDY_URL]) {
      await page.goto(path);
      await expect(page.locator('[data-account-chip]')).toBeVisible();
      await expect(page.locator('[data-account-label]')).toHaveText('E2E User');
    }
  });

  test('shows the account email on hover', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-account-label]')).toHaveAttribute(
      'title',
      TEST_USER_EMAIL
    );
  });

  test('signing out ends the session and offers a way back in', async ({ page }) => {
    await page.goto(`/${PAIR}`);
    await page.getByRole('button', { name: 'התנתקות' }).click();

    // Sign-out lands on the home page as an anonymous visitor.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-account-signin]')).toBeVisible();
    await expect(page.locator('[data-account-chip]')).toHaveCount(0);

    // And the gate is back: the study page is no longer reachable.
    await page.goto(STUDY_URL);
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });
});

test.describe('account chip, anonymous', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('offers sign-in instead of an account', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-account-signin]')).toBeVisible();
    await expect(page.locator('[data-account-chip]')).toHaveCount(0);
    await page.locator('[data-account-signin]').click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
