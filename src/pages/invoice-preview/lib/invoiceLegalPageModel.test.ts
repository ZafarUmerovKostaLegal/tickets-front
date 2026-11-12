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

    it('uses extended RUB labels and order', () => {
        const rows = legalFirmBankingRows('RUB', {
            accountCurrency: 'RUB',
            recipientName: 'Адвокатская фирма "Kosta Legal"',
            legalAddress: 'Узбекистан, г.Ташкент',
            tin: '207 230 749',
            oked: '69 101',
            correspondentBank: 'АКБ "Азия Инвест Банк"',
            correspondentAccount: '30111810500000002535',
            correspondentBik: '044525234',
            bankName: 'ORIENT FINANS BANK',
            bankAddress: 'Yunusabad branch',
            bankCode: '01071',
            accountNumber: '2020 8643 4004 9661 4001',
            swift: 'ORFBUZ22',
        }, 'RU', { omitPlaceholders: true });
        expect(rows.map((r) => r.field)).toEqual([
            'recipientName',
            'legalAddress',
            'tin',
            'oked',
            'correspondentBank',
            'correspondentAccount',
            'correspondentBik',
            'bankName',
            'bankAddress',
            'bankCode',
            'accountNumber',
            'swift',
        ]);
        expect(rows.find((r) => r.field === 'accountNumber')?.label).toBe('Р/с (руб.)');
        expect(rows.find((r) => r.field === 'correspondentAccount')?.label).toBe('Счёт (Лоро)');
        expect(rows.find((r) => r.field === 'correspondentBik')?.label).toBe('БИК');
        expect(rows.find((r) => r.field === 'bankCode')?.label).toBe('МФО');
    });
});
