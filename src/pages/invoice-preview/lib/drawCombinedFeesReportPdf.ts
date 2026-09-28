import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { combinedReportDetailLines, type CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import { KOSTA_LEGAL_LETTERHEAD_LINES } from './invoiceCoverLetterModel';
import { wrapPdfCellLines } from './invoicePdfCellWrap';

const W = 595.28;
const H = 841.89;
const ML = 42;
const MR = 36;
const MT = 36;
const MB = 40;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.29, 0.33, 0.39);
const RED = rgb(232 / 255, 51 / 255, 55 / 255);
const CELL = 8;
const STEP = 10;
const THEAD_H = 16;
const TITLE_H = 16;

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

function colXs(weights: number[]): { widths: number[]; xs: number[] } {
    const tableW = W - ML - MR;
    const sum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (tableW * w) / sum);
    const xs: number[] = [];
    let x = ML;
    for (const width of widths) {
        xs.push(x);
        x += width;
    }
    return { widths, xs };
}

function wrapped(text: string, font: PDFFont, width: number): string[] {
    const lines = wrapPdfCellLines(text || '—', Math.max(4, width), (s) => font.widthOfTextAtSize(s, CELL));
    return lines.length ? lines : ['—'];
}

function rowLayout(cells: string[], weights: number[], right: Set<number>, font: PDFFont): { lines: string[][]; height: number } {
    const { widths } = colXs(weights);
    const lines = cells.map((cell, i) => {
        const width = Math.max(8, widths[i]! - 6);
        if (right.has(i))
            return [clip(cell, font, CELL, width)];
        return wrapped(cell, font, width);
    });
    const count = Math.max(1, ...lines.map((line) => line.length));
    return { lines, height: count * STEP };
}

function blocks(snapshot: CombinedReportSnapshot): Array<{ title?: string; headers: string[]; rows: Row[]; weights: number[]; right: Set<number> }> {
    const cur = snapshot.currency || 'USD';
    const invoiced = snapshot.totalFees + snapshot.totalExpenses;
    const out: Array<{ title?: string; headers: string[]; rows: Row[]; weights: number[]; right: Set<number> }> = [];
    const lines = combinedReportDetailLines(snapshot);
    out.push({
        headers: ['Date', 'Initials', 'Task', 'Description', 'Hours', `Amount (${cur})`],
        weights: [14, 10, 16, 36, 8, 16],
        right: new Set([4, 5]),
        rows: [
            ...lines.map((line) => ({
                cells: [dateRu(line.date), line.initials || line.user, line.task || '—', line.description, line.hours.toFixed(2), money(line.amount)],
            })),
            { bold: true, cells: ['Total', '', '', '', snapshot.totalHours.toFixed(2), money(snapshot.totalFees)] },
        ],
    });
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

type PageOp =
    | { kind: 'title'; text: string }
    | { kind: 'thead'; headers: string[]; weights: number[]; right: Set<number> }
    | { kind: 'row'; lines: string[][]; weights: number[]; right: Set<number>; height: number; bold: boolean };

function leadLines(snapshot: CombinedReportSnapshot, fontBold: PDFFont): string[] {
    return wrapped(snapshot.feeTitle.toUpperCase(), fontBold, W - ML - MR);
}

function contentTop(first: boolean, leadCount: number): number {
    if (!first)
        return H - MT - 16;
    return H - MT - 54 - leadCount * 10 - 6;
}

function planPages(snapshot: CombinedReportSnapshot, font: PDFFont, fontBold: PDFFont): PageOp[][] {
    const pages: PageOp[][] = [[]];
    let y = contentTop(true, leadLines(snapshot, fontBold).length);
    const nextPage = () => {
        pages.push([]);
        y = contentTop(false, 0);
    };
    const push = (op: PageOp, height: number) => {
        pages[pages.length - 1]!.push(op);
        y -= height;
    };
    for (const block of blocks(snapshot)) {
        const paintHead = () => {
            if (y - THEAD_H < MB)
                nextPage();
            push({ kind: 'thead', headers: block.headers, weights: block.weights, right: block.right }, THEAD_H);
        };
        if (block.title) {
            if (y - (TITLE_H + THEAD_H) < MB)
                nextPage();
            push({ kind: 'title', text: block.title }, TITLE_H);
        }
        paintHead();
        for (const row of block.rows) {
            const face = row.bold ? fontBold : font;
            const layout = rowLayout(row.cells, block.weights, block.right, face);
            if (y - layout.height < MB) {
                nextPage();
                paintHead();
            }
            push({
                kind: 'row',
                lines: layout.lines,
                weights: block.weights,
                right: block.right,
                height: layout.height,
                bold: Boolean(row.bold),
            }, layout.height);
        }
        y -= 8;
    }
    return pages.filter((page) => page.length > 0);
}

export function countCombinedReportPages(snapshot: CombinedReportSnapshot, font: PDFFont, fontBold: PDFFont): number {
    return Math.max(1, planPages(snapshot, font, fontBold).length);
}

function drawThead(page: PDFPage, fontBold: PDFFont, y: number, headers: string[], weights: number[], right: Set<number>): void {
    const { widths, xs } = colXs(weights);
    const tableW = W - ML - MR;
    page.drawRectangle({ x: ML, y: y - 4, width: tableW, height: 14, color: RED });
    headers.forEach((cell, i) => {
        const text = clip(cell, fontBold, CELL, widths[i]! - 6);
        const tw = fontBold.widthOfTextAtSize(text, CELL);
        const dx = right.has(i) ? xs[i]! + widths[i]! - 4 - tw : xs[i]! + 3;
        page.drawText(text, { x: dx, y, size: CELL, font: fontBold, color: rgb(1, 1, 1) });
    });
}

export function drawCombinedReportPages(
    doc: PDFDocument,
    font: PDFFont,
    fontBold: PDFFont,
    logo: Logo,
    snapshot: CombinedReportSnapshot,
): void {
    const lead = leadLines(snapshot, fontBold);
    const pages = planPages(snapshot, font, fontBold);
    pages.forEach((ops, index) => {
        const page = doc.addPage([W, H]);
        let y = H - MT;
        if (index === 0) {
            if (logo)
                page.drawImage(logo, { x: ML, y: y - 30, width: 118, height: 30 });
            let cy = y - 2;
            for (const line of KOSTA_LEGAL_LETTERHEAD_LINES) {
                const tw = font.widthOfTextAtSize(line, 6);
                page.drawText(line, { x: W - MR - tw, y: cy, size: 6, font, color: MUTED });
                cy -= 8;
            }
            const leadTop = contentTop(true, lead.length) + lead.length * 10 + 6;
            lead.forEach((line, i) => {
                page.drawText(line, { x: ML, y: leadTop - i * 10, size: 8, font: fontBold, color: RED });
            });
            y = contentTop(true, lead.length);
        }
        else {
            y = contentTop(false, 0);
        }
        for (const op of ops) {
            if (op.kind === 'title') {
                page.drawText(clip(op.text, fontBold, 10, W - ML - MR), { x: ML, y, size: 10, font: fontBold, color: INK });
                y -= TITLE_H;
                continue;
            }
            if (op.kind === 'thead') {
                drawThead(page, fontBold, y, op.headers, op.weights, op.right);
                y -= THEAD_H;
                continue;
            }
            const { widths, xs } = colXs(op.weights);
            const face = op.bold ? fontBold : font;
            op.lines.forEach((col, i) => {
                col.forEach((text, lineIndex) => {
                    const tw = face.widthOfTextAtSize(text, CELL);
                    const dx = op.right.has(i) ? xs[i]! + widths[i]! - 4 - tw : xs[i]! + 3;
                    page.drawText(text, { x: dx, y: y - lineIndex * STEP, size: CELL, font: face, color: INK });
                });
            });
            y -= op.height;
        }
    });
}
