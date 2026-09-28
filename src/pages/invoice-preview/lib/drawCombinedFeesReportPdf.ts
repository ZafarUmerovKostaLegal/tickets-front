import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { KOSTA_LEGAL_FIRM } from './invoiceCoverLetterModel';
import type { CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';

const W = 595.28;
const H = 841.89;
const ML = 42;
const MR = 36;
const MT = 36;
const MB = 40;
const ROW = 12;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.29, 0.33, 0.39);

type Logo = Awaited<ReturnType<PDFDocument['embedPng']>> | null;

function money(n: number): string {
    const [whole, frac] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
}

function dateRu(iso: string): string {
    const day = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return iso;
    const [y, m, d] = day.split('-');
    return `${d}.${m}.${y}`;
}

function clip(text: string, font: PDFFont, size: number, width: number): string {
    const raw = text.replace(/\s+/g, ' ').trim() || '—';
    if (font.widthOfTextAtSize(raw, size) <= width)
        return raw;
    let out = raw;
    while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > width)
        out = out.slice(0, -1);
    return `${out}…`;
}

type Row = { cells: string[]; bold?: boolean };

function paintTable(
    page: PDFPage,
    font: PDFFont,
    fontBold: PDFFont,
    y: number,
    headers: string[],
    rows: Row[],
    weights: number[],
    right: Set<number>,
): number {
    const tableW = W - ML - MR;
    const sum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (tableW * w) / sum);
    const xs: number[] = [];
    let x = ML;
    for (const width of widths) {
        xs.push(x);
        x += width;
    }
    const paint = (cells: string[], bold: boolean, yy: number) => {
        cells.forEach((cell, i) => {
            const size = 8;
            const face = bold ? fontBold : font;
            const text = clip(cell, face, size, widths[i]! - 6);
            const tw = face.widthOfTextAtSize(text, size);
            const dx = right.has(i) ? xs[i]! + widths[i]! - 4 - tw : xs[i]! + 3;
            page.drawText(text, { x: dx, y: yy, size, font: face, color: INK });
        });
    };
    paint(headers, true, y);
    page.drawLine({ start: { x: ML, y: y - 3 }, end: { x: W - MR, y: y - 3 }, thickness: 0.8, color: INK });
    y -= ROW + 2;
    for (const row of rows) {
        paint(row.cells, Boolean(row.bold), y);
        y -= ROW;
    }
    return y;
}

function blocks(snapshot: CombinedReportSnapshot): Array<{ title?: string; headers: string[]; rows: Row[]; weights: number[]; right: Set<number> }> {
    const cur = snapshot.currency || 'USD';
    const invoiced = snapshot.totalFees + snapshot.totalExpenses;
    const out: Array<{ title?: string; headers: string[]; rows: Row[]; weights: number[]; right: Set<number> }> = [];
    for (const project of snapshot.projects) {
        const hours = project.lines.reduce((sum, line) => sum + line.hours, 0);
        const amount = project.lines.reduce((sum, line) => sum + line.amount, 0);
        out.push({
            title: `Sub-project name: ${project.name}`,
            headers: ['Date', 'User', 'Description', 'Hours', `Amount (${cur})`],
            weights: [14, 18, 40, 10, 18],
            right: new Set([3, 4]),
            rows: [
                ...project.lines.map((line) => ({
                    cells: [dateRu(line.date), line.user, line.description, line.hours.toFixed(2), money(line.amount)],
                })),
                { bold: true, cells: ['Total', '', '', hours.toFixed(2), money(amount)] },
            ],
        });
    }
    out.push({
        title: 'Summary of Services',
        headers: ['Initials', 'Name', 'Title', 'Rate', 'Hours', `Rate (${cur})`, 'Amount'],
        weights: [8, 18, 16, 14, 10, 16, 18],
        right: new Set([3, 4, 5, 6]),
        rows: [
            ...snapshot.people.map((person) => ({
                cells: [person.initials, person.name, person.title, money(person.rate), person.hours.toFixed(2), money(person.rate), money(person.amount)],
            })),
            { bold: true, cells: ['Total', '', '', '', snapshot.totalHours.toFixed(2), '', money(snapshot.totalFees)] },
        ],
    });
    out.push({
        title: 'Reimbursable Expenses via',
        headers: ['Description', 'Email date', `Amount (${cur})`],
        weights: [52, 18, 30],
        right: new Set([2]),
        rows: [
            ...snapshot.expenses.map((line) => ({
                cells: [line.description, dateRu(line.date), money(line.amount)],
            })),
            { bold: true, cells: ['Subtotal', '', money(snapshot.totalExpenses)] },
        ],
    });
    out.push({
        title: cur,
        headers: ['Shared amounts', 'Reimbursable expenses', 'TO BE INVOICED'],
        weights: [44, 28, 28],
        right: new Set([1, 2]),
        rows: [
            ...snapshot.shares.map((share) => ({
                cells: [`${share.name}  ${share.percent.toFixed(2)}%`, money(share.total), money(share.total)],
            })),
            { bold: true, cells: ['100%', money(invoiced), money(invoiced)] },
        ],
    });
    return out;
}

function blockHeight(block: { rows: Row[] }): number {
    return 16 + ROW + 2 + block.rows.length * ROW + 8;
}

export function countCombinedReportPages(snapshot: CombinedReportSnapshot): number {
    let y = H - MT - 64;
    let pages = 1;
    for (const block of blocks(snapshot)) {
        const h = blockHeight(block);
        if (y - h < MB) {
            pages += 1;
            y = H - MT - 16;
        }
        y -= h;
    }
    return pages;
}

export function drawCombinedReportPages(
    doc: PDFDocument,
    font: PDFFont,
    fontBold: PDFFont,
    logo: Logo,
    snapshot: CombinedReportSnapshot,
): void {
    let page = doc.addPage([W, H]);
    let y = H - MT;
    const header = () => {
        if (logo) {
            page.drawImage(logo, { x: ML, y: y - 28, width: 110, height: 28 });
        }
        const contact = [KOSTA_LEGAL_FIRM.addressLine, KOSTA_LEGAL_FIRM.phone, KOSTA_LEGAL_FIRM.email, KOSTA_LEGAL_FIRM.web];
        let cy = y - 2;
        for (const line of contact) {
            const tw = font.widthOfTextAtSize(line, 6);
            page.drawText(line, { x: W - MR - tw, y: cy, size: 6, font, color: MUTED });
            cy -= 8;
        }
        y -= 46;
        const lead = snapshot.feeTitle.toUpperCase();
        page.drawText(clip(lead, fontBold, 8, W - ML - MR), { x: ML, y, size: 8, font: fontBold, color: INK });
        y -= 18;
    };
    header();
    for (const block of blocks(snapshot)) {
        if (y - blockHeight(block) < MB) {
            page = doc.addPage([W, H]);
            y = H - MT - 16;
        }
        if (block.title) {
            page.drawText(clip(block.title, fontBold, 10, W - ML - MR), { x: ML, y, size: 10, font: fontBold, color: INK });
            y -= 14;
        }
        y = paintTable(page, font, fontBold, y, block.headers, block.rows, block.weights, block.right);
        y -= 8;
    }
}
