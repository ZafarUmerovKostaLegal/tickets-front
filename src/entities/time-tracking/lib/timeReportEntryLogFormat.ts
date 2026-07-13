import type { TimeReportEntryLogItem } from '@entities/time-tracking';
import { displayReportProjectLabel } from '@entities/time-tracking/lib/expenseReportDisplay';
import type { TimeTrackingT } from '@shared/i18n/timeTrackingLabelHelpers';

export type BillablePaidKind = 'yes' | 'no' | 'partial' | 'unknown';

export type TimeEntryLogGroupContext = {
    project_name?: string | null;
    client_name?: string | null;
    task_name?: string | null;
};

export type UserBillableRollup = {
    total_hours: number;
    billable_hours: number;
    billable_amount: number;
};

export type TimeEntryLogGroupBy = 'clients' | 'projects' | 'tasks' | 'team';

export type EntryTaskParentProject = {
    id: string;
    name: string;
};

export function isTimeReportExpenseEntry(it: TimeReportEntryLogItem): boolean {
    const er = it.expense_request_id;
    if (er != null && String(er).trim())
        return true;
    const r = it as Record<string, unknown>;
    const pickId = (): boolean => {
        for (const k of ['expense_request_id', 'expenseRequestId', 'expense_id', 'expenseId']) {
            const v = r[k];
            if (v != null && String(v).trim())
                return true;
        }
        return false;
    };
    if (pickId())
        return true;
    const kind = String(it.entry_kind ?? it.line_kind ?? r.entryKind ?? r.line_kind ?? r.record_kind ?? r.recordKind ?? '').trim().toLowerCase();
    return kind === 'expense';
}

function rawTaskLabelFromEntry(it: TimeReportEntryLogItem, ctx?: TimeEntryLogGroupContext): string {
    const r = it as Record<string, unknown>;
    const nameKeys = [
        'taskName',
        'task_name',
        'task_title',
        'task_summary',
        'task_label',
        'activity_name',
        'ticket_title',
    ];
    for (const k of nameKeys) {
        const v = r[k];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    const fromCtx = (it.task_name ?? ctx?.task_name ?? '').trim();
    if (fromCtx)
        return fromCtx;
    const tid = it.task_id ?? (typeof r.task_id === 'string' ? r.task_id : undefined);
    if (tid)
        return `#${String(tid).replace(/-/g, '').slice(0, 8)}`;
    return '—';
}

export function entryBillableTriState(it: TimeReportEntryLogItem): boolean | null {
    const r = it as Record<string, unknown>;
    if (it.is_billable === true || it.billable === true || r.isBillable === true)
        return true;
    if (it.is_billable === false || it.billable === false || r.isBillable === false)
        return false;
    return null;
}

export function entryComment(it: TimeReportEntryLogItem): string {
    const r = it as Record<string, unknown>;
    const keys = [
        'notes',
        'description',
        'memo',
        'message',
        'body',
        'comment',
        'public_notes',
        'private_notes',
        'narrative',
        'activity_notes',
        'work_description',
        'details',
        'text',
        'summary',
    ];
    const parts: string[] = [];
    for (const k of keys) {
        const v = r[k];
        if (typeof v === 'string' && v.trim())
            parts.push(v.trim());
    }
    const uniq = [...new Set(parts)];
    if (uniq.length === 0)
        return '';
    if (uniq.length === 1)
        return uniq[0];
    return uniq.join(' — ');
}

export function entryTaskLabel(it: TimeReportEntryLogItem, ctx?: TimeEntryLogGroupContext, fallbackProject?: EntryTaskParentProject | null): string {
    if (!isTimeReportExpenseEntry(it))
        return rawTaskLabelFromEntry(it, ctx);
    const pn = (it.project_name ?? fallbackProject?.name ?? '').trim();
    const pid = String(it.project_id ?? fallbackProject?.id ?? '').trim();
    const projLine = displayReportProjectLabel(pn || null, pid || null);
    const raw = rawTaskLabelFromEntry(it, ctx);
    const hasProj = projLine !== 'Проект не в учёте времени';
    if (hasProj)
        return raw && raw !== '—' ? `Расход · ${projLine} — ${raw}` : `Расход · ${projLine}`;
    return raw && raw !== '—' ? `Расход — ${raw}` : 'Расход';
}

export function resolveReportBillableHours(
    billableHours: number,
    amountToPay: number,
    billableRate: number,
): number {
    if (billableRate > 1e-9 && amountToPay > 1e-9)
        return amountToPay / billableRate;
    return billableHours;
}

export function deriveBillableHoursForEntry(it: TimeReportEntryLogItem, userRollup: UserBillableRollup | null | undefined): number | null {
    const raw = it.billable_hours;
    if (raw != null && Number.isFinite(raw))
        return raw;
    const tri = entryBillableTriState(it);
    if (tri === true && it.hours > 0 && Number.isFinite(it.hours))
        return it.hours;
    if (tri === false)
        return 0;
    if (!userRollup || userRollup.total_hours <= 0 || !Number.isFinite(it.hours) || it.hours <= 0)
        return null;
    return it.hours * (userRollup.billable_hours / userRollup.total_hours);
}

export function deriveBillableAmountForEntry(it: TimeReportEntryLogItem, userRollup: UserBillableRollup | null | undefined): number | null {
    if (it.amount_to_pay != null && Number.isFinite(it.amount_to_pay))
        return it.amount_to_pay;
    if (it.billable_amount != null && Number.isFinite(it.billable_amount))
        return it.billable_amount;
    if (!userRollup || userRollup.total_hours <= 0 || !Number.isFinite(it.hours) || it.hours <= 0)
        return null;
    return it.hours * (userRollup.billable_amount / userRollup.total_hours);
}

export function billablePaidKind(it: TimeReportEntryLogItem, billH: number | null, hours: number): BillablePaidKind {
    const tri = entryBillableTriState(it);
    if (tri === true)
        return 'yes';
    if (tri === false)
        return 'no';
    if (billH == null || !Number.isFinite(hours) || hours <= 0)
        return 'unknown';
    if (Math.abs(billH - hours) < 1e-5)
        return 'yes';
    if (billH < 1e-5)
        return 'no';
    return 'partial';
}

export function billablePaidLabel(kind: BillablePaidKind, t: TimeTrackingT): string {
    switch (kind) {
        case 'yes':
            return t('timeTrackingPage.reports.entryLog.billableYes');
        case 'no':
            return t('timeTrackingPage.reports.entryLog.billableNo');
        case 'partial':
            return t('timeTrackingPage.reports.entryLog.billablePartial');
        default:
            return '—';
    }
}

export function billableChipClass(kind: BillablePaidKind): string {
    if (kind === 'yes')
        return 'rp2-chip rp2-chip--ok';
    if (kind === 'no')
        return 'rp2-chip rp2-chip--off';
    if (kind === 'partial')
        return 'rp2-chip rp2-chip--partial';
    return 'rp2-chip rp2-chip--muted';
}
