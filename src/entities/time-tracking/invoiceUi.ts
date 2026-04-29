import type { InvoiceUiStatus } from './api';
export const INVOICE_STATUS_LABELS: Record<string, string> = {
    draft: 'Черновик',
    sent: 'Отправлен',
    viewed: 'Просмотрен',
    partial_paid: 'Частично оплачен',
    paid: 'Оплачен',
    canceled: 'Отменён',
    overdue: 'Просрочен',
};
export const INVOICE_STATUS_BADGE_CLASS: Record<string, string> = {
    draft: 'tt-inv__badge--muted',
    sent: 'tt-inv__badge--info',
    viewed: 'tt-inv__badge--indigo',
    partial_paid: 'tt-inv__badge--warn',
    paid: 'tt-inv__badge--success',
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
    return Number.isFinite(balanceDue) && balanceDue > BALANCE_EPS;
}
export function invoiceCanCancel(status: InvoiceUiStatus): boolean {
    return status !== 'canceled' && status !== 'draft';
}
export function invoiceCanDeleteDraft(status: InvoiceUiStatus): boolean {
    return status === 'draft';
}
export function invoiceCanPatchDraft(status: InvoiceUiStatus): boolean {
    return status === 'draft';
}
export function invoiceSendActionLabel(status: InvoiceUiStatus): string {
    return status === 'draft' ? 'Отправить клиенту' : 'Переотправить клиенту';
}
