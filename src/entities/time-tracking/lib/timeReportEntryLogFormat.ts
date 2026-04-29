import type { TimeReportEntryLogItem } from '@entities/time-tracking';

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

export type TimeEntryLogGroupBy = 'clients' | 'projects';

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

export function entryTaskLabel(it: TimeReportEntryLogItem, ctx?: TimeEntryLogGroupContext): string {
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

export function billablePaidLabel(it: TimeReportEntryLogItem, billH: number | null, hours: number): string {
    const tri = entryBillableTriState(it);
    if (tri === true)
        return 'Да';
    if (tri === false)
        return 'Нет';
    if (billH == null || !Number.isFinite(hours) || hours <= 0)
        return '—';
    if (Math.abs(billH - hours) < 1e-5)
        return 'Да';
    if (billH < 1e-5)
        return 'Нет';
    return 'Частично';
}

export function billableChipClass(label: string): string {
    if (label === 'Да')
        return 'rp2-chip rp2-chip--ok';
    if (label === 'Нет')
        return 'rp2-chip rp2-chip--off';
    if (label === 'Частично')
        return 'rp2-chip rp2-chip--partial';
    return 'rp2-chip rp2-chip--muted';
}
