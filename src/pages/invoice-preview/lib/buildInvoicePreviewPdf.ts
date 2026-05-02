import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';

const W = 595.28;
const H = 841.89;
const M = 54;

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

function drawCoverPage(page: PDFPage, model: InvoiceCoverLetterModel, font: PDFFont, fontBold: PDFFont): void {
    let y = H - M;

    page.drawText(KOSTA_LEGAL_FIRM.brandName, {
        x: M,
        y,
        size: 13,
        font: fontBold,
        color: rgb(0.06, 0.08, 0.12),
    });

    const contact = [
        KOSTA_LEGAL_FIRM.addressLine,
        KOSTA_LEGAL_FIRM.phone,
        KOSTA_LEGAL_FIRM.email,
        KOSTA_LEGAL_FIRM.web,
    ];
    let cy = y;
    const fsSmall = 9;
    const muted = rgb(0.22, 0.26, 0.34);
    for (const line of contact) {
        const tw = font.widthOfTextAtSize(line, fsSmall);
        page.drawText(line, { x: W - M - tw, y: cy, size: fsSmall, font, color: muted });
        cy -= fsSmall + 3;
    }

    y -= 78;

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
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const p1 = doc.addPage([W, H]);
    drawCoverPage(p1, model, font, fontBold);

    doc.addPage([W, H]);
    doc.addPage([W, H]);

    const bytes = await doc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
}
