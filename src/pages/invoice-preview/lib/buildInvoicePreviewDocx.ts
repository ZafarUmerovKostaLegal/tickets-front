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
import {
    KOSTA_LEGAL_FIRM,
    getCoverLetterLabels,
    resolveCoverIntroParagraph,
    resolveCoverInvoiceParagraph,
    type InvoiceCoverLetterModel,
} from './invoiceCoverLetterModel';
import {
    type InvoicePreviewPackInput,
    packCurrencyCode,
    packInvoiceNumberDisplay,
    packResolveDueIso,
    packResolveIssueIso,
    packUppercaseRibbonDate,
    packZeroCommaAmount,
} from './invoicePreviewPackShared';
import type { InvoiceTimeReportDetailRow, InvoiceTimeReportPack } from './invoiceTimeReportModel';
import { splitDetailRowsForPagedTimeReport } from './invoiceTimeReportChunking';
import { rasterizeInvoiceCoverLogoSvg } from './invoiceCoverLogoRaster';
import { resolveInvoiceTimeReportPack } from './resolveInvoiceTimeReportPack';
import { getTimeReportLabels } from './invoiceTimeReportI18n';
import { getLegalInvoiceLabels } from './invoiceLegalPageI18n';
import {
    invoicePreviewPageCount,
    resolveLegalBillToBankName,
    resolveLegalBillToSwift,
    resolveLegalCaseDetailLine,
    resolveLegalFirmBankingLines,
    resolveLegalOverrideText,
    resolveLegalPaymentDisclaimer,
    resolveLegalServiceDescriptionLine,
    type InvoiceLegalPageOverrides,
} from './invoiceLegalPageModel';

const cellBorderNil = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

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
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: model.recipientCompany, bold: true, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: model.recipientAddressLines[0], size: h(10), font: 'Calibri' })] }),
    ];

    if (model.recipientAddressLines[1]) {
        body.push(new Paragraph({
            children: [new TextRun({ text: model.recipientAddressLines[1], size: h(10), font: 'Calibri' })],
        }));
    }

    const labels = getCoverLetterLabels(model.coverLanguage);

    body.push(
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${labels.attention}: ${model.attentionName}`, bold: true, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: model.attentionTitle, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${labels.dear} ${model.attentionName},`, size: h(10), font: 'Calibri' })] }),
        new Paragraph({
            spacing: { before: 160 },
            children: [new TextRun({
                text: resolveCoverIntroParagraph(model),
                size: h(10),
                font: 'Calibri',
            })],
        }),
        new Paragraph({
            spacing: { before: 160 },
            children: [new TextRun({
                text: resolveCoverInvoiceParagraph(model),
                size: h(10),
                font: 'Calibri',
            })],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: labels.closing, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ spacing: { before: 280 }, children: [new TextRun({ text: '_________________________', size: h(10), font: 'Calibri', color: '666666' })] }),
        new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: model.signatoryName, size: h(10), font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: model.signatoryTitle, size: h(10), font: 'Calibri' })] }),
    );

    return body;
}

function mmToTwip(mm: number): number {
    return Math.round((mm * 72 / 25.4) * 20);
}

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

type TimeReportDocxChunkOpts = {
    continuation: boolean;
    pageNumStr: string;
    isLastChunk: boolean;
};

function timeReportDocxSectionChildren(
    model: InvoiceCoverLetterModel,
    pack: InvoiceTimeReportPack,
    detailChunk: readonly InvoiceTimeReportDetailRow[],
    opts: TimeReportDocxChunkOpts,
): (Paragraph | Table)[] {
    const cur = packCurrencyCode(model);
    const labels = getTimeReportLabels(model.coverLanguage);
    const amountHdr = labels.amount(cur);
    const DW = pctWidths([11, 8, 11, 28, 11, 16]);
    const SW = pctWidths([9, 26, 26, 13, 13, 13]);

    const detailHeader = new TableRow({
        children: [
            trHeadCell(labels.date, DW[0] ?? 11),
            trHeadCell(labels.initials, DW[1] ?? 8),
            trHeadCell(labels.task, DW[2] ?? 11),
            trHeadCell(labels.description, DW[3] ?? 28),
            trHeadCell(labels.hours, DW[4] ?? 11),
            trHeadCell(amountHdr, DW[5] ?? 16),
        ],
    });
    const detailBodyRows: TableRow[] = detailChunk.map((r) => new TableRow({
        children: [
            trBodyTextCell(r.date, DW[0]!, AlignmentType.LEFT),
            trBodyTextCell(r.initials, DW[1]!, AlignmentType.LEFT),
            trBodyTextCell(r.task, DW[2]!, AlignmentType.LEFT),
            trBodyTextCell(r.description, DW[3]!, AlignmentType.LEFT),
            trBodyTextCell(r.hours, DW[4]!, AlignmentType.RIGHT),
            trBodyTextCell(r.amount, DW[5]!, AlignmentType.RIGHT),
        ],
    }));

    if (opts.isLastChunk) {
        detailBodyRows.push(new TableRow({
            children: [
                new TableCell({
                    borders: cellBorderGrid,
                    columnSpan: 4,
                    children: [new Paragraph({
                        children: [new TextRun({ text: labels.total, bold: true, color: INV_RED, size: h(8), font: 'Calibri' })],
                    })],
                }),
                trFootValueCell(pack.detailTotalHoursDisplay, DW[4]!, AlignmentType.RIGHT),
                trFootValueCell(pack.detailTotalAmountDisplay, DW[5]!, AlignmentType.RIGHT),
            ],
        }));
    }

    const tableOpts = {
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        margins: { top: 40, bottom: 40 },
    };

    const detailTbl = new Table({
        ...tableOpts,
        rows: [detailHeader, ...detailBodyRows],
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
                                text: labels.confidential,
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

    const titleText = opts.continuation
        ? labels.titleContinued(model.servicesMonthYear)
        : labels.title(model.servicesMonthYear);

    const out: (Paragraph | Table)[] = [
        confidentialRow,
        new Paragraph({
            spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, color: INV_RED, size: 10, space: 1 } },
            children: [new TextRun({ text: '\u200b', size: h(10), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({
                text: titleText,
                bold: true,
                size: h(13),
                font: 'Calibri',
                color: INV_RED,
            })],
        }),
        detailTbl,
    ];

    if (opts.isLastChunk) {
        const summaryHeader = new TableRow({
            children: [
                trHeadCell(labels.initials, SW[0] ?? 9),
                trHeadCell(labels.name, SW[1] ?? 26),
                trHeadCell(labels.titleCol, SW[2] ?? 26),
                trHeadCell(labels.hours, SW[3] ?? 13),
                trHeadCell(labels.hourlyRate, SW[4] ?? 13),
                trHeadCell(labels.totalPrice(cur), SW[5] ?? 13),
            ],
        });
        const summaryDataRows: TableRow[] = pack.summarySlots.map((r) => new TableRow({
            children: [
                trBodyTextCell(r.initials, SW[0]!, AlignmentType.LEFT),
                trBodyTextCell(r.name, SW[1]!, AlignmentType.LEFT),
                trBodyTextCell(r.title, SW[2]!, AlignmentType.LEFT),
                trBodyTextCell(r.hours, SW[3]!, AlignmentType.RIGHT),
                trBodyTextCell(r.hourlyRate, SW[4]!, AlignmentType.RIGHT),
                trBodyTextCell(r.totalPrice, SW[5]!, AlignmentType.RIGHT),
            ],
        }));

        const sumGrandAmt = pack.summaryGrandAmountDisplay.trim().length ? pack.summaryGrandAmountDisplay : cur;

        summaryDataRows.push(new TableRow({
            children: [
                new TableCell({
                    borders: cellBorderGrid,
                    columnSpan: 3,
                    children: [new Paragraph({
                        children: [new TextRun({ text: labels.total, bold: true, color: INV_RED, size: h(8), font: 'Calibri' })],
                    })],
                }),
                trFootValueCell(pack.summaryGrandHoursDisplay, SW[3]!, AlignmentType.RIGHT),
                trFootValueCell('—', SW[4]!, AlignmentType.RIGHT),
                trFootValueCell(sumGrandAmt, SW[5]!, AlignmentType.RIGHT),
            ],
        }));

        const sumTbl = new Table({
            ...tableOpts,
            rows: [summaryHeader, ...summaryDataRows],
        });

        out.push(
            new Paragraph({
                spacing: { before: 260, after: 120 },
                children: [new TextRun({ text: labels.summaryTitle, bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
            }),
            sumTbl,
        );
    }

    out.push(
        new Paragraph({
            spacing: { before: 360 },
            border: { top: { style: BorderStyle.SINGLE, color: INV_RED, size: 12, space: 2 } },
            children: [new TextRun({ text: '\u200b', size: h(10), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { before: 60 },
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: opts.pageNumStr, bold: true, color: INV_RED, size: h(12), font: 'Calibri' })],
        }),
    );

    return out;
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

function legalInvoiceDocxBlocks(
    model: InvoiceCoverLetterModel,
    session: InvoicePreviewSessionV1 | null,
    logoRuns: ParagraphChild[],
    legalOverrides?: InvoiceLegalPageOverrides,
): (Paragraph | Table)[] {
    const labels = getLegalInvoiceLabels(model.coverLanguage);
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const zeroFallback = packZeroCommaAmount(model);
    const ribbonIssue = resolveLegalOverrideText(
        legalOverrides?.issueDateDisplay,
        packUppercaseRibbonDate(issueIso, model.coverLanguage),
    );
    const dueBanner = resolveLegalOverrideText(
        legalOverrides?.dueDateDisplay,
        packUppercaseRibbonDate(dueIso, model.coverLanguage),
    );
    const invNo = resolveLegalOverrideText(legalOverrides?.invoiceNumber, packInvoiceNumberDisplay(session));
    const vatAmount = resolveLegalOverrideText(legalOverrides?.vatAmount, zeroFallback);
    const extraExpensesAmount = resolveLegalOverrideText(legalOverrides?.extraExpensesAmount, zeroFallback);
    const firmAddress = resolveLegalOverrideText(legalOverrides?.firmAddress, KOSTA_LEGAL_FIRM.addressLine);
    const caseLine = resolveLegalCaseDetailLine(session, legalOverrides, model.coverLanguage);
    const cur = packCurrencyCode(model);
    const svcLine = resolveLegalServiceDescriptionLine(model, legalOverrides);
    const paymentDisclaimer = resolveLegalPaymentDisclaimer(legalOverrides, model.coverLanguage);

    const firmParas = [
        new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: `${KOSTA_LEGAL_FIRM.brandName} LF`, bold: true, color: INV_RED, size: h(12), font: 'Calibri' })],
        }),
        ...[firmAddress, ...resolveLegalFirmBankingLines(cur, legalOverrides, model.coverLanguage)].map((txt) =>
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

    const ribbon = invoiceRibbonTable(labels.invoiceNo(invNo), ribbonIssue);

    const billChildren: Paragraph[] = [
        new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: labels.billTo, bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: model.recipientCompany, bold: true, size: h(11), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: `${labels.address}:`, color: '707784', size: h(9), font: 'Calibri' })],
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
            children: [new TextRun({ text: `${labels.bankName}:`, color: '707784', size: h(9), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: resolveLegalBillToBankName(legalOverrides), color: '707784', size: h(9), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: `${labels.swift}:`, color: '707784', size: h(9), font: 'Calibri' })],
        }),
        new Paragraph({
            children: [new TextRun({ text: resolveLegalBillToSwift(legalOverrides), color: '707784', size: h(9), font: 'Calibri' })],
        }),
    );

    const caseChildren: Paragraph[] = [
        new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: labels.caseDetails, bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
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
            trHeadCell(labels.description, 72),
            trHeadCell(labels.total(cur), 28),
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
                new TextRun({ text: `${labels.subtotal} `, bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
                new TextRun({ text: model.totalFormatted, bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({ text: `${labels.vat} `, bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
                new TextRun({ text: vatAmount, color: INV_RED, size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({ text: `${labels.extraExpenses} `, bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
                new TextRun({ text: extraExpensesAmount, color: INV_RED, size: h(10), font: 'Calibri' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            children: [
                new TextRun({ text: `${labels.totalDueBy(dueBanner)} `, bold: true, color: INV_RED, size: h(10), font: 'Calibri' }),
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
            children: [new TextRun({ text: labels.thanks, bold: true, color: INV_RED, size: h(11), font: 'Calibri' })],
        }),
        new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: paymentDisclaimer, size: h(8), font: 'Calibri', color: '404040' })],
        }),
    ];
}

export async function buildInvoicePreviewDocxBlob(input: InvoicePreviewPackInput): Promise<Blob> {
    const { model, session, timeReportPack: timeReportOverride, legalOverrides, selectedPageNumbers } = input;
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

    const timeReportPack = timeReportOverride ?? await resolveInvoiceTimeReportPack(session, model);
    const trChunks = splitDetailRowsForPagedTimeReport(timeReportPack.detailSlots);
    const pageCount = invoicePreviewPageCount(trChunks.length);
    const selected = selectedPageNumbers?.length ? new Set(selectedPageNumbers) : null;
    const includePage = (n: number) => !selected || selected.has(n);

    const sectionPage = {
        properties: {
            page: {
                margin: PAGE_MARGIN_TWIPS,
            },
        },
    };

    const sections: { properties: typeof sectionPage.properties; children: (Paragraph | Table)[] }[] = [];

    if (includePage(1)) {
        sections.push({
            ...sectionPage,
            children: coverChildren(model, logoRuns),
        });
    }

    trChunks.forEach((chunk, i) => {
        const pageNum = 2 + i;
        if (!includePage(pageNum))
            return;
        sections.push({
            ...sectionPage,
            children: timeReportDocxSectionChildren(model, timeReportPack, chunk, {
                continuation: i > 0,
                pageNumStr: String(pageNum),
                isLastChunk: i === trChunks.length - 1,
            }),
        });
    });

    if (includePage(pageCount)) {
        sections.push({
            ...sectionPage,
            children: legalInvoiceDocxBlocks(model, session, logoRuns, legalOverrides),
        });
    }

    const doc = new Document({ sections });
    return Packer.toBlob(doc);
}
