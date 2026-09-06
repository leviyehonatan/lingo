import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { encode } from 'next-auth/jwt';
import {
  AUTH_SECRET,
  AUTH_STATE_PATH,
  BASE_URL,
  COOKIE_DOMAIN,
  DATABASE_URL,
  SESSION_COOKIE,
  STUDY_URL,
  TEST_USER_EMAIL,
  TEST_USER_ID,
  TOPIC_ID,
} from './fixtures';

const SCHEMA_HINT = `
The e2e database is not ready. Create it and push the schema once, by hand:

  createdb lingo_e2e
  DATABASE_URL=postgresql://<user>@localhost:5432/lingo_e2e npx prisma db push

Then re-run: E2E_DATABASE_URL=postgresql://<user>@localhost:5432/lingo_e2e npm run test:e2e
`;

/**
 * Prepares the e2e database and a signed-in browser state.
 *
 * Deliberately non-destructive: it never drops or migrates a database. The
 * schema has to exist already (see the hint above); everything this does is
 * upserts plus deleting the test user's own rows.
 *
 * Auth is Google-only, so instead of driving an OAuth flow we mint the same
 * JWT session cookie the app would have issued. That works because the session
 * strategy is `jwt`: `auth()` reads the cookie and never looks the session up
 * in the database.
 */
export default async function globalSetup() {
  // Plain `pg` rather than the Prisma client: Playwright loads this file as
  // CommonJS, and the generated client is ESM-only.
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  let seededWords: number;
  try {
    const { rows } = await db.query<{ count: string }>(
      'SELECT count(*) AS count FROM "Word" WHERE "topicId" = $1',
      [TOPIC_ID]
    );
    seededWords = Number(rows[0].count);
  } catch (error) {
    await db.end();
    throw new Error(`${(error as Error).message}\n${SCHEMA_HINT}`);
  }

  // Seeding is upsert-only, so it is safe to repeat.
  if (seededWords === 0) {
    execFileSync('npm', ['run', 'seed'], {
      env: { ...process.env, DATABASE_URL },
      stdio: 'inherit',
    });
  }

  await db.query(
    `INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER_ID, TEST_USER_EMAIL, 'E2E User']
  );

  // Start every run from a clean slate so assertions on counts are exact.
  // Only ever the test user's own rows.
  await db.query('DELETE FROM "WordProgress" WHERE "userId" = $1', [TEST_USER_ID]);
  await db.query('DELETE FROM "DailyRecord" WHERE "userId" = $1', [TEST_USER_ID]);
  await db.end();

  const token = await encode({
    // `sub` is what the session callback copies into `session.user.id`.
    token: { sub: TEST_USER_ID, email: TEST_USER_EMAIL, name: 'E2E User' },
    secret: AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });

  const state = {
    cookies: [
      {
        name: SESSION_COOKIE,
        value: token,
        domain: COOKIE_DOMAIN,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };

  await mkdir(dirname(AUTH_STATE_PATH), { recursive: true });
  await writeFile(AUTH_STATE_PATH, JSON.stringify(state, null, 2));

  await warmUp();
}

/**
 * Playwright starts the web server before this file runs, so we can force the
 * dev server to compile the study route and its API routes now. Without it the
 * first test pays that cost inside its own timeout, which is tight on a cold
 * CI runner.
 */
async function warmUp() {
  const paths = [STUDY_URL, '/api/vocabulary?pair=hu-he', '/api/progress'];
  await Promise.all(
    paths.map((path) =>
      fetch(`${BASE_URL}${path}`).catch(() => {
        // A warm-up miss is not a failure; the tests assert the real thing.
      })
    )
  );
}
