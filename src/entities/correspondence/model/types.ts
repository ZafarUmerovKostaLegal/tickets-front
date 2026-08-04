export type CorrDirection = 'incoming' | 'outgoing';

export type CorrDocType = 'letter' | 'contract' | 'note';

export type CorrDocStatus =
    | 'draft'
    | 'pending_review'
    | 'rejected'
    | 'new'
    | 'progress'
    | 'approval'
    | 'done';

export type CorrAttachmentKind = 'scan' | 'attachment';

export type CorrespondenceUserSnippet = {
    id: number;
    displayName: string | null;
    email: string | null;
    picture?: string | null;
    position?: string | null;
};

export type CorrespondenceAttachment = {
    id: string;
    fileName: string;
    contentType: string | null;
    sizeBytes: number;
    attachmentKind: CorrAttachmentKind;
    createdAt: string;
};

export type CorrespondenceDocument = {
    id: string;
    registryNumber: string | null;
    direction: CorrDirection;
    counterparty: string;
    subject: string;
    docType: CorrDocType;
    status: CorrDocStatus;
    registeredAt: string | null;
    responsibleUserId: number;
    responsibleUser: CorrespondenceUserSnippet | null;
    partnerUserId: number | null;
    partnerUser: CorrespondenceUserSnippet | null;
    attachmentsCount: number;
    hasScan: boolean;
    comment: string | null;
    rejectionComment: string | null;
    createdAt: string | null;
    attachments?: CorrespondenceAttachment[];
};

export type CorrespondenceListResponse = {
    items: CorrespondenceDocument[];
    total: number;
    skip: number;
    limit: number;
};

export type CorrespondenceStats = {
    incomingTotal: number;
    outgoingTotal: number;
    approvalTotal: number;
    incomingNewTotal: number;
};

export type ListCorrespondenceParams = {
    direction?: CorrDirection;
    status?: CorrDocStatus | string;
    statusGroup?: 'work';
    docType?: CorrDocType[];
    q?: string;
    skip?: number;
    limit?: number;
    includeArchived?: boolean;
    registeredOnly?: boolean;
};

export type RegisterIncomingBody = {
    partnerUserId: number;
    counterparty: string;
    subject: string;
    docType: CorrDocType;
    comment?: string;
    scanFiles: File[];
};

export type RegisterOutgoingBody = {
    counterparty: string;
    subject: string;
    docType: CorrDocType;
    comment?: string;
    attachmentFiles?: File[];
};

export type CreateOutgoingDraftBody = RegisterOutgoingBody & {
    partnerUserId?: number;
};

export type PatchCorrespondenceBody = {
    status?: CorrDocStatus;
    responsibleUserId?: number;
    comment?: string;
    counterparty?: string;
    subject?: string;
    partnerUserId?: number;
};

export type CorrRow = {
    id: string;
    registryNumber: string;
    direction: CorrDirection;
    counterparty: string;
    subject: string;
    type: CorrDocType;
    date: string;
    responsible: string;
    status: CorrDocStatus;
    partnerUserId?: number;
    partnerName?: string;
    hasScan?: boolean;
};
