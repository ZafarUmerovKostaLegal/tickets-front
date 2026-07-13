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
    archiveCorrespondence,
    correspondenceErrorMessage,
    CorrespondenceHttpError,
    fetchCorrespondenceAttachmentBlob,
    fetchCorrespondenceDocument,
    fetchCorrespondenceStats,
    isCorrespondenceHttpError,
    listCorrespondence,
    openCorrespondenceAttachmentInNewTab,
    patchCorrespondence,
    registerIncomingCorrespondence,
    registerOutgoingCorrespondence,
} from './api';
