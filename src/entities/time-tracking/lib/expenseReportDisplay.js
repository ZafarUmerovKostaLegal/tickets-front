import { STATUS_META } from '@entities/expenses/model/constants';
const STATUS_LOOKUP = STATUS_META;
export function formatExpenseReportStatus(status) {
    if (status == null || !String(status).trim())
        return '—';
    const s = String(status).trim();
    return STATUS_LOOKUP[s]?.label ?? s;
}
export function formatExpenseReportStatusHint(status) {
    const s = String(status ?? '').trim().toLowerCase();
    if (s === 'paid')
        return 'Внутренняя выплата автору заявки, не оплата счёта клиентом (см. раздел «Счета»).';
    return undefined;
}
export function displayReportProjectLabel(projectName, projectId) {
    const name = projectName != null ? String(projectName).trim() : '';
    if (name)
        return name;
    const id = projectId != null ? String(projectId).trim() : '';
    if (id)
        return `Проект ${id} (нет в учёте времени)`;
    return 'Проект не в учёте времени';
}
export function displayReportClientLabel(clientName, clientId) {
    const name = clientName != null ? String(clientName).trim() : '';
    if (name)
        return name;
    const id = clientId != null ? String(clientId).trim() : '';
    if (id)
        return `Клиент ${id}`;
    return '—';
}
