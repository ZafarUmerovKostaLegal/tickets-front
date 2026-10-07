import { invoiceClientDescription, INVOICE_DESCRIPTION_TASK_PREFIXES } from './invoiceClientDescription';
import { parseTimeEntryDescription } from '@entities/time-tracking/lib/timesheetTimerPersist';
const STORAGE_KEY = 'kl-combined-invoice-templates-v1';
export function loadCombinedInvoiceTemplates() {
    if (typeof localStorage === 'undefined')
        return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
    }
    catch {
        return [];
    }
}
export function saveCombinedInvoiceTemplates(items) {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
export function buildCombinedShares(projects, clientNameById, time, expenses, allocation) {
    const fees = new Map();
    const exp = new Map();
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
const TASK_PREFIXES = [...INVOICE_DESCRIPTION_TASK_PREFIXES].sort((a, b) => b.length - a.length);
export function combinedTimeTaskAndNotes(raw) {
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
function initialsOf(name, stored) {
    const saved = stored?.trim();
    if (saved)
        return saved;
    const letters = name.split(/\s+/).filter(Boolean).map((part) => part[0] ?? '').join('');
    return letters.toUpperCase().slice(0, 4) || '—';
}
export function buildCombinedReportSnapshot(input) {
    const userById = new Map(input.users.map((user) => [user.id, user]));
    const personTotals = new Map();
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
export function combinedReportDetailLines(snapshot) {
    return snapshot.projects
        .flatMap((project) => project.lines)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || (a.initials || a.user).localeCompare(b.initials || b.user));
}
export function isCombinedReportSnapshot(raw) {
    if (!raw || typeof raw !== 'object')
        return false;
    const o = raw;
    return typeof o.feeTitle === 'string'
        && typeof o.currency === 'string'
        && Array.isArray(o.projects)
        && Array.isArray(o.people)
        && Array.isArray(o.shares);
}
export function formatCombinedShareNote(shares) {
    const lines = [
        'Shared amounts',
        ...shares.map((share) => {
            const client = share.clientName ? ` (${share.clientName})` : '';
            return `${share.projectName}${client}: ${share.percent.toFixed(2)}% · fees ${share.fees.toFixed(2)} · expenses ${share.expenses.toFixed(2)} · TO BE INVOICED ${share.total.toFixed(2)}`;
        }),
    ];
    return lines.join('\n');
}
