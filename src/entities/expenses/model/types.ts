export type ExpenseStatus = 'draft' | 'pending_approval' | 'revision_required' | 'approved' | 'rejected' | 'paid' | 'closed' | 'not_reimbursable' | 'withdrawn';
export type ExpenseType = 'transport' | 'food' | 'accommodation' | 'purchase' | 'services' | 'entertainment' | 'client_expense' | 'partner_expense' | 'other';
export type PartnerExpenseCategory = 'partner_fuel' | 'partner_air' | 'partner_meetings_food' | 'partner_shop' | 'partner_misc';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other_payment';
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
    paymentDeadline?: string | null;
    amountUzs: number;
    exchangeRate: number;
    equivalentAmount: number;
    expenseType: string;
    expenseSubtype: string | null;
    isReimbursable: boolean;
    paymentMethod: string | null;
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
    rejectedAt: string | null;
    paidAt: string | null;
    paidByUserId?: number | null;
    paidBy?: ExpenseCreatedBy;
    closedAt: string | null;
    withdrawnAt: string | null;
    attachmentsCount: number;
    attachments?: AttachmentItem[];
}
export interface ExpenseFormValues {
    description: string;
    expenseDate: string;
    paymentDeadline: string;
    expenseType: string;
    expenseSubtype: string;
    isReimbursable: boolean;
    amountCurrency: ExpenseAmountCurrency;
    foreignPerUsd: string;
    amountUzs: string;
    exchangeRate: string;
    paymentMethod: string;
    projectId: string;
    expenseCategoryId: string;
    vendor: string;
    businessPurpose: string;
    comment: string;
}
export interface ExpenseFormErrors {
    description?: string;
    expenseDate?: string;
    paymentDeadline?: string;
    expenseType?: string;
    expenseSubtype?: string;
    isReimbursable?: string;
    amountUzs?: string;
    exchangeRate?: string;
    foreignPerUsd?: string;
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
export interface ListParams {
    status?: string;
    expenseType?: string;
    isReimbursable?: boolean;
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
