import { describe, expect, it } from 'vitest';
import { summarizeBilledOverrideLines } from './invoicePageShared';
import type { InvoiceLineDto } from '@entities/time-tracking';

function line(partial: Partial<InvoiceLineDto> & Pick<InvoiceLineDto, 'id' | 'lineKind' | 'lineTotal'>): InvoiceLineDto {
  return {
    sortOrder: 0,
    description: null,
    quantity: 1,
    unitAmount: partial.lineTotal,
    timeEntryId: null,
    expenseRequestId: null,
    ...partial,
  };
}

describe('summarizeBilledOverrideLines', () => {
  it('returns all lines when not a billed override', () => {
    const lines = [
      line({ id: '1', lineKind: 'time', lineTotal: 100, timeEntryId: 't1' }),
      line({ id: '2', lineKind: 'manual', lineTotal: 50 }),
    ];
    const s = summarizeBilledOverrideLines(lines);
    expect(s.isBilledOverride).toBe(false);
    expect(s.visibleLines).toHaveLength(2);
  });

  it('hides zero linkage and keeps billed manual line', () => {
    const lines = [
      line({ id: '1', lineKind: 'time', lineTotal: 0, timeEntryId: 't1', sourceAmount: 100 }),
      line({ id: '2', lineKind: 'expense', lineTotal: 0, expenseRequestId: 'e1', sourceAmount: 20 }),
      line({ id: '3', lineKind: 'package_fee', lineTotal: 0 }),
      line({ id: '4', lineKind: 'manual', lineTotal: 360, description: 'Legal services' }),
    ];
    const s = summarizeBilledOverrideLines(lines);
    expect(s.isBilledOverride).toBe(true);
    expect(s.closedTimeCount).toBe(1);
    expect(s.closedExpenseCount).toBe(1);
    expect(s.visibleLines).toHaveLength(1);
    expect(s.visibleLines[0]?.id).toBe('4');
  });
});
