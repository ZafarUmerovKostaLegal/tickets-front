import { describe, expect, it } from 'vitest';
import {
    formatRegistryAmount,
    formatRegistryAmountCell,
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
