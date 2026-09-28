import type { TimeManagerClientProjectRow, UnbilledExpenseEntryDto, UnbilledTimeEntryDto } from '@entities/time-tracking';
import { invoiceClientDescription, INVOICE_DESCRIPTION_TASK_PREFIXES } from './invoiceClientDescription';
import { parseTimeEntryDescription } from '@entities/time-tracking/lib/timesheetTimerPersist';

export type CombinedAllocation = 'hours' | 'equal';

export type CombinedInvoiceTemplate = {
    id: string;
    name: string;
    payerClientId: string;
    projectIds: string[];
    allocation: CombinedAllocation;
    feeTitle: string;
};

export type CombinedTimeLine = UnbilledTimeEntryDto & { projectId: string };
export type CombinedExpenseLine = UnbilledExpenseEntryDto & { projectId: string };

export type CombinedShare = {
    projectId: string;
    projectName: string;
    clientName: string;
    percent: number;
    fees: number;
    expenses: number;
    total: number;
};

const STORAGE_KEY = 'kl-combined-invoice-templates-v1';

export function loadCombinedInvoiceTemplates(): CombinedInvoiceTemplate[] {
    if (typeof localStorage === 'undefined')
        return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw) as CombinedInvoiceTemplate[];
        return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
    }
    catch {
        return [];
    }
}

export function saveCombinedInvoiceTemplates(items: CombinedInvoiceTemplate[]): void {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function buildCombinedShares(
    projects: TimeManagerClientProjectRow[],
    clientNameById: ReadonlyMap<string, string>,
    time: CombinedTimeLine[],
    expenses: CombinedExpenseLine[],
    allocation: CombinedAllocation,
): CombinedShare[] {
    const fees = new Map<string, number>();
    const exp = new Map<string, number>();
    for (const line of time)
        fees.set(line.projectId, (fees.get(line.projectId) ?? 0) + line.billableAmount);
    for (const line of expenses)
        exp.set(line.projectId, (exp.get(line.projectId) ?? 0) + line.equivalentAmount);
    const totalFees = [...fees.values()].reduce((sum, value) => sum + value, 0);
    const totalExp = [...exp.values()].reduce((sum, value) => sum + value, 0);
    const count = Math.max(projects.length, 1);
    return projects.map((project) => {
        const ownFees = fees.get(project.id) ?? 0;
        const ownExp = exp.get(project.id) ?? 0;
        const percent = allocation === 'equal'
            ? 100 / count
            : (totalFees > 0 ? (ownFees / totalFees) * 100 : 100 / count);
        const shareFees = allocation === 'equal' ? totalFees / count : ownFees;
        const shareExp = allocation === 'equal' ? totalExp / count : ownExp;
        return {
            projectId: project.id,
            projectName: project.name,
            clientName: clientNameById.get(project.client_id) ?? '',
            percent,
            fees: shareFees,
            expenses: shareExp,
            total: shareFees + shareExp,
        };
    });
}

export type CombinedReportLine = {
    date: string;
    user: string;
    initials?: string;
    task?: string;
    description: string;
    hours: number;
    amount: number;
};

const TASK_PREFIXES = [...INVOICE_DESCRIPTION_TASK_PREFIXES].sort((a, b) => b.length - a.length);

export function combinedTimeTaskAndNotes(raw: string | null | undefined): { task: string; description: string } {
    const { taskLine, notes } = parseTimeEntryDescription(raw);
    if (notes.trim())
        return { task: taskLine || '—', description: notes.trim() };
    const text = (raw ?? '').trim();
    for (const prefix of TASK_PREFIXES) {
        if (text.length < prefix.length || !text.toLowerCase().startsWith(prefix.toLowerCase()))
            continue;
        const after = text.slice(prefix.length);
        const ch = after[0];
        const boundary = !ch
            || /[\s:\n.\u2014\u2013-]/.test(ch)
            || ch.charCodeAt(0) > 127
            || (ch === ch.toUpperCase() && ch !== ch.toLowerCase());
        if (!boundary)
            continue;
        const rest = after.replace(/^[\s:.\u2014\u2013-]+/u, '').trim();
        return { task: prefix, description: rest || '—' };
    }
    return { task: taskLine || '—', description: invoiceClientDescription(raw) || taskLine || '—' };
}

export type CombinedReportSnapshot = {
    feeTitle: string;
    currency: string;
    projects: Array<{ name: string; lines: CombinedReportLine[] }>;
    people: Array<{
        initials: string;
        name: string;
        title: string;
        hours: number;
        rate: number;
        amount: number;
    }>;
    expenses: Array<{ description: string; date: string; amount: number }>;
    shares: Array<{ name: string; percent: number; expenses?: number; total: number }>;
    totalHours: number;
    totalFees: number;
    totalExpenses: number;
};

function initialsOf(name: string, stored: string | null | undefined): string {
    const saved = stored?.trim();
    if (saved)
        return saved;
    const letters = name.split(/\s+/).filter(Boolean).map((part) => part[0] ?? '').join('');
    return letters.toUpperCase().slice(0, 4) || '—';
}

export function buildCombinedReportSnapshot(input: {
    feeTitle: string;
    currency: string;
    projects: TimeManagerClientProjectRow[];
    time: CombinedTimeLine[];
    expenses: CombinedExpenseLine[];
    shares: CombinedShare[];
    users: Array<{ id: number; display_name?: string | null; email?: string | null; position?: string | null; initials?: string | null }>;
    totalHours: number;
    totalFees: number;
    totalExpenses: number;
}): CombinedReportSnapshot {
    const userById = new Map(input.users.map((user) => [user.id, user]));
    const personTotals = new Map<number, { hours: number; amount: number }>();
    for (const line of input.time) {
        const prev = personTotals.get(line.authUserId) ?? { hours: 0, amount: 0 };
        prev.hours += line.billableHours ?? line.hours;
        prev.amount += line.billableAmount;
        personTotals.set(line.authUserId, prev);
    }
    return {
        feeTitle: input.feeTitle.trim() || 'Fees for services',
        currency: input.currency || 'USD',
        projects: input.projects.flatMap((project) => {
            const lines = input.time.filter((line) => line.projectId === project.id);
            if (lines.length === 0)
                return [];
            return [{
                name: project.name,
                lines: lines.map((line) => {
                    const user = userById.get(line.authUserId);
                    const name = user?.display_name?.trim() || user?.email?.trim() || String(line.authUserId);
                    const split = combinedTimeTaskAndNotes(line.description);
                    return {
                        date: line.workDate.slice(0, 10),
                        user: name,
                        initials: initialsOf(name, user?.initials),
                        task: split.task,
                        description: split.description,
                        hours: line.billableHours ?? line.hours,
                        amount: line.billableAmount,
                    };
                }),
            }];
        }),
        people: [...personTotals.entries()].map(([id, totals]) => {
            const user = userById.get(id);
            const name = user?.display_name?.trim() || user?.email?.trim() || String(id);
            return {
                initials: initialsOf(name, user?.initials),
                name,
                title: user?.position?.trim() || '—',
                hours: totals.hours,
                rate: totals.hours > 0 ? totals.amount / totals.hours : 0,
                amount: totals.amount,
            };
        }),
        expenses: input.expenses.map((line) => ({
            description: line.description?.trim() || '—',
            date: line.expenseDate.slice(0, 10),
            amount: line.equivalentAmount,
        })),
        shares: input.shares.map((share) => ({
            name: share.projectName,
            percent: share.percent,
            expenses: share.expenses,
            total: share.total,
        })),
        totalHours: input.totalHours,
        totalFees: input.totalFees,
        totalExpenses: input.totalExpenses,
    };
}

export function combinedReportDetailLines(snapshot: CombinedReportSnapshot): CombinedReportLine[] {
    return snapshot.projects
        .flatMap((project) => project.lines)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || (a.initials || a.user).localeCompare(b.initials || b.user));
}

export function isCombinedReportSnapshot(raw: unknown): raw is CombinedReportSnapshot {
    if (!raw || typeof raw !== 'object')
        return false;
    const o = raw as Record<string, unknown>;
    return typeof o.feeTitle === 'string'
        && typeof o.currency === 'string'
        && Array.isArray(o.projects)
        && Array.isArray(o.people)
        && Array.isArray(o.shares);
}

export function formatCombinedShareNote(shares: CombinedShare[]): string {
    const lines = [
        'Shared amounts',
        ...shares.map((share) => {
            const client = share.clientName ? ` (${share.clientName})` : '';
            return `${share.projectName}${client}: ${share.percent.toFixed(2)}% · fees ${share.fees.toFixed(2)} · expenses ${share.expenses.toFixed(2)} · TO BE INVOICED ${share.total.toFixed(2)}`;
        }),
    ];
    return lines.join('\n');
}
