/** Values shared by the Playwright config, the e2e global setup and the specs. */

export const TEST_USER_ID = 'e2e-user';
export const TEST_USER_EMAIL = 'e2e@example.test';

/** Auth.js cookie name for a plain-http dev server, and the JWT salt. */
export const SESSION_COOKIE = 'authjs.session-token';

export const PAIR = 'hu-he';
export const TOPIC_ID = 'a1-greetings';
export const STUDY_URL = `/${PAIR}/study/${TOPIC_ID}`;

export const AUTH_STATE_PATH = 'e2e/.auth/state.json';

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3123);

/**
 * `localhost`, not `127.0.0.1`: the Next dev server rejects `_next/*` requests
 * whose Host is not an allowed dev origin, and answers 403 for the chunks.
 */
export const BASE_URL = `http://localhost:${E2E_PORT}`;

/** Cookie domain must match the host the browser talks to. */
export const COOKIE_DOMAIN = 'localhost';

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres@localhost:5432/lingo_e2e';

// e2e signs its own session cookie rather than talking to Google, so this only
// has to match between the setup and the server under test.
export const AUTH_SECRET = process.env.AUTH_SECRET ?? 'e2e-secret-not-for-production';
