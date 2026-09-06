import Link from 'next/link';
import { auth, signOut } from '@/lib/auth';
import { accountInitials, accountLabel } from '@/lib/account';

/**
 * Who is signed in, and the only way out.
 *
 * Rendered by the root layout as a fixed overlay rather than a header, so it
 * does not disturb the full-height centred layouts the pages already use. It
 * reads the session on the server; no client-side session provider is needed.
 */
export default async function AccountChip() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <div className="fixed top-3 end-3 z-40">
        <Link
          href="/login"
          data-account-signin
          className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur transition hover:border-indigo-500 hover:text-white"
        >
          התחברות
        </Link>
      </div>
    );
  }

  const label = accountLabel(user.name, user.email);

  return (
    <div
      data-account-chip
      className="fixed top-3 end-3 z-40 flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 py-1 pe-1 ps-2 backdrop-blur"
    >
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[0.65rem] font-bold text-white"
      >
        {accountInitials(label)}
      </span>
      <span
        data-account-label
        className="max-w-[9rem] truncate text-xs text-slate-300"
        title={user.email ?? undefined}
      >
        {label}
      </span>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/' });
        }}
      >
        <button
          type="submit"
          className="rounded-full px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-700 hover:text-red-400"
        >
          התנתקות
        </button>
      </form>
    </div>
  );
}
