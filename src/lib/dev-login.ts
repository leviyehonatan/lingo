/**
 * Signing in without Google, for a local checkout only.
 *
 * Sign-in is Google-only and a local checkout has no Google credentials, so a
 * dev server used to be unreachable past the login page without minting a
 * cookie by hand. Instead, while `next dev` is running, an anonymous visit is
 * signed in as one fixed local user on the way in: the middleware sends it
 * through `/api/dev/login`, which writes the user row and sets the same JWT
 * cookie Auth.js would have issued.
 *
 * This file is imported by the middleware, so it stays free of Node-only
 * modules: constants and pure functions.
 */

/** Auth.js cookie name for a plain-http dev server, and the JWT salt. */
export const SESSION_COOKIE = 'authjs.session-token';

/** The user every local session belongs to. Progress rows are keyed to it. */
export const DEV_USER = {
  id: 'local-dev-user',
  email: 'you@localhost',
  name: 'לימוד מקומי',
} as const;

/**
 * Stands in for AUTH_SECRET when a dev server is started without one, so
 * `npm run dev` needs nothing but a database. Never used outside development.
 */
export const DEV_AUTH_SECRET = 'local-dev-secret-not-for-production';

type Env = { NODE_ENV?: string; DEV_AUTO_LOGIN?: string; AUTH_SECRET?: string };

/**
 * Only `next dev` qualifies: `next build` and the Docker image both set
 * NODE_ENV=production, and the e2e server opts out explicitly because it
 * tests what anonymous visitors see.
 */
export function devLoginEnabled(env: Env): boolean {
  return env.NODE_ENV === 'development' && env.DEV_AUTO_LOGIN !== '0';
}

/**
 * The secret Auth.js signs sessions with. In development it falls back to the
 * fixed dev secret, so the cookie minted by `/api/dev/login` (and by
 * `scripts/dev-session.mjs`) verifies without any configuration.
 */
export function authSecret(env: Env): string | undefined {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  return env.NODE_ENV === 'development' ? DEV_AUTH_SECRET : undefined;
}
