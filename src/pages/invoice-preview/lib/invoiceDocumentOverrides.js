import { formatCoverServicesPeriod, parseCoverLetterMoneyAmount, syncStaleCoverTotalInText, } from './invoiceCoverLetterI18n';
import { formatLegalRibbonPeriodMonth } from './invoiceLegalPageI18n';
import { isCombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import { isInvoicePreviewPageKey, parseIncludedPageKeys, } from './invoicePreviewPageSlots';
function isoMonthKey(iso) {
    return iso.trim().slice(0, 7);
}
function textMentionsPeriodMonth(text, isoYmd) {
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
    return Boolean((engMonth && t.includes(engMonth))
        || (ruMonth && t.includes(ruMonth))
        || (ribbonEng && t.includes(ribbonEng))
        || (ribbonRu && t.includes(ribbonRu))
        || t.includes(eng)
        || t.includes(ru));
}
const MONTH_ONLY_RIBBON = new Set([
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]);
function isMonthOnlyRibbon(text) {
    return MONTH_ONLY_RIBBON.has(text.trim().toLowerCase());
}
function isStaleSingleMonthServicesLabel(stored, model) {
    const live = model.servicesMonthYear.trim();
    const value = stored.trim();
    if (!value || value === live)
        return false;
    const endpoints = [model.billingPeriodFromIso, model.billingPeriodIso].filter(Boolean);
    return endpoints.some((iso) => (value === formatCoverServicesPeriod(iso, 'ENG')
        || value === formatCoverServicesPeriod(iso, 'RU')));
}
function looksLikeAutoServiceDescription(text) {
    return /^(Legal services rendered in |Юридические услуги, оказанные в )/i.test(text.trim());
}
/**
 * When billing period month ≠ issue month, drop auto-generated period display
 * fields that were baked from the issue date (e.g. AUGUST ribbon / «rendered in August»).
 */
export function scrubStaleBillingPeriodDocumentOverrides(doc, opts) {
    if (!doc)
        return null;
    const issue = String(opts.issueDateIso ?? '').trim().slice(0, 10);
    const period = String(opts.billingPeriodIso ?? '').trim().slice(0, 10);
    const monthOnlyRibbon = doc.legal?.issueDateDisplay?.trim()
        && isMonthOnlyRibbon(doc.legal.issueDateDisplay);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issue) || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
        if (!monthOnlyRibbon)
            return doc;
        return {
            ...doc,
            legal: { ...doc.legal, issueDateDisplay: null },
        };
    }
    if (isoMonthKey(period) === isoMonthKey(issue) && !monthOnlyRibbon)
        return doc;
    const next = { ...doc };
    if (doc.legal) {
        const legal = { ...doc.legal };
        const ribbon = legal.issueDateDisplay?.trim();
        if (ribbon && (isMonthOnlyRibbon(ribbon)
            || textMentionsPeriodMonth(ribbon, issue)
            || ribbon === formatLegalRibbonPeriodMonth(issue, 'ENG')
            || ribbon === formatLegalRibbonPeriodMonth(issue, 'RU'))) {
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
        const cover = { ...doc.cover };
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
export function pickCoverDocumentOverrides(model) {
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
export function applyCoverDocumentOverrides(model, cover) {
    if (!cover || typeof cover !== 'object')
        return model;
    const next = { ...model };
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
    if (typeof cover.servicesMonthYear === 'string' && !isStaleSingleMonthServicesLabel(cover.servicesMonthYear, model))
        next.servicesMonthYear = cover.servicesMonthYear;
    if (typeof cover.totalFormatted === 'string') {
        const override = cover.totalFormatted.trim();
        const current = String(model.totalFormatted ?? '').trim();
        const overrideZero = /(?:^|\s)0(?:[.,]00)?$/.test(override.replace(/^[A-Z]{3}\s+/i, '').trim())
            || /(?:^|\s)0[.,]00$/.test(override);
        const currentHasMoney = current.length > 0 && !/(?:^|\s)0[.,]00$/.test(current);
        const overrideAmt = parseCoverLetterMoneyAmount(override);
        const currentAmt = parseCoverLetterMoneyAmount(current);
        // Keep freshly computed total when saved cover only differs by FX/float cents.
        const fxCentDrift = overrideAmt != null && currentAmt != null
            && Math.abs(overrideAmt - currentAmt) > 0
            && Math.abs(overrideAmt - currentAmt) <= 0.02;
        if (!(overrideZero && currentHasMoney) && !fxCentDrift)
            next.totalFormatted = cover.totalFormatted;
    }
    if (typeof cover.signatoryName === 'string')
        next.signatoryName = cover.signatoryName;
    if (typeof cover.signatoryInitials === 'string')
        next.signatoryInitials = cover.signatoryInitials;
    if (typeof cover.signatoryTitle === 'string')
        next.signatoryTitle = cover.signatoryTitle;
    if (cover.introParagraphOverride !== undefined)
        next.introParagraphOverride = cover.introParagraphOverride;
    if (cover.invoiceParagraphOverride !== undefined) {
        const para = cover.invoiceParagraphOverride;
        next.invoiceParagraphOverride = typeof para === 'string'
            ? syncStaleCoverTotalInText(para, next.totalFormatted)
            : para;
    }
    return next;
}
function isTimeReportPack(raw) {
    if (!raw || typeof raw !== 'object')
        return false;
    const o = raw;
    return typeof o.currency === 'string'
        && Array.isArray(o.detailSlots)
        && Array.isArray(o.summarySlots);
}
export function parseInvoiceDocumentOverrides(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    if (o.v !== 1)
        return null;
    const out = { v: 1 };
    if (o.legal != null && typeof o.legal === 'object' && !Array.isArray(o.legal))
        out.legal = o.legal;
    if (o.cover != null && typeof o.cover === 'object' && !Array.isArray(o.cover))
        out.cover = o.cover;
    if (isTimeReportPack(o.timeReport))
        out.timeReport = o.timeReport;
    if (o.showServiceInitiatorName === true)
        out.showServiceInitiatorName = true;
    if (o.reportLayout === 'combined' && isCombinedReportSnapshot(o.combinedReport)) {
        out.reportLayout = 'combined';
        out.combinedReport = o.combinedReport;
    }
    const included = parseIncludedPageKeys(o.includedPageKeys ?? o.included_page_keys);
    if (included)
        out.includedPageKeys = included;
    return out;
}
export function buildInvoiceDocumentOverridesPayload(input) {
    const included = input.includedPageKeys == null
        ? null
        : [...input.includedPageKeys].filter(isInvoicePreviewPageKey);
    const shouldPersistPages = Boolean(input.persistIncludedPages) || (included != null && included.length > 0);
    return {
        v: 1,
        legal: input.legal,
        cover: pickCoverDocumentOverrides(input.cover),
        timeReport: input.timeReport,
        ...(input.showServiceInitiatorName ? { showServiceInitiatorName: true } : {}),
        ...(input.combinedReport ? { reportLayout: 'combined', combinedReport: input.combinedReport } : {}),
        ...(shouldPersistPages && included ? { includedPageKeys: included } : {}),
    };
}
