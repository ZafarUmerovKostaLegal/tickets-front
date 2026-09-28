import {
    AlignmentType,
    BorderStyle,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { KOSTA_LEGAL_FIRM } from './invoiceCoverLetterModel';
import type { CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';

const FONT = 'Calibri Light';
const SIZE = 16;

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

const borders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D8' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D8' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
} as const;

function cell(text: string, width: number, bold = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
            alignment: align,
            children: [new TextRun({ text: text || ' ', bold, size: SIZE, font: FONT, color: '18181B' })],
        })],
    });
}

function table(headers: string[], rows: string[][], widths: number[], rightFrom: number): Table {
    const head = new TableRow({
        children: headers.map((header, i) => cell(header, widths[i] ?? 10, true, i >= rightFrom ? AlignmentType.RIGHT : AlignmentType.LEFT)),
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
    const out: (Paragraph | Table)[] = [
        new Paragraph({
            children: [new TextRun({ text: KOSTA_LEGAL_FIRM.brandName, bold: true, size: 28, font: FONT })],
        }),
        new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({
                text: [KOSTA_LEGAL_FIRM.addressLine, KOSTA_LEGAL_FIRM.phone, KOSTA_LEGAL_FIRM.email, KOSTA_LEGAL_FIRM.web].join(' · '),
                size: 14,
                font: FONT,
                color: '4B5563',
            })],
        }),
        new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: snapshot.feeTitle.toUpperCase(), bold: true, size: 16, font: FONT })],
        }),
    ];
    for (const project of snapshot.projects) {
        const hours = project.lines.reduce((sum, line) => sum + line.hours, 0);
        const amount = project.lines.reduce((sum, line) => sum + line.amount, 0);
        out.push(heading(`Sub-project name: ${project.name}`));
        out.push(table(
            ['Date', 'User', 'Description', 'Hours', `Amount (${cur})`],
            [
                ...project.lines.map((line) => [dateRu(line.date), line.user, line.description, line.hours.toFixed(2), money(line.amount)]),
                ['Total', '', '', hours.toFixed(2), money(amount)],
            ],
            [14, 18, 40, 10, 18],
            3,
        ));
    }
    out.push(heading('Summary of Services'));
    out.push(table(
        ['Initials', 'Name', 'Title', 'Rate', 'Hours', `Rate (${cur})`, 'Amount'],
        [
            ...snapshot.people.map((person) => [person.initials, person.name, person.title, money(person.rate), person.hours.toFixed(2), money(person.rate), money(person.amount)]),
            ['Total', '', '', '', snapshot.totalHours.toFixed(2), '', money(snapshot.totalFees)],
        ],
        [8, 18, 16, 14, 10, 16, 18],
        3,
    ));
    out.push(heading('Reimbursable Expenses via'));
    out.push(table(
        ['Description', 'Email date', `Amount (${cur})`],
        [
            ...snapshot.expenses.map((line) => [line.description, dateRu(line.date), money(line.amount)]),
            ['Subtotal', '', money(snapshot.totalExpenses)],
        ],
        [52, 18, 30],
        2,
    ));
    out.push(heading(cur));
    out.push(table(
        ['Shared amounts', 'Reimbursable expenses', 'TO BE INVOICED'],
        [
            ...snapshot.shares.map((share) => [`${share.name}  ${share.percent.toFixed(2)}%`, money(share.total), money(share.total)]),
            ['100%', money(invoiced), money(invoiced)],
        ],
        [44, 28, 28],
        1,
    ));
    return out;
}
