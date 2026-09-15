export type {
    CorrAttachmentKind,
    CorrDirection,
    CorrDocStatus,
    CorrDocType,
    CorrSelectableDocType,
    CorrRow,
    CorrespondenceAttachment,
    CorrespondenceDocument,
    CorrespondenceDocumentComment,
    CorrespondenceListResponse,
    CorrespondenceStats,
    CorrespondenceUserSnippet,
    CreateOutgoingDraftBody,
    ListCorrespondenceParams,
    PatchCorrespondenceBody,
    RegisterIncomingBody,
    RegisterOutgoingBody,
} from './model/types';

export { CORR_DOC_TYPE_KEYS } from './model/types';

export {
    formatCorrRegisteredAt,
    isAllowedScanFile,
    mapDocumentToCorrRow,
    normalizeCorrespondenceComment,
    normalizeCorrespondenceDocument,
} from './lib/normalize';

export {
    invalidateCorrespondencePartnerAttention,
    CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT,
} from './lib/partnerAttentionEvents';

export { useCorrespondencePartnerAttentionBadge } from './lib/useCorrespondencePartnerAttentionBadge';

export {
    approveOutgoingCorrespondence,
    acknowledgeIncomingCorrespondence,
    archiveCorrespondence,
    deleteCorrespondence,
    correspondenceErrorMessage,
    CorrespondenceHttpError,
    createCorrespondenceComment,
    createOutgoingDraft,
    fetchCorrespondenceAttachmentBlob,
    fetchCorrespondenceAttachmentPreviewBlob,
    fetchCorrespondenceDocument,
    fetchCorrespondenceStats,
    isCorrespondenceHttpError,
    listCorrespondence,
    listCorrespondenceComments,
    openCorrespondenceAttachmentInNewTab,
    downloadCorrespondenceAttachment,
    uploadCorrespondenceAttachment,
    patchCorrespondence,
    registerIncomingCorrespondence,
    registerOutgoingCorrespondence,
    rejectOutgoingCorrespondence,
    submitOutgoingForReview,
} from './api';
