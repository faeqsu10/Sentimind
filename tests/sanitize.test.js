import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Extract sanitizeString from server-v2.js (it's not exported)
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server-v2.js'), 'utf8');
const match = serverCode.match(/function sanitizeString\(str, maxLength = 500\) \{[\s\S]*?\n\}/);
const sanitizeString = new Function('return ' + match[0])();

describe('sanitizeString', () => {
  it('passes through HTML tags (no escaping)', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe(
      '<script>alert("xss")</script>'
    );
  });

  it('passes through special characters unchanged', () => {
    expect(sanitizeString('He said "hello"')).toBe('He said "hello"');
    expect(sanitizeString("It's a test")).toBe("It's a test");
    expect(sanitizeString('A & B')).toBe('A & B');
  });

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(1000);
    expect(sanitizeString(long, 100)).toHaveLength(100);
  });

  it('truncates to default 500', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeString(long)).toHaveLength(500);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString(123)).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('preserves normal text', () => {
    expect(sanitizeString('Hello World')).toBe('Hello World');
  });

  it('handles Korean text', () => {
    expect(sanitizeString('오늘 기분이 좋아요')).toBe('오늘 기분이 좋아요');
  });
});
