import fontkit from '@pdf-lib/fontkit';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import dejavuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import dejavuSansRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import {
    INVOICE_PAYMENT_DISCLAIMER,
    TIME_REPORT_DETAIL_ROWS,
    TIME_REPORT_SUMMARY_ROWS,
    type InvoicePreviewPackInput,
    packCaseDetailLine,
    packCurrencyCode,
    packFirmBankingLines,
    packInvoiceNumberDisplay,
    packResolveDueIso,
    packResolveIssueIso,
    packUppercaseRibbonDate,
    packZeroCommaAmount,
} from './invoicePreviewPackShared';
import type { InvoiceTimeReportPack } from './invoiceTimeReportModel';
import { resolveInvoiceTimeReportPack } from './resolveInvoiceTimeReportPack';
import { KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { rasterizeInvoiceCoverLogoSvg } from './invoiceCoverLogoRaster';

const W = 595.28;
const H = 841.89;

function mmToPt(mm: number): number {
    return (mm * 72) / 25.4;
}

/** Поля A4: левый 30 мм, правый 12 мм (в диапазоне 10–15), верх/низ 20 мм */
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

function drawRichLine(page: PDFPage, x: number, y: number, parts: readonly { text: string; bold?: boolean }[], size: number, font: PDFFont, fontBold: PDFFont): number {
    let cx = x;
    for (const p of parts) {
        const f = p.bold ? fontBold : font;
        page.drawText(p.text, {
            x: cx,
            y,
            size,
            font: f,
            color: BODY,
        });
        cx += f.widthOfTextAtSize(p.text, size);
    }
    return cx;
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
    const fsSmall = 9;
    const muted = rgb(0.22, 0.26, 0.34);
    for (const line of contact) {
        const tw = font.widthOfTextAtSize(line, fsSmall);
        page.drawText(line, { x: W - MR - tw, y: cy, size: fsSmall, font, color: muted });
        cy -= fsSmall + 3;
    }
    lowestHeaderY = Math.min(lowestHeaderY, cy);

    let y = lowestHeaderY - 28;

    page.drawText(model.letterDateDisplay, { x: ML, y, size: 10, font, color: BODY });

    y -= 26;
    page.drawText(model.recipientCompany, { x: ML, y, size: 10, font, color: BODY });
    y -= 14;
    page.drawText(model.recipientAddressLines[0], { x: ML, y, size: 10, font, color: BODY });
    if (model.recipientAddressLines[1]) {
        y -= 14;
        page.drawText(model.recipientAddressLines[1], { x: ML, y, size: 10, font, color: BODY });
    }

    y -= 26;
    page.drawText(`Attention: ${model.attentionName}`, { x: ML, y, size: 10, font, color: BODY });
    y -= 14;
    page.drawText(model.attentionTitle, { x: ML, y, size: 10, font, color: BODY });

    y -= 26;
    page.drawText(`Dear ${model.attentionName},`, { x: ML, y, size: 10, font, color: BODY });

    y -= 22;
    const p1 = `It is our pleasure to provide legal assistance to «${model.quotedCompanyName}» in connection with its activities in Uzbekistan.`;
    const bodySize = 10;
    const bodyGap = 14;
    const maxW = W - ML - MR;
    y = wrapPlainParagraph(page, p1, ML, y, maxW, bodySize, font, bodyGap);

    y -= 8;
    const line1Parts = [
        { text: 'Herewith, we are sending the report ' },
        { text: 'or/and ', bold: true },
        { text: 'with the invoice on legal services rendered in ', bold: false },
    ] as const;
    drawRichLine(page, ML, y, line1Parts, bodySize, font, fontBold);
    y -= bodyGap;

    const line2Parts = [
        { text: `${model.servicesMonthYear}`, bold: true },
        { text: ' for the total amount of ', bold: false },
        { text: model.totalFormatted, bold: true },
        { text: '.', bold: false },
    ] as const;
    drawRichLine(page, ML, y, line2Parts, bodySize, font, fontBold);
    y -= bodyGap * 2;

    page.drawText('Kind regards,', { x: ML, y, size: bodySize, font, color: BODY });
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
    const fsBody = 6.7;
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

/** Таблица time report: красный thead, сетка, строка Total (как в превью). */
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
        /** Тексты ячеек body: по строкам × колонкам */
        bodyTexts?: readonly (readonly string[])[] | null;
        rightAlignedBodyCols?: ReadonlySet<number>;
        footerTotals?: {
            detail?: { hours: string; amount: string };
            summary?: { hours: string; hourly: string; amount: string };
        } | null;
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
    } = opts;
    const headerH = 20;
    const rowH = 14;
    const { xs, widths } = colLayout(tableLeft, tableW, colWeights);
    const yHeaderBot = yTopPdf - headerH;
    const tableBottom = yHeaderBot - rowH * (bodyRows + 1);

    page.drawRectangle({
        x: tableLeft,
        y: yHeaderBot,
        width: tableW,
        height: headerH,
        color: TR_RED,
    });

    const fsHdr = Math.min(8, headerH / 3);
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

    for (let i = 1; i <= bodyRows + 1; i++) {
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
    const fsFoot = 8;
    page.drawText('Total', { x: xs[0]! + 3, y: yFoot, size: fsFoot, font: fontBold, color: TR_RED });

    if (footerKind === 'detail' && footerTotals?.detail) {
        const { hours, amount } = footerTotals.detail;
        const hi = 4;
        const ai = 5;
        if (hours?.trim()) {
            const cw = widths[hi] ?? 45;
            const clip = clipPdfCellText(hours.trim(), cw - 6, fontBold, fsFoot);
            page.drawText(clip, {
                x: xs[hi]! + cw - fontBold.widthOfTextAtSize(clip, fsFoot) - 4,
                y: yFoot,
                size: fsFoot,
                font: fontBold,
                color: TR_RED,
            });
        }
        if (amount?.trim()) {
            const cw = widths[ai] ?? 50;
            const clip = clipPdfCellText(amount.trim(), cw - 6, fontBold, fsFoot);
            page.drawText(clip, {
                x: xs[ai]! + cw - fontBold.widthOfTextAtSize(clip, fsFoot) - 4,
                y: yFoot,
                size: fsFoot,
                font: fontBold,
                color: TR_RED,
            });
        }
    }

    if (footerKind === 'summary' && footerTotals?.summary) {
        const { hours, hourly, amount } = footerTotals.summary;
        const hci = 3;
        const rci = 4;
        const aci = 5;

        const putRight = (text: string, colIndex: number) => {
            if (!text?.trim())
                return;
            const cw = widths[colIndex] ?? 40;
            const clip = clipPdfCellText(text.trim(), cw - 6, fontBold, fsFoot);
            page.drawText(clip, {
                x: xs[colIndex]! + cw - fontBold.widthOfTextAtSize(clip, fsFoot) - 4,
                y: yFoot,
                size: fsFoot,
                font: fontBold,
                color: TR_RED,
            });
        };

        putRight(hours ?? '', hci);
        putRight(hourly ?? '', rci);

        let amtDraw = amount?.trim();
        if (!amtDraw && summaryCurrency)
            amtDraw = summaryCurrency;

        putRight(amtDraw ?? '', aci);
    }

    if (footerKind === 'summary' && !footerTotals?.summary?.amount?.trim() && summaryCurrency) {
        const lastI = xs.length - 1;
        const lastW = widths[lastI]!;
        const tw = fontBold.widthOfTextAtSize(summaryCurrency, fsFoot);
        page.drawText(summaryCurrency, {
            x: xs[lastI]! + lastW - 4 - tw,
            y: yFoot,
            size: fsFoot,
            font: fontBold,
            color: TR_RED,
        });
    }

    return tableBottom;
}

/** Страница time report из данных счёта. */
function drawTimeReportPdfPage(
    page: PDFPage,
    model: InvoiceCoverLetterModel,
    pack: InvoiceTimeReportPack,
    font: PDFFont,
    fontBold: PDFFont,
    pageTag: number,
): void {
    const detailBody = pack.detailSlots.map((r) => [r.date, r.initials, r.task, r.description, r.hours, r.amount] as const);
    const summaryBody = pack.summarySlots.map((r) => [r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice] as const);
    let yTop = H - MT - 4;
    const confLabel = 'Private and confidential';
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
    const title = `TIME REPORT FOR SERVICES PROVIDED IN ${model.servicesMonthYear.toUpperCase()}`;
    page.drawText(title, {
        x: ML,
        y: yTop,
        size: 12,
        font: fontBold,
        color: TR_RED,
    });
    yTop -= 22;

    const tableW = W - ML - MR;
    const cur = packCurrencyCode(model);
    const amountHdr = cur === 'EUR' ? 'Amount (EUR)' : `Amount (${cur})`;
    const yAfterDetail = drawTimeReportGridTable(page, {
        tableLeft: ML,
        tableW,
        yTopPdf: yTop,
        colWeights: [11, 9, 14, 36, 10, 12],
        headers: ['Date', 'Initials', 'Task', 'Description', 'Hours', amountHdr],
        bodyRows: TIME_REPORT_DETAIL_ROWS,
        footerKind: 'detail',
        summaryCurrency: null,
        font,
        fontBold,
        bodyTexts: detailBody,
        rightAlignedBodyCols: new Set([4, 5]),
        footerTotals: {
            detail: {
                hours: pack.detailTotalHoursDisplay,
                amount: pack.detailTotalAmountDisplay,
            },
        },
    });

    let yMid = yAfterDetail - 16;
    page.drawText('Summary of services', {
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
        colWeights: [9, 26, 26, 13, 13, 13],
        headers: ['Initials', 'Name', 'Title', 'Hours', 'Hourly rate', `Total price (${cur})`],
        bodyRows: TIME_REPORT_SUMMARY_ROWS,
        footerKind: 'summary',
        summaryCurrency: cur,
        font,
        fontBold,
        bodyTexts: summaryBody,
        rightAlignedBodyCols: new Set([3, 4, 5]),
        footerTotals: {
            summary: {
                hours: pack.summaryGrandHoursDisplay,
                hourly: '—',
                amount: pack.summaryGrandAmountDisplay || cur,
            },
        },
    });

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

function drawLegalInvoicePdfPage(
    page: PDFPage,
    model: InvoiceCoverLetterModel,
    session: InvoicePreviewSessionV1 | null,
    font: PDFFont,
    fontBold: PDFFont,
    logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null,
): void {
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const ribbonIssue = packUppercaseRibbonDate(issueIso);
    const dueBanner = packUppercaseRibbonDate(dueIso);
    const invNo = packInvoiceNumberDisplay(session);
    const caseLine = packCaseDetailLine(session);
    const cur = packCurrencyCode(model);
    const zeroLine = packZeroCommaAmount(model);
    const svcLine = `Legal services rendered in ${model.servicesMonthYear}`;

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
    const leftBlurb: string[] = [KOSTA_LEGAL_FIRM.addressLine, ...packFirmBankingLines(cur)];
    for (const ln of leftBlurb) {
        page.drawText(ln, { x: ML, y: yTop, size: 8, font, color: CORP_TEXT });
        yTop -= 10;
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

    page.drawText(`INVOICE No. ${invNo}`, {
        x: ML + 8,
        y: yRibbonBot + 6,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
    });
    const rtxt = ribbonIssue;
    const rw = fontBold.widthOfTextAtSize(rtxt, 10);
    page.drawText(rtxt, {
        x: W - MR - 8 - rw,
        y: yRibbonBot + 6,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
    });

    let yPanels = yRibbonBot - 18;
    const splitX = ML + (W - ML - MR) * 0.52;

    /** Bill to */
    page.drawText('Bill to', { x: ML, y: yPanels, size: 9, font: fontBold, color: TR_RED });
    let yBill = yPanels - 13;
    page.drawText(model.recipientCompany, { x: ML, y: yBill, size: 9, font: fontBold, color: BODY });
    yBill -= 12;
    page.drawText('Address:', { x: ML, y: yBill, size: 8, font, color: MUTED_TEXT });
    yBill -= 10;
    page.drawText(model.recipientAddressLines[0], { x: ML, y: yBill, size: 8, font, color: BODY });
    yBill -= 10;
    if (model.recipientAddressLines[1]) {
        page.drawText(model.recipientAddressLines[1], { x: ML, y: yBill, size: 8, font, color: BODY });
        yBill -= 10;
    }
    page.drawText('Bank name:', { x: ML, y: yBill, size: 8, font, color: MUTED_TEXT });
    yBill -= 10;
    page.drawText('—', { x: ML, y: yBill, size: 8, font, color: MUTED_TEXT });
    yBill -= 10;
    page.drawText('SWIFT:', { x: ML, y: yBill, size: 8, font, color: MUTED_TEXT });
    yBill -= 10;
    page.drawText('—', { x: ML, y: yBill, size: 8, font, color: MUTED_TEXT });

    /** Case details */
    page.drawText('Case details', { x: splitX, y: yPanels, size: 9, font: fontBold, color: TR_RED });
    const yCaseFloor = wrapPlainParagraph(page, caseLine, splitX, yPanels - 13, W - MR - splitX - 6, 8, font, 11);

    let yTable = Math.min(yBill - 16, yCaseFloor - 10);
    const tw = W - ML - MR;
    const descW = tw * 0.72;
    const headH = 18;
    const yHBot = yTable - headH;
    page.drawRectangle({
        x: ML,
        y: yHBot,
        width: tw,
        height: headH,
        color: TR_RED,
    });
    page.drawText('Description', {
        x: ML + 6,
        y: yHBot + 5,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
    });
    const th2 = `Total (${cur})`;
    page.drawText(th2, {
        x: ML + descW + 4,
        y: yHBot + 5,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
    });

    const rowH = 22;
    const yRowBot = yHBot - rowH;
    page.drawRectangle({
        x: ML,
        y: yRowBot,
        width: tw,
        height: rowH,
        borderColor: GRID_LINE,
        borderWidth: 0.4,
    });
    page.drawLine({ start: { x: ML + descW, y: yHBot }, end: { x: ML + descW, y: yRowBot }, thickness: 0.35, color: GRID_LINE });
    page.drawText(svcLine, { x: ML + 5, y: yRowBot + 6, size: 9, font, color: BODY });
    const totW = fontBold.widthOfTextAtSize(model.totalFormatted, 10);
    page.drawText(model.totalFormatted, {
        x: ML + tw - 6 - totW,
        y: yRowBot + 6,
        size: 10,
        font: fontBold,
        color: TR_RED,
    });

    let yTot = yRowBot - 20;
    const rightX = W - MR - 8;
    const drawTotalLine = (label: string, value: string, boldVal: boolean) => {
        const lab = `${label} `;
        const lw = fontBold.widthOfTextAtSize(lab, 9);
        const vw = (boldVal ? fontBold : font).widthOfTextAtSize(value, 9);
        const startX = rightX - lw - vw;
        page.drawText(lab, { x: startX, y: yTot, size: 9, font: fontBold, color: TR_RED });
        page.drawText(value, { x: startX + lw, y: yTot, size: 9, font: boldVal ? fontBold : font, color: TR_RED });
        yTot -= 12;
    };
    drawTotalLine('SUBTOTAL:', model.totalFormatted, true);
    drawTotalLine('VAT:', zeroLine, false);
    drawTotalLine('Extra expenses:', zeroLine, false);
    const dueLab = `TOTAL DUE BY ${dueBanner}: `;
    const dueW = fontBold.widthOfTextAtSize(model.totalFormatted, 11);
    const dl = fontBold.widthOfTextAtSize(dueLab, 9);
    page.drawText(dueLab, { x: rightX - dl - dueW, y: yTot, size: 9, font: fontBold, color: TR_RED });
    page.drawText(model.totalFormatted, { x: rightX - dueW, y: yTot, size: 11, font: fontBold, color: TR_RED });
    yTot -= 22;

    page.drawText('Thank you for your business!', {
        x: ML,
        y: yTot,
        size: 10,
        font: fontBold,
        color: TR_RED,
    });
    yTot -= 24;

    yTot = wrapPlainParagraph(page, INVOICE_PAYMENT_DISCLAIMER, ML, yTot, W - ML - MR, 7, font, 9);
}

/** Три страницы A4: сопроводительное письмо; time report; invoice. */
export async function buildInvoicePreviewPdfBlob({ model, session }: InvoicePreviewPackInput): Promise<Blob> {
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

    const p1 = doc.addPage([W, H]);
    drawCoverPage(p1, model, font, fontBold, logoImage);

    const timeReport = await resolveInvoiceTimeReportPack(session, model);

    const p2 = doc.addPage([W, H]);
    drawTimeReportPdfPage(p2, model, timeReport, font, fontBold, 2);

    const p3 = doc.addPage([W, H]);
    drawLegalInvoicePdfPage(p3, model, session, font, fontBold, logoImage);

    const bytes = await doc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
}
