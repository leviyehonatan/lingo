import { defineConfig, devices } from '@playwright/test';
import { AUTH_SECRET, BASE_URL, DATABASE_URL, E2E_PORT } from './e2e/fixtures';

/**
 * End-to-end tests run against a real Next.js server and a real Postgres.
 *
 * Point `E2E_DATABASE_URL` at a throwaway database whose schema you have
 * already pushed. See the Testing section of the README.
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Each spec drives one shared user's progress rows, so keep them serial.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // A cold `next dev` compile is far slower on a CI runner than on a laptop.
  timeout: isCI ? 60_000 : 30_000,
  expect: { timeout: isCI ? 30_000 : 10_000 },
  use: {
    baseURL: BASE_URL,
    storageState: './e2e/.auth/state.json',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: isCI ? 180_000 : 120_000,
    env: {
      DATABASE_URL,
      AUTH_SECRET,
      AUTH_URL: BASE_URL,
      // public.spec.ts and account.spec.ts assert what an anonymous visitor
      // sees, which a dev server otherwise never shows.
      DEV_AUTO_LOGIN: '0',
      // The app refuses to start without these; e2e never reaches Google, so
      // the values only need to be present.
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'e2e-client-id',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'e2e-client-secret',
    },
  },
});
