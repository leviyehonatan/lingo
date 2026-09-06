/**
 * Create the local database's dev user, the one `dev-session.mjs` signs in as.
 *
 * Progress rows are foreign-keyed to a user, so studying locally fails without
 * this row even though the session cookie alone gets you through the door.
 *
 *   DATABASE_URL=postgresql://$USER@localhost:5432/lingo_dev npm run dev:user
 *
 * Plain SQL through `pg` rather than the Prisma client, which is generated as
 * TypeScript and would need a loader; the e2e setup does the same.
 */

import { Client } from 'pg';

const id = process.env.DEV_USER_ID ?? 'local-dev-user';
const email = process.env.DEV_USER_EMAIL ?? 'you@localhost';
const name = process.env.DEV_USER_NAME ?? 'לימוד מקומי';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL to the local database first, for example:');
  console.error('  DATABASE_URL=postgresql://$USER@localhost:5432/lingo_dev npm run dev:user');
  process.exit(1);
}

const db = new Client({ connectionString });
await db.connect();
await db.query(
  `INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
   VALUES ($1, $2, $3, now(), now())
   ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name`,
  [id, email, name]
);
await db.end();

console.log(`Dev user ready: ${name} <${email}> (${id})`);
