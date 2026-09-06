import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { authSecret } from '@/lib/dev-login';

// A local checkout has no Google credentials; a dev server signs in through
// /api/dev/login instead (see src/lib/dev-login.ts), so the provider is only
// registered when it is configured. Production always configures it.
const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Self-hosted (non-Vercel) deployments must trust the incoming Host header,
  // otherwise Auth.js rejects /api/auth/* with UntrustedHost.
  trustHost: true,
  // Falls back to a fixed secret in development only, so `npm run dev` needs
  // no AUTH_SECRET.
  secret: authSecret(process.env),
  adapter: PrismaAdapter(prisma),
  providers: googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : [],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
