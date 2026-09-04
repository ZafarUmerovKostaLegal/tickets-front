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
    VerticalAlignTable,
    WidthType,
} from 'docx';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { getCoverLetterLabels } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { rasterizeInvoiceLogoSvg } from '@pages/invoice-preview/lib/invoiceCoverLogoRaster';
import { letterHtmlToPlainText } from './correspondenceLetterHtml';
import {
    CORRESPONDENCE_LETTERHEAD_CONTACT,
    formatOutgoingLetterheadDate,
    formatOutgoingRefLine,
} from './correspondenceLetterhead';

const DOC_FONT = 'Calibri';
const DOC_SIZE = 22; // 11 pt
const MUTED = '64748B';

const cellBorderNil = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

function contactLine(text: string, after = 40): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after },
        children: [new TextRun({ text, font: DOC_FONT, size: 16, color: MUTED })],
    });
}

function bodyPara(text: string, opts?: { bold?: boolean; before?: number; after?: number; italic?: boolean; color?: string }): Paragraph {
    return new Paragraph({
        spacing: { before: opts?.before ?? 0, after: opts?.after ?? 80 },
        children: [new TextRun({
            text: text || '\u00a0',
            font: DOC_FONT,
            size: DOC_SIZE,
            bold: opts?.bold,
            italics: opts?.italic,
            color: opts?.color,
        })],
    });
}

/** Official outgoing letterhead as .docx for Word / Word Online. */
export async function buildOutgoingLetterDocxBlob(
    model: InvoiceCoverLetterModel,
    opts?: { registryNumber?: string | null },
): Promise<Blob> {
    const logoRuns: ParagraphChild[] = [];
    if (typeof window !== 'undefined') {
        const coverRaster = await rasterizeInvoiceLogoSvg(420, 'cover');
        if (coverRaster?.png.length && coverRaster.widthPx > 0) {
            const tw = 200;
            const th = Math.max(1, Math.round((coverRaster.heightPx / coverRaster.widthPx) * tw));
            logoRuns.push(new ImageRun({
                type: 'png',
                data: coverRaster.png,
                transformation: { width: tw, height: th },
            }));
        }
    }

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
                        width: { size: 52, type: WidthType.PERCENTAGE },
                        children: [new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: logoRuns.length
                                ? logoRuns
                                : [new TextRun({ text: 'KOSTA LEGAL', bold: true, size: 32, font: DOC_FONT })],
                        })],
                    }),
                    new TableCell({
                        borders: cellBorderNil,
                        verticalAlign: VerticalAlignTable.TOP,
                        width: { size: 48, type: WidthType.PERCENTAGE },
                        children: [
                            contactLine(CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine1),
                            contactLine(CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine2),
                            contactLine(CORRESPONDENCE_LETTERHEAD_CONTACT.phone),
                            contactLine(CORRESPONDENCE_LETTERHEAD_CONTACT.email),
                            contactLine(CORRESPONDENCE_LETTERHEAD_CONTACT.web, 0),
                        ],
                    }),
                ],
            }),
        ],
    });

    const labels = getCoverLetterLabels(model.coverLanguage);
    const recipient = (model.recipientCompany || '').trim();
    const attention = (model.attentionName || '').trim();
    const bodyText = letterHtmlToPlainText(model.introParagraphOverride ?? '').trim();
    const bodyLines = bodyText ? bodyText.split(/\n/) : ['', '', ''];

    const children: (Paragraph | Table)[] = [
        headerTable,
        bodyPara(formatOutgoingRefLine(opts?.registryNumber), { italic: true, color: MUTED, before: 280, after: 40 }),
        bodyPara(`Дата: ${formatOutgoingLetterheadDate(model)}`, { italic: true, color: MUTED, after: 240 }),
    ];

    if (recipient && recipient !== 'Company Name') {
        children.push(bodyPara(recipient, { bold: true, after: 40 }));
        const addr1 = (model.recipientAddressLines[0] || '').trim();
        if (addr1)
            children.push(bodyPara(addr1, { after: 40 }));
        const addr2 = (model.recipientAddressLines[1] || '').trim();
        if (addr2)
            children.push(bodyPara(addr2, { after: 40 }));
    }

    if (attention)
        children.push(bodyPara(`${labels.dear} ${attention},`, { before: 200, after: 160 }));

    for (const line of bodyLines)
        children.push(bodyPara(line, { after: 120 }));

    children.push(
        bodyPara(labels.closing, { before: 280, after: 200 }),
        bodyPara('_________________________', { color: '666666', after: 80 }),
        bodyPara(model.signatoryName || '', { after: 40 }),
        bodyPara(model.signatoryTitle || '', { after: 0 }),
    );

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, right: 720, bottom: 720, left: 850 },
                },
            },
            children,
        }],
    });
    return Packer.toBlob(doc);
}

export function outgoingLetterDocxFileName(subject: string, dateIso: string): string {
    const safe = (subject || 'письмо')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'письмо';
    const day = (dateIso || '').slice(0, 10) || 'date';
    return `ИСХ_${safe}_${day}.docx`;
}
