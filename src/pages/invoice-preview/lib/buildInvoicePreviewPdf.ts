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
import type { InvoiceTimeReportDetailRow, InvoiceTimeReportPack } from './invoiceTimeReportModel';
import { splitDetailRowsForPagedTimeReport } from './invoiceTimeReportChunking';
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
const CORP_TEXT = rgb(0.06, 0.02, 0.026);
const MUTED_TEXT = rgb(0.41, 0.44, 0.52);
const GRID_LINE = rgb(0.74, 0.77, 0.8);
const BODY = rgb(0.12, 0.14, 0.18);

async function fetchFontBytes(ttfModuleUrl: string): Promise<Uint8Array> {
    const res = await fetch(ttfModuleUrl);
    if (!res.ok)
        throw new Error(`Не удалось загрузить шрифт для PDF (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
}

function wrapPlainParagraph(page: PDFPage, text: string, x: number, y: number, maxWidth: number, size: number, font: PDFFont, lineGap: number): number {
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
                page.drawText(line, { x, y: cy, size, font, color: BODY });
                cy -= lineGap;
            }
            line = w;
        }
    }
    if (line) {
        page.drawText(line, { x, y: cy, size, font, color: BODY });
        cy -= lineGap;
    }
    return cy;
}

function drawCoverPage(
    page: PDFPage,
    model: InvoiceCoverLetterModel,
    font: PDFFont,
    fontBold: PDFFont,
    logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null,
): void {
    const logoTop = H - MT;
    let lowestHeaderY = logoTop;

    const logoWidthPt = 140;
    if (logoImage) {
        const logoHeightPt = (logoImage.height / logoImage.width) * logoWidthPt;
        const logoBottom = logoTop - logoHeightPt;
        page.drawImage(logoImage, {
            x: ML,
            y: logoBottom,
            width: logoWidthPt,
            height: logoHeightPt,
        });
        lowestHeaderY = Math.min(lowestHeaderY, logoBottom);
    }

    const contact = [
        KOSTA_LEGAL_FIRM.addressLine,
        KOSTA_LEGAL_FIRM.phone,
        KOSTA_LEGAL_FIRM.email,
        KOSTA_LEGAL_FIRM.web,
    ];
    let cy = logoTop;
    const fsSmall = 11;
    const muted = rgb(0.22, 0.26, 0.34);
    for (const line of contact) {
        const tw = font.widthOfTextAtSize(line, fsSmall);
        page.drawText(line, { x: W - MR - tw, y: cy, size: fsSmall, font, color: muted });
        cy -= fsSmall + 3;
    }
    lowestHeaderY = Math.min(lowestHeaderY, cy);

    let y = lowestHeaderY - 28;

    page.drawText(model.letterDateDisplay, { x: ML, y, size: 11, font, color: BODY });

    y -= 26;
    page.drawText(model.recipientCompany, { x: ML, y, size: 11, font: fontBold, color: BODY });
    y -= 14;
    page.drawText(model.recipientAddressLines[0], { x: ML, y, size: 11, font, color: BODY });
    if (model.recipientAddressLines[1]) {
        y -= 14;
        page.drawText(model.recipientAddressLines[1], { x: ML, y, size: 11, font, color: BODY });
    }

    y -= 26;
    const labels = getCoverLetterLabels(model.coverLanguage);
    page.drawText(`${labels.attention}: ${model.attentionName}`, { x: ML, y, size: 11, font: fontBold, color: BODY });
    y -= 14;
    page.drawText(model.attentionTitle, { x: ML, y, size: 11, font, color: BODY });

    y -= 26;
    page.drawText(`${labels.dear} ${model.attentionName},`, { x: ML, y, size: 11, font, color: BODY });

    y -= 22;
    const p1 = resolveCoverIntroParagraph(model);
    const bodySize = 11;
    const bodyGap = 15;
    const maxW = W - ML - MR;
    y = wrapPlainParagraph(page, p1, ML, y, maxW, bodySize, font, bodyGap);

    y -= 8;
    const p2 = resolveCoverInvoiceParagraph(model);
    y = wrapPlainParagraph(page, p2, ML, y, maxW, bodySize, font, bodyGap);
    y -= bodyGap;

    page.drawText(labels.closing, { x: ML, y, size: bodySize, font, color: BODY });
    y -= bodyGap * 2;

    const sigW = 160;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + sigW, y }, thickness: 0.5, color: rgb(0.35, 0.38, 0.45) });
    y -= 8;

    page.drawText(model.signatoryName, { x: ML, y, size: bodySize, font, color: BODY });
    y -= bodyGap;
    page.drawText(model.signatoryTitle, { x: ML, y, size: bodySize, font, color: BODY });
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
    const padOuter = 4;
    const maxW = Math.max(4, cellW - padOuter * 2);
    let fs = 8;
    const minFs = 5;
    while (fs >= minFs) {
        if (fontBold.widthOfTextAtSize(t, fs) <= maxW) {
            const tw = fontBold.widthOfTextAtSize(t, fs);
            page.drawText(t, {
                x: xCellLeft + cellW - padOuter - tw,
                y: yBaseline,
                size: fs,
                font: fontBold,
                color: TR_RED,
            });
            return;
        }
        fs -= 0.5;
    }
    const clip = clipPdfCellText(t, maxW, fontBold, minFs);
    const tw = fontBold.widthOfTextAtSize(clip, minFs);
    page.drawText(clip, {
        x: xCellLeft + cellW - padOuter - tw,
        y: yBaseline,
        size: minFs,
        font: fontBold,
        color: TR_RED,
    });
}

function paintTimeReportBody(
    page: PDFPage,
    rows: readonly (readonly string[])[],
    yHeaderBot: number,
    rowH: number,
    bodyRowCount: number,
    xs: readonly number[],
    widths: readonly number[],
    font: PDFFont,
    rightAlignedCols: ReadonlySet<number>,
): void {
    const fsBody = 11;
    for (let r = 0; r < bodyRowCount && r < rows.length; r++) {
        const cols = rows[r];
        if (!cols)
            continue;
        const yRow = yHeaderBot - (r + 0.78) * rowH;
        for (let c = 0; c < cols.length && c < xs.length; c++) {
            let raw = (cols[c] ?? '').trim();
            if (!raw)
                continue;
            const cw = Math.max(8, widths[c]! - 4);
            const clip = clipPdfCellText(raw, cw, font, fsBody);
            let xDraw = xs[c]! + 2;
            if (rightAlignedCols.has(c))
                xDraw = xs[c]! + widths[c]! - 2 - font.widthOfTextAtSize(clip, fsBody);
            page.drawText(clip, { x: xDraw, y: yRow, size: fsBody, font, color: BODY });
        }
    }
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
        footerTotals,
        showInnerTotal,
        totalLabel = 'Total',
    } = opts;
    const headerH = 24;
    const rowH = 18;
    const { xs, widths } = colLayout(tableLeft, tableW, colWeights);
    const yHeaderBot = yTopPdf - headerH;
    const innerFootLines = footerKind === 'detail'
        ? (showInnerTotal !== false ? 1 : 0)
        : 1;
    const tableBottom = yHeaderBot - rowH * (bodyRows + innerFootLines);

    page.drawRectangle({
        x: tableLeft,
        y: yHeaderBot,
        width: tableW,
        height: headerH,
        color: TR_RED,
    });

    const fsHdr = Math.min(11, headerH / 2);
    for (let i = 0; i < headers.length; i++) {
        page.drawText(headers[i]!, {
            x: xs[i]! + 2,
            y: yHeaderBot + 6,
            size: fsHdr,
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

    for (let i = 1; i <= bodyRows + innerFootLines; i++) {
        const yy = yHeaderBot - i * rowH;
        page.drawLine({
            start: { x: tableLeft, y: yy },
            end: { x: tableLeft + tableW, y: yy },
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

    if (bodyTexts?.length && rightAlignedBodyCols) {
        paintTimeReportBody(page, bodyTexts, yHeaderBot, rowH, bodyRows, xs, widths, font, rightAlignedBodyCols);
    }

    const yFoot = tableBottom + 5;
    if (innerFootLines > 0) {
        const fsTot = 8;
        page.drawText(totalLabel, { x: xs[0]! + 3, y: yFoot, size: fsTot, font: fontBold, color: TR_RED });

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

const TIME_REPORT_PDF_DETAIL_WEIGHTS = [10, 7, 10, 25, 10, 12, 16] as const;
const TIME_REPORT_PDF_SUMMARY_WEIGHTS = [9, 26, 26, 13, 13, 13] as const;

function drawTimeReportBandHeader(page: PDFPage, model: InvoiceCoverLetterModel, font: PDFFont, fontBold: PDFFont, continuation: boolean): number {
    let yTop = H - MT - 4;
    const labels = getTimeReportLabels(model.coverLanguage);
    const confLabel = labels.confidential;
    const fsConf = 9;
    const cw = font.widthOfTextAtSize(confLabel, fsConf);
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
        y: boxBottom + fsConf - 2,
        size: fsConf,
        font,
        color: rgb(1, 1, 1),
    });
    yTop -= 16;
    page.drawLine({
        start: { x: ML, y: yTop + 6 },
        end: { x: W - MR, y: yTop + 6 },
        thickness: 0.6,
        color: TR_RED,
    });
    yTop -= 12;
    const title = continuation
        ? labels.titleContinued(model.servicesMonthYear)
        : labels.title(model.servicesMonthYear);
    page.drawText(title, {
        x: ML,
        y: yTop,
        size: 12,
        font: fontBold,
        color: TR_RED,
    });
    yTop -= 22;
    return yTop;
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
        x: bx + (box / 2 - fontBold.widthOfTextAtSize(tag, 9) / 2),
        y: footerLine - box + 1,
        size: 9,
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
    const yGridTop = drawTimeReportBandHeader(page, model, font, fontBold, opts.continuation);
    const detailBody = slice.map((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount] as const);
    const tableW = W - ML - MR;
    const cur = packCurrencyCode(model);
    const labels = getTimeReportLabels(model.coverLanguage);
    const amountHdr = labels.amount(cur);
    const nRows = Math.max(slice.length, 1);

    const yAfterDetail = drawTimeReportGridTable(page, {
        tableLeft: ML,
        tableW,
        yTopPdf: yGridTop,
        colWeights: TIME_REPORT_PDF_DETAIL_WEIGHTS,
        headers: [labels.date, labels.initials, labels.task, labels.description, labels.hours, labels.rate, amountHdr],
        bodyRows: nRows,
        footerKind: 'detail',
        summaryCurrency: null,
        font,
        fontBold,
        bodyTexts: detailBody.length ? detailBody : [['', '', '', '', '', '', '']],
        rightAlignedBodyCols: new Set([4, 5, 6]),
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

    const summaryBody = pack.summarySlots.map((r) => [r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice] as const);
    const summaryRows = Math.max(summaryBody.length, 1);

    let yMid = yAfterDetail - 16;
    page.drawText(labels.summaryTitle, {
        x: ML,
        y: yMid,
        size: 11,
        font: fontBold,
        color: TR_RED,
    });
    yMid -= 18;

    drawTimeReportGridTable(page, {
        tableLeft: ML,
        tableW,
        yTopPdf: yMid,
        colWeights: TIME_REPORT_PDF_SUMMARY_WEIGHTS,
        headers: [labels.initials, labels.name, labels.titleCol, labels.hours, labels.hourlyRate, labels.totalPrice(cur)],
        bodyRows: summaryRows,
        footerKind: 'summary',
        summaryCurrency: cur,
        font,
        fontBold,
        bodyTexts: summaryBody.length ? summaryBody : [['', '', '', '', '', '']],
        rightAlignedBodyCols: new Set([3, 4, 5]),
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

    let yTop = H - MT - 4;
    const firmName = `${KOSTA_LEGAL_FIRM.brandName} LF`;
    page.drawText(firmName, {
        x: ML,
        y: yTop,
        size: 11,
        font: fontBold,
        color: TR_RED,
    });
    yTop -= 14;
    const leftBlurb: string[] = [firmAddress, ...resolveLegalFirmBankingLines(cur, legalOverrides, model.coverLanguage)];
    for (const ln of leftBlurb) {
        page.drawText(ln, { x: ML, y: yTop, size: 11, font, color: CORP_TEXT });
        yTop -= 13;
    }

    if (logoImage) {
        const lw = 120;
        const lh = (logoImage.height / logoImage.width) * lw;
        const logoTop = H - MT - 4;
        page.drawImage(logoImage, {
            x: W - MR - lw,
            y: logoTop - lh,
            width: lw,
            height: lh,
        });
    }

    const ribbonH = 22;
    const yRibbonTop = H - MT - 130;
    const yRibbonBot = yRibbonTop - ribbonH;
    page.drawRectangle({
        x: ML,
        y: yRibbonBot,
        width: W - ML - MR,
        height: ribbonH,
        color: TR_RED,
    });

    page.drawText(labels.invoiceNo(invNo), {
        x: ML + 8,
        y: yRibbonBot + 6,
        size: 11,
        font: fontBold,
        color: rgb(1, 1, 1),
    });
    const rtxt = ribbonIssue;
    const rw = fontBold.widthOfTextAtSize(rtxt, 11);
    page.drawText(rtxt, {
        x: W - MR - 8 - rw,
        y: yRibbonBot + 6,
        size: 11,
        font: fontBold,
        color: rgb(1, 1, 1),
    });

    let yPanels = yRibbonBot - 18;
    const splitX = ML + (W - ML - MR) * 0.52;

    page.drawText(labels.billTo, { x: ML, y: yPanels, size: 11, font: fontBold, color: TR_RED });
    let yBill = yPanels - 15;
    page.drawText(model.recipientCompany, { x: ML, y: yBill, size: 11, font: fontBold, color: BODY });
    yBill -= 14;
    page.drawText(`${labels.address}:`, { x: ML, y: yBill, size: 11, font, color: MUTED_TEXT });
    yBill -= 13;
    page.drawText(model.recipientAddressLines[0], { x: ML, y: yBill, size: 11, font, color: BODY });
    yBill -= 13;
    if (model.recipientAddressLines[1]) {
        page.drawText(model.recipientAddressLines[1], { x: ML, y: yBill, size: 11, font, color: BODY });
        yBill -= 13;
    }
    page.drawText(`${labels.bankName}:`, { x: ML, y: yBill, size: 11, font, color: MUTED_TEXT });
    yBill -= 13;
    page.drawText(resolveLegalBillToBankName(legalOverrides), { x: ML, y: yBill, size: 11, font, color: MUTED_TEXT });
    yBill -= 13;
    page.drawText(`${labels.swift}:`, { x: ML, y: yBill, size: 11, font, color: MUTED_TEXT });
    yBill -= 13;
    page.drawText(resolveLegalBillToSwift(legalOverrides), { x: ML, y: yBill, size: 11, font, color: MUTED_TEXT });

    page.drawText(labels.caseDetails, { x: splitX, y: yPanels, size: 11, font: fontBold, color: TR_RED });
    const yCaseFloor = wrapPlainParagraph(page, caseLine, splitX, yPanels - 15, W - MR - splitX - 6, 11, font, 14);

    let yTable = Math.min(yBill - 16, yCaseFloor - 10);
    const tw = W - ML - MR;
    const headH = 18;
    const yHBot = yTable - headH;
    page.drawRectangle({
        x: ML,
        y: yHBot,
        width: tw,
        height: headH,
        color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(labels.description, {
        x: ML + 6,
        y: yHBot + 5,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
    });
    const th2 = labels.total(cur);
    const th2W = fontBold.widthOfTextAtSize(th2, 9);
    page.drawText(th2, {
        x: ML + tw - 6 - th2W,
        y: yHBot + 5,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
    });

    const rowH = 22;
    const yRowBot = yHBot - rowH;
    page.drawLine({
        start: { x: ML, y: yRowBot },
        end: { x: ML + tw, y: yRowBot },
        thickness: 0.6,
        color: rgb(232 / 255, 146 / 255, 140 / 255),
    });
    page.drawText(svcLine, { x: ML + 5, y: yRowBot + 6, size: 9, font: fontBold, color: BODY });
    const totW = fontBold.widthOfTextAtSize(model.totalFormatted, 9);
    page.drawText(model.totalFormatted, {
        x: ML + tw - 6 - totW,
        y: yRowBot + 6,
        size: 9,
        font: fontBold,
        color: BODY,
    });

    let yTot = yRowBot - 14;
    const rightX = W - MR - 8;
    const totalsW = 220;
    const totalsLeft = rightX - totalsW;
    const coral = rgb(232 / 255, 146 / 255, 140 / 255);
    page.drawLine({
        start: { x: totalsLeft, y: yTot + 10 },
        end: { x: rightX, y: yTot + 10 },
        thickness: 0.6,
        color: coral,
    });
    yTot -= 2;
    const drawTotalRow = (label: string, value: string, due = false) => {
        const labelColor = due ? coral : BODY;
        const valueColor = due ? coral : BODY;
        page.drawText(label, {
            x: totalsLeft,
            y: yTot,
            size: 9,
            font: fontBold,
            color: labelColor,
            maxWidth: totalsW - 88,
        });
        const vw = fontBold.widthOfTextAtSize(value, 9);
        page.drawText(value, {
            x: rightX - vw,
            y: yTot,
            size: 9,
            font: fontBold,
            color: valueColor,
        });
        yTot -= due ? 18 : 13;
    };
    drawTotalRow(labels.subtotal, model.totalFormatted);
    drawTotalRow(labels.vat, vatAmount);
    drawTotalRow(labels.extraExpenses, extraExpensesAmount);
    drawTotalRow(labels.totalDueBy(dueBanner), model.totalFormatted, true);
    page.drawLine({
        start: { x: totalsLeft, y: yTot + 8 },
        end: { x: rightX, y: yTot + 8 },
        thickness: 0.6,
        color: coral,
    });
    yTot -= 6;

    page.drawText(labels.thanks, {
        x: ML,
        y: yTot,
        size: 10,
        font,
        color: BODY,
    });
    yTot -= 24;

    yTot = wrapPlainParagraph(page, paymentDisclaimer, ML, yTot, W - ML - MR, 7, font, 9);
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

    const timeReport = timeReportOverride ?? await resolveInvoiceTimeReportPack(session, model);
    const detailChunks = splitDetailRowsForPagedTimeReport(timeReport.detailSlots);
    const pageCount = 2 + detailChunks.length;
    const selected = selectedPageNumbers?.length ? new Set(selectedPageNumbers) : null;
    const includePage = (n: number) => !selected || selected.has(n);

    if (includePage(1)) {
        const p1 = doc.addPage([W, H]);
        drawCoverPage(p1, model, font, fontBold, logoImage);
    }

    let trPageTag = 2;
    for (let i = 0; i < detailChunks.length; i++) {
        const pageNum = 2 + i;
        if (!includePage(pageNum))
            continue;
        const lastChunk = i === detailChunks.length - 1;
        const pTr = doc.addPage([W, H]);
        drawSingleTimeReportPdfPage(pTr, model, timeReport, font, fontBold, trPageTag, detailChunks[i]!, {
            continuation: i > 0,
            showDetailTotals: lastChunk,
            showSummarySection: lastChunk,
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
