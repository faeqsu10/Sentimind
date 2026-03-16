import { describe, expect, it } from 'vitest';

const { isMissingColumnError } = require('../lib/db-utils');

describe('db utils', () => {
  it('detects missing-column errors for known columns', () => {
    expect(isMissingColumnError(
      { message: 'column user_reports.period_start does not exist' },
      ['period_start', 'period_end']
    )).toBe(true);
  });

  it('detects schema cache messages as missing-column errors', () => {
    expect(isMissingColumnError(
      { message: 'Could not find the foo column in the schema cache' },
      ['foo']
    )).toBe(true);
  });

  it('returns false when the message does not mention a tracked column', () => {
    expect(isMissingColumnError(
      { message: 'permission denied for table user_reports' },
      ['period_start']
    )).toBe(false);
  });
});
