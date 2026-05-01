import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectOption, } from '@pages/time-tracking/ui/timesheetProjectLoader';
import { ReportPreviewDateTimeFilterPopover } from './ReportPreviewDateTimeFilterPopover';
import { ReportPreviewTextFilterPopover } from './ReportPreviewTextFilterPopover';
import { isClosedReportingWeekEditingBlockedForSubject, isWorkDateInClosedReportingPeriod, listProjectTasks, type ProjectPartnerAccessRow, } from '@entities/time-tracking';
import { formatDecimalHoursRu, formatHoursClockFromDecimalHours, } from '@shared/lib/formatTrackingHours';
import { syncTextareaHeightToContent } from '@shared/lib/syncTextareaHeight';
import { fmtAmtWithIso } from '@entities/time-tracking/lib/reportsFormatUtils';
import { DecimalDurationInput } from './DecimalDurationInput';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { PREVIEW_CATEGORY_OPTIONS, PREVIEW_TASK_OPTIONS, } from '../lib/previewFormOptions';
import {
    formatRuHmFromIso,
    formatRuYmd,
    getLocalYmdAndHmFromIso,
    getLocalYmdFromIso,
    localYmdAndHmToIso,
    recordedAtSortKeyMs,
} from '../lib/briefRecordDateTimeEdit';
import {
    TIME_BRIEF_COLUMN_ORDER_DEFAULT,
    loadBriefColumnsFromStorage,
    normalizeBriefColumnsForUi,
    saveBriefColumnsToStorage,
    type TimeBriefColumnId,
} from '../lib/timeBriefReportColumns';
import {
    TIME_FULL_COLUMN_ORDER_DEFAULT,
    loadFullColumnsFromStorage,
    normalizeFullColumnsForUi,
    saveFullColumnsToStorage,
    type TimeFullColumnId,
} from '../lib/timeFullReportColumns';
import { ReportPreviewTimeBriefColumnsModal } from './ReportPreviewTimeBriefColumnConstructor';
import { ReportPreviewTimeFullColumnsModal } from './ReportPreviewTimeFullColumnsModal';
import type { LabeledOption, BudgetExcelPreviewRow, ExpenseExcelPreviewRow, TimeExcelPreviewRow, UninvoicedExcelPreviewRow, } from '../lib/previewExcelTypes';
type PatchFn<T> = (rowKey: string, patch: Partial<T>) => void;

type TimePreviewPartnerPickState = {
    loading: boolean;
    partners: ProjectPartnerAccessRow[];
};

type PartnerEmployeeSelectItem = {
    id: string;
    label: string;
    position: string;
    search: string;
};
function isTimeRowEditingLockedForViewer(r: TimeExcelPreviewRow, viewerCanOverrideWeeklyLock: boolean): boolean {
    if (r.rowKind !== 'entry' || !r.timeEntryId?.trim())
        return false;
    if (r.isVoided)
        return true;
    const wd = r.workDate?.trim().slice(0, 10) ?? '';
    if (!wd)
        return false;
    return isClosedReportingWeekEditingBlockedForSubject(r.authUserId, wd, viewerCanOverrideWeeklyLock);
}
function timeEntryVoidTrModifier(r: TimeExcelPreviewRow): string {
    if (r.rowKind !== 'entry' || !r.isVoided)
        return '';
    return r.voidKind === 'reallocated'
        ? ' tt-rp-mtable__tr--void-realloc'
        : ' tt-rp-mtable__tr--void-reject';
}
function isInteractiveCellTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element))
        return false;
    return Boolean(target.closest('input, textarea, button, select, a, label, .tsp-srch'));
}
function timePreviewRowsForTotals(displayRows: TimeExcelPreviewRow[]): TimeExcelPreviewRow[] {
    if (displayRows.length === 0)
        return displayRows;
    const hasEntry = displayRows.some((r) => r.rowKind === 'entry');
    const base = hasEntry ? displayRows.filter((r) => r.rowKind === 'entry') : displayRows;
    return base.filter((r) => !r.isVoided);
}
function computeTimePreviewRowAmountToPay(r: TimeExcelPreviewRow): number {
    if (r.isVoided)
        return 0;
    if (!r.isBillable)
        return 0;
    const bh = Number.isFinite(r.billableHours) ? r.billableHours : 0;
    const rate = Number.isFinite(r.billableRate) ? r.billableRate : 0;
    return Math.round(bh * rate * 100) / 100;
}
function ReportPreviewFooterHours({ decimalHours, clockTitle, decTitle, }: {
    decimalHours: number;
    clockTitle: string;
    decTitle: string;
}) {
    return (<div className="tt-rp-mtable__foot-h" title={decTitle}>
      <span className="tt-rp-mtable__foot-h-main" title={clockTitle}>
        {formatHoursClockFromDecimalHours(decimalHours)}
      </span>
      <span className="tt-rp-mtable__foot-h-dec" aria-label={decTitle}>
        {formatDecimalHoursRu(decimalHours)} ч
      </span>
    </div>);
}
function TimePreviewBriefDateTimeCell({ r, onPatch, userName, weekLocked, }: {
    r: TimeExcelPreviewRow;
    onPatch: PatchFn<TimeExcelPreviewRow>;
    userName: string;
    weekLocked: boolean;
}) {
    const u = useId();
    const idWd = `${u}-wd`;
    const idRt = `${u}-rt`;
    if (r.rowKind === 'aggregate' || !r.workDate.trim()) {
        return (<span className="tt-rp-mtable__td--muted" title="Для агрегата нет одной даты/времени записи">—</span>);
    }
    const wd = r.workDate.slice(0, 10);
    const parsed = getLocalYmdAndHmFromIso(r.recordedAt);
    const timeHm = parsed?.hm ?? '12:00';
    const recLocalYmd = getLocalYmdFromIso(r.recordedAt);
    const dayMismatch = Boolean(recLocalYmd && recLocalYmd !== wd);
    const onDateChange = (ymd: string) => {
        const nextIso = localYmdAndHmToIso(ymd, timeHm);
        onPatch(r.rowKey, { workDate: ymd, recordedAt: nextIso });
    };
    const onTimeChange = (hm: string) => {
        onPatch(r.rowKey, { recordedAt: localYmdAndHmToIso(wd, hm) });
    };
    const recordedInSystemLabel = recLocalYmd
        ? `Записано в системе: ${formatRuYmd(recLocalYmd)}, ${formatRuHmFromIso(r.recordedAt)}`
        : `Записано в системе: ${r.recordedAt}`;
    return (<div className="tt-rp-brief-dt">
      <div className="tt-rp-brief-dt__row tt-rp-brief-dt__row--inline">
        <div className="tt-rp-brief-dt__cell tt-rp-brief-dt__cell--date">
          <span className="tt-rp-brief-dt__label--sr" id={idWd}>
            Дата работы
          </span>
          <input className="tt-rp-brief-dt__input tt-rp-brief-dt__input--date" type="date" value={wd} onChange={(e) => onDateChange(e.target.value)} aria-labelledby={idWd} aria-label={`Дата работы, ${userName}`} title={weekLocked ? 'Неделя по дате закрыта — можно сменить дату на день из открытого периода' : undefined}/>
        </div>
        <span className="tt-rp-brief-dt__sep" aria-hidden>
          |
        </span>
        <div className="tt-rp-brief-dt__cell tt-rp-brief-dt__cell--time">
          <span className="tt-rp-brief-dt__label--sr" id={idRt}>
            Время записи
          </span>
          <input className="tt-rp-brief-dt__input tt-rp-brief-dt__input--time" type="time" step={60} value={timeHm} onChange={(e) => onTimeChange(e.target.value)} title={r.recordedAt.trim() ? `ISO: ${r.recordedAt}` : undefined} aria-labelledby={idRt} aria-label={`Время записи, ${userName}`} disabled={weekLocked}/>
        </div>
        <div className="tt-rp-brief-dt__cell tt-rp-brief-dt__cell--info">
          {dayMismatch ? (<button type="button" className="tt-rp-brief-dt__sysinfo" title={recordedInSystemLabel} aria-label={recordedInSystemLabel}>
              <span className="tt-rp-brief-dt__sysinfo-icon" aria-hidden>
                i
              </span>
            </button>) : (<span className="tt-rp-brief-dt__sysinfo-spacer" aria-hidden />)}
        </div>
      </div>
      {weekLocked ? (<p className="tt-rp-brief-dt__hint tt-rp-brief-dt__hint--lock" role="status">
          Неделя по дате закрыта (сдача: суббота, 9:00, Ташкент). Можно сменить только <strong>дату работы</strong>.
        </p>) : null}
    </div>);
}
function TimePreviewBriefDateTimeReadonly({ r }: {
    r: TimeExcelPreviewRow;
}) {
    if (r.rowKind === 'aggregate' || !r.workDate.trim()) {
        return (<span className="tt-rp-mtable__td--muted" title="Для агрегата нет одной даты/времени записи">—</span>);
    }
    const wd = r.workDate.slice(0, 10);
    const hm = formatRuHmFromIso(r.recordedAt);
    const dateRu = formatRuYmd(wd);
    const title = r.recordedAt.trim() ? `ISO: ${r.recordedAt}` : undefined;
    return (<span className="tt-rp-mtable__readonly" title={title}>{`${dateRu}, ${hm}`}</span>);
}
function RpBool({ checked, ariaLabel, onChange, disabled = false, }: {
    checked: boolean;
    ariaLabel: string;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (<input type="checkbox" className="tt-rp-mtable__cb" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={ariaLabel}/>);
}
function TimePreviewReadonlyText({ value, }: {
    value: string | number;
}) {
    if (typeof value === 'number') {
        const display = Number.isFinite(value) ? String(value) : '—';
        return (<span className="tt-rp-mtable__readonly" title={display === '—' ? undefined : display}>{display}</span>);
    }
    const raw = String(value ?? '').replace(/\r\n/g, '\n');
    const display = raw.trim().length === 0 ? '—' : raw;
    return (<span className="tt-rp-mtable__readonly" title={display === '—' ? undefined : display}>{display}</span>);
}

/** Vertical auto-grow for note/description; horizontal size fixed by column. */
const TIME_PREVIEW_NOTE_AUTOSIZE_MAX_PX = 360;

function TimePreviewNoteTextarea({ value, disabled, ariaLabel, variant, onValue, }: {
    value: string;
    disabled: boolean;
    ariaLabel: string;
    variant: 'brief' | 'full';
    onValue: (next: string) => void;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useLayoutEffect(() => {
        syncTextareaHeightToContent(ref.current, TIME_PREVIEW_NOTE_AUTOSIZE_MAX_PX);
    }, [value]);
    const cls = variant === 'brief'
        ? 'tt-rp-mtable__input tt-rp-mtable__textarea tt-rp-mtable__textarea--brief tt-rp-mtable__textarea--autosize'
        : 'tt-rp-mtable__input tt-rp-mtable__textarea tt-rp-mtable__textarea--autosize';
    return (<textarea ref={ref} className={cls} rows={variant === 'brief' ? 1 : 2} value={value} disabled={disabled} placeholder="note = description" aria-label={ariaLabel} onChange={(e) => onValue(e.target.value)}/>);
}

function rowTrClass(i: number, userName: string, selectedUserName: string | null, timeWeekLocked = false): string {
    const parts = ['tt-rp-mtable__tr--pickable'];
    if (i % 2 === 1)
        parts.push('tt-rp-mtable__tr--alt');
    if (selectedUserName === userName)
        parts.push('tt-rp-mtable__tr--selected');
    if (timeWeekLocked)
        parts.push('tt-rp-mtable__tr--server-week-locked');
    return parts.join(' ');
}
function mergeLabeledOptions(base: LabeledOption[], fromRows: LabeledOption[]): LabeledOption[] {
    const m = new Map<string, LabeledOption>();
    for (const o of base)
        m.set(o.id, o);
    for (const o of fromRows) {
        if (!o.id.trim())
            continue;
        if (!m.has(o.id))
            m.set(o.id, o);
    }
    return [...m.values()];
}
function timeReportTaskProjectKey(clientId: string, projectId: string): string {
    return `${clientId.trim()}\x1f${projectId.trim()}`;
}
function buildTimeReportTaskOptionsForProject(clientId: string, projectId: string, allRows: TimeExcelPreviewRow[], apiByProject: Record<string, LabeledOption[]>): LabeledOption[] {
    const cid = clientId.trim();
    const pid = projectId.trim();
    const k = cid && pid ? timeReportTaskProjectKey(cid, pid) : '';
    const fromApi = k ? (apiByProject[k] ?? []) : [];
    const fromRows = allRows
        .filter((x) => (x.clientId?.trim() ?? '') === cid && (x.projectId?.trim() ?? '') === pid && x.taskId.trim())
        .map((x) => ({
        id: x.taskId.trim(),
        label: (x.taskName || x.taskId).trim(),
    }));
    return mergeLabeledOptions(fromApi, fromRows);
}
function useTimeReportTaskOptionsByProject(rows: TimeExcelPreviewRow[]) {
    const [tasksByProjectKey, setTasksByProjectKey] = useState<Record<string, LabeledOption[]>>({});
    const projectPairsKey = useMemo(() => {
        const uniq = new Set<string>();
        for (const r of rows) {
            const cid = String(r.clientId ?? '').trim();
            const pid = String(r.projectId ?? '').trim();
            if (cid && pid)
                uniq.add(`${cid}\x1f${pid}`);
        }
        return [...uniq].sort().join('\0');
    }, [rows]);
    useEffect(() => {
        const pairs = projectPairsKey ? projectPairsKey.split('\0').map((s) => s.split('\x1f')) : [];
        if (pairs.length === 0 || pairs.some((p) => p.length !== 2)) {
            setTasksByProjectKey({});
            return;
        }
        let cancelled = false;
        (async () => {
            const next: Record<string, LabeledOption[]> = {};
            await Promise.all(pairs.map(async ([cid, pid]) => {
                try {
                    const list = await listProjectTasks(cid, pid);
                    if (cancelled)
                        return;
                    next[timeReportTaskProjectKey(cid, pid)] = list.map((t) => ({ id: t.id, label: t.name }));
                }
                catch {
                    if (!cancelled)
                        next[timeReportTaskProjectKey(cid, pid)] = [];
                }
            }));
            if (!cancelled)
                setTasksByProjectKey(next);
        })();
        return () => {
            cancelled = true;
        };
    }, [projectPairsKey]);
    return tasksByProjectKey;
}
function briefMatchesSubstr(hay: string, needle: string): boolean {
    if (!needle.trim())
        return true;
    return hay.toLowerCase().includes(needle.trim().toLowerCase());
}
function briefFilterEmployeeQ(r: TimeExcelPreviewRow, q: string): boolean {
    if (!q.trim())
        return true;
    return briefMatchesSubstr(`${r.employeeName} ${r.userName}`.replace(/\s+/g, ' ').trim(), q);
}
function briefFilterWhenQ(r: TimeExcelPreviewRow, q: string): boolean {
    if (!q.trim())
        return true;
    const pack: string[] = [r.workDate, r.recordedAt];
    const loc = getLocalYmdAndHmFromIso(r.recordedAt);
    if (loc) {
        pack.push(loc.ymd, loc.hm, formatRuYmd(loc.ymd));
    }
    const w = r.workDate?.slice(0, 10);
    if (w)
        pack.push(w, formatRuYmd(w));
    return briefMatchesSubstr(pack.join(' \u200c '), q);
}
function briefFilterTaskQ(r: TimeExcelPreviewRow, q: string): boolean {
    if (!q.trim())
        return true;
    return briefMatchesSubstr(`${r.taskId} ${r.taskName}`.replace(/\s+/g, ' ').trim(), q);
}
function briefFilterNoteQ(r: TimeExcelPreviewRow, q: string): boolean {
    if (!q.trim())
        return true;
    return briefMatchesSubstr(`${r.note}\n${r.description}`.replace(/\s+/g, ' ').trim(), q);
}
function briefFilterDurationQ(r: TimeExcelPreviewRow, q: string, pick: (x: TimeExcelPreviewRow) => number): boolean {
    if (!q.trim())
        return true;
    const v = pick(r);
    const h = Number.isFinite(v) ? v : 0;
    if (briefMatchesSubstr(String(h), q))
        return true;
    return briefMatchesSubstr(formatHoursClockFromDecimalHours(h), q);
}
type UserRowSelectionProps = {
    selectedUserName?: string | null;
    onSelectUserName?: (name: string | null) => void;
    employeeColumnFilterSlot?: ReactNode;
};
type PreviewServerReloadProps = {
    onRequestServerReload?: () => void;
    serverReloadBusy?: boolean;
};
type TimeReportPersistenceProps = {
    timeSave?: {
        ui: 'idle' | 'saving' | 'saved' | 'err';
        message: string | null;
    };

    canOverrideClosedWeek?: boolean;
    briefEmployeeQuery: string;
    moveProjectOptions?: ProjectOption[];
    onDeleteTimeEntry?: (rowKey: string) => void | Promise<void>;
    onMoveTimeEntryToProject?: (rowKey: string, projectId: string) => void | Promise<void>;
    onDuplicateTimeEntry?: (rowKey: string, workDateYmd: string, recordedAtIso: string) => void | Promise<void>;
    onAddTimeEntry?: () => void | Promise<void>;
    timeEntryWorkDateBounds?: {
        min: string;
        max: string;
    } | null;
    onGrantEditUnlock?: (authUserId: number, workDateYmd: string) => void | Promise<void>;
    canGrantEditUnlockForTarget?: (targetAuthUserId: number) => boolean;
    editUnlockPendingCompoundKey?: string | null;
    timeEntryActionPendingRowKey?: string | null;
};
function PreviewServerReloadBtn({ onRequestServerReload, serverReloadBusy, }: PreviewServerReloadProps) {
    if (!onRequestServerReload)
        return null;
    return (<button type="button" className="tt-rp-mtable-reload" onClick={() => onRequestServerReload()} disabled={Boolean(serverReloadBusy)} title="Повторно запросить отчёт с сервера. Локальные правки в ячейках сбросятся.">
      {serverReloadBusy ? 'Загрузка…' : 'Обновить с сервера'}
    </button>);
}
function TimeBriefMoveEntryDialog({ open, row, projectOptions, onClose, onConfirm, busy, }: {
    open: boolean;
    row: TimeExcelPreviewRow | null;
    projectOptions: ProjectOption[];
    onClose: () => void;
    onConfirm: (projectId: string) => void | Promise<void>;
    busy: boolean;
}) {
    const uid = useId();
    const [pick, setPick] = useState('');
    useEffect(() => {
        if (open) {
            setPick('');
        }
    }, [open, row?.rowKey]);
    useEffect(() => {
        if (!open)
            return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy)
                onClose();
        };
        document.addEventListener('keydown', h);
        return () => { document.removeEventListener('keydown', h); };
    }, [open, busy, onClose]);
    const items = useMemo(() => {
        if (!row)
            return [];
        return projectOptions.filter((p) => p.id !== String(row.projectId ?? '').trim());
    }, [projectOptions, row]);
    if (!open || !row)
        return null;
    return createPortal(<div className="tt-rp-mtable-move-ov" role="presentation">
      <div className="tt-rp-mtable-move" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={(e) => e.stopPropagation()}>
        <div className="tt-rp-mtable-move__head">
          <h2 id={`${uid}-t`} className="tt-rp-mtable-move__title">
            Перенос на другой проект
          </h2>
          <button type="button" className="tt-rp-mtable-move__x" onClick={onClose} disabled={busy} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p className="tt-rp-mtable-move__lead">
          Запись <strong>{row.employeeName || row.userName}</strong> — {row.workDate?.slice(0, 10) ?? '—'}. Вся запись (время, задача, текст) останется, сменится только проект и клиент в учёте.
        </p>
        <div className="tt-rp-mtable-move__field">
          <label className="tt-rp-mtable-move__lbl" htmlFor={`${uid}-prj`}>
            Целевой проект
          </label>
          <SearchableSelect<ProjectOption> portalDropdown portalZIndex={14000} portalMinWidth={320} buttonId={`${uid}-prj`} value={pick} items={items} getOptionValue={(p) => p.id} getOptionLabel={(p) => (p.client ? `${p.name} — ${p.client}` : p.name)} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} placeholder="Выберите проект…" emptyListText="Нет других проектов" noMatchText="Не найдено" disabled={busy} onSelect={(p) => {
            setPick(p.id);
        }}/>
        </div>
        <div className="tt-rp-mtable-move__foot">
          <button type="button" className="tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ok" disabled={!pick || busy} onClick={() => void onConfirm(pick)}>
            {busy ? 'Сохранение…' : 'Перенести'}
          </button>
        </div>
      </div>
    </div>, document.body);
}
function TimeDuplicateEntryDialog({ open, row, workDateMin, workDateMax, canOverrideClosedWeek, onClose, onConfirm, busy, }: {
    open: boolean;
    row: TimeExcelPreviewRow | null;
    workDateMin: string;
    workDateMax: string;
    canOverrideClosedWeek: boolean;
    onClose: () => void;
    onConfirm: (workDateYmd: string, recordedAtIso: string) => void | Promise<void>;
    busy: boolean;
}) {
    const uid = useId();
    const [wd, setWd] = useState('');
    const [hm, setHm] = useState('12:00');
    useEffect(() => {
        if (open && row) {
            setWd(row.workDate.slice(0, 10));
            const t = getLocalYmdAndHmFromIso(row.recordedAt);
            setHm(t?.hm ?? '12:00');
        }
    }, [open, row?.rowKey]);
    useEffect(() => {
        if (!open)
            return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy)
                onClose();
        };
        document.addEventListener('keydown', h);
        return () => { document.removeEventListener('keydown', h); };
    }, [open, busy, onClose]);
    if (!open || !row)
        return null;
    const min = workDateMin.slice(0, 10);
    const max = workDateMax.slice(0, 10);
    const weekLockedForPick = Boolean(wd && isClosedReportingWeekEditingBlockedForSubject(row.authUserId, wd, canOverrideClosedWeek));
    const iso = localYmdAndHmToIso(wd || min, hm);
    return createPortal(<div className="tt-rp-mtable-move-ov" role="presentation">
      <div className="tt-rp-mtable-move" role="dialog" aria-modal="true" aria-labelledby={`${uid}-dup-t`} onClick={(e) => e.stopPropagation()}>
        <div className="tt-rp-mtable-move__head">
          <h2 id={`${uid}-dup-t`} className="tt-rp-mtable-move__title">
            Дублировать запись
          </h2>
          <button type="button" className="tt-rp-mtable-move__x" onClick={onClose} disabled={busy} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p className="tt-rp-mtable-move__lead">
          Копия для <strong>{row.employeeName || row.userName}</strong>: укажите <strong>дату работы</strong> и <strong>время записи</strong> для новой строки. Часы, задача и текст совпадут с исходной записью.
        </p>
        <div className="tt-rp-mtable-move__field">
          <label className="tt-rp-mtable-move__lbl" htmlFor={`${uid}-dup-d`}>
            Дата работы
          </label>
          <input id={`${uid}-dup-d`} className="tt-rp-mtable__input tt-rp-mtable__input--emp" type="date" min={min} max={max} value={wd} onChange={(e) => setWd(e.target.value)} disabled={busy}/>
        </div>
        <div className="tt-rp-mtable-move__field">
          <label className="tt-rp-mtable-move__lbl" htmlFor={`${uid}-dup-time`}>
            Время записи
          </label>
          <input id={`${uid}-dup-time`} className="tt-rp-mtable__input tt-rp-mtable__input--emp" type="time" step={60} value={hm} onChange={(e) => setHm(e.target.value)} disabled={busy}/>
        </div>
        {weekLockedForPick ? (<p className="tt-rp-mtable-move__lead" role="status">
            Эта дата в закрытом отчётном периоде — выберите дату в открытом периоде или обратитесь к администратору.
          </p>) : null}
        <div className="tt-rp-mtable-move__foot">
          <button type="button" className="tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ok" disabled={!wd || weekLockedForPick || busy} onClick={() => void onConfirm(wd, iso)}>
            {busy ? 'Создание…' : 'Создать копию'}
          </button>
        </div>
      </div>
    </div>, document.body);
}
export function TimeExcelPreviewTable({ projectTitle, viewMode = 'brief', rows, onPatch, selectedUserName = null, onSelectUserName, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, timeSave, canOverrideClosedWeek = false, briefEmployeeQuery, moveProjectOptions = [], onDeleteTimeEntry, onMoveTimeEntryToProject, onDuplicateTimeEntry, onGrantEditUnlock, canGrantEditUnlockForTarget, editUnlockPendingCompoundKey = null, onAddTimeEntry, timeEntryWorkDateBounds = null, timeEntryActionPendingRowKey = null, employeePartnerPick = null, readOnly = false, }: {
    projectTitle: string;
    
    viewMode?: 'brief' | 'full';
    rows: TimeExcelPreviewRow[];
    onPatch: PatchFn<TimeExcelPreviewRow>;
    employeePartnerPick?: TimePreviewPartnerPickState | null;
    /** Открыто из подтверждённого партнёром отчёта: без правок и без блока подтверждения в родителе */
    readOnly?: boolean;
} & UserRowSelectionProps & PreviewServerReloadProps & TimeReportPersistenceProps) {
    const isFull = viewMode === 'full';
    const readOnlyUi = Boolean(readOnly);
    const showEntryActions = !readOnlyUi && !isFull && (Boolean(onDeleteTimeEntry) || Boolean(onMoveTimeEntryToProject) || Boolean(onDuplicateTimeEntry) || Boolean(onGrantEditUnlock));
    const showActionsColumn = Boolean(showEntryActions);
    const [briefColumnIds, setBriefColumnIds] = useState<TimeBriefColumnId[]>(() => {
        const loaded = loadBriefColumnsFromStorage(showActionsColumn);
        if (loaded?.length)
            return normalizeBriefColumnsForUi(loaded, showActionsColumn);
        return normalizeBriefColumnsForUi(
            [...TIME_BRIEF_COLUMN_ORDER_DEFAULT],
            showActionsColumn,
        );
    });

    useEffect(() => {
        const loaded = loadBriefColumnsFromStorage(showActionsColumn);
        if (loaded?.length) {
            setBriefColumnIds(normalizeBriefColumnsForUi(loaded, showActionsColumn));
        }
        else {
            setBriefColumnIds(normalizeBriefColumnsForUi([...TIME_BRIEF_COLUMN_ORDER_DEFAULT], showActionsColumn));
        }
    }, [showActionsColumn]);

    useEffect(() => {
        saveBriefColumnsToStorage(normalizeBriefColumnsForUi(briefColumnIds, showActionsColumn));
    }, [briefColumnIds, showActionsColumn]);

    const visibleBriefIds = useMemo(
        () => normalizeBriefColumnsForUi(briefColumnIds, showActionsColumn),
        [briefColumnIds, showActionsColumn],
    );
    const [fullColumnIds, setFullColumnIds] = useState<TimeFullColumnId[]>(() => {
        const loaded = loadFullColumnsFromStorage();
        return normalizeFullColumnsForUi(loaded?.length ? loaded : [...TIME_FULL_COLUMN_ORDER_DEFAULT]);
    });

    useEffect(() => {
        saveFullColumnsToStorage(normalizeFullColumnsForUi(fullColumnIds));
    }, [fullColumnIds]);

    const visibleFullIds = useMemo(
        () => normalizeFullColumnsForUi(fullColumnIds),
        [fullColumnIds],
    );
    const [briefColumnsModalOpen, setBriefColumnsModalOpen] = useState(false);
    const [fullColumnsModalOpen, setFullColumnsModalOpen] = useState(false);
    const [moveTargetRow, setMoveTargetRow] = useState<TimeExcelPreviewRow | null>(null);
    const [duplicateTargetRow, setDuplicateTargetRow] = useState<TimeExcelPreviewRow | null>(null);
    const [bfWhen, setBfWhen] = useState('');
    const [bfTask, setBfTask] = useState('');
    const [bfNote, setBfNote] = useState('');
    const [bfBill, setBfBill] = useState('');
    
    const [bfRecordedOrder, setBfRecordedOrder] = useState<'asc' | 'desc'>('asc');
    const tasksByProjectKey = useTimeReportTaskOptionsByProject(rows);
    const taskOptionsByProject = useMemo(() => {
        const m = new Map<string, LabeledOption[]>();
        for (const r of rows) {
            const cid = r.clientId?.trim() ?? '';
            const pid = r.projectId?.trim() ?? '';
            if (!cid || !pid)
                continue;
            const key = `${cid}\x1f${pid}`;
            if (!m.has(key))
                m.set(key, buildTimeReportTaskOptionsForProject(cid, pid, rows, tasksByProjectKey));
        }
        return m;
    }, [rows, tasksByProjectKey]);
    const employeePartnerSelectItems = useMemo((): PartnerEmployeeSelectItem[] | null => {
        if (employeePartnerPick == null || employeePartnerPick.loading)
            return null;
        const m = new Map<number, PartnerEmployeeSelectItem>();
        for (const p of employeePartnerPick.partners) {
            const label = p.displayName.trim() || `Пользователь ${p.authUserId}`;
            const pos = p.position.trim();
            m.set(p.authUserId, {
                id: String(p.authUserId),
                label,
                position: pos,
                search: `${label} ${pos} ${p.authUserId}`.trim(),
            });
        }
        for (const r of rows) {
            if (r.rowKind !== 'entry')
                continue;
            const uid = r.authUserId;
            if (uid > 0 && !m.has(uid)) {
                const label = (r.employeeName || r.userName).trim() || `Пользователь ${uid}`;
                const pos = (r.employeePosition ?? '').trim();
                m.set(uid, {
                    id: String(uid),
                    label,
                    position: pos,
                    search: `${label} ${pos} ${uid}`.trim(),
                });
            }
        }
        return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
    }, [employeePartnerPick, rows]);
    const renderEmployeeBodyCell = (colId: TimeBriefColumnId | TimeFullColumnId, r: TimeExcelPreviewRow, i: number, wk: boolean): ReactNode => {
        if (readOnlyUi) {
            const label = (r.employeeName || r.userName || '').trim() || '—';
            const pos = (r.employeePosition ?? '').trim();
            const text = pos ? `${label} (${pos})` : label;
            return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly">
              <span className="tt-rp-mtable__readonly">{text}</span>
            </td>);
        }
        if (r.rowKind === 'aggregate') {
            if (employeePartnerPick != null && !employeePartnerPick.loading) {
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly">
                  <span className="tt-rp-mtable__td--muted" title="Для строки-агрегата выбор партнёра недоступен">{r.employeeName || r.userName}</span>
                </td>);
            }
            return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                <input className="tt-rp-mtable__input tt-rp-mtable__input--emp" type="text" value={r.employeeName} onChange={(e) => {
                    const v = e.target.value;
                    onPatch(r.rowKey, { employeeName: v, userName: v });
                }} disabled={wk} aria-label={`Сотрудник, строка ${i + 1}`}/>
              </td>);
        }
        if (employeePartnerPick != null) {
            if (employeePartnerPick.loading) {
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                  <span className="tt-rp-mtable__td--muted" role="status">Загрузка партнёров…</span>
                </td>);
            }
            const items = employeePartnerSelectItems ?? [];
            const selId = String(r.authUserId);
            const value = items.some((x) => x.id === selId) ? selId : '';
            return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick">
              <SearchableSelect<PartnerEmployeeSelectItem> portalDropdown className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label={`Партнёр проекта, строка ${i + 1}`} placeholder={items.length === 0 ? 'Нет партнёров с доступом к проекту' : 'Выберите партнёра…'} emptyListText="Нет в списке" noMatchText="Не найдено" value={value} items={items} getOptionValue={(o) => o.id} getOptionLabel={(o) => (o.position ? `${o.label} (${o.position})` : o.label)} getSearchText={(o) => o.search} disabled={wk} onSelect={(o) => {
                    const id = Number(o.id);
                    if (!Number.isFinite(id))
                        return;
                    onPatch(r.rowKey, {
                        authUserId: id,
                        employeeName: o.label,
                        userName: o.label,
                        employeePosition: o.position,
                    });
                }}/>
            </td>);
        }
        return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick">
          <input className="tt-rp-mtable__input tt-rp-mtable__input--emp" type="text" value={r.employeeName} onChange={(e) => {
                const v = e.target.value;
                onPatch(r.rowKey, { employeeName: v, userName: v });
            }} disabled={wk} aria-label={`Сотрудник, строка ${i + 1}`}/>
        </td>);
    };
    const briefDisplayRows = useMemo(() => {
        if (isFull)
            return rows;
        const filtered = rows.filter((r) => briefFilterEmployeeQ(r, briefEmployeeQuery) && briefFilterWhenQ(r, bfWhen) && briefFilterTaskQ(r, bfTask) && briefFilterNoteQ(r, bfNote) && briefFilterDurationQ(r, bfBill, (x) => x.billableHours));
        return [...filtered].sort((a, b) => {
            const ka = recordedAtSortKeyMs(a);
            const kb = recordedAtSortKeyMs(b);
            const aBad = ka === null;
            const bBad = kb === null;
            if (aBad && bBad)
                return a.rowKey.localeCompare(b.rowKey);
            if (aBad)
                return 1;
            if (bBad)
                return -1;
            const diff = (ka as number) - (kb as number);
            const ordered = bfRecordedOrder === 'asc' ? diff : -diff;
            if (ordered !== 0)
                return ordered;
            return a.rowKey.localeCompare(b.rowKey);
        });
    }, [isFull, rows, briefEmployeeQuery, bfWhen, bfTask, bfNote, bfBill, bfRecordedOrder]);
    const fullNameFiltered = useMemo(() => {
        if (!isFull)
            return rows;
        if (!briefEmployeeQuery.trim())
            return rows;
        return rows.filter((r) => briefFilterEmployeeQ(r, briefEmployeeQuery));
    }, [isFull, rows, briefEmployeeQuery]);
    const displayRows = isFull ? fullNameFiltered : briefDisplayRows;
    const rowsForTotals = useMemo(() => timePreviewRowsForTotals(displayRows), [displayRows]);
    const totals = useMemo(() => {
        let h = 0;
        let bh = 0;
        let atp = 0;
        let cost = 0;
        let src = 0;
        for (const r of rowsForTotals) {
            h += Number.isFinite(r.hours) ? r.hours : 0;
            bh += Number.isFinite(r.billableHours) ? r.billableHours : 0;
            atp += computeTimePreviewRowAmountToPay(r);
            cost += Number.isFinite(r.costAmount) ? r.costAmount : 0;
            src += Number.isFinite(r.sourceEntryCount) ? r.sourceEntryCount : 0;
        }
        return {
            h,
            bh,
            atp: Math.round(atp * 100) / 100,
            cost,
            src,
            cur: displayRows[0]?.currency ?? rows[0]?.currency ?? '—',
        };
    }, [rowsForTotals, displayRows, rows]);
    const billablePct = totals.h > 0 ? Math.round((totals.bh / totals.h) * 100) : 0;
    const moveDialogBusy = Boolean(moveTargetRow && timeEntryActionPendingRowKey === moveTargetRow.rowKey);
    const duplicateDialogBusy = Boolean(duplicateTargetRow && timeEntryActionPendingRowKey === duplicateTargetRow.rowKey);
    const dupBounds = timeEntryWorkDateBounds ?? {
        min: '1970-01-01',
        max: '2099-12-31',
    };
    const renderEntryRowActions = (r: TimeExcelPreviewRow, wk: boolean, i: number): ReactNode => {
        if (!showEntryActions || r.rowKind !== 'entry' || !r.timeEntryId?.trim())
            return null;
        const pending = timeEntryActionPendingRowKey === r.rowKey;
        const wdUnlock = (r.workDate || '').trim().slice(0, 10);
        const periodClosed = Boolean(wdUnlock && isWorkDateInClosedReportingPeriod(wdUnlock));
        const showUnlockBtn = Boolean(onGrantEditUnlock && canGrantEditUnlockForTarget?.(r.authUserId) && periodClosed);
        const unlockBusy = Boolean(editUnlockPendingCompoundKey === `${r.authUserId}:${wdUnlock}`);
        return (<div className="tt-rp-mtable__brief-row-actions" role="group" aria-label={`Действия, строка ${i + 1}`}>
          {showUnlockBtn ? (<button type="button" className="tt-rp-mtable__row-act tt-rp-mtable__row-act--unlock" title="Разрешить сотруднику правки за этот день на 24 часа (продлевается при повторном нажатии)" disabled={unlockBusy || pending} onClick={() => void onGrantEditUnlock?.(r.authUserId, wdUnlock)} aria-label="Разблокировать правки за этот день на 24 часа">
              <span className="tt-rp-mtable__row-act-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="11" rx="2"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </span>
            </button>) : null}
          {onDuplicateTimeEntry ? (<button type="button" className="tt-rp-mtable__row-act" title="Дублировать запись (выбор даты и времени)" disabled={Boolean(wk) || pending} onClick={() => {
                setDuplicateTargetRow(r);
            }} aria-label="Дублировать запись">
              <span className="tt-rp-mtable__row-act-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </span>
            </button>) : null}
          {onMoveTimeEntryToProject ? (<button type="button" className="tt-rp-mtable__row-act" title="Перенести запись на другой проект" disabled={Boolean(wk) || pending} onClick={() => {
                setMoveTargetRow(r);
            }} aria-label="Перенести на другой проект">
              <span className="tt-rp-mtable__row-act-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </span>
            </button>) : null}
          {onDeleteTimeEntry ? (<button type="button" className="tt-rp-mtable__row-act tt-rp-mtable__row-act--del" title="Удалить запись" disabled={Boolean(wk) || pending} onClick={() => {
                void onDeleteTimeEntry(r.rowKey);
            }} aria-label="Удалить запись">
              <span className="tt-rp-mtable__row-act-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
              </span>
            </button>) : null}
        </div>);
    };

    const briefFootFirstCellLabel = (colIdx: number): ReactNode => {
        if (colIdx !== 0)
            return null;
        const dupBh = !visibleBriefIds.includes('billHours');
        const dupSum = !visibleBriefIds.includes('sum');
        return (<>
          <div className="tt-rp-mtable__foot-first-label">
            Итого по видимым строкам
          </div>
          {dupBh ? (<div className="tt-rp-mtable__foot-first-dup">
            <ReportPreviewFooterHours decimalHours={totals.bh} clockTitle="Сумма оплачиваемых часов (ч:мм) по видимым строкам" decTitle="Сумма оплачиваемых часов в десятичных часах"/>
          </div>) : null}
          {dupSum ? (<div className="tt-rp-mtable__foot-first-dup tt-rp-mtable__foot-first-dup--money">
            <span className="tt-rp-mtable__sum-val tt-rp-mtable__sum-val--foot">{fmtAmtWithIso(totals.atp, totals.cur)}</span>
          </div>) : null}
        </>);
    };

    const renderBriefHeaderCell = (colId: TimeBriefColumnId): ReactNode => {
        switch (colId) {
            case 'employee':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--employee-head tt-rp-brief-th">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Сотрудник</span>
                    {readOnlyUi ? null : employeeColumnFilterSlot}
                  </div>
                </th>);
            case 'datetime':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--brief-when tt-rp-brief-th">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Дата и время записи</span>
                    {readOnlyUi ? null : (<ReportPreviewDateTimeFilterPopover whenQuery={bfWhen} onWhenQueryChange={setBfWhen} recordedOrder={bfRecordedOrder} onRecordedOrderChange={setBfRecordedOrder}/>)}
                  </div>
                </th>);
            case 'task':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--pick tt-rp-brief-th">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Задача</span>
                    {readOnlyUi ? null : (<ReportPreviewTextFilterPopover aria-label="Фильтр: задача" title="Поиск по задаче" value={bfTask} onChange={setBfTask} placeholder="id, название…" hint="Совпадение по id и названию задачи."/>)}
                  </div>
                </th>);
            case 'note':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--comment tt-rp-brief-th">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label" title="Поле заметки и описания (как в данных)">Заметка, описание</span>
                    {readOnlyUi ? null : (<ReportPreviewTextFilterPopover aria-label="Фильтр: заметка и описание" title="Поиск по тексту" value={bfNote} onChange={setBfNote} placeholder="Текст…" hint="По note и description строки."/>)}
                  </div>
                </th>);
            case 'billHours':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--num" title="Оплачиваемые часы (ч:мм)">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Оплач. часы</span>
                    {readOnlyUi ? null : (<ReportPreviewTextFilterPopover aria-label="Фильтр: оплачиваемые часы" title="Поиск по оплач. часам" value={bfBill} onChange={setBfBill} placeholder="7:30, 1,5…" hint="По десятичным часам и формату ч:мм."/>)}
                  </div>
                </th>);
            case 'sum':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--sum" title="Оплач. часы × ставка, без ручного ввода">
                  <span className="tt-rp-brief-th__label">Сумма</span>
                </th>);
            case 'actions':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--brief-actions tt-rp-brief-th" scope="col" title="Дублирование, перенос на другой проект или удаление записи">
                  <div className="tt-rp-brief-th__row tt-rp-brief-th__row--actions">
                    <span className="tt-rp-brief-th__label">Действия</span>
                  </div>
                </th>);
            default:
                return null;
        }
    };

    const renderBriefBodyCell = (colId: TimeBriefColumnId, r: TimeExcelPreviewRow, i: number, wk: boolean): ReactNode => {
        switch (colId) {
            case 'employee':
                return renderEmployeeBodyCell(colId, r, i, wk);
            case 'datetime':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--brief-dt">
                  {readOnlyUi ? (<TimePreviewBriefDateTimeReadonly r={r}/>) : (<TimePreviewBriefDateTimeCell r={r} onPatch={onPatch} userName={r.userName} weekLocked={wk}/>)}
                </td>);
            case 'task':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                  {readOnlyUi
                    ? (<span className="tt-rp-mtable__readonly">{((r.taskName || r.taskId || '').trim() || '—')}</span>)
                    : (<div className="tt-rp-mtable__brief-task">
                      <SearchableSelect<LabeledOption> portalDropdown className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label={`Задача, ${r.userName}`} placeholder="Задача…" emptyListText="Нет задач" noMatchText="Не найдено" value={r.taskId} items={taskOptionsByProject.get(timeReportTaskProjectKey(r.clientId?.trim() ?? '', r.projectId?.trim() ?? '')) ?? []} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} disabled={wk} onSelect={(o) => onPatch(r.rowKey, { taskId: o.id, taskName: o.label })}/>
                    </div>)}
                </td>);
            case 'note':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                  {readOnlyUi
                    ? (<span className="tt-rp-mtable__readonly tt-rp-mtable__readonly--pre">{String(r.note ?? '').trim() ? r.note : '—'}</span>)
                    : (<TimePreviewNoteTextarea variant="brief" value={r.note} disabled={wk} ariaLabel={`note/description, ${r.userName}`} onValue={(v) => {
                    onPatch(r.rowKey, { note: v, description: v });
                }}/>)}
                </td>);
            case 'billHours':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi
                    ? (<span className="tt-rp-mtable__readonly">{formatHoursClockFromDecimalHours(Number.isFinite(r.billableHours) ? r.billableHours : 0)}</span>)
                    : (<DecimalDurationInput className="tt-rp-mtable__input tt-rp-mtable__input--duration" valueHours={Number.isFinite(r.billableHours) ? r.billableHours : 0} onCommit={(bh) => {
                    const atp = computeTimePreviewRowAmountToPay({ ...r, billableHours: bh });
                    onPatch(r.rowKey, { billableHours: bh, amountToPay: atp });
                }} disabled={wk} aria-label={`Оплачиваемые часы, ${r.userName}`}/>)}
                </td>);
            case 'sum':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--sum-ro" title="Оплач. часы × ставка">
                  <span className="tt-rp-mtable__sum-val">
                    {fmtAmtWithIso(computeTimePreviewRowAmountToPay(r), r.currency)}
                  </span>
                </td>);
            case 'actions':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--brief-actions" onClick={(e) => e.stopPropagation()}>
                  {renderEntryRowActions(r, wk, i)}
                </td>);
            default:
                return null;
        }
    };

    const renderBriefFooterCell = (colId: TimeBriefColumnId, colIdx: number): ReactNode => {
        switch (colId) {
            case 'employee':
            case 'datetime':
            case 'task':
            case 'note':
                return (<td key={`foot-${colId}-${colIdx}`} className={`tt-rp-mtable__td tt-rp-mtable__td--foot ${colIdx === 0 ? 'tt-rp-mtable__td--foot-label' : 'tt-rp-mtable__td--muted'}`}>
                  {colIdx === 0 ? briefFootFirstCellLabel(colIdx) : '—'}
                </td>);
            case 'billHours':
                return (<td key={`foot-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot">
                  {briefFootFirstCellLabel(colIdx)}
                  <ReportPreviewFooterHours decimalHours={totals.bh} clockTitle="Сумма оплачиваемых часов (ч:мм) по видимым строкам" decTitle="Сумма оплачиваемых часов в десятичных часах"/>
                </td>);
            case 'sum':
                return (<td key={`foot-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot tt-rp-mtable__td--sum-ro" title="Сумма к оплате по видимым строкам">
                  {briefFootFirstCellLabel(colIdx)}
                  <span className="tt-rp-mtable__sum-val tt-rp-mtable__sum-val--foot">{fmtAmtWithIso(totals.atp, totals.cur)}</span>
                </td>);
            case 'actions':
                return (<td key={`foot-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--brief-actions tt-rp-mtable__td--brief-actions--foot" aria-hidden="true"/>);
            default:
                return null;
        }
    };

    const fullFootFirstCellLabel = (colIdx: number): ReactNode => {
        if (colIdx !== 0)
            return null;
        const dupBh = !visibleFullIds.includes('billableHours');
        const dupSum = !visibleFullIds.includes('amountToPay');
        const dupCost = !visibleFullIds.includes('costAmount');
        const dupSrc = !visibleFullIds.includes('sourceEntryCount');
        const dupCur = !visibleFullIds.includes('currency');
        return (<>
          <div className="tt-rp-mtable__foot-first-label">
            Итого по видимым строкам
          </div>
          {dupBh ? (<div className="tt-rp-mtable__foot-first-dup">
            <ReportPreviewFooterHours decimalHours={totals.bh} clockTitle="Сумма оплачиваемых часов (ч:мм) по видимым строкам" decTitle="Сумма оплачиваемых часов в десятичных часах"/>
          </div>) : null}
          {dupSum ? (<div className="tt-rp-mtable__foot-first-dup tt-rp-mtable__foot-first-dup--money">
            <span className="tt-rp-mtable__sum-val tt-rp-mtable__sum-val--foot">{fmtAmtWithIso(totals.atp, totals.cur)}</span>
          </div>) : null}
          {dupCost ? (<div className="tt-rp-mtable__foot-first-dup tt-rp-mtable__foot-first-dup--money">
            <span className="tt-rp-mtable__sum-val tt-rp-mtable__sum-val--foot">{fmtAmtWithIso(totals.cost, totals.cur)}</span>
          </div>) : null}
          {dupSrc ? (<div className="tt-rp-mtable__foot-first-dup">{totals.src}</div>) : null}
          {dupCur ? (<div className="tt-rp-mtable__foot-first-dup">{totals.cur}</div>) : null}
        </>);
    };

    const renderFullHeaderCell = (colId: TimeFullColumnId): ReactNode => {
        switch (colId) {
            case 'rn':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--rn">#</th>);
            case 'employee':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--employee-head">
                  <div className="tt-rp-mtable__th-employee">
                    <span className="tt-rp-mtable__th-employee-label">Сотрудник</span>
                    {readOnlyUi ? null : employeeColumnFilterSlot}
                  </div>
                </th>);
            case 'authUserId':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--tight" title="authUserId">ID</th>);
            case 'employeePosition':
                return (<th key={colId} className="tt-rp-mtable__th" title="employeePosition">Должность</th>);
            case 'workDate':
                return (<th key={colId} className="tt-rp-mtable__th">workDate</th>);
            case 'recordedAt':
                return (<th key={colId} className="tt-rp-mtable__th" title="recordedAt (ISO)">recordedAt</th>);
            case 'clientId':
                return (<th key={colId} className="tt-rp-mtable__th">clientId</th>);
            case 'clientName':
                return (<th key={colId} className="tt-rp-mtable__th">clientName</th>);
            case 'projectId':
                return (<th key={colId} className="tt-rp-mtable__th">projectId</th>);
            case 'projectName':
                return (<th key={colId} className="tt-rp-mtable__th">projectName</th>);
            case 'projectCode':
                return (<th key={colId} className="tt-rp-mtable__th">projectCode</th>);
            case 'task':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--pick" title="Задача из справочника клиента: id и название задаются выбором">Задача</th>);
            case 'note':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--comment">note / description</th>);
            case 'billableHours':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num" title="Оплачиваемые часы (ч:мм)">Оплач. часы</th>);
            case 'isBillable':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--tight" title="isBillable">опл.</th>);
            case 'taskBillableByDefault':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--tight" title="taskBillableByDefault">задача опл.</th>);
            case 'isInvoiced':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--tight" title="isInvoiced">в счёте</th>);
            case 'isPaid':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--tight" title="isPaid">счёт опл.</th>);
            case 'isWeekSubmitted':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--tight" title="isWeekSubmitted">нед. сдана</th>);
            case 'billableRate':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num" title="Ставка за час (редактирование пересчитывает сумму)">billableRate</th>);
            case 'amountToPay':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num" title="Оплач. часы × ставка, без ручного ввода">Сумма</th>);
            case 'costRate':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num">costRate</th>);
            case 'costAmount':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num">costAmount</th>);
            case 'sourceEntryCount':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num" title="Для детальной строки = 1, для агрегата = число свёрнутых записей">
                  sourceEntryCount
                </th>);
            case 'currency':
                return (<th key={colId} className="tt-rp-mtable__th">currency</th>);
            case 'externalReferenceUrl':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--comment">externalReferenceUrl</th>);
            case 'invoiceId':
                return (<th key={colId} className="tt-rp-mtable__th">invoiceId</th>);
            case 'invoiceNumber':
                return (<th key={colId} className="tt-rp-mtable__th">invoiceNumber</th>);
            default:
                return null;
        }
    };

    const renderFullBodyCell = (colId: TimeFullColumnId, r: TimeExcelPreviewRow, i: number, wk: boolean): ReactNode => {
        switch (colId) {
            case 'rn':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--rn">{i + 1}</td>);
            case 'employee':
                return renderEmployeeBodyCell(colId, r, i, wk);
            case 'authUserId':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly tt-rp-mtable__td--tight" aria-label={`authUserId, ${r.userName}`}>
                  <TimePreviewReadonlyText value={r.authUserId}/>
                </td>);
            case 'employeePosition':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly" aria-label={`Должность, ${r.userName}`}>
                  <TimePreviewReadonlyText value={r.employeePosition}/>
                </td>);
            case 'workDate':
                return (<td key={colId} className="tt-rp-mtable__td">
                  {r.rowKind === 'aggregate' || !r.workDate.trim()
                      ? (<span className="tt-rp-mtable__td--muted" title="Для агрегата «сотрудник → проект» одна дата не задаётся">—</span>)
                      : readOnlyUi
                          ? (<span className="tt-rp-mtable__readonly">{formatRuYmd(r.workDate.slice(0, 10))}</span>)
                          : (<input className="tt-rp-mtable__input tt-rp-mtable__input--date" type="date" value={r.workDate.slice(0, 10)} onChange={(e) => onPatch(r.rowKey, { workDate: e.target.value })} aria-label={`workDate, ${r.userName}`} title={wk ? 'Можно сменить дату на день из открытого периода' : undefined}/>)}
                </td>);
            case 'recordedAt':
                return (<td key={colId} className="tt-rp-mtable__td">
                  {r.rowKind === 'aggregate'
                      ? (<span className="tt-rp-mtable__td--muted" title="Для агрегата нет одного recordedAt">—</span>)
                      : readOnlyUi
                          ? (<span className="tt-rp-mtable__readonly" title={r.recordedAt}>{`${formatRuYmd(getLocalYmdFromIso(r.recordedAt) ?? r.workDate.slice(0, 10))}, ${formatRuHmFromIso(r.recordedAt)}`}</span>)
                          : (<input className="tt-rp-mtable__input tt-rp-mtable__input--iso" type="text" value={r.recordedAt} onChange={(e) => onPatch(r.rowKey, { recordedAt: e.target.value })} placeholder="ISO…" aria-label={`recordedAt, ${r.userName}`} disabled={wk}/>)}
                </td>);
            case 'clientId':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly" aria-label={`clientId, ${r.userName}`}>
                  <TimePreviewReadonlyText value={r.clientId}/>
                </td>);
            case 'clientName':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly" aria-label={`clientName, ${r.userName}`}>
                  <TimePreviewReadonlyText value={r.clientName}/>
                </td>);
            case 'projectId':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly" aria-label={`projectId, ${r.userName}`}>
                  <TimePreviewReadonlyText value={r.projectId}/>
                </td>);
            case 'projectName':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly" aria-label={`projectName, ${r.userName}`}>
                  <TimePreviewReadonlyText value={r.projectName}/>
                </td>);
            case 'projectCode':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly" aria-label={`projectCode, ${r.userName}`}>
                  <TimePreviewReadonlyText value={r.projectCode}/>
                </td>);
            case 'task':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                  {readOnlyUi
                      ? (<span className="tt-rp-mtable__readonly">{((r.taskName || r.taskId || '').trim() || '—')}</span>)
                      : (<SearchableSelect<LabeledOption> portalDropdown className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label={`Задача, ${r.userName}`} placeholder="Задача…" emptyListText="Нет задач" noMatchText="Не найдено" value={r.taskId} items={taskOptionsByProject.get(timeReportTaskProjectKey(r.clientId?.trim() ?? '', r.projectId?.trim() ?? '')) ?? []} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} disabled={wk} onSelect={(o) => onPatch(r.rowKey, { taskId: o.id, taskName: o.label })}/>)}
                </td>);
            case 'note':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                  {readOnlyUi
                      ? (<span className="tt-rp-mtable__readonly tt-rp-mtable__readonly--pre">{String(r.note ?? '').trim() ? r.note : '—'}</span>)
                      : (<TimePreviewNoteTextarea variant="full" value={r.note} disabled={wk} ariaLabel={`note/description, ${r.userName}`} onValue={(v) => {
                    onPatch(r.rowKey, { note: v, description: v });
                }}/>)}
                </td>);
            case 'billableHours':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi
                      ? (<span className="tt-rp-mtable__readonly">{formatHoursClockFromDecimalHours(Number.isFinite(r.billableHours) ? r.billableHours : 0)}</span>)
                      : (<DecimalDurationInput className="tt-rp-mtable__input tt-rp-mtable__input--duration" valueHours={Number.isFinite(r.billableHours) ? r.billableHours : 0} onCommit={(bh) => {
                    const atp = computeTimePreviewRowAmountToPay({ ...r, billableHours: bh });
                    onPatch(r.rowKey, { billableHours: bh, amountToPay: atp });
                }} disabled={wk} aria-label={`Оплачиваемые часы, ${r.userName}`}/>)}
                </td>);
            case 'isBillable':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--tight">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{r.isBillable ? 'Да' : 'Нет'}</span>) : (<RpBool checked={r.isBillable} ariaLabel={`isBillable, ${r.userName}`} disabled={wk} onChange={(v) => {
                    const newBh = v ? r.hours : r.billableHours;
                    const next: TimeExcelPreviewRow = { ...r, isBillable: v, billableHours: newBh };
                    onPatch(r.rowKey, { isBillable: v, billableHours: newBh, amountToPay: computeTimePreviewRowAmountToPay(next) });
                }}/>)}
                </td>);
            case 'taskBillableByDefault':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--tight">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{r.taskBillableByDefault ? 'Да' : 'Нет'}</span>) : (<RpBool checked={r.taskBillableByDefault} ariaLabel={`taskBillableByDefault, ${r.userName}`} disabled={wk} onChange={(v) => onPatch(r.rowKey, { taskBillableByDefault: v })}/>)}
                </td>);
            case 'isInvoiced':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--tight">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{r.isInvoiced ? 'Да' : 'Нет'}</span>) : (<RpBool checked={r.isInvoiced} ariaLabel={`isInvoiced, ${r.userName}`} disabled={wk} onChange={(v) => onPatch(r.rowKey, { isInvoiced: v })}/>)}
                </td>);
            case 'isPaid':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--tight">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{r.isPaid ? 'Да' : 'Нет'}</span>) : (<RpBool checked={r.isPaid} ariaLabel={`isPaid, ${r.userName}`} disabled={wk} onChange={(v) => onPatch(r.rowKey, { isPaid: v })}/>)}
                </td>);
            case 'isWeekSubmitted':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--tight">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{r.isWeekSubmitted ? 'Да' : 'Нет'}</span>) : (<RpBool checked={r.isWeekSubmitted} ariaLabel={`isWeekSubmitted, ${r.userName}`} disabled={wk} onChange={(v) => onPatch(r.rowKey, { isWeekSubmitted: v })}/>)}
                </td>);
            case 'billableRate':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{Number.isFinite(r.billableRate) ? String(r.billableRate) : '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={0.01} min={0} value={r.billableRate} onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const rate = Number.isFinite(v) ? v : 0;
                    onPatch(r.rowKey, {
                        billableRate: rate,
                        amountToPay: computeTimePreviewRowAmountToPay({ ...r, billableRate: rate }),
                    });
                }} disabled={wk} aria-label={`billableRate, ${r.userName}`}/>)}
                </td>);
            case 'amountToPay':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--sum-ro" title="Оплач. часы × ставка">
                  <span className="tt-rp-mtable__sum-val" aria-label={`Сумма к оплате, ${r.userName}`}>
                    {fmtAmtWithIso(computeTimePreviewRowAmountToPay(r), r.currency)}
                  </span>
                </td>);
            case 'costRate':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{Number.isFinite(r.costRate) ? String(r.costRate) : '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={0.01} min={0} value={r.costRate} onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const cr = Number.isFinite(v) ? v : 0;
                    onPatch(r.rowKey, {
                        costRate: cr,
                        costAmount: Math.round(r.hours * cr * 100) / 100,
                    });
                }} disabled={wk} aria-label={`costRate, ${r.userName}`}/>)}
                </td>);
            case 'costAmount':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{Number.isFinite(r.costAmount) ? String(r.costAmount) : '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={0.01} min={0} value={Number.isFinite(r.costAmount) ? r.costAmount : ''} onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onPatch(r.rowKey, { costAmount: Number.isFinite(v) ? v : 0 });
                }} disabled={wk} aria-label={`costAmount, ${r.userName}`}/>)}
                </td>);
            case 'sourceEntryCount':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{Number.isFinite(r.sourceEntryCount) ? String(r.sourceEntryCount) : '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={1} min={0} value={r.sourceEntryCount} onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    onPatch(r.rowKey, { sourceEntryCount: Number.isFinite(v) && v >= 0 ? v : 0 });
                }} disabled={wk} aria-label={`sourceEntryCount, ${r.userName}`}/>)}
                </td>);
            case 'currency':
                return (<td key={colId} className="tt-rp-mtable__td">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{r.currency || '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--cur" type="text" maxLength={8} value={r.currency} onChange={(e) => onPatch(r.rowKey, { currency: e.target.value.toUpperCase().slice(0, 8) })} disabled={wk} aria-label={`currency, ${r.userName}`}/>)}
                </td>);
            case 'externalReferenceUrl':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly tt-rp-mtable__readonly--pre">{String(r.externalReferenceUrl ?? '').trim() || '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--url" type="url" value={r.externalReferenceUrl} onChange={(e) => onPatch(r.rowKey, { externalReferenceUrl: e.target.value })} placeholder="https://…" disabled={wk} aria-label={`externalReferenceUrl, ${r.userName}`}/>)}
                </td>);
            case 'invoiceId':
                return (<td key={colId} className="tt-rp-mtable__td">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{String(r.invoiceId ?? '').trim() || '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--idtext" type="text" value={r.invoiceId} onChange={(e) => onPatch(r.rowKey, { invoiceId: e.target.value })} disabled={wk} aria-label={`invoiceId, ${r.userName}`}/>)}
                </td>);
            case 'invoiceNumber':
                return (<td key={colId} className="tt-rp-mtable__td">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{String(r.invoiceNumber ?? '').trim() || '—'}</span>) : (<input className="tt-rp-mtable__input tt-rp-mtable__input--name" type="text" value={r.invoiceNumber} onChange={(e) => onPatch(r.rowKey, { invoiceNumber: e.target.value })} disabled={wk} aria-label={`invoiceNumber, ${r.userName}`}/>)}
                </td>);
            default:
                return null;
        }
    };

    const renderFullFooterCell = (colId: TimeFullColumnId, colIdx: number): ReactNode => {
        const labelOnly = (): ReactNode => (<td key={`ff-${colId}-${colIdx}`} className={`tt-rp-mtable__td tt-rp-mtable__td--foot ${colIdx === 0 ? 'tt-rp-mtable__td--foot-label' : 'tt-rp-mtable__td--muted'}`}>
          {colIdx === 0 ? fullFootFirstCellLabel(colIdx) : '—'}
        </td>);
        switch (colId) {
            case 'rn':
            case 'employee':
            case 'authUserId':
            case 'employeePosition':
            case 'workDate':
            case 'recordedAt':
            case 'clientId':
            case 'clientName':
            case 'projectId':
            case 'projectName':
            case 'projectCode':
            case 'task':
            case 'note':
                return labelOnly();
            case 'billableHours':
                return (<td key={`ff-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot">
                  {fullFootFirstCellLabel(colIdx)}
                  <ReportPreviewFooterHours decimalHours={totals.bh} clockTitle="Сумма оплачиваемых часов (ч:мм) по видимым строкам" decTitle="Сумма оплачиваемых часов в десятичных часах"/>
                </td>);
            case 'isBillable':
            case 'taskBillableByDefault':
            case 'isInvoiced':
            case 'isPaid':
            case 'isWeekSubmitted':
            case 'billableRate':
            case 'costRate':
                return labelOnly();
            case 'amountToPay':
                return (<td key={`ff-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot">
                  {fullFootFirstCellLabel(colIdx)}
                  <span className="tt-rp-mtable__sum-val tt-rp-mtable__sum-val--foot">{fmtAmtWithIso(totals.atp, totals.cur)}</span>
                </td>);
            case 'costAmount':
                return (<td key={`ff-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot">
                  {fullFootFirstCellLabel(colIdx)}
                  <span className="tt-rp-mtable__sum-val tt-rp-mtable__sum-val--foot">{fmtAmtWithIso(totals.cost, totals.cur)}</span>
                </td>);
            case 'sourceEntryCount':
                return (<td key={`ff-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--foot" title="Сумма sourceEntryCount по видимым строкам">
                  {fullFootFirstCellLabel(colIdx)}
                  {totals.src}
                </td>);
            case 'currency':
                return (<td key={`ff-${colId}-${colIdx}`} className="tt-rp-mtable__td tt-rp-mtable__td--foot">
                  {fullFootFirstCellLabel(colIdx)}
                  {totals.cur}
                </td>);
            case 'externalReferenceUrl':
            case 'invoiceId':
            case 'invoiceNumber':
                return labelOnly();
            default:
                return null;
        }
    };

    return (<>
      <div className="tt-rp-mtable-wrap">
      <div className="tt-rp-mtable-card">
        <header className="tt-rp-mtable-head">
          <div className="tt-rp-mtable-head-text">
            <div className="tt-rp-mtable-title-row">
              <h2 className="tt-rp-mtable-title">{projectTitle}</h2>
              {readOnlyUi ? (<span className="tt-rp-mtable-badge tt-rp-mtable-badge--ro" title="Редактирование недоступно">
                  Только просмотр
                </span>) : timeSave ? (timeSave.ui === 'saving'
                ? (<span className="tt-rp-mtable-badge tt-rp-mtable-badge--saving" title="Сохранение на сервер">
                  Сохранение…
                </span>)
                : timeSave.ui === 'saved'
                    ? (<span className="tt-rp-mtable-badge tt-rp-mtable-badge--ok" title={timeSave.message ?? 'Сохранено в API'}>
                        Сохранено
                      </span>)
                    : timeSave.ui === 'err'
                        ? (<span className="tt-rp-mtable-badge tt-rp-mtable-badge--err" title={timeSave.message ?? 'Ошибка'} role="status">
                            Ошибка
                          </span>)
                        : (<span className="tt-rp-mtable-badge tt-rp-mtable-badge--api" title="Данные отчёта с сервера. Редактирование по строке записи времени (PATCH) с автосохранением.">
                            Сервер
                          </span>)) : (<span className="tt-rp-mtable-badge tt-rp-mtable-badge--api" title="Предпросмотр">Предпросмотр</span>)}
              {!readOnlyUi ? (<>
              <PreviewServerReloadBtn onRequestServerReload={onRequestServerReload} serverReloadBusy={serverReloadBusy}/>
              {onAddTimeEntry ? (<button type="button" className="tt-rp-mtable-reload" onClick={() => void onAddTimeEntry()} disabled={Boolean(serverReloadBusy || timeSave?.ui === 'saving' || timeEntryActionPendingRowKey != null)} title="Создать новую запись времени (POST) для текущего пользователя и контекста проекта">
                  Добавить запись
                </button>) : null}
              <button type="button" className="tt-rp-mtable-cols-open" onClick={() => {
                  if (isFull)
                      setFullColumnsModalOpen(true);
                  else
                      setBriefColumnsModalOpen(true);
              }} title="Настроить видимые колонки таблицы">
                Колонки отчёта
              </button>
              </>) : null}
            </div>
          </div>
          <div className="tt-rp-mtable-stats" aria-label="Сводка по видимым строкам: только оплачиваемые часы и суммы">
            <div className="tt-rp-mtable-stat tt-rp-mtable-stat--accent" title="Сумма оплачиваемых часов по видимым строкам">
              <span className="tt-rp-mtable-stat__val">{formatHoursClockFromDecimalHours(totals.bh)}</span>
              <span className="tt-rp-mtable-stat__lbl">оплач. ч.</span>
            </div>
            <div className="tt-rp-mtable-stat" title="Доля оплачиваемых от всех списанных в данных строк">
              <span className="tt-rp-mtable-stat__val">{billablePct}%</span>
              <span className="tt-rp-mtable-stat__lbl">доля</span>
            </div>
            <div className="tt-rp-mtable-stat tt-rp-mtable-stat--money" title="Сумма «к оплате»">
              <span className="tt-rp-mtable-stat__val tt-rp-mtable-stat__val--money">{fmtAmtWithIso(totals.atp, totals.cur)}</span>
              <span className="tt-rp-mtable-stat__lbl">к оплате</span>
            </div>
            <div className="tt-rp-mtable-stat tt-rp-mtable-stat--money" title="Себестоимость по строкам">
              <span className="tt-rp-mtable-stat__val tt-rp-mtable-stat__val--money">{fmtAmtWithIso(totals.cost, totals.cur)}</span>
              <span className="tt-rp-mtable-stat__lbl">себест.</span>
            </div>
          </div>
        </header>
        <ReportPreviewTimeBriefColumnsModal open={!readOnlyUi && !isFull && briefColumnsModalOpen} onClose={() => setBriefColumnsModalOpen(false)} includeActionsColumn={showActionsColumn} activeOrderedIds={visibleBriefIds} onChange={setBriefColumnIds}/>
        <ReportPreviewTimeFullColumnsModal open={Boolean(!readOnlyUi && isFull && fullColumnsModalOpen)} onClose={() => setFullColumnsModalOpen(false)} activeOrderedIds={visibleFullIds} onChange={setFullColumnIds}/>
        <div className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          {isFull ? (<table className="tt-rp-mtable tt-rp-mtable--time-wide">
            <thead>
              <tr>
                {visibleFullIds.map((colId) => renderFullHeaderCell(colId))}
                {showEntryActions ? (<th key="actions-full" className="tt-rp-mtable__th tt-rp-mtable__th--brief-actions" scope="col">
                    Действия
                  </th>) : null}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => {
                const wk = isTimeRowEditingLockedForViewer(r, canOverrideClosedWeek);
                return (<tr key={r.rowKey} className={`${rowTrClass(i, r.userName, selectedUserName, wk)}${timeEntryVoidTrModifier(r)}`} onClick={onSelectUserName
                ? (e: MouseEvent<HTMLTableRowElement>) => {
                    if (isInteractiveCellTarget(e.target))
                        return;
                    onSelectUserName(selectedUserName === r.userName ? null : r.userName);
                }
                : undefined} aria-selected={selectedUserName === r.userName ? true : undefined}>
                  {visibleFullIds.map((colId) => renderFullBodyCell(colId, r, i, wk))}
                  {showEntryActions ? (<td key="actions-full" className="tt-rp-mtable__td tt-rp-mtable__td--brief-actions" onClick={(e) => e.stopPropagation()}>
                      {renderEntryRowActions(r, wk, i)}
                    </td>) : null}
                </tr>);
            })}
            </tbody>
            <tfoot>
              <tr className="tt-rp-mtable__foot">
                {visibleFullIds.map((colId, colIdx) => renderFullFooterCell(colId, colIdx))}
                {showEntryActions ? (<td key="full-actions-foot" className="tt-rp-mtable__td tt-rp-mtable__td--foot tt-rp-mtable__td--brief-actions" aria-hidden/>) : null}
              </tr>
            </tfoot>
          </table>) : (<table className="tt-rp-mtable tt-rp-mtable--time-brief">
            <thead>
              <tr>
                {visibleBriefIds.map((colId) => renderBriefHeaderCell(colId))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => {
                const wk = isTimeRowEditingLockedForViewer(r, canOverrideClosedWeek);
                return (<tr key={r.rowKey} className={`${rowTrClass(i, r.userName, selectedUserName, wk)}${timeEntryVoidTrModifier(r)}`} onClick={onSelectUserName
                ? (e: MouseEvent<HTMLTableRowElement>) => {
                    if (isInteractiveCellTarget(e.target))
                        return;
                    onSelectUserName(selectedUserName === r.userName ? null : r.userName);
                }
                : undefined} aria-selected={selectedUserName === r.userName ? true : undefined}>
                  {visibleBriefIds.map((colId) => renderBriefBodyCell(colId, r, i, wk))}
                </tr>);
            })}
            </tbody>
            <tfoot>
              <tr className="tt-rp-mtable__foot">
                {visibleBriefIds.map((colId, colIdx) => renderBriefFooterCell(colId, colIdx))}
              </tr>
            </tfoot>
          </table>)}
        </div>
      </div>
    </div>
      <TimeBriefMoveEntryDialog open={Boolean(moveTargetRow)} row={moveTargetRow} projectOptions={moveProjectOptions} busy={moveDialogBusy} onClose={() => {
            setMoveTargetRow(null);
        }} onConfirm={async (projectId) => {
            if (!moveTargetRow || !onMoveTimeEntryToProject)
                return;
            try {
                await Promise.resolve(onMoveTimeEntryToProject(moveTargetRow.rowKey, projectId));
                setMoveTargetRow(null);
            }
            catch {
            }
        }}/>
      <TimeDuplicateEntryDialog open={Boolean(duplicateTargetRow)} row={duplicateTargetRow} workDateMin={dupBounds.min} workDateMax={dupBounds.max} canOverrideClosedWeek={canOverrideClosedWeek} busy={duplicateDialogBusy} onClose={() => {
            setDuplicateTargetRow(null);
        }} onConfirm={async (workDateYmd, recordedAtIso) => {
            if (!duplicateTargetRow || !onDuplicateTimeEntry)
                return;
            try {
                await Promise.resolve(onDuplicateTimeEntry(duplicateTargetRow.rowKey, workDateYmd, recordedAtIso));
                setDuplicateTargetRow(null);
            }
            catch {
            }
        }}/>
    </>);
}
export function ExpenseExcelPreviewTable({ rows, onPatch, selectedUserName = null, onSelectUserName, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }: {
    rows: ExpenseExcelPreviewRow[];
    onPatch: PatchFn<ExpenseExcelPreviewRow>;
} & UserRowSelectionProps & PreviewServerReloadProps) {
    const categoryOptions = useMemo(() => mergeLabeledOptions(PREVIEW_CATEGORY_OPTIONS, rows.map((r) => ({
        id: r.categoryId,
        label: r.comment.trim() || r.categoryId,
    }))), [rows]);
    return (<div className="tt-rp-mtable-wrap">
      <div className="tt-rp-mtable-card">
        <header className="tt-rp-mtable-head">
          <div className="tt-rp-mtable-head-text">
            <div className="tt-rp-mtable-title-row">
              <h2 className="tt-rp-mtable-title">Расходы</h2>
              <PreviewServerReloadBtn onRequestServerReload={onRequestServerReload} serverReloadBusy={serverReloadBusy}/>
            </div>
            <p className="tt-rp-mtable-sub">Данные с сервера; правки только на этой странице предпросмотра.</p>
          </div>
        </header>
        <div className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          <table className="tt-rp-mtable tt-rp-mtable--wide">
            <thead>
              <tr>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--rn">#</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--employee-head">
                  <div className="tt-rp-mtable__th-employee">
                    <span className="tt-rp-mtable__th-employee-label">Сотрудник</span>
                    {employeeColumnFilterSlot}
                  </div>
                </th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--pick">Категория / разрез</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--comment">Комментарий</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num">Всего</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num">Возмещаемые</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (<tr key={r.rowKey} className={rowTrClass(i, r.userName, selectedUserName)} onClick={onSelectUserName
                ? (e: MouseEvent<HTMLTableRowElement>) => {
                    if (isInteractiveCellTarget(e.target))
                        return;
                    onSelectUserName(selectedUserName === r.userName ? null : r.userName);
                }
                : undefined} aria-selected={selectedUserName === r.userName ? true : undefined}>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">{i + 1}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--strong">{r.userName}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                    <SearchableSelect<LabeledOption> portalDropdown className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label="Категория" placeholder="Категория…" emptyListText="Нет" noMatchText="Не найдено" value={r.categoryId} items={categoryOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} onSelect={(o) => onPatch(r.rowKey, { categoryId: o.id })}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                    <textarea className="tt-rp-mtable__input tt-rp-mtable__textarea" rows={2} value={r.comment} onChange={(e) => onPatch(r.rowKey, { comment: e.target.value })}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                    <input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={0.01} min={0} value={r.total} onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onPatch(r.rowKey, { total: Number.isFinite(v) ? v : 0 });
                }}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                    <input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={0.01} min={0} value={r.billable} onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onPatch(r.rowKey, { billable: Number.isFinite(v) ? v : 0 });
                }}/>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
export function UninvoicedExcelPreviewTable({ rows, onPatch, selectedUserName = null, onSelectUserName, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }: {
    rows: UninvoicedExcelPreviewRow[];
    onPatch: PatchFn<UninvoicedExcelPreviewRow>;
} & UserRowSelectionProps & PreviewServerReloadProps) {
    const taskOptions = useMemo(() => mergeLabeledOptions(PREVIEW_TASK_OPTIONS, rows.map((r) => ({
        id: r.taskId,
        label: r.comment || r.taskId,
    }))), [rows]);
    return (<div className="tt-rp-mtable-wrap">
      <div className="tt-rp-mtable-card">
        <header className="tt-rp-mtable-head">
          <div className="tt-rp-mtable-head-text">
            <div className="tt-rp-mtable-title-row">
              <h2 className="tt-rp-mtable-title">Не выставлено</h2>
              <PreviewServerReloadBtn onRequestServerReload={onRequestServerReload} serverReloadBusy={serverReloadBusy}/>
            </div>
            <p className="tt-rp-mtable-sub">Данные с сервера; правки только на этой странице предпросмотра.</p>
          </div>
        </header>
        <div className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          <table className="tt-rp-mtable tt-rp-mtable--wide">
            <thead>
              <tr>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--rn">#</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--employee-head">
                  <div className="tt-rp-mtable__th-employee">
                    <span className="tt-rp-mtable__th-employee-label">Сотрудник</span>
                    {employeeColumnFilterSlot}
                  </div>
                </th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--pick">Проект</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--comment">Комментарий</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num" title="Формат ч:мм">Часы</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (<tr key={r.rowKey} className={rowTrClass(i, r.userName, selectedUserName)} onClick={onSelectUserName
                ? (e: MouseEvent<HTMLTableRowElement>) => {
                    if (isInteractiveCellTarget(e.target))
                        return;
                    onSelectUserName(selectedUserName === r.userName ? null : r.userName);
                }
                : undefined} aria-selected={selectedUserName === r.userName ? true : undefined}>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">{i + 1}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--strong">{r.userName}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                    <SearchableSelect<LabeledOption> portalDropdown className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label="Проект" placeholder="Проект…" emptyListText="Нет" noMatchText="Не найдено" value={r.taskId} items={taskOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} onSelect={(o) => onPatch(r.rowKey, { taskId: o.id })}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                    <textarea className="tt-rp-mtable__input tt-rp-mtable__textarea" rows={2} value={r.comment} onChange={(e) => onPatch(r.rowKey, { comment: e.target.value })}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                    <DecimalDurationInput className="tt-rp-mtable__input tt-rp-mtable__input--duration" valueHours={r.hours} onCommit={(hours) => onPatch(r.rowKey, { hours })} aria-label={`Часы, ${r.userName}`}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                    <input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={0.01} min={0} value={r.amount} onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onPatch(r.rowKey, { amount: Number.isFinite(v) ? v : 0 });
                }}/>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
export function BudgetExcelPreviewTable({ rows, onPatch, selectedUserName = null, onSelectUserName, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }: {
    rows: BudgetExcelPreviewRow[];
    onPatch: PatchFn<BudgetExcelPreviewRow>;
} & UserRowSelectionProps & PreviewServerReloadProps) {
    const taskOptions = useMemo(() => mergeLabeledOptions(PREVIEW_TASK_OPTIONS, rows.map((r) => ({
        id: r.taskId,
        label: r.taskId,
    }))), [rows]);
    return (<div className="tt-rp-mtable-wrap">
      <div className="tt-rp-mtable-card">
        <header className="tt-rp-mtable-head">
          <div className="tt-rp-mtable-head-text">
            <div className="tt-rp-mtable-title-row">
              <h2 className="tt-rp-mtable-title">Бюджет</h2>
              <PreviewServerReloadBtn onRequestServerReload={onRequestServerReload} serverReloadBusy={serverReloadBusy}/>
            </div>
            <p className="tt-rp-mtable-sub">Данные с сервера; правки только на этой странице предпросмотра.</p>
          </div>
        </header>
        <div className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          <table className="tt-rp-mtable tt-rp-mtable--wide">
            <thead>
              <tr>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--rn">#</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--employee-head">
                  <div className="tt-rp-mtable__th-employee">
                    <span className="tt-rp-mtable__th-employee-label">Сотрудник</span>
                    {employeeColumnFilterSlot}
                  </div>
                </th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--pick">Проект</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num" title="Формат ч:мм">Часы (факт)</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num">Сумма (факт)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (<tr key={r.rowKey} className={rowTrClass(i, r.userName, selectedUserName)} onClick={onSelectUserName
                ? (e: MouseEvent<HTMLTableRowElement>) => {
                    if (isInteractiveCellTarget(e.target))
                        return;
                    onSelectUserName(selectedUserName === r.userName ? null : r.userName);
                }
                : undefined} aria-selected={selectedUserName === r.userName ? true : undefined}>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">{i + 1}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--strong">{r.userName}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                    <SearchableSelect<LabeledOption> portalDropdown className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label="Проект" placeholder="Проект…" emptyListText="Нет" noMatchText="Не найдено" value={r.taskId} items={taskOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} onSelect={(o) => onPatch(r.rowKey, { taskId: o.id })}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                    <DecimalDurationInput className="tt-rp-mtable__input tt-rp-mtable__input--duration" valueHours={r.hoursLogged} onCommit={(hours) => onPatch(r.rowKey, { hoursLogged: hours })} aria-label={`Часы (факт), ${r.userName}`}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--num">
                    <input className="tt-rp-mtable__input tt-rp-mtable__input--num" type="number" step={0.01} min={0} value={r.amountLogged} onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onPatch(r.rowKey, { amountLogged: Number.isFinite(v) ? v : 0 });
                }}/>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
