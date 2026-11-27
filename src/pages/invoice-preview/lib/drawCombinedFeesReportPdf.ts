import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
    combinedLineRate,
    combinedPeopleRows,
    combinedReportDetailLines,
    combinedReportFlatLines,
    flatFeeTableTitle,
    projectExpenseIndexes,
    projectSummaryRows,
    summaryRowHoursText,
    type CombinedReportLine,
    type CombinedReportSnapshot,
} from '@pages/time-tracking/lib/combinedInvoice';
import { combinedProjectTotals, planCombinedReportPreviewPages, sortedProjectFlatLines, sortedProjectLines } from './combinedReportPreviewPages';
import { KOSTA_LEGAL_LETTERHEAD_LINES } from './invoiceCoverLetterModel';
import { COVER_LETTERHEAD_LOGO_ASPECT } from './invoiceCoverLogoRaster';
import { formatTimeReportHours } from './invoiceTimeReportModel';
import { wrapPdfCellLines } from './invoicePdfCellWrap';

const REPORT_LOGO_H = 42;
const REPORT_LOGO_W = REPORT_LOGO_H * COVER_LETTERHEAD_LOGO_ASPECT;

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

type Logo = Awaited<ReturnType<PDFDocument['embedPng']>> | null;

function money(n: number): string {
    const [whole, frac] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
}

function shareExpenseText(n: number | undefined): string {
    if (n == null || Math.abs(n) < 0.005)
        return '-';
    return money(n);
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

function wrapped(text: string, font: PDFFont, width: number): string[] {
    const lines = wrapPdfCellLines(text || '—', Math.max(4, width), (s) => font.widthOfTextAtSize(s, CELL));
    return lines.length ? lines : ['—'];
}

type Block = { title?: string; titleAlign?: 'left' | 'right'; headers: string[]; rows: Row[]; weights: number[]; right: Set<number> };

function blocks(snapshot: CombinedReportSnapshot): Block[] {
    const cur = snapshot.currency || 'USD';
    const invoiced = snapshot.totalFees + snapshot.totalExpenses;
    const out: Block[] = [];
    const lines = combinedReportDetailLines(snapshot);
    const flat = combinedReportFlatLines(snapshot);
    const flatHours = flat.reduce((sum, line) => sum + line.hours, 0);
    const flatFees = flat.reduce((sum, line) => sum + line.amount, 0);
    out.push({
        headers: ['Date', 'Initials', 'Task', 'Description', 'Hours', `Amount (${cur})`],
        weights: [14, 10, 16, 36, 8, 16],
        right: new Set([4, 5]),
        rows: [
            ...lines.map((line) => ({
                cells: [dateRu(line.date), line.initials || line.user, line.task || '—', line.description, line.hours.toFixed(2), money(line.amount)],
            })),
            { bold: true, cells: ['Total', '', '', '', (snapshot.totalHours - flatHours).toFixed(2), money(snapshot.totalFees - flatFees)] },
        ],
    });
    if (flat.length > 0)
        out.push(flatBlock(flat, cur, money));
    out.push({
        title: 'Summary of Services',
        headers: ['Initials', 'Name', 'Title', 'Rate', 'Hours', `Rate (${cur})`, 'Amount'],
        weights: [10, 18, 16, 13, 9, 16, 18],
        right: new Set([3, 4, 5, 6]),
        rows: [
            ...combinedPeopleRows(snapshot).map((person) => ({
                cells: [person.initials, person.name, person.title, money(person.rate), summaryRowHoursText(person, (n) => n.toFixed(2)), money(person.rate), money(person.amount)],
            })),
            { bold: true, cells: ['Total', '', '', '', (snapshot.totalHours - flatHours).toFixed(2), '', money(snapshot.totalFees)] },
        ],
    });
    out.push({
        title: 'Reimbursable Expenses',
        headers: ['Description', 'Email date', `Amount (${cur})`],
        weights: [52, 18, 30],
        right: new Set([2]),
        rows: [
            ...snapshot.expenses.map((line) => ({
                cells: [line.description, dateRu(line.date), money(line.amount)],
            })),
            { bold: true, cells: [`Subtotal (${cur})`, '', money(snapshot.totalExpenses)] },
        ],
    });
    out.push({
        headers: ['Shared amounts', '', 'Reimbursable expenses', 'TO BE INVOICED:'],
        weights: [36, 14, 25, 25],
        right: new Set([1, 2, 3]),
        rows: [
            ...snapshot.shares.map((share) => ({
                cells: [share.name, `${share.percent.toFixed(2)}%`, shareExpenseText(share.expenses), money(share.total)],
            })),
            { bold: true, cells: ['Total', '100%', '', money(invoiced)] },
        ],
    });
    return out;
}

function flatBlock(lines: CombinedReportLine[], cur: string, num: (n: number) => string, showTotal = true): Block {
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    return {
        title: flatFeeTableTitle(lines),
        headers: ['Date', 'Initials', 'Task', 'Description', 'Per entry', 'Rate', `Amount (${cur})`],
        weights: [13, 9, 14, 28, 9, 11, 16],
        right: new Set([4, 5, 6]),
        rows: [
            ...lines.map((line) => ({
                cells: [dateRu(line.date), line.initials || line.user, line.task || '—', line.description || '—', num(1), num(combinedLineRate(line)), num(line.amount)],
            })),
            ...(showTotal ? [{ bold: true, cells: ['', '', '', `Total (${cur})`, num(lines.length), '', num(total)] }] : []),
        ],
    };
}

const SL = 20;
const SR = 20;
const ST = 22;
const SB = 28;
const SHEET_HEAD = 22;
const SHEET_LINE = 12;
const SHEET_GAP = 18;
const PAD_X = 6;
const GRID = rgb(0.58, 0.64, 0.72);

type Frame = { left: number; width: number };
type TableStyle = { title: ReturnType<typeof rgb>; titleSize: number; total: ReturnType<typeof rgb> };

const SHEET_FRAME: Frame = { left: SL, width: W - SL - SR };
const REPORT_FRAME: Frame = { left: ML, width: W - ML - MR };
const SHEET_STYLE: TableStyle = { title: RED, titleSize: 10, total: RED };
const REPORT_STYLE: TableStyle = { title: INK, titleSize: 11, total: INK };
const TITLE_GAP = 20;

const LETTERHEAD_H = 52;

type PageOp =
    | { kind: 'chrome'; title: string | null; letterhead?: boolean }
    | { kind: 'gap' }
    | { kind: 'title'; text: string; align: 'left' | 'right' }
    | { kind: 'thead'; headers: string[]; weights: number[]; right: Set<number> }
    | { kind: 'row'; lines: string[][]; weights: number[]; right: Set<number>; height: number; bold: boolean };

const CONFIDENTIAL = 'PRIVATE AND CONFIDENTIAL';

function sheetNum(n: number): string {
    return formatTimeReportHours(n).replace(/[\u00a0\u202f]/g, ' ');
}

function wrapAt(text: string, font: PDFFont, width: number, size: number): string[] {
    const lines = wrapPdfCellLines(text || '—', Math.max(4, width), (s) => font.widthOfTextAtSize(s, size));
    return lines.length ? lines : ['—'];
}

function sheetTableW(): number {
    return SHEET_FRAME.width;
}

function sheetColXs(weights: number[], frame: Frame = SHEET_FRAME): { widths: number[]; xs: number[] } {
    const sum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (frame.width * w) / sum);
    const xs: number[] = [];
    let x = frame.left;
    for (const width of widths) {
        xs.push(x);
        x += width;
    }
    return { widths, xs };
}

function sheetRowLayout(
    cells: string[],
    weights: number[],
    right: Set<number>,
    font: PDFFont,
    frame: Frame = SHEET_FRAME,
): { lines: string[][]; height: number } {
    const { widths } = sheetColXs(weights, frame);
    const lines = cells.map((cell, i) => {
        const width = Math.max(8, widths[i]! - PAD_X * 2);
        if (!cell.trim())
            return [''];
        if (right.has(i))
            return [clip(cell, font, CELL, width)];
        return wrapped(cell, font, width);
    });
    const count = Math.max(1, ...lines.map((line) => line.length));
    return { lines, height: 5 + count * SHEET_LINE + 4 };
}

function chromeHeight(title: string | null, fontBold: PDFFont, letterhead = false): number {
    const height = 30 + (letterhead ? LETTERHEAD_H : 0);
    if (!title)
        return height;
    const lines = wrapAt(title.toUpperCase(), fontBold, sheetTableW(), 9);
    return height + lines.length * 11 + 6;
}

function drawChrome(page: PDFPage, fontBold: PDFFont, title: string | null, letterhead: { logo: Logo; font: PDFFont } | null = null): number {
    let y = H - ST;
    if (letterhead) {
        const logoH = 36;
        if (letterhead.logo)
            page.drawImage(letterhead.logo, { x: SL, y: y - logoH, width: logoH * COVER_LETTERHEAD_LOGO_ASPECT, height: logoH });
        let cy = y - 4;
        for (const line of KOSTA_LEGAL_LETTERHEAD_LINES) {
            const tw = letterhead.font.widthOfTextAtSize(line, 6);
            page.drawText(line, { x: W - SR - tw, y: cy, size: 6, font: letterhead.font, color: MUTED });
            cy -= 8;
        }
        y -= LETTERHEAD_H;
    }
    const size = 8;
    const padX = 6;
    const padY = 3;
    const boxW = fontBold.widthOfTextAtSize(CONFIDENTIAL, size) + padX * 2;
    const boxH = size + padY * 2;
    const boxX = W - SR - boxW;
    const boxBottom = y - boxH;
    page.drawRectangle({ x: boxX, y: boxBottom, width: boxW, height: boxH, color: RED });
    page.drawText(CONFIDENTIAL, { x: boxX + padX, y: boxBottom + padY, size, font: fontBold, color: rgb(1, 1, 1) });
    y = boxBottom - 6;
    page.drawLine({ start: { x: SL, y }, end: { x: W - SR, y }, thickness: 1.2, color: RED });
    y -= 10;
    if (title) {
        const lines = wrapAt(title.toUpperCase(), fontBold, sheetTableW(), 9);
        lines.forEach((line, index) => {
            page.drawText(line, { x: SL, y: y - index * 11, size: 9, font: fontBold, color: RED });
        });
        y -= lines.length * 11 + 6;
    }
    return y;
}

function sheetBlocks(
    snapshot: CombinedReportSnapshot,
    projectIndex: number,
    timeFrom: number,
    timeTo: number,
    showTime: boolean,
    showTimeTotal: boolean,
    showSummary: boolean,
): Block[] {
    const cur = snapshot.currency || 'USD';
    const out: Block[] = [];
    const lines = sortedProjectLines(snapshot, projectIndex);
    if (showTime) {
        const projectHours = lines.reduce((sum, line) => sum + line.hours, 0);
        const projectFees = lines.reduce((sum, line) => sum + line.amount, 0);
        const rows: Row[] = lines.slice(timeFrom, timeTo).map((line) => ({
            cells: [
                dateRu(line.date),
                line.initials || line.user,
                line.task || '—',
                line.description || '—',
                sheetNum(line.hours),
                sheetNum(combinedLineRate(line)),
                sheetNum(line.amount),
            ],
        }));
        if (showTimeTotal)
            rows.push({ bold: true, cells: ['', '', '', `Total (${cur})`, sheetNum(projectHours), '', sheetNum(projectFees)] });
        out.push({
            headers: ['Date', 'Initials', 'Task', 'Description', 'Hours', 'Rate', `Amount (${cur})`],
            weights: [13, 9, 14, 28, 9, 11, 16],
            right: new Set([4, 5, 6]),
            rows,
        });
    }
    if (showSummary) {
        const people = projectSummaryRows(snapshot, projectIndex);
        const summaryHours = people.reduce((sum, person) => sum + (person.entries != null ? 0 : person.hours), 0);
        const summaryFees = people.reduce((sum, person) => sum + person.amount, 0);
        out.push({
            headers: ['Initials', 'Name', 'Title', 'Hours', `Rate (${cur})`, `Amount (${cur})`],
            weights: [11, 24, 20, 12, 16, 17],
            right: new Set([3, 4, 5]),
            rows: [
                ...people.map((person) => ({
                    cells: [person.initials, person.name, person.title, summaryRowHoursText(person, sheetNum), sheetNum(person.rate), sheetNum(person.amount)],
                })),
                { bold: true, cells: ['', '', `Total (${cur})`, sheetNum(summaryHours), '', sheetNum(summaryFees)] },
            ],
        });
    }
    return out;
}

function expenseSheetBlock(
    snapshot: CombinedReportSnapshot,
    projectIndex: number,
    from: number,
    to: number,
    showTotal: boolean,
): Block | null {
    if (!showTotal && to <= from)
        return null;
    const cur = snapshot.currency || 'USD';
    const refs = projectExpenseIndexes(snapshot, projectIndex);
    const visible = refs.slice(Math.max(0, from), Math.max(0, to));
    const rows: Row[] = visible.map((index) => {
        const line = snapshot.expenses[index];
        return {
            cells: [line?.description || '—', dateRu(line?.date || ''), sheetNum(line?.amount || 0)],
        };
    });
    if (showTotal) {
        const total = refs.reduce((sum, index) => sum + (Number(snapshot.expenses[index]?.amount) || 0), 0);
        rows.push({ bold: true, cells: [`Subtotal (${cur})`, '', sheetNum(total)] });
    }
    if (rows.length === 0)
        return null;
    return {
        title: 'Reimbursable Expenses',
        headers: ['Description', 'Email date', `Amount (${cur})`],
        weights: [52, 18, 30],
        right: new Set([2]),
        rows,
    };
}

function projectsSummaryBlock(snapshot: CombinedReportSnapshot): Block {
    const cur = snapshot.currency || 'USD';
    const { rows, total } = combinedProjectTotals(snapshot);
    const line = (row: { hours: number; fees: number; expenses: number; total: number }) => [
        sheetNum(row.hours), sheetNum(row.fees), row.expenses ? sheetNum(row.expenses) : '-', sheetNum(row.total),
    ];
    return {
        title: 'Summary by Project',
        headers: ['Project', 'Hours', `Fees (${cur})`, `Expenses (${cur})`, `Total (${cur})`],
        weights: [40, 12, 16, 16, 16],
        right: new Set([1, 2, 3, 4]),
        rows: [
            ...rows.map((row) => ({ cells: [row.name || '—', ...line(row)] })),
            { bold: true, cells: [`Total (${cur})`, ...line(total)] },
        ],
    };
}

function planPerProjectPages(snapshot: CombinedReportSnapshot, font: PDFFont, fontBold: PDFFont): PageOp[][] {
    const slices = planCombinedReportPreviewPages(snapshot).filter((slice) => slice.projectIndex >= 0);
    const pages: PageOp[][] = [];
    let y = 0;
    const open = (title: string | null, letterhead = false) => {
        pages.push([{ kind: 'chrome', title, letterhead }]);
        y = H - ST - chromeHeight(title, fontBold, letterhead);
    };
    const push = (op: PageOp, height: number) => {
        pages[pages.length - 1]!.push(op);
        y -= height;
    };
    for (const slice of slices) {
        const project = snapshot.projects[slice.projectIndex];
        const title = slice.showMasthead
            ? (project?.pageTitle?.trim() || `${snapshot.feeTitle} (${project?.name ?? ''})`).toUpperCase()
            : null;
        open(title, slice.showLetterhead);
        const showTime = slice.showTimeTotal || slice.timeTo > slice.timeFrom;
        const showFlat = slice.showFlatTotal || slice.flatTo > slice.flatFrom;
        const flatLines = sortedProjectFlatLines(snapshot, slice.projectIndex);
        const showExpenses = slice.showExpensesTotal || slice.expensesTo > slice.expensesFrom;
        const expenseBlock = showExpenses
            ? expenseSheetBlock(snapshot, slice.projectIndex, slice.expensesFrom, slice.expensesTo, slice.showExpensesTotal)
            : null;
        const blocks: Block[] = [
            ...sheetBlocks(snapshot, slice.projectIndex, slice.timeFrom, slice.timeTo, showTime, slice.showTimeTotal, false),
            ...(showFlat
                ? [flatBlock(flatLines.slice(Math.max(0, slice.flatFrom), Math.max(0, slice.flatTo)), snapshot.currency || 'USD', sheetNum, slice.showFlatTotal)]
                : []),
            ...sheetBlocks(snapshot, slice.projectIndex, 0, 0, false, false, slice.showPeopleTotal),
            ...(expenseBlock ? [expenseBlock] : []),
            ...(slice.showProjectsSummary ? [projectsSummaryBlock(snapshot)] : []),
        ];
        let firstBlock = true;
        for (const block of blocks) {
            if (!firstBlock) {
                if (y - SHEET_GAP - SHEET_HEAD < SB)
                    open(null);
                else
                    push({ kind: 'gap' }, SHEET_GAP);
            }
            firstBlock = false;
            if (block.title) {
                if (y - 16 < SB)
                    open(null);
                push({ kind: 'title', text: block.title, align: block.titleAlign ?? 'left' }, 16);
            }
            const paintHead = () => {
                if (y - SHEET_HEAD < SB)
                    open(null);
                push({ kind: 'thead', headers: block.headers, weights: block.weights, right: block.right }, SHEET_HEAD);
            };
            paintHead();
            for (const row of block.rows) {
                const face = row.bold ? fontBold : font;
                const layout = sheetRowLayout(row.cells, block.weights, block.right, face);
                if (y - layout.height < SB) {
                    open(null);
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
        }
    }
    if (pages.length === 0)
        open(snapshot.feeTitle.toUpperCase());
    return pages.filter((page) => page.length > 0);
}

function leadLines(snapshot: CombinedReportSnapshot, fontBold: PDFFont): string[] {
    return wrapAt(snapshot.feeTitle.toUpperCase(), fontBold, W - ML - MR, 9);
}

function contentTop(first: boolean, leadCount: number): number {
    if (!first)
        return H - MT;
    return H - MT - REPORT_LOGO_H - 14 - leadCount * 11 - 10;
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
    const layouts = (block: Block) => block.rows.map((row) => ({
        row,
        layout: sheetRowLayout(row.cells, block.weights, block.right, row.bold ? fontBold : font, REPORT_FRAME),
    }));
    let first = true;
    for (const block of blocks(snapshot)) {
        const rows = layouts(block);
        const lead = (first ? 0 : SHEET_GAP) + (block.title ? TITLE_GAP : 0) + SHEET_HEAD + (rows[0]?.layout.height ?? 0);
        if (!first && y - lead < MB)
            nextPage();
        else if (!first)
            push({ kind: 'gap' }, SHEET_GAP);
        first = false;
        if (block.title)
            push({ kind: 'title', text: block.title, align: block.titleAlign ?? 'left' }, TITLE_GAP);
        const paintHead = () => {
            push({ kind: 'thead', headers: block.headers, weights: block.weights, right: block.right }, SHEET_HEAD);
        };
        paintHead();
        for (const { row, layout } of rows) {
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
    }
    return pages.filter((page) => page.length > 0);
}

export function countCombinedReportPages(snapshot: CombinedReportSnapshot, font: PDFFont, fontBold: PDFFont): number {
    const pages = snapshot.layout === 'perProject'
        ? planPerProjectPages(snapshot, font, fontBold)
        : planPages(snapshot, font, fontBold);
    return Math.max(1, pages.length);
}

function drawSheetOps(
    page: PDFPage,
    font: PDFFont,
    fontBold: PDFFont,
    ops: PageOp[],
    { startY = H - ST, frame = SHEET_FRAME, style = SHEET_STYLE, letterhead = null }: {
        startY?: number;
        frame?: Frame;
        style?: TableStyle;
        letterhead?: { logo: Logo; font: PDFFont } | null;
    } = {},
): void {
    let y = startY;
    const left = frame.left;
    const tableW = frame.width;
    for (const op of ops) {
        if (op.kind === 'chrome') {
            y = drawChrome(page, fontBold, op.title, op.letterhead ? letterhead : null);
            continue;
        }
        if (op.kind === 'gap') {
            y -= SHEET_GAP;
            continue;
        }
        if (op.kind === 'title') {
            const text = clip(op.text, fontBold, style.titleSize, tableW);
            const tw = fontBold.widthOfTextAtSize(text, style.titleSize);
            const x = op.align === 'right' ? left + tableW - tw : left;
            const step = style === SHEET_STYLE ? 16 : TITLE_GAP;
            page.drawText(text, { x, y: y - step + 5, size: style.titleSize, font: fontBold, color: style.title });
            y -= step;
            continue;
        }
        if (op.kind === 'thead') {
            const { widths, xs } = sheetColXs(op.weights, frame);
            page.drawRectangle({ x: left, y: y - SHEET_HEAD, width: tableW, height: SHEET_HEAD, color: RED });
            const textY = y - SHEET_HEAD + 7;
            op.headers.forEach((cell, i) => {
                if (!cell.trim())
                    return;
                const text = clip(cell, fontBold, CELL, widths[i]! - PAD_X * 2);
                const tw = fontBold.widthOfTextAtSize(text, CELL);
                const dx = op.right.has(i) ? xs[i]! + widths[i]! - PAD_X - tw : xs[i]! + PAD_X;
                page.drawText(text, { x: dx, y: textY, size: CELL, font: fontBold, color: rgb(1, 1, 1) });
            });
            y -= SHEET_HEAD;
            continue;
        }
        if (op.kind !== 'row')
            continue;
        const { widths, xs } = sheetColXs(op.weights, frame);
        const face = op.bold ? fontBold : font;
        const color = op.bold ? style.total : INK;
        op.lines.forEach((col, i) => {
            col.forEach((text, lineIndex) => {
                const tw = face.widthOfTextAtSize(text, CELL);
                const dx = op.right.has(i) ? xs[i]! + widths[i]! - PAD_X - tw : xs[i]! + PAD_X;
                page.drawText(text, { x: dx, y: y - 13 - lineIndex * SHEET_LINE, size: CELL, font: face, color });
            });
        });
        y -= op.height;
        page.drawLine({
            start: { x: left, y },
            end: { x: left + tableW, y },
            thickness: op.bold ? 1 : 0.4,
            color: op.bold ? style.total : GRID,
        });
    }
}

export function drawCombinedReportPages(
    doc: PDFDocument,
    font: PDFFont,
    fontBold: PDFFont,
    logo: Logo,
    snapshot: CombinedReportSnapshot,
): void {
    if (snapshot.layout === 'perProject') {
        for (const ops of planPerProjectPages(snapshot, font, fontBold)) {
            const page = doc.addPage([W, H]);
            drawSheetOps(page, font, fontBold, ops, { letterhead: { logo, font } });
        }
        return;
    }
    const lead = leadLines(snapshot, fontBold);
    const pages = planPages(snapshot, font, fontBold);
    pages.forEach((ops, index) => {
        const page = doc.addPage([W, H]);
        let y = H - MT;
        if (index === 0) {
            if (logo)
                page.drawImage(logo, { x: ML, y: y - REPORT_LOGO_H, width: REPORT_LOGO_W, height: REPORT_LOGO_H });
            let cy = y - 2;
            for (const line of KOSTA_LEGAL_LETTERHEAD_LINES) {
                const tw = font.widthOfTextAtSize(line, 6);
                page.drawText(line, { x: W - MR - tw, y: cy, size: 6, font, color: MUTED });
                cy -= 8;
            }
            const leadTop = y - REPORT_LOGO_H - 14 - 8;
            lead.forEach((line, i) => {
                page.drawText(line, { x: ML, y: leadTop - i * 11, size: 9, font: fontBold, color: RED });
            });
            y = contentTop(true, lead.length);
        }
        else {
            y = contentTop(false, 0);
        }
        drawSheetOps(page, font, fontBold, ops, { startY: y, frame: REPORT_FRAME, style: REPORT_STYLE });
    });
}
