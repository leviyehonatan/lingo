import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { devLoginEnabled } from '@/lib/dev-login';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('authjs.session-token') || req.cookies.get('__Secure-authjs.session-token');
  if (token) return;

  // A local dev server signs anonymous visitors in as the dev user on the way
  // in, on every page, so the app is always seen as a signed-in learner sees
  // it. Production never takes this branch; see `src/lib/dev-login.ts`.
  if (devLoginEnabled(process.env)) {
    const loginUrl = new URL('/api/dev/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (req.nextUrl.pathname.includes('/study/')) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!api|_next|favicon).*)'],
};
