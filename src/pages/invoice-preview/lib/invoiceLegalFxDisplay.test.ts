import { describe, expect, it } from 'vitest';
import {
    formatLegalExchangeRateLine,
    formatLegalExchangeRateValue,
    formatLegalTotalWithFxAlt,
    hasLegalFxDisplay,
} from './invoiceLegalFxDisplay';

describe('invoiceLegalFxDisplay', () => {
    it('appends FX alt amount in parentheses', () => {
        expect(formatLegalTotalWithFxAlt('UZS 20,000,000.00', {
            fxAltAmountFormatted: 'USD 2,000.00',
        })).toBe('UZS 20,000,000.00 (USD 2,000.00)');
    });

    it('keeps primary when alt is empty', () => {
        expect(formatLegalTotalWithFxAlt('USD 1,500.00', null)).toBe('USD 1,500.00');
        expect(formatLegalTotalWithFxAlt('USD 1,500.00', { fxAltAmountFormatted: '  ' })).toBe('USD 1,500.00');
    });

    it('formats exchange rate value and full line', () => {
        const ovr = {
            fxRate: '12571.1',
            fxBaseCurrency: 'USD',
            fxQuoteCurrency: 'UZS',
            fxRateDate: '2026-07-31',
        };
        expect(formatLegalExchangeRateValue(ovr, 'ENG')).toBe('1 USD = 12571.1 UZS (31.07.2026)');
        expect(formatLegalExchangeRateLine(ovr, 'ENG')).toBe('EXCHANGE RATE: 1 USD = 12571.1 UZS (31.07.2026)');
    });

    it('formats exchange rate line in RU', () => {
        expect(formatLegalExchangeRateLine({
            fxRate: '12571.1',
            fxBaseCurrency: 'USD',
            fxQuoteCurrency: 'UZS',
        }, 'RU')).toBe('КУС: 1 USD = 12571.1 UZS');
    });

    it('detects FX display fields', () => {
        expect(hasLegalFxDisplay(null)).toBe(false);
        expect(hasLegalFxDisplay({ fxAltAmountFormatted: 'USD 1.00' })).toBe(true);
        expect(hasLegalFxDisplay({
            fxRate: '1',
            fxBaseCurrency: 'USD',
            fxQuoteCurrency: 'EUR',
        })).toBe(true);
    });
});
