import {
    createOutgoingDraft,
    submitOutgoingForReview,
    type CorrespondenceDocument,
} from '@entities/correspondence';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { buildOutgoingLetterPdfBlob, outgoingLetterPdfFileName } from './buildOutgoingLetterPdf';
import { pickOutgoingWordFile } from './openOutgoingLetterInWord';
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
    const extras = [...(input.extraFiles ?? [])];
    const wordFile = pickOutgoingWordFile(extras);
    const otherFiles = wordFile ? extras.filter((f) => f !== wordFile) : extras;
    let primary: File;
    if (wordFile)
        primary = wordFile;
    else {
        const pdfBlob = await buildOutgoingLetterPdfBlob(input.coverModel);
        primary = new File(
            [pdfBlob],
            outgoingLetterPdfFileName(subject, input.letterDateIso),
            { type: 'application/pdf' },
        );
    }
    const attachmentFiles = [primary, ...otherFiles];
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
