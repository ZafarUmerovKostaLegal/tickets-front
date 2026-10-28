import { calendarEventDurationHours, calendarEventNotesDefault, } from '@entities/todo/lib/calendarEventHelpers';
import { TT_TIMESHEET_TIMER_LS_PREFIX } from '@shared/lib/ttTimerLocalStorage';
import {} from './timesheetProjectLoader';
import {} from './TimesheetEntryModal';
import { entryBaseDurationSeconds } from './timesheetLiveTimer';
import { formatDate } from './timesheetDateUtils';
export { entryBaseDurationSeconds };
export function formatTimeEntryDescriptionForClipboard(entry) {
    return entry.notes.trim();
}
export async function copyTextToClipboard(text) {
    if (!text.trim())
        return false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    }
    catch {
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    }
    catch {
        return false;
    }
}
export function hashToColor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 52% 40%)`;
}
export const DEFAULT_WEEKLY_CAP_HOURS = 40;
export function weeklyCapHoursFromProfile(raw) {
    if (raw == null)
        return DEFAULT_WEEKLY_CAP_HOURS;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0)
        return DEFAULT_WEEKLY_CAP_HOURS;
    return Math.min(168, n);
}
export function draftEntryFromOutlookEvent(ev, day) {
    const hours = calendarEventDurationHours(ev, day);
    return {
        id: `te_outlook_${ev.id || Date.now()}`,
        date: formatDate(day),
        project: '',
        client: '',
        task: '',
        notes: calendarEventNotesDefault(ev),
        hours,
        durationSeconds: Math.max(0, Math.round(hours * 3600)),
        billable: true,
        color: '#6366f1',
    };
}
export function cloneEntryForDate(source, targetDate) {
    return {
        ...source,
        id: `te_${Date.now()}`,
        date: targetDate,
        hours: 0,
        durationSeconds: 0,
        running: false,
        isVoided: false,
        voidKind: null,
        billableAmount: null,
        billableCurrency: null,
        billableFxAsOf: undefined,
        rateSourceAmount: null,
        rateSourceCurrency: null,
        fxRateDate: null,
        fxRateSource: null,
    };
}
export function mapProjectTasksToOptions(tasks) {
    return tasks
        .filter((t) => t.name)
        .map((t) => ({
        id: t.id,
        name: t.name,
        billableByDefault: Boolean(t.billable_by_default),
    }));
}
export function isDraftTimeEntryId(id) {
    return id.startsWith('te_');
}
export function parseDescription(raw) {
    if (!raw?.trim())
        return { task: '', notes: '' };
    const idx = raw.indexOf('\n');
    if (idx === -1)
        return { task: raw.trim(), notes: '' };
    return { task: raw.slice(0, idx).trim(), notes: raw.slice(idx + 1).trim() };
}
export function buildDescription(task, notes) {
    const t = task.trim();
    const n = notes.trim();
    if (!t && !n)
        return null;
    if (!t)
        return n;
    if (!n)
        return t;
    return `${t}\n${n}`;
}
export function uniqEntriesById(list) {
    const seen = new Set();
    const out = [];
    for (const e of list) {
        if (seen.has(e.id))
            continue;
        seen.add(e.id);
        out.push(e);
    }
    return out;
}
function readEntryNum(row, keys) {
    for (const k of keys) {
        const v = row[k];
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
        if (typeof v === 'string' && v.trim()) {
            const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
            if (Number.isFinite(n))
                return n;
        }
    }
    return null;
}
function readEntryStr(row, keys) {
    for (const k of keys) {
        const v = row[k];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return undefined;
}
export function mapTimeEntryRowToUi(row, projectById) {
    const pid = row.project_id ?? undefined;
    const p = pid ? projectById.get(pid) : undefined;
    const raw = row;
    const apiProjectName = row.project_name?.trim()
        || readEntryStr(raw, ['project_name', 'projectName']);
    const apiClientName = row.client_name?.trim()
        || readEntryStr(raw, ['client_name', 'clientName']);
    const { task, notes } = parseDescription(row.description);
    const hRaw = row.hours;
    const hoursFromApi = typeof hRaw === 'number' ? hRaw : parseFloat(String(hRaw));
    const hoursSafe = Number.isFinite(hoursFromApi) ? hoursFromApi : 0;
    const durationSecondsRaw = typeof row.duration_seconds === 'number' && Number.isFinite(row.duration_seconds)
        ? Math.trunc(row.duration_seconds)
        : Math.round(hoursSafe * 3600);
    const durationSeconds = Math.max(0, durationSecondsRaw);
    const billCur = readEntryStr(raw, ['billable_currency', 'billableCurrency']) ??
        (p?.currency ? String(p.currency).trim() : undefined);
    const isVoided = row.is_voided === true;
    const voidKind = isVoided
        ? (row.void_kind === 'reallocated' ? 'reallocated' : 'rejected')
        : null;
    const projectName = (p?.name ?? apiProjectName ?? '').trim();
    const clientName = (p?.client ?? apiClientName ?? '').trim();
    return {
        id: row.id,
        date: row.work_date,
        project: projectName,
        client: clientName,
        projectId: pid,
        projectCurrency: p?.currency,
        taskId: row.task_id ?? undefined,
        task,
        notes,
        hours: durationSeconds > 0 ? durationSeconds / 3600 : hoursSafe,
        durationSeconds,
        billable: row.is_billable,
        color: p?.color ?? hashToColor(pid ?? row.id),
        isVoided,
        voidKind,
        billableAmount: readEntryNum(raw, ['billable_amount', 'billableAmount']),
        billableCurrency: billCur ?? null,
        billableFxAsOf: readEntryStr(raw, ['billable_fx_as_of', 'billableFxAsOf']) ?? null,
        rateSourceAmount: readEntryNum(raw, ['rate_source_amount', 'rateSourceAmount']),
        rateSourceCurrency: readEntryStr(raw, ['rate_source_currency', 'rateSourceCurrency']) ?? null,
        fxRateDate: readEntryStr(raw, ['fx_rate_date', 'fxRateDate']) ?? null,
        fxRateSource: readEntryStr(raw, ['fx_rate_source', 'fxRateSource']) ?? null,
    };
}
export function hoursToDurationSeconds(hours) {
    if (!Number.isFinite(hours) || hours <= 0)
        return 0;
    return Math.max(1, Math.round(hours * 3600));
}
export function elapsedMsToSeconds(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0)
        return 0;
    return Math.max(0, Math.floor(elapsedMs / 1000));
}
export function withHours(entry, hours) {
    const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
    const durationSeconds = safeHours > 0 ? Math.max(1, Math.round(safeHours * 3600)) : 0;
    return { ...entry, hours: safeHours, durationSeconds };
}
export function addSeconds(entry, deltaSeconds) {
    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.trunc(deltaSeconds)) : 0;
    const nextSec = Math.max(0, (entry.durationSeconds || 0) + delta);
    return { ...entry, durationSeconds: nextSec, hours: nextSec / 3600 };
}
export function timerStorageKey(userId) {
    return `${TT_TIMESHEET_TIMER_LS_PREFIX}${userId}`;
}
export function parseTimerPayload(raw) {
    try {
        const o = JSON.parse(raw);
        if (o.v !== 1 ||
            typeof o.authUserId !== 'number' ||
            typeof o.entryId !== 'string' ||
            typeof o.startedAt !== 'number' ||
            !o.snapshot ||
            typeof o.snapshot !== 'object') {
            return null;
        }
        return o;
    }
    catch {
        return null;
    }
}
export function readRunningTimerFromStorage(uid) {
    try {
        const raw = localStorage.getItem(timerStorageKey(uid));
        const p = raw ? parseTimerPayload(raw) : null;
        if (!p || p.authUserId !== uid)
            return null;
        const st = Number(p.startedAt);
        if (!Number.isFinite(st))
            return null;
        return { entryId: p.entryId, startedAt: st, paused: Boolean(p.paused) };
    }
    catch {
        return null;
    }
}
export function applyTimerSnapshotToEntries(entries, payload) {
    const snapBase = entryBaseDurationSeconds(payload.snapshot);
    let changed = false;
    const next = entries.map((e) => {
        if (e.id !== payload.entryId)
            return e;
        if (e.durationSeconds === snapBase && e.hours === snapBase / 3600)
            return e;
        changed = true;
        return { ...e, durationSeconds: snapBase, hours: snapBase / 3600 };
    });
    return changed ? next : entries;
}
