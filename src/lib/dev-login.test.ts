import { describe, expect, it } from 'vitest';
import { DEV_AUTH_SECRET, authSecret, devLoginEnabled } from './dev-login';

describe('devLoginEnabled', () => {
  it('is on for a plain dev server', () => {
    expect(devLoginEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('can be switched off, which is what the e2e server does', () => {
    expect(devLoginEnabled({ NODE_ENV: 'development', DEV_AUTO_LOGIN: '0' })).toBe(false);
  });

  it('never applies to a production build', () => {
    expect(devLoginEnabled({ NODE_ENV: 'production' })).toBe(false);
    // Not even when asked for.
    expect(devLoginEnabled({ NODE_ENV: 'production', DEV_AUTO_LOGIN: '1' })).toBe(false);
    expect(devLoginEnabled({})).toBe(false);
  });
});

describe('authSecret', () => {
  it('prefers a configured secret', () => {
    expect(authSecret({ NODE_ENV: 'development', AUTH_SECRET: 'set' })).toBe('set');
    expect(authSecret({ NODE_ENV: 'production', AUTH_SECRET: 'set' })).toBe('set');
  });

  it('falls back to the dev secret only in development', () => {
    expect(authSecret({ NODE_ENV: 'development' })).toBe(DEV_AUTH_SECRET);
    expect(authSecret({ NODE_ENV: 'production' })).toBeUndefined();
    expect(authSecret({ NODE_ENV: 'test' })).toBeUndefined();
  });

  it('treats an empty secret as unset', () => {
    expect(authSecret({ NODE_ENV: 'development', AUTH_SECRET: '' })).toBe(DEV_AUTH_SECRET);
  });
});
