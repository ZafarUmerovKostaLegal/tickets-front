import { describe, expect, it } from 'vitest';
import type { CbuParsed } from '@entities/expenses/model/cbuRates';
import { formatRegistryAmountUsd, registryAmountUsd, registryIssueIso, registryUsdBasis, registryUsdPersistItem } from './amountUsd';

const rates: CbuParsed = {
    rateDateRu: '02.10.2026',
    uzsPerUsd: 12_000,
    uzsPerUnit: new Map([
        ['USD', 12_000],
        ['EUR', 13_000],
    ]),
};

describe('registry amount in USD', () => {
    it('оставляет доллары как есть', () => {
        expect(registryAmountUsd(5000, 'USD', null)).toBe(5000);
        expect(formatRegistryAmountUsd(
            { amount: '5,000.00', currency: 'USD', issueDate: '2026-10-02' },
            {},
            {},
        )).toBe('5,000.00');
    });

    it('переводит сумы и евро по курсу на дату счёта', () => {
        expect(registryIssueIso('2026-10-02')).toBe('2026-10-02');
        expect(registryIssueIso('2.10.2026')).toBe('2026-10-02');
        expect(registryAmountUsd(12_000_000, 'UZS', rates)).toBe(1000);
        expect(registryAmountUsd(120, 'EUR', rates)).toBeCloseTo(130, 6);
        expect(formatRegistryAmountUsd(
            { amount: '12,000,000.00', currency: 'UZS', issueDate: '2026-10-02' },
            { '2026-10-02': rates },
            {},
        )).toBe('1,000.00');
    });

    it('показывает ожидание, пока курса на дату нет', () => {
        expect(formatRegistryAmountUsd(
            { amount: '100', currency: 'EUR', issueDate: '2026-10-04' },
            {},
            {},
        )).toBe('…');
        expect(formatRegistryAmountUsd(
            { amount: '100', currency: 'EUR', issueDate: '2026-10-04' },
            {},
            { '2026-10-04': true },
        )).toBe('—');
    });

    it('берёт сохранённую сумму, если банк не ответил, и не пишет её повторно', () => {
        const row = {
            id: 'sys-1',
            amount: '120',
            currency: 'EUR',
            issueDate: '2026-10-04',
            amountUsd: '130.00',
            amountUsdBasis: registryUsdBasis({ amount: '120', currency: 'EUR', issueDate: '2026-10-04' }) ?? '',
        };
        expect(formatRegistryAmountUsd(row, {}, { '2026-10-04': true })).toBe('130.00');
        expect(registryUsdPersistItem(row, {}, { '2026-10-04': true })).toBeNull();
        expect(registryUsdPersistItem(
            { id: 'sys-1', amount: '5,000.00', currency: 'USD', issueDate: '2026-10-02' },
            {},
            {},
        )).toEqual({
            id: 'sys-1',
            amountUsd: '5,000.00',
            basis: '5000|USD|2026-10-02',
        });
    });
});