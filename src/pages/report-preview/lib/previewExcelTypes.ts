export type LabeledOption = {
    id: string;
    label: string;
};
export type TimeExcelPreviewRow = {
    rowKey: string;
    timeEntryId: string;
    rowKind: 'entry' | 'aggregate';
    sourceEntryCount: number;
    userName: string;
    employeeName: string;
    authUserId: number;
    employeePosition: string;
    workDate: string;
    recordedAt: string;
    clientId: string;
    clientName: string;
    projectId: string;
    projectName: string;
    projectCode: string;
    taskId: string;
    taskName: string;
    note: string;
    description: string;
    hours: number;
    billableHours: number;
    isBillable: boolean;
    taskBillableByDefault: boolean;
    isInvoiced: boolean;
    isPaid: boolean;
    isWeekSubmitted: boolean;
    billableRate: number;
    amountToPay: number;
    costRate: number;
    costAmount: number;
    currency: string;
    externalReferenceUrl: string;
    invoiceId: string;
    invoiceNumber: string;
    
    isVoided: boolean;
    
    voidKind: 'rejected' | 'reallocated' | null;
};
export type ExpenseExcelPreviewRow = {
    rowKey: string;
    userName: string;
    categoryId: string;
    comment: string;
    total: number;
    billable: number;
    currency: string;
    /** Подпись стадии заявки (если API отдал статус в детализации). */
    statusLabel: string;
};
export type UninvoicedExcelPreviewRow = {
    rowKey: string;
    userName: string;
    taskId: string;
    comment: string;
    hours: number;
    amount: number;
    currency: string;
};
export type BudgetExcelPreviewRow = {
    rowKey: string;
    userName: string;
    taskId: string;
    hoursLogged: number;
    amountLogged: number;
    currency: string;
};
