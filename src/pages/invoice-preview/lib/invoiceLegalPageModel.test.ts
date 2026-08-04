import { describe, expect, it } from 'vitest';
import {
    legalFirmBankingRows,
    resolveLegalAccountCurrencyCode,
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
