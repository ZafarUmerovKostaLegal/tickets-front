import { describe, expect, it } from 'vitest';
import {
    computeAmountUzsForApi,
    computeUsdEquivalent,
    formatExchangeRate,
    parseExpenseMoney,
    roundMoney2,
} from './expenseCurrency';

describe('expenseCurrency money helpers', () => {
    it('parseExpenseMoney strips spaces and accepts comma decimal', () => {
        expect(parseExpenseMoney('300 000')).toBe(300000);
        expect(parseExpenseMoney('24,93')).toBe(24.93);
    });

    it('roundMoney2 uses half-up', () => {
        expect(roundMoney2(299998.8945)).toBe(299998.89);
        expect(roundMoney2(299998.895)).toBe(299998.9);
        expect(roundMoney2(300000)).toBe(300000);
    });

    it('UZS amount 300000 is stored exactly (no USD round-trip)', () => {
        const rate = '12033.65';
        const uzs = computeAmountUzsForApi('UZS', '300000', rate, '');
        expect(uzs).toBe(300000);
        const usd = computeUsdEquivalent('UZS', '300000', rate, '');
        expect(usd).not.toBeNull();
        expect(roundMoney2(usd!)).toBe(24.93);
        // Classic bug: rebuild from rounded USD → 299999
        const badRebuild = Math.round(roundMoney2(usd!) * parseExpenseMoney(rate));
        expect(badRebuild).toBe(299999);
        expect(uzs).not.toBe(badRebuild);
    });

    it('USD → UZS uses half-up to 2 dp without integer Math.round', () => {
        const rate = '12033.65';
        const uzs = computeAmountUzsForApi('USD', '24.93', rate, '');
        expect(uzs).toBe(299998.89);
    });

    it('formatExchangeRate keeps more than 2 decimals when present', () => {
        expect(formatExchangeRate(12033.654321)).toBe('12033.654321');
        expect(formatExchangeRate(12033.65)).toBe('12033.65');
    });
});
