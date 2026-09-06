/**
 * Only allow same-origin redirect targets so the callbackUrl query param
 * cannot be used to bounce a freshly signed-in user to another site.
 */
export function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}
