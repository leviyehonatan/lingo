import { NextResponse, type NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { safeCallbackUrl } from '@/lib/safe-callback-url';
import { DEV_USER, SESSION_COOKIE, authSecret, devLoginEnabled } from '@/lib/dev-login';

export const runtime = 'nodejs';

const WEEK = 60 * 60 * 24 * 7;

/**
 * Signs the visitor in as the local dev user and sends them back where they
 * were going. Only exists on a dev server; see `src/lib/dev-login.ts`.
 *
 * The user row is written here rather than assumed, because every progress
 * row is foreign-keyed to it: a session cookie alone gets through the door
 * and then fails the first time a card is graded.
 */
export async function GET(request: NextRequest) {
  if (!devLoginEnabled(process.env)) {
    return new NextResponse(null, { status: 404 });
  }

  await prisma.user.upsert({
    where: { id: DEV_USER.id },
    update: { email: DEV_USER.email, name: DEV_USER.name },
    create: DEV_USER,
  });

  const token = await encode({
    // `sub` is what the session callback copies into `session.user.id`.
    token: { sub: DEV_USER.id, email: DEV_USER.email, name: DEV_USER.name },
    secret: authSecret(process.env)!,
    salt: SESSION_COOKIE,
    maxAge: WEEK,
  });

  const target = safeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'));
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: WEEK,
  });
  return response;
}
