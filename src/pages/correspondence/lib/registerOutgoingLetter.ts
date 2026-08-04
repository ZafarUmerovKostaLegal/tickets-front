import { registerOutgoingCorrespondence, type CorrespondenceDocument } from '@entities/correspondence';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { buildOutgoingLetterPdfBlob, outgoingLetterPdfFileName } from './buildOutgoingLetterPdf';
import { resolveOutgoingCounterparty } from './outgoingLetterSession';

export async function registerOutgoingLetterDocument(input: {
    subject: string;
    coverModel: InvoiceCoverLetterModel;
    letterDateIso: string;
    extraFiles?: File[];
    comment?: string;
}): Promise<CorrespondenceDocument> {
    const subject = input.subject.trim();
    const counterparty = resolveOutgoingCounterparty(input.coverModel);
    const pdfBlob = await buildOutgoingLetterPdfBlob(input.coverModel);
    const pdfFile = new File(
        [pdfBlob],
        outgoingLetterPdfFileName(subject, input.letterDateIso),
        { type: 'application/pdf' },
    );
    const attachmentFiles = [pdfFile, ...(input.extraFiles ?? [])];
    return registerOutgoingCorrespondence({
        counterparty,
        subject,
        docType: 'letter',
        comment: input.comment,
        attachmentFiles,
    });
}
