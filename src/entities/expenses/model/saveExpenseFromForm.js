import { computeAmountUzsForApi, parseExpenseMoney, roundMoney2 } from './expenseCurrency';
import { reimbursementCardDigits } from './expensePaymentDetails';
import { createExpense, submitExpense, updateExpense, uploadAttachment, } from './expensesApi';
import { EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG, EXPENSE_ATTACHMENT_MAX_COUNT } from './types';
/** Prefer exact locked UZS over FX rebuild from rounded USD/foreign. */
export function resolveAmountUzsForApi(values) {
    const locked = values.lockedAmountUzs;
    if (locked != null && Number.isFinite(locked) && locked > 0)
        return roundMoney2(locked);
    return computeAmountUzsForApi(values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd);
}
export function expenseFormValuesToApiBody(values) {
    const isPartner = values.expenseType === 'partner_expense';
    const isClient = values.expenseType === 'client_expense';
    const partnerUserIdRaw = values.partnerUserId.trim();
    const partnerUserId = isPartner && partnerUserIdRaw ? Number(partnerUserIdRaw) : undefined;
    return {
        description: values.description,
        expenseDate: values.expenseDate,
        amountUzs: resolveAmountUzsForApi(values),
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
/** Create or update an expense, upload its attachments, then optionally send it for approval. */
export async function saveExpenseFromForm({ values, files, expenseId, submit, }) {
    const body = expenseFormValuesToApiBody(values);
    let saved = expenseId
        ? await updateExpense(expenseId, body)
        : await createExpense(body);
    const pending = files.payment_document.length + files.payment_receipt.length;
    const existing = saved.attachments?.length ?? saved.attachmentsCount ?? 0;
    if (existing + pending > EXPENSE_ATTACHMENT_MAX_COUNT)
        throw new Error(EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG);
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
