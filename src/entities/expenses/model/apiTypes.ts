export type ExpenseAttachmentOut = {
    id: string;
    kind: string;
    file_path: string;
};
export type ExpenseRequestOut = {
    id: number;
    public_id: string;
    status: string;
    request_date: string;
    created_by_user_id: number;
    initiator_name: string;
    department: string | null;
    budget_category: string | null;
    counterparty: string | null;
    amount: string | number;
    currency: string;
    expense_date: string;
    description: string | null;
    reimbursement_type: string;
    rejection_reason: string | null;
    reviewed_at: string | null;
    reviewed_by_user_id: number | null;
    created_at: string;
    updated_at: string | null;
    attachments: ExpenseAttachmentOut[];
};
export type ExpenseListResponse = {
    items: ExpenseRequestOut[];
    total: number;
    skip: number;
    limit: number;
};
export type ExpenseRequestCreateBody = {
    request_date: string;
    department?: string | null;
    budget_category?: string | null;
    counterparty?: string | null;
    amount: string | number;
    currency?: string;
    expense_date: string;
    description?: string | null;
    reimbursement_type: 'reimbursable' | 'non_reimbursable';
    status?: 'draft' | 'pending';
};
export type ExpenseRequestStatusPatchBody = {
    status: 'approved';
} | {
    status: 'rejected';
    rejection_reason: string;
};
export type CalendarDayOut = {
    date: string;
    total_amount: string | number;
    count: number;
    has_expenses: boolean;
};
export type CalendarReportOut = {
    year: number;
    month: number;
    days: CalendarDayOut[];
};
export type ByDateReportOut = {
    date: string;
    total_amount: string | number;
    approved_total: string | number;
    approved_count: number;
    items: ExpenseRequestOut[];
};
export type SummaryReportOut = {
    date_from: string;
    date_to: string;
    currency: string;
    total_amount: string | number;
    operations_count: number;
    approved_count: number;
};
export type DynamicsPointOut = {
    date: string;
    total_amount: string | number;
    count: number;
};
