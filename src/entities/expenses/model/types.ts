export type ExpenseStatus = 'draft' | 'pending_approval' | 'revision_required' | 'approved' | 'rejected' | 'paid' | 'closed' | 'not_reimbursable' | 'withdrawn';
export type ExpenseType = 'transport' | 'food' | 'accommodation' | 'purchase' | 'services' | 'entertainment' | 'client_expense' | 'partner_expense' | 'other';
export type PartnerExpenseCategory = 'partner_fuel' | 'partner_air' | 'partner_meetings_food' | 'partner_shop' | 'partner_misc';
export type PaymentMethod = 'cash' | 'transfer' | 'card';
export type ExpenseAmountCurrency = 'UZS' | 'USD' | 'RUB' | 'GBP' | 'EUR';
export type ExpenseAttachmentKind = 'payment_document' | 'payment_receipt';
export type ExpenseFilesByKind = Record<ExpenseAttachmentKind, File[]>;
export const EXPENSE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export interface ExpenseCreatedBy {
    id: number;
    displayName: string | null;
    email: string | null;
    picture?: string | null;
    position?: string | null;
}
export interface AttachmentItem {
    id: string;
    expenseRequestId: string;
    fileName: string;
    storageKey: string;
    mimeType: string | null;
    sizeBytes: number;
    attachmentKind?: string | null;
    uploadedByUserId: number;
    uploadedAt: string;
}
export interface ExpenseRequest {
    id: string;
    description: string;
    expenseDate: string;
    amountUzs: number;
    exchangeRate: number;
    equivalentAmount: number;
    expenseType: string;
    expenseSubtype: string | null;
    isReimbursable: boolean;
    paymentMethod: string | null;
    reimbursementCardNumber?: string | null;
    hasReimbursementCard?: boolean;
    departmentId: string | null;
    projectId: string | null;
    expenseCategoryId?: string | null;
    vendor: string | null;
    businessPurpose: string | null;
    comment: string | null;
    status: ExpenseStatus;
    createdByUserId: number;
    createdBy?: ExpenseCreatedBy;
    updatedByUserId: number;
    createdAt: string;
    updatedAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    approvedByUserId?: number | null;
    approvedBy?: ExpenseCreatedBy;
    rejectedAt: string | null;
    rejectionReason?: string | null;
    paidAt: string | null;
    paidByUserId?: number | null;
    paidBy?: ExpenseCreatedBy;
    closedAt: string | null;
    withdrawnAt: string | null;
    partnerUserId?: number | null;
    partnerUser?: ExpenseCreatedBy;
    attachmentsCount: number;
    attachments?: AttachmentItem[];
}
export interface ExpenseFormValues {
    description: string;
    expenseDate: string;
    expenseType: string;
    expenseSubtype: string;
    isReimbursable: boolean;
    amountCurrency: ExpenseAmountCurrency;
    foreignPerUsd: string;
    amountUzs: string;
    exchangeRate: string;
    paymentMethod: string;
    reimbursementCardNumber: string;
    projectId: string;
    expenseCategoryId: string;
    vendor: string;
    businessPurpose: string;
    comment: string;
    partnerUserId: string;
}
export interface ExpenseFormErrors {
    description?: string;
    expenseDate?: string;
    expenseType?: string;
    expenseSubtype?: string;
    partnerUserId?: string;
    isReimbursable?: string;
    amountUzs?: string;
    exchangeRate?: string;
    foreignPerUsd?: string;
    paymentMethod?: string;
    reimbursementCardNumber?: string;
    projectId?: string;
    expenseCategoryId?: string;
    comment?: string;
    attachmentsPaymentDoc?: string;
    attachmentsReceipt?: string;
}
export interface ExpenseTypeRef {
    code: string;
    label: string;
    sortOrder: number;
}
export interface ProjectRef {
    id: string;
    name: string;
}
export type ExpensesScopeMode = 'company' | 'partner';

export interface ListParams {
    status?: string;
    expenseType?: string;
    excludeExpenseType?: string;
    expenseSubtype?: string;
    scopeMode?: ExpensesScopeMode;
    partnerUserId?: number;
    isReimbursable?: boolean;
    paymentMethod?: string;
    /** Exclude employee personal-card payouts from the vendor-payment queue. */
    awaitingPayment?: boolean;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    sortBy?: string;
    sortOrder?: string;
    skip?: number;
    limit?: number;
    employeeUserId?: number;
    projectId?: string;
}
