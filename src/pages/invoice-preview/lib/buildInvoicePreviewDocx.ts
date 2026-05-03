import {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Packer,
    type ParagraphChild,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { rasterizeInvoiceCoverLogoSvg } from './invoiceCoverLogoRaster';

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
                        width: { size: 48, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({
                            children: logoHeaderRuns.length
                                ? logoHeaderRuns
                                : [new TextRun({ text: '\u200b', size: h(13), font: 'Calibri' })],
                        })],
                    }),
                    new TableCell({
                        borders: cellBorderNil,
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

/** Три страницы: первая — письмо, 2–3 пустые. */
export async function buildInvoicePreviewDocxBlob(model: InvoiceCoverLetterModel): Promise<Blob> {
    const logoRuns: ParagraphChild[] = [];
    if (typeof window !== 'undefined') {
        const raster = await rasterizeInvoiceCoverLogoSvg(400);
        if (raster?.png.length && raster.widthPx > 0) {
            const tw = 154;
            const th = Math.max(1, Math.round((raster.heightPx / raster.widthPx) * tw));
            logoRuns.push(new ImageRun({
                type: 'png',
                data: raster.png,
                transformation: { width: tw, height: th },
            }));
        }
    }

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                children: coverChildren(model, logoRuns),
            },
            { properties: {}, children: [new Paragraph('')] },
            { properties: {}, children: [new Paragraph('')] },
        ],
    });
    return Packer.toBlob(doc);
}
