import { fetchCbuParsedForDate, foreignUnitsPerUsd } from '@entities/expenses/model/cbuRates';
import { lastDayOfPreviousMonthIso } from '@pages/time-tracking/lib/invoicePageShared';
import { formatTimeReportAmount } from './invoiceTimeReportModel';
import type { InvoiceLegalPageOverrides } from './invoiceLegalPageModel';
import { hasLegalFxDisplay } from './invoiceLegalFxDisplay';

function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

function formatFxRateDisplay(rate: number): string {
    if (!Number.isFinite(rate) || rate <= 0)
        return '';
    const s = rate.toLocaleString('en-US', {
        useGrouping: false,
        maximumFractionDigits: 4,
        minimumFractionDigits: 0,
    });
    return s;
}

/**
 * When a custom-billed invoice was created before FX dual-total was stored,
 * fill legal overrides from CBU (last day of previous month vs issue date).
 */
export async function enrichLegalFxOverridesFromCbu(opts: {
    issueDateIso: string;
    invoiceCurrency: string;
    totalAmount: number;
    legal?: InvoiceLegalPageOverrides | null;
}): Promise<InvoiceLegalPageOverrides | null> {
    if (hasLegalFxDisplay(opts.legal))
        return null;
    const amount = Number(opts.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0)
        return null;
    const invCcy = String(opts.invoiceCurrency ?? '').trim().toUpperCase() || 'USD';
    const rateDate = lastDayOfPreviousMonthIso(opts.issueDateIso);
    if (!rateDate)
        return null;
    try {
        const parsed = await fetchCbuParsedForDate(rateDate);
        if (invCcy === 'USD') {
            const uzs = parsed.uzsPerUsd;
            if (!(uzs > 0))
                return null;
            return {
                fxAltAmountFormatted: formatTimeReportAmount(roundMoney(amount * uzs), 'UZS'),
                fxBaseCurrency: 'USD',
                fxQuoteCurrency: 'UZS',
                fxRate: formatFxRateDisplay(uzs),
                fxRateDate: rateDate,
            };
        }
        const unitsPerUsd = foreignUnitsPerUsd(parsed, invCcy);
        if (unitsPerUsd == null || !(unitsPerUsd > 0))
            return null;
        const usd = roundMoney(amount / unitsPerUsd);
        return {
            fxAltAmountFormatted: formatTimeReportAmount(usd, 'USD'),
            fxBaseCurrency: 'USD',
            fxQuoteCurrency: invCcy,
            fxRate: formatFxRateDisplay(unitsPerUsd),
            fxRateDate: rateDate,
        };
    }
    catch {
        return null;
    }
}
