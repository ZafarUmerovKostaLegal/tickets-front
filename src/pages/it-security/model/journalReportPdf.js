import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import boldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import regularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { journalReportDocument } from './journalReport';
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
function wrapPdfText(text, font, size, maxWidth) {
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0)
        return [''];
    const lines = [];
    let current = '';
    const commit = () => {
        if (current)
            lines.push(current);
        current = '';
    };
    const take = (token) => {
        if (font.widthOfTextAtSize(token, size) <= maxWidth) {
            const next = current ? `${current} ${token}` : token;
            if (font.widthOfTextAtSize(next, size) <= maxWidth)
                current = next;
            else {
                commit();
                current = token;
            }
            return;
        }
        commit();
        let chunk = '';
        for (const char of token) {
            const next = chunk + char;
            if (font.widthOfTextAtSize(next, size) <= maxWidth)
                chunk = next;
            else {
                if (chunk)
                    lines.push(chunk);
                chunk = char;
            }
        }
        current = chunk;
    };
    tokens.forEach(take);
    commit();
    return lines;
}
async function fontBytes(url) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error('Не удалось подготовить файл отчёта');
    return response.arrayBuffer();
}
export async function downloadJournalReport(model, view) {
    const document = journalReportDocument(model, view);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const [regular, bold] = await Promise.all([fontBytes(regularUrl), fontBytes(boldUrl)]);
    const font = await pdf.embedFont(regular, { subset: true });
    const fontBold = await pdf.embedFont(bold, { subset: true });
    const ink = rgb(0.06, 0.09, 0.16);
    const muted = rgb(0.39, 0.45, 0.55);
    const width = PAGE_W - MARGIN * 2;
    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    const nextPage = () => {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
    };
    const room = (height) => {
        if (y - height < MARGIN)
            nextPage();
    };
    const write = (text, face, size, color = ink, gap = 4) => {
        const lines = wrapPdfText(text, face, size, width);
        lines.forEach((line) => {
            room(size + gap);
            page.drawText(line, { x: MARGIN, y: y - size, size, font: face, color });
            y -= size + gap;
        });
    };
    write(document.title, fontBold, 16, ink, 8);
    document.blocks.forEach((block) => {
        y -= 8;
        write(block.heading, fontBold, 11, ink, 5);
        block.lines.forEach((line) => write(line, font, 9, line === 'Нет данных' || line === 'Нет записей' ? muted : ink, 3));
    });
    const bytes = await pdf.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    downloadBlob(new Blob([copy], { type: 'application/pdf' }), document.fileName);
}
