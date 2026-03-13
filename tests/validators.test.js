import { describe, it, expect } from 'vitest';

const {
  validateEmail,
  validatePassword,
  validateEntryText,
  validateConfidenceScore,
  validateNickname,
  validateBio,
  validateTheme,
  validateNotificationTime,
  validateResponseLength,
  validateAdviceStyle,
  validatePersonaPreset,
  validatePagination,
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

  it('accepts undefined (optional)', () => {
    expect(validateTheme(undefined).valid).toBe(true);
  });
});

describe('validatePassword (edge cases)', () => {
  it('rejects password without letters', () => {
    expect(validatePassword('12345678').valid).toBe(false);
  });

  it('rejects password without digits', () => {
    expect(validatePassword('abcdefgh').valid).toBe(false);
  });

  it('rejects password over 72 chars', () => {
    expect(validatePassword('A1' + 'a'.repeat(71)).valid).toBe(false);
  });

  it('rejects null', () => {
    expect(validatePassword(null).valid).toBe(false);
  });
});

describe('validateEmail (edge cases)', () => {
  it('lowercases email', () => {
    const result = validateEmail('User@EXAMPLE.com');
    expect(result.value).toBe('user@example.com');
  });

  it('rejects email over 255 chars', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(validateEmail(long).valid).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateEmail(123).valid).toBe(false);
    expect(validateEmail(null).valid).toBe(false);
  });
});

describe('validateConfidenceScore', () => {
  it('defaults to 0 when undefined', () => {
    const result = validateConfidenceScore(undefined);
    expect(result.valid).toBe(true);
    expect(result.value).toBe(0);
  });

  it('accepts valid score', () => {
    expect(validateConfidenceScore(85).valid).toBe(true);
    expect(validateConfidenceScore(85).value).toBe(85);
  });

  it('rejects negative score', () => {
    expect(validateConfidenceScore(-1).valid).toBe(false);
  });

  it('rejects score over 100', () => {
    expect(validateConfidenceScore(101).valid).toBe(false);
  });

  it('parses string score', () => {
    expect(validateConfidenceScore('50').value).toBe(50);
  });
});

describe('validateBio', () => {
  it('accepts valid bio', () => {
    expect(validateBio('Hello world').valid).toBe(true);
  });

  it('accepts undefined (optional)', () => {
    expect(validateBio(undefined).valid).toBe(true);
  });

  it('rejects bio over 200 chars', () => {
    expect(validateBio('a'.repeat(201)).valid).toBe(false);
  });

  it('rejects non-string', () => {
    expect(validateBio(123).valid).toBe(false);
  });

  it('trims to null for empty string', () => {
    expect(validateBio('   ').value).toBeNull();
  });
});

describe('validateNotificationTime', () => {
  it('accepts valid time', () => {
    const result = validateNotificationTime('21:00');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('21:00:00');
  });

  it('rejects invalid format', () => {
    expect(validateNotificationTime('25:00').valid).toBe(false);
    expect(validateNotificationTime('9:00').valid).toBe(false);
    expect(validateNotificationTime('abc').valid).toBe(false);
  });

  it('accepts undefined (optional)', () => {
    expect(validateNotificationTime(undefined).valid).toBe(true);
  });
});

describe('validateResponseLength', () => {
  it('accepts supported values', () => {
    expect(validateResponseLength('short').valid).toBe(true);
    expect(validateResponseLength('balanced').valid).toBe(true);
    expect(validateResponseLength('detailed').valid).toBe(true);
  });

  it('rejects unsupported values', () => {
    expect(validateResponseLength('long').valid).toBe(false);
  });
});

describe('validateAdviceStyle', () => {
  it('accepts supported values', () => {
    expect(validateAdviceStyle('comfort').valid).toBe(true);
    expect(validateAdviceStyle('balanced').valid).toBe(true);
    expect(validateAdviceStyle('actionable').valid).toBe(true);
  });

  it('rejects unsupported values', () => {
    expect(validateAdviceStyle('coach').valid).toBe(false);
  });
});

describe('validatePersonaPreset', () => {
  it('accepts supported values', () => {
    expect(validatePersonaPreset('none').valid).toBe(true);
    expect(validatePersonaPreset('gentle_friend').valid).toBe(true);
    expect(validatePersonaPreset('calm_coach').valid).toBe(true);
    expect(validatePersonaPreset('clear_reflector').valid).toBe(true);
  });

  it('rejects unsupported values', () => {
    expect(validatePersonaPreset('celebrity').valid).toBe(false);
  });
});

describe('validatePagination', () => {
  it('returns defaults for empty query', () => {
    const result = validatePagination({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('caps limit at 100', () => {
    expect(validatePagination({ limit: '500' }).limit).toBe(100);
  });

  it('floors offset at 0', () => {
    expect(validatePagination({ offset: '-10' }).offset).toBe(0);
  });

  it('parses string values', () => {
    const result = validatePagination({ limit: '50', offset: '20' });
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(20);
  });
});
