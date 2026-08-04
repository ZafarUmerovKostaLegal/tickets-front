import { PDFDocument } from 'pdf-lib';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';

/** Temporary blank A4 PDF until the outgoing letter template is finalized. */
export async function buildOutgoingLetterPdfBlob(_model: InvoiceCoverLetterModel): Promise<Blob> {
    const doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);
    const bytes = await doc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
}

export function outgoingLetterPdfFileName(subject: string, dateIso: string): string {
    const safe = (subject || 'письмо')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'письмо';
    const day = (dateIso || '').slice(0, 10) || 'date';
    return `ИСХ_${safe}_${day}.pdf`;
}
