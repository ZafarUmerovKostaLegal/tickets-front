import fontkit from '@pdf-lib/fontkit';
import {
    AlignmentType,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    TextRun,
} from 'docx';
import { PDFDocument, rgb } from 'pdf-lib';
import dejavuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import dejavuSansRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import type { InventoryItemExportInput } from './exportInventoryItemCard';
import { buildInventoryItemExportFields, loadProcessedPhoto } from './exportInventoryItemCard';

async function fetchFontBytes(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`Не удалось загрузить шрифт PDF (${res.status})`);
    return res.arrayBuffer();
}

function wrapPdfText(
    text: string,
    font: { widthOfTextAtSize: (t: string, s: number) => number },
    size: number,
    maxWidth: number,
): string[] {
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

export async function buildInventoryItemPdfBlob(input: InventoryItemExportInput): Promise<Blob> {
    const card = buildInventoryItemExportFields(input);
    const photo = await loadProcessedPhoto(input.item.photo_path);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
        fetchFontBytes(dejavuSansRegularUrl),
        fetchFontBytes(dejavuSansBoldUrl),
    ]);
    const font = await doc.embedFont(regularBytes, { subset: true });
    const fontBold = await doc.embedFont(boldBytes, { subset: true });

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const ML = 48;
    const MR = 48;
    const MT = 48;
    const MB = 48;
    const contentW = PAGE_W - ML - MR;
    const ink = rgb(0.12, 0.14, 0.18);
    const muted = rgb(0.4, 0.45, 0.52);

    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MT;

    const ensureSpace = (need: number) => {
        if (y - need >= MB)
            return;
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MT;
    };

    const drawLine = (text: string, size: number, bold = false, color = ink) => {
        const f = bold ? fontBold : font;
        const lines = wrapPdfText(text, f, size, contentW);
        for (const line of lines) {
            ensureSpace(size + 4);
            page.drawText(line, { x: ML, y: y - size, size, font: f, color });
            y -= size + 4;
        }
    };

    drawLine('Kosta Legal — карточка техники', 11, false, muted);
    y -= 6;
    drawLine(card.title, 18, true);
    y -= 10;

    if (photo) {
        try {
            const img = await doc.embedJpg(photo.bytes);
            const maxW = contentW;
            const maxH = 220;
            const scale = Math.min(maxW / photo.width, maxH / photo.height, 1);
            const iw = Math.max(1, photo.width * scale);
            const ih = Math.max(1, photo.height * scale);
            ensureSpace(ih + 16);
            page.drawImage(img, { x: ML, y: y - ih, width: iw, height: ih });
            y -= ih + 14;
        }
        catch {
        }
    }

    for (const f of card.fields) {
        ensureSpace(28);
        page.drawText(f.label.toUpperCase(), {
            x: ML,
            y: y - 9,
            size: 8,
            font: fontBold,
            color: muted,
        });
        y -= 12;
        drawLine(f.value, 11, false);
        y -= 6;
    }

    if (card.monitorChips.length > 0) {
        y -= 4;
        drawLine('Характеристики монитора', 12, true);
        y -= 4;
        drawLine(card.monitorChips.join(' · '), 11);
        if (card.monitorVesaNo)
            drawLine('Без крепления VESA', 10, false, muted);
        y -= 4;
    }

    if (card.notes) {
        y -= 4;
        drawLine('Описание / Заметки', 12, true);
        y -= 2;
        drawLine(card.notes, 11);
    }

    y -= 10;
    drawLine(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, 9, false, muted);

    const bytes = await doc.save();
    return new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
}

export async function buildInventoryItemDocxBlob(input: InventoryItemExportInput): Promise<Blob> {
    const card = buildInventoryItemExportFields(input);
    const photo = await loadProcessedPhoto(input.item.photo_path);
    const children: Paragraph[] = [
        new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({
                text: 'Kosta Legal — карточка техники',
                font: 'Calibri',
                size: 20,
                color: '64748B',
            })],
        }),
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
            children: [new TextRun({ text: card.title, font: 'Calibri', bold: true, size: 32 })],
        }),
    ];

    if (photo) {
        const maxW = 480;
        const scale = Math.min(1, maxW / Math.max(photo.width, 1));
        const w = Math.max(1, Math.round(photo.width * scale));
        const h = Math.max(1, Math.round(photo.height * scale));
        children.push(new Paragraph({
            spacing: { after: 200 },
            children: [new ImageRun({
                type: 'jpg',
                data: photo.bytes,
                transformation: { width: w, height: h },
            })],
        }));
    }

    for (const f of card.fields) {
        children.push(new Paragraph({
            spacing: { before: 80, after: 0 },
            children: [new TextRun({
                text: f.label.toUpperCase(),
                font: 'Calibri',
                size: 16,
                bold: true,
                color: '64748B',
            })],
        }));
        children.push(new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: f.value, font: 'Calibri', size: 22 })],
        }));
    }

    if (card.monitorChips.length > 0) {
        children.push(new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [new TextRun({
                text: 'Характеристики монитора',
                font: 'Calibri',
                size: 24,
                bold: true,
            })],
        }));
        children.push(new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({
                text: card.monitorChips.join(' · '),
                font: 'Calibri',
                size: 22,
            })],
        }));
        if (card.monitorVesaNo) {
            children.push(new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({
                    text: 'Без крепления VESA',
                    font: 'Calibri',
                    size: 20,
                    color: '64748B',
                })],
            }));
        }
    }

    if (card.notes) {
        children.push(new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [new TextRun({
                text: 'Описание / Заметки',
                font: 'Calibri',
                size: 24,
                bold: true,
            })],
        }));
        children.push(new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: card.notes, font: 'Calibri', size: 22 })],
        }));
    }

    children.push(new Paragraph({
        spacing: { before: 200 },
        alignment: AlignmentType.LEFT,
        children: [new TextRun({
            text: `Сформировано: ${new Date().toLocaleString('ru-RU')}`,
            font: 'Calibri',
            size: 18,
            color: '64748B',
        })],
    }));

    const doc = new Document({
        sections: [{ children }],
    });
    return Packer.toBlob(doc);
}
