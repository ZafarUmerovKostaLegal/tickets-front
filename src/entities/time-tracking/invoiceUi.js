export const INVOICE_STATUS_LABELS = {
    draft: 'Черновик',
    sent: 'Отправлен',
    viewed: 'Просмотрен',
    partial_paid: 'Частично оплачен',
    paid: 'Оплачен',
    canceled: 'Отменён',
    overdue: 'Просрочен',
};
export const INVOICE_STATUS_BADGE_CLASS = {
    draft: 'tt-inv__badge--muted',
    sent: 'tt-inv__badge--info',
    viewed: 'tt-inv__badge--indigo',
    partial_paid: 'tt-inv__badge--warn',
    paid: 'tt-inv__badge--success',
    canceled: 'tt-inv__badge--neutral',
    overdue: 'tt-inv__badge--danger',
};
const BALANCE_EPS = 1e-6;
export function invoiceCanSend(status) {
    return status !== 'canceled' && status !== 'paid';
}
export function invoiceCanMarkViewed(status) {
    return status === 'sent' || status === 'partial_paid' || status === 'overdue';
}
export function invoiceCanRegisterPayment(status, balanceDue) {
    if (status === 'draft' || status === 'canceled' || status === 'paid')
        return false;
    const due = Number(balanceDue);
    return Number.isFinite(due) && due > BALANCE_EPS;
}
export function invoiceCanCancel(status) {
    return status !== 'canceled' && status !== 'draft';
}
/** Снять отметку «отправлен клиенту» → снова черновик (без оплат). */
export function invoiceCanUnsend(status) {
    return status === 'sent' || status === 'viewed' || status === 'overdue';
}
/** Черновик или отменённый счёт (платежи удаляются каскадом на API). */
export function invoiceCanDeleteDraft(status) {
    return status === 'draft' || status === 'canceled';
}
export function invoiceCanPatchDraft(status) {
    return status === 'draft';
}
export function invoiceSendActionLabel(status, t) {
    if (t) {
        return status === 'draft'
            ? t('timeTrackingPage.invoices.actions.sendToClient')
            : t('timeTrackingPage.invoices.actions.resendToClient');
    }
    return status === 'draft' ? 'Отправить клиенту' : 'Переотправить клиенту';
}
