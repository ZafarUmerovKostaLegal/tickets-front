import { describe, expect, it } from 'vitest';
import {
    legalFirmBankingRows,
    resolveLegalAccountCurrencyCode,
    resolveLegalExtraExpensesAmount,
} from './invoiceLegalPageModel';

describe('resolveLegalAccountCurrencyCode', () => {
    it('prefers banking profile currency from overrides', () => {
        expect(resolveLegalAccountCurrencyCode('EUR', { accountCurrency: 'UZS' })).toBe('UZS');
    });

    it('falls back to pack currency when override is empty', () => {
        expect(resolveLegalAccountCurrencyCode('USD', {})).toBe('USD');
        expect(resolveLegalAccountCurrencyCode('USD', { accountCurrency: '  ' })).toBe('USD');
        expect(resolveLegalAccountCurrencyCode('USD', { accountCurrency: null })).toBe('USD');
    });
});

describe('resolveLegalExtraExpensesAmount', () => {
    it('does not put the fixed fee into extra expenses', () => {
        expect(resolveLegalExtraExpensesAmount('UZS 100,000.00', 'UZS 100,000.00', 'UZS 0.00')).toBe('UZS 0.00');
        expect(resolveLegalExtraExpensesAmount('UZS 100000.00', 'UZS 100,000.00', 'UZS 0.00')).toBe('UZS 0.00');
        expect(resolveLegalExtraExpensesAmount(undefined, 'UZS 100,000.00', 'UZS 0.00')).toBe('UZS 0.00');
    });

    it('keeps an extra expense that is not the fixed fee', () => {
        expect(resolveLegalExtraExpensesAmount('UZS 15.00', 'UZS 100,000.00', 'UZS 0.00')).toBe('UZS 15.00');
    });
});

describe('legalFirmBankingRows', () => {
    it('uses override currency in AC and Corr. ACC labels', () => {
        const rows = legalFirmBankingRows('EUR', {
            accountCurrency: 'UZS',
            accountNumber: '2020 8978 7004 9661 4001',
        }, 'ENG');
        const ac = rows.find((r) => r.field === 'accountNumber');
        const corr = rows.find((r) => r.field === 'correspondentAccount');
        expect(ac?.label).toBe('AC (UZS)');
        expect(corr?.label).toBe('Corr. ACC (UZS)');
    });

    it('uses pack currency when no override currency', () => {
        const rows = legalFirmBankingRows('USD', { accountNumber: '1' }, 'ENG');
        expect(rows.find((r) => r.field === 'accountNumber')?.label).toBe('AC (USD)');
    });
});
