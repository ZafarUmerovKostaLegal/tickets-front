import { fetchTimeEntry } from '@entities/time-tracking/api/domains/timeEntries';
import { listProjectTasksCached } from '@entities/time-tracking/lib/projectTasksCache';
import { resolveReportEmployeeInitials } from '@entities/time-tracking/lib/reportEmployeeInitials';
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
function noteFromTimeDescription(raw) {
    const { taskLine, notes } = parseTimeEntryDescription(raw);
    if (notes.trim())
        return notes.trim();
    return (raw ?? '').trim() || taskLine.trim();
}
/** Task is the linked task name. The note stays in Description and is not copied into Task. */
export function combinedTimeTaskAndNotes(raw, taskName) {
    const linked = (taskName ?? '').trim();
    const note = noteFromTimeDescription(raw);
    if (linked) {
        const description = note.toLowerCase() === linked.toLowerCase() ? note : (note || '—');
        return { task: linked, description: description || '—' };
    }
    const { taskLine, notes } = parseTimeEntryDescription(raw);
    if (notes.trim())
        return { task: '', description: notes.trim() };
    return { task: '', description: (raw ?? '').trim() || taskLine.trim() || '—' };
}
function normTaskNote(raw) {
    return noteFromTimeDescription(raw).trim().toLowerCase().replace(/\s+/g, ' ');
}
/** Replace only the Task column on a saved combined report. Hours, rates and amounts stay. */
export function applyLinkedTaskNames(report, hints) {
    if (!hints.length)
        return report;
    const used = new Set();
    let changed = false;
    const projects = report.projects.map((project) => ({
        ...project,
        lines: project.lines.map((line) => {
            const lineDate = line.date.slice(0, 10);
            const lineNote = normTaskNote(line.description);
            let best = -1;
            let bestScore = 0;
            hints.forEach((hint, index) => {
                if (used.has(index))
                    return;
                if (hint.workDate.slice(0, 10) !== lineDate)
                    return;
                if (Math.abs(hint.hours - line.hours) > 0.02)
                    return;
                const hintNote = normTaskNote(hint.description);
                const notesMatch = Boolean(hintNote && lineNote && (hintNote === lineNote || hintNote.includes(lineNote) || lineNote.includes(hintNote)));
                if (!notesMatch)
                    return;
                const score = hintNote === lineNote ? 2 : 1;
                if (score > bestScore) {
                    bestScore = score;
                    best = index;
                }
            });
            if (best < 0)
                return line;
            used.add(best);
            const task = hints[best].taskName.trim();
            if (!task || task === (line.task ?? '').trim())
                return line;
            changed = true;
            return { ...line, task };
        }),
    }));
    return changed ? { ...report, projects } : report;
}
function initialsOf(name, stored) {
    return resolveReportEmployeeInitials({ stored, displayName: name }) || '—';
}
function nameKey(value) {
    return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}
/** Replace generated initials with the codes stored on system users, matched by name. */
export function applyStoredUserInitials(report, users) {
    const byName = new Map();
    for (const user of users) {
        const stored = resolveReportEmployeeInitials({
            stored: user.initials,
            displayName: user.display_name,
            email: user.email,
        });
        const saved = (user.initials ?? '').trim();
        if (!saved || !stored)
            continue;
        const name = user.display_name?.trim();
        if (name)
            byName.set(nameKey(name), stored);
    }
    if (byName.size === 0)
        return report;
    const codeFor = (name, current) => byName.get(nameKey(name)) ?? current;
    let changed = false;
    const projects = report.projects.map((project) => ({
        ...project,
        lines: project.lines.map((line) => {
            const initials = codeFor(line.user, line.initials);
            if (initials === line.initials)
                return line;
            changed = true;
            return { ...line, initials };
        }),
    }));
    const people = report.people.map((person) => {
        const initials = codeFor(person.name, person.initials);
        if (initials === person.initials)
            return person;
        changed = true;
        return { ...person, initials: initials || person.initials };
    });
    return changed ? { ...report, projects, people } : report;
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
        layout: input.layout === 'perProject' ? 'perProject' : 'merged',
        projects: input.projects.flatMap((project) => {
            const lines = input.time.filter((line) => line.projectId === project.id);
            if (lines.length === 0)
                return [];
            return [{
                    name: project.name,
                    lines: lines.map((line) => {
                        const user = userById.get(line.authUserId);
                        const name = user?.display_name?.trim() || user?.email?.trim() || String(line.authUserId);
                        const split = combinedTimeTaskAndNotes(line.description, line.taskName);
                        const hours = line.billableHours ?? line.hours;
                        const amount = line.billableAmount;
                        return {
                            date: line.workDate.slice(0, 10),
                            user: name,
                            initials: initialsOf(name, user?.initials),
                            task: split.task,
                            description: split.description,
                            hours,
                            rate: hours > 0 ? amount / hours : 0,
                            amount,
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
export async function linkedTaskHintsForInvoiceLines(lines, clientId, projectId) {
    const timeLines = lines.filter((line) => (line.lineKind ?? '').toLowerCase() === 'time' && line.timeEntryId);
    if (!timeLines.length)
        return [];
    const tasks = clientId.trim() && projectId.trim()
        ? await listProjectTasksCached(clientId, projectId).catch(() => [])
        : [];
    const nameById = new Map(tasks.map((task) => [task.id, task.name.trim()]));
    const hints = [];
    await Promise.all(timeLines.map(async (line) => {
        let taskName = (line.timeEntryTaskName ?? '').trim();
        let description = line.description;
        let workDate = (line.timeEntryWorkDate ?? '').slice(0, 10);
        const hours = Number(line.quantity);
        const taskLooksLikeNote = Boolean(taskName) && normTaskNote(description) === taskName.trim().toLowerCase();
        if ((!taskName || taskLooksLikeNote) && line.timeAuthorAuthUserId != null && line.timeEntryId) {
            const entry = await fetchTimeEntry(line.timeAuthorAuthUserId, line.timeEntryId).catch(() => null);
            const fromMap = entry?.task_id ? (nameById.get(entry.task_id) ?? '') : '';
            const fromEntry = (entry?.taskName ?? entry?.task_name ?? '').trim();
            const linked = fromMap || (fromEntry && fromEntry.toLowerCase() !== normTaskNote(entry?.description) ? fromEntry : '');
            if (linked)
                taskName = linked;
            if (entry?.description)
                description = entry.description;
            const entryDate = (entry?.work_date ?? '').slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(entryDate))
                workDate = entryDate;
        }
        if (!taskName || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isFinite(hours))
            return;
        hints.push({ workDate, hours, description, taskName });
    }));
    return hints;
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
