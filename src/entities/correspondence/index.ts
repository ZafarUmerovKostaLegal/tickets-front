export type {
    CorrAttachmentKind,
    CorrDirection,
    CorrDocStatus,
    CorrDocType,
    CorrRow,
    CorrespondenceAttachment,
    CorrespondenceDocument,
    CorrespondenceListResponse,
    CorrespondenceStats,
    CorrespondenceUserSnippet,
    CreateOutgoingDraftBody,
    ListCorrespondenceParams,
    PatchCorrespondenceBody,
    RegisterIncomingBody,
    RegisterOutgoingBody,
} from './model/types';

export {
    formatCorrRegisteredAt,
    isAllowedScanFile,
    mapDocumentToCorrRow,
    normalizeCorrespondenceDocument,
} from './lib/normalize';

export {
    invalidateCorrespondencePartnerAttention,
    CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT,
} from './lib/partnerAttentionEvents';

export { useCorrespondencePartnerAttentionBadge } from './lib/useCorrespondencePartnerAttentionBadge';

export {
    approveOutgoingCorrespondence,
    archiveCorrespondence,
    correspondenceErrorMessage,
    CorrespondenceHttpError,
    createOutgoingDraft,
    fetchCorrespondenceAttachmentBlob,
    fetchCorrespondenceDocument,
    fetchCorrespondenceStats,
    isCorrespondenceHttpError,
    listCorrespondence,
    openCorrespondenceAttachmentInNewTab,
    downloadCorrespondenceAttachment,
    patchCorrespondence,
    registerIncomingCorrespondence,
    registerOutgoingCorrespondence,
    rejectOutgoingCorrespondence,
    submitOutgoingForReview,
} from './api';
