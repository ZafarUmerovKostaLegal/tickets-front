import {
    AlignmentType,
    BorderStyle,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { KOSTA_LEGAL_FIRM, KOSTA_LEGAL_LETTERHEAD_LINES } from './invoiceCoverLetterModel';
import {
    combinedLineRate,
    combinedPeopleRows,
    combinedReportDetailLines,
    combinedReportFlatLines,
    flatFeeTableTitle,
    summaryRowHoursText,
    type CombinedReportSnapshot,
} from '@pages/time-tracking/lib/combinedInvoice';
import { combinedProjectTotals, hasProjectsSummary } from './combinedReportPreviewPages';

const FONT = 'Calibri Light';
const SIZE = 16;

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

const borders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D8' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D8' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
} as const;

function cell(
    text: string,
    width: number,
    bold = false,
    align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
    header = false,
): TableCell {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.PERCENTAGE },
        shading: header ? { type: ShadingType.SOLID, fill: 'E83337', color: 'E83337' } : undefined,
        children: [new Paragraph({
            alignment: align,
            children: [new TextRun({ text: text || ' ', bold, size: SIZE, font: FONT, color: header ? 'FFFFFF' : '18181B' })],
        })],
    });
}

function table(headers: string[], rows: string[][], widths: number[], rightFrom: number): Table {
    const head = new TableRow({
        children: headers.map((header, i) => cell(header, widths[i] ?? 10, true, i >= rightFrom ? AlignmentType.RIGHT : AlignmentType.LEFT, true)),
    });
    const body = rows.map((row) => new TableRow({
        children: row.map((value, i) => cell(value, widths[i] ?? 10, false, i >= rightFrom ? AlignmentType.RIGHT : AlignmentType.LEFT)),
    }));
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [head, ...body],
    });
}

function heading(text: string): Paragraph {
    return new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text, bold: true, size: 20, font: FONT, color: '18181B' })],
    });
}

export function combinedReportDocxChildren(snapshot: CombinedReportSnapshot): (Paragraph | Table)[] {
    const cur = snapshot.currency || 'USD';
    const invoiced = snapshot.totalFees + snapshot.totalExpenses;
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
    const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
    const out: (Paragraph | Table)[] = [
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({
                children: [
                    new TableCell({
                        borders: noBorders,
                        width: { size: 48, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({
                            children: [new TextRun({ text: KOSTA_LEGAL_FIRM.brandName, bold: true, size: 28, font: FONT })],
                        })],
                    }),
                    new TableCell({
                        borders: noBorders,
                        width: { size: 52, type: WidthType.PERCENTAGE },
                        children: KOSTA_LEGAL_LETTERHEAD_LINES.map((line) => new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [new TextRun({ text: line, size: 14, font: FONT, color: '4B5563' })],
                        })),
                    }),
                ],
            })],
        }),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: snapshot.feeTitle.toUpperCase(), bold: true, size: 16, font: FONT, color: 'E83337' })],
        }),
    ];
    const lines = combinedReportDetailLines(snapshot);
    const flat = combinedReportFlatLines(snapshot);
    const flatHours = flat.reduce((sum, line) => sum + line.hours, 0);
    const flatFees = flat.reduce((sum, line) => sum + line.amount, 0);
    out.push(table(
        ['Date', 'Initials', 'Task', 'Description', 'Hours', `Amount (${cur})`],
        [
            ...lines.map((line) => [dateRu(line.date), line.initials || line.user, line.task || '—', line.description, line.hours.toFixed(2), money(line.amount)]),
            ['Total', '', '', '', (snapshot.totalHours - flatHours).toFixed(2), money(snapshot.totalFees - flatFees)],
        ],
        [14, 10, 16, 36, 8, 16],
        4,
    ));
    if (flat.length > 0) {
        out.push(heading(flatFeeTableTitle(flat)));
        out.push(table(
            ['Date', 'Initials', 'Task', 'Description', 'Per entry', 'Rate', `Amount (${cur})`],
            [
                ...flat.map((line) => [dateRu(line.date), line.initials || line.user, line.task || '—', line.description, '1.00', money(combinedLineRate(line)), money(line.amount)]),
                ['Total', '', '', '', flat.length.toFixed(2), '', money(flatFees)],
            ],
            [13, 9, 14, 28, 9, 11, 16],
            4,
        ));
    }
    out.push(heading('Summary of Services'));
    out.push(table(
        ['Initials', 'Name', 'Title', 'Rate', 'Hours', `Rate (${cur})`, 'Amount'],
        [
            ...combinedPeopleRows(snapshot).map((person) => [person.initials, person.name, person.title, money(person.rate), summaryRowHoursText(person, (n) => n.toFixed(2)), money(person.rate), money(person.amount)]),
            ['Total', '', '', '', (snapshot.totalHours - flatHours).toFixed(2), '', money(snapshot.totalFees)],
        ],
        [10, 18, 16, 13, 9, 16, 18],
        3,
    ));
    out.push(heading('Reimbursable Expenses'));
    out.push(table(
        ['Description', 'Email date', `Amount (${cur})`],
        [
            ...snapshot.expenses.map((line) => [line.description, dateRu(line.date), money(line.amount)]),
            [`Subtotal (${cur})`, '', money(snapshot.totalExpenses)],
        ],
        [52, 18, 30],
        2,
    ));
    out.push(table(
        ['Shared amounts', '', 'Reimbursable expenses', 'TO BE INVOICED:'],
        [
            ...snapshot.shares.map((share) => [share.name, `${share.percent.toFixed(2)}%`, shareExpenseText(share.expenses), money(share.total)]),
            ['Total', '100%', '', money(invoiced)],
        ],
        [36, 14, 25, 25],
        1,
    ));
    if (hasProjectsSummary(snapshot)) {
        const { rows, total } = combinedProjectTotals(snapshot);
        const cells = (row: { hours: number; fees: number; expenses: number; total: number }) => [
            row.hours.toFixed(2), money(row.fees), row.expenses ? money(row.expenses) : '-', money(row.total),
        ];
        out.push(heading('Summary by Project'));
        out.push(table(
            ['Project', 'Hours', `Fees (${cur})`, `Expenses (${cur})`, `Total (${cur})`],
            [...rows.map((row) => [row.name || '—', ...cells(row)]), [`Total (${cur})`, ...cells(total)]],
            [40, 12, 16, 16, 16],
            1,
        ));
    }
    return out;
}
