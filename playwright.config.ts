import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a real Next.js server and a real Postgres.
 *
 * Point `E2E_DATABASE_URL` at a throwaway database — `globalSetup` pushes the
 * schema into it and wipes the test user's rows, so never aim it at a database
 * you care about. See the Testing section of the README.
 */
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres@localhost:5432/lingo_e2e';

// The app refuses to start without these; e2e signs its own session cookie
// rather than talking to Google, so the OAuth values only need to be present.
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'e2e-secret-not-for-production';
const PORT = Number(process.env.E2E_PORT ?? 3123);
// `localhost`, not `127.0.0.1`: the Next dev server rejects `_next/*` requests
// whose Host is not an allowed dev origin, and answers 403 for the chunks.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Each spec drives one shared user's progress rows, so keep them serial.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    storageState: './e2e/.auth/state.json',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port ' + PORT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL,
      AUTH_SECRET,
      AUTH_URL: baseURL,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'e2e-client-id',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'e2e-client-secret',
    },
  },
});
