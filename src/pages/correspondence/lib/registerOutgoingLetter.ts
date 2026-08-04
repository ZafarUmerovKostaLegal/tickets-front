import {
    createOutgoingDraft,
    submitOutgoingForReview,
    type CorrespondenceDocument,
} from '@entities/correspondence';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { buildOutgoingLetterPdfBlob, outgoingLetterPdfFileName } from './buildOutgoingLetterPdf';
import { resolveOutgoingCounterparty } from './outgoingLetterSession';

/** Create draft + send to partner for review (registration happens after approve). */
export async function submitOutgoingLetterForReview(input: {
    subject: string;
    coverModel: InvoiceCoverLetterModel;
    letterDateIso: string;
    partnerUserId: number;
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
    const draft = await createOutgoingDraft({
        counterparty,
        subject,
        docType: 'letter',
        comment: input.comment,
        partnerUserId: input.partnerUserId,
        attachmentFiles,
    });
    return submitOutgoingForReview(draft.id, input.partnerUserId);
}
