import { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, ShadingType, Table, TableBorders, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlignTable, WidthType, } from 'docx';
import { KOSTA_LEGAL_FIRM, getCoverLetterLabels, resolveCoverIntroParagraph, resolveCoverInvoiceParagraph, } from './invoiceCoverLetterModel';
import { packCurrencyCode, packInvoiceNumberDisplay, packResolveDueIso, packResolveIssueIso, packUppercaseRibbonDate, packZeroCommaAmount, } from './invoicePreviewPackShared';
import { getInvoice } from '@entities/time-tracking';
import { descriptionKeepingTaskWords, ensureMehnatSeparatedPack, mergeTimeReportPackPreferLiveExpenses, timeReportPackHasContent, trimTrailingEmptyDetailSlots } from './invoiceTimeReportModel';
import { splitDetailRowsForPagedTimeReport } from './invoiceTimeReportChunking';
import { rasterizeInvoiceLogoSvg } from './invoiceCoverLogoRaster';
import { loadCoverSignaturePng } from './invoiceCoverSignature';
import { overlayExpenseAmountsFromRegistry, resolveInvoiceTimeReportPack } from './resolveInvoiceTimeReportPack';
import { combinedReportDocxChildren } from './combinedReportDocx';
import { planCombinedReportPreviewPages } from './combinedReportPreviewPages';
import { getTimeReportLabels } from './invoiceTimeReportI18n';
import { splitServiceInitiatorName } from './splitServiceInitiatorName';
import { getLegalInvoiceLabels, uppercaseLegalDateDisplay } from './invoiceLegalPageI18n';
import { invoicePreviewPageCount, resolveLegalBillToBankName, resolveLegalBillToSwift, resolveLegalCaseDetailLine, resolveLegalFirmBankingLines, resolveLegalOverrideText, resolveLegalPaymentDisclaimer, resolveLegalServiceDescriptionLine, } from './invoiceLegalPageModel';
const cellBorderNil = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};
function h(pt) {
    return Math.round(pt * 2);
}
/** Document-wide Word typography: Calibri Light 11 pt. */
const DOC_FONT = 'Calibri Light';
const DOC_SIZE = h(11);
function contactParagraph(text, spacingAfter = 20) {
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
function coverChildren(model, logoHeaderRuns, signatureRuns = []) {
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
    const body = [
        headerTable,
        new Paragraph({ spacing: { before: 260, after: 80 }, children: [new TextRun({ text: '', size: 2 })] }),
        new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: model.letterDateDisplay, size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: model.recipientCompany, bold: true, size: DOC_SIZE, font: DOC_FONT })] }),
        new Paragraph({ children: [new TextRun({ text: model.recipientAddressLines[0], size: DOC_SIZE, font: DOC_FONT })] }),
    ];
    const coverAddrExtra = String(model.recipientAddressLines[1] ?? '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    for (const line of coverAddrExtra) {
        body.push(new Paragraph({
            children: [new TextRun({ text: line, size: DOC_SIZE, font: DOC_FONT })],
        }));
    }
    const labels = getCoverLetterLabels(model.coverLanguage);
    body.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${labels.attention}: ${model.attentionName}`, bold: true, size: DOC_SIZE, font: DOC_FONT })] }), new Paragraph({ children: [new TextRun({ text: model.attentionTitle, size: DOC_SIZE, font: DOC_FONT })] }), new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${labels.dear} ${model.attentionName},`, size: DOC_SIZE, font: DOC_FONT })] }), new Paragraph({
        spacing: { before: 160 },
        children: [new TextRun({
                text: resolveCoverIntroParagraph(model),
                size: DOC_SIZE,
                font: DOC_FONT,
            })],
    }), new Paragraph({
        spacing: { before: 160 },
        children: [new TextRun({
                text: resolveCoverInvoiceParagraph(model),
                size: DOC_SIZE,
                font: DOC_FONT,
            })],
    }), new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: labels.closing, size: DOC_SIZE, font: DOC_FONT })] }), new Paragraph({
        spacing: { before: signatureRuns.length ? 120 : 280, after: 40 },
        children: signatureRuns.length
            ? signatureRuns
            : [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
    }), new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: '_________________________', size: DOC_SIZE, font: DOC_FONT, color: '666666' })] }), new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: model.signatoryName, size: DOC_SIZE, font: DOC_FONT })] }), new Paragraph({ children: [new TextRun({ text: model.signatoryTitle, size: DOC_SIZE, font: DOC_FONT })] }));
    return body;
}
function mmToTwip(mm) {
    return Math.round((mm * 72 / 25.4) * 20);
}
const PAGE_MARGIN_TWIPS = {
    top: mmToTwip(20),
    right: mmToTwip(12),
    bottom: mmToTwip(20),
    left: mmToTwip(30),
};
const INV_RED = 'E83337';
const cellBorderGrid = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'DADADA' },
};
function pctWidths(weights) {
    const s = weights.reduce((a, b) => a + b, 0);
    const floored = weights.map((w) => Math.floor((100 * w) / s));
    const diff = 100 - floored.reduce((a, b) => a + b, 0);
    floored[floored.length - 1] = (floored[floored.length - 1] ?? 1) + diff;
    return floored;
}
function trHeadCell(txt, pct) {
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
function trBodyTextCell(txt, pct, align) {
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
function trFootValueCell(txt, pct, align) {
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
function timeReportDocxSectionChildren(model, pack, detailChunk, opts) {
    const cur = packCurrencyCode(model);
    const labels = getTimeReportLabels(model.coverLanguage);
    const amountHdr = labels.amount(cur);
    const showName = opts.showInitiatorName === true;
    const DW = pctWidths(showName ? [13, 8, 11, 16, 12, 7, 16, 17] : [15, 9, 13, 18, 8, 18, 19]);
    const hoursI = showName ? 5 : 4;
    const rateI = showName ? 6 : 5;
    const amountI = showName ? 7 : 6;
    const totalSpan = showName ? 5 : 4;
    const detailCells = (r) => {
        const description = descriptionKeepingTaskWords(r.task, r.description);
        const split = showName ? splitServiceInitiatorName(description) : null;
        return [
            trBodyTextCell(r.date, DW[0], AlignmentType.LEFT),
            trBodyTextCell(r.initials, DW[1], AlignmentType.LEFT),
            trBodyTextCell(r.task, DW[2], AlignmentType.LEFT),
            trBodyTextCell(split ? split.note : description, DW[3], AlignmentType.LEFT),
            ...(showName ? [trBodyTextCell(split?.name ?? '', DW[4], AlignmentType.LEFT)] : []),
            trBodyTextCell(r.hours, DW[hoursI], AlignmentType.RIGHT),
            trBodyTextCell(r.hourlyRate, DW[rateI], AlignmentType.RIGHT),
            trBodyTextCell(r.amount, DW[amountI], AlignmentType.RIGHT),
        ];
    };
    const SW = pctWidths([9, 20, 18, 12, 18, 23]);
    const detailHeader = new TableRow({
        children: [
            trHeadCell(labels.date, DW[0] ?? 12),
            trHeadCell(labels.initials, DW[1] ?? 10),
            trHeadCell(labels.task, DW[2] ?? 11),
            trHeadCell(labels.description, DW[3] ?? 22),
            ...(showName ? [trHeadCell(labels.initiatorName, DW[4] ?? 12)] : []),
            trHeadCell(labels.hours, DW[hoursI] ?? 9),
            trHeadCell(labels.rate, DW[rateI] ?? 14),
            trHeadCell(amountHdr, DW[amountI] ?? 22),
        ],
    });
    const detailBodyRows = detailChunk.map((r) => new TableRow({
        children: detailCells(r),
    }));
    if (opts.isLastChunk) {
        detailBodyRows.push(new TableRow({
            children: [
                new TableCell({
                    borders: cellBorderGrid,
                    columnSpan: totalSpan,
                    children: [new Paragraph({
                            children: [new TextRun({ text: labels.total, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
                        })],
                }),
                trFootValueCell(pack.detailTotalHoursDisplay, DW[hoursI], AlignmentType.RIGHT),
                trFootValueCell('—', DW[rateI], AlignmentType.RIGHT),
                trFootValueCell(pack.detailTotalAmountDisplay, DW[amountI], AlignmentType.RIGHT),
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
    const out = [
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
        const mehnatRows = trimTrailingEmptyDetailSlots(pack.mehnatSlots ?? []);
        if (mehnatRows.length > 0) {
            const mehnatBodyRows = mehnatRows.map((r) => new TableRow({
                children: detailCells(r),
            }));
            mehnatBodyRows.push(new TableRow({
                children: [
                    new TableCell({
                        borders: cellBorderGrid,
                        columnSpan: totalSpan,
                        children: [new Paragraph({
                                children: [new TextRun({ text: labels.total, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
                            })],
                    }),
                    trFootValueCell(pack.mehnatTotalHoursDisplay, DW[hoursI], AlignmentType.RIGHT),
                    trFootValueCell('—', DW[rateI], AlignmentType.RIGHT),
                    trFootValueCell(pack.mehnatTotalAmountDisplay, DW[amountI], AlignmentType.RIGHT),
                ],
            }));
            out.push(new Paragraph({
                spacing: { before: 260, after: 120 },
                children: [new TextRun({ text: labels.mehnatTitle, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
            }), new Table({
                ...tableOpts,
                rows: [detailHeader, ...mehnatBodyRows],
            }));
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
        const summaryDataRows = pack.summarySlots.map((r) => new TableRow({
            children: [
                trBodyTextCell(r.initials, SW[0], AlignmentType.LEFT),
                trBodyTextCell(r.name, SW[1], AlignmentType.LEFT),
                trBodyTextCell(r.title, SW[2], AlignmentType.LEFT),
                trBodyTextCell(r.hours, SW[3], AlignmentType.RIGHT),
                trBodyTextCell(r.hourlyRate, SW[4], AlignmentType.RIGHT),
                trBodyTextCell(r.totalPrice, SW[5], AlignmentType.RIGHT),
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
                trFootValueCell(pack.summaryGrandHoursDisplay, SW[3], AlignmentType.RIGHT),
                trFootValueCell('—', SW[4], AlignmentType.RIGHT),
                trFootValueCell(sumGrandAmt, SW[5], AlignmentType.RIGHT),
            ],
        }));
        const sumTbl = new Table({
            ...tableOpts,
            rows: [summaryHeader, ...summaryDataRows],
        });
        out.push(new Paragraph({
            spacing: { before: 260, after: 120 },
            children: [new TextRun({ text: labels.summaryTitle, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
        }), sumTbl);
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
            const expenseDataRows = expenseRows.map((r) => new TableRow({
                children: [
                    trBodyTextCell(r.date, EW[0], AlignmentType.LEFT),
                    trBodyTextCell(r.description, EW[1], AlignmentType.LEFT),
                    trBodyTextCell(r.amount, EW[2], AlignmentType.RIGHT),
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
                    trFootValueCell(pack.expenseTotalAmountDisplay, EW[2], AlignmentType.RIGHT),
                ],
            }));
            out.push(new Paragraph({
                spacing: { before: 260, after: 120 },
                children: [new TextRun({ text: labels.expensesTitle, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
            }), new Table({
                ...tableOpts,
                rows: [expenseHeader, ...expenseDataRows],
            }));
        }
    }
    out.push(new Paragraph({
        spacing: { before: 360 },
        border: { top: { style: BorderStyle.SINGLE, color: INV_RED, size: 12, space: 2 } },
        children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
    }), new Paragraph({
        spacing: { before: 60 },
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: opts.pageNumStr, bold: true, color: INV_RED, size: DOC_SIZE, font: DOC_FONT })],
    }));
    return out;
}
function invoiceRibbonTable(leftText, rightText) {
    const redCell = (widthPct, align, text) => new TableCell({
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
function legalInvoiceDocxBlocks(model, session, logoRuns, legalOverrides) {
    const labels = getLegalInvoiceLabels(model.coverLanguage);
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const zeroFallback = packZeroCommaAmount(model);
    const ribbonIssue = uppercaseLegalDateDisplay(resolveLegalOverrideText(legalOverrides?.issueDateDisplay, packUppercaseRibbonDate(issueIso, model.coverLanguage)), model.coverLanguage);
    const dueBanner = uppercaseLegalDateDisplay(resolveLegalOverrideText(legalOverrides?.dueDateDisplay, packUppercaseRibbonDate(dueIso, model.coverLanguage)), model.coverLanguage);
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
        ...[firmAddress, ...resolveLegalFirmBankingLines(cur, legalOverrides, model.coverLanguage)].map((txt) => new Paragraph({
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
    const billChildren = [
        new Paragraph({
            spacing: { after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, color: '334155', size: 12, space: 4 } },
            children: [new TextRun({ text: labels.billTo, bold: true, color: '1E293B', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [new TextRun({ text: model.recipientCompany, bold: true, color: '0F172A', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: `${labels.address}:`, color: '707784', size: DOC_SIZE, font: DOC_FONT })],
        }),
    ];
    const billAddressLines = [model.recipientAddressLines[0], model.recipientAddressLines[1]]
        .flatMap((s) => String(s ?? '').split(/\r?\n/))
        .map((s) => s.trim())
        .filter(Boolean);
    billAddressLines.forEach((line, i) => {
        billChildren.push(new Paragraph({
            spacing: { after: i === billAddressLines.length - 1 ? 40 : 30 },
            children: [new TextRun({ text: line, size: DOC_SIZE, font: DOC_FONT })],
        }));
    });
    billChildren.push(new Paragraph({
        spacing: { after: 30 },
        children: [
            new TextRun({ text: `${labels.bankName}: `, color: '707784', size: DOC_SIZE, font: DOC_FONT }),
            new TextRun({ text: resolveLegalBillToBankName(legalOverrides), color: '707784', size: DOC_SIZE, font: DOC_FONT }),
        ],
    }), new Paragraph({
        children: [
            new TextRun({ text: `${labels.swift}: `, color: '707784', size: DOC_SIZE, font: DOC_FONT }),
            new TextRun({ text: resolveLegalBillToSwift(legalOverrides), color: '707784', size: DOC_SIZE, font: DOC_FONT }),
        ],
    }));
    const caseChildren = [
        new Paragraph({
            spacing: { after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, color: '334155', size: 12, space: 4 } },
            children: [new TextRun({ text: labels.caseDetails, bold: true, color: '1E293B', size: DOC_SIZE, font: DOC_FONT })],
        }),
        new Paragraph({
            spacing: { before: 80 },
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
    const totalsNil = {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    };
    const mkTotalRow = (label, value, due, borders) => new TableRow({
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
            spacing: { before: 160, after: 80 },
            children: [new TextRun({ text: '\u200b', size: DOC_SIZE, font: DOC_FONT })],
        }),
        panels,
        new Paragraph({
            spacing: { before: 120, after: 160 },
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
export async function buildInvoicePreviewDocxBlob(input) {
    const { model, session, timeReportPack: timeReportOverride, legalOverrides, selectedPageNumbers } = input;
    const coverLogoRuns = [];
    const legalLogoRuns = [];
    const coverSignatureRuns = [];
    if (typeof window !== 'undefined') {
        const [coverRaster, legalRaster, signatureRaster] = await Promise.all([
            rasterizeInvoiceLogoSvg(420, 'cover'),
            rasterizeInvoiceLogoSvg(160, 'legal'),
            loadCoverSignaturePng(model.signatoryInitials || model.signatoryName),
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
        if (signatureRaster?.png.length && signatureRaster.widthPx > 0) {
            const maxW = 220;
            const maxH = 72;
            const aspect = signatureRaster.widthPx / Math.max(1, signatureRaster.heightPx);
            let tw = maxW;
            let th = Math.max(1, Math.round(tw / aspect));
            if (th > maxH) {
                th = maxH;
                tw = Math.max(1, Math.round(th * aspect));
            }
            coverSignatureRuns.push(new ImageRun({
                type: 'png',
                data: signatureRaster.png,
                transformation: { width: tw, height: th },
            }));
        }
    }
    const liveTimeReport = await resolveInvoiceTimeReportPack(session, model);
    const timeReportPackRaw = (timeReportOverride
        && timeReportPackHasContent(timeReportOverride))
        ? mergeTimeReportPackPreferLiveExpenses(timeReportOverride, liveTimeReport)
        : liveTimeReport;
    let projectId = session?.mode === 'create'
        ? (session.form.createProjectId?.trim() || null)
        : null;
    if (!projectId && session?.mode === 'existing') {
        try {
            const inv = await getInvoice(session.invoiceId, false);
            projectId = inv.projectId?.trim() || null;
        }
        catch {
            projectId = null;
        }
    }
    const timeReportPack = ensureMehnatSeparatedPack(await overlayExpenseAmountsFromRegistry(timeReportPackRaw, projectId));
    const trChunks = splitDetailRowsForPagedTimeReport(timeReportPack.detailSlots);
    const combinedPreviewPages = input.combinedReport
        ? Math.max(1, planCombinedReportPreviewPages(input.combinedReport).length)
        : 0;
    const pageCount = input.combinedReport
        ? 2 + combinedPreviewPages
        : invoicePreviewPageCount(trChunks.length);
    const selected = selectedPageNumbers?.length ? new Set(selectedPageNumbers) : null;
    const includePage = (n) => !selected || selected.has(n);
    const sectionPage = {
        properties: {
            page: {
                margin: PAGE_MARGIN_TWIPS,
            },
        },
    };
    const sections = [];
    if (includePage(1)) {
        sections.push({
            ...sectionPage,
            children: coverChildren(model, coverLogoRuns, coverSignatureRuns),
        });
    }
    if (input.combinedReport) {
        const reportIncluded = Array.from({ length: combinedPreviewPages }, (_, index) => includePage(2 + index)).some(Boolean);
        if (reportIncluded) {
            sections.push({
                ...sectionPage,
                children: combinedReportDocxChildren(input.combinedReport),
            });
        }
    }
    else
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
                    showInitiatorName: input.showServiceInitiatorName === true,
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
