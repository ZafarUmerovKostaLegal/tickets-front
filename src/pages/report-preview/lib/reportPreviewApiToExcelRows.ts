import {
    displayReportClientLabel,
    displayReportProjectLabel,
    formatExpenseReportStatus,
    type BudgetRow,
    type ExpRowCategories,
    type ExpRowClients,
    type ExpRowProjects,
    type ExpRowTeam,
    type RUBBudget,
    type RUBExpense,
    type RUBTime,
    type RUBUninvoiced,
    type TimeReportEntryLogItem,
    type TimeRowClients,
    type TimeRowProjects,
    type UninvoicedRow,
} from '@entities/time-tracking';
import type { ExpenseGroup, TimeGroup, } from '@entities/time-tracking/model/reportsPanelConfig';
import {
    deriveBillableAmountForEntry,
    deriveBillableHoursForEntry,
    entryBillableTriState,
    entryTaskLabel,
} from '@entities/time-tracking/lib/timeReportEntryLogFormat';
import type {
    BudgetExcelPreviewRow,
    ExpenseExcelPreviewRow,
    TimeExcelPreviewRow,
    UninvoicedExcelPreviewRow,
} from './previewExcelTypes';

function str(v: unknown): string {
    if (v == null)
        return '';
    return String(v).trim();
}

function boolFromEntry(it: TimeReportEntryLogItem, keys: string[]): boolean {
    const r = it as Record<string, unknown>;
    for (const k of keys) {
        const v = r[k];
        if (v === true)
            return true;
        if (v === false)
            return false;
    }
    return false;
}
function numOr(it: TimeReportEntryLogItem, snake: keyof TimeReportEntryLogItem, altKeys: string[]): number {
    const v = it[snake];
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    const r = it as Record<string, unknown>;
    for (const k of altKeys) {
        const x = r[k];
        if (typeof x === 'number' && Number.isFinite(x))
            return x;
    }
    return 0;
}
function buildTimeExcelRow(params: {
    it: TimeReportEntryLogItem;
    u: RUBTime;
    rollup: { total_hours: number; billable_hours: number; billable_amount: number };
    row: TimeRowClients | TimeRowProjects;
    parentClientId: string;
    parentClientName: string;
    parentProjectId: string;
    parentProjectName: string;
    idx: number;
    rowKind: 'entry' | 'aggregate';
}): TimeExcelPreviewRow {
    const { it, u, rollup, row, parentClientId, parentClientName, parentProjectId, parentProjectName, idx, rowKind, } = params;
    const bh = deriveBillableHoursForEntry(it, rollup) ?? 0;
    const ba = deriveBillableAmountForEntry(it, rollup) ?? 0;
    const rateFromApi = numOr(it, 'billable_rate', ['billableRate']);
    const rate = rateFromApi > 0
        ? rateFromApi
        : bh > 0
            ? Math.round((ba / bh) * 10000) / 10000
            : 0;
    const tri = entryBillableTriState(it);
    const isBillable = tri === true || (tri === null && bh > 1e-6);
    const pId = str(it.project_id) || parentProjectId;
    const pName = str(it.project_name) || parentProjectName;
    const cId = str(it.client_id) || parentClientId;
    const cName = str(it.client_name) || parentClientName;
    const tid = str(it.task_id);
    const tname = str(it.task_name);
    const taskTitle = entryTaskLabel(it, undefined, parentProjectId || parentProjectName ? { id: parentProjectId, name: parentProjectName } : undefined);
    const entryId = str(it.id) || str(it.time_entry_id);
    const rowKey = entryId
        ? `e-${entryId}`
        : rowKind === 'aggregate'
            ? `pb-${u.user_id}-${pId}-${idx}`
            : `e-${u.user_id}-${idx}-${pId}-${str(it.work_date)}`;
    const wd = str(it.work_date).slice(0, 10);
    const rec = str(it.recorded_at) || (wd ? `${wd}T12:00:00.000Z` : '');
    const note = str(it.notes) || str(it.description);
    const srcN = it.source_entry_count;
    const sourceEntryCount = typeof srcN === 'number' && Number.isFinite(srcN) && srcN > 0
        ? Math.round(srcN)
        : rowKind === 'entry'
            ? 1
            : 0;
    const authId = it.auth_user_id != null && Number.isFinite(Number(it.auth_user_id))
        ? Math.round(Number(it.auth_user_id))
        : u.user_id;
    const empName = str(it.employee_name) || u.user_name;
    const empPos = str(it.employee_position);
    const itRec = it as TimeReportEntryLogItem & Record<string, unknown>;
    const voidedAt = str(it.voided_at) || str(itRec.voidedAt);
    const vk = str(it.void_kind) || str(itRec.voidKind);
    const isVoided = Boolean(voidedAt) || it.is_voided === true || itRec.isVoided === true;
    const voidKind: 'rejected' | 'reallocated' | null = isVoided
        ? (vk === 'reallocated' ? 'reallocated' : 'rejected')
        : null;
    return {
        rowKey,
        timeEntryId: entryId,
        rowKind,
        sourceEntryCount,
        userName: u.user_name,
        employeeName: empName,
        authUserId: authId,
        employeePosition: empPos,
        workDate: wd,
        recordedAt: rec,
        clientId: cId,
        clientName: cName,
        projectId: pId,
        projectName: pName,
        projectCode: str(it.project_code) || entryString(it, ['project_code', 'projectCode']),
        taskId: tid || (tname ? `task:${tname.slice(0, 24)}` : ''),
        taskName: taskTitle,
        note,
        description: note,
        hours: Number.isFinite(it.hours) ? it.hours : 0,
        billableHours: bh,
        isBillable,
        taskBillableByDefault: boolFromEntry(it, ['task_billable_by_default', 'taskBillableByDefault']),
        isInvoiced: boolFromEntry(it, ['is_invoiced', 'isInvoiced', 'invoiced']),
        isPaid: boolFromEntry(it, ['is_paid', 'isPaid', 'paid']),
        isWeekSubmitted: boolFromEntry(it, ['is_week_submitted', 'isWeekSubmitted', 'week_submitted']),
        billableRate: rate,
        amountToPay: ba,
        costRate: numOr(it, 'cost_rate', ['costRate']),
        costAmount: numOr(it, 'cost_amount', ['costAmount']),
        currency: str(it.billable_currency ?? it.billableCurrency ?? it.currency ?? u.currency ?? row.currency),
        externalReferenceUrl: str(it.external_reference_url) || entryString(it, ['external_reference_url', 'externalReferenceUrl', 'url']),
        invoiceId: str(it.invoice_id) || entryString(it, ['invoice_id', 'invoiceId']),
        invoiceNumber: str(it.invoice_number) || entryString(it, ['invoice_number', 'invoiceNumber']),
        isVoided,
        voidKind,
    };
}

function entryString(it: TimeReportEntryLogItem, keys: string[]): string {
    const r = it as Record<string, unknown>;
    for (const k of keys) {
        const v = r[k];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return '';
}

export function flattenTimeReportToExcelRows(groupBy: TimeGroup, rows: (TimeRowClients | TimeRowProjects)[],): TimeExcelPreviewRow[] {
    const out: TimeExcelPreviewRow[] = [];
    for (const row of rows) {
        const users = row.users ?? [];
        const parentClientId = str(row.client_id);
        const parentClientName = str(row.client_name);
        const parentProjectId = groupBy === 'projects' ? str((row as TimeRowProjects).project_id) : '';
        const parentProjectName = groupBy === 'projects' ? str((row as TimeRowProjects).project_name) : '';
        for (const u of users) {
            const rollup = {
                total_hours: u.total_hours,
                billable_hours: u.billable_hours,
                billable_amount: u.billable_amount,
            };
            const uExt = u as RUBTime;
            const breakdown = groupBy === 'clients' ? (uExt.project_breakdown ?? []) : [];
            const entries = u.entries ?? [];
            if (groupBy === 'clients' && breakdown.length > 0) {
                for (let idx = 0; idx < breakdown.length; idx++) {
                    out.push(buildTimeExcelRow({
                        it: breakdown[idx]!,
                        u,
                        rollup,
                        row,
                        parentClientId,
                        parentClientName,
                        parentProjectId,
                        parentProjectName,
                        idx,
                        rowKind: 'aggregate',
                    }));
                }
                continue;
            }
            for (let idx = 0; idx < entries.length; idx++) {
                out.push(buildTimeExcelRow({
                    it: entries[idx]!,
                    u,
                    rollup,
                    row,
                    parentClientId,
                    parentClientName,
                    parentProjectId,
                    parentProjectName,
                    idx,
                    rowKind: 'entry',
                }));
            }
        }
    }
    return out;
}

function expenseExcelComment(coreLine: string | undefined, u: RUBExpense): string {
    const projLine = displayReportProjectLabel(u.project_name, u.project_id);
    const core = (coreLine ?? '').trim();
    const hasProj = projLine !== 'Проект не в учёте времени';
    if (hasProj && core)
        return `Расход · ${projLine} — ${core}`;
    if (hasProj)
        return `Расход · ${projLine}`;
    if (core)
        return `Расход — ${core}`;
    return 'Расход';
}

export function flattenExpenseReportToExcelRows(groupBy: ExpenseGroup, rows: ExpRowClients[] | ExpRowProjects[] | ExpRowCategories[] | ExpRowTeam[],): ExpenseExcelPreviewRow[] {
    const out: ExpenseExcelPreviewRow[] = [];
    if (groupBy === 'team') {
        for (const r of rows as ExpRowTeam[]) {
            out.push({
                rowKey: `team-${r.user_id}`,
                userName: r.user_name,
                categoryId: 'team',
                comment: r.is_contractor ? 'Подрядчик' : '',
                total: r.total_amount,
                billable: r.billable_amount,
                currency: r.currency,
                statusLabel: '—',
            });
        }
        return out;
    }
    if (groupBy === 'clients') {
        for (const row of rows as ExpRowClients[]) {
            for (const u of row.users ?? []) {
                out.push(expenseUserRow(row.client_id, expenseExcelComment(displayReportClientLabel(row.client_name, row.client_id), u), row.currency, u));
            }
        }
        return out;
    }
    if (groupBy === 'categories') {
        for (const row of rows as ExpRowCategories[]) {
            const cid = row.expense_category_id ?? `cat:${row.expense_category_name}`;
            for (const u of row.users ?? []) {
                out.push(expenseUserRow(cid, expenseExcelComment(row.expense_category_name || '—', u), row.currency, u));
            }
        }
        return out;
    }
    for (const row of rows as ExpRowProjects[]) {
        for (const u of row.users ?? []) {
            const line = `${displayReportProjectLabel(row.project_name, row.project_id)} — ${displayReportClientLabel(row.client_name, row.client_id)}`;
            out.push(expenseUserRow(row.project_id, expenseExcelComment(line, u), row.currency, u));
        }
    }
    return out;
}

function expenseUserRow(categoryId: string, comment: string, currency: string, u: RUBExpense): ExpenseExcelPreviewRow {
    return {
        rowKey: `exp-${categoryId}-${u.user_id}`,
        userName: u.user_name?.trim() ? u.user_name : `Сотрудник ${u.user_id}`,
        categoryId,
        comment,
        total: u.total_amount,
        billable: u.billable_amount,
        currency,
        statusLabel: formatExpenseReportStatus(u.status ?? u.expense_status),
    };
}

export function flattenUninvoicedToExcelRows(rows: UninvoicedRow[]): UninvoicedExcelPreviewRow[] {
    const out: UninvoicedExcelPreviewRow[] = [];
    for (const row of rows) {
        for (const u of row.users ?? []) {
            out.push(uninvoicedUserRow(row, u));
        }
    }
    return out;
}

function uninvoicedUserRow(row: UninvoicedRow, u: RUBUninvoiced): UninvoicedExcelPreviewRow {
    return {
        rowKey: `uinv-${row.project_id}-${u.user_id}`,
        userName: u.user_name,
        taskId: row.project_id,
        comment: `${row.project_name} — ${row.client_name}`,
        hours: u.uninvoiced_hours,
        amount: u.uninvoiced_amount,
        currency: u.currency ?? row.currency,
    };
}

export function flattenBudgetToExcelRows(rows: BudgetRow[]): BudgetExcelPreviewRow[] {
    const out: BudgetExcelPreviewRow[] = [];
    for (const row of rows) {
        for (const u of row.users ?? []) {
            out.push(budgetUserRow(row, u));
        }
    }
    return out;
}

function budgetUserRow(row: BudgetRow, u: RUBBudget): BudgetExcelPreviewRow {
    return {
        rowKey: `bud-${row.project_id}-${u.user_id}`,
        userName: u.user_name,
        taskId: row.project_id,
        hoursLogged: u.hours_logged,
        amountLogged: u.amount_logged,
        currency: u.currency ?? row.currency ?? '',
    };
}
