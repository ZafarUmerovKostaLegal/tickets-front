import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { formatCoverServicesPeriod } from './invoiceCoverLetterI18n';
import { formatLegalRibbonPeriodMonth } from './invoiceLegalPageI18n';
import type { InvoiceLegalPageOverrides } from './invoiceLegalPageModel';
import type { InvoiceTimeReportPack } from './invoiceTimeReportModel';
import {
    isInvoicePreviewPageKey,
    parseIncludedPageKeys,
    type InvoicePreviewPageKey,
} from './invoicePreviewPageSlots';

function isoMonthKey(iso: string): string {
    return iso.trim().slice(0, 7);
}

function textMentionsPeriodMonth(text: string, isoYmd: string): boolean {
    const iso = isoYmd.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
        return false;
    const t = text.toLowerCase();
    const eng = formatCoverServicesPeriod(iso, 'ENG').toLowerCase();
    const ru = formatCoverServicesPeriod(iso, 'RU').toLowerCase();
    const engMonth = eng.split(/\s+/)[0] ?? '';
    const ruMonth = ru.split(/\s+/)[0] ?? '';
    const ribbonEng = formatLegalRibbonPeriodMonth(iso, 'ENG').toLowerCase();
    const ribbonRu = formatLegalRibbonPeriodMonth(iso, 'RU').toLowerCase();
    return Boolean(
        (engMonth && t.includes(engMonth))
        || (ruMonth && t.includes(ruMonth))
        || (ribbonEng && t.includes(ribbonEng))
        || (ribbonRu && t.includes(ribbonRu))
        || t.includes(eng)
        || t.includes(ru),
    );
}

function looksLikeAutoServiceDescription(text: string): boolean {
    return /^(Legal services rendered in |Юридические услуги, оказанные в )/i.test(text.trim());
}

/**
 * When billing period month ≠ issue month, drop auto-generated period display
 * fields that were baked from the issue date (e.g. AUGUST ribbon / «rendered in August»).
 */
export function scrubStaleBillingPeriodDocumentOverrides(
    doc: InvoiceDocumentOverridesV1 | null | undefined,
    opts: { issueDateIso: string; billingPeriodIso: string | null | undefined },
): InvoiceDocumentOverridesV1 | null {
    if (!doc)
        return null;
    const issue = String(opts.issueDateIso ?? '').trim().slice(0, 10);
    const period = String(opts.billingPeriodIso ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issue) || !/^\d{4}-\d{2}-\d{2}$/.test(period))
        return doc;
    if (isoMonthKey(period) === isoMonthKey(issue))
        return doc;

    const next: InvoiceDocumentOverridesV1 = { ...doc };
    if (doc.legal) {
        const legal: InvoiceLegalPageOverrides = { ...doc.legal };
        const ribbon = legal.issueDateDisplay?.trim();
        if (ribbon && (
            textMentionsPeriodMonth(ribbon, issue)
            || ribbon === formatLegalRibbonPeriodMonth(issue, 'ENG')
            || ribbon === formatLegalRibbonPeriodMonth(issue, 'RU')
        )) {
            legal.issueDateDisplay = null;
        }
        const svc = legal.serviceDescriptionLine?.trim();
        if (svc && looksLikeAutoServiceDescription(svc) && textMentionsPeriodMonth(svc, issue)
            && !textMentionsPeriodMonth(svc, period)) {
            legal.serviceDescriptionLine = null;
        }
        next.legal = legal;
    }
    if (doc.cover) {
        const cover: InvoiceCoverDocumentOverrides = { ...doc.cover };
        const smy = cover.servicesMonthYear?.trim();
        if (smy && textMentionsPeriodMonth(smy, issue) && !textMentionsPeriodMonth(smy, period)) {
            const { servicesMonthYear: _drop, ...rest } = cover;
            next.cover = rest;
        }
        else {
            next.cover = cover;
        }
    }
    return next;
}

/** Cover fields that can be polished in preview (not regenerated from invoice totals). */
export type InvoiceCoverDocumentOverrides = Partial<Pick<
    InvoiceCoverLetterModel,
    | 'coverLanguage'
    | 'letterDateDisplay'
    | 'recipientCompany'
    | 'recipientAddressLines'
    | 'attentionName'
    | 'attentionTitle'
    | 'quotedCompanyName'
    | 'servicesMonthYear'
    | 'totalFormatted'
    | 'signatoryName'
    | 'signatoryInitials'
    | 'signatoryTitle'
    | 'introParagraphOverride'
    | 'invoiceParagraphOverride'
>>;

export type InvoiceDocumentOverridesV1 = {
    v: 1;
    legal?: InvoiceLegalPageOverrides | null;
    cover?: InvoiceCoverDocumentOverrides | null;
    timeReport?: InvoiceTimeReportPack | null;
    /** Pages kept in the invoice pack; omitted/null = all pages. */
    includedPageKeys?: InvoicePreviewPageKey[] | null;
};

export function pickCoverDocumentOverrides(
    model: InvoiceCoverLetterModel,
): InvoiceCoverDocumentOverrides {
    return {
        coverLanguage: model.coverLanguage,
        letterDateDisplay: model.letterDateDisplay,
        recipientCompany: model.recipientCompany,
        recipientAddressLines: model.recipientAddressLines,
        attentionName: model.attentionName,
        attentionTitle: model.attentionTitle,
        quotedCompanyName: model.quotedCompanyName,
        servicesMonthYear: model.servicesMonthYear,
        totalFormatted: model.totalFormatted,
        signatoryName: model.signatoryName,
        signatoryInitials: model.signatoryInitials,
        signatoryTitle: model.signatoryTitle,
        introParagraphOverride: model.introParagraphOverride ?? null,
        invoiceParagraphOverride: model.invoiceParagraphOverride ?? null,
    };
}

export function applyCoverDocumentOverrides(
    model: InvoiceCoverLetterModel,
    cover?: InvoiceCoverDocumentOverrides | null,
): InvoiceCoverLetterModel {
    if (!cover || typeof cover !== 'object')
        return model;
    const next: InvoiceCoverLetterModel = { ...model };
    if (cover.coverLanguage === 'ENG' || cover.coverLanguage === 'RU')
        next.coverLanguage = cover.coverLanguage;
    if (typeof cover.letterDateDisplay === 'string')
        next.letterDateDisplay = cover.letterDateDisplay;
    if (typeof cover.recipientCompany === 'string')
        next.recipientCompany = cover.recipientCompany;
    if (Array.isArray(cover.recipientAddressLines) && cover.recipientAddressLines.length >= 1) {
        const a0 = String(cover.recipientAddressLines[0] ?? '');
        const a1 = String(cover.recipientAddressLines[1] ?? '');
        next.recipientAddressLines = [a0, a1];
    }
    if (typeof cover.attentionName === 'string')
        next.attentionName = cover.attentionName;
    if (typeof cover.attentionTitle === 'string')
        next.attentionTitle = cover.attentionTitle;
    if (typeof cover.quotedCompanyName === 'string')
        next.quotedCompanyName = cover.quotedCompanyName;
    if (typeof cover.servicesMonthYear === 'string')
        next.servicesMonthYear = cover.servicesMonthYear;
    if (typeof cover.totalFormatted === 'string')
        next.totalFormatted = cover.totalFormatted;
    if (typeof cover.signatoryName === 'string')
        next.signatoryName = cover.signatoryName;
    if (typeof cover.signatoryInitials === 'string')
        next.signatoryInitials = cover.signatoryInitials;
    if (typeof cover.signatoryTitle === 'string')
        next.signatoryTitle = cover.signatoryTitle;
    if (cover.introParagraphOverride !== undefined)
        next.introParagraphOverride = cover.introParagraphOverride;
    if (cover.invoiceParagraphOverride !== undefined)
        next.invoiceParagraphOverride = cover.invoiceParagraphOverride;
    return next;
}

function isTimeReportPack(raw: unknown): raw is InvoiceTimeReportPack {
    if (!raw || typeof raw !== 'object')
        return false;
    const o = raw as Record<string, unknown>;
    return typeof o.currency === 'string'
        && Array.isArray(o.detailSlots)
        && Array.isArray(o.summarySlots);
}

export function parseInvoiceDocumentOverrides(raw: unknown): InvoiceDocumentOverridesV1 | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1)
        return null;
    const out: InvoiceDocumentOverridesV1 = { v: 1 };
    if (o.legal != null && typeof o.legal === 'object' && !Array.isArray(o.legal))
        out.legal = o.legal as InvoiceLegalPageOverrides;
    if (o.cover != null && typeof o.cover === 'object' && !Array.isArray(o.cover))
        out.cover = o.cover as InvoiceCoverDocumentOverrides;
    if (isTimeReportPack(o.timeReport))
        out.timeReport = o.timeReport;
    const included = parseIncludedPageKeys(o.includedPageKeys ?? o.included_page_keys);
    if (included)
        out.includedPageKeys = included;
    return out;
}

export function buildInvoiceDocumentOverridesPayload(input: {
    legal: InvoiceLegalPageOverrides;
    cover: InvoiceCoverLetterModel;
    timeReport: InvoiceTimeReportPack;
    includedPageKeys?: Iterable<InvoicePreviewPageKey> | null;
    /** When true, always write includedPageKeys (even if it equals “all”). */
    persistIncludedPages?: boolean;
}): InvoiceDocumentOverridesV1 {
    const included = input.includedPageKeys == null
        ? null
        : [...input.includedPageKeys].filter(isInvoicePreviewPageKey);
    const shouldPersistPages = Boolean(input.persistIncludedPages) || (included != null && included.length > 0);
    return {
        v: 1,
        legal: input.legal,
        cover: pickCoverDocumentOverrides(input.cover),
        timeReport: input.timeReport,
        ...(shouldPersistPages && included ? { includedPageKeys: included } : {}),
    };
}
