import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import {
    fetchTimeEntry,
    fetchUnbilledExpenses,
    fetchUnbilledTimeEntries,
    getInvoice,
    isForbiddenError,
    listTimeTrackingUsers,
    type InvoiceLineDto,
    type TimeEntryRow,
    type TimeTrackingUserRow,
    type UnbilledExpenseEntryDto,
    type UnbilledTimeEntryDto,
} from '@entities/time-tracking';
import { fetchExpenseById } from '@entities/expenses/model/expensesApi';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { parseTimeEntryDescriptionLines } from './parseTimeEntryDescriptionLines';
import { packCurrencyCode } from './invoicePreviewPackShared';
import {
    emptyInvoiceTimeReportPack,
    finalizeDetailSlots,
    formatTimeReportAmount,
    formatTimeReportHours,
    padSummaryRows,
    type InvoiceTimeReportDetailRow,
    type InvoiceTimeReportPack,
    type InvoiceTimeReportSummaryRow,
} from './invoiceTimeReportModel';

function lineKind(ln: InvoiceLineDto): string {
    const k = (ln.lineKind ?? '').toLowerCase().trim();
    if (k === 'time' || Boolean(ln.timeEntryId))
        return 'time';
    if (k === 'expense' || Boolean(ln.expenseRequestId))
        return 'expense';
    if (k === 'manual')
        return 'manual';
    return k || 'other';
}

function initialsFromUser(u: TimeTrackingUserRow): string {
    const n = (u.display_name ?? '').trim();
    if (n.length) {
        const p = n.split(/\s+/).filter(Boolean);
        if (p.length >= 2)
            return (p[0]!.slice(0, 1) + p[p.length - 1]!.slice(0, 1)).toUpperCase();
        return n.slice(0, 3).toUpperCase();
    }
    const em = u.email?.split('@')[0] ?? '?';
    return em.slice(0, 3).toUpperCase();
}

function displayUserName(u: TimeTrackingUserRow): string {
    return (u.display_name ?? '').trim() || u.email || '—';
}

function userTitle(u: TimeTrackingUserRow): string {
    return (u.position ?? '').trim() || (u.role ?? '').trim() || '—';
}

function userByAuthId(users: TimeTrackingUserRow[], authId: number): TimeTrackingUserRow | null {
    return users.find((u) => u.id === authId) ?? null;
}

function dateDisplayFromIso(iso: string | undefined | null): string {
    const s = (iso ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return '—';
    const d = new Date(`${s}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function numHoursFromLine(ln: InvoiceLineDto): number {
    const q = Number(ln.quantity);
    return Number.isFinite(q) ? q : 0;
}

function lineAmount(ln: InvoiceLineDto): number {
    const t = Number(ln.lineTotal);
    return Number.isFinite(t) ? t : 0;
}

type BuildingDetail = InvoiceTimeReportDetailRow & { authId: number | null; hoursNum: number; amtNum: number };

function toPublicRow(d: BuildingDetail): InvoiceTimeReportDetailRow {
    return {
        date: d.date,
        initials: d.initials,
        task: d.task,
        description: d.description,
        hours: d.hours,
        amount: d.amount,
    };
}

function buildSummaryAndTotals(
    details: BuildingDetail[],
    users: TimeTrackingUserRow[],
    currency: string,
): Pick<InvoiceTimeReportPack, 'summarySlots' | 'summaryGrandHoursDisplay' | 'summaryGrandAmountDisplay' | 'detailTotalHoursDisplay' | 'detailTotalAmountDisplay'> {
    const agg = new Map<number, { hours: number; amount: number; u: TimeTrackingUserRow | null }>();
    let otherAmount = 0;
    for (const d of details) {
        if (d.authId != null) {
            const cur = agg.get(d.authId) ?? { hours: 0, amount: 0, u: userByAuthId(users, d.authId) };
            cur.hours += d.hoursNum;
            cur.amount += d.amtNum;
            cur.u = cur.u ?? userByAuthId(users, d.authId);
            agg.set(d.authId, cur);
        }
        else if (d.amtNum !== 0)
            otherAmount += d.amtNum;
    }

    const summaryRows: InvoiceTimeReportSummaryRow[] = [...agg.entries()]
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([uid, v]) => {
            const u = v.u ?? userByAuthId(users, uid);
            const rate = v.hours > 0 ? v.amount / v.hours : 0;
            return {
                initials: u ? initialsFromUser(u) : String(uid).slice(0, 3),
                name: u ? displayUserName(u) : `User ${uid}`,
                title: u ? userTitle(u) : '—',
                hours: formatTimeReportHours(v.hours),
                hourlyRate: formatTimeReportAmount(rate, currency),
                totalPrice: formatTimeReportAmount(v.amount, currency),
            };
        });

    if (otherAmount !== 0) {
        summaryRows.push({
            initials: '—',
            name: 'Other charges',
            title: '—',
            hours: '',
            hourlyRate: '—',
            totalPrice: formatTimeReportAmount(otherAmount, currency),
        });
    }

    const totalH = details.reduce((s, d) => s + d.hoursNum, 0);
    const totalA = details.reduce((s, d) => s + d.amtNum, 0);
    const sumH = [...agg.values()].reduce((s, v) => s + v.hours, 0);
    const sumA = [...agg.values()].reduce((s, v) => s + v.amount, 0) + otherAmount;

    return {
        detailTotalHoursDisplay: formatTimeReportHours(totalH),
        detailTotalAmountDisplay: formatTimeReportAmount(totalA, currency),
        summaryGrandHoursDisplay: formatTimeReportHours(sumH),
        summaryGrandAmountDisplay: formatTimeReportAmount(sumA, currency),
        summarySlots: padSummaryRows(summaryRows),
    };
}

export type ResolveInvoiceTimeReportPackOptions = {
    /** 403 на unbilled при предпросмотре черновика — нет полного подтверждения партнёров за период. */
    onPartnerConfirmationBlocked?: (message: string) => void;
};

/** Заполняет данные листа Time Report из черновика/сохранённого счёта. */
export async function resolveInvoiceTimeReportPack(
    session: InvoicePreviewSessionV1 | null,
    model: InvoiceCoverLetterModel,
    options?: ResolveInvoiceTimeReportPackOptions,
): Promise<InvoiceTimeReportPack> {
    const currency = packCurrencyCode(model);
    const empty = emptyInvoiceTimeReportPack(currency);

    if (!session)
        return empty;

    try {
        const users = await listTimeTrackingUsers().catch(() => [] as TimeTrackingUserRow[]);

        if (session.mode === 'create') {
            const f = session.form;
            const pid = f.createProjectId?.trim();
            if (!pid)
                return empty;

            let timeRows: UnbilledTimeEntryDto[];
            let expRows: UnbilledExpenseEntryDto[];
            try {
                [timeRows, expRows] = await Promise.all([
                    fetchUnbilledTimeEntries({
                        projectId: pid,
                        dateFrom: f.unbilledFrom.slice(0, 10),
                        dateTo: f.unbilledTo.slice(0, 10),
                    }),
                    fetchUnbilledExpenses({
                        projectId: pid,
                        dateFrom: f.unbilledFrom.slice(0, 10),
                        dateTo: f.unbilledTo.slice(0, 10),
                    }),
                ]);
            }
            catch (e: unknown) {
                if (isForbiddenError(e)) {
                    const fallback = 'Для этого проекта и периода нет полного подтверждения партнёров. Сначала завершите подписание отчёта партнёрами.';
                    const msg = e instanceof Error && e.message.trim().length ? e.message.trim() : fallback;
                    options?.onPartnerConfirmationBlocked?.(msg);
                    return empty;
                }
                throw e;
            }

            const selT = new Set(f.selTime);
            const selE = new Set(f.selExp);
            const details: BuildingDetail[] = [];

            for (const e of timeRows.filter((x) => selT.has(x.id))) {
                const u = userByAuthId(users, e.authUserId);
                const hrs = Number(e.hours);
                const h = Number.isFinite(hrs) ? hrs : 0;
                const amt = Number(e.billableAmount);
                const a = Number.isFinite(amt) ? amt : 0;
                const { taskLine, notes } = parseTimeEntryDescriptionLines(e.description ?? null);
                details.push({
                    date: dateDisplayFromIso(e.workDate),
                    initials: u ? initialsFromUser(u) : String(e.authUserId).slice(0, 3),
                    task: taskLine,
                    description: notes.trim().length ? notes : (taskLine || (e.description ?? '').trim() || '—'),
                    hours: formatTimeReportHours(h),
                    amount: formatTimeReportAmount(a, currency),
                    authId: e.authUserId,
                    hoursNum: h,
                    amtNum: a,
                });
            }

            for (const e of expRows.filter((x) => selE.has(x.id))) {
                const amt = Number(e.equivalentAmount);
                const a = Number.isFinite(amt) ? amt : 0;
                details.push({
                    date: dateDisplayFromIso(e.expenseDate),
                    initials: '—',
                    task: 'Expense',
                    description: (e.description ?? '').trim() || '—',
                    hours: '',
                    amount: formatTimeReportAmount(a, currency),
                    authId: null,
                    hoursNum: 0,
                    amtNum: a,
                });
            }

            const tail = buildSummaryAndTotals(details, users, currency);
            return {
                currency,
                detailSlots: details.length ? finalizeDetailSlots(details.map(toPublicRow)) : empty.detailSlots,
                ...tail,
            };
        }

        const inv = await getInvoice(session.invoiceId, true);
        const lines = [...(inv.lines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        const details: BuildingDetail[] = [];

        const entryCache = new Map<string, TimeEntryRow | null>();
        async function getEntry(id: string | null | undefined, preferredAuthUserId: number | null): Promise<TimeEntryRow | null> {
            const k = (id ?? '').trim();
            if (!k)
                return null;
            if (entryCache.has(k))
                return entryCache.get(k) ?? null;
            let found: TimeEntryRow | null = null;
            const hint = preferredAuthUserId != null && Number.isFinite(preferredAuthUserId)
                ? Math.trunc(preferredAuthUserId)
                : null;
            if (hint != null)
                found = await fetchTimeEntry(hint, k);
            if (!found) {
                for (const u of users) {
                    if (hint != null && u.id === hint)
                        continue;
                    const row = await fetchTimeEntry(u.id, k);
                    if (row) {
                        found = row;
                        break;
                    }
                }
            }
            entryCache.set(k, found);
            return found;
        }

        const expenseIsoByRequestId = new Map<string, string | null>();
        async function resolveExpenseLineDateIso(ln: InvoiceLineDto): Promise<string | null> {
            const embedded = ln.expenseDate?.trim().slice(0, 10);
            if (embedded && /^\d{4}-\d{2}-\d{2}$/.test(embedded))
                return embedded;
            const rid = ln.expenseRequestId?.trim();
            if (!rid)
                return null;
            if (expenseIsoByRequestId.has(rid))
                return expenseIsoByRequestId.get(rid) ?? null;
            try {
                const req = await fetchExpenseById(rid);
                const iso = req.expenseDate?.trim().slice(0, 10) ?? '';
                const ok = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
                expenseIsoByRequestId.set(rid, ok);
                return ok;
            }
            catch {
                expenseIsoByRequestId.set(rid, null);
                return null;
            }
        }

        for (const ln of lines) {
            const kind = lineKind(ln);
            const desc = (ln.description ?? '').trim() || '—';
            const amt = lineAmount(ln);

            if (kind === 'time') {
                const embeddedIso = ln.timeEntryWorkDate?.trim().slice(0, 10);
                let workIso = embeddedIso && /^\d{4}-\d{2}-\d{2}$/.test(embeddedIso) ? embeddedIso : null;
                let authId =
                    ln.timeAuthorAuthUserId != null && Number.isFinite(Number(ln.timeAuthorAuthUserId))
                        ? Math.trunc(Number(ln.timeAuthorAuthUserId))
                        : null;

                let entry: TimeEntryRow | null = null;
                if ((authId == null || !workIso) && ln.timeEntryId?.trim())
                    entry = await getEntry(ln.timeEntryId, authId);
                if (authId == null && entry?.auth_user_id != null)
                    authId = entry.auth_user_id;
                const fromEntry = entry?.work_date?.trim().slice(0, 10) ?? '';
                if (!workIso && /^\d{4}-\d{2}-\d{2}$/.test(fromEntry))
                    workIso = fromEntry;

                const u = authId != null ? userByAuthId(users, authId) : null;
                const hours = numHoursFromLine(ln);
                const { taskLine } = parseTimeEntryDescriptionLines(entry?.description ?? null);
                details.push({
                    date: workIso ? dateDisplayFromIso(workIso) : '—',
                    initials: u ? initialsFromUser(u) : '—',
                    task: taskLine || '',
                    description: desc,
                    hours: hours > 0 ? formatTimeReportHours(hours) : '',
                    amount: formatTimeReportAmount(amt, currency),
                    authId,
                    hoursNum: hours,
                    amtNum: amt,
                });
            }
            else if (kind === 'expense') {
                const workIso = await resolveExpenseLineDateIso(ln);
                details.push({
                    date: workIso ? dateDisplayFromIso(workIso) : '—',
                    initials: '—',
                    task: 'Expense',
                    description: desc,
                    hours: '',
                    amount: formatTimeReportAmount(amt, currency),
                    authId: null,
                    hoursNum: 0,
                    amtNum: amt,
                });
            }
            else {
                const taskLabel = kind === 'manual' ? 'Manual' : 'Other';
                details.push({
                    date: '—',
                    initials: '—',
                    task: taskLabel,
                    description: desc,
                    hours: '',
                    amount: formatTimeReportAmount(amt, currency),
                    authId: null,
                    hoursNum: 0,
                    amtNum: amt,
                });
            }
        }

        const tail = buildSummaryAndTotals(details, users, currency);
        return {
            currency,
            detailSlots: details.length ? finalizeDetailSlots(details.map(toPublicRow)) : empty.detailSlots,
            ...tail,
        };
    }
    catch {
        return empty;
    }
}
