import { describe, expect, it } from 'vitest';
import { safeCallbackUrl } from '@/lib/safe-callback-url';

describe('safeCallbackUrl', () => {
  it('falls back to the home page when nothing is given', () => {
    expect(safeCallbackUrl(null)).toBe('/');
    expect(safeCallbackUrl('')).toBe('/');
  });

  it('keeps same-origin paths, including query strings', () => {
    expect(safeCallbackUrl('/hu-he')).toBe('/hu-he');
    expect(safeCallbackUrl('/hu-he/study/a1-greetings?mode=quiz')).toBe(
      '/hu-he/study/a1-greetings?mode=quiz'
    );
  });

  it('rejects absolute URLs and protocol-relative URLs', () => {
    expect(safeCallbackUrl('https://evil.example/phish')).toBe('/');
    expect(safeCallbackUrl('//evil.example/phish')).toBe('/');
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/');
    expect(safeCallbackUrl('hu-he')).toBe('/');
  });
});
