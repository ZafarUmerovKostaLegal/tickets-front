import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Packer,
    type ParagraphChild,
    Paragraph,
    ShadingType,
    Table,
    TableBorders,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlignTable,
    WidthType,
} from 'docx';
import { KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import {
    INVOICE_PAYMENT_DISCLAIMER,
    TIME_REPORT_DETAIL_ROWS,
    TIME_REPORT_SUMMARY_ROWS,
    type InvoicePreviewPackInput,
    packCaseDetailLine,
    packCurrencyCode,
    packFirmBankingLines,
    packInvoiceNumberDisplay,
    packResolveDueIso,
    packResolveIssueIso,
    packUppercaseRibbonDate,
    packZeroCommaAmount,
} from './invoicePreviewPackShared';
import type { InvoiceTimeReportPack } from './invoiceTimeReportModel';
import { rasterizeInvoiceCoverLogoSvg } from './invoiceCoverLogoRaster';
import { resolveInvoiceTimeReportPack } from './resolveInvoiceTimeReportPack';

const cellBorderNil = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

/** pt → docx half-points */
function h(pt: number): number {
    return Math.round(pt * 2);
}

function contactParagraph(text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [new TextRun({ text, size: h(9), font: 'Calibri' })],
    });
}

function coverChildren(model: InvoiceCoverLetterModel, logoHeaderRuns: ParagraphChild[]): (Paragraph | Table)[] {
    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: cellBorderNil,
                        verticalAlign: VerticalAlignTable.TOP,
                        width: { size: 48, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({
                            alignment: AlignmentType.LEFT,
                            spacing: { after: 120 },
                            children: logoHeaderRuns.length
                                ? logoHeaderRuns
                                : [new TextRun({ text: '\u200b', size: h(13), font: 'Calibri' })],
                        })],
                    }),
                    new TableCell({
                        borders: cellBorderNil,
                        verticalAlign: VerticalAlignTable.TOP,
                        width: { size: 52, type: WidthType.PERCENTAGE },
                        children: [
                            contactParagraph(KOSTA_LEGAL_FIRM.addressLine),
                            contactParagraph(KOSTA_LEGAL_FIRM.phone),
                            contactParagraph(KOSTA_LEGAL_FIRM.email),
                            contactParagraph(KOSTA_LEGAL_FIRM.web),
                        ],
                    }),
                ],
            }),
        ],
    });

    const body: (Paragraph | Table)[] = [
        headerTable,
        new Paragraph({ spacing: { before: 280, after: 200 }, children: [new TextRun({ text: '', size: 2 })] }),
        new Paragraph({
            children: [new TextRun({ text: model.letterDateDisplay, size: h(10), font: 'Calibri' })],
        }),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: model.recipientCompany, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: model.recipientAddressLines[0], size: h(10), font: 'Calibri' })] }),
    ];

    if (model.recipientAddressLines[1]) {
        body.push(new Paragraph({
            children: [new TextRun({ text: model.recipientAddressLines[1], size: h(10), font: 'Calibri' })],
        }));
    }

    body.push(
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `Attention: ${model.attentionName}`, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: model.attentionTitle, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `Dear ${model.attentionName},`, size: h(10), font: 'Calibri' })] }),
        new Paragraph({
            spacing: { before: 160 },
            children: [new TextRun({
                text: `It is our pleasure to provide legal assistance to «${model.quotedCompanyName}» in connection with its activities in Uzbekistan.`,
                size: h(10),
                font: 'Calibri',
            })],
        }),
        new Paragraph({
            spacing: { before: 160 },
            children: [
                new TextRun({ text: 'Herewith, we are sending the report ', size: h(10), font: 'Calibri' }),
                new TextRun({ text: 'or/and ', bold: true, size: h(10), font: 'Calibri' }),
                new TextRun({ text: 'with the invoice on legal services rendered in ', size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({
            children: [
                new TextRun({ text: model.servicesMonthYear, bold: true, size: h(10), font: 'Calibri' }),
                new TextRun({ text: ' for the total amount of ', size: h(10), font: 'Calibri' }),
                new TextRun({ text: model.totalFormatted, bold: true, size: h(10), font: 'Calibri' }),
                new TextRun({ text: '.', size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: 'Kind regards,', size: h(10), font: 'Calibri' })] }),
        new Paragraph({ spacing: { before: 280 }, children: [new TextRun({ text: '_________________________', size: h(10), font: 'Calibri', color: '666666' })] }),
        new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: model.signatoryName, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: model.signatoryTitle, size: h(10), font: 'Calibri' })] }),
    );

    return body;
}

function mmToTwip(mm: number): number {
    return Math.round((mm * 72 / 25.4) * 20);
}

/** Поля секций: левый 30 мм, правый 12 мм (10–15), верх/низ 20 мм */
const PAGE_MARGIN_TWIPS = {
    top: mmToTwip(20),
    right: mmToTwip(12),
    bottom: mmToTwip(20),
    left: mmToTwip(30),
} as const;
const INV_RED = '9B1B30';

const cellBorderGrid = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
} as const;

function pctWidths(weights: readonly number[]): number[] {
    const s = weights.reduce((a, b) => a + b, 0);
    const floored = weights.map((w) => Math.floor((100 * w) / s));
    const diff = 100 - floored.reduce((a, b) => a + b, 0);
    floored[floored.length - 1] = (floored[floored.length - 1] ?? 1) + diff;
    return floored;
}

function trHeadCell(txt: string, pct: number): TableCell {
    return new TableCell({
        borders: cellBorderGrid,
        width: { size: pct, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, fill: INV_RED, color: INV_RED },
        verticalAlign: VerticalAlignTable.CENTER,
        children: [new Paragraph({
            children: [new TextRun({ text: txt, bold: true, color: 'FFFFFF', size: h(8), font: 'Calibri' })],
        })],
    });
}

type DocParaAlign = (typeof AlignmentType)[keyof typeof AlignmentType];

function trBodyTextCell(txt: string, pct: number, align: DocParaAlign): TableCell {
    const t = txt.trim();
    return new TableCell({
        borders: cellBorderGrid,
        width: { size: pct, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlignTable.TOP,
        children: [new Paragraph({
            alignment: align,
            spacing: {},
            children: [
                new TextRun({ text: t.length ? t : '\u00a0', size: h(9), font: 'Calibri', color: '475569' }),
            ],
        })],
    });
}

function trFootValueCell(txt: string, pct: number, align: DocParaAlign): TableCell {
    const t = txt.trim();
    return new TableCell({
        borders: cellBorderGrid,
        width: { size: pct, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlignTable.CENTER,
        children: [new Paragraph({
            alignment: align,
            children: [
                new TextRun({ text: t.length ? t : '\u00a0', bold: true, color: INV_RED, size: h(9), font: 'Calibri' }),
            ],
        })],
    });
}

/** Лист time report (соответствует превью: две таблицы + номер страницы). */
function timeReportDocxBlocks(model: InvoiceCoverLetterModel, pack: InvoiceTimeReportPack): (Paragraph | Table)[] {
    const cur = packCurrencyCode(model);
    const amountHdr = cur === 'EUR' ? 'Amount (EUR)' : `Amount (${cur})`;
    const DW = pctWidths([11, 9, 14, 36, 10, 12]);
    const SW = pctWidths([9, 26, 26, 13, 13, 13]);

    const detailHeader = new TableRow({
        children: [
            trHeadCell('Date', DW[0] ?? 11),
            trHeadCell('Initials', DW[1] ?? 9),
            trHeadCell('Task', DW[2] ?? 14),
            trHeadCell('Description', DW[3] ?? 36),
            trHeadCell('Hours', DW[4] ?? 10),
            trHeadCell(amountHdr, DW[5] ?? 12),
        ],
    });
    const detailBodyRows: TableRow[] = [];
    for (let i = 0; i < TIME_REPORT_DETAIL_ROWS; i++) {
        const r = pack.detailSlots[i]!;
        detailBodyRows.push(new TableRow({
            children: [
                trBodyTextCell(r.date, DW[0]!, AlignmentType.LEFT),
                trBodyTextCell(r.initials, DW[1]!, AlignmentType.LEFT),
                trBodyTextCell(r.task, DW[2]!, AlignmentType.LEFT),
                trBodyTextCell(r.description, DW[3]!, AlignmentType.LEFT),
                trBodyTextCell(r.hours, DW[4]!, AlignmentType.RIGHT),
                trBodyTextCell(r.amount, DW[5]!, AlignmentType.RIGHT),
            ],
        }));
    }
    detailBodyRows.push(new TableRow({
        children: [
            new TableCell({
                borders: cellBorderGrid,
                columnSpan: 4,
                children: [new Paragraph({
                    children: [new TextRun({ text: 'Total', bold: true, color: INV_RED, size: h(8), font: 'Calibri' })],
                })],
            }),
            trFootValueCell(pack.detailTotalHoursDisplay, DW[4]!, AlignmentType.RIGHT),
            trFootValueCell(pack.detailTotalAmountDisplay, DW[5]!, AlignmentType.RIGHT),
        ],
    }));

    const summaryHeader = new TableRow({
        children: [
            trHeadCell('Initials', SW[0] ?? 9),
            trHeadCell('Name', SW[1] ?? 26),
            trHeadCell('Title', SW[2] ?? 26),
            trHeadCell('Hours', SW[3] ?? 13),
            trHeadCell('Hourly rate', SW[4] ?? 13),
            trHeadCell(`Total price (${cur})`, SW[5] ?? 13),
        ],
    });
    const summaryBodyRows: TableRow[] = [];
    for (let i = 0; i < TIME_REPORT_SUMMARY_ROWS; i++) {
        const r = pack.summarySlots[i]!;
        summaryBodyRows.push(new TableRow({
            children: [
                trBodyTextCell(r.initials, SW[0]!, AlignmentType.LEFT),
                trBodyTextCell(r.name, SW[1]!, AlignmentType.LEFT),
                trBodyTextCell(r.title, SW[2]!, AlignmentType.LEFT),
                trBodyTextCell(r.hours, SW[3]!, AlignmentType.RIGHT),
                trBodyTextCell(r.hourlyRate, SW[4]!, AlignmentType.RIGHT),
                trBodyTextCell(r.totalPrice, SW[5]!, AlignmentType.RIGHT),
            ],
        }));
    }

    const sumGrandAmt = pack.summaryGrandAmountDisplay.trim().length ? pack.summaryGrandAmountDisplay : cur;

    summaryBodyRows.push(new TableRow({
        children: [
            new TableCell({
                borders: cellBorderGrid,
                columnSpan: 3,
                children: [new Paragraph({
                    children: [new TextRun({ text: 'Total', bold: true, color: INV_RED, size: h(8), font: 'Calibri' })],
                })],
            }),
            trFootValueCell(pack.summaryGrandHoursDisplay, SW[3]!, AlignmentType.RIGHT),
            trFootValueCell('—', SW[4]!, AlignmentType.RIGHT),
            trFootValueCell(sumGrandAmt, SW[5]!, AlignmentType.RIGHT),
        ],
    }));

    const tableOpts = {
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        margins: { top: 40, bottom: 40 },
    };

    const detailTbl = new Table({
        ...tableOpts,
        rows: [detailHeader, ...detailBodyRows],
    });
    const sumTbl = new Table({
        ...tableOpts,
        rows: [summaryHeader, ...summaryBodyRows],
    });

    const confidentialRow = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: TableBorders.NONE,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: cellBorderNil,
                        width: { size: 74, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({ children: [new TextRun({ text: '\u200b', size: h(2), font: 'Calibri' })] })],
                    }),
                    new TableCell({
                        borders: cellBorderNil,
                        width: { size: 26, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.SOLID, fill: INV_RED, color: INV_RED },
                        margins: { top: 52, bottom: 52, left: 90, right: 90 },
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({
                                text: 'Private and confidential',
                                bold: true,
                                color: 'FFFFFF',
                                size: h(8),
                                font: 'Calibri',
                            })],
                        })],
                    }),
                ],
            }),
        ],
    });

    return [
        confidentialRow,
        new Paragraph({
            spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, color: INV_RED, size: 10, space: 1 } },
            children: [new TextRun({ text: '\u200b', size: h(10), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({
                text: `TIME REPORT FOR SERVICES PROVIDED IN ${model.servicesMonthYear.toUpperCase()}`,
                bold: true,
                size: h(13),
                font: 'Calibri',
                color: INV_RED,
            })],
        }),
        detailTbl,
        new Paragraph({
            spacing: { before: 260, after: 120 },
            children: [new TextRun({ text: 'Summary of services', bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
        }),
        sumTbl,
        new Paragraph({
            spacing: { before: 360 },
            border: { top: { style: BorderStyle.SINGLE, color: INV_RED, size: 12, space: 2 } },
            children: [new TextRun({ text: '\u200b', size: h(10), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { before: 60 },
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: '2', bold: true, color: INV_RED, size: h(12), font: 'Calibri' })],
        }),
    ];
}

function invoiceRibbonTable(leftText: string, rightText: string): Table {
    const redCell = (widthPct: number, align: (typeof AlignmentType)[keyof typeof AlignmentType], text: string): TableCell =>
        new TableCell({
            borders: cellBorderNil,
            width: { size: widthPct, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, fill: INV_RED, color: INV_RED },
            margins: { top: 72, bottom: 72, left: 112, right: 112 },
            children: [new Paragraph({
                alignment: align,
                children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: h(11), font: 'Calibri' })],
            })],
        });
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: TableBorders.NONE,
        rows: [
            new TableRow({
                children: [
                    redCell(53, AlignmentType.LEFT, leftText),
                    redCell(47, AlignmentType.RIGHT, rightText),
                ],
            }),
        ],
    });
}
/** Лист legal invoice — структура как в InvoiceLegalInvoicePage. */
function legalInvoiceDocxBlocks(
    model: InvoiceCoverLetterModel,
    session: InvoicePreviewSessionV1 | null,
    logoRuns: ParagraphChild[],
): (Paragraph | Table)[] {
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const ribbonIssue = packUppercaseRibbonDate(issueIso);
    const dueBanner = packUppercaseRibbonDate(dueIso);
    const invNo = packInvoiceNumberDisplay(session);
    const caseLine = packCaseDetailLine(session);
    const cur = packCurrencyCode(model);
    const zeroLine = packZeroCommaAmount(model);
    const svcLine = `Legal services rendered in ${model.servicesMonthYear}`;

    const firmParas = [
        new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: `${KOSTA_LEGAL_FIRM.brandName} LF`, bold: true, color: INV_RED, size: h(12), font: 'Calibri' })],
        }),
        ...[KOSTA_LEGAL_FIRM.addressLine, ...packFirmBankingLines(cur)].map((txt) =>
            new Paragraph({
                spacing: { after: 35 },
                children: [new TextRun({ text: txt, color: '100814', size: h(9), font: 'Calibri' })],
            })),
    ];

    const masthead = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TableBorders.NONE,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: cellBorderNil,
                        width: { size: 55, type: WidthType.PERCENTAGE },
                        children: firmParas,
                    }),
                    new TableCell({
                        borders: cellBorderNil,
                        verticalAlign: VerticalAlignTable.TOP,
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: logoRuns.length ? logoRuns : [new TextRun({ text: '\u200b', size: h(13), font: 'Calibri' })],
                        })],
                    }),
                ],
            }),
        ],
    });

    const ribbon = invoiceRibbonTable(`INVOICE No. ${invNo}`, ribbonIssue);

    /** Bill to + Case panels */
    const billChildren: Paragraph[] = [
        new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: 'Bill to', bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: model.recipientCompany, bold: true, size: h(11), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: 'Address:', color: '707784', size: h(9), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: model.recipientAddressLines[0], size: h(9), font: 'Calibri' })],
        }),
    ];
    if (model.recipientAddressLines[1]) {
        billChildren.push(new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: model.recipientAddressLines[1], size: h(9), font: 'Calibri' })],
        }));
    }
    billChildren.push(
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: 'Bank name:', color: '707784', size: h(9), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: '—', color: '707784', size: h(9), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: 'SWIFT:', color: '707784', size: h(9), font: 'Calibri' })],
        }),
        new Paragraph({
            children: [new TextRun({ text: '—', color: '707784', size: h(9), font: 'Calibri' })],
        }),
    );

    const caseChildren: Paragraph[] = [
        new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: 'Case details', bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
        }),
        new Paragraph({
            children: [new TextRun({ text: caseLine, size: h(10), font: 'Calibri' })],
        }),
    ];

    const panels = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TableBorders.NONE,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: cellBorderNil,
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: billChildren,
                    }),
                    new TableCell({
                        borders: cellBorderNil,
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: caseChildren,
                    }),
                ],
            }),
        ],
    });

    const svcHead = new TableRow({
        children: [
            trHeadCell('Description', 72),
            trHeadCell(`Total (${cur})`, 28),
        ],
    });
    const svcBody = new TableRow({
        children: [
            new TableCell({
                borders: cellBorderGrid,
                width: { size: 72, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    children: [new TextRun({ text: svcLine, size: h(10), font: 'Calibri' })],
                })],
            }),
            new TableCell({
                borders: cellBorderGrid,
                width: { size: 28, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlignTable.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: model.totalFormatted, bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
                })],
            }),
        ],
    });
    const svcTbl = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [svcHead, svcBody],
    });

    const totals: Paragraph[] = [
        new Paragraph({
            spacing: { before: 200 },
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({ text: 'SUBTOTAL: ', bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
                new TextRun({ text: model.totalFormatted, bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({ text: 'VAT: ', bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
                new TextRun({ text: zeroLine, color: INV_RED, size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({ text: 'Extra expenses: ', bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
                new TextRun({ text: zeroLine, color: INV_RED, size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            children: [
                new TextRun({ text: `TOTAL DUE BY ${dueBanner}: `, bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
                new TextRun({ text: model.totalFormatted, bold: true, color: INV_RED, size: h(12), font: 'Calibri' }),
            ],
        }),
    ];

    return [
        masthead,
        new Paragraph({
            spacing: { before: 200, after: 120 },
            children: [new TextRun({ text: '\u200b', size: h(8), font: 'Calibri' })],
        }),
        ribbon,
        new Paragraph({
            spacing: { before: 200, after: 120 },
            children: [new TextRun({ text: '\u200b', size: h(8), font: 'Calibri' })],
        }),
        panels,
        new Paragraph({
            spacing: { before: 220, after: 120 },
            children: [new TextRun({ text: '\u200b', size: h(8), font: 'Calibri' })],
        }),
        svcTbl,
        ...totals,
        new Paragraph({
            spacing: { before: 160 },
            children: [new TextRun({ text: 'Thank you for your business!', bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: INVOICE_PAYMENT_DISCLAIMER, size: h(8), font: 'Calibri', color: '404040' })],
        }),
    ];
}

/** Три страницы: письмо; time report; invoice. */
export async function buildInvoicePreviewDocxBlob({ model, session }: InvoicePreviewPackInput): Promise<Blob> {
    const logoRuns: ParagraphChild[] = [];
    if (typeof window !== 'undefined') {
        const raster = await rasterizeInvoiceCoverLogoSvg(420);
        if (raster?.png.length && raster.widthPx > 0) {
            const tw = 200;
            const th = Math.max(1, Math.round((raster.heightPx / raster.widthPx) * tw));
            logoRuns.push(new ImageRun({
                type: 'png',
                data: raster.png,
                transformation: { width: tw, height: th },
            }));
        }
    }

    const timeReportPack = await resolveInvoiceTimeReportPack(session, model);

    const sectionPage = {
        properties: {
            page: {
                margin: PAGE_MARGIN_TWIPS,
            },
        },
    };

    const doc = new Document({
        sections: [
            {
                ...sectionPage,
                children: coverChildren(model, logoRuns),
            },
            {
                ...sectionPage,
                children: timeReportDocxBlocks(model, timeReportPack),
            },
            {
                ...sectionPage,
                children: legalInvoiceDocxBlocks(model, session, logoRuns),
            },
        ],
    });
    return Packer.toBlob(doc);
}
