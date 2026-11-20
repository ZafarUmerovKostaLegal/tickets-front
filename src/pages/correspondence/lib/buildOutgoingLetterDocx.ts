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
import { OUTGOING_LETTER_DOC_FONT } from './outgoingLetterEditorFonts';
import { buildCorrespondenceQrPngBytes } from '../ui/CorrespondenceLetterQr';

const DOC_FONT = OUTGOING_LETTER_DOC_FONT;
const DOC_SIZE = 22;
const MUTED = '64748B';

const cellBorderNil = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

/** Line spacing 1.05 (240 = single). Word's default 1.08 + 8pt after made every Enter a gap. */
const LINE = 252;

function contactLine(text: string, after = 0): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after, line: 240 },
        run: { font: DOC_FONT, size: 16, color: MUTED },
        children: [new TextRun({ text, font: DOC_FONT, size: 16, color: MUTED })],
    });
}

type BodyOpts = { bold?: boolean; before?: number; after?: number; italic?: boolean; color?: string };

/**
 * A letter paragraph. An empty line stays truly empty (the old NBSP placeholder became a stray
 * leading space as soon as someone typed into it), and the paragraph mark carries the same
 * font, so typing into an empty line and pressing Enter keep Calibri Light 11.
 */
function bodyPara(text: string, opts?: BodyOpts): Paragraph {
    const run = {
        font: DOC_FONT,
        size: DOC_SIZE,
        bold: opts?.bold,
        italics: opts?.italic,
        color: opts?.color,
    };
    return new Paragraph({
        spacing: { before: opts?.before ?? 0, after: opts?.after ?? 0, line: LINE },
        run,
        children: text ? [new TextRun({ text, ...run })] : [],
    });
}

export type BuildOutgoingLetterDocxOpts = {
    registryNumber?: string | null;
    downloadQrUrl?: string | null;
};

export async function buildOutgoingLetterDocxBlob(
    model: InvoiceCoverLetterModel,
    opts?: BuildOutgoingLetterDocxOpts,
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
                            spacing: { before: 0, after: 0 },
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
    // One empty line to type into — three blank lines only left a gap before the closing.
    // Blank lines in imported text are paragraph breaks already carried by `after`.
    const bodyLines = bodyText.split(/\n/).map((line) => line.trim()).filter(Boolean);

    const children: (Paragraph | Table)[] = [
        headerTable,
        bodyPara(formatOutgoingRefLine(opts?.registryNumber), { italic: true, color: MUTED, before: 280 }),
        bodyPara(`Дата: ${formatOutgoingLetterheadDate(model)}`, { italic: true, color: MUTED, after: 240 }),
    ];

    if (recipient && recipient !== 'Company Name') {
        children.push(bodyPara(recipient, { bold: true }));
        const addr1 = (model.recipientAddressLines[0] || '').trim();
        if (addr1)
            children.push(bodyPara(addr1));
        const addr2 = (model.recipientAddressLines[1] || '').trim();
        if (addr2)
            children.push(bodyPara(addr2));
    }

    if (attention)
        children.push(bodyPara(`${labels.dear} ${attention},`, { before: 200, after: 120 }));

    // Body paragraphs: Enter inside them makes a new paragraph with the same 6pt gap.
    for (const line of bodyLines.length ? bodyLines : [''])
        children.push(bodyPara(line, { after: 120 }));

    children.push(
        bodyPara(labels.closing, { before: 240, after: 360 }),
        bodyPara('_________________________', { color: '666666', after: 60 }),
        bodyPara(model.signatoryName || ''),
        bodyPara(model.signatoryTitle || ''),
    );

    const qrUrl = (opts?.downloadQrUrl ?? '').trim();
    if (qrUrl && typeof window !== 'undefined') {
        const qrPng = await buildCorrespondenceQrPngBytes(qrUrl, 280);
        if (qrPng?.length) {
            const qrSize = 120;
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 360, after: 40 },
                    children: [new ImageRun({
                        type: 'png',
                        data: qrPng,
                        transformation: { width: qrSize, height: qrSize },
                        altText: {
                            title: 'QR',
                            description: 'Скачать документ',
                            name: 'download-qr',
                        },
                    })],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({
                        text: 'Скачать документ',
                        font: DOC_FONT,
                        size: 14,
                        color: MUTED,
                    })],
                }),
            );
        }
    }

    const doc = new Document({
        // Document defaults = the letter's look. Without them, new and pasted paragraphs fell
        // back to Word's Normal (plain Calibri, 8pt after, 1.08 lines) — the jumping spacing.
        styles: {
            default: {
                document: {
                    run: { font: DOC_FONT, size: DOC_SIZE },
                    paragraph: { spacing: { before: 0, after: 120, line: LINE } },
                },
            },
        },
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

export async function buildOutgoingLetterDocxBytes(
    model: InvoiceCoverLetterModel,
    opts?: BuildOutgoingLetterDocxOpts,
): Promise<Uint8Array> {
    const blob = await buildOutgoingLetterDocxBlob(model, opts);
    return new Uint8Array(await blob.arrayBuffer());
}

export const OUTGOING_LETTER_DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function outgoingLetterDocxFileFromBytes(
    bytes: ArrayBuffer | Uint8Array,
    subject: string,
    dateIso: string,
): File {
    const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const copy = new Uint8Array(src.byteLength);
    copy.set(src);
    const blob = new Blob([copy], { type: OUTGOING_LETTER_DOCX_MIME });
    return new File(
        [blob],
        outgoingLetterDocxFileName(subject, dateIso),
        { type: OUTGOING_LETTER_DOCX_MIME },
    );
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
