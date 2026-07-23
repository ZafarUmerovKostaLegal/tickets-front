import { describe, expect, it } from 'vitest';
import {
    formatRegistryAmount,
    formatRegistryAmountCell,
    parseAdvanceFeeSplits,
    parseRegistryAmount,
} from './partnerStatistics';

describe('parseRegistryAmount / formatRegistryAmount', () => {
    it('parses US and bare amounts', () => {
        expect(parseRegistryAmount('5,881.50')).toBe(5881.5);
        expect(parseRegistryAmount('5122.4')).toBe(5122.4);
        expect(parseRegistryAmount('37329500')).toBe(37329500);
        expect(parseRegistryAmount('9,202,000.00')).toBe(9202000);
        expect(parseRegistryAmount('18497')).toBe(18497);
        expect(parseRegistryAmount('1706.6')).toBe(1706.6);
    });

    it('keeps a single decimal point even with long fraction', () => {
        expect(parseRegistryAmount('4576.224357896251')).toBeCloseTo(4576.224357896251, 6);
        expect(parseRegistryAmount('4000.203')).toBeCloseTo(4000.203, 6);
    });

    it('treats multiple dots as thousand separators', () => {
        expect(parseRegistryAmount('5.881.500')).toBe(5881500);
    });

    it('parses EU decimal comma', () => {
        expect(parseRegistryAmount('5881,50')).toBe(5881.5);
        expect(parseRegistryAmount('5.881,50')).toBe(5881.5);
    });

    it('formats as 5,881.50', () => {
        expect(formatRegistryAmount(5881.5)).toBe('5,881.50');
        expect(formatRegistryAmount(5122.4)).toBe('5,122.40');
        expect(formatRegistryAmount(37329500)).toBe('37,329,500.00');
        expect(formatRegistryAmount(18497)).toBe('18,497.00');
        expect(formatRegistryAmountCell('1706.6')).toBe('1,706.60');
        expect(formatRegistryAmountCell('')).toBe('');
        expect(formatRegistryAmountCell('n/a')).toBe('n/a');
    });
});

describe('parseAdvanceFeeSplits partner codes', () => {
    it('normalizes legacy partner prefixes', () => {
        expect(parseAdvanceFeeSplits('NH: 3 375,00\nAA: 1 351,80')).toEqual([
            { partner: 'NFH', amount: 3375 },
            { partner: 'AAA', amount: 1351.8 },
        ]);
        expect(parseAdvanceFeeSplits('VG: 1000')).toEqual([{ partner: 'VGB', amount: 1000 }]);
    });
});
