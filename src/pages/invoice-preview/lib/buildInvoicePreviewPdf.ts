import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import dejavuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import dejavuSansRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import { KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';

const W = 595.28;
const H = 841.89;
const M = 54;

const INVOICE_PREVIEW_LOGO_SVG = 'KostaLegal-logo-02-black.svg';

/** Абсолютный URL к файлу из `public/` (нужен для fetch → canvas → PNG при сборке PDF). */
function resolveInvoiceLogoSvgUrl(): string {
    if (typeof window === 'undefined')
        return `/${INVOICE_PREVIEW_LOGO_SVG}`;
    const baseUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
    return new URL(INVOICE_PREVIEW_LOGO_SVG, baseUrl).href;
}

/** SVG из `public/` → PNG (pdf-lib не умеет SVG напрямую). */
async function rasterizeInvoiceLogoSvgToPng(svgAbsoluteUrl: string, renderWidthPx = 560): Promise<Uint8Array | null> {
    try {
        const res = await fetch(svgAbsoluteUrl);
        if (!res.ok)
            return null;
        const svgText = await res.text();
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const objUrl = URL.createObjectURL(blob);
        try {
            const img = new Image();
            img.decoding = 'async';
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('logo img'));
                img.src = objUrl;
            });
            const iw = Math.max(1, img.naturalWidth || img.width);
            const ih = Math.max(1, img.naturalHeight || img.height);
            const w = renderWidthPx;
            const h = Math.max(1, Math.round((ih / iw) * w));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return null;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
            if (!pngBlob)
                return null;
            return new Uint8Array(await pngBlob.arrayBuffer());
        }
        finally {
            URL.revokeObjectURL(objUrl);
        }
    }
    catch {
        return null;
    }
}

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
            color: rgb(0.12, 0.14, 0.18),
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
                page.drawText(line, { x, y: cy, size, font, color: rgb(0.12, 0.14, 0.18) });
                cy -= lineGap;
            }
            line = w;
        }
    }
    if (line) {
        page.drawText(line, { x, y: cy, size, font, color: rgb(0.12, 0.14, 0.18) });
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
    const logoTop = H - M;
    let lowestHeaderY = logoTop;

    const logoWidthPt = 165;
    if (logoImage) {
        const logoHeightPt = (logoImage.height / logoImage.width) * logoWidthPt;
        const logoBottom = logoTop - logoHeightPt;
        page.drawImage(logoImage, {
            x: M,
            y: logoBottom,
            width: logoWidthPt,
            height: logoHeightPt,
        });
        lowestHeaderY = Math.min(lowestHeaderY, logoBottom);
    }
    else {
        page.drawText(KOSTA_LEGAL_FIRM.brandName, {
            x: M,
            y: logoTop,
            size: 13,
            font: fontBold,
            color: rgb(0.06, 0.08, 0.12),
        });
        lowestHeaderY = Math.min(lowestHeaderY, logoTop - 14);
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
        page.drawText(line, { x: W - M - tw, y: cy, size: fsSmall, font, color: muted });
        cy -= fsSmall + 3;
    }
    lowestHeaderY = Math.min(lowestHeaderY, cy);

    let y = lowestHeaderY - 28;

    page.drawText(model.letterDateDisplay, { x: M, y, size: 10, font, color: rgb(0.12, 0.14, 0.18) });

    y -= 26;
    page.drawText(model.recipientCompany, { x: M, y, size: 10, font, color: rgb(0.12, 0.14, 0.18) });
    y -= 14;
    page.drawText(model.recipientAddressLines[0], { x: M, y, size: 10, font, color: rgb(0.12, 0.14, 0.18) });
    if (model.recipientAddressLines[1]) {
        y -= 14;
        page.drawText(model.recipientAddressLines[1], { x: M, y, size: 10, font, color: rgb(0.12, 0.14, 0.18) });
    }

    y -= 26;
    page.drawText(`Attention: ${model.attentionName}`, { x: M, y, size: 10, font, color: rgb(0.12, 0.14, 0.18) });
    y -= 14;
    page.drawText(model.attentionTitle, { x: M, y, size: 10, font, color: rgb(0.12, 0.14, 0.18) });

    y -= 26;
    page.drawText(`Dear ${model.attentionName},`, { x: M, y, size: 10, font, color: rgb(0.12, 0.14, 0.18) });

    y -= 22;
    const p1 = `It is our pleasure to provide legal assistance to «${model.quotedCompanyName}» in connection with its activities in Uzbekistan.`;
    const bodySize = 10;
    const bodyGap = 14;
    const maxW = W - 2 * M;
    y = wrapPlainParagraph(page, p1, M, y, maxW, bodySize, font, bodyGap);

    y -= 8;
    const line1Parts = [
        { text: 'Herewith, we are sending the report ' },
        { text: 'or/and ', bold: true },
        { text: 'with the invoice on legal services rendered in ', bold: false },
    ] as const;
    drawRichLine(page, M, y, line1Parts, bodySize, font, fontBold);
    y -= bodyGap;

    const line2Parts = [
        { text: `${model.servicesMonthYear}`, bold: true },
        { text: ' for the total amount of ', bold: false },
        { text: model.totalFormatted, bold: true },
        { text: '.', bold: false },
    ] as const;
    drawRichLine(page, M, y, line2Parts, bodySize, font, fontBold);
    y -= bodyGap * 2;

    page.drawText('Kind regards,', { x: M, y, size: bodySize, font, color: rgb(0.12, 0.14, 0.18) });
    y -= bodyGap * 2;

    const sigW = 160;
    page.drawLine({ start: { x: M, y }, end: { x: M + sigW, y }, thickness: 0.5, color: rgb(0.35, 0.38, 0.45) });
    y -= 8;

    page.drawText(model.signatoryName, { x: M, y, size: bodySize, font, color: rgb(0.12, 0.14, 0.18) });
    y -= bodyGap;
    page.drawText(model.signatoryTitle, { x: M, y, size: bodySize, font, color: rgb(0.12, 0.14, 0.18) });
}

/** Три страницы A4: первая — сопроводительное письмо, 2–3 пустые. */
export async function buildInvoicePreviewPdfBlob(model: InvoiceCoverLetterModel): Promise<Blob> {
    const doc = await PDFDocument.create();
    const [regularBytes, boldBytes] = await Promise.all([
        fetchFontBytes(dejavuSansRegularUrl),
        fetchFontBytes(dejavuSansBoldUrl),
    ]);
    const font = await doc.embedFont(regularBytes, { subset: true });
    const fontBold = await doc.embedFont(boldBytes, { subset: true });

    let logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null;
    if (typeof window !== 'undefined') {
        const pngBytes = await rasterizeInvoiceLogoSvgToPng(resolveInvoiceLogoSvgUrl(), 560);
        if (pngBytes?.length) {
            try {
                logoImage = await doc.embedPng(pngBytes);
            }
            catch {
                logoImage = null;
            }
        }
    }

    const p1 = doc.addPage([W, H]);
    drawCoverPage(p1, model, font, fontBold, logoImage);

    doc.addPage([W, H]);
    doc.addPage([W, H]);

    const bytes = await doc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
}
