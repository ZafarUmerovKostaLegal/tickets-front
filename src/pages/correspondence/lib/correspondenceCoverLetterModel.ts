import {
    buildInvoiceCoverLetterModel,
    resolveCoverIntroParagraph,
    type InvoiceCoverLetterModel,
} from '@pages/invoice-preview/lib/invoiceCoverLetterModel';

export type MockLetterCoverMeta = {
    recipientAddressLine1?: string;
    recipientAddressLine2?: string;
    attentionName?: string;
    attentionTitle?: string;
    bodyParagraph2?: string;
    signatoryName?: string;
    signatoryTitle?: string;
    letterDateDisplay?: string;
};

export type LetterCoverSource = {
    date: string;
    body: string;
    counterparty: string;
    coverMeta?: MockLetterCoverMeta;
};

export type LetterCoverTarget = LetterCoverSource & {
    id: string;
    docType: 'letter' | 'contract' | 'note';
    subject: string;
    status: 'draft' | 'pending_review' | 'rejected' | 'approved';
    registryNumber: string;
    attachments: { id: string; name: string; size: string }[];
    partnerId?: number;
    partnerName?: string;
    rejectionReason?: string;
};

export function mockLetterToCoverModel(letter: LetterCoverSource): InvoiceCoverLetterModel {
    const meta = letter.coverMeta;
    const base = buildInvoiceCoverLetterModel({
        issueDateIso: letter.date,
        clientName: letter.counterparty.trim() || 'Company Name',
        clientAddress: meta?.recipientAddressLine1
            ? [meta.recipientAddressLine1, meta.recipientAddressLine2].filter(Boolean).join('\n')
            : null,
        contactName: meta?.attentionName ?? null,
        totalAmount: null,
        currency: 'USD',
    });

    const body = letter.body.trim();
    return {
        ...base,
        letterDateDisplay: meta?.letterDateDisplay?.trim() || base.letterDateDisplay,
        recipientAddressLines: [
            meta?.recipientAddressLine1?.trim() || base.recipientAddressLines[0],
            meta?.recipientAddressLine2?.trim() ?? base.recipientAddressLines[1],
        ],
        attentionName: meta?.attentionName?.trim() || base.attentionName,
        attentionTitle: meta?.attentionTitle?.trim() || base.attentionTitle,
        signatoryName: meta?.signatoryName?.trim() || base.signatoryName,
        signatoryTitle: meta?.signatoryTitle?.trim() || base.signatoryTitle,
        introParagraphOverride: body || null,
        invoiceParagraphOverride: meta?.bodyParagraph2?.trim() || null,
    };
}

export function coverModelToMockLetter(
    model: InvoiceCoverLetterModel,
    base: Partial<LetterCoverTarget> & Pick<LetterCoverTarget, 'id' | 'docType' | 'subject' | 'date' | 'status' | 'registryNumber' | 'attachments'>,
): LetterCoverTarget {
    const intro = model.introParagraphOverride?.trim() || resolveCoverIntroParagraph(model);
    const coverMeta: MockLetterCoverMeta = {
        recipientAddressLine1: model.recipientAddressLines[0],
        recipientAddressLine2: model.recipientAddressLines[1] || undefined,
        attentionName: model.attentionName,
        attentionTitle: model.attentionTitle,
        bodyParagraph2: model.invoiceParagraphOverride?.trim() || undefined,
        signatoryName: model.signatoryName,
        signatoryTitle: model.signatoryTitle,
        letterDateDisplay: model.letterDateDisplay,
    };

    return {
        id: base.id,
        docType: base.docType,
        subject: base.subject,
        body: intro,
        counterparty: model.recipientCompany.trim(),
        date: base.date,
        status: base.status,
        registryNumber: base.registryNumber,
        attachments: base.attachments,
        partnerId: base.partnerId,
        partnerName: base.partnerName,
        rejectionReason: base.rejectionReason,
        coverMeta,
    };
}
