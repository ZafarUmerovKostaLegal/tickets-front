import { describe, expect, it } from 'vitest';
import { lastDayOfPreviousMonthIso } from './invoicePageShared';

describe('lastDayOfPreviousMonthIso', () => {
  it('returns 31 July for an August issue date', () => {
    expect(lastDayOfPreviousMonthIso('2026-08-17')).toBe('2026-07-31');
    expect(lastDayOfPreviousMonthIso('2026-08-01')).toBe('2026-07-31');
  });

  it('handles January → December of previous year', () => {
    expect(lastDayOfPreviousMonthIso('2026-01-15')).toBe('2025-12-31');
  });

  it('handles February in a leap year', () => {
    expect(lastDayOfPreviousMonthIso('2024-03-01')).toBe('2024-02-29');
  });

  it('returns null for invalid input', () => {
    expect(lastDayOfPreviousMonthIso('')).toBeNull();
    expect(lastDayOfPreviousMonthIso('not-a-date')).toBeNull();
  });
});
