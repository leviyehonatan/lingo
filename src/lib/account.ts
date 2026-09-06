/**
 * Pure helpers for the account chip. No React, no auth, no I/O.
 */

/**
 * The label to show for a signed-in account: their name if the provider gave
 * one, otherwise the email, and a neutral word if neither is present.
 */
export function accountLabel(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback = 'משתמש'
): string {
  return name?.trim() || email?.trim() || fallback;
}

/**
 * One or two letters standing in for an avatar, so the chip never waits on a
 * remote image. Splits on the punctuation that separates the parts of a name
 * or an email address.
 */
export function accountInitials(label: string): string {
  const parts = label.split(/[\s@._+-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join('').toUpperCase();
  return ([...parts[0]][0] + [...parts[1]][0]).toUpperCase();
}
