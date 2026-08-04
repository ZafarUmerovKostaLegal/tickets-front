import { buildCoverLetterOnlyPdfBlob } from '@pages/invoice-preview/lib/buildInvoicePreviewPdf';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';

export async function buildOutgoingLetterPdfBlob(model: InvoiceCoverLetterModel): Promise<Blob> {
    return buildCoverLetterOnlyPdfBlob(model);
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
