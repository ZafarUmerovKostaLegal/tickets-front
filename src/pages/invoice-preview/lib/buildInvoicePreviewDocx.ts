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
import { trimTrailingEmptyDetailSlots, type InvoiceTimeReportDetailRow, type InvoiceTimeReportPack } from './invoiceTimeReportModel';
import { splitDetailRowsForPagedTimeReport } from './invoiceTimeReportChunking';
import { rasterizeInvoiceLogoSvg } from './invoiceCoverLogoRaster';
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

/** Document-wide Word typography: Calibri Light 11 pt. */
const DOC_FONT = 'Calibri Light';
const DOC_SIZE = h(11);

function contactParagraph(text: string, spacingAfter = 20): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: spacingAfter },
        children: [new TextRun({
            text,
            font: 'Gotham Pro',
            size: 16,
            color: '64748B',
        })],
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
                                : [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
                        })],
                    }),
                    new TableCell({
                        borders: cellBorderNil,
                        verticalAlign: VerticalAlignTable.TOP,
                        width: { size: 52, type: WidthType.PERCENTAGE },
                        children: [
                            contactParagraph(KOSTA_LEGAL_FIRM.addressLine),
                            contactParagraph(KOSTA_LEGAL_FIRM.phone, 100),
                            contactParagraph(KOSTA_LEGAL_FIRM.email),
                            contactParagraph(KOSTA_LEGAL_FIRM.web, 0),
                        ],
                    }),
                ],
            }),
        ],
    });

    const body: (Paragraph | Table)[] = [
        headerTable,
        new Paragraph({ spacing: { before: 260, after: 80 }, children: [new TextRun({ text: '', size: 2 })] }),
        new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: model.letterDateDisplay, size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: model.recipientCompany, bold: true, size: DOC_SIZE, font: DOC_FONT })] }),
        new Paragraph({ children: [new TextRun({ text: model.recipientAddressLines[0], size: DOC_SIZE, font: DOC_FONT })] }),
    ];

    if (model.recipientAddressLines[1]) {
        body.push(new Paragraph({
            children: [new TextRun({ text: model.recipientAddressLines[1], size: DOC_SIZE, font: DOC_FONT })],
        }));
    }

    const labels = getCoverLetterLabels(model.coverLanguage);

    body.push(
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${labels.attention}: ${model.attentionName}`, bold: true, size: DOC_SIZE, font: DOC_FONT })] }),
        new Paragraph({ children: [new TextRun({ text: model.attentionTitle, size: DOC_SIZE, font: DOC_FONT })] }),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${labels.dear} ${model.attentionName},`, size: DOC_SIZE, font: DOC_FONT })] }),
        new Paragraph({
            spacing: { before: 160 },
            children: [new TextRun({
                text: resolveCoverIntroParagraph(model),
                size: DOC_SIZE,
                font: DOC_FONT,
            })],
        }),
        new Paragraph({
            spacing: { before: 160 },
            children: [new TextRun({
                text: resolveCoverInvoiceParagraph(model),
                size: DOC_SIZE,
                font: DOC_FONT,
            })],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: labels.closing, size: DOC_SIZE, font: DOC_FONT })] }),
        new Paragraph({ spacing: { before: 280 }, children: [new TextRun({ text: '_________________________', size: DOC_SIZE, font: DOC_FONT, color: '666666' })] }),
        new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: model.signatoryName, size: DOC_SIZE, font: DOC_FONT })] }),
        new Paragraph({ children: [new TextRun({ text: model.signatoryTitle, size: DOC_SIZE, font: DOC_FONT })] }),
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
const INV_RED = 'E83337';

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
            children: [new TextRun({ text: txt, bold: true, color: 'FFFFFF', size: DOC_SIZE, font: DOC_FONT })],
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
                new TextRun({ text: t.length ? t : '\u00a0', size: DOC_SIZE, font: DOC_FONT, color: '475569' }),
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
                new TextRun({ text: t.length ? t : '\u00a0', bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT }),
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
    const DW = pctWidths([15, 9, 13, 18, 8, 18, 19]);
    const SW = pctWidths([9, 20, 18, 12, 18, 23]);

    const detailHeader = new TableRow({
        children: [
            trHeadCell(labels.date, DW[0] ?? 12),
            trHeadCell(labels.initials, DW[1] ?? 10),
            trHeadCell(labels.task, DW[2] ?? 11),
            trHeadCell(labels.description, DW[3] ?? 22),
            trHeadCell(labels.hours, DW[4] ?? 9),
            trHeadCell(labels.rate, DW[5] ?? 14),
            trHeadCell(amountHdr, DW[6] ?? 22),
        ],
    });
    const detailBodyRows: TableRow[] = detailChunk.map((r) => new TableRow({
        children: [
            trBodyTextCell(r.date, DW[0]!, AlignmentType.LEFT),
            trBodyTextCell(r.initials, DW[1]!, AlignmentType.LEFT),
            trBodyTextCell(r.task, DW[2]!, AlignmentType.LEFT),
            trBodyTextCell(r.description, DW[3]!, AlignmentType.LEFT),
            trBodyTextCell(r.hours, DW[4]!, AlignmentType.RIGHT),
            trBodyTextCell(r.hourlyRate, DW[5]!, AlignmentType.RIGHT),
            trBodyTextCell(r.amount, DW[6]!, AlignmentType.RIGHT),
        ],
    }));

    if (opts.isLastChunk) {
        detailBodyRows.push(new TableRow({
            children: [
                new TableCell({
                    borders: cellBorderGrid,
                    columnSpan: 4,
                    children: [new Paragraph({
                        children: [new TextRun({ text: labels.total, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
                    })],
                }),
                trFootValueCell(pack.detailTotalHoursDisplay, DW[4]!, AlignmentType.RIGHT),
                trFootValueCell('—', DW[5]!, AlignmentType.RIGHT),
                trFootValueCell(pack.detailTotalAmountDisplay, DW[6]!, AlignmentType.RIGHT),
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
                        children: [new Paragraph({ children: [new TextRun({ text: '\u200b', size: h(2), font: DOC_FONT })] })],
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
                                size: DOC_SIZE,
                                font: DOC_FONT,
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
            children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({
                text: titleText,
                bold: true,
                size: DOC_SIZE,
                font: DOC_FONT,
                color: INV_RED,
            })],
        }),
        detailTbl,
    ];

    if (opts.isLastChunk) {
        const expenseRows = trimTrailingEmptyDetailSlots(pack.expenseSlots);
        if (expenseRows.length > 0) {
            const EW = pctWidths([18, 52, 30]);
            const expenseHeader = new TableRow({
                children: [
                    trHeadCell(labels.date, EW[0] ?? 18),
                    trHeadCell(labels.description, EW[1] ?? 52),
                    trHeadCell(amountHdr, EW[2] ?? 30),
                ],
            });
            const expenseDataRows: TableRow[] = expenseRows.map((r) => new TableRow({
                children: [
                    trBodyTextCell(r.date, EW[0]!, AlignmentType.LEFT),
                    trBodyTextCell(r.description, EW[1]!, AlignmentType.LEFT),
                    trBodyTextCell(r.amount, EW[2]!, AlignmentType.RIGHT),
                ],
            }));
            expenseDataRows.push(new TableRow({
                children: [
                    new TableCell({
                        borders: cellBorderGrid,
                        columnSpan: 2,
                        children: [new Paragraph({
                            children: [new TextRun({ text: labels.total, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
                        })],
                    }),
                    trFootValueCell(pack.expenseTotalAmountDisplay, EW[2]!, AlignmentType.RIGHT),
                ],
            }));
            out.push(
                new Paragraph({
                    spacing: { before: 260, after: 120 },
                    children: [new TextRun({ text: labels.expensesTitle, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
                }),
                new Table({
                    ...tableOpts,
                    rows: [expenseHeader, ...expenseDataRows],
                }),
            );
        }

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
                        children: [new TextRun({ text: labels.total, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
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
                children: [new TextRun({ text: labels.summaryTitle, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
            }),
            sumTbl,
        );
    }

    out.push(
        new Paragraph({
            spacing: { before: 360 },
            border: { top: { style: BorderStyle.SINGLE, color: INV_RED, size: 12, space: 2 } },
            children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { before: 60 },
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: opts.pageNumStr, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
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
                children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: DOC_SIZE, font: DOC_FONT })],
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
            children: [new TextRun({ text: `${KOSTA_LEGAL_FIRM.brandName} LF`, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
        }),
        ...[firmAddress, ...resolveLegalFirmBankingLines(cur, legalOverrides, model.coverLanguage)].map((txt) =>
            new Paragraph({
                spacing: { after: 35 },
                children: [new TextRun({ text: txt, color: '100814', size: DOC_SIZE, font: DOC_FONT })],
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
                            children: logoRuns.length ? logoRuns : [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
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
            children: [new TextRun({ text: labels.billTo, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: model.recipientCompany, bold: true, size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: `${labels.address}:`, color: '707784', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: model.recipientAddressLines[0], size: DOC_SIZE, font: DOC_FONT })],
        }),
    ];
    if (model.recipientAddressLines[1]) {
        billChildren.push(new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: model.recipientAddressLines[1], size: DOC_SIZE, font: DOC_FONT })],
        }));
    }
    billChildren.push(
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: `${labels.bankName}:`, color: '707784', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: resolveLegalBillToBankName(legalOverrides), color: '707784', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: `${labels.swift}:`, color: '707784', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            children: [new TextRun({ text: resolveLegalBillToSwift(legalOverrides), color: '707784', size: DOC_SIZE, font: DOC_FONT })],
        }),
    );

    const caseChildren: Paragraph[] = [
        new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: labels.caseDetails, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            children: [new TextRun({ text: caseLine, size: DOC_SIZE, font: DOC_FONT })],
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
            new TableCell({
                borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                },
                width: { size: 72, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, fill: '1A1A1A', color: '1A1A1A' },
                verticalAlign: VerticalAlignTable.CENTER,
                children: [new Paragraph({
                    children: [new TextRun({ text: labels.description, bold: true, color: 'FFFFFF', size: DOC_SIZE, font: DOC_FONT })],
                })],
            }),
            new TableCell({
                borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                },
                width: { size: 28, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, fill: '1A1A1A', color: '1A1A1A' },
                verticalAlign: VerticalAlignTable.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: labels.total(cur), bold: true, color: 'FFFFFF', size: DOC_SIZE, font: DOC_FONT })],
                })],
            }),
        ],
    });
    const svcBodyBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: INV_RED, space: 1 },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    };
    const svcBody = new TableRow({
        children: [
            new TableCell({
                borders: svcBodyBorders,
                width: { size: 72, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlignTable.BOTTOM,
                children: [new Paragraph({
                    children: [new TextRun({ text: svcLine, size: DOC_SIZE, font: DOC_FONT, color: '334155' })],
                })],
            }),
            new TableCell({
                borders: svcBodyBorders,
                width: { size: 28, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlignTable.BOTTOM,
                children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: model.totalFormatted, bold: true, color: '1E293B', size: DOC_SIZE, font: DOC_FONT })],
                })],
            }),
        ],
    });
    const svcTbl = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [svcHead, svcBody],
    });

    type TotalsBorders = {
        top: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string; space?: number };
        bottom: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string; space?: number };
        left: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string; space?: number };
        right: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string; space?: number };
    };
    const totalsNil: TotalsBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    };
    const mkTotalRow = (label: string, value: string, due: boolean, borders: TotalsBorders) => new TableRow({
        children: [
            new TableCell({
                borders,
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    children: [new TextRun({
                        text: label,
                        bold: true,
                        color: due ? INV_RED : '1E293B',
                        size: DOC_SIZE,
                        font: DOC_FONT,
                    })],
                })],
            }),
            new TableCell({
                borders,
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({
                        text: value,
                        bold: true,
                        color: '1E293B',
                        size: DOC_SIZE,
                        font: DOC_FONT,
                    })],
                })],
            }),
        ],
    });
    const totalsTbl = new Table({
        width: { size: 52, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.RIGHT,
        rows: [
            mkTotalRow(labels.subtotal, model.totalFormatted, false, totalsNil),
            mkTotalRow(labels.vat, vatAmount, false, totalsNil),
            mkTotalRow(labels.extraExpenses, extraExpensesAmount, false, totalsNil),
            mkTotalRow(labels.totalDueBy(dueBanner), model.totalFormatted, true, totalsNil),
        ],
    });

    return [
        masthead,
        new Paragraph({
            spacing: { before: 200, after: 120 },
            children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
        }),
        ribbon,
        new Paragraph({
            spacing: { before: 200, after: 120 },
            children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
        }),
        panels,
        new Paragraph({
            spacing: { before: 220, after: 120 },
            children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
        }),
        svcTbl,
        new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
        }),
        totalsTbl,
        new Paragraph({
            spacing: { before: 480, after: 160 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
                text: labels.thanks,
                italics: true,
                size: DOC_SIZE,
                font: 'Georgia',
                color: '6B7280',
            })],
        }),
        new Paragraph({
            spacing: { before: 80 },
            alignment: AlignmentType.LEFT,
            children: [new TextRun({
                text: paymentDisclaimer,
                size: DOC_SIZE,
                font: DOC_FONT,
                color: '4B5563',
            })],
        }),
    ];
}

export async function buildInvoicePreviewDocxBlob(input: InvoicePreviewPackInput): Promise<Blob> {
    const { model, session, timeReportPack: timeReportOverride, legalOverrides, selectedPageNumbers } = input;
    const coverLogoRuns: ParagraphChild[] = [];
    const legalLogoRuns: ParagraphChild[] = [];
    if (typeof window !== 'undefined') {
        const [coverRaster, legalRaster] = await Promise.all([
            rasterizeInvoiceLogoSvg(420, 'cover'),
            rasterizeInvoiceLogoSvg(160, 'legal'),
        ]);
        if (coverRaster?.png.length && coverRaster.widthPx > 0) {
            const tw = 200;
            const th = Math.max(1, Math.round((coverRaster.heightPx / coverRaster.widthPx) * tw));
            coverLogoRuns.push(new ImageRun({
                type: 'png',
                data: coverRaster.png,
                transformation: { width: tw, height: th },
            }));
        }
        if (legalRaster?.png.length && legalRaster.widthPx > 0) {
            const th = 72;
            const tw = Math.max(1, Math.round((legalRaster.widthPx / legalRaster.heightPx) * th));
            legalLogoRuns.push(new ImageRun({
                type: 'png',
                data: legalRaster.png,
                transformation: { width: tw, height: th },
            }));
        }
    }

    const timeReportPack = (
        timeReportOverride
        && trimTrailingEmptyDetailSlots(timeReportOverride.detailSlots).length > 0
    )
        ? timeReportOverride
        : await resolveInvoiceTimeReportPack(session, model);
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
            children: coverChildren(model, coverLogoRuns),
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
            children: legalInvoiceDocxBlocks(model, session, legalLogoRuns, legalOverrides),
        });
    }

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: DOC_FONT,
                        size: DOC_SIZE,
                    },
                },
            },
        },
        sections,
    });
    return Packer.toBlob(doc);
}
