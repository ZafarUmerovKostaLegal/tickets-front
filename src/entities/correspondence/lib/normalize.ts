import type {
    CorrAttachmentKind,
    CorrDirection,
    CorrDocStatus,
    CorrDocType,
    CorrRow,
    CorrespondenceAttachment,
    CorrespondenceDocument,
    CorrespondenceDocumentComment,
    CorrespondenceStats,
    CorrespondenceUserSnippet,
} from '../model/types';

const DOC_TYPES = new Set<CorrDocType>(['letter', 'contract', 'note']);
const STATUSES = new Set<CorrDocStatus>([
    'draft',
    'pending_review',
    'rejected',
    'new',
    'progress',
    'approval',
    'done',
]);
const DIRECTIONS = new Set<CorrDirection>(['incoming', 'outgoing']);
const ATT_KINDS = new Set<CorrAttachmentKind>(['scan', 'attachment']);

function num(v: unknown): number | null {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const v = o[k];
        if (v != null && String(v).trim())
            return String(v).trim();
    }
    return '';
}

function normalizeUserSnippet(raw: unknown): CorrespondenceUserSnippet | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = num(o.id);
    if (id == null || id <= 0)
        return null;
    return {
        id,
        displayName: pickStr(o, 'displayName', 'display_name') || null,
        email: pickStr(o, 'email') || null,
        picture: pickStr(o, 'picture') || null,
        position: pickStr(o, 'position', 'job_title') || null,
    };
}

function userLabel(u: CorrespondenceUserSnippet | null | undefined): string {
    if (!u)
        return '—';
    return u.displayName?.trim() || u.email?.trim() || `User #${u.id}`;
}

export function formatCorrRegisteredAt(iso: string | null | undefined): string {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function normalizeCorrespondenceAttachment(raw: unknown): CorrespondenceAttachment | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = pickStr(o, 'id');
    if (!id)
        return null;
    const kindRaw = pickStr(o, 'attachmentKind', 'attachment_kind').toLowerCase();
    const attachmentKind = ATT_KINDS.has(kindRaw as CorrAttachmentKind)
        ? kindRaw as CorrAttachmentKind
        : 'attachment';
    return {
        id,
        fileName: pickStr(o, 'fileName', 'file_name') || 'file',
        contentType: pickStr(o, 'contentType', 'content_type') || null,
        sizeBytes: num(o.sizeBytes ?? o.size_bytes) ?? 0,
        attachmentKind,
        createdAt: pickStr(o, 'createdAt', 'created_at') || new Date().toISOString(),
    };
}

export function normalizeCorrespondenceComment(raw: unknown): CorrespondenceDocumentComment | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = pickStr(o, 'id');
    const body = pickStr(o, 'body');
    const authorUserId = num(o.authorUserId ?? o.author_user_id);
    if (!id || !body || authorUserId == null || authorUserId <= 0)
        return null;
    return {
        id,
        body,
        authorUserId,
        authorUser: normalizeUserSnippet(o.authorUser ?? o.author_user),
        createdAt: pickStr(o, 'createdAt', 'created_at') || new Date().toISOString(),
    };
}

export function normalizeCorrespondenceDocument(raw: unknown): CorrespondenceDocument | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = pickStr(o, 'id');
    if (!id)
        return null;
    const registryNumber = pickStr(o, 'registryNumber', 'registry_number') || null;
    const directionRaw = pickStr(o, 'direction').toLowerCase();
    if (!DIRECTIONS.has(directionRaw as CorrDirection))
        return null;
    const docTypeRaw = pickStr(o, 'docType', 'doc_type').toLowerCase() || 'letter';
    const docType = DOC_TYPES.has(docTypeRaw as CorrDocType) ? docTypeRaw as CorrDocType : 'letter';
    const statusRaw = pickStr(o, 'status').toLowerCase() || 'new';
    const status = STATUSES.has(statusRaw as CorrDocStatus) ? statusRaw as CorrDocStatus : 'new';
    const responsibleUserId = num(o.responsibleUserId ?? o.responsible_user_id) ?? 0;
    const partnerUserId = num(o.partnerUserId ?? o.partner_user_id);
    const attachmentsRaw = o.attachments;
    const attachments = Array.isArray(attachmentsRaw)
        ? attachmentsRaw.map(normalizeCorrespondenceAttachment).filter((x): x is CorrespondenceAttachment => x != null)
        : undefined;
    const registeredAt = pickStr(o, 'registeredAt', 'registered_at') || null;
    const createdAt = pickStr(o, 'createdAt', 'created_at') || null;
    return {
        id,
        registryNumber,
        direction: directionRaw as CorrDirection,
        counterparty: pickStr(o, 'counterparty'),
        subject: pickStr(o, 'subject'),
        docType,
        status,
        registeredAt,
        responsibleUserId,
        responsibleUser: normalizeUserSnippet(o.responsibleUser ?? o.responsible_user),
        partnerUserId,
        partnerUser: normalizeUserSnippet(o.partnerUser ?? o.partner_user),
        attachmentsCount: num(o.attachmentsCount ?? o.attachments_count) ?? attachments?.length ?? 0,
        hasScan: Boolean(o.hasScan ?? o.has_scan),
        comment: pickStr(o, 'comment') || null,
        rejectionComment: pickStr(o, 'rejectionComment', 'rejection_comment') || null,
        createdAt,
        ...(attachments ? { attachments } : {}),
    };
}

export function normalizeCorrespondenceStats(raw: unknown): CorrespondenceStats {
    const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    return {
        incomingTotal: num(o.incomingTotal ?? o.incoming_total) ?? 0,
        outgoingTotal: num(o.outgoingTotal ?? o.outgoing_total) ?? 0,
        approvalTotal: num(o.approvalTotal ?? o.approval_total) ?? 0,
        incomingNewTotal: num(o.incomingNewTotal ?? o.incoming_new_total) ?? 0,
        partnerAttentionTotal: num(o.partnerAttentionTotal ?? o.partner_attention_total) ?? 0,
    };
}

export function mapDocumentToCorrRow(doc: CorrespondenceDocument): CorrRow {
    return {
        id: doc.id,
        registryNumber: doc.registryNumber || (doc.status === 'pending_review'
            ? 'На проверке'
            : doc.status === 'rejected'
                ? 'Отклонено'
                : doc.status === 'draft'
                    ? 'Черновик'
                    : '—'),
        direction: doc.direction,
        counterparty: doc.counterparty,
        subject: doc.subject,
        type: doc.docType,
        date: formatCorrRegisteredAt(doc.registeredAt || doc.createdAt),
        responsible: userLabel(doc.responsibleUser),
        status: doc.status,
        partnerUserId: doc.partnerUserId ?? undefined,
        partnerName: doc.partnerUser ? userLabel(doc.partnerUser) : undefined,
        hasScan: doc.hasScan,
    };
}

export function isAllowedScanFile(file: File, maxBytes = 15 * 1024 * 1024): boolean {
    return file.size > 0 && file.size <= maxBytes;
}
