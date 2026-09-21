import {
    createOutgoingDraft,
    patchCorrespondence,
    submitOutgoingForReview,
    uploadCorrespondenceAttachment,
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
    /** Reuse early server draft that already has a minted download QR. */
    existingDocumentId?: string | null;
    downloadQrUrl?: string | null;
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
        const pdfBlob = await buildOutgoingLetterPdfBlob(input.coverModel, {
            downloadQrUrl: input.downloadQrUrl,
        });
        primary = new File(
            [pdfBlob],
            outgoingLetterPdfFileName(subject, input.letterDateIso),
            { type: 'application/pdf' },
        );
    }
    const attachmentFiles = [primary, ...otherFiles];
    const existingId = (input.existingDocumentId ?? '').trim();
    if (existingId && /^[0-9a-f-]{36}$/i.test(existingId)) {
        await patchCorrespondence(existingId, {
            subject,
            counterparty,
            partnerUserId: input.partnerUserId,
            comment: input.comment,
        });
        for (const file of attachmentFiles)
            await uploadCorrespondenceAttachment(existingId, file, 'attachment');
        return submitOutgoingForReview(existingId, input.partnerUserId);
    }
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
