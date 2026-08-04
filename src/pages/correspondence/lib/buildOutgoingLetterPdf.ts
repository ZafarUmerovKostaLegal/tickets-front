import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import dejavuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import dejavuSansObliqueUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf?url';
import dejavuSansRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { letterHtmlToPlainText } from './correspondenceLetterHtml';
import {
    CORRESPONDENCE_LETTERHEAD_CONTACT,
    formatOutgoingLetterheadDate,
    formatOutgoingRefLine,
} from './correspondenceLetterhead';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const ML = 54;
const MR = 54;
const MT = 48;

async function fetchFontBytes(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`Не удалось загрузить шрифт PDF (${res.status})`);
    return res.arrayBuffer();
}

function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return [''];
    const lines: string[] = [];
    let cur = words[0]!;
    for (let i = 1; i < words.length; i += 1) {
        const next = `${cur} ${words[i]}`;
        if (font.widthOfTextAtSize(next, size) <= maxWidth)
            cur = next;
        else {
            lines.push(cur);
            cur = words[i]!;
        }
    }
    lines.push(cur);
    return lines;
}

/** Outgoing letter PDF with letterhead + free-form body text (Unicode / Cyrillic via DejaVu). */
export async function buildOutgoingLetterPdfBlob(
    model: InvoiceCoverLetterModel,
    opts?: { registryNumber?: string | null },
): Promise<Blob> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const [regularBytes, boldBytes, obliqueBytes] = await Promise.all([
        fetchFontBytes(dejavuSansRegularUrl),
        fetchFontBytes(dejavuSansBoldUrl),
        fetchFontBytes(dejavuSansObliqueUrl),
    ]);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const font = await doc.embedFont(regularBytes, { subset: true });
    const fontItalic = await doc.embedFont(obliqueBytes, { subset: true });
    const fontBold = await doc.embedFont(boldBytes, { subset: true });
    const ink = rgb(0.2, 0.2, 0.2);
    const muted = rgb(0.4, 0.4, 0.4);
    const maxW = PAGE_W - ML - MR;

    let y = PAGE_H - MT;

    page.drawText('KOSTA LEGAL', {
        x: ML,
        y,
        size: 16,
        font: fontBold,
        color: ink,
    });
    y -= 22;

    const refLine = formatOutgoingRefLine(opts?.registryNumber);
    const dateLine = `Дата: ${formatOutgoingLetterheadDate(model)}`;
    page.drawText(refLine, { x: ML, y, size: 9, font: fontItalic, color: muted });
    y -= 12;
    page.drawText(dateLine, { x: ML, y, size: 9, font: fontItalic, color: muted });

    const contact = [
        CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine1,
        CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine2,
        CORRESPONDENCE_LETTERHEAD_CONTACT.phone,
        CORRESPONDENCE_LETTERHEAD_CONTACT.email,
        CORRESPONDENCE_LETTERHEAD_CONTACT.web,
    ];
    let cy = PAGE_H - MT;
    for (const line of contact) {
        const w = font.widthOfTextAtSize(line, 8);
        page.drawText(line, {
            x: PAGE_W - MR - w,
            y: cy,
            size: 8,
            font,
            color: muted,
        });
        cy -= 11;
    }

    y -= 28;
    const body = letterHtmlToPlainText(model.introParagraphOverride ?? '');
    const paragraphs = body ? body.split(/\n/) : [];
    for (const para of paragraphs) {
        if (!para.trim()) {
            y -= 10;
            continue;
        }
        const lines = wrapText(para, font, 11, maxW);
        for (const line of lines) {
            if (y < 56) {
                // Keep simple single-page for now; truncate gracefully.
                break;
            }
            page.drawText(line, {
                x: ML,
                y,
                size: 11,
                font,
                color: ink,
            });
            y -= 15;
        }
        y -= 6;
        if (y < 56)
            break;
    }

    const bytes = await doc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
}

export function outgoingLetterPdfFileName(subject: string, dateIso: string): string {
    const safe = (subject || 'письмо')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'письмо';
    const day = (dateIso || '').slice(0, 10) || 'date';
    return `ИСХ_${safe}_${day}.pdf`;
}
