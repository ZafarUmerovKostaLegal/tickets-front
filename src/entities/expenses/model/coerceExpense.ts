import type { AttachmentItem, ExpenseRequest } from './types';
import { normalizeCreatedBy } from './expenseAuthor';
function pickNumericField(x: Record<string, unknown>, camel: string, snake: string): unknown {
    if (camel in x && x[camel] !== undefined && x[camel] !== null)
        return x[camel];
    if (snake in x && x[snake] !== undefined && x[snake] !== null)
        return x[snake];
    return x[camel] ?? x[snake];
}
export function asExpenseNumber(v: unknown, fallback = 0, depth = 0): number {
    if (depth > 6)
        return fallback;
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'bigint') {
        const x = Number(v);
        return Number.isFinite(x) ? x : fallback;
    }
    if (typeof v === 'string') {
        const t = v.trim().replace(/\u00a0/g, '').replace(/\s/g, '');
        if (t === '' || t === 'null' || t === 'undefined')
            return fallback;
        const x = parseFloat(t.replace(',', '.'));
        return Number.isFinite(x) ? x : fallback;
    }
    if (v !== null && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if ('$numberDecimal' in o)
            return asExpenseNumber(o.$numberDecimal, fallback, depth + 1);
        if ('value' in o && (typeof o.value === 'string' || typeof o.value === 'number' || typeof o.value === 'bigint'))
            return asExpenseNumber(o.value, fallback, depth + 1);
        const maybe = Number(v as unknown as number);
        if (Number.isFinite(maybe))
            return maybe;
    }
    return fallback;
}
function pickStr(x: Record<string, unknown>, camel: string, snake: string): string {
    const v = x[camel] ?? x[snake];
    if (v == null)
        return '';
    return String(v);
}
export function normalizeExpenseAttachment(raw: unknown): AttachmentItem | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const x = raw as Record<string, unknown>;
    const id = pickStr(x, 'id', 'id').trim();
    if (!id)
        return null;
    const kindRaw = x.attachmentKind ?? x.attachment_kind;
    const kind = kindRaw == null || String(kindRaw).trim() === '' ? null : String(kindRaw).trim();
    const mimeRaw = x.mimeType ?? x.mime_type;
    return {
        id,
        expenseRequestId: pickStr(x, 'expenseRequestId', 'expense_request_id'),
        fileName: pickStr(x, 'fileName', 'file_name'),
        storageKey: pickStr(x, 'storageKey', 'storage_key'),
        mimeType: mimeRaw == null || String(mimeRaw).trim() === '' ? null : String(mimeRaw),
        sizeBytes: asExpenseNumber(pickNumericField(x, 'sizeBytes', 'size_bytes')),
        attachmentKind: kind,
        uploadedByUserId: Math.trunc(asExpenseNumber(pickNumericField(x, 'uploadedByUserId', 'uploaded_by_user_id'))),
        uploadedAt: pickStr(x, 'uploadedAt', 'uploaded_at'),
    };
}
export function normalizeExpenseRequest(r: ExpenseRequest): ExpenseRequest {
    const x = r as unknown as Record<string, unknown>;
    const createdByUserId = Math.trunc(asExpenseNumber(pickNumericField(x, 'createdByUserId', 'created_by_user_id'), r.createdByUserId ?? 0));
    const createdBy = normalizeCreatedBy(x.createdBy ?? x.created_by, createdByUserId);
    const reimbRaw = x.isReimbursable ?? x.is_reimbursable;
    const isReimbursable = reimbRaw === true || reimbRaw === 'true';
    const subRaw = x.expenseSubtype ?? x.expense_subtype;
    const expenseSubtype = subRaw == null || subRaw === '' ? null : String(subRaw);
    const catRaw = x.expenseCategoryId ?? x.expense_category_id;
    const expenseCategoryId = catRaw == null || catRaw === '' ? null : String(catRaw);
    const partnerUserIdRaw = pickNumericField(x, 'partnerUserId', 'partner_user_id');
    const partnerUserIdNum = Math.trunc(asExpenseNumber(partnerUserIdRaw, NaN));
    const partnerUserId = Number.isFinite(partnerUserIdNum) && partnerUserIdNum > 0 ? partnerUserIdNum : null;
    const partnerUserRaw = x.partnerUser ?? x.partner_user;
    const partnerUser = partnerUserRaw != null
        ? normalizeCreatedBy(partnerUserRaw, partnerUserId ?? 0)
        : undefined;
    const approvedByUserIdRaw = pickNumericField(x, 'approvedByUserId', 'approved_by_user_id');
    const approvedByUserIdNum = Math.trunc(asExpenseNumber(approvedByUserIdRaw, NaN));
    const approvedByUserId = Number.isFinite(approvedByUserIdNum) && approvedByUserIdNum > 0 ? approvedByUserIdNum : null;
    const approvedByRaw = x.approvedBy ?? x.approved_by ?? x.approver ?? x.moderatedBy ?? x.moderated_by;
    const approvedBy = approvedByRaw != null
        ? normalizeCreatedBy(approvedByRaw, approvedByUserId ?? 0)
        : undefined;
    const rejectionReasonRaw = x.rejectionReason ?? x.rejection_reason;
    const rejectionReason = rejectionReasonRaw == null || rejectionReasonRaw === ''
        ? null
        : String(rejectionReasonRaw);
    const hasReimbursementCardNumber = 'reimbursementCardNumber' in x || 'reimbursement_card_number' in x;
    const reimbursementCardNumberRaw = x.reimbursementCardNumber ?? x.reimbursement_card_number;
    const reimbursementCardNumber = reimbursementCardNumberRaw == null || reimbursementCardNumberRaw === ''
        ? null
        : String(reimbursementCardNumberRaw);
    const hasCardFlagKey = 'hasReimbursementCard' in x || 'has_reimbursement_card' in x;
    const hasCardFlagRaw = x.hasReimbursementCard ?? x.has_reimbursement_card;
    const hasCardFromNumber = reimbursementCardNumber != null
        && reimbursementCardNumber.replace(/\D/g, '').length > 0;
    const hasReimbursementCard = hasCardFlagRaw === true
        || hasCardFlagRaw === 'true'
        || hasCardFromNumber;
    const attRaw = x.attachments;
    const attachments = Array.isArray(attRaw)
        ? attRaw.map(normalizeExpenseAttachment).filter((a): a is AttachmentItem => a != null)
        : r.attachments;
    return {
        ...r,
        ...(attachments ? { attachments } : {}),
        createdByUserId: Number.isFinite(createdByUserId) ? createdByUserId : r.createdByUserId,
        createdBy,
        isReimbursable,
        expenseSubtype,
        expenseCategoryId,
        approvedByUserId,
        ...(approvedBy ? { approvedBy } : {}),
        rejectionReason,
        ...(hasReimbursementCardNumber ? { reimbursementCardNumber } : {}),
        ...(hasCardFlagKey || hasCardFromNumber ? { hasReimbursementCard } : {}),
        partnerUserId,
        ...(partnerUser ? { partnerUser } : {}),
        amountUzs: asExpenseNumber(pickNumericField(x, 'amountUzs', 'amount_uzs')),
        exchangeRate: asExpenseNumber(pickNumericField(x, 'exchangeRate', 'exchange_rate')),
        equivalentAmount: asExpenseNumber(pickNumericField(x, 'equivalentAmount', 'equivalent_amount')),
    };
}
export function formatEquivalentUsdParen(rowOrAmount: unknown): string {
    try {
        let raw: unknown = rowOrAmount;
        if (rowOrAmount !== null && typeof rowOrAmount === 'object') {
            const o = rowOrAmount as Record<string, unknown>;
            if ('equivalentAmount' in o || 'equivalent_amount' in o) {
                raw = pickNumericField(o, 'equivalentAmount', 'equivalent_amount');
            }
        }
        const n = asExpenseNumber(raw);
        if (!Number.isFinite(n) || n <= 0)
            return '';
        return ` (${n.toFixed(2)} $)`;
    }
    catch {
        return '';
    }
}
