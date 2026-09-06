/**
 * Open the app locally, already signed in.
 *
 * Sign-in is Google-only, and a local checkout has no Google credentials, so
 * there is no way to reach a signed-in page by hand. This does what the e2e
 * setup does: mints the session cookie the app would have issued, then opens a
 * browser window holding it.
 *
 * Usage, with the dev server already running on the same AUTH_SECRET:
 *
 *   npm run dev:session
 *   npm run dev:session -- --path /hu-he            # open somewhere else
 *   npm run dev:session -- --port 3123 --headless   # just print the cookie
 *
 * Everything has a default; override with flags or the matching env var.
 */

import { encode } from 'next-auth/jwt';

const flags = parseFlags(process.argv.slice(2));

const port = flags.port ?? process.env.PORT ?? '3000';
const origin = flags.origin ?? process.env.DEV_ORIGIN ?? `http://localhost:${port}`;
const path = flags.path ?? '/hu-he/study/a1-greetings';
const secret =
  flags.secret ?? process.env.AUTH_SECRET ?? 'local-dev-secret-not-for-production';
const userId = flags.user ?? process.env.DEV_USER_ID ?? 'local-dev-user';
const email = flags.email ?? process.env.DEV_USER_EMAIL ?? 'you@localhost';
const name = flags.name ?? process.env.DEV_USER_NAME ?? 'לימוד מקומי';

const COOKIE = 'authjs.session-token';

const token = await encode({
  // `sub` is what the session callback copies into `session.user.id`, and what
  // every progress row is written against.
  token: { sub: userId, email, name },
  secret,
  salt: COOKIE,
  maxAge: 60 * 60 * 24 * 7,
});

if (flags.headless) {
  console.log(`${COOKIE}=${token}`);
  process.exit(0);
}

await assertServerIsUp(origin);

const { chromium } = await import('@playwright/test');
const browser = await chromium.launch({ headless: false, args: ['--window-size=1150,950'] });
const context = await browser.newContext({
  viewport: null,
  storageState: {
    cookies: [
      {
        name: COOKIE,
        value: token,
        domain: new URL(origin).hostname,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
        httpOnly: true,
        secure: origin.startsWith('https'),
        sameSite: 'Lax',
      },
    ],
    origins: [],
  },
});

const page = await context.newPage();
await page.goto(`${origin}${path}`);

console.log(`Opened ${origin}${path}, signed in as ${name} <${email}>.`);
console.log('Close the window to end the session.');

// The window belongs to the person, not to this process: wait for them to shut
// it rather than exiting and taking the browser with us.
await new Promise((resolve) => {
  browser.on('disconnected', resolve);
  context.on('close', resolve);
});

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'headless') {
      out.headless = true;
      continue;
    }
    out[key] = argv[++i];
  }
  return out;
}

async function assertServerIsUp(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error(`Nothing is answering at ${url}.`);
    console.error('Start the dev server first, with the same AUTH_SECRET:');
    console.error('');
    console.error(
      `  DATABASE_URL=postgresql://$USER@localhost:5432/lingo_dev AUTH_SECRET=${secret} \\`
    );
    console.error('    GOOGLE_CLIENT_ID=local GOOGLE_CLIENT_SECRET=local npm run dev');
    process.exit(1);
  }
}
