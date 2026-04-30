import { useState, useMemo, useEffect, useCallback, useId, useRef, useReducer, useLayoutEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { upsertTimeTrackingUser, listClientTasks, listTimeEntries, createTimeEntry, patchTimeEntry, deleteTimeEntry, grantTimeEntryEditUnlock, isTimeTrackingHttpError, isWorkDateInClosedReportingPeriod, isClosedReportingWeekEditingBlockedForSubject, getActiveTimeEntryEditUnlockExpiresAtIso, type TimeEntryRow, type TimeTrackingUserRow, type CreateTimeEntryBody, type PatchTimeEntryBody, } from '@entities/time-tracking';
import { canGrantTimeEntryEditUnlock, canOverrideReportPreviewWeeklyLock } from '@entities/time-tracking/model/timeTrackingAccess';
import { loadTimesheetProjectOptions, type ProjectOption, } from './timesheetProjectLoader';
import { useCurrentUser } from '@shared/hooks';
import type { User } from '@entities/user';
import { userFromTimeTrackingRowForUpsert } from '@entities/time-tracking/model/managerViewUser';
import { TimesheetSkeleton } from './TimesheetSkeleton';
import { TT_TIMER_STOPPED_EVENT, type TtTimerStoppedDetail } from '@widgets/global-timer';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { DatePicker } from '@shared/ui/DatePicker';
import { formatHoursClockFromDecimalHours, parseDurationToSeconds, isValidDurationSeconds, MIN_ENTRY_SECONDS, MAX_ENTRY_SECONDS, } from '@shared/lib/formatTrackingHours';
import { TT_TIMESHEET_TIMER_LS_PREFIX } from '@shared/lib/ttTimerLocalStorage';
import { formatBillableMoney, isCbuFxUnavailable } from '@shared/lib/formatBillableMoney';
import { showAlert } from '@shared/ui/app-dialog';
function startOfWeek(d: Date): Date {
    const day = new Date(d);
    const dow = day.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    day.setDate(day.getDate() + diff);
    day.setHours(0, 0, 0, 0);
    return day;
}
function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
function startOfMonth(d: Date): Date {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfMonth(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addMonths(d: Date, n: number): Date {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
}
function isSameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
const CAL_WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
type TimesheetViewMode = 'day' | 'week' | 'calendar';
type ViewTxPhase = 'idle' | 'hiding' | 'skel' | 'showing';
const VIEW_TX_HIDE_MS = 100;
const VIEW_TX_SKEL_MS = 200;
const VIEW_TX_SHOW_MS = 260;
const TIMESHEET_VIEW_MODE_STORAGE_KEY = 'tt-timesheet-view-mode-v1';
function readStoredTimesheetViewMode(): TimesheetViewMode | null {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = window.localStorage.getItem(TIMESHEET_VIEW_MODE_STORAGE_KEY)?.trim();
        if (raw === 'day' || raw === 'week' || raw === 'calendar')
            return raw;
    }
    catch {
    }
    return null;
}
function writeStoredTimesheetViewMode(mode: TimesheetViewMode): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(TIMESHEET_VIEW_MODE_STORAGE_KEY, mode);
    }
    catch {
    }
}
function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function fmtShort(d: Date) {
    return d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '').toUpperCase();
}
function fmtHours(h: number): string {
    return formatHoursClockFromDecimalHours(h);
}
function sanitizeColonHoursInput(raw: string): string {
    const v = raw.replace(/[^\d:]/g, '');
    const i = v.indexOf(':');
    if (i === -1) {
        return v.slice(0, 5);
    }
    const h = v.slice(0, i).replace(/\D/g, '').slice(0, 5);
    const m = v.slice(i + 1).replace(/\D/g, '').slice(0, 2);
    return `${h}:${m}`;
}
const TIME_ENTRY_NOTE_REMINDER_MS = 5 * 60 * 1000;
function scheduleTimeEntryNoteMissedReminder(contextLabel: string): void {
    const label = contextLabel.trim();
    window.setTimeout(() => {
        const title = 'Учёт времени';
        const body = label
            ? `Запись была сохранена без примечания (${label}). При необходимости откройте запись и добавьте заметку.`
            : 'Запись была сохранена без примечания. При необходимости откройте запись и добавьте заметку.';
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification(title, { body });
            }
            catch {
                void showAlert({ title, message: body });
            }
        }
        else {
            void showAlert({ title, message: body });
        }
    }, TIME_ENTRY_NOTE_REMINDER_MS);
}
const DEFAULT_WEEKLY_CAP_HOURS = 40;
function weeklyCapHoursFromProfile(raw: number | string | null | undefined): number {
    if (raw == null)
        return DEFAULT_WEEKLY_CAP_HOURS;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0)
        return DEFAULT_WEEKLY_CAP_HOURS;
    return Math.min(168, n);
}
function formatClockFromMs(totalMs: number): string {
    if (!Number.isFinite(totalMs) || totalMs < 0)
        return '0:00:00';
    const s = Math.max(0, Math.floor(totalMs / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function fmtDateHeading(d: Date): string {
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
        .replace(/^\w/, c => c.toUpperCase());
}
type TimeEntry = {
    id: string;
    date: string;
    project: string;
    client: string;
    projectId?: string;
    projectCurrency?: string;
    taskId?: string;
    task: string;
    notes: string;
    hours: number;
    durationSeconds: number;
    billable: boolean;
    color: string;
    running?: boolean;
    
    isVoided?: boolean;
    
    voidKind?: 'rejected' | 'reallocated' | null;
    billableAmount?: number | null;
    billableCurrency?: string | null;
    billableFxAsOf?: string | null;
    rateSourceAmount?: number | null;
    rateSourceCurrency?: string | null;
    fxRateDate?: string | null;
    fxRateSource?: string | null;
};
function entryHoursInTotals(e: TimeEntry): number {
    return e.isVoided ? 0 : e.hours;
}
type ClientTaskOption = {
    id: string;
    name: string;
    billableByDefault: boolean;
};
function isDraftTimeEntryId(id: string): boolean {
    return id.startsWith('te_');
}
function parseDescription(raw: string | null): {
    task: string;
    notes: string;
} {
    if (!raw?.trim())
        return { task: '', notes: '' };
    const idx = raw.indexOf('\n');
    if (idx === -1)
        return { task: raw.trim(), notes: '' };
    return { task: raw.slice(0, idx).trim(), notes: raw.slice(idx + 1).trim() };
}
function buildDescription(task: string, notes: string): string | null {
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
function uniqEntriesById(list: TimeEntry[]): TimeEntry[] {
    const seen = new Set<string>();
    const out: TimeEntry[] = [];
    for (const e of list) {
        if (seen.has(e.id))
            continue;
        seen.add(e.id);
        out.push(e);
    }
    return out;
}
function readEntryNum(row: Record<string, unknown>, keys: readonly string[]): number | null {
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
function readEntryStr(row: Record<string, unknown>, keys: readonly string[]): string | undefined {
    for (const k of keys) {
        const v = row[k];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return undefined;
}
function mapTimeEntryRowToUi(row: TimeEntryRow, projectById: Map<string, ProjectOption>): TimeEntry {
    const pid = row.project_id ?? undefined;
    const p = pid ? projectById.get(pid) : undefined;
    const raw = row as unknown as Record<string, unknown>;
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
    const voidKind: 'rejected' | 'reallocated' | null = isVoided
        ? (row.void_kind === 'reallocated' ? 'reallocated' : 'rejected')
        : null;
    return {
        id: row.id,
        date: row.work_date,
        project: p?.name ?? 'Проект',
        client: p?.client ?? '',
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
function hoursToDurationSeconds(hours: number): number {
    if (!Number.isFinite(hours) || hours <= 0)
        return 0;
    return Math.max(1, Math.round(hours * 3600));
}
function elapsedMsToSeconds(elapsedMs: number): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0)
        return 0;
    return Math.max(0, Math.round(elapsedMs / 1000));
}
function withHours(entry: TimeEntry, hours: number): TimeEntry {
    const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
    const durationSeconds = safeHours > 0 ? Math.max(1, Math.round(safeHours * 3600)) : 0;
    return { ...entry, hours: safeHours, durationSeconds };
}
function addSeconds(entry: TimeEntry, deltaSeconds: number): TimeEntry {
    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.trunc(deltaSeconds)) : 0;
    const nextSec = Math.max(0, (entry.durationSeconds || 0) + delta);
    return { ...entry, durationSeconds: nextSec, hours: nextSec / 3600 };
}
export { parseDurationToSeconds as parseDurationFromUserInput };
function timerStorageKey(userId: number): string {
    return `${TT_TIMESHEET_TIMER_LS_PREFIX}${userId}`;
}
type TimerPersistPayload = {
    v: 1;
    authUserId: number;
    entryId: string;
    startedAt: number;
    snapshot: TimeEntry;
};
function parseTimerPayload(raw: string): TimerPersistPayload | null {
    try {
        const o = JSON.parse(raw) as Partial<TimerPersistPayload>;
        if (o.v !== 1 ||
            typeof o.authUserId !== 'number' ||
            typeof o.entryId !== 'string' ||
            typeof o.startedAt !== 'number' ||
            !o.snapshot ||
            typeof o.snapshot !== 'object') {
            return null;
        }
        return o as TimerPersistPayload;
    }
    catch {
        return null;
    }
}
type RunningTimerState = {
    entryId: string;
    startedAt: number;
};
function groupProjectsByClient(list: ProjectOption[]): {
    client: string;
    projects: ProjectOption[];
}[] {
    const m = new Map<string, ProjectOption[]>();
    for (const p of list) {
        const c = (p.client || '').trim() || '—';
        if (!m.has(c))
            m.set(c, []);
        m.get(c)!.push(p);
    }
    return [...m.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'ru', { sensitivity: 'base' }))
        .map(([client, projs]) => ({
            client,
            projects: [...projs].sort((x, y) => x.name.localeCompare(y.name, 'ru', { sensitivity: 'base' })),
        }));
}
function hashToColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 52% 40%)`;
}
type EntryForm = {
    projectId: string;
    taskId: string;
    task: string;
    date: string;
    hours: string;
    notes: string;
    billable: boolean;
};
function resolveInitialForm(entry: TimeEntry | undefined, defaultDate: string, projects: ProjectOption[], tasksByClientId: Record<string, ClientTaskOption[]>): EntryForm {
    let projectId = '';
    if (entry?.projectId && projects.some((p) => p.id === entry.projectId)) {
        projectId = entry.projectId;
    }
    else if (entry) {
        const m = projects.find((p) => p.name === entry.project && (!entry.client || p.client === entry.client));
        projectId = m?.id ?? projects[0]?.id ?? '';
    }
    else {
        projectId = projects[0]?.id ?? '';
    }
    const p = projects.find((x) => x.id === projectId);
    const clientTasks = p ? (tasksByClientId[p.clientId] ?? []) : [];
    let taskId = entry?.taskId ?? '';
    let task = entry?.task ?? '';
    let billable = entry?.billable ?? true;
    if (clientTasks.length > 0) {
        const matched = taskId
            ? clientTasks.find((t) => t.id === taskId)
            : clientTasks.find((t) => t.name === task);
        if (matched) {
            taskId = matched.id;
            task = matched.name;
            billable = matched.billableByDefault;
        }
        else {
            const first = clientTasks[0]!;
            taskId = first.id;
            task = first.name;
            billable = first.billableByDefault;
        }
    }
    return {
        projectId,
        taskId,
        task,
        date: entry?.date ?? defaultDate,
        hours: entry ? fmtHours(entry.hours) : '',
        notes: entry?.notes ?? '',
        billable,
    };
}
function EntryModal({ entry, defaultDate, projects, projectsLoading, projectsLoadError, tasksByClientId, clientTasksIndexLoading, entriesSubjectAuthUserId, viewerCanOverrideWeeklyLock, onClose, onSave, }: {
    entry?: TimeEntry;
    defaultDate: string;
    projects: ProjectOption[];
    projectsLoading: boolean;
    projectsLoadError: string | null;
    tasksByClientId: Record<string, ClientTaskOption[]>;
    
    clientTasksIndexLoading: boolean;
    entriesSubjectAuthUserId: number;
    viewerCanOverrideWeeklyLock: boolean;
    onClose: () => void;
    onSave: (e: TimeEntry) => void | Promise<void>;
}) {
    const uid = useId();
    const notesRef = useRef<HTMLTextAreaElement>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<EntryForm>(() => projects.length > 0 ? resolveInitialForm(entry, defaultDate, projects, tasksByClientId) : {
        projectId: '',
        taskId: '',
        task: '',
        date: defaultDate,
        hours: entry ? fmtHours(entry.hours) : '',
        notes: entry?.notes ?? '',
        billable: entry?.billable ?? true,
    });
    const [error, setError] = useState<string | null>(null);
    const [weeklyLockHint, setWeeklyLockHint] = useState(false);
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', h);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
    }, [onClose]);
    useLayoutEffect(() => {
        const el = notesRef.current;
        if (!el)
            return;
        el.style.height = '0px';
        el.style.height = `${el.scrollHeight}px`;
    }, [form.notes]);
    const proj = projects.find((p) => p.id === form.projectId) ?? projects[0];
    const clientTasks = proj ? (tasksByClientId[proj.clientId] ?? []) : [];
    const clientTasksListReady = !clientTasksIndexLoading;
    const projectsByClient = useMemo(() => groupProjectsByClient(projects), [projects]);
    const flatProjects = useMemo(() => projectsByClient.flatMap(({ projects: grp }) => grp), [projectsByClient]);
    useEffect(() => {
        if (!proj)
            return;
        const tasks = tasksByClientId[proj.clientId] ?? [];
        if (tasks.length === 0)
            return;
        setForm((f) => {
            const match = tasks.find((t) => t.id === f.taskId) ?? tasks.find((t) => t.name === f.task);
            if (match) {
                return {
                    ...f,
                    taskId: match.id,
                    task: match.name,
                    billable: match.billableByDefault,
                };
            }
            const first = tasks[0]!;
            return { ...f, taskId: first.id, task: first.name, billable: first.billableByDefault };
        });
    }, [proj?.clientId, proj?.id, tasksByClientId]);
    function parseHoursStrict(s: string): number {
        const clean = s.trim();
        if (!clean)
            return 0;
        if (!clean.includes(':'))
            return Number.NaN;
        const i = clean.indexOf(':');
        const hs = clean.slice(0, i).replace(/\D/g, '');
        const ms = clean.slice(i + 1).replace(/\D/g, '');
        if (ms.length > 2)
            return Number.NaN;
        const h = hs === '' ? 0 : Number(hs);
        const m = ms === '' ? Number.NaN : Number(ms);
        if (Number.isNaN(h) || Number.isNaN(m) || m > 59)
            return Number.NaN;
        return h + m / 60;
    }
    const hoursForTimerHint = useMemo(() => {
        const t = form.hours.trim();
        if (!t)
            return 0;
        const h = parseHoursStrict(form.hours);
        if (Number.isNaN(h) || h < 0)
            return null;
        return h;
    }, [form.hours]);
    const formDateInClosedPeriod = useMemo(() => isWorkDateInClosedReportingPeriod(form.date), [form.date]);
    const reportingDayBlocked = useMemo(() => isClosedReportingWeekEditingBlockedForSubject(entriesSubjectAuthUserId, form.date, viewerCanOverrideWeeklyLock), [entriesSubjectAuthUserId, form.date, viewerCanOverrideWeeklyLock]);
    const unlockUntilIso = formDateInClosedPeriod && !reportingDayBlocked && !viewerCanOverrideWeeklyLock
        ? getActiveTimeEntryEditUnlockExpiresAtIso(entriesSubjectAuthUserId, form.date)
        : null;
    const entryVoided = Boolean(entry?.isVoided);
    const formDateLocked = reportingDayBlocked || entryVoided;
    async function handleSave() {
        if (!proj) {
            setError('Нет доступных проектов');
            return;
        }
        if (entry?.isVoided) {
            setError('Запись снята с учёта менеджером — редактирование недоступно.');
            return;
        }
        if (reportingDayBlocked) {
            setError('Период по выбранной дате закрыт для правок. Попросите менеджера учёта времени выдать разблокировку на этот день или укажите дату в открытом периоде.');
            return;
        }
        if (clientTasksIndexLoading) {
            setError('Справочник задач ещё загружается. Подождите секунду и попробуйте снова.');
            return;
        }
        if (clientTasks.length === 0) {
            setError('Нет задач в справочнике по клиенту этого проекта. Задайте задачи в настройках учёта времени (справочник задач клиента), затем создайте запись.');
            return;
        }
        if (!form.taskId.trim()) {
            setError('Выберите задачу из справочника.');
            return;
        }
        const hoursT = form.hours.trim();
        if (hoursT && !hoursT.includes(':')) {
            setError('Время указывайте через двоеточие, например 1:30 или 0:45');
            return;
        }
        const h = parseHoursStrict(form.hours);
        if (form.hours && (isNaN(h) || h < 0)) {
            setError('Некорректное время. Формат: ч:мм (минуты 00–59), например 1:30 или 0:00');
            return;
        }
        const rawHours = form.hours ? h : 0;
        const durationSeconds = rawHours > 0 ? Math.max(1, Math.round(rawHours * 3600)) : 0;
        if (form.hours && durationSeconds > 0 && !isValidDurationSeconds(durationSeconds)) {
            if (durationSeconds < MIN_ENTRY_SECONDS) {
                setError('Минимум 1 минута');
            }
            else if (durationSeconds > MAX_ENTRY_SECONDS) {
                setError('Максимум 23:59 за одну запись');
            }
            else {
                setError('Неверная длительность');
            }
            return;
        }
        const payload: TimeEntry = {
            id: entry?.id ?? `te_${Date.now()}`,
            date: form.date,
            project: proj.name,
            client: proj.client,
            projectId: proj.id,
            projectCurrency: proj.currency,
            taskId: form.taskId || undefined,
            task: form.task,
            notes: form.notes,
            hours: rawHours,
            durationSeconds,
            billable: form.billable,
            color: proj.color,
            billableAmount: entry?.billableAmount ?? null,
            billableCurrency: entry?.billableCurrency ?? null,
            billableFxAsOf: undefined,
            rateSourceAmount: entry?.rateSourceAmount ?? null,
            rateSourceCurrency: entry?.rateSourceCurrency ?? null,
            fxRateDate: entry?.fxRateDate ?? null,
            fxRateSource: entry?.fxRateSource ?? null,
        };
        setSaving(true);
        setError(null);
        setWeeklyLockHint(false);
        try {
            await Promise.resolve(onSave(payload));
            if (!entry && !form.notes.trim()) {
                if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                    void Notification.requestPermission();
                }
                scheduleTimeEntryNoteMissedReminder(`${proj.client} — ${proj.name}`);
            }
            onClose();
        }
        catch (e) {
            const m = e instanceof Error ? e.message : 'Не удалось сохранить';
            setWeeklyLockHint(isTimeTrackingHttpError(e, 409));
            setError(/\b503\b|Service Unavailable|недоступен.*курс|FX|ЦБ/i.test(m)
                ? `${m} Если речь о курсе валюты — повторите позже или обратитесь к администратору.`
                : m);
        }
        finally {
            setSaving(false);
        }
    }
    if (projectsLoading) {
        return createPortal(<div className="tsp-ov">
            <div className="tsp-m" onClick={(e) => e.stopPropagation()}>
                <div className="tsp-m__head">
                    <h3 className="tsp-m__title">{entry ? 'Редактировать запись' : 'Добавить время'}</h3>
                    <button type="button" className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="tsp-m__body">
                    <p className="tsp-m__hint" role="status">Загрузка списка проектов…</p>
                </div>
                <div className="tsp-m__foot">
                    <button type="button" className="tsp-m__btn tsp-m__btn--cancel" onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>, document.body);
    }
    if (!proj) {
        return createPortal(<div className="tsp-ov">
            <div className="tsp-m" onClick={(e) => e.stopPropagation()}>
                <div className="tsp-m__head">
                    <h3 className="tsp-m__title">Добавить время</h3>
                    <button type="button" className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="tsp-m__body">
                    {projectsLoadError && <p className="tsp-m__err" role="alert">{projectsLoadError}</p>}
                    <p className="tsp-m__err">
                        Нет назначенных проектов для учёта времени. Для получения доступа обратитесь к менеджеру.
                    </p>
                </div>
                <div className="tsp-m__foot">
                    <button type="button" className="tsp-m__btn tsp-m__btn--cancel" onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>, document.body);
    }
    return createPortal(<div className="tsp-ov tsp-ov--entry">
        <div className="tsp-m tsp-m--time-entry" style={{ '--tsp-m-stripe': proj.color } as CSSProperties} onClick={(e) => e.stopPropagation()}>
            <div className="tsp-m__head tsp-m__head--time-entry">
                <button type="button" className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
                <h3 className="tsp-m__title tsp-m__title--time-entry">
                    {entry?.isVoided ? 'Просмотр записи' : entry ? 'Редактирование' : 'Добавить время'}
                </h3>
            </div>

            <div className="tsp-m__body tsp-m__body--time-entry">
                <p className="tsp-m__lbl tsp-m__lbl--section">Проект / задача</p>
                <div className="tsp-m__te-field">
                    <SearchableSelect<ProjectOption> portalDropdown portalZIndex={12000} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" buttonId={`${uid}-proj-btn`} value={form.projectId} items={flatProjects} getOptionValue={(p) => p.id} getOptionLabel={(p) => `${p.name} — (${p.client})`} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} getGroupLabel={(p) => p.client} groupItemSort={(a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })} disabled={formDateLocked} renderButtonContent={(p) => (<span className="tsp-srch__btn-pick">
                        <span className="tsp-srch__btn-pick-client">{p.client}</span>
                        <span className="tsp-srch__btn-pick-proj">{p.name}</span>
                    </span>)} placeholder="Проект…" emptyListText="Нет проектов" noMatchText="Ничего не найдено" onSelect={(p) => {
                        const tasks = tasksByClientId[p.clientId] ?? [];
                        if (tasks.length > 0) {
                            const match = tasks.find((t) => t.name === form.task) ?? tasks[0]!;
                            setForm((f) => ({
                                ...f,
                                projectId: p.id,
                                taskId: match.id,
                                task: match.name,
                                billable: match.billableByDefault,
                            }));
                        }
                        else {
                            setForm((f) => ({ ...f, projectId: p.id, taskId: '', task: '' }));
                        }
                    }} renderOption={(p) => (<span className="tsp-srch__opt-name">{p.name}</span>)} buttonClassName="tsp-srch__btn--stacked"/>
                    <p className="tsp-m__te-currency" title="Сумма billable в ответе API в валюте проекта">Валюта проекта: {proj.currency}</p>
                </div>

                <div className="tsp-m__te-field">
                    <SearchableSelect<ClientTaskOption> portalDropdown portalZIndex={12000} portalMinWidth={260} portalDropdownClassName="tsp-srch__dropdown--tall" buttonId={`${uid}-task-btn`} value={form.taskId} items={clientTasks} getOptionValue={(t) => t.id} getOptionLabel={(t) => t.name} getSearchText={(t) => t.name} placeholder="Задача…" emptyListText="Нет задач — задайте справочник у клиента" noMatchText="Ничего не найдено" disabled={!form.projectId || formDateLocked || !clientTasksListReady || clientTasks.length === 0} onSelect={(t) => setForm((f) => ({
                        ...f,
                        taskId: t.id,
                        task: t.name,
                        billable: t.billableByDefault,
                    }))} renderOption={(t) => (<span className="tsp-srch__opt-rich">
                        <span className="tsp-srch__opt-name">{t.name}</span>
                        <span className="tsp-srch__opt-meta">
                            {t.billableByDefault ? 'Оплачиваемая' : 'Неоплачиваемая'}
                        </span>
                    </span>)} />
                    {proj && !clientTasksListReady && (<p className="tsp-m__field-note tsp-m__field-note--tight">Загрузка справочника задач…</p>)}
                    {proj && clientTasksListReady && clientTasks.length === 0 && (<p className="tsp-m__field-note tsp-m__field-note--tight">Нет задач в справочнике по этому клиенту — добавьте их в разделе справочников (задачи клиента), затем выберите задачу здесь.</p>)}
                </div>

                <div className="tsp-m__row tsp-m__row--notes-time">
                    <div className="tsp-m__f tsp-m__te-notes">
                        <textarea ref={notesRef} id={`${uid}-n`} className="tsp-m__inp tsp-m__inp--textarea tsp-m__inp--te-notes" placeholder="Примечание (необязательно)…" rows={1} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} disabled={formDateLocked} />
                    </div>
                    <div className="tsp-m__f tsp-m__f--te-hours">
                        <label className="tsp-m__te-hours-lbl" htmlFor={`${uid}-h`}>Часы</label>
                        <input id={`${uid}-h`} type="text" className="tsp-m__inp tsp-m__inp--h" placeholder="0:00" autoComplete="off" spellCheck={false} inputMode="text" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: sanitizeColonHoursInput(e.target.value) }))} disabled={formDateLocked} />
                    </div>
                </div>
                {hoursForTimerHint === 0 && (<p className="tsp-m__field-note tsp-m__field-note--timer tsp-m__field-note--tight">
                    0:00 — запись в табеле, время на сервер после «Стоп» таймера.
                </p>)}
                {entry && entry.billableAmount != null && Number.isFinite(entry.billableAmount) && (<div className="tsp-m__f">
                    <p className="tsp-m__field-note tsp-m__field-note--tight">
                        API: <strong>
                            {formatBillableMoney(entry.billableAmount, entry.billableCurrency ?? proj.currency)}
                        </strong>
                    </p>
                </div>)}
                {entry && isCbuFxUnavailable(entry.fxRateSource) && (entry.billableAmount == null || entry.billableAmount === 0) && (<div className="tsp-m__f">
                    <p className="tsp-m__err" role="alert">
                        Курс ЦБ недоступен — сумма на сервере не рассчитана. Повторите сохранение позже.
                    </p>
                </div>)}
                {entryVoided && !formDateInClosedPeriod && (<p className="tsp-m__hint tsp-m__hint--void" role="status">
                    Запись снята с учёта менеджером{entry?.voidKind === 'reallocated' ? ' (перенос/перераспределение)' : ' (не принято)'} — поля только для просмотра.
                </p>)}
                {formDateInClosedPeriod && reportingDayBlocked && (<p className="tsp-m__hint tsp-m__hint--weekly-lock" role="status">
                    Неделя по этой дате на стороне сервера закрыта для правок. Срок: <strong>суббота, 9:00 (Ташкент)</strong>. Чтобы менять поля, выберите внизу другую <strong>дату работы</strong> (открытый период) или получите временную разблокировку у менеджера учёта времени.
                </p>)}
                {unlockUntilIso && (<p className="tsp-m__hint tsp-m__hint--unlock-active" role="status">
                    Временная разблокировка активна до{' '}
                    <strong>{new Date(unlockUntilIso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</strong>.
                </p>)}
                {error && <p className="tsp-m__err">{error}</p>}
                {weeklyLockHint && (<p className="tsp-m__hint tsp-m__hint--weekly-lock" role="note">
                    Эта дата попадает в неделю, по которой отчёт уже отправлен (или неделя закрыта) — сервер отклоняет правки с кодом 409.
                </p>)}
            </div>

            <div className="tsp-m__foot tsp-m__foot--time-entry">
                <div className="tsp-m__foot-actions">
                    <button type="button" className="tsp-m__btn tsp-m__btn--ok" disabled={!entry?.isVoided && (saving || formDateLocked || !clientTasksListReady || clientTasks.length === 0 || !form.taskId.trim())} onClick={() => (entry?.isVoided ? onClose() : void handleSave())}>
                        {entry?.isVoided ? 'Закрыть' : saving ? 'Сохранение…' : entry ? 'Сохранить' : 'Добавить'}
                    </button>
                    <button type="button" className="tsp-m__btn tsp-m__btn--cancel" disabled={saving} onClick={onClose}>
                        Отмена
                    </button>
                </div>
                <div className="tsp-m__foot-date">
                    <label className="tsp-m__foot-date-lbl" htmlFor={`${uid}-d`}>Дата</label>
                    <DatePicker
                        id={`${uid}-d`}
                        className="tsp-m__date-ttp"
                        buttonClassName="tsp-m__date-ttp-btn"
                        value={form.date}
                        onChange={(iso) => setForm((f) => ({ ...f, date: iso }))}
                        disabled={formDateLocked}
                        portal
                        portalZIndex={12500}
                        title="Дата работы"
                        iconAfterLabel
                        showChevron={false}
                    />
                </div>
            </div>
        </div>
    </div>, document.body);
}
function TimerBusyHintModal({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onCloseRef.current();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open]);
    if (!open)
        return null;
    return createPortal(<div className="tsp-ov" role="presentation">
        <div className="tsp-m tsp-m--hint-dialog" role="dialog" aria-modal="true" aria-labelledby="tsp-timer-hint-title" onClick={(e) => e.stopPropagation()}>
            <div className="tsp-m__head">
                <h3 id="tsp-timer-hint-title" className="tsp-m__title">Сначала остановите таймер</h3>
                <button type="button" className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="tsp-m__body tsp-m__body--hint">
                <div className="tsp-m__hint-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                </div>
                <p className="tsp-m__hint-lead">
                    Сейчас запущен таймер на другой задаче. Нажмите «Стоп» у активной записи, затем «Старт» на нужной.
                </p>
            </div>
            <div className="tsp-m__foot">
                <button type="button" className="tsp-m__btn tsp-m__btn--ok" onClick={onClose}>
                    Понятно
                </button>
            </div>
        </div>
    </div>, document.body);
}
export type TimesheetPanelProps = {
    managedEntriesUserId?: number | null;
    managedEntriesUserRow?: TimeTrackingUserRow | null;
};
export function TimesheetPanel(props?: TimesheetPanelProps) {
    const { managedEntriesUserId = null, managedEntriesUserRow = null, } = props ?? {};
    const { user: currentUser, loading: userLoading } = useCurrentUser();
    const entriesAuthUserId = useMemo(() => {
        if (!currentUser)
            return null;
        if (managedEntriesUserId != null &&
            managedEntriesUserId > 0 &&
            managedEntriesUserId !== currentUser.id) {
            return managedEntriesUserId;
        }
        return currentUser.id;
    }, [currentUser, managedEntriesUserId]);
    const upsertUserForEntries = useMemo((): User | null => {
        if (!currentUser || !entriesAuthUserId)
            return null;
        if (entriesAuthUserId === currentUser.id)
            return currentUser;
        if (managedEntriesUserRow?.id === entriesAuthUserId) {
            return userFromTimeTrackingRowForUpsert(currentUser, managedEntriesUserRow);
        }
        return currentUser;
    }, [currentUser, entriesAuthUserId, managedEntriesUserRow]);
    const isColleagueTimesheetView = Boolean(currentUser && entriesAuthUserId != null && entriesAuthUserId !== currentUser.id);
    const viewerCanOverrideWeeklyLock = useMemo(() => canOverrideReportPreviewWeeklyLock(currentUser), [currentUser]);
    const grantUnlockEligible = useMemo(() => Boolean(currentUser && entriesAuthUserId != null && canGrantTimeEntryEditUnlock(currentUser, entriesAuthUserId)), [currentUser, entriesAuthUserId]);
    const [grantUnlockBusy, setGrantUnlockBusy] = useState(false);
    const [grantUnlockConfirmOpen, setGrantUnlockConfirmOpen] = useState(false);
    const isSubjectDayReportingBlocked = useCallback((ymd: string) => {
        if (entriesAuthUserId == null)
            return false;
        return isClosedReportingWeekEditingBlockedForSubject(entriesAuthUserId, ymd, viewerCanOverrideWeeklyLock);
    }, [entriesAuthUserId, viewerCanOverrideWeeklyLock]);
    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    const [projectsState, setProjectsState] = useState<{
        loading: boolean;
        items: ProjectOption[];
        error: string | null;
    }>({ loading: true, items: [], error: null });
    const [tasksByClientId, setTasksByClientId] = useState<Record<string, ClientTaskOption[]>>({});
    const [clientTasksIndexLoading, setClientTasksIndexLoading] = useState(false);
    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
    const [calendarAnchor, setCalendarAnchor] = useState<Date>(() => startOfMonth(new Date()));
    const initialTimesheetMode = readStoredTimesheetViewMode() ?? 'day';
    const [viewMode, setViewMode] = useState<TimesheetViewMode>(initialTimesheetMode);
    const [entriesScopeMode, setEntriesScopeMode] = useState<TimesheetViewMode>(initialTimesheetMode);
    const [viewTxPhase, setViewTxPhase] = useState<ViewTxPhase>('idle');
    const viewTxTimersRef = useRef<number[]>([]);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = useState(false);
    type EntriesSyncBanner = { message: string; variant: 'danger' | 'amber' | 'success' };
    const [entriesBanner, setEntriesBanner] = useState<EntriesSyncBanner | null>(null);
    const [entriesHydrated, setEntriesHydrated] = useState(false);
    const projectCatalogVersion = useMemo(() => projectsState.items.map((p) => p.id).join('|'), [projectsState.items]);
    useEffect(() => {
        if (userLoading)
            return;
        if (!currentUser) {
            setProjectsState({ loading: false, items: [], error: null });
            return;
        }
        let cancelled = false;
        setProjectsState((s) => ({ ...s, loading: true, error: null }));
        void loadTimesheetProjectOptions(currentUser)
            .then(({ items, error }) => {
                if (cancelled)
                    return;
                setProjectsState({ loading: false, items, error });
            })
            .catch((e) => {
                if (cancelled)
                    return;
                setProjectsState({
                    loading: false,
                    items: [],
                    error: e instanceof Error ? e.message : 'Не удалось загрузить проекты',
                });
            });
        return () => {
            cancelled = true;
        };
    }, [currentUser, userLoading]);
    useEffect(() => {
        const opts = projectsState.items;
        if (opts.length === 0) {
            setTasksByClientId({});
            setClientTasksIndexLoading(false);
            return;
        }
        const clientIds = [...new Set(opts.map((p) => p.clientId))];
        let cancelled = false;
        setClientTasksIndexLoading(true);
        void Promise.all(clientIds.map(async (cid) => {
            try {
                const tasks = await listClientTasks(cid);
                const mapped: ClientTaskOption[] = tasks
                    .filter((t) => t.name)
                    .map((t) => ({
                        id: t.id,
                        name: t.name,
                        billableByDefault: Boolean(t.billable_by_default),
                    }));
                return [cid, mapped] as const;
            }
            catch {
                return [cid, [] as ClientTaskOption[]] as const;
            }
        })).then((pairs) => {
            if (cancelled)
                return;
            setTasksByClientId(Object.fromEntries(pairs));
        }).finally(() => {
            if (!cancelled)
                setClientTasksIndexLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [projectsState.items]);
    const blockingSkeleton = userLoading || projectsState.loading || (entriesLoading && !entriesHydrated);
    const [modal, setModal] = useState<{
        open: boolean;
        date: string;
        edit?: TimeEntry;
    }>({ open: false, date: formatDate(today) });

    const [timerBusyHintOpen, setTimerBusyHintOpen] = useState(false);
    const [activeDay, setActiveDay] = useState<Date>(today);
    const [query, setQuery] = useState('');
    const [billableOnly, setBillableOnly] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [runningTimer, setRunningTimer] = useState<RunningTimerState | null>(null);
    const runningTimerRef = useRef<RunningTimerState | null>(null);
    runningTimerRef.current = runningTimer;
    const entriesRef = useRef(entries);
    entriesRef.current = entries;
    const upsertUserForEntriesRef = useRef(upsertUserForEntries);
    upsertUserForEntriesRef.current = upsertUserForEntries;
    const entriesAuthUserIdRef = useRef(entriesAuthUserId);
    entriesAuthUserIdRef.current = entriesAuthUserId;
    const projectsCatalogRef = useRef(projectsState.items);
    projectsCatalogRef.current = projectsState.items;
    const draftTimerCreateInFlightRef = useRef(new Set<string>());
    const [timerTick, bumpTimerTick] = useReducer((n: number) => n + 1, 0);
    const entriesRange = useMemo(() => {
        if (entriesScopeMode === 'calendar') {
            const sm = startOfMonth(calendarAnchor);
            const em = endOfMonth(calendarAnchor);
            return { from: formatDate(sm), to: formatDate(em) };
        }
        return { from: formatDate(weekStart), to: formatDate(addDays(weekStart, 6)) };
    }, [entriesScopeMode, calendarAnchor, weekStart]);
    useEffect(() => {
        writeStoredTimesheetViewMode(viewMode);
    }, [viewMode]);
    useEffect(() => {
        setEntriesHydrated(false);
    }, [entriesAuthUserId]);
    useEffect(() => {
        if (!entriesAuthUserId)
            return;
        if (!entriesLoading)
            setEntriesHydrated(true);
    }, [entriesAuthUserId, entriesLoading]);
    useEffect(() => {
        if (viewTxPhase !== 'idle')
            return;
        setEntriesScopeMode(viewMode);
    }, [viewMode, viewTxPhase]);
    const clearViewTxTimers = () => {
        viewTxTimersRef.current.forEach((id) => window.clearTimeout(id));
        viewTxTimersRef.current = [];
    };
    useEffect(() => () => clearViewTxTimers(), []);
    function beginSegViewSwitch(next: TimesheetViewMode) {
        if (next === viewMode || viewTxPhase !== 'idle')
            return;
        if (next === 'calendar') {
            setCalendarAnchor(startOfMonth(activeDay));
        }
        setEntriesScopeMode(next);
        setViewTxPhase('hiding');
        clearViewTxTimers();
        viewTxTimersRef.current.push(window.setTimeout(() => {
            setViewMode(next);
            setViewTxPhase('skel');
            viewTxTimersRef.current.push(window.setTimeout(() => {
                setViewTxPhase('showing');
                viewTxTimersRef.current.push(window.setTimeout(() => {
                    setViewTxPhase('idle');
                    clearViewTxTimers();
                }, VIEW_TX_SHOW_MS));
            }, VIEW_TX_SKEL_MS));
        }, VIEW_TX_HIDE_MS));
    }
    useEffect(() => {
        if (!entriesAuthUserId || userLoading || projectsState.loading)
            return;
        let cancelled = false;
        setEntriesLoading(true);
        setEntriesBanner(null);
        const from = entriesRange.from;
        const to = entriesRange.to;
        const uid = entriesAuthUserId;
        const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
        void (async () => {
            try {
                const rows = await listTimeEntries(uid, from, to);
                if (cancelled)
                    return;
                let mapped = rows.map((r) => mapTimeEntryRowToUi(r, byId));
                if (currentUser?.id && uid !== currentUser.id) {
                    setRunningTimer(null);
                }
                else {
                    try {
                        const raw = localStorage.getItem(timerStorageKey(uid));
                        const p = raw ? parseTimerPayload(raw) : null;
                        if (p && p.authUserId === uid) {
                            const st = Number(p.startedAt);
                            if (Number.isFinite(st)) {
                                setRunningTimer({ entryId: p.entryId, startedAt: st });
                                if (!mapped.some((e) => e.id === p.entryId)) {
                                    mapped = [...mapped, p.snapshot];
                                }
                            }
                            else {
                                setRunningTimer(null);
                            }
                        }
                        else {
                            setRunningTimer(null);
                        }
                    }
                    catch {
                        setRunningTimer(null);
                    }
                }
                setEntries(uniqEntriesById(mapped));
            }
            catch (e) {
                if (!cancelled) {
                    const msg = e instanceof Error ? e.message : 'Не удалось загрузить записи времени';
                    setEntriesBanner({
                        message: /403|forbidden|недостаточно|запрещ/i.test(msg)
                            ? `${msg} (нет доступа к записям этого сотрудника — проверьте общие проекты в учёте времени.)`
                            : msg,
                        variant: 'danger',
                    });
                    setEntries([]);
                    setRunningTimer(null);
                }
            }
            finally {
                if (!cancelled)
                    setEntriesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [entriesAuthUserId, currentUser?.id, userLoading, projectsState.loading, entriesRange.from, entriesRange.to, projectCatalogVersion]);
    useEffect(() => {
        if (!runningTimer)
            return;
        const t = setInterval(() => bumpTimerTick(), 1000);
        return () => clearInterval(t);
    }, [runningTimer]);
    useEffect(() => {
        if (entriesAuthUserId)
            return;
        setRunningTimer(null);
    }, [entriesAuthUserId]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const activeDayYmd = useMemo(() => formatDate(activeDay), [activeDay]);
    const activeDayInClosedWeek = useMemo(() => isWorkDateInClosedReportingPeriod(activeDayYmd), [activeDayYmd]);
    const showGrantUnlockStrip = grantUnlockEligible && isColleagueTimesheetView && entriesAuthUserId != null && activeDayInClosedWeek;
    const activeDayReportingBlocked = isSubjectDayReportingBlocked(activeDayYmd);
    useEffect(() => {
        if (!showGrantUnlockStrip)
            setGrantUnlockConfirmOpen(false);
    }, [showGrantUnlockStrip]);
    const hoursPerDay = useMemo(() => weekDays.map((d) => {
        const key = formatDate(d);
        return entries.filter((e) => e.date === key).reduce((s, e) => s + entryHoursInTotals(e), 0);
    }), [weekDays, entries]);
    const weekTotal = hoursPerDay.reduce((s, h) => s + h, 0);
    const weekNormHours = useMemo(() => {
        const cap = managedEntriesUserRow && managedEntriesUserRow.id === entriesAuthUserId
            ? managedEntriesUserRow.weekly_capacity_hours
            : currentUser?.weekly_capacity_hours;
        return weeklyCapHoursFromProfile(cap);
    }, [currentUser?.weekly_capacity_hours, managedEntriesUserRow, entriesAuthUserId]);
    const hoursByDate = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of entries) {
            m.set(e.date, (m.get(e.date) ?? 0) + entryHoursInTotals(e));
        }
        return m;
    }, [entries]);
    const voidInfoByDate = useMemo(() => {
        const m = new Map<string, { hasReject: boolean; hasRealloc: boolean }>();
        for (const e of entries) {
            if (!e.isVoided)
                continue;
            const o = m.get(e.date) ?? { hasReject: false, hasRealloc: false };
            if (e.voidKind === 'reallocated')
                o.hasRealloc = true;
            else
                o.hasReject = true;
            m.set(e.date, o);
        }
        return m;
    }, [entries]);
    const monthTotal = useMemo(() => {
        const y = calendarAnchor.getFullYear();
        const mo = calendarAnchor.getMonth();
        return entries.reduce((s, e) => {
            const parts = e.date.split('-').map(Number);
            const ys = parts[0];
            const ms = parts[1];
            if (ys === y && ms === mo + 1)
                return s + entryHoursInTotals(e);
            return s;
        }, 0);
    }, [entries, calendarAnchor]);
    const monthNormHours = useMemo(() => (weekNormHours * 52) / 12, [weekNormHours]);
    const periodTotal = viewMode === 'calendar' ? monthTotal : weekTotal;
    const periodNorm = viewMode === 'calendar' ? monthNormHours : weekNormHours;
    const periodBarPct = periodNorm > 0 ? Math.min(100, (periodTotal / periodNorm) * 100) : 0;
    const calendarCells = useMemo(() => {
        const sm = startOfMonth(calendarAnchor);
        const lead = (sm.getDay() + 6) % 7;
        const gridStart = addDays(sm, -lead);
        return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    }, [calendarAnchor]);
    const thisWeekStart = useMemo(() => startOfWeek(today), [today]);
    const isCurrentWeek = isSameDay(weekStart, thisWeekStart);
    const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const canGoNextByWeek = weekStart.getTime() < thisWeekStart.getTime();
    const canGoNextByMonth = monthIndex(calendarAnchor) < monthIndex(today);
    function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
    function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
    function goToday() {
        setWeekStart(startOfWeek(today));
        setActiveDay(today);
    }
    function prevPeriod() {
        if (viewMode === 'calendar')
            setCalendarAnchor((d) => addMonths(d, -1));
        else
            prevWeek();
    }
    function nextPeriod() {
        if (viewMode === 'calendar') {
            if (!canGoNextByMonth)
                return;
            setCalendarAnchor((d) => addMonths(d, 1));
        }
        else {
            if (!canGoNextByWeek)
                return;
            nextWeek();
        }
    }
    function goTodayPeriod() {
        if (viewMode === 'calendar') {
            setCalendarAnchor(startOfMonth(today));
            setActiveDay(today);
        }
        else {
            goToday();
        }
    }
    function openAdd(date: string) { setModal({ open: true, date }); }
    function openEdit(entry: TimeEntry) { setModal({ open: true, date: entry.date, edit: entry }); }
    function closeModal() { setModal(m => ({ ...m, open: false, edit: undefined })); }
    useEffect(() => {
        function isEditableTarget(t: EventTarget | null): boolean {
            const el = t as HTMLElement | null;
            if (!el)
                return false;
            if (el.isContentEditable)
                return true;
            const tag = el.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select')
                return true;
            return false;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey)
                return;
            if (modal.open || deleteTarget || timerBusyHintOpen || grantUnlockConfirmOpen)
                return;
            if (viewTxPhase !== 'idle')
                return;
            const editable = isEditableTarget(e.target);
            const key = e.key;
            if (key === '/' && !editable) {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select?.();
                return;
            }
            if (editable) {
                if (key === 'Escape' && e.target === searchInputRef.current) {
                    if (query || billableOnly) {
                        e.preventDefault();
                        setQuery('');
                        setBillableOnly(false);
                        searchInputRef.current?.blur();
                    }
                }
                return;
            }
            if (key === 'ArrowLeft') {
                e.preventDefault();
                prevPeriod();
            }
            else if (key === 'ArrowRight') {
                e.preventDefault();
                nextPeriod();
            }
            else if (key === 't' || key === 'T' || key === 'Home') {
                e.preventDefault();
                goTodayPeriod();
            }
            else if (key === 'n' || key === 'N' || key === '+') {
                e.preventDefault();
                const ymd = formatDate(activeDay);
                if (isSubjectDayReportingBlocked(ymd))
                    return;
                openAdd(ymd);
            }
            else if (key === 'd' || key === 'D') {
                e.preventDefault();
                beginSegViewSwitch('day');
            }
            else if (key === 'w' || key === 'W') {
                e.preventDefault();
                beginSegViewSwitch('week');
            }
            else if (key === 'm' || key === 'M') {
                e.preventDefault();
                beginSegViewSwitch('calendar');
            }
            else if (key === 'Escape' && (query || billableOnly)) {
                e.preventDefault();
                setQuery('');
                setBillableOnly(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modal.open, deleteTarget, timerBusyHintOpen, grantUnlockConfirmOpen, viewTxPhase, viewMode, activeDay, query, billableOnly, isSubjectDayReportingBlocked]);
    async function persistTimerStopToApi(entryId: string, merged: TimeEntry) {
        const user = upsertUserForEntriesRef.current;
        const uid = entriesAuthUserIdRef.current;
        if (!user?.id || !uid)
            return;
        if (isSubjectDayReportingBlocked(merged.date)) {
            setEntriesBanner({
                message: 'Сервер не примет правки по этой дате: неделя уже закрыта (суббота, 9:00, Ташкент).',
                variant: 'amber',
            });
            return;
        }
        const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
        try {
            await upsertTimeTrackingUser(user);
            const durationSeconds = merged.durationSeconds > 0 ? merged.durationSeconds : hoursToDurationSeconds(merged.hours);
            if (isDraftTimeEntryId(entryId)) {
                const inFlight = draftTimerCreateInFlightRef.current;
                if (inFlight.has(entryId))
                    return;
                inFlight.add(entryId);
                try {
                    const row = await createTimeEntry(uid, {
                        workDate: merged.date,
                        durationSeconds,
                        isBillable: merged.billable,
                        projectId: merged.projectId ?? null,
                        taskId: merged.taskId ?? null,
                        description: buildDescription(merged.task, merged.notes),
                    });
                    const next = mapTimeEntryRowToUi(row, byId);
                    setEntries((prev) => {
                        const stripped = prev.filter((x) => x.id !== entryId && x.id !== next.id);
                        return uniqEntriesById([...stripped, next]);
                    });
                }
                finally {
                    inFlight.delete(entryId);
                }
            }
            else {
                const row = await patchTimeEntry(uid, entryId, {
                    durationSeconds,
                });
                setEntries((prev) => prev.map((x) => (x.id === entryId ? mapTimeEntryRowToUi(row, byId) : x)));
            }
        }
        catch (e) {
            setEntriesBanner({
                message: e instanceof Error ? e.message : 'Не удалось сохранить время с таймера',
                variant: isTimeTrackingHttpError(e, 409) ? 'amber' : 'danger',
            });
        }
    }
    const persistTimerStopToApiRef = useRef(persistTimerStopToApi);
    persistTimerStopToApiRef.current = persistTimerStopToApi;
    function flushStopTimer(prev: RunningTimerState) {
        const uid = entriesAuthUserIdRef.current;
        const elapsedMs = Date.now() - prev.startedAt;
        const addSec = elapsedMsToSeconds(elapsedMs);
        const prevId = prev.entryId;
        const ent = entriesRef.current.find((x) => x.id === prevId);
        const merged = ent ? addSeconds(ent, addSec) : null;
        setEntries((ents) => ents.map((row) => (row.id === prevId ? addSeconds(row, addSec) : row)));
        if (uid) {
            try {
                localStorage.removeItem(timerStorageKey(uid));
            }
            catch {
            }
        }
        if (merged && addSec > 0)
            void persistTimerStopToApi(prevId, merged);
    }
    async function saveEntry(e: TimeEntry) {
        const upsertU = upsertUserForEntries;
        const uid = entriesAuthUserId;
        if (!upsertU || !uid)
            throw new Error('Не удалось определить пользователя');
        if (isSubjectDayReportingBlocked(e.date)) {
            setEntriesBanner({
                message: 'Период по дате работы закрыт (неделя сдаётся в субботу, 9:00, Ташкент). Укажите дату в открытом периоде.',
                variant: 'amber',
            });
            throw new Error('Период по выбранной дате закрыт');
        }
        setEntriesBanner(null);
        try {
            await upsertTimeTrackingUser(upsertU);
            const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
            const hoursPositive = Number.isFinite(e.hours) && e.hours > 0;
            if (!hoursPositive) {
                const zeroSnapshot = withHours(e, 0);
                setEntries((prev) => {
                    const without = prev.filter((x) => x.id !== e.id);
                    return [...without, zeroSnapshot];
                });
                const prevRt = runningTimerRef.current;
                if (prevRt?.entryId === e.id) {
                    try {
                        const payload: TimerPersistPayload = {
                            v: 1,
                            authUserId: uid,
                            entryId: e.id,
                            startedAt: prevRt.startedAt,
                            snapshot: zeroSnapshot,
                        };
                        localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload));
                    }
                    catch {
                    }
                    return;
                }
                if (prevRt)
                    flushStopTimer(prevRt);
                const startedAt = Date.now();
                try {
                    const payload: TimerPersistPayload = {
                        v: 1,
                        authUserId: uid,
                        entryId: e.id,
                        startedAt,
                        snapshot: zeroSnapshot,
                    };
                    localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload));
                }
                catch {
                }
                setRunningTimer({ entryId: e.id, startedAt });
                return;
            }
            const desc = buildDescription(e.task, e.notes);
            const durationSeconds = e.durationSeconds > 0 ? e.durationSeconds : hoursToDurationSeconds(e.hours);
            if (isDraftTimeEntryId(e.id)) {
                const body: CreateTimeEntryBody = {
                    workDate: e.date,
                    durationSeconds,
                    isBillable: e.billable,
                    projectId: e.projectId ?? null,
                    taskId: e.taskId ?? null,
                    description: desc,
                };
                if (typeof e.billableFxAsOf === 'string' && e.billableFxAsOf.trim()) {
                    body.billableFxAsOf = e.billableFxAsOf.trim();
                }
                const row = await createTimeEntry(uid, body);
                setEntries((prev) => [...prev.filter((x) => x.id !== e.id), mapTimeEntryRowToUi(row, byId)]);
            }
            else {
                const patch: PatchTimeEntryBody = {
                    workDate: e.date,
                    durationSeconds,
                    isBillable: e.billable,
                    projectId: e.projectId ?? null,
                    taskId: e.taskId ?? null,
                    description: desc,
                };
                if (e.billableFxAsOf === null)
                    patch.billableFxAsOf = null;
                else if (typeof e.billableFxAsOf === 'string' && e.billableFxAsOf.trim()) {
                    patch.billableFxAsOf = e.billableFxAsOf.trim();
                }
                const row = await patchTimeEntry(uid, e.id, patch);
                setEntries((prev) => prev.map((x) => (x.id === e.id ? mapTimeEntryRowToUi(row, byId) : x)));
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Не удалось сохранить запись';
            setEntriesBanner({
                message: msg,
                variant: isTimeTrackingHttpError(err, 409) ? 'amber' : 'danger',
            });
            throw err;
        }
    }
    async function deleteEntry(id: string) {
        const uid = entriesAuthUserId;
        const upsertU = upsertUserForEntries;
        setRunningTimer((rt) => {
            if (rt?.entryId === id && uid) {
                try {
                    localStorage.removeItem(timerStorageKey(uid));
                }
                catch {
                }
                return null;
            }
            return rt;
        });
        if (upsertU && uid && !isDraftTimeEntryId(id)) {
            const forDelete = entriesRef.current.find((x) => x.id === id);
            if (forDelete && isSubjectDayReportingBlocked(forDelete.date)) {
                setEntriesBanner({
                    message: 'Неделя по дате этой записи закрыта — удаление на сервере недоступно (суббота, 9:00, Ташкент).',
                    variant: 'amber',
                });
                return;
            }
            setEntriesBanner(null);
            try {
                await upsertTimeTrackingUser(upsertU);
                const afterDelete = await deleteTimeEntry(uid, id);
                if (afterDelete != null) {
                    const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
                    setEntries((prev) => prev.map((e) => (e.id === id ? mapTimeEntryRowToUi(afterDelete, byId) : e)));
                    setEntriesBanner({ message: 'Запись снята с учёта.', variant: 'success' });
                }
                else {
                    setEntries((prev) => prev.filter((e) => e.id !== id));
                    setEntriesBanner({ message: 'Запись удалена.', variant: 'success' });
                }
            }
            catch (e) {
                setEntriesBanner({
                    message: e instanceof Error ? e.message : 'Не удалось удалить запись',
                    variant: isTimeTrackingHttpError(e, 409) ? 'amber' : 'danger',
                });
                return;
            }
            return;
        }
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setEntriesBanner({ message: 'Запись удалена.', variant: 'success' });
    }
    function toggleRun(id: string) {
        if (isColleagueTimesheetView)
            return;
        const ent = entriesRef.current.find((x) => x.id === id);
        if (ent?.isVoided)
            return;
        if (ent && isSubjectDayReportingBlocked(ent.date))
            return;
        const uid = entriesAuthUserId;
        const prev = runningTimerRef.current;
        if (prev?.entryId === id) {
            flushStopTimer(prev);
            setRunningTimer(null);
            return;
        }
        if (prev && prev.entryId !== id) {
            setTimerBusyHintOpen(true);
            return;
        }
        const startedAt = Date.now();
        const entry = entriesRef.current.find((e) => e.id === id);
        if (uid && entry) {
            try {
                const payload: TimerPersistPayload = {
                    v: 1,
                    authUserId: uid,
                    entryId: id,
                    startedAt,
                    snapshot: entry,
                };
                localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload));
            }
            catch {
            }
        }
        setRunningTimer({ entryId: id, startedAt });
    }
    useEffect(() => {
        const handler = (ev: Event) => {
            if (isColleagueTimesheetView)
                return;
            const e = ev as CustomEvent<TtTimerStoppedDetail>;
            const { entryId, totalHours } = e.detail;
            setRunningTimer((rt) => (rt?.entryId === entryId ? null : rt));
            const ent = entriesRef.current.find((x) => x.id === entryId);
            if (!ent)
                return;
            const totalSec = e.detail.totalDurationSeconds;
            const merged: TimeEntry = typeof totalSec === 'number' && Number.isFinite(totalSec) && totalSec >= 0
                ? { ...ent, durationSeconds: Math.trunc(totalSec), hours: totalSec / 3600 }
                : withHours(ent, totalHours);
            const addSec = (merged.durationSeconds || 0) - (ent.durationSeconds || 0);
            setEntries((prev) => prev.map((row) => (row.id === entryId ? merged : row)));
            if (addSec > 0) {
                void persistTimerStopToApiRef.current(entryId, merged);
            }
        };
        window.addEventListener(TT_TIMER_STOPPED_EVENT, handler as EventListener);
        return () => window.removeEventListener(TT_TIMER_STOPPED_EVENT, handler as EventListener);
    }, [isColleagueTimesheetView]);
    const displayDays = viewMode === 'week' ? weekDays : [activeDay];
    const filterActive = query.trim().length > 0 || billableOnly;
    const rawDayGroups = useMemo(() => displayDays.map((d) => {
        const key = formatDate(d);
        const rows = entries.filter((e) => e.date === key);
        return { date: d, key, rows };
    }), [displayDays, entries]);
    const dayGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rawDayGroups
            .map((g) => {
                let rows = g.rows;
                if (q) {
                    rows = rows.filter((e) => {
                        const t = `${e.project} ${e.client} ${e.task} ${e.notes}`.toLowerCase();
                        return t.includes(q);
                    });
                }
                if (billableOnly)
                    rows = rows.filter((e) => e.billable);
                return { ...g, rows };
            })
            .filter((g) => g.rows.length > 0);
    }, [rawDayGroups, query, billableOnly]);
    const totalRowsInPeriod = rawDayGroups.reduce((s, g) => s + g.rows.length, 0);
    const shownRowsInPeriod = dayGroups.reduce((s, g) => s + g.rows.length, 0);
    const hasAnyEntries = totalRowsInPeriod > 0;
    const hasEntries = dayGroups.length > 0;
    function resetFilters() {
        setQuery('');
        setBillableOnly(false);
    }
    if (blockingSkeleton) {
        return <TimesheetSkeleton layout={viewMode === 'calendar' ? 'calendar' : 'week'} />;
    }
    const headingViewMode = viewTxPhase !== 'idle' ? entriesScopeMode : viewMode;
    const headDate = headingViewMode === 'calendar'
        ? (() => {
            const raw = calendarAnchor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        })()
        : headingViewMode === 'day'
            ? fmtDateHeading(activeDay)
            : isCurrentWeek
                ? `Эта неделя · ${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                : `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
    const showReturnToToday = headingViewMode === 'calendar' ? !isSameMonth(calendarAnchor, today) : !isCurrentWeek;
    const canGoNextNav = viewMode === 'calendar' ? canGoNextByMonth : canGoNextByWeek;
    const nextArrTitle = viewMode === 'calendar'
        ? (canGoNextByMonth ? 'Следующий месяц (→)' : 'Дальше только будущие месяцы (недоступно)')
        : (canGoNextByWeek ? 'Вперёд (→)' : 'Дальше только будущие недели (недоступно)');
    return (<div className={`tsp${viewMode === 'calendar' ? ' tsp--calendar-layout' : ''}`}>
        {entriesBanner && (<div className={`tsp__sync-err${entriesBanner.variant === 'amber'
            ? ' tsp__sync-err--amber'
            : entriesBanner.variant === 'success'
                ? ' tsp__sync-err--success'
                : ''}`} role="alert">
            <span>{entriesBanner.message}</span>
            {entriesBanner.variant === 'amber' && (<p className="tsp__sync-err__sub">
                Неделя сдана или закрыта для правок — изменения по этой дате на сервер не принимаются (ответ 409).
            </p>)}
        </div>)}

        <div className={`tsp__top${headingViewMode === 'day' && activeDayReportingBlocked ? ' tsp__top--day-week-closed' : ''}`}>
            <div className="tsp__top-l">
                <button type="button" className="tsp__arr" onClick={prevPeriod} aria-label={headingViewMode === 'calendar' ? 'Предыдущий месяц' : 'Назад'} title={headingViewMode === 'calendar' ? 'Предыдущий месяц (←)' : 'Назад (←)'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button type="button" className="tsp__arr" onClick={nextPeriod} disabled={!canGoNextNav} aria-label={`${headingViewMode === 'calendar' ? 'Следующий месяц' : 'Вперёд'}${!canGoNextNav ? ' (недоступно, это последний доступный период)' : ''}`} title={nextArrTitle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>

                <h2 className="tsp__heading">{headDate}</h2>

                {headingViewMode === 'day' && (<DatePicker value={formatDate(activeDay)} max={formatDate(today)} onChange={(iso) => {
                    const [y, m, d] = iso.split('-').map((n) => Number(n));
                    if (!y || !m || !d)
                        return;
                    const dt = new Date(y, m - 1, d);
                    if (dt > today)
                        return;
                    setActiveDay(dt);
                    setWeekStart(startOfWeek(dt));
                }} className={`tsp__date-jump-wrap${activeDayReportingBlocked ? ' tsp__date-jump-wrap--week-closed' : ''}`} buttonClassName="tsp__date-jump-btn" title="Перейти к дате" />)}

                {showReturnToToday ? (<button type="button" className="tsp__return" onClick={goTodayPeriod} title="Вернуться к сегодня (T)">
                    Сегодня
                </button>) : (<span className="tsp__return tsp__return--passive" aria-hidden>
                    Сегодня
                </span>)}
            </div>

            <div className="tsp__top-r">
                <div className="tsp__seg">
                    <button type="button" className={`tsp__seg-btn${viewMode === 'day' ? ' tsp__seg-btn--on' : ''}`} disabled={viewTxPhase !== 'idle'} onClick={() => beginSegViewSwitch('day')}>
                        День
                    </button>
                    <button type="button" className={`tsp__seg-btn${viewMode === 'week' ? ' tsp__seg-btn--on' : ''}`} disabled={viewTxPhase !== 'idle'} onClick={() => beginSegViewSwitch('week')}>
                        Неделя
                    </button>
                    <button type="button" className={`tsp__seg-btn${viewMode === 'calendar' ? ' tsp__seg-btn--on' : ''}`} disabled={viewTxPhase !== 'idle'} onClick={() => beginSegViewSwitch('calendar')}>
                        Календарь
                    </button>
                </div>
            </div>
        </div>
        {showGrantUnlockStrip ? (<div className="tsp__grant-unlock" role="region" aria-label="Временная разблокировка правок за выбранный день">
            <span className="tsp__grant-unlock-txt">
              Выбран день в закрытой неделе (<strong>{activeDayYmd}</strong>).
            </span>
            <button type="button" className="tsp__grant-unlock-btn" disabled={grantUnlockBusy} onClick={() => setGrantUnlockConfirmOpen(true)}>
              Разрешить правки на 24 ч
            </button>
          </div>) : null}
        <div className={viewTxPhase === 'idle'
            ? 'tsp__view-stack'
            : `tsp__view-stack tsp__view-stack--${viewTxPhase}`}>
            <div className="tsp__view-live">
                <div className={`tsp__strip${viewMode === 'calendar' ? ' tsp__strip--calendar' : ''}`}>
                    {viewMode === 'calendar' ? (<div className="tsp__cal">
                        <div className="tsp__cal-dows">
                            {CAL_WEEKDAY_LABELS.map((w, di) => (<div key={w} className={`tsp__cal-dow${di >= 5 ? ' tsp__cal-dow--wknd' : ''}`}>
                                {w}
                            </div>))}
                        </div>
                        <div className="tsp__cal-grid">
                            {calendarCells.map((d, i) => {
                                const inMonth = isSameMonth(d, calendarAnchor);
                                const k = formatDate(d);
                                const h = hoursByDate.get(k) ?? 0;
                                const voidInfo = voidInfoByDate.get(k);
                                const voidCalClass = voidInfo?.hasReject
                                    ? 'tsp__cal-cell--void-reject'
                                    : voidInfo?.hasRealloc
                                        ? 'tsp__cal-cell--void-realloc'
                                        : '';
                                const isTodayCell = isSameDay(d, today);
                                const isActiveCell = isSameDay(d, activeDay);
                                const isFuture = d > today && !isTodayCell;
                                const dow = i % 7;
                                const isWkndCol = dow >= 5;
                                const cellWeekClosed = isWorkDateInClosedReportingPeriod(k);
                                return (<button key={i} type="button" className={[
                                    'tsp__cal-cell',
                                    !inMonth ? 'tsp__cal-cell--muted' : '',
                                    isWkndCol ? 'tsp__cal-cell--wknd' : '',
                                    isTodayCell ? 'tsp__cal-cell--today' : '',
                                    isActiveCell ? 'tsp__cal-cell--active' : '',
                                    isFuture ? 'tsp__cal-cell--future' : '',
                                    cellWeekClosed ? 'tsp__cal-cell--week-closed' : '',
                                    voidCalClass,
                                ]
                                    .filter(Boolean)
                                    .join(' ')} onClick={() => {
                                        if (isFuture)
                                            return;
                                        setActiveDay(d);
                                    }} disabled={isFuture} title={d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}>
                                    <span className="tsp__cal-cell-n">{d.getDate()}</span>
                                    {h > 0
                                        ? <span className="tsp__cal-cell-h">{fmtHours(h)}</span>
                                        : voidInfo
                                            ? (<span className={`tsp__cal-cell-void-hint${voidInfo.hasReject ? ' tsp__cal-cell-void-hint--reject' : ' tsp__cal-cell-void-hint--realloc'}`} title="Снято с учёта — см. список записей ниже">
                                                —
                                            </span>)
                                            : null}
                                </button>);
                            })}
                        </div>
                    </div>) : (weekDays.map((d, i) => {
                        const isToday = isSameDay(d, today);
                        const isActive = isSameDay(d, activeDay) && viewMode === 'day';
                        const h = hoursPerDay[i];
                        const isWknd = i >= 5;
                        const pct = Math.min(100, (h / 8) * 100);
                        const isFuture = d > today && !isToday;
                        const dayYmd = formatDate(d);
                        const stripDayClosed = isWorkDateInClosedReportingPeriod(dayYmd);
                        const stripDayQuickBlocked = entriesAuthUserId != null && isSubjectDayReportingBlocked(dayYmd);
                        const vInfo = voidInfoByDate.get(dayYmd);
                        const voidDayClass = vInfo?.hasReject
                            ? 'tsp__day--void-reject'
                            : vInfo?.hasRealloc
                                ? 'tsp__day--void-realloc'
                                : '';
                        return (<div key={i} role="button" tabIndex={isFuture ? -1 : 0} className={[
                            'tsp__day',
                            isToday ? 'tsp__day--today' : '',
                            isActive ? 'tsp__day--active' : '',
                            isWknd ? 'tsp__day--wknd' : '',
                            isFuture ? 'tsp__day--future' : '',
                            stripDayClosed ? 'tsp__day--week-closed' : '',
                            voidDayClass,
                        ]
                            .filter(Boolean)
                            .join(' ')} onClick={() => {
                                if (isFuture)
                                    return;
                                setActiveDay(d);
                                setViewMode('day');
                            }} onKeyDown={(e) => {
                                if (isFuture)
                                    return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setActiveDay(d);
                                    setViewMode('day');
                                }
                            }} aria-disabled={isFuture} title={isFuture
                                ? 'Будущие даты в табеле недоступны'
                                : d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}>
                            <span className="tsp__day-wk">{fmtShort(d)}</span>
                            <span className="tsp__day-n">{d.getDate()}</span>

                            <div className="tsp__day-bar-wrap">
                                <div className={`tsp__day-bar${h > 0 ? ' tsp__day-bar--on' : ''}${pct >= 100 ? ' tsp__day-bar--full' : ''}`} style={{ width: `${pct}%` }} />
                            </div>

                            <span className={`tsp__day-h${h > 0 ? ' tsp__day-h--on' : ''}`}>
                                {h > 0 ? fmtHours(h) : <span className="tsp__day-h-zero">—</span>}
                            </span>

                            <button type="button" className="tsp__day-quick" onClick={(e) => {
                                e.stopPropagation();
                                if (isFuture)
                                    return;
                                openAdd(formatDate(d));
                            }} aria-label={`Добавить время за ${fmtShort(d)}`} tabIndex={-1} disabled={stripDayQuickBlocked || isFuture} title={isFuture
                                ? 'Будущие даты недоступны'
                                : (stripDayQuickBlocked ? 'Неделя по этой дате закрыта для правок' : undefined)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        </div>);
                    }))}

                    <div className="tsp__wtotal">
                        <span className="tsp__wtotal-lbl">
                            {viewMode === 'calendar' ? (<>
                                Итого
                                <br />
                                за месяц
                            </>) : (<>
                                Итого
                                <br />
                                за неделю
                            </>)}
                        </span>
                        <span className={`tsp__wtotal-n${periodTotal > 0 ? ' tsp__wtotal-n--on' : ''}`}>{fmtHours(periodTotal)}</span>
                        <div className="tsp__wtotal-bar-wrap" title={`${Math.round((periodTotal / periodNorm) * 100)}% от ${fmtHours(periodNorm)}`}>
                            <div className="tsp__wtotal-bar" style={{ width: `${periodBarPct}%` }} />
                        </div>
                        <span className="tsp__wtotal-cap">из {fmtHours(periodNorm)}</span>
                    </div>
                </div>
                <div className="tsp__content">
                    {(hasAnyEntries || filterActive) && (<div className="tsp__filter-bar" role="search">
                        <div className="tsp__filter-search">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                                <circle cx="11" cy="11" r="7" />
                                <path d="M21 21l-4.3-4.3" />
                            </svg>
                            <input ref={searchInputRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по проекту, клиенту, задаче, заметкам…" aria-label="Поиск по записям" />
                            {query && (<button type="button" className="tsp__filter-search-clear" onClick={() => setQuery('')} aria-label="Очистить поиск">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>)}
                        </div>
                        <button type="button" className={`tsp__filter-chip${billableOnly ? ' tsp__filter-chip--on' : ''}`} onClick={() => setBillableOnly((v) => !v)} aria-pressed={billableOnly} title="Только биллируемые записи">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Только billable
                        </button>
                        {filterActive && (<button type="button" className="tsp__filter-reset" onClick={resetFilters} title="Сбросить фильтры (Esc)">
                            Сбросить
                        </button>)}
                        <div className="tsp__filter-meta" aria-live="polite">
                            {filterActive
                                ? `Показано ${shownRowsInPeriod} из ${totalRowsInPeriod}`
                                : `Всего записей: ${totalRowsInPeriod}`}
                        </div>
                    </div>)}
                    {!hasEntries ? (filterActive ? (<div className="tsp__empty tsp__empty--filter">
                        <div className="tsp__empty-ico-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <circle cx="11" cy="11" r="7" />
                                <path d="M21 21l-4.3-4.3" />
                            </svg>
                        </div>
                        <p className="tsp__empty-h">Нет записей по заданным фильтрам</p>
                        <p className="tsp__empty-s">Попробуйте изменить запрос или сбросить фильтры.</p>
                        <button className="tsp__empty-cta tsp__empty-cta--ghost" onClick={resetFilters}>
                            Сбросить фильтры
                        </button>
                    </div>) : (<div className="tsp__empty">
                        <div className="tsp__empty-ico-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 7v5l3.5 2" />
                            </svg>
                        </div>
                        <p className="tsp__empty-h">Нет записей за этот день</p>
                        <p className="tsp__empty-s">Добавьте первую запись, чтобы начать отслеживать время</p>
                        <button type="button" className="tsp__empty-cta" onClick={() => openAdd(formatDate(activeDay))} disabled={activeDayReportingBlocked} title={activeDayReportingBlocked ? 'Неделя по этой дате закрыта для правок' : undefined}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Добавить время
                        </button>
                    </div>)) : (<div className="tsp__groups">
                        {dayGroups.map(g => {
                            const dayTotal = g.rows.reduce((s, e) => s + entryHoursInTotals(e), 0);
                            const isToday = isSameDay(g.date, today);
                            const gDayClosed = isWorkDateInClosedReportingPeriod(g.key);
                            const addBlocked = entriesAuthUserId != null && isSubjectDayReportingBlocked(g.key);
                            return (<div key={g.key} className={`tsp__group${gDayClosed ? ' tsp__group--week-closed' : ''}`}>
                                {viewMode === 'week' && (<div className={`tsp__ghd${isToday ? ' tsp__ghd--today' : ''}${gDayClosed ? ' tsp__ghd--week-closed' : ''}`}>
                                    <span className="tsp__ghd-name">
                                        {g.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
                                            .replace(/^\w/, c => c.toUpperCase())}
                                        {isToday && <span className="tsp__ghd-badge">Сегодня</span>}
                                    </span>
                                    <span className="tsp__ghd-total">{fmtHours(dayTotal)}</span>
                                    <button type="button" className="tsp__ghd-add" onClick={() => openAdd(g.key)} aria-label="Добавить" disabled={addBlocked} title={addBlocked ? 'Неделя по этой дате закрыта для правок' : undefined}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                    </button>
                                </div>)}
                                <div className="tsp__rows">
                                    {g.rows.map(e => {
                                        const isRun = runningTimer?.entryId === e.id;
                                        const runningExtraMs = isRun && runningTimer ? Date.now() - runningTimer.startedAt : 0;
                                        void timerTick;
                                        const weekClosedVisual = isWorkDateInClosedReportingPeriod(e.date);
                                        const rowReportingBlocked = entriesAuthUserId != null && isSubjectDayReportingBlocked(e.date);
                                        const voidLocked = Boolean(e.isVoided);
                                        const timeLabel = isRun
                                            ? formatClockFromMs(e.hours * 3600000 + runningExtraMs)
                                            : fmtHours(e.hours);
                                        const voidRowClass = e.isVoided
                                            ? (e.voidKind === 'reallocated' ? ' tsp__row--void-realloc' : ' tsp__row--void-reject')
                                            : '';
                                        return (<div key={e.id} className={`tsp__row${isRun ? ' tsp__row--run' : ''}${weekClosedVisual ? ' tsp__row--week-closed' : ''}${voidRowClass}`}>
                                            <span className="tsp__row-bar" style={{ background: e.color }} />
                                            <div className="tsp__row-txt">
                                                <p className="tsp__row-proj">
                                                    <strong>{e.project}</strong>
                                                    <span className="tsp__row-client">({e.client})</span>
                                                    {!e.billable && <span className="tsp__row-nb">Non-billable</span>}
                                                    {e.isVoided
                                                        ? (<span className="tsp__row-void-badge" title="Запись снята с учёта менеджером — не входит в отчёты">
                                                            {e.voidKind === 'reallocated' ? 'Снято: перенос' : 'Снято: не принято'}
                                                          </span>)
                                                        : null}
                                                </p>
                                                <p className="tsp__row-task">{e.task}</p>
                                                {e.notes && <p className="tsp__row-notes">{e.notes}</p>}
                                            </div>
                                            <div className="tsp__row-acts">
                                                <span className="tsp__row-h">{timeLabel}</span>
                                                <button type="button" className={`tsp__row-start${isRun ? ' tsp__row-start--stop' : ''}`} disabled={isColleagueTimesheetView || rowReportingBlocked || voidLocked} title={isColleagueTimesheetView
                                                    ? 'Таймер доступен только в своём табеле'
                                                    : voidLocked
                                                        ? 'Запись снята с учёта'
                                                        : rowReportingBlocked
                                                            ? 'Неделя по этой дате закрыта для правок — таймер недоступен'
                                                            : undefined} onClick={() => toggleRun(e.id)}>
                                                    {isRun
                                                        ? <><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>Стоп</>
                                                        : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" /></svg>Старт</>}
                                                </button>
                                                <button type="button" className="tsp__row-edit" onClick={() => openEdit(e)} title={voidLocked ? 'Запись снята с учёта — правки недоступны' : rowReportingBlocked ? 'Неделя по дате закрыта для правок' : 'Изменить запись'} disabled={rowReportingBlocked || voidLocked}>
                                                    Изменить
                                                </button>
                                                <button className="tsp__row-del" onClick={() => setDeleteTarget(e)} aria-label="Удалить" title={voidLocked ? 'Запись снята с учёта' : rowReportingBlocked ? 'Неделя по дате закрыта для правок — удаление недоступно' : 'Удалить запись'} disabled={rowReportingBlocked || voidLocked}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>);
                                    })}
                                    <div className="tsp__day-sum">
                                        <span className="tsp__day-sum-r">
                                            <span>Итого:</span>
                                            <span className="tsp__day-sum-n">{fmtHours(dayTotal)}</span>
                                        </span>
                                        <button type="button" className="tsp__day-sum-add" onClick={() => openAdd(g.key)} disabled={addBlocked} title={addBlocked ? 'Неделя по этой дате закрыта для правок' : undefined}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Добавить время
                                        </button>
                                    </div>
                                </div>
                            </div>);
                        })}
                    </div>)}
                </div>
                <div className="tsp__foot">
                    <div className="tsp__foot-total">
                        <span className="tsp__foot-total-lbl">
                            {viewMode === 'calendar' ? 'Итого за месяц:' : 'Итого за неделю:'}
                        </span>
                        <span className="tsp__foot-total-n">{fmtHours(periodTotal)}</span>
                    </div>
                    <div className="tsp__submit-wrap">
                        <button className="tsp__submit">Отправить на утверждение</button>
                        <button className="tsp__submit-arr" aria-label="Опции">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            {viewTxPhase === 'skel' ? (<div className="tsp__view-skel-layer" aria-hidden>
                <TimesheetSkeleton layout={viewMode === 'calendar' ? 'calendar' : 'week'} showChrome={false} />
            </div>) : null}
        </div>

        {modal.open && entriesAuthUserId != null && (<EntryModal key={`${modal.date}_${modal.edit?.id ?? 'new'}`} entry={modal.edit} defaultDate={modal.date} projects={projectsState.items} projectsLoading={projectsState.loading} projectsLoadError={projectsState.error} tasksByClientId={tasksByClientId} clientTasksIndexLoading={clientTasksIndexLoading} entriesSubjectAuthUserId={entriesAuthUserId} viewerCanOverrideWeeklyLock={viewerCanOverrideWeeklyLock} onClose={closeModal} onSave={saveEntry} />)}
        {grantUnlockConfirmOpen && showGrantUnlockStrip && entriesAuthUserId != null ? (<TimesheetGrantUnlockConfirm workDateYmd={activeDayYmd} busy={grantUnlockBusy} onCancel={() => {
            if (!grantUnlockBusy)
                setGrantUnlockConfirmOpen(false);
        }} onConfirm={() => {
            const uid = entriesAuthUserId;
            if (!uid || grantUnlockBusy)
                return;
            setGrantUnlockConfirmOpen(false);
            void (async () => {
                try {
                    setGrantUnlockBusy(true);
                    const out = await grantTimeEntryEditUnlock(uid, activeDayYmd);
                    const until = new Date(out.expiresAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
                    setEntriesBanner({ message: `Сотрудник может править записи за ${activeDayYmd} до ${until}.`, variant: 'success' });
                }
                catch (e) {
                    setEntriesBanner({
                        message: e instanceof Error ? e.message : 'Не удалось выдать разблокировку',
                        variant: 'danger',
                    });
                }
                finally {
                    setGrantUnlockBusy(false);
                }
            })();
        }} />) : null}
        <TimerBusyHintModal open={timerBusyHintOpen} onClose={() => setTimerBusyHintOpen(false)} />
        {deleteTarget && (<TimesheetDeleteConfirm entry={deleteTarget} busy={deleteBusy} onCancel={() => {
            if (deleteBusy)
                return;
            setDeleteTarget(null);
        }} onConfirm={async () => {
            const id = deleteTarget.id;
            setDeleteBusy(true);
            try {
                await deleteEntry(id);
            }
            finally {
                setDeleteBusy(false);
                setDeleteTarget(null);
            }
        }} />)}
    </div>);
}
type TimesheetGrantUnlockConfirmProps = {
    workDateYmd: string;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
};
function TimesheetGrantUnlockConfirm({ workDateYmd, busy, onCancel, onConfirm }: TimesheetGrantUnlockConfirmProps) {
    const titleId = useId();
    const cancelRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!busy)
                    onCancel();
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!busy)
                    void onConfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel, onConfirm]);
    if (typeof document === 'undefined')
        return null;

    return createPortal(<div className="tsp-cfm__overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="tsp-cfm__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tsp-cfm__head">
                <div className="tsp-cfm__ico tsp-cfm__ico--unlock" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                    </svg>
                </div>
                <div className="tsp-cfm__head-txt">
                    <h3 id={titleId} className="tsp-cfm__title">Разрешить правки за этот день?</h3>
                    <p className="tsp-cfm__sub">Временная разблокировка на стороне сервера.</p>
                </div>
                <button type="button" className="tsp-cfm__close" onClick={onCancel} disabled={busy} aria-label="Закрыть">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="tsp-cfm__grant-body">
                <p className="tsp-cfm__grant-body-p">
                    Выбран день в закрытой неделе (<strong>{workDateYmd}</strong>). Выдайте сотруднику правку записей за этот день на <strong>24 часа</strong> (повторное нажатие продлевает срок).
                </p>
            </div>
            <div className="tsp-cfm__foot">
                <button ref={cancelRef} type="button" className="tsp-cfm__btn tsp-cfm__btn--ghost" onClick={onCancel} disabled={busy}>
                    Отмена
                </button>
                <button type="button" className="tsp-cfm__btn tsp-cfm__btn--primary" onClick={() => void onConfirm()} disabled={busy}>
                    Разрешить правки на 24 ч
                </button>
            </div>
        </div>
    </div>, document.body);
}
type TimesheetDeleteConfirmProps = {
    entry: TimeEntry;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
};
function TimesheetDeleteConfirm({ entry, busy, onCancel, onConfirm }: TimesheetDeleteConfirmProps) {
    const cancelRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!busy)
                    onCancel();
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!busy)
                    void onConfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel, onConfirm]);
    if (typeof document === 'undefined')
        return null;

    const hoursLabel = formatHoursClockFromDecimalHours(entry.hours);

    return createPortal(<div className="tsp-cfm__overlay" role="dialog" aria-modal="true" aria-labelledby="tsp-cfm-title">
        <div className="tsp-cfm__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tsp-cfm__head">
                <div className="tsp-cfm__ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4M12 17h.01" />
                        <path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" />
                    </svg>
                </div>
                <div className="tsp-cfm__head-txt">
                    <h3 id="tsp-cfm-title" className="tsp-cfm__title">Удалить запись времени?</h3>
                    <p className="tsp-cfm__sub">Это действие нельзя будет отменить.</p>
                </div>
                <button type="button" className="tsp-cfm__close" onClick={onCancel} disabled={busy} aria-label="Закрыть">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="tsp-cfm__card">
                <span className="tsp-cfm__card-bar" style={{ background: entry.color }} aria-hidden />
                <div className="tsp-cfm__card-txt">
                    <p className="tsp-cfm__card-proj">
                        <strong>{entry.project}</strong>
                        <span className="tsp-cfm__card-client">({entry.client})</span>
                    </p>
                    {entry.task && <p className="tsp-cfm__card-task">{entry.task}</p>}
                    {entry.notes && <p className="tsp-cfm__card-notes">{entry.notes}</p>}
                </div>
                <div className="tsp-cfm__card-h">{hoursLabel}</div>
            </div>
            <div className="tsp-cfm__foot">
                <button ref={cancelRef} type="button" className="tsp-cfm__btn tsp-cfm__btn--ghost" onClick={onCancel} disabled={busy}>
                    Отмена
                </button>
                <button type="button" className="tsp-cfm__btn tsp-cfm__btn--danger" onClick={() => void onConfirm()} disabled={busy}>
                    {busy ? 'Удаление…' : 'Удалить'}
                </button>
            </div>
        </div>
    </div>, document.body);
}
