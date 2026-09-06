import { describe, expect, it } from 'vitest';
import { accountInitials, accountLabel } from './account';

describe('accountLabel', () => {
  it('prefers the name', () => {
    expect(accountLabel('E2E User', 'e2e@example.test')).toBe('E2E User');
  });

  it('falls back to the email when there is no name', () => {
    expect(accountLabel(null, 'e2e@example.test')).toBe('e2e@example.test');
    expect(accountLabel('   ', 'e2e@example.test')).toBe('e2e@example.test');
  });

  it('falls back again when the account has neither', () => {
    expect(accountLabel(undefined, undefined)).toBe('משתמש');
    expect(accountLabel(null, null, 'Guest')).toBe('Guest');
  });
});

describe('accountInitials', () => {
  it('takes one letter from each of the first two words', () => {
    expect(accountInitials('E2E User')).toBe('EU');
    expect(accountInitials('Yehonatan Levi')).toBe('YL');
  });

  it('splits an email into its parts', () => {
    expect(accountInitials('nick.stavrou@example.com')).toBe('NS');
    expect(accountInitials('e2e@example.test')).toBe('EE');
  });

  it('takes two letters from a single word', () => {
    expect(accountInitials('madonna')).toBe('MA');
  });

  it('handles a one-letter label and an empty one', () => {
    expect(accountInitials('x')).toBe('X');
    expect(accountInitials('   ')).toBe('?');
  });

  it('keeps non-Latin initials intact', () => {
    expect(accountInitials('יהונתן לוי')).toBe('יל');
  });
});
