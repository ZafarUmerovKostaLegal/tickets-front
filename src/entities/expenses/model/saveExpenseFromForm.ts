import { computeAmountUzsForApi, parseExpenseMoney } from './expenseCurrency';
import { reimbursementCardDigits } from './expensePaymentDetails';
import {
    createExpense,
    submitExpense,
    updateExpense,
    uploadAttachment,
    type ExpenseCreateBody,
} from './expensesApi';
import type { ExpenseFilesByKind, ExpenseFormValues, ExpenseRequest } from './types';

export function expenseFormValuesToApiBody(values: ExpenseFormValues): ExpenseCreateBody {
    const isPartner = values.expenseType === 'partner_expense';
    const isClient = values.expenseType === 'client_expense';
    const partnerUserIdRaw = values.partnerUserId.trim();
    const partnerUserId = isPartner && partnerUserIdRaw ? Number(partnerUserIdRaw) : undefined;
    return {
        description: values.description,
        expenseDate: values.expenseDate,
        amountUzs: computeAmountUzsForApi(values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd),
        exchangeRate: parseExpenseMoney(values.exchangeRate) || 0,
        expenseType: values.expenseType,
        expenseSubtype: isPartner ? values.expenseSubtype.trim() || null : null,
        isReimbursable: values.isReimbursable,
        paymentMethod: values.paymentMethod,
        reimbursementCardNumber: values.paymentMethod === 'cash'
            ? reimbursementCardDigits(values.reimbursementCardNumber)
            : undefined,
        projectId: isPartner || !isClient ? undefined : values.projectId || undefined,
        expenseCategoryId: isPartner || !isClient || !values.expenseCategoryId?.trim()
            ? undefined
            : values.expenseCategoryId.trim(),
        vendor: isClient && values.vendor ? values.vendor : undefined,
        businessPurpose: values.businessPurpose || undefined,
        comment: values.comment || undefined,
        ...(partnerUserId != null && Number.isFinite(partnerUserId) && partnerUserId > 0
            ? { partnerUserId }
            : {}),
    };
}

export type SaveExpenseFromFormOptions = {
    values: ExpenseFormValues;
    files: ExpenseFilesByKind;
    /** Existing expense to update; omit to create a new one. */
    expenseId?: string | null;
    /** Send for approval after saving; draft saves keep the expense editable. */
    submit: boolean;
};

/** Create or update an expense, upload its attachments, then optionally send it for approval. */
export async function saveExpenseFromForm({
    values,
    files,
    expenseId,
    submit,
}: SaveExpenseFromFormOptions): Promise<ExpenseRequest> {
    const body = expenseFormValuesToApiBody(values);
    let saved = expenseId
        ? await updateExpense(expenseId, body)
        : await createExpense(body);
    for (const file of files.payment_document) {
        saved = await uploadAttachment(saved.id, file, 'payment_document');
    }
    for (const file of files.payment_receipt) {
        saved = await uploadAttachment(saved.id, file, 'payment_receipt');
    }
    if (submit && saved.status !== 'approved') {
        saved = await submitExpense(saved.id);
    }
    return saved;
}
