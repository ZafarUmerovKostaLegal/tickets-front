import { STATUS_META } from '@entities/expenses/model/constants';

const STATUS_LOOKUP = STATUS_META as Record<string, {
    label: string;
} | undefined>;

export function formatExpenseReportStatus(status: string | null | undefined): string {
    if (status == null || !String(status).trim())
        return '—';
    const s = String(status).trim();
    return STATUS_LOOKUP[s]?.label ?? s;
}

/** Пояснение для подсказки в отчётах TT (не путать с оплатой счёта клиентом). */
export function formatExpenseReportStatusHint(status: string | null | undefined): string | undefined {
    const s = String(status ?? '').trim().toLowerCase();
    if (s === 'paid')
        return 'Внутренняя выплата автору заявки, не оплата счёта клиентом (см. раздел «Счета»).';
    return undefined;
}

export function displayReportProjectLabel(projectName: string | null | undefined, projectId: string | null | undefined): string {
    const name = projectName != null ? String(projectName).trim() : '';
    if (name)
        return name;
    const id = projectId != null ? String(projectId).trim() : '';
    if (id)
        return `Проект ${id} (нет в учёте времени)`;
    return 'Проект не в учёте времени';
}

export function displayReportClientLabel(clientName: string | null | undefined, clientId: string | null | undefined): string {
    const name = clientName != null ? String(clientName).trim() : '';
    if (name)
        return name;
    const id = clientId != null ? String(clientId).trim() : '';
    if (id)
        return `Клиент ${id}`;
    return '—';
}
