import { describe, it, expect } from 'vitest';

const {
  validateEmail,
  validatePassword,
  validateEntryText,
  validateNickname,
  validateBio,
  validateTheme,
} = require('../lib/validators');

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
  });

  it('rejects empty email', () => {
    expect(validateEmail('').valid).toBe(false);
  });

  it('rejects invalid format', () => {
    expect(validateEmail('not-an-email').valid).toBe(false);
  });

  it('trims whitespace', () => {
    const result = validateEmail('  user@example.com  ');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('user@example.com');
  });
});

describe('validatePassword', () => {
  it('accepts valid password (8+ chars)', () => {
    expect(validatePassword('password123').valid).toBe(true);
  });

  it('rejects short password', () => {
    expect(validatePassword('short').valid).toBe(false);
  });

  it('rejects empty password', () => {
    expect(validatePassword('').valid).toBe(false);
  });
});

describe('validateEntryText', () => {
  it('accepts valid text', () => {
    expect(validateEntryText('Today was good').valid).toBe(true);
  });

  it('rejects empty text', () => {
    expect(validateEntryText('').valid).toBe(false);
  });

  it('rejects text exceeding max length', () => {
    const long = 'a'.repeat(3000);
    expect(validateEntryText(long).valid).toBe(false);
  });
});

describe('validateNickname', () => {
  it('accepts valid nickname', () => {
    expect(validateNickname('User123').valid).toBe(true);
  });

  it('accepts undefined (optional)', () => {
    expect(validateNickname(undefined).valid).toBe(true);
  });
});

describe('validateTheme', () => {
  it('accepts light theme', () => {
    expect(validateTheme('light').valid).toBe(true);
  });

  it('accepts dark theme', () => {
    expect(validateTheme('dark').valid).toBe(true);
  });

  it('rejects invalid theme', () => {
    expect(validateTheme('neon').valid).toBe(false);
  });
});
