import fontkit from '@pdf-lib/fontkit';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import dejavuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import dejavuSansRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import {
    type InvoicePreviewPackInput,
    packCurrencyCode,
    packInvoiceNumberDisplay,
    packResolveDueIso,
    packResolveIssueIso,
    packUppercaseRibbonDate,
    packZeroCommaAmount,
} from './invoicePreviewPackShared';
import { trimTrailingEmptyDetailSlots, trimTrailingEmptySummarySlots, type InvoiceTimeReportDetailRow, type InvoiceTimeReportPack } from './invoiceTimeReportModel';
import { resolveInvoiceTimeReportPack } from './resolveInvoiceTimeReportPack';
import {
    resolveLegalBillToBankName,
    resolveLegalBillToSwift,
    resolveLegalCaseDetailLine,
    resolveLegalFirmBankingLines,
    resolveLegalOverrideText,
    resolveLegalPaymentDisclaimer,
    resolveLegalServiceDescriptionLine,
    type InvoiceLegalPageOverrides,
} from './invoiceLegalPageModel';
import { rasterizeInvoiceCoverLogoSvg } from './invoiceCoverLogoRaster';
import { getTimeReportLabels } from './invoiceTimeReportI18n';
import { getLegalInvoiceLabels } from './invoiceLegalPageI18n';
import {
    KOSTA_LEGAL_FIRM,
    getCoverLetterLabels,
    resolveCoverIntroParagraph,
    resolveCoverInvoiceParagraph,
    type InvoiceCoverLetterModel,
} from './invoiceCoverLetterModel';

const W = 595.28;
const H = 841.89;

function mmToPt(mm: number): number {
    return (mm * 72) / 25.4;
}

const ML = mmToPt(30);
const MR = mmToPt(12);
const MT = mmToPt(20);
const MB = mmToPt(20);

const TR_RED = rgb(155 / 255, 27 / 255, 48 / 255);
const MUTED_TEXT = rgb(0.41, 0.44, 0.52);
const GRID_LINE = rgb(0.74, 0.77, 0.8);
const BODY = rgb(0.12, 0.14, 0.18);
const CORAL = rgb(232 / 255, 146 / 255, 140 / 255);
const CORAL_DARK = rgb(26 / 255, 5 / 255, 6 / 255);
const PANEL_HEAD = rgb(0.28, 0.33, 0.39);
const FIRM_NAME = rgb(0.12, 0.16, 0.23);
const THANKS_TEXT = rgb(0.42, 0.45, 0.5);
const DISCLAIMER_TEXT = rgb(0.29, 0.33, 0.39);

/** Match preview (11px on 794px canvas) ≈ 8.25pt on A4. DejaVu reads larger than Calibri at same pt. */
const DOC_FS = 8.25;
const DOC_LH = DOC_FS * 1.45;
/** CSS rem @ 16px root → pt (shared layout rhythm). */
const CSS_REM_PT = 12;
const CELL_MUTED = rgb(0.28, 0.33, 0.41);
/** Match InvoiceTimeReportPage.css cell padding, scaled for PDF readability. */
const CELL_PAD_X = 7;
const CELL_PAD_Y = 7;
const CELL_HEAD_PAD_Y = 7;
const CELL_FOOT_PAD_TOP = 8;
const TEXT_ASCENT_RATIO = 0.78;
const CELL_LINE_STEP = DOC_LH;
const TABLE_FOOTER_H = CELL_FOOT_PAD_TOP + DOC_FS + CELL_PAD_Y + 2;
const TR_TITLE_TABLE_GAP = CSS_REM_PT * 0.65;
/** Reserve space for page number band at bottom. */
const PAGE_FOOTER_ZONE_TOP = MB + 52;
const TR_SECTION_GAP = DOC_LH * 2.2;
const TR_SUMMARY_TITLE_GAP = DOC_LH * 1.15;

/** Cover letter rhythm — InvoiceCoverLetter.css (rem @ 16px → pt). */
const COVER_LOGO_H_PT = 27;
const COVER_LOGO_W_PT = COVER_LOGO_H_PT * (439 / 219);
const COVER_HEADER_PAD_BOTTOM = CSS_REM_PT;
const COVER_HEADER_MARGIN_BOTTOM = CSS_REM_PT * 2.1;
const COVER_BLOCK_GAP = CSS_REM_PT * 1.25;
const COVER_SALUTE_GAP = CSS_REM_PT;
const COVER_PARA_GAP = CSS_REM_PT;
const COVER_CLOSING_BEFORE = CSS_REM_PT * 1.65;
const COVER_SIG_BEFORE = CSS_REM_PT * 2;
const COVER_HEADER_RULE = rgb(0.39, 0.45, 0.52);
const LEGAL_LOGO_H_PT = 30;
const LEGAL_LOGO_W_PT = LEGAL_LOGO_H_PT * (439 / 219);
const LEGAL_MASTHEAD_MB = CSS_REM_PT * 0.85;
const LEGAL_RIBBON_MB = CSS_REM_PT * 0.75;
const LEGAL_PANELS_PT = CSS_REM_PT * 0.65;

type PdfRgb = ReturnType<typeof rgb>;

function wrapPlainParagraph(page: PDFPage, text: string, x: number, y: number, maxWidth: number, size: number, font: PDFFont, lineGap: number): number {
    return wrapTextBlock(page, text, x, y, maxWidth, size, font, BODY, lineGap);
}

function wrapTextBlock(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    font: PDFFont,
    color: PdfRgb,
    lineGap: number,
): number {
    const words = text.split(/\s+/).filter(Boolean);
    let line = '';
    let cy = y;
    for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
            line = trial;
        }
        else {
            if (line) {
                page.drawText(line, { x, y: cy, size, font, color });
                cy -= lineGap;
            }
            line = w;
        }
    }
    if (line) {
        page.drawText(line, { x, y: cy, size, font, color });
        cy -= lineGap;
    }
    return cy;
}

function splitTextLines(text: string, maxWidth: number, size: number, font: PDFFont): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
            line = trial;
        }
        else {
            if (line)
                lines.push(line);
            line = w;
        }
    }
    if (line)
        lines.push(line);
    return lines.length ? lines : [''];
}

async function fetchFontBytes(ttfModuleUrl: string): Promise<Uint8Array> {
    const res = await fetch(ttfModuleUrl);
    if (!res.ok)
        throw new Error(`Не удалось загрузить шрифт для PDF (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
}

function drawCoverPage(
    page: PDFPage,
    model: InvoiceCoverLetterModel,
    font: PDFFont,
    fontBold: PDFFont,
    logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null,
): void {
    const logoTop = H - MT;
    let headerContentBottom = logoTop - COVER_LOGO_H_PT;

    if (logoImage) {
        const logoBottom = logoTop - COVER_LOGO_H_PT;
        page.drawImage(logoImage, {
            x: ML,
            y: logoBottom,
            width: COVER_LOGO_W_PT,
            height: COVER_LOGO_H_PT,
        });
        headerContentBottom = logoBottom;
    }

    const contact = [
        KOSTA_LEGAL_FIRM.addressLine,
        KOSTA_LEGAL_FIRM.phone,
        KOSTA_LEGAL_FIRM.email,
        KOSTA_LEGAL_FIRM.web,
    ];
    let cy = logoTop;
    const muted = rgb(0.22, 0.26, 0.34);
    for (const line of contact) {
        const tw = font.widthOfTextAtSize(line, DOC_FS);
        page.drawText(line, { x: W - MR - tw, y: cy, size: DOC_FS, font, color: muted });
        cy -= DOC_LH;
    }
    headerContentBottom = Math.min(headerContentBottom, cy);

    const borderY = headerContentBottom - COVER_HEADER_PAD_BOTTOM;
    page.drawLine({
        start: { x: ML, y: borderY },
        end: { x: W - MR, y: borderY },
        thickness: 0.5,
        color: COVER_HEADER_RULE,
        opacity: 0.35,
    });

    let y = borderY - COVER_HEADER_MARGIN_BOTTOM;

    page.drawText(model.letterDateDisplay, { x: ML, y, size: DOC_FS, font, color: BODY });

    y -= COVER_BLOCK_GAP;
    page.drawText(model.recipientCompany, { x: ML, y, size: DOC_FS, font: fontBold, color: BODY });
    y -= DOC_LH;
    page.drawText(model.recipientAddressLines[0], { x: ML, y, size: DOC_FS, font, color: BODY });
    if (model.recipientAddressLines[1]) {
        y -= DOC_LH;
        page.drawText(model.recipientAddressLines[1], { x: ML, y, size: DOC_FS, font, color: BODY });
    }

    y -= COVER_BLOCK_GAP;
    const labels = getCoverLetterLabels(model.coverLanguage);
    page.drawText(`${labels.attention}: ${model.attentionName}`, { x: ML, y, size: DOC_FS, font: fontBold, color: BODY });
    y -= DOC_LH;
    page.drawText(model.attentionTitle, { x: ML, y, size: DOC_FS, font, color: BODY });

    y -= COVER_BLOCK_GAP;
    page.drawText(`${labels.dear} ${model.attentionName},`, { x: ML, y, size: DOC_FS, font, color: BODY });

    y -= COVER_SALUTE_GAP;
    const p1 = resolveCoverIntroParagraph(model);
    const maxW = W - ML - MR;
    y = wrapPlainParagraph(page, p1, ML, y, maxW, DOC_FS, font, COVER_PARA_GAP);

    y -= COVER_PARA_GAP * 0.35;
    const p2 = resolveCoverInvoiceParagraph(model);
    y = wrapPlainParagraph(page, p2, ML, y, maxW, DOC_FS, font, COVER_PARA_GAP);

    y -= COVER_CLOSING_BEFORE;
    page.drawText(labels.closing, { x: ML, y, size: DOC_FS, font, color: BODY });

    y -= COVER_SIG_BEFORE;
    const sigW = 160;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + sigW, y }, thickness: 0.5, color: rgb(0.35, 0.38, 0.45) });
    y -= DOC_LH * 0.55;

    page.drawText(model.signatoryName, { x: ML, y, size: DOC_FS, font, color: BODY });
    y -= DOC_LH;
    page.drawText(model.signatoryTitle, { x: ML, y, size: DOC_FS, font, color: BODY });
}

function colLayout(tableLeft: number, tableW: number, weights: readonly number[]) {
    const sum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (w / sum) * tableW);
    const xs: number[] = [];
    let x = tableLeft;
    for (const cw of widths) {
        xs.push(x);
        x += cw;
    }
    return { widths, xs };
}

function clipPdfCellText(txt: string, maxW: number, font: PDFFont, size: number): string {
    const t = txt.trim();
    if (!t || maxW <= 2)
        return '';
    if (font.widthOfTextAtSize(t, size) <= maxW)
        return t;
    const ell = '\u2026';
    let n = t.length;
    while (n > 0 && font.widthOfTextAtSize(`${t.slice(0, n)}${ell}`, size) > maxW)
        n--;
    return n > 0 ? `${t.slice(0, n)}${ell}` : ell;
}

function drawRightFitPdfBold(
    page: PDFPage,
    text: string,
    xCellLeft: number,
    cellW: number,
    yBaseline: number,
    fontBold: PDFFont,
): void {
    const t = text.trim();
    if (!t.length)
        return;
    const maxW = Math.max(4, cellW - CELL_PAD_X * 2);
    const fitted = fitPdfCellText(t, maxW, fontBold, DOC_FS, DOC_FS * 0.68);
    if (!fitted.text)
        return;
    const tw = fontBold.widthOfTextAtSize(fitted.text, fitted.size);
    page.drawText(fitted.text, {
        x: xCellLeft + cellW - CELL_PAD_X - tw,
        y: yBaseline,
        size: fitted.size,
        font: fontBold,
        color: TR_RED,
    });
}

function fitPdfCellText(txt: string, maxW: number, font: PDFFont, preferSize: number, minSize = 8): { text: string; size: number } {
    const t = txt.trim();
    if (!t || maxW <= 2)
        return { text: '', size: preferSize };
    let fs = preferSize;
    while (fs >= minSize) {
        if (font.widthOfTextAtSize(t, fs) <= maxW)
            return { text: t, size: fs };
        fs -= 0.5;
    }
    return { text: clipPdfCellText(t, maxW, font, minSize), size: minSize };
}

function wrapCellLines(text: string, maxW: number, font: PDFFont, size: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length)
        return [];
    const lines: string[] = [];
    let line = '';
    const pushLongToken = (token: string) => {
        let chunk = '';
        for (const ch of token) {
            const trial = chunk + ch;
            if (font.widthOfTextAtSize(trial, size) <= maxW)
                chunk = trial;
            else {
                if (chunk)
                    lines.push(chunk);
                chunk = ch;
            }
        }
        line = chunk;
    };
    for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(trial, size) <= maxW) {
            line = trial;
        }
        else {
            if (line)
                lines.push(line);
            if (font.widthOfTextAtSize(w, size) > maxW)
                pushLongToken(w);
            else
                line = w;
        }
    }
    if (line)
        lines.push(line);
    return lines;
}

function textAscent(font: PDFFont, size: number): number {
    return font.heightAtSize(size) * TEXT_ASCENT_RATIO;
}

function bodyRowHeight(maxLines: number): number {
    const lines = Math.max(maxLines, 1);
    return CELL_PAD_Y * 2 + (lines - 1) * CELL_LINE_STEP + DOC_FS * 1.1;
}

function computeBodyRowLayouts(
    bodyTexts: readonly (readonly string[])[],
    bodyRows: number,
    widths: readonly number[],
    font: PDFFont,
    wrapCols: ReadonlySet<number>,
): { rowHeights: number[]; cellLines: string[][][] } {
    const rowHeights: number[] = [];
    const cellLines: string[][][] = [];
    for (let r = 0; r < bodyRows; r++) {
        const cols = bodyTexts[r] ?? [];
        const rowCellLines: string[][] = [];
        let maxLines = 1;
        for (let c = 0; c < widths.length; c++) {
            const raw = String(cols[c] ?? '').trim();
            const maxW = Math.max(8, widths[c]! - CELL_PAD_X * 2);
            let lines: string[];
            if (!raw) {
                lines = [];
            }
            else if (wrapCols.has(c)) {
                lines = wrapCellLines(raw, maxW, font, DOC_FS);
            }
            else {
                const fitted = fitPdfCellText(raw, maxW, font, DOC_FS, DOC_FS * 0.72);
                lines = fitted.text ? [fitted.text] : [];
            }
            rowCellLines.push(lines);
            maxLines = Math.max(maxLines, Math.max(lines.length, 1));
        }
        cellLines.push(rowCellLines);
        rowHeights.push(bodyRowHeight(maxLines));
    }
    return { rowHeights, cellLines };
}

function paintTimeReportBody(
    page: PDFPage,
    cellLines: string[][][],
    rowHeights: readonly number[],
    yHeaderBot: number,
    xs: readonly number[],
    widths: readonly number[],
    font: PDFFont,
    rightAlignedCols: ReadonlySet<number>,
): void {
    const ascent = textAscent(font, DOC_FS);
    let yRowTop = yHeaderBot;
    for (let r = 0; r < cellLines.length; r++) {
        const rowH = rowHeights[r] ?? bodyRowHeight(1);
        const cols = cellLines[r]!;
        yRowTop -= rowH;
        const cellTop = yRowTop + rowH;
        for (let c = 0; c < cols.length && c < xs.length; c++) {
            const lines = cols[c]!;
            if (!lines.length)
                continue;
            let yLine = cellTop - CELL_PAD_Y - ascent;
            for (const ln of lines) {
                const tw = font.widthOfTextAtSize(ln, DOC_FS);
                let xDraw = xs[c]! + CELL_PAD_X;
                if (rightAlignedCols.has(c))
                    xDraw = xs[c]! + widths[c]! - CELL_PAD_X - tw;
                page.drawText(ln, { x: xDraw, y: yLine, size: DOC_FS, font, color: CELL_MUTED });
                yLine -= CELL_LINE_STEP;
            }
        }
    }
}

function estimateGridTableHeight(
    tableW: number,
    colWeights: readonly number[],
    headers: readonly string[],
    bodyTexts: readonly (readonly string[])[],
    wrapCols: ReadonlySet<number>,
    font: PDFFont,
    fontBold: PDFFont,
    withFooter: boolean,
): number {
    const { widths } = colLayout(ML, tableW, colWeights);
    const { headerH } = computeHeaderLayouts(headers, widths, fontBold);
    const { rowHeights } = computeBodyRowLayouts(bodyTexts, bodyTexts.length, widths, font, wrapCols);
    const bodyH = rowHeights.reduce((s, h) => s + h, 0);
    return headerH + bodyH + (withFooter ? TABLE_FOOTER_H : 0);
}

function estimateTimeReportTableTop(continuation: boolean, model: InvoiceCoverLetterModel, fontBold: PDFFont): number {
    let yTop = H - MT - 4;
    yTop -= 18;
    yTop -= 14;
    const labels = getTimeReportLabels(model.coverLanguage);
    const title = continuation
        ? labels.titleContinued(model.servicesMonthYear)
        : labels.title(model.servicesMonthYear);
    const titleLines = splitTextLines(title, W - ML - MR, DOC_FS, fontBold);
    yTop -= Math.max(titleLines.length, 1) * DOC_LH;
    return yTop - TR_TITLE_TABLE_GAP;
}

type PdfTimeReportPagePlan = {
    slice: InvoiceTimeReportDetailRow[];
    continuation: boolean;
    showDetailTotals: boolean;
    showSummarySection: boolean;
};

function paginateDetailRowsForPdf(
    rows: readonly InvoiceTimeReportDetailRow[],
    model: InvoiceCoverLetterModel,
    pack: InvoiceTimeReportPack,
    font: PDFFont,
    fontBold: PDFFont,
): PdfTimeReportPagePlan[] {
    const trimmed = trimTrailingEmptyDetailSlots(rows);
    if (trimmed.length === 0) {
        return [{
            slice: [{ date: '', initials: '', task: '', description: '', hours: '', hourlyRate: '', amount: '' }],
            continuation: false,
            showDetailTotals: true,
            showSummarySection: true,
        }];
    }

    const tableW = W - ML - MR;
    const labels = getTimeReportLabels(model.coverLanguage);
    const cur = packCurrencyCode(model);
    const detailHeaders = [labels.date, labels.initials, labels.task, labels.description, labels.hours, labels.rate, labels.amount(cur)] as const;
    const summaryHeaders = [labels.initials, labels.name, labels.titleCol, labels.hours, labels.hourlyRate, labels.totalPrice(cur)] as const;
    const summaryBody = trimTrailingEmptySummarySlots(pack.summarySlots)
        .map((r) => [r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice] as const);
    const summaryReserve = TR_SECTION_GAP + TR_SUMMARY_TITLE_GAP
        + estimateGridTableHeight(
            tableW,
            TIME_REPORT_PDF_SUMMARY_WEIGHTS,
            summaryHeaders,
            summaryBody.length ? summaryBody : [['', '', '', '', '', '']],
            TR_SUMMARY_WRAP_COLS,
            font,
            fontBold,
            true,
        );

    const pages: PdfTimeReportPagePlan[] = [];
    let i = 0;
    let pageIndex = 0;

    while (i < trimmed.length) {
        const continuation = pageIndex > 0;
        const yGridTop = estimateTimeReportTableTop(continuation, model, fontBold);
        const maxH = yGridTop - PAGE_FOOTER_ZONE_TOP;
        const remaining = trimmed.length - i;

        const heightFor = (count: number, withFooter: boolean) => {
            const body = trimmed.slice(i, i + count).map((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount] as const);
            return estimateGridTableHeight(
                tableW,
                TIME_REPORT_PDF_DETAIL_WEIGHTS,
                detailHeaders,
                body,
                TR_DETAIL_WRAP_COLS,
                font,
                fontBold,
                withFooter,
            );
        };

        let takeWithSummary = 0;
        for (let n = 1; n <= remaining; n++) {
            if (heightFor(n, true) <= maxH - summaryReserve)
                takeWithSummary = n;
            else
                break;
        }

        if (takeWithSummary === remaining) {
            pages.push({
                slice: trimmed.slice(i),
                continuation,
                showDetailTotals: true,
                showSummarySection: true,
            });
            break;
        }

        let take = 0;
        for (let n = 1; n <= remaining; n++) {
            if (heightFor(n, false) <= maxH)
                take = n;
            else
                break;
        }
        if (take < 1)
            take = 1;

        pages.push({
            slice: trimmed.slice(i, i + take),
            continuation,
            showDetailTotals: false,
            showSummarySection: false,
        });
        i += take;
        pageIndex++;
    }

    return pages;
}

function trimDetailSliceToFitPage(
    slice: InvoiceTimeReportDetailRow[],
    yGridTop: number,
    tableW: number,
    detailHeaders: readonly string[],
    showDetailTotals: boolean,
    font: PDFFont,
    fontBold: PDFFont,
): InvoiceTimeReportDetailRow[] {
    const maxDetailHeight = yGridTop - PAGE_FOOTER_ZONE_TOP;
    let trimmed = [...slice];
    while (trimmed.length > 1) {
        const body = trimmed.map((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount] as const);
        const h = estimateGridTableHeight(
            tableW,
            TIME_REPORT_PDF_DETAIL_WEIGHTS,
            detailHeaders,
            body,
            TR_DETAIL_WRAP_COLS,
            font,
            fontBold,
            showDetailTotals,
        );
        if (h <= maxDetailHeight)
            break;
        trimmed = trimmed.slice(0, -1);
    }
    return trimmed;
}

function trimDetailSliceToFitSummary(
    slice: InvoiceTimeReportDetailRow[],
    yGridTop: number,
    tableW: number,
    detailHeaders: readonly string[],
    summaryHeaders: readonly string[],
    summaryBody: readonly (readonly string[])[],
    showDetailTotals: boolean,
    font: PDFFont,
    fontBold: PDFFont,
): InvoiceTimeReportDetailRow[] {
    const summaryReserve = TR_SECTION_GAP + TR_SUMMARY_TITLE_GAP
        + estimateGridTableHeight(
            tableW,
            TIME_REPORT_PDF_SUMMARY_WEIGHTS,
            summaryHeaders,
            summaryBody.length ? summaryBody : [['', '', '', '', '', '']],
            TR_SUMMARY_WRAP_COLS,
            font,
            fontBold,
            true,
        );
    const maxDetailHeight = yGridTop - PAGE_FOOTER_ZONE_TOP - summaryReserve;
    let trimmed = [...slice];
    while (trimmed.length > 1) {
        const body = trimmed.map((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount] as const);
        const h = estimateGridTableHeight(
            tableW,
            TIME_REPORT_PDF_DETAIL_WEIGHTS,
            detailHeaders,
            body,
            TR_DETAIL_WRAP_COLS,
            font,
            fontBold,
            showDetailTotals,
        );
        if (h <= maxDetailHeight)
            break;
        trimmed = trimmed.slice(0, -1);
    }
    return trimmed;
}

function computeHeaderLayouts(
    headers: readonly string[],
    widths: readonly number[],
    fontBold: PDFFont,
): { headerCells: { text: string; size: number }[]; headerH: number } {
    const headerCells: { text: string; size: number }[] = [];
    let maxSize = DOC_FS;
    for (let i = 0; i < headers.length; i++) {
        const cw = Math.max(8, widths[i]! - CELL_PAD_X * 2);
        const fitted = fitPdfCellText(headers[i] ?? '', cw, fontBold, DOC_FS, DOC_FS * 0.72);
        headerCells.push({ text: fitted.text, size: fitted.size });
        maxSize = Math.max(maxSize, fitted.size);
    }
    return {
        headerCells,
        headerH: CELL_HEAD_PAD_Y * 2 + maxSize + 4,
    };
}

function drawTimeReportGridTable(
    page: PDFPage,
    opts: {
        yTopPdf: number;
        tableLeft: number;
        tableW: number;
        colWeights: readonly number[];
        headers: readonly string[];
        bodyRows: number;
        footerKind: 'detail' | 'summary';
        summaryCurrency: string | null;
        font: PDFFont;
        fontBold: PDFFont;

        bodyTexts?: readonly (readonly string[])[] | null;
        rightAlignedBodyCols?: ReadonlySet<number>;
        wrapBodyCols?: ReadonlySet<number>;
        footerTotals?: {
            detail?: { hours: string; amount: string };
            summary?: { hours: string; hourly: string; amount: string };
        } | null;

        showInnerTotal?: boolean;
        totalLabel?: string;
    },
): number {
    const {
        yTopPdf,
        tableLeft,
        tableW,
        colWeights,
        headers,
        bodyRows,
        footerKind,
        summaryCurrency,
        fontBold,
        font,
        bodyTexts,
        rightAlignedBodyCols,
        wrapBodyCols,
        footerTotals,
        showInnerTotal,
        totalLabel = 'Total',
    } = opts;
    const { xs, widths } = colLayout(tableLeft, tableW, colWeights);
    const { headerCells, headerH } = computeHeaderLayouts(headers, widths, fontBold);
    const footerH = TABLE_FOOTER_H;
    const yHeaderBot = yTopPdf - headerH;
    const innerFootLines = footerKind === 'detail'
        ? (showInnerTotal !== false ? 1 : 0)
        : 1;

    const bodyData = bodyTexts?.length ? bodyTexts : null;
    const { rowHeights, cellLines } = bodyData
        ? computeBodyRowLayouts(bodyData, bodyRows, widths, font, wrapBodyCols ?? new Set())
        : { rowHeights: Array.from({ length: bodyRows }, () => bodyRowHeight(1)), cellLines: [] as string[][][] };
    const bodyHeight = rowHeights.reduce((s, h) => s + h, 0);
    const tableBottom = yHeaderBot - bodyHeight - (innerFootLines > 0 ? footerH : 0);

    page.drawRectangle({
        x: tableLeft,
        y: yHeaderBot,
        width: tableW,
        height: headerH,
        color: TR_RED,
    });

    for (let i = 0; i < headerCells.length; i++) {
        const { text, size } = headerCells[i]!;
        if (!text)
            continue;
        const rightAlign = footerKind === 'detail'
            ? i >= 4
            : i >= 3;
        const tw = fontBold.widthOfTextAtSize(text, size);
        let xDraw = xs[i]! + CELL_PAD_X;
        if (rightAlign)
            xDraw = xs[i]! + widths[i]! - CELL_PAD_X - tw;
        const yLine = yHeaderBot + headerH - CELL_HEAD_PAD_Y - textAscent(fontBold, size);
        page.drawText(text, {
            x: xDraw,
            y: yLine,
            size,
            font: fontBold,
            color: rgb(1, 1, 1),
        });
    }

    page.drawRectangle({
        x: tableLeft,
        y: tableBottom,
        width: tableW,
        height: yTopPdf - tableBottom,
        borderWidth: 0.45,
        borderColor: GRID_LINE,
    });

    let yLine = yHeaderBot;
    for (const rh of rowHeights) {
        yLine -= rh;
        page.drawLine({
            start: { x: tableLeft, y: yLine },
            end: { x: tableLeft + tableW, y: yLine },
            thickness: 0.35,
            color: GRID_LINE,
        });
    }
    if (innerFootLines > 0) {
        page.drawLine({
            start: { x: tableLeft, y: tableBottom },
            end: { x: tableLeft + tableW, y: tableBottom },
            thickness: 0.35,
            color: GRID_LINE,
        });
    }

    for (let j = 1; j < xs.length; j++) {
        page.drawLine({
            start: { x: xs[j]!, y: yHeaderBot },
            end: { x: xs[j]!, y: tableBottom },
            thickness: 0.35,
            color: GRID_LINE,
        });
    }

    if (cellLines.length) {
        paintTimeReportBody(
            page,
            cellLines,
            rowHeights,
            yHeaderBot,
            xs,
            widths,
            font,
            rightAlignedBodyCols ?? new Set(),
        );
    }

    const yFoot = tableBottom + CELL_FOOT_PAD_TOP + Math.max(0, (footerH - CELL_FOOT_PAD_TOP - DOC_FS - CELL_PAD_Y) / 2);
    if (innerFootLines > 0) {
        page.drawText(totalLabel, {
            x: xs[0]! + CELL_PAD_X,
            y: yFoot,
            size: DOC_FS,
            font: fontBold,
            color: TR_RED,
        });

        if (footerKind === 'detail' && footerTotals?.detail) {
            const { hours, amount } = footerTotals.detail;
            const hi = 4;
            const ai = 6;
            if (hours?.trim())
                drawRightFitPdfBold(page, hours, xs[hi]!, widths[hi]!, yFoot, fontBold);
            if (amount?.trim())
                drawRightFitPdfBold(page, amount, xs[ai]!, widths[ai]!, yFoot, fontBold);
        }

        if (footerKind === 'summary' && footerTotals?.summary) {
            const { hours, hourly, amount } = footerTotals.summary;
            const hci = 3;
            const rci = 4;
            const aci = 5;

            if (hours?.trim())
                drawRightFitPdfBold(page, hours, xs[hci]!, widths[hci]!, yFoot, fontBold);
            if (hourly?.trim())
                drawRightFitPdfBold(page, hourly, xs[rci]!, widths[rci]!, yFoot, fontBold);

            let amtDraw = amount?.trim();
            if (!amtDraw && summaryCurrency)
                amtDraw = summaryCurrency;

            if (amtDraw?.trim())
                drawRightFitPdfBold(page, amtDraw, xs[aci]!, widths[aci]!, yFoot, fontBold);
        }

        if (footerKind === 'summary' && !footerTotals?.summary?.amount?.trim() && summaryCurrency) {
            const lastI = xs.length - 1;
            const lastW = widths[lastI]!;
            drawRightFitPdfBold(page, summaryCurrency, xs[lastI]!, lastW, yFoot, fontBold);
        }
    }

    return tableBottom;
}

const TIME_REPORT_PDF_DETAIL_WEIGHTS = [14, 7, 12, 24, 10, 14, 19] as const;
const TIME_REPORT_PDF_SUMMARY_WEIGHTS = [9, 24, 22, 11, 11, 23] as const;
/** Description + Task can wrap to keep full values visible. */
const TR_DETAIL_WRAP_COLS = new Set([2, 3]);
const TR_SUMMARY_WRAP_COLS = new Set([1, 2]);

function drawTimeReportBandHeader(page: PDFPage, model: InvoiceCoverLetterModel, fontBold: PDFFont, continuation: boolean): number {
    let yTop = H - MT - 4;
    const labels = getTimeReportLabels(model.coverLanguage);
    const confLabel = labels.confidential;
    const fsConf = DOC_FS;
    const cw = fontBold.widthOfTextAtSize(confLabel, fsConf);
    const padConfX = 6;
    const padConfY = 4;
    const boxW = cw + padConfX * 2;
    const boxH = fsConf + padConfY * 2;
    const boxX = W - MR - boxW;
    const boxBottom = yTop - boxH + 4;
    page.drawRectangle({
        x: boxX,
        y: boxBottom,
        width: boxW,
        height: boxH,
        color: TR_RED,
    });
    page.drawText(confLabel, {
        x: boxX + padConfX,
        y: boxBottom + padConfY - 1,
        size: fsConf,
        font: fontBold,
        color: rgb(1, 1, 1),
    });
    yTop -= 18;
    page.drawLine({
        start: { x: ML, y: yTop + 6 },
        end: { x: W - MR, y: yTop + 6 },
        thickness: 0.6,
        color: TR_RED,
    });
    yTop -= 14;
    const title = continuation
        ? labels.titleContinued(model.servicesMonthYear)
        : labels.title(model.servicesMonthYear);
    const yAfterTitle = wrapTextBlock(page, title, ML, yTop, W - ML - MR, DOC_FS, fontBold, TR_RED, DOC_LH);
    return yAfterTitle - TR_TITLE_TABLE_GAP;
}

function drawTimeReportBandFooter(page: PDFPage, fontBold: PDFFont, pageTag: number): void {
    const footerLine = MB + 28;
    page.drawLine({
        start: { x: ML, y: footerLine },
        end: { x: W - MR, y: footerLine },
        thickness: 0.55,
        color: TR_RED,
    });
    const box = 13;
    const bx = W - MR - box;
    page.drawRectangle({
        x: bx,
        y: footerLine - box - 2,
        width: box,
        height: box,
        borderColor: TR_RED,
        borderWidth: 1,
        color: rgb(1, 1, 1),
    });
    const tag = String(pageTag);
    page.drawText(tag, {
        x: bx + (box / 2 - fontBold.widthOfTextAtSize(tag, DOC_FS) / 2),
        y: footerLine - box + 1,
        size: DOC_FS,
        font: fontBold,
        color: TR_RED,
    });
}

function drawSingleTimeReportPdfPage(
    page: PDFPage,
    model: InvoiceCoverLetterModel,
    pack: InvoiceTimeReportPack,
    font: PDFFont,
    fontBold: PDFFont,
    pageTag: number,
    slice: InvoiceTimeReportDetailRow[],
    opts: {
        continuation: boolean;
        showDetailTotals: boolean;
        showSummarySection: boolean;
    },
): void {
    const yGridTop = drawTimeReportBandHeader(page, model, fontBold, opts.continuation);
    const tableW = W - ML - MR;
    const cur = packCurrencyCode(model);
    const labels = getTimeReportLabels(model.coverLanguage);
    const amountHdr = labels.amount(cur);
    const detailHeaders = [labels.date, labels.initials, labels.task, labels.description, labels.hours, labels.rate, amountHdr] as const;
    const summaryHeaders = [labels.initials, labels.name, labels.titleCol, labels.hours, labels.hourlyRate, labels.totalPrice(cur)] as const;

    const trimmedSummary = trimTrailingEmptySummarySlots(pack.summarySlots);
    const summaryBody = trimmedSummary.map((r) => [r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice] as const);
    const summaryRows = Math.max(summaryBody.length, 1);

    let detailSlice = slice;
    if (opts.showSummarySection) {
        detailSlice = trimDetailSliceToFitSummary(
            slice,
            yGridTop,
            tableW,
            detailHeaders,
            summaryHeaders,
            summaryBody,
            opts.showDetailTotals,
            font,
            fontBold,
        );
    }
    else {
        detailSlice = trimDetailSliceToFitPage(slice, yGridTop, tableW, detailHeaders, false, font, fontBold);
    }

    const detailBody = detailSlice.map((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount] as const);
    const nRows = Math.max(detailSlice.length, 1);

    const yAfterDetail = drawTimeReportGridTable(page, {
        tableLeft: ML,
        tableW,
        yTopPdf: yGridTop,
        colWeights: TIME_REPORT_PDF_DETAIL_WEIGHTS,
        headers: detailHeaders,
        bodyRows: nRows,
        footerKind: 'detail',
        summaryCurrency: null,
        font,
        fontBold,
        bodyTexts: detailBody.length ? detailBody : [['', '', '', '', '', '', '']],
        rightAlignedBodyCols: new Set([4, 5, 6]),
        wrapBodyCols: TR_DETAIL_WRAP_COLS,
        showInnerTotal: opts.showDetailTotals,
        totalLabel: labels.total,
        footerTotals: opts.showDetailTotals
            ? {
                detail: {
                    hours: pack.detailTotalHoursDisplay,
                    amount: pack.detailTotalAmountDisplay,
                },
            }
            : null,
    });

    if (!opts.showSummarySection) {
        drawTimeReportBandFooter(page, fontBold, pageTag);
        return;
    }

    let yMid = yAfterDetail - TR_SECTION_GAP;
    page.drawText(labels.summaryTitle, {
        x: ML,
        y: yMid,
        size: DOC_FS,
        font: fontBold,
        color: TR_RED,
    });
    yMid -= TR_SUMMARY_TITLE_GAP;

    drawTimeReportGridTable(page, {
        tableLeft: ML,
        tableW,
        yTopPdf: yMid,
        colWeights: TIME_REPORT_PDF_SUMMARY_WEIGHTS,
        headers: summaryHeaders,
        bodyRows: summaryRows,
        footerKind: 'summary',
        summaryCurrency: cur,
        font,
        fontBold,
        bodyTexts: summaryBody.length ? summaryBody : [['', '', '', '', '', '']],
        rightAlignedBodyCols: new Set([3, 4, 5]),
        wrapBodyCols: TR_SUMMARY_WRAP_COLS,
        totalLabel: labels.total,
        footerTotals: {
            summary: {
                hours: pack.summaryGrandHoursDisplay,
                hourly: '—',
                amount: pack.summaryGrandAmountDisplay || cur,
            },
        },
    });

    drawTimeReportBandFooter(page, fontBold, pageTag);
}

function drawLegalInvoicePdfPage(
    page: PDFPage,
    model: InvoiceCoverLetterModel,
    session: InvoicePreviewSessionV1 | null,
    font: PDFFont,
    fontBold: PDFFont,
    logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null,
    legalOverrides?: InvoiceLegalPageOverrides,
): void {
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const labels = getLegalInvoiceLabels(model.coverLanguage);
    const zeroFallback = packZeroCommaAmount(model);
    const ribbonIssue = resolveLegalOverrideText(
        legalOverrides?.issueDateDisplay,
        packUppercaseRibbonDate(issueIso, model.coverLanguage),
    );
    const dueBanner = resolveLegalOverrideText(
        legalOverrides?.dueDateDisplay,
        packUppercaseRibbonDate(dueIso, model.coverLanguage),
    );
    const invNo = resolveLegalOverrideText(legalOverrides?.invoiceNumber, packInvoiceNumberDisplay(session));
    const vatAmount = resolveLegalOverrideText(legalOverrides?.vatAmount, zeroFallback);
    const extraExpensesAmount = resolveLegalOverrideText(legalOverrides?.extraExpensesAmount, zeroFallback);
    const firmAddress = resolveLegalOverrideText(legalOverrides?.firmAddress, KOSTA_LEGAL_FIRM.addressLine);
    const caseLine = resolveLegalCaseDetailLine(session, legalOverrides, model.coverLanguage);
    const cur = packCurrencyCode(model);
    const svcLine = resolveLegalServiceDescriptionLine(model, legalOverrides);
    const paymentDisclaimer = resolveLegalPaymentDisclaimer(legalOverrides, model.coverLanguage);

    const contentW = W - ML - MR;
    let y = H - MT;

    let logoBottom = y;
    if (logoImage) {
        const logoBottomY = y - LEGAL_LOGO_H_PT;
        logoBottom = logoBottomY;
        page.drawImage(logoImage, {
            x: W - MR - LEGAL_LOGO_W_PT,
            y: logoBottomY,
            width: LEGAL_LOGO_W_PT,
            height: LEGAL_LOGO_H_PT,
        });
    }

    const blurbW = contentW * 0.62;
    const firmName = `${KOSTA_LEGAL_FIRM.brandName} LF`;
    page.drawText(firmName, {
        x: ML,
        y,
        size: DOC_FS,
        font: fontBold,
        color: FIRM_NAME,
    });
    let yBlurb = y - DOC_LH * 1.15;

    yBlurb = wrapTextBlock(page, firmAddress, ML, yBlurb, blurbW, DOC_FS, font, MUTED_TEXT, DOC_LH * 0.92);
    const leftBlurb = resolveLegalFirmBankingLines(cur, legalOverrides, model.coverLanguage);
    for (const ln of leftBlurb) {
        page.drawText(ln, { x: ML, y: yBlurb, size: DOC_FS, font, color: MUTED_TEXT });
        yBlurb -= DOC_LH * 0.92;
    }

    y = Math.min(yBlurb, logoBottom) - LEGAL_MASTHEAD_MB;

    const ribbonPad = DOC_FS * 0.38;
    const ribbonH = DOC_FS + ribbonPad * 2;
    page.drawRectangle({
        x: ML,
        y: y - ribbonH,
        width: contentW,
        height: ribbonH,
        color: CORAL,
    });
    const ribbonTextY = y - ribbonH + ribbonPad + 1;
    page.drawText(labels.invoiceNo(invNo), {
        x: ML + 6,
        y: ribbonTextY,
        size: DOC_FS,
        font: fontBold,
        color: CORAL_DARK,
    });
    const ribbonDateW = fontBold.widthOfTextAtSize(ribbonIssue, DOC_FS);
    page.drawText(ribbonIssue, {
        x: ML + contentW - 6 - ribbonDateW,
        y: ribbonTextY,
        size: DOC_FS,
        font: fontBold,
        color: CORAL_DARK,
    });
    y -= ribbonH + LEGAL_RIBBON_MB;

    page.drawLine({
        start: { x: ML, y: y + 3 },
        end: { x: ML + contentW, y: y + 3 },
        thickness: 0.5,
        color: GRID_LINE,
    });
    y -= LEGAL_PANELS_PT;

    const splitX = ML + contentW * 0.52;
    const rightColW = W - MR - splitX - 8;
    const panelsTop = y;

    page.drawText(labels.billTo, { x: ML, y: panelsTop, size: DOC_FS, font: fontBold, color: PANEL_HEAD });
    let yLeft = panelsTop - DOC_LH;
    page.drawText(model.recipientCompany, { x: ML, y: yLeft, size: DOC_FS, font: fontBold, color: BODY });
    yLeft -= DOC_LH;
    page.drawText(`${labels.address}:`, { x: ML, y: yLeft, size: DOC_FS, font: fontBold, color: MUTED_TEXT });
    yLeft -= DOC_LH * 0.92;
    page.drawText(model.recipientAddressLines[0], { x: ML, y: yLeft, size: DOC_FS, font, color: MUTED_TEXT });
    yLeft -= DOC_LH * 0.92;
    if (model.recipientAddressLines[1]) {
        page.drawText(model.recipientAddressLines[1], { x: ML, y: yLeft, size: DOC_FS, font, color: MUTED_TEXT });
        yLeft -= DOC_LH * 0.92;
    }
    page.drawText(`${labels.bankName}:`, { x: ML, y: yLeft, size: DOC_FS, font: fontBold, color: MUTED_TEXT });
    yLeft -= DOC_LH * 0.92;
    page.drawText(resolveLegalBillToBankName(legalOverrides), { x: ML, y: yLeft, size: DOC_FS, font, color: MUTED_TEXT });
    yLeft -= DOC_LH * 0.92;
    page.drawText(`${labels.swift}:`, { x: ML, y: yLeft, size: DOC_FS, font: fontBold, color: MUTED_TEXT });
    yLeft -= DOC_LH * 0.92;
    page.drawText(resolveLegalBillToSwift(legalOverrides), { x: ML, y: yLeft, size: DOC_FS, font, color: MUTED_TEXT });
    yLeft -= DOC_LH * 0.92;

    page.drawText(labels.caseDetails, { x: splitX, y: panelsTop, size: DOC_FS, font: fontBold, color: PANEL_HEAD });
    const yRight = wrapTextBlock(page, caseLine, splitX, panelsTop - DOC_LH, rightColW, DOC_FS, font, BODY, DOC_LH);

    y = Math.min(yLeft, yRight) - DOC_LH;

    const descColW = contentW * 0.72;
    const headH = DOC_FS + 10;
    const yHeadTop = y;
    const yHeadBot = yHeadTop - headH;
    page.drawRectangle({
        x: ML,
        y: yHeadBot,
        width: contentW,
        height: headH,
        color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(labels.description, {
        x: ML + 6,
        y: yHeadBot + 5,
        size: DOC_FS,
        font: fontBold,
        color: rgb(1, 1, 1),
    });
    const th2 = labels.total(cur);
    const th2W = fontBold.widthOfTextAtSize(th2, DOC_FS);
    page.drawText(th2, {
        x: ML + contentW - 6 - th2W,
        y: yHeadBot + 5,
        size: DOC_FS,
        font: fontBold,
        color: rgb(1, 1, 1),
    });

    const svcLines = splitTextLines(svcLine, descColW - 10, DOC_FS, fontBold);
    const rowPad = 8;
    const rowH = Math.max(DOC_LH, svcLines.length * DOC_LH) + rowPad;
    const yRowTop = yHeadBot;
    const yRowBot = yRowTop - rowH;
    page.drawLine({
        start: { x: ML, y: yRowBot },
        end: { x: ML + contentW, y: yRowBot },
        thickness: 0.6,
        color: CORAL,
    });
    let svcY = yRowTop - rowPad - DOC_FS;
    for (const ln of svcLines) {
        page.drawText(ln, { x: ML + 5, y: svcY, size: DOC_FS, font: fontBold, color: BODY });
        svcY -= DOC_LH;
    }
    const totW = fontBold.widthOfTextAtSize(model.totalFormatted, DOC_FS);
    page.drawText(model.totalFormatted, {
        x: ML + contentW - 6 - totW,
        y: yRowTop - rowPad - DOC_FS,
        size: DOC_FS,
        font: fontBold,
        color: BODY,
    });

    y = yRowBot - DOC_LH;

    const rightX = ML + contentW;
    const totalsW = contentW * 0.46;
    const totalsLeft = rightX - totalsW;
    const valueReserve = 78;

    const drawTotalRow = (label: string, value: string, due = false) => {
        const labelColor = due ? CORAL : BODY;
        const valueColor = due ? CORAL : BODY;
        const labelMaxW = totalsW - valueReserve;
        const valW = fontBold.widthOfTextAtSize(value, DOC_FS);
        const labelLines = splitTextLines(label, labelMaxW, DOC_FS, fontBold);
        const blockH = Math.max(labelLines.length, 1) * (DOC_LH * 0.95);
        const labelStartY = y - DOC_FS + 1;
        let labelY = labelStartY;
        for (const ln of labelLines) {
            page.drawText(ln, {
                x: totalsLeft,
                y: labelY,
                size: DOC_FS,
                font: fontBold,
                color: labelColor,
            });
            labelY -= DOC_LH * 0.95;
        }
        page.drawText(value, {
            x: rightX - valW,
            y: labelStartY,
            size: DOC_FS,
            font: fontBold,
            color: valueColor,
        });
        y -= blockH + (due ? 3 : 1);
    };

    page.drawLine({
        start: { x: totalsLeft, y: y + 4 },
        end: { x: rightX, y: y + 4 },
        thickness: 0.6,
        color: CORAL,
    });
    y -= 6;
    drawTotalRow(labels.subtotal, model.totalFormatted);
    drawTotalRow(labels.vat, vatAmount);
    drawTotalRow(labels.extraExpenses, extraExpensesAmount);
    drawTotalRow(labels.totalDueBy(dueBanner), model.totalFormatted, true);
    page.drawLine({
        start: { x: totalsLeft, y: y + 4 },
        end: { x: rightX, y: y + 4 },
        thickness: 0.6,
        color: CORAL,
    });
    y -= DOC_LH * 1.75;

    const thanks = labels.thanks;
    const thanksW = font.widthOfTextAtSize(thanks, DOC_FS);
    page.drawText(thanks, {
        x: ML + (contentW - thanksW) / 2,
        y,
        size: DOC_FS,
        font,
        color: THANKS_TEXT,
    });
    y -= DOC_LH * 1.15;

    wrapTextBlock(page, paymentDisclaimer, ML, y, contentW, DOC_FS, font, DISCLAIMER_TEXT, DOC_LH);
}

export async function buildInvoicePreviewPdfBlob(input: InvoicePreviewPackInput): Promise<Blob> {
    const { model, session, timeReportPack: timeReportOverride, legalOverrides, selectedPageNumbers } = input;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
        fetchFontBytes(dejavuSansRegularUrl),
        fetchFontBytes(dejavuSansBoldUrl),
    ]);
    const font = await doc.embedFont(regularBytes, { subset: true });
    const fontBold = await doc.embedFont(boldBytes, { subset: true });

    let logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null;
    if (typeof window !== 'undefined') {
        const raster = await rasterizeInvoiceCoverLogoSvg(500);
        if (raster?.png.length) {
            try {
                logoImage = await doc.embedPng(raster.png);
            }
            catch {
                logoImage = null;
            }
        }
    }

    const timeReport = (
        timeReportOverride
        && trimTrailingEmptyDetailSlots(timeReportOverride.detailSlots).length > 0
    )
        ? timeReportOverride
        : await resolveInvoiceTimeReportPack(session, model);
    const detailPlans = paginateDetailRowsForPdf(timeReport.detailSlots, model, timeReport, font, fontBold);
    const pageCount = 2 + detailPlans.length;
    const selected = selectedPageNumbers?.length ? new Set(selectedPageNumbers) : null;
    const includePage = (n: number) => !selected || selected.has(n);

    if (includePage(1)) {
        const p1 = doc.addPage([W, H]);
        drawCoverPage(p1, model, font, fontBold, logoImage);
    }

    let trPageTag = 2;
    for (let i = 0; i < detailPlans.length; i++) {
        const pageNum = 2 + i;
        if (!includePage(pageNum))
            continue;
        const plan = detailPlans[i]!;
        const pTr = doc.addPage([W, H]);
        drawSingleTimeReportPdfPage(pTr, model, timeReport, font, fontBold, trPageTag, plan.slice, {
            continuation: plan.continuation,
            showDetailTotals: plan.showDetailTotals,
            showSummarySection: plan.showSummarySection,
        });
        trPageTag++;
    }

    if (includePage(pageCount)) {
        const pInv = doc.addPage([W, H]);
        drawLegalInvoicePdfPage(pInv, model, session, font, fontBold, logoImage, legalOverrides);
    }

    const bytes = await doc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
}
