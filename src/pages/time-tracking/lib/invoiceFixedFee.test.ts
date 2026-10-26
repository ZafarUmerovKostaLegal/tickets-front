import { describe, expect, it } from 'vitest';
import {
  invoiceFixedFeeTotal,
  invoiceServicesAmount,
  parseInvoiceFixedFeeInput,
  readProjectExtraFixedFee,
} from './invoiceFixedFee';

describe('invoice fixed fee', () => {
  it('sums only fixed_fee lines and leaves time lines for the services amount', () => {
    const lines = [
      { lineKind: 'time', lineTotal: 1000 },
      { lineKind: 'fixed_fee', lineTotal: '250.5' },
      { lineKind: 'expense', lineTotal: 40 },
    ];
    expect(invoiceFixedFeeTotal(lines)).toBe(250.5);
    expect(invoiceServicesAmount(1290.5, 250.5)).toBe(1040);
  });

  it('does not split the total when there is no extra fee', () => {
    expect(invoiceServicesAmount(1000, 0)).toBeNull();
  });

  it('parses a typed amount and reads the project default', () => {
    expect(parseInvoiceFixedFeeInput('1 500,25')).toBe(1500.25);
    expect(parseInvoiceFixedFeeInput('')).toBeNull();
    expect(readProjectExtraFixedFee({
      extraFixedFeeAmount: '80',
      extraFixedFeeDescription: 'Filing fee',
    })).toEqual({ amount: 80, description: 'Filing fee' });
  });
});
