import type { InvoiceUiStatus } from './api';
import type { TimeTrackingT } from '@shared/i18n/timeTrackingLabelHelpers';

export const INVOICE_STATUS_LABELS: Record<string, string> = {
    draft: 'Черновик',
    sent: 'Отправлен',
    issued: 'Выставлен',
    viewed: 'Просмотрен',
    partial_paid: 'Частично оплачен',
    paid: 'Оплачен',
    client_paid: 'Оплачен клиентом',
    send_to_olga: 'Ольге направить',
    client_review: 'На согласовании с Клиентом',
    awaiting_client: 'Жду подтверждения от клиента',
    canceled: 'Отменён',
    overdue: 'Просрочен',
};
export const INVOICE_STATUS_BADGE_CLASS: Record<string, string> = {
    draft: 'tt-inv__badge--muted',
    sent: 'tt-inv__badge--info',
    issued: 'tt-inv__badge--info',
    viewed: 'tt-inv__badge--indigo',
    partial_paid: 'tt-inv__badge--warn',
    paid: 'tt-inv__badge--success',
    client_paid: 'tt-inv__badge--success',
    send_to_olga: 'tt-inv__badge--neutral',
    client_review: 'tt-inv__badge--warn',
    awaiting_client: 'tt-inv__badge--warn',
    canceled: 'tt-inv__badge--neutral',
    overdue: 'tt-inv__badge--danger',
};
const BALANCE_EPS = 1e-6;
export function invoiceCanSend(status: InvoiceUiStatus): boolean {
    return status !== 'canceled' && status !== 'paid';
}
export function invoiceCanMarkViewed(status: InvoiceUiStatus): boolean {
    return status === 'sent' || status === 'partial_paid' || status === 'overdue';
}
export function invoiceCanRegisterPayment(status: InvoiceUiStatus, balanceDue: number): boolean {
    if (status === 'draft' || status === 'canceled' || status === 'paid')
        return false;
    const due = Number(balanceDue);
    return Number.isFinite(due) && due > BALANCE_EPS;
}
export function invoiceCanCancel(status: InvoiceUiStatus): boolean {
    return status !== 'canceled' && status !== 'draft';
}
export function invoiceCanRestore(status: InvoiceUiStatus): boolean {
    return status === 'canceled';
}
/** Снять отметку «отправлен клиенту» → снова черновик (без оплат). */
export function invoiceCanUnsend(status: InvoiceUiStatus): boolean {
    return status === 'sent' || status === 'viewed' || status === 'overdue';
}
/** Черновик или отменённый счёт (платежи удаляются каскадом на API). */
export function invoiceCanDeleteDraft(status: InvoiceUiStatus): boolean {
    return status === 'draft' || status === 'canceled';
}
export function invoiceCanPatchDraft(status: InvoiceUiStatus): boolean {
    return status === 'draft';
}

export function invoiceSendActionLabel(status: InvoiceUiStatus, t?: TimeTrackingT): string {
    if (t) {
        return status === 'draft'
            ? t('timeTrackingPage.invoices.actions.sendToClient')
            : t('timeTrackingPage.invoices.actions.resendToClient');
    }
    return status === 'draft' ? 'Отправить клиенту' : 'Переотправить клиенту';
}
