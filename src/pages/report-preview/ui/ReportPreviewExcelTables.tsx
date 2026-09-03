import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode, } from 'react';
import { VirtualizedTableRows, type VirtualTableRowMeasureProps } from '@shared/ui/VirtualizedTableRows';
import { createPortal } from 'react-dom';
import type { ProjectOption, } from '@pages/time-tracking/ui/timesheetProjectLoader';
import { ReportPreviewDateTimeFilterPopover } from './ReportPreviewDateTimeFilterPopover';
import { ReportPreviewTextFilterPopover } from './ReportPreviewTextFilterPopover';
import { ReportPreviewScopeColorFilterPopover, SCOPE_COLOR_NONE } from './ReportPreviewScopeColorFilterPopover';
import { ReportPreviewScopeColorPicker } from './ReportPreviewScopeColorPicker';
import { REPORT_PREVIEW_SCOPE_DEFAULT } from '../lib/reportPreviewScopePalette';
import { isClosedReportingWeekEditingBlockedForSubject, isWorkDateInClosedReportingPeriod, listProjectTasksCached, type ProjectPartnerAccessRow, } from '@entities/time-tracking';
import { formatDecimalHoursAsHm, formatReportBillableHoursRu, sumDecimalHoursForMinuteDisplay, } from '@shared/lib/formatTrackingHours';
import { syncTextareaHeightToContent } from '@shared/lib/syncTextareaHeight';
import { fmtAmtWithIso } from '@entities/time-tracking/lib/reportsFormatUtils';
import { DecimalDurationInput } from './DecimalDurationInput';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { isKostaLegalInternalTask } from '../lib/reportPreviewInternalTask';

/** Above `.tt-rp-mtable-wrap--fullscreen` (12000) and dock so bottom-row menus stay visible. */
const TT_RP_SELECT_PORTAL_Z = 15000;
import { PREVIEW_CATEGORY_OPTIONS, PREVIEW_TASK_OPTIONS, } from '../lib/previewFormOptions';
import {
    computeTimePreviewRowAmountToPay,
    recomputeTimePreviewRowAmountToPay,
    timePreviewRowsForPageExport,
} from '../lib/reportPreviewPartnerExcel';
import { buildReportPreviewPositionShare, itemMatchesPositionShareFilter, rowMatchesPositionShareFilter, togglePositionShareFilter } from '../lib/reportPreviewPositionShare';
import { buildTimePreviewDuplicateRowKeySet, TIME_PREVIEW_DUPLICATE_ROW_TITLE, } from '../lib/reportPreviewDuplicateRows';
import {
    formatRuHmFromIso,
    formatRuYmd,
    getLocalYmdAndHmFromIso,
    getLocalYmdFromIso,
    localYmdAndHmToIso,
    sortTimePreviewRowsByScopeThenChrono,
    sortTimePreviewRowsChronologically,
} from '../lib/briefRecordDateTimeEdit';
import {
    TIME_BRIEF_COLUMN_ORDER_DEFAULT,
    briefColumnColWidth,
    loadBriefColumnsFromStorage,
    loadBriefColumnsRemember,
    normalizeBriefColumnsForUi,
    resolveBriefFlexColumnId,
    saveBriefColumnsRemember,
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
import { ReportPreviewRuDateField } from './ReportPreviewRuDateField';
import { ReportPreviewTimeBriefColumnsModal } from './ReportPreviewTimeBriefColumnConstructor';
import { ReportPreviewTimeFullColumnsModal } from './ReportPreviewTimeFullColumnsModal';
import { ReportPreviewHotkeysHelpModal } from './ReportPreviewHotkeysHelpModal';
import { formatPrimaryShortcut } from '../lib/reportPreviewHotkeys';
import type { LabeledOption, BudgetExcelPreviewRow, ExpenseExcelPreviewRow, TimeExcelPreviewRow, UninvoicedExcelPreviewRow, } from '../lib/previewExcelTypes';
type PatchFn<T> = (rowKey: string, patch: Partial<T>) => void;

type TimePreviewEmployeePickState = {
    loading: boolean;
    members: ProjectPartnerAccessRow[];
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
function timeEntryDuplicateTrModifier(isDuplicate: boolean): string {
    return isDuplicate ? ' tt-rp-mtable__tr--duplicate' : '';
}
function timeEntrySessionCopyTrModifier(r: TimeExcelPreviewRow): string {
    return r.isSessionCopy ? ' tt-rp-mtable__tr--session-copy' : '';
}
function SessionCopyMark({ row }: { row: TimeExcelPreviewRow }) {
    if (!row.isSessionCopy)
        return null;
    if (row.sessionCopyEdited) {
        return (
            <span
                className="tt-rp-mtable__copy-dot"
                title="Копия, созданная в этой сессии"
                aria-label="Копия"
            />
        );
    }
    return (
        <span className="tt-rp-mtable__copy-badge" title="Копия, созданная в этой сессии">
            Копия
        </span>
    );
}
function InternalTaskMark({ row }: { row: TimeExcelPreviewRow }) {
    if (!isKostaLegalInternalTask(row.taskName, row.taskId))
        return null;
    return (
        <span className="tt-rp-mtable__internal-badge" title="Kosta Legal Internal">
            INT
        </span>
    );
}
function timePreviewRowsForTotals(displayRows: TimeExcelPreviewRow[]): TimeExcelPreviewRow[] {
    return timePreviewRowsForPageExport(displayRows);
}
function formatReportPreviewDurationHours(hours: number): string {
    return formatDecimalHoursAsHm(Number.isFinite(hours) ? hours : 0);
}
function ruEntriesWord(n: number): string {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20)
        return 'записей';
    if (last === 1)
        return 'запись';
    if (last >= 2 && last <= 4)
        return 'записи';
    return 'записей';
}
function briefRowDateTimeParts(r: TimeExcelPreviewRow): {
    wd: string;
    timeHm: string;
    recLocalYmd: string | null;
    dayMismatch: boolean;
    effectiveDate: string;
} | null {
    if (r.rowKind === 'aggregate' || !r.workDate.trim())
        return null;
    const wd = r.workDate.slice(0, 10);
    const parsed = getLocalYmdAndHmFromIso(r.recordedAt);
    const timeHm = parsed?.hm ?? '12:00';
    const recLocalYmd = getLocalYmdFromIso(r.recordedAt);
    const dayMismatch = Boolean(recLocalYmd && recLocalYmd !== wd);
    return { wd, timeHm, recLocalYmd, dayMismatch, effectiveDate: recLocalYmd ?? wd };
}
function TimePreviewBriefDateCell({ r, onPatch, weekLocked, }: {
    r: TimeExcelPreviewRow;
    onPatch: PatchFn<TimeExcelPreviewRow>;
    weekLocked: boolean;
}) {
    const u = useId();
    const idWd = `${u}-wd`;
    const parts = briefRowDateTimeParts(r);
    if (!parts) {
        return (<span className="tt-rp-mtable__td--muted" title="Для агрегата нет одной даты записи">—</span>);
    }
    const onDateChange = (ymd: string) => {
        onPatch(r.rowKey, { workDate: ymd, recordedAt: localYmdAndHmToIso(ymd, parts.timeHm) });
    };
    return (<div className="tt-rp-brief-dt tt-rp-brief-dt--date-only">
      <span className="tt-rp-brief-dt__label--sr" id={idWd}>Дата записи</span>
      <ReportPreviewRuDateField id={idWd} variant="brief" value={parts.wd} onChange={onDateChange} aria-labelledby={idWd} title={weekLocked ? 'Неделя по дате закрыта — можно сменить дату на день из открытого периода' : undefined}/>
      {weekLocked ? (<p className="tt-rp-brief-dt__hint tt-rp-brief-dt__hint--lock" role="status">
          Неделя по дате закрыта. Можно сменить дату, время или удалить запись.
        </p>) : null}
    </div>);
}
function TimePreviewBriefTimeCell({ r, onPatch, userName, }: {
    r: TimeExcelPreviewRow;
    onPatch: PatchFn<TimeExcelPreviewRow>;
    userName: string;
}) {
    const u = useId();
    const idRt = `${u}-rt`;
    const parts = briefRowDateTimeParts(r);
    if (!parts) {
        return (<span className="tt-rp-mtable__td--muted" title="Для агрегата нет одного времени записи">—</span>);
    }
    const onTimeChange = (hm: string) => {
        onPatch(r.rowKey, { recordedAt: localYmdAndHmToIso(parts.effectiveDate, hm) });
    };
    const recordedInSystemLabel = parts.recLocalYmd
        ? `Записано в системе: ${formatRuYmd(parts.recLocalYmd)}, ${formatRuHmFromIso(r.recordedAt)}`
        : `Записано в системе: ${r.recordedAt}`;
    return (<div className="tt-rp-brief-dt tt-rp-brief-dt--time-only">
      <span className="tt-rp-brief-dt__label--sr" id={idRt}>Время записи</span>
      <div className="tt-rp-brief-dt__time-wrap">
        <input className="tt-rp-brief-dt__input tt-rp-brief-dt__input--time" type="time" lang="ru" step={60} value={parts.timeHm} onChange={(e) => onTimeChange(e.target.value)} onInput={(e) => onTimeChange(e.currentTarget.value)} title={r.recordedAt.trim() ? `ISO: ${r.recordedAt}` : undefined} aria-labelledby={idRt} aria-label={`Время записи, ${userName}`}/>
        {parts.dayMismatch ? (<button type="button" className="tt-rp-brief-dt__sysinfo" title={recordedInSystemLabel} aria-label={recordedInSystemLabel}>
            <span className="tt-rp-brief-dt__sysinfo-icon" aria-hidden>i</span>
          </button>) : null}
      </div>
    </div>);
}
function TimePreviewBriefDateReadonly({ r }: { r: TimeExcelPreviewRow; }) {
    if (r.rowKind === 'aggregate' || !r.workDate.trim()) {
        return (<span className="tt-rp-mtable__td--muted" title="Для агрегата нет одной даты записи">—</span>);
    }
    return (<span className="tt-rp-mtable__readonly">{formatRuYmd(r.workDate.slice(0, 10))}</span>);
}
function TimePreviewBriefTimeReadonly({ r }: { r: TimeExcelPreviewRow; }) {
    if (r.rowKind === 'aggregate' || !r.workDate.trim()) {
        return (<span className="tt-rp-mtable__td--muted" title="Для агрегата нет одного времени записи">—</span>);
    }
    const title = r.recordedAt.trim() ? `ISO: ${r.recordedAt}` : undefined;
    return (<span className="tt-rp-mtable__readonly" title={title}>{formatRuHmFromIso(r.recordedAt)}</span>);
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

const TIME_PREVIEW_NOTE_AUTOSIZE_MAX_FULL_PX = 200;

function TimePreviewNoteTextarea({ value, disabled, ariaLabel, variant, onValue, }: {
    value: string;
    disabled: boolean;
    ariaLabel: string;
    variant: 'brief' | 'full';
    onValue: (next: string) => void;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const syncHeight = () => {
        syncTextareaHeightToContent(ref.current, variant === 'brief' ? undefined : TIME_PREVIEW_NOTE_AUTOSIZE_MAX_FULL_PX);
    };
    useLayoutEffect(() => {
        syncHeight();
    }, [value, variant, disabled]);
    const cls = variant === 'brief'
        ? 'tt-rp-mtable__input tt-rp-mtable__textarea tt-rp-mtable__textarea--brief tt-rp-mtable__textarea--autosize'
        : 'tt-rp-mtable__input tt-rp-mtable__textarea tt-rp-mtable__textarea--autosize';
    return (<textarea ref={ref} className={cls} rows={variant === 'brief' ? 1 : 2} value={value} disabled={disabled} placeholder="note = description" aria-label={ariaLabel} onChange={(e) => {
            onValue(e.target.value);
            requestAnimationFrame(syncHeight);
        }}/>);
}

function isReportRowSelected(rowKey: string, selectedRowKeys: ReadonlySet<string> | null | undefined): boolean {
    return Boolean(selectedRowKeys?.has(rowKey));
}
function timeEntryFlashTrModifier(rowKey: string, flashRowKey: string | null | undefined): string {
    return flashRowKey && flashRowKey === rowKey ? ' tt-rp-mtable__tr--flash-restored' : '';
}
function rowTrClass(_i: number, rowKey: string, selectedRowKeys: ReadonlySet<string> | null | undefined, timeWeekLocked = false): string {
    const parts = ['tt-rp-mtable__tr--pickable'];
    if (isReportRowSelected(rowKey, selectedRowKeys))
        parts.push('tt-rp-mtable__tr--selected');
    if (timeWeekLocked)
        parts.push('tt-rp-mtable__tr--server-week-locked');
    return parts.join(' ');
}
function ReportRowSelectHeader({ selectedRowKeys, visibleRowKeys, onSelectedRowKeysChange, }: {
    selectedRowKeys?: ReadonlySet<string> | null;
    visibleRowKeys: string[];
    onSelectedRowKeysChange?: (keys: ReadonlySet<string>) => void;
}) {
    if (!onSelectedRowKeysChange || visibleRowKeys.length <= 0)
        return null;
    const selected = selectedRowKeys ?? new Set<string>();
    const allSelected = visibleRowKeys.every((k) => selected.has(k));
    return (<th className="tt-rp-mtable__th tt-rp-mtable__th--select" scope="col">
      <RpBool checked={allSelected} ariaLabel={allSelected ? 'Снять выделение со всех строк' : 'Выделить все видимые строки'} onChange={(checked) => {
            onSelectedRowKeysChange(checked ? new Set(visibleRowKeys) : new Set());
        }}/>
    </th>);
}
function ReportRowSelectCell({ rowKey, selectedRowKeys, onSelectedRowKeysChange, }: {
    rowKey: string;
    selectedRowKeys?: ReadonlySet<string> | null;
    onSelectedRowKeysChange?: (keys: ReadonlySet<string>) => void;
}) {
    if (!onSelectedRowKeysChange)
        return null;
    const selected = isReportRowSelected(rowKey, selectedRowKeys);
    return (<td className="tt-rp-mtable__td tt-rp-mtable__td--select" onClick={(e) => e.stopPropagation()}>
      <RpBool checked={selected} ariaLabel={selected ? 'Снять выделение со строки' : 'Выделить строку'} onChange={(checked) => {
            const next = new Set(selectedRowKeys ?? []);
            if (checked)
                next.add(rowKey);
            else
                next.delete(rowKey);
            onSelectedRowKeysChange(next);
        }}/>
    </td>);
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
    const projectPairs = useMemo(() => {
        const uniq = new Set<string>();
        for (const r of rows) {
            const cid = String(r.clientId ?? '').trim();
            const pid = String(r.projectId ?? '').trim();
            if (cid && pid)
                uniq.add(timeReportTaskProjectKey(cid, pid));
        }
        return [...uniq].sort();
    }, [rows]);
    const projectPairsKey = projectPairs.join('\0');
    useEffect(() => {
        const pairs = projectPairsKey ? projectPairsKey.split('\0').filter(Boolean) : [];
        const wanted = new Set(pairs);
        setTasksByProjectKey((prev) => {
            let changed = false;
            const next: Record<string, LabeledOption[]> = {};
            for (const [k, v] of Object.entries(prev)) {
                if (wanted.has(k))
                    next[k] = v;
                else
                    changed = true;
            }
            return changed ? next : prev;
        });
        if (wanted.size === 0)
            return;
        let cancelled = false;
        for (const key of pairs) {
            const sep = key.indexOf('\x1f');
            if (sep <= 0 || sep === key.length - 1)
                continue;
            const cid = key.slice(0, sep);
            const pid = key.slice(sep + 1);
            void listProjectTasksCached(cid, pid)
                .then((list) => {
                    if (cancelled)
                        return;
                    setTasksByProjectKey((prev) => ({
                        ...prev,
                        [key]: list.map((t) => ({ id: t.id, label: t.name })),
                    }));
                })
                .catch(() => {
                    if (cancelled)
                        return;
                    setTasksByProjectKey((prev) => (prev[key] ? prev : { ...prev, [key]: [] }));
                });
        }
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
    return briefMatchesSubstr(formatReportBillableHoursRu(h), q) || briefMatchesSubstr(formatDecimalHoursAsHm(h), q);
}
type UserRowSelectionProps = {
    selectedRowKeys?: ReadonlySet<string> | null;
    onSelectedRowKeysChange?: (keys: ReadonlySet<string>) => void;
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
    onDownloadExcel?: (visibleRows: TimeExcelPreviewRow[]) => void | Promise<void>;
    downloadExcelBusy?: boolean;
        flashRowKey?: string | null;
        hotkeyDuplicateRowKey?: string | null;
    onHotkeyDuplicateConsumed?: () => void;
    onActiveTimeRowKey?: (rowKey: string) => void;
    canUndo?: boolean;
    onUndo?: () => void | Promise<void>;
    onSaveNow?: () => void | Promise<void>;
    scopeDefinitionsSlot?: ReactNode;
    scopeColorValue?: string;
    scopeColorBusy?: boolean;
    onScopeColorValueChange?: (color: string) => void;
    onApplyScopeColorToSelection?: (rowKeys: ReadonlySet<string>, color: string) => void | Promise<void>;
    onClearScopeColorFromSelection?: (rowKeys: ReadonlySet<string>) => void | Promise<void>;
};
function PreviewServerReloadBtn({ onRequestServerReload, serverReloadBusy, }: PreviewServerReloadProps) {
    if (!onRequestServerReload)
        return null;
    return (<button type="button" className="tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-mtable-toolbar__btn--reload" onClick={() => onRequestServerReload()} disabled={Boolean(serverReloadBusy)} aria-busy={Boolean(serverReloadBusy)} title="Повторно запросить отчёт с сервера. Локальные правки в ячейках сбросятся.">
      {serverReloadBusy ? <span className="tt-rp-mtable-toolbar__btn-spin" aria-hidden /> : null}
      Обновить с сервера
    </button>);
}
function normalizeHexColor(value: string): string {
    const raw = String(value).trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(raw))
        return REPORT_PREVIEW_SCOPE_DEFAULT;
    return raw.toUpperCase();
}

/** Valid #RRGGBB or null (empty / invalid). */
function parseScopeHexColor(value: string | null | undefined): string | null {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!/^#([0-9A-F]{6})$/.test(raw))
        return null;
    return raw;
}

function briefFilterScopeColorQ(r: TimeExcelPreviewRow, selected: readonly string[]): boolean {
    if (selected.length === 0)
        return true;
    const color = parseScopeHexColor(r.scopeColor);
    if (!color)
        return selected.includes(SCOPE_COLOR_NONE);
    return selected.includes(color);
}

function collectUsedScopeColors(rows: readonly TimeExcelPreviewRow[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
        const c = parseScopeHexColor(r.scopeColor);
        if (!c || seen.has(c))
            continue;
        seen.add(c);
        out.push(c);
    }
    return out.sort();
}
const IcoDownload = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
</svg>);
function IcoTableFullscreen({ exit }: { exit: boolean }) {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {exit
            ? (<>
                <path d="M4 14h6v6" />
                <path d="M20 10h-6V4" />
                <path d="M14 10l7-7" />
                <path d="M3 21l7-7" />
            </>)
            : (<>
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
            </>)}
    </svg>);
}

function PreviewExcelDownloadBtn({ onDownloadExcel, downloadExcelBusy, exportRows, }: {
    onDownloadExcel?: (visibleRows: TimeExcelPreviewRow[]) => void | Promise<void>;
    downloadExcelBusy?: boolean;
    exportRows: TimeExcelPreviewRow[];
}) {
    if (!onDownloadExcel)
        return null;
    return (<button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-rp-mtable-toolbar__btn" onClick={() => void onDownloadExcel(exportRows)} disabled={Boolean(downloadExcelBusy)} title={downloadExcelBusy ? 'Формирование Excel…' : 'Скачать отчёт в Excel (по видимым строкам на странице)'} aria-label={downloadExcelBusy ? 'Формирование Excel' : 'Скачать отчёт Excel по видимым строкам'}>
      <IcoDownload />
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
    }, [open, row]);
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
    }, [open, row]);
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
          <ReportPreviewRuDateField id={`${uid}-dup-d`} variant="dialog" min={min} max={max} value={wd} onChange={setWd} disabled={busy} aria-labelledby={`${uid}-dup-d`} />
        </div>
        <div className="tt-rp-mtable-move__field">
          <label className="tt-rp-mtable-move__lbl" htmlFor={`${uid}-dup-time`}>
            Время записи
          </label>
          <input id={`${uid}-dup-time`} className="tt-rp-mtable__input tt-rp-mtable__input--emp" type="time" lang="ru" step={60} value={hm} onChange={(e) => setHm(e.target.value)} disabled={busy}/>
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
export function TimeExcelPreviewTable({ projectTitle, viewMode = 'brief', rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, timeSave, canOverrideClosedWeek = false, briefEmployeeQuery, moveProjectOptions = [], onDeleteTimeEntry, onMoveTimeEntryToProject, onDuplicateTimeEntry, onGrantEditUnlock, canGrantEditUnlockForTarget, editUnlockPendingCompoundKey = null, onAddTimeEntry, timeEntryWorkDateBounds = null, timeEntryActionPendingRowKey = null, employeePartnerPick = null, readOnly = false, onDownloadExcel, downloadExcelBusy, footerExtras = null, flashRowKey = null, hotkeyDuplicateRowKey = null, onHotkeyDuplicateConsumed, onActiveTimeRowKey, canUndo = false, onUndo, onSaveNow, scopeDefinitionsSlot = null, scopeColorBusy, onScopeColorValueChange, onApplyScopeColorToSelection, onClearScopeColorFromSelection, }: {
    projectTitle: string;

    viewMode?: 'brief' | 'full';
    rows: TimeExcelPreviewRow[];
    onPatch: PatchFn<TimeExcelPreviewRow>;
    employeePartnerPick?: TimePreviewEmployeePickState | null;

    readOnly?: boolean;
        footerExtras?: ReactNode;
} & UserRowSelectionProps & PreviewServerReloadProps & TimeReportPersistenceProps) {
    const isFull = viewMode === 'full';
    const readOnlyUi = Boolean(readOnly);
    // In confirmed (read-only) preview still show delete when handler is provided.
    const showEntryActions = !isFull && (
        Boolean(onDeleteTimeEntry)
        || Boolean(onApplyScopeColorToSelection)
        || (!readOnlyUi && (Boolean(onMoveTimeEntryToProject) || Boolean(onDuplicateTimeEntry) || Boolean(onGrantEditUnlock)))
    );
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
    const [briefColumnsRemember, setBriefColumnsRemember] = useState(() => loadBriefColumnsRemember());

    useEffect(() => {
        const loaded = loadBriefColumnsFromStorage(showActionsColumn);
        if (loaded?.length) {
            setBriefColumnIds(normalizeBriefColumnsForUi(loaded, showActionsColumn));
        }
        else {
            setBriefColumnIds((prev) => normalizeBriefColumnsForUi(prev.length ? prev : [...TIME_BRIEF_COLUMN_ORDER_DEFAULT], showActionsColumn));
        }
    }, [showActionsColumn]);

    useEffect(() => {
        if (!briefColumnsRemember)
            return;
        saveBriefColumnsToStorage(normalizeBriefColumnsForUi(briefColumnIds, showActionsColumn));
    }, [briefColumnIds, showActionsColumn, briefColumnsRemember]);

    const onBriefColumnsRememberChange = (enabled: boolean) => {
        setBriefColumnsRemember(enabled);
        saveBriefColumnsRemember(enabled);
        if (enabled)
            saveBriefColumnsToStorage(normalizeBriefColumnsForUi(briefColumnIds, showActionsColumn));
    };

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
    const [hotkeysHelpOpen, setHotkeysHelpOpen] = useState(false);
    const [moveTargetRow, setMoveTargetRow] = useState<TimeExcelPreviewRow | null>(null);
    const [duplicateTargetRow, setDuplicateTargetRow] = useState<TimeExcelPreviewRow | null>(null);
    const [tableFullscreen, setTableFullscreen] = useState(false);
    const [bfWhen, setBfWhen] = useState('');
    const [bfTask, setBfTask] = useState('');
    const [bfNote, setBfNote] = useState('');
    const [bfBill, setBfBill] = useState('');
    const [bfScopeColors, setBfScopeColors] = useState<string[]>([]);
    const [bfPositions, setBfPositions] = useState<string[]>([]);
    const [scopeGroupingEnabled, setScopeGroupingEnabled] = useState(false);
    const [toolbarSearch, setToolbarSearch] = useState('');
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const [bfRecordedOrder, setBfRecordedOrder] = useState<'asc' | 'desc'>('asc');
    useEffect(() => {
        if (!moreMenuOpen)
            return;
        const onDoc = (e: Event) => {
            if (moreMenuRef.current?.contains(e.target as Node))
                return;
            setMoreMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setMoreMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [moreMenuOpen]);
    useEffect(() => {
        if (!hotkeyDuplicateRowKey)
            return;
        const row = rows.find((r) => r.rowKey === hotkeyDuplicateRowKey);
        onHotkeyDuplicateConsumed?.();
        if (!onDuplicateTimeEntry || !row || row.rowKind !== 'entry' || !row.timeEntryId?.trim() || row.isVoided)
            return;
        onActiveTimeRowKey?.(row.rowKey);
        setDuplicateTargetRow(row);
    }, [hotkeyDuplicateRowKey, onActiveTimeRowKey, onDuplicateTimeEntry, onHotkeyDuplicateConsumed, rows]);
    useEffect(() => {
        if (!tableFullscreen)
            return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setTableFullscreen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKey);
        };
    }, [tableFullscreen]);
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
        for (const p of employeePartnerPick.members) {
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
        return [...m.values()]
            .filter((item) => itemMatchesPositionShareFilter(item.position, bfPositions))
            .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
    }, [employeePartnerPick, rows, bfPositions]);
    const renderEmployeeBodyCell = (colId: TimeBriefColumnId | TimeFullColumnId, r: TimeExcelPreviewRow, i: number, wk: boolean): ReactNode => {
        if (readOnlyUi) {
            const label = (r.employeeName || r.userName || '').trim() || '—';
            const pos = (r.employeePosition ?? '').trim();
            const text = pos ? `${label} (${pos})` : label;
            return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly tt-rp-mtable__td--employee">
              <span className="tt-rp-mtable__readonly">{text}</span>
            </td>);
        }
        if (r.rowKind === 'aggregate') {
            if (employeePartnerPick != null && !employeePartnerPick.loading) {
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--readonly tt-rp-mtable__td--employee">
                  <span className="tt-rp-mtable__td--muted" title="Для строки-агрегата выбор сотрудника недоступен">{r.employeeName || r.userName}</span>
                </td>);
            }
            return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee">
                <input className="tt-rp-mtable__input tt-rp-mtable__input--emp" type="text" value={r.employeeName} onChange={(e) => {
                    const v = e.target.value;
                    onPatch(r.rowKey, { employeeName: v, userName: v });
                }} disabled={wk} aria-label={`Сотрудник, строка ${i + 1}`}/>
              </td>);
        }
        if (employeePartnerPick != null) {
            if (employeePartnerPick.loading) {
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee">
                  <span className="tt-rp-mtable__td--muted" role="status">Загрузка участников…</span>
                </td>);
            }
            const items = employeePartnerSelectItems ?? [];
            const selId = String(r.authUserId);
            const value = items.some((x) => x.id === selId) ? selId : '';
            return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee">
              <div className="tt-rp-mtable__emp-cell">
                {r.isSessionCopy ? <SessionCopyMark row={r} /> : null}
                <SearchableSelect<PartnerEmployeeSelectItem> portalDropdown portalZIndex={TT_RP_SELECT_PORTAL_Z} portalDropdownClassName="tsp-srch__dropdown--tall" className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label={`Сотрудник, строка ${i + 1}`} placeholder={items.length === 0 ? 'Нет участников с доступом к проекту' : 'Выберите сотрудника…'} emptyListText="Нет в списке" noMatchText="Не найдено" value={value} items={items} getOptionValue={(o) => o.id} getOptionLabel={(o) => (o.position ? `${o.label} (${o.position})` : o.label)} getSearchText={(o) => o.search} disabled={wk} onSelect={(o) => {
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
              </div>
            </td>);
        }
        return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee">
          <div className="tt-rp-mtable__emp-cell">
            {r.isSessionCopy ? <SessionCopyMark row={r} /> : null}
            <input className="tt-rp-mtable__input tt-rp-mtable__input--emp" type="text" value={r.employeeName} onChange={(e) => {
                const v = e.target.value;
                onPatch(r.rowKey, { employeeName: v, userName: v });
            }} disabled={wk} aria-label={`Сотрудник, строка ${i + 1}`}/>
          </div>
        </td>);
    };
    const briefDisplayRows = useMemo(() => {
        if (isFull)
            return rows;
        const q = toolbarSearch.trim();
        const filtered = rows.filter((r) => {
            if (!(briefFilterEmployeeQ(r, briefEmployeeQuery) && briefFilterWhenQ(r, bfWhen) && briefFilterTaskQ(r, bfTask) && briefFilterNoteQ(r, bfNote) && briefFilterDurationQ(r, bfBill, (x) => x.billableHours) && briefFilterScopeColorQ(r, bfScopeColors) && rowMatchesPositionShareFilter(r, bfPositions)))
                return false;
            if (!q)
                return true;
            return briefFilterEmployeeQ(r, q) || briefFilterTaskQ(r, q) || briefFilterNoteQ(r, q);
        });
        return scopeGroupingEnabled
            ? sortTimePreviewRowsByScopeThenChrono(filtered, bfRecordedOrder)
            : sortTimePreviewRowsChronologically(filtered, bfRecordedOrder);
    }, [isFull, rows, briefEmployeeQuery, bfWhen, bfTask, bfNote, bfBill, bfScopeColors, bfPositions, bfRecordedOrder, scopeGroupingEnabled, toolbarSearch]);
    const usedScopeColors = useMemo(() => collectUsedScopeColors(rows), [rows]);
    const usedScopeHint = usedScopeColors.length
        ? `Уже в отчёте: ${usedScopeColors.join(', ')}`
        : 'В отчёте ещё нет окрашенных строк';
    const fullNameFiltered = useMemo(() => {
        if (!isFull)
            return rows;
        const q = toolbarSearch.trim();
        const filtered = rows.filter((r) => {
            if (briefEmployeeQuery.trim() && !briefFilterEmployeeQ(r, briefEmployeeQuery))
                return false;
            if (bfScopeColors.length > 0 && !briefFilterScopeColorQ(r, bfScopeColors))
                return false;
            if (!rowMatchesPositionShareFilter(r, bfPositions))
                return false;
            if (!q)
                return true;
            return briefFilterEmployeeQ(r, q) || briefFilterTaskQ(r, q) || briefFilterNoteQ(r, q);
        });
        return scopeGroupingEnabled
            ? sortTimePreviewRowsByScopeThenChrono(filtered, bfRecordedOrder)
            : sortTimePreviewRowsChronologically(filtered, bfRecordedOrder);
    }, [isFull, rows, briefEmployeeQuery, bfScopeColors, bfPositions, bfRecordedOrder, scopeGroupingEnabled, toolbarSearch]);
    const displayRows = isFull ? fullNameFiltered : briefDisplayRows;
    const duplicateRowKeys = useMemo(() => buildTimePreviewDuplicateRowKeySet(displayRows), [displayRows]);
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
            hDisplay: sumDecimalHoursForMinuteDisplay(rowsForTotals.map((r) => r.hours)),
            bhDisplay: sumDecimalHoursForMinuteDisplay(rowsForTotals.map((r) => r.billableHours)),
            atp: Math.round(atp * 100) / 100,
            cost,
            src,
            cur: displayRows[0]?.currency ?? rows[0]?.currency ?? '—',
        };
    }, [rowsForTotals, displayRows, rows]);
    const positionShares = useMemo(
        () => buildReportPreviewPositionShare(timePreviewRowsForTotals(rows)),
        [rows],
    );
    const positionSharesRef = useRef(positionShares);
    if (!serverReloadBusy)
        positionSharesRef.current = positionShares;
    const headerPositionShares = serverReloadBusy ? positionSharesRef.current : positionShares;
    const moveDialogBusy = Boolean(moveTargetRow && timeEntryActionPendingRowKey === moveTargetRow.rowKey);
    const duplicateDialogBusy = Boolean(duplicateTargetRow && timeEntryActionPendingRowKey === duplicateTargetRow.rowKey);
    const dupBounds = timeEntryWorkDateBounds ?? {
        min: '1970-01-01',
        max: '2099-12-31',
    };
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const showRowSelect = Boolean(onSelectedRowKeysChange);
    const scopedSelectionBusy = Boolean(scopeColorBusy);
    const entriesCount = rowsForTotals.length;
    const dockHours = formatReportPreviewDurationHours(totals.hDisplay);
    const dockBillable = formatReportPreviewDurationHours(totals.bhDisplay);
    const dockSum = fmtAmtWithIso(totals.atp, totals.cur);
    const briefTableColSpan = visibleBriefIds.length + (showRowSelect ? 1 : 0);
    const fullTableColSpan = visibleFullIds.length + (showEntryActions ? 1 : 0) + (showRowSelect ? 1 : 0);
    const briefFlexColId = resolveBriefFlexColumnId(visibleBriefIds);
    const briefColGroup = (<colgroup>
      {showRowSelect ? <col style={{ width: '2.5rem' }} /> : null}
      {visibleBriefIds.map((colId) => {
          const w = briefColumnColWidth(colId, briefFlexColId);
          return w ? <col key={colId} style={{ width: w }} /> : <col key={colId} />;
      })}
    </colgroup>);
    const renderFullDataRow = (i: number, measure: VirtualTableRowMeasureProps): ReactElement => {
        const r = displayRows[i];
        const wk = isTimeRowEditingLockedForViewer(r, canOverrideClosedWeek);
        const isDuplicate = duplicateRowKeys.has(r.rowKey);
        const scopeColor = parseScopeHexColor(r.scopeColor);
        const hasScopeColor = Boolean(scopeColor);
        return (<tr key={r.rowKey} ref={measure.ref} data-index={measure['data-index']} className={`${rowTrClass(i, r.rowKey, selectedRowKeys, wk)}${hasScopeColor ? ' tt-rp-mtable__tr--scoped' : ''}${timeEntryVoidTrModifier(r)}${timeEntryDuplicateTrModifier(isDuplicate)}${timeEntrySessionCopyTrModifier(r)}${timeEntryFlashTrModifier(r.rowKey, flashRowKey)}`} style={hasScopeColor ? { ['--tt-rp-row-scope-bg' as string]: scopeColor! } : undefined} title={r.isSessionCopy ? 'Копия, созданная в этой сессии' : isDuplicate ? TIME_PREVIEW_DUPLICATE_ROW_TITLE : undefined} aria-selected={isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined}>
            <ReportRowSelectCell rowKey={r.rowKey} selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange}/>
            {visibleFullIds.map((colId) => renderFullBodyCell(colId, r, i, wk))}
            {showEntryActions ? (<td key="actions-full" className="tt-rp-mtable__td tt-rp-mtable__td--brief-actions" onClick={(e) => e.stopPropagation()}>
                {renderEntryRowActions(r, wk, i)}
            </td>) : null}
        </tr>);
    };
    const renderBriefDataRow = (i: number, measure: VirtualTableRowMeasureProps): ReactElement => {
        const r = displayRows[i];
        const wk = isTimeRowEditingLockedForViewer(r, canOverrideClosedWeek);
        const isDuplicate = duplicateRowKeys.has(r.rowKey);
        const scopeColor = parseScopeHexColor(r.scopeColor);
        const hasScopeColor = Boolean(scopeColor);
        return (<tr key={r.rowKey} ref={measure.ref} data-index={measure['data-index']} className={`${rowTrClass(i, r.rowKey, selectedRowKeys, wk)}${hasScopeColor ? ' tt-rp-mtable__tr--scoped' : ''}${timeEntryVoidTrModifier(r)}${timeEntryDuplicateTrModifier(isDuplicate)}${timeEntrySessionCopyTrModifier(r)}${timeEntryFlashTrModifier(r.rowKey, flashRowKey)}`} style={hasScopeColor ? { ['--tt-rp-row-scope-bg' as string]: scopeColor! } : undefined} title={r.isSessionCopy ? 'Копия, созданная в этой сессии' : isDuplicate ? TIME_PREVIEW_DUPLICATE_ROW_TITLE : undefined} aria-selected={isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined}>
            <ReportRowSelectCell rowKey={r.rowKey} selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange}/>
            {visibleBriefIds.map((colId) => renderBriefBodyCell(colId, r, i, wk))}
        </tr>);
    };
    const resolveScopeTargetKeys = (rowKey: string): ReadonlySet<string> => {
        if (selectedRowKeys && selectedRowKeys.has(rowKey) && selectedRowKeys.size > 1)
            return selectedRowKeys;
        return new Set([rowKey]);
    };
    const renderEntryRowActions = (r: TimeExcelPreviewRow, wk: boolean, i: number): ReactNode => {
        if (!showEntryActions || r.rowKind !== 'entry' || !r.timeEntryId?.trim())
            return null;
        const pending = timeEntryActionPendingRowKey === r.rowKey;
        const wdUnlock = (r.workDate || '').trim().slice(0, 10);
        const periodClosed = Boolean(wdUnlock && isWorkDateInClosedReportingPeriod(wdUnlock));
        const showUnlockBtn = Boolean(onGrantEditUnlock && canGrantEditUnlockForTarget?.(r.authUserId) && periodClosed);
        const unlockBusy = Boolean(editUnlockPendingCompoundKey === `${r.authUserId}:${wdUnlock}`);
        const rowScope = parseScopeHexColor(r.scopeColor);
        const canScope = Boolean(onApplyScopeColorToSelection);
        const scopeTitle = rowScope
            ? `Scope: ${rowScope}${usedScopeColors.length ? `\n${usedScopeHint}` : ''}`
            : `Scope — цвет строки (для выделенных применится ко всем)${usedScopeColors.length ? `\n${usedScopeHint}` : ''}`;
        return (<div className="tt-rp-mtable__brief-row-actions" role="group" aria-label={`Действия, строка ${i + 1}`}>
          {canScope ? (
            <ReportPreviewScopeColorPicker
              value={rowScope}
              usedColors={usedScopeColors}
              disabled={scopedSelectionBusy || pending}
              title={scopeTitle}
              aria-label={`Scope цвет, строка ${i + 1}`}
              onPick={(color) => {
                  const next = normalizeHexColor(color);
                  onScopeColorValueChange?.(next);
                  void onApplyScopeColorToSelection?.(resolveScopeTargetKeys(r.rowKey), next);
              }}
            />
          ) : null}
          {canScope && rowScope && onClearScopeColorFromSelection ? (<button type="button" className="tt-rp-mtable__row-act tt-rp-mtable__row-act--scope-clear" title="Убрать Scope-цвет" disabled={scopedSelectionBusy || pending} onClick={() => void onClearScopeColorFromSelection(resolveScopeTargetKeys(r.rowKey))} aria-label={`Убрать Scope цвет, строка ${i + 1}`}>
              <span className="tt-rp-mtable__row-act-ico" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </span>
            </button>) : null}
          {showUnlockBtn ? (<button type="button" className="tt-rp-mtable__row-act tt-rp-mtable__row-act--unlock" title="Разрешить сотруднику правки за этот день на 24 часа (продлевается при повторном нажатии)" disabled={unlockBusy || pending} onClick={() => void onGrantEditUnlock?.(r.authUserId, wdUnlock)} aria-label="Разблокировать правки за этот день на 24 часа">
              <span className="tt-rp-mtable__row-act-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="11" rx="2"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </span>
            </button>) : null}
          {onDuplicateTimeEntry ? (<button type="button" className="tt-rp-mtable__row-act" title={`Дублировать запись (выбор даты и времени) · ${formatPrimaryShortcut('D')}`} disabled={Boolean(wk) || pending} onClick={() => {
                onActiveTimeRowKey?.(r.rowKey);
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
                onActiveTimeRowKey?.(r.rowKey);
                setMoveTargetRow(r);
            }} aria-label="Перенести на другой проект">
              <span className="tt-rp-mtable__row-act-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </span>
            </button>) : null}
          {onDeleteTimeEntry ? (<button type="button" className="tt-rp-mtable__row-act tt-rp-mtable__row-act--del" title={wk ? 'Удалить запись (неделя закрыта — правки недоступны)' : 'Удалить запись'} disabled={pending} onClick={() => {
                onActiveTimeRowKey?.(r.rowKey);
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

    const renderBriefHeaderCell = (colId: TimeBriefColumnId): ReactNode => {
        switch (colId) {
            case 'employee':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--employee-head tt-rp-brief-th">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Сотрудник</span>
                    {readOnlyUi ? null : employeeColumnFilterSlot}
                  </div>
                </th>);
            case 'recordDate':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--brief-date tt-rp-brief-th">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Дата записи</span>
                    {readOnlyUi ? null : (<ReportPreviewDateTimeFilterPopover whenQuery={bfWhen} onWhenQueryChange={setBfWhen} recordedOrder={bfRecordedOrder} onRecordedOrderChange={setBfRecordedOrder}/>)}
                  </div>
                </th>);
            case 'recordTime':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--brief-time tt-rp-brief-th">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Время записи</span>
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
                    <span className="tt-rp-brief-th__label" title="Поле заметки и описания (как в данных)">Описание</span>
                    {readOnlyUi ? null : (<ReportPreviewTextFilterPopover aria-label="Фильтр: описание" title="Поиск по тексту" value={bfNote} onChange={setBfNote} placeholder="Текст…" hint="По note и description строки."/>)}
                  </div>
                </th>);
            case 'workHours':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--num" title="Фактически отработанное время (ч:мм)">
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Отработано</span>
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
                  <div className="tt-rp-brief-th__row">
                    <span className="tt-rp-brief-th__label">Сумма</span>
                  </div>
                </th>);
            case 'actions':
                return (<th key={colId} className="tt-rp-mtable__th tt-rp-mtable__th--brief-actions tt-rp-brief-th" scope="col" title="Scope-цвет, дублирование, перенос или удаление записи">
                  <div className="tt-rp-brief-th__row tt-rp-brief-th__row--actions">
                    <span className="tt-rp-brief-th__label">Действия</span>
                    <ReportPreviewScopeColorFilterPopover
                      usedColors={usedScopeColors}
                      selected={bfScopeColors}
                      onChange={setBfScopeColors}
                    />
                  </div>
                </th>);
            default:
                return null;
        }
    };

    const timeReportTaskSelect = (r: TimeExcelPreviewRow, wk: boolean) => {
        const key = timeReportTaskProjectKey(r.clientId?.trim() ?? '', r.projectId?.trim() ?? '');
        const items = taskOptionsByProject.get(key) ?? [];
        const catalogReady = Object.prototype.hasOwnProperty.call(tasksByProjectKey, key);
        return (
            <SearchableSelect<LabeledOption>
                portalDropdown
                portalZIndex={TT_RP_SELECT_PORTAL_Z}
                portalDropdownClassName="tsp-srch__dropdown--tall"
                className="tt-rp-mtable__srch"
                buttonClassName="tt-rp-mtable__srch-btn"
                aria-label={`Задача, ${r.userName}`}
                placeholder={catalogReady ? 'Задача…' : 'Загрузка задач…'}
                emptyListText={catalogReady ? 'Нет задач' : 'Загрузка задач…'}
                noMatchText="Не найдено"
                value={r.taskId}
                items={items}
                getOptionValue={(o) => o.id}
                getOptionLabel={(o) => o.label}
                getSearchText={(o) => o.label}
                disabled={wk}
                onSelect={(o) => onPatch(r.rowKey, { taskId: o.id, taskName: o.label })}
            />
        );
    };
    const renderBriefBodyCell = (colId: TimeBriefColumnId, r: TimeExcelPreviewRow, i: number, wk: boolean): ReactNode => {
        switch (colId) {
            case 'employee':
                return renderEmployeeBodyCell(colId, r, i, wk);
            case 'recordDate':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--brief-date">
                  {readOnlyUi ? (<TimePreviewBriefDateReadonly r={r}/>) : (<TimePreviewBriefDateCell r={r} onPatch={onPatch} weekLocked={wk}/>)}
                </td>);
            case 'recordTime':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--brief-time">
                  {readOnlyUi ? (<TimePreviewBriefTimeReadonly r={r}/>) : (<TimePreviewBriefTimeCell r={r} onPatch={onPatch} userName={r.userName}/>)}
                </td>);
            case 'task':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                  {readOnlyUi
                    ? (<span className="tt-rp-mtable__readonly tt-rp-mtable__task-with-badge">
                        <InternalTaskMark row={r} />
                        {((r.taskName || r.taskId || '').trim() || '—')}
                      </span>)
                    : (<div className="tt-rp-mtable__brief-task">
                      <InternalTaskMark row={r} />
                      {timeReportTaskSelect(r, wk)}
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
            case 'workHours':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi
                    ? (<span className="tt-rp-mtable__readonly">{formatReportPreviewDurationHours(r.hours)}</span>)
                    : (<DecimalDurationInput className="tt-rp-mtable__input tt-rp-mtable__input--duration" valueHours={Number.isFinite(r.hours) ? r.hours : 0} onCommit={(hours) => {
                    if (r.isBillable) {
                        const next = { ...r, hours, billableHours: hours };
                        onPatch(r.rowKey, { hours, billableHours: hours, amountToPay: recomputeTimePreviewRowAmountToPay(next) });
                    }
                    else {
                        onPatch(r.rowKey, { hours });
                    }
                }} disabled={wk} aria-label={`Отработано, ${r.userName}`}/>)}
                </td>);
            case 'billHours':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--num">
                  {readOnlyUi
                    ? (<span className="tt-rp-mtable__readonly">{formatReportPreviewDurationHours(r.billableHours)}</span>)
                    : (<DecimalDurationInput className="tt-rp-mtable__input tt-rp-mtable__input--duration" valueHours={Number.isFinite(r.billableHours) ? r.billableHours : 0} onCommit={(bh) => {
                    const atp = recomputeTimePreviewRowAmountToPay({ ...r, billableHours: bh });
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
                          : (<ReportPreviewRuDateField variant="table" value={r.workDate.slice(0, 10)} onChange={(ymd) => onPatch(r.rowKey, { workDate: ymd })} title={wk ? 'Можно сменить дату на день из открытого периода' : undefined}/>)}
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
                      ? (<span className="tt-rp-mtable__readonly tt-rp-mtable__task-with-badge">
                          <InternalTaskMark row={r} />
                          {((r.taskName || r.taskId || '').trim() || '—')}
                        </span>)
                      : (<div className="tt-rp-mtable__brief-task">
                          <InternalTaskMark row={r} />
                          {timeReportTaskSelect(r, wk)}
                        </div>)}
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
                      ? (<span className="tt-rp-mtable__readonly">{formatReportPreviewDurationHours(r.billableHours)}</span>)
                      : (<DecimalDurationInput className="tt-rp-mtable__input tt-rp-mtable__input--duration" valueHours={Number.isFinite(r.billableHours) ? r.billableHours : 0} onCommit={(bh) => {
                    const atp = recomputeTimePreviewRowAmountToPay({ ...r, billableHours: bh });
                    onPatch(r.rowKey, { billableHours: bh, amountToPay: atp });
                }} disabled={wk} aria-label={`Оплачиваемые часы, ${r.userName}`}/>)}
                </td>);
            case 'isBillable':
                return (<td key={colId} className="tt-rp-mtable__td tt-rp-mtable__td--tight">
                  {readOnlyUi ? (<span className="tt-rp-mtable__readonly">{r.isBillable ? 'Да' : 'Нет'}</span>) : (<RpBool checked={r.isBillable} ariaLabel={`isBillable, ${r.userName}`} disabled={wk} onChange={(v) => {
                    const newBh = v ? r.hours : r.billableHours;
                    const next: TimeExcelPreviewRow = { ...r, isBillable: v, billableHours: newBh };
                    onPatch(r.rowKey, { isBillable: v, billableHours: newBh, amountToPay: recomputeTimePreviewRowAmountToPay(next) });
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
                        amountToPay: recomputeTimePreviewRowAmountToPay({ ...r, billableRate: rate }),
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

    const tableBlock = (<div className={`tt-rp-mtable-wrap${tableFullscreen ? ' tt-rp-mtable-wrap--fullscreen' : ''}`}>
      <div className="tt-rp-mtable-card">
        <header className="tt-rp-mtable-head tt-rp-mtable-head--calm tt-rp-mtable-head--composed">
          <div className="tt-rp-mtable-toolbar tt-rp-mtable-toolbar--calm tt-rp-mtable-toolbar--composed" role="toolbar" aria-label="Действия отчёта">
            <div className="tt-rp-mtable-title-row">
              <h2 className="tt-rp-mtable-title">{projectTitle}</h2>
              {(() => {
                  const saveUi = readOnlyUi ? 'ro' : (timeSave?.ui ?? 'idle');
                  const title = readOnlyUi
                      ? 'Редактирование недоступно'
                      : saveUi === 'saving'
                          ? 'Сохранение на сервер…'
                          : saveUi === 'saved'
                              ? (timeSave?.message ?? 'Сохранено')
                              : saveUi === 'err'
                                  ? (timeSave?.message ?? 'Ошибка сохранения')
                                  : 'Нет несохранённых изменений';
                  return (<span className={`tt-rp-mtable-save-ind tt-rp-mtable-save-ind--${saveUi}`} title={title} role="status" aria-live="polite" aria-label={title}>
                    <span className="tt-rp-mtable-save-ind__dot" aria-hidden />
                    <span className="tt-rp-mtable-save-ind__text">
                      {saveUi === 'ro' ? 'Просмотр' : saveUi === 'saving' ? 'Сохранение…' : saveUi === 'saved' ? 'Сохранено' : saveUi === 'err' ? 'Ошибка' : ''}
                    </span>
                  </span>);
              })()}
            </div>
            <label className="tt-rp-mtable-search">
              <span className="tt-rp-mtable-search__ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
              </span>
              <input type="search" className="tt-rp-mtable-search__input" value={toolbarSearch} onChange={(e) => setToolbarSearch(e.target.value)} placeholder="Поиск по записям…" autoComplete="off" spellCheck={false} />
            </label>
            {!readOnlyUi && onAddTimeEntry ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-mtable-toolbar__btn--add" onClick={() => void onAddTimeEntry()} disabled={Boolean(serverReloadBusy || timeSave?.ui === 'saving' || timeEntryActionPendingRowKey != null)} title="Создать новую запись времени">
                + Добавить
              </button>) : null}
            {scopeDefinitionsSlot}
            {scopeDefinitionsSlot || usedScopeColors.length > 0 ? (<button
              type="button"
              className={`tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-scope-compose${scopeGroupingEnabled ? ' tt-rp-scope-compose--active' : ''}`}
              aria-pressed={scopeGroupingEnabled}
              title={scopeGroupingEnabled ? 'Вернуть обычный порядок строк по дате' : 'Сгруппировать строки по цветам Scope'}
              onClick={() => setScopeGroupingEnabled((enabled) => !enabled)}
            >
              <span className="tt-rp-scope-compose__icon" aria-hidden>
                <span style={{ backgroundColor: usedScopeColors[0] ?? REPORT_PREVIEW_SCOPE_DEFAULT }} />
                <span style={{ backgroundColor: usedScopeColors[1] ?? usedScopeColors[0] ?? REPORT_PREVIEW_SCOPE_DEFAULT }} />
                <span style={{ backgroundColor: usedScopeColors[2] ?? usedScopeColors[0] ?? REPORT_PREVIEW_SCOPE_DEFAULT }} />
              </span>
              По цветам
            </button>) : null}
            <div className="tt-rp-mtable-toolbar__trail">
              {!readOnlyUi ? (<div className="tt-rp-mtable-more" ref={moreMenuRef}>
                <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-mtable-more__btn" onClick={() => setMoreMenuOpen((v) => !v)} aria-expanded={moreMenuOpen} aria-haspopup="menu" title="Дополнительные действия">
                  Ещё
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6"/></svg>
                </button>
                {moreMenuOpen ? (<div className="tt-rp-mtable-more__menu" role="menu">
                  <button type="button" role="menuitem" className="tt-rp-mtable-more__item" onClick={() => {
                        setMoreMenuOpen(false);
                        if (isFull)
                            setFullColumnsModalOpen(true);
                        else
                            setBriefColumnsModalOpen(true);
                    }}>
                    Колонки
                  </button>
                  {onRequestServerReload ? (<button type="button" role="menuitem" className="tt-rp-mtable-more__item" disabled={Boolean(serverReloadBusy)} onClick={() => {
                        setMoreMenuOpen(false);
                        onRequestServerReload();
                    }}>
                      {serverReloadBusy ? 'Обновление…' : 'Обновить с сервера'}
                    </button>) : null}
                  {onUndo ? (<button type="button" role="menuitem" className="tt-rp-mtable-more__item" disabled={!canUndo || Boolean(serverReloadBusy || timeSave?.ui === 'saving' || timeEntryActionPendingRowKey != null)} onClick={() => {
                        setMoreMenuOpen(false);
                        void onUndo();
                    }}>
                      Отмена ({formatPrimaryShortcut('Z')})
                    </button>) : null}
                  {onSaveNow ? (<button type="button" role="menuitem" className="tt-rp-mtable-more__item" disabled={Boolean(serverReloadBusy || timeSave?.ui === 'saving')} onClick={() => {
                        setMoreMenuOpen(false);
                        void onSaveNow();
                    }}>
                      Сохранить ({formatPrimaryShortcut('S')})
                    </button>) : null}
                  {onDownloadExcel ? (<button type="button" role="menuitem" className="tt-rp-mtable-more__item" disabled={Boolean(downloadExcelBusy)} onClick={() => {
                        setMoreMenuOpen(false);
                        void onDownloadExcel(rowsForTotals);
                    }}>
                      {downloadExcelBusy ? 'Excel…' : 'Скачать Excel'}
                    </button>) : null}
                  {(onUndo || onSaveNow || onDuplicateTimeEntry) ? (<button type="button" role="menuitem" className="tt-rp-mtable-more__item" onClick={() => {
                        setMoreMenuOpen(false);
                        setHotkeysHelpOpen(true);
                    }}>
                      Горячие клавиши
                    </button>) : null}
                </div>) : null}
              </div>) : (<PreviewExcelDownloadBtn onDownloadExcel={onDownloadExcel} downloadExcelBusy={downloadExcelBusy} exportRows={rowsForTotals}/>)}
              <button type="button" className="tt-rp-mtable-fullscreen-btn" onClick={() => setTableFullscreen((v) => !v)} title={tableFullscreen ? 'Свернуть таблицу' : 'Развернуть таблицу на весь экран'} aria-label={tableFullscreen ? 'Свернуть таблицу' : 'Развернуть таблицу на весь экран'} aria-pressed={tableFullscreen}>
                <IcoTableFullscreen exit={tableFullscreen} />
              </button>
            </div>
          </div>
          {headerPositionShares.length > 0 ? (
            <div className="tt-rp-mtable-position-shares" aria-label="Доля по должностям">
              {headerPositionShares.map((share) => {
                const active = bfPositions.includes(share.position);
                return (
                <button
                  type="button"
                  key={share.position}
                  className={`tt-rp-mtable-position-shares__item${active ? ' tt-rp-mtable-position-shares__item--on' : ''}${bfPositions.length > 0 && !active ? ' tt-rp-mtable-position-shares__item--dim' : ''}`}
                  title={active
                    ? `Скрыть ${share.position}`
                    : `Показать только ${share.position}: ${formatDecimalHoursAsHm(share.billableHours)} (${share.percent}%)`}
                  aria-pressed={active}
                  onClick={() => setBfPositions((prev) => togglePositionShareFilter(prev, share.position))}
                >
                  <strong>{share.percent}%</strong>
                  {' '}
                  {share.position}
                </button>
                );
              })}
            </div>
          ) : null}
        </header>
        <ReportPreviewTimeBriefColumnsModal open={!readOnlyUi && !isFull && briefColumnsModalOpen} onClose={() => setBriefColumnsModalOpen(false)} includeActionsColumn={showActionsColumn} activeOrderedIds={visibleBriefIds} onChange={setBriefColumnIds} rememberEnabled={briefColumnsRemember} onRememberEnabledChange={onBriefColumnsRememberChange}/>
        <ReportPreviewTimeFullColumnsModal open={Boolean(!readOnlyUi && isFull && fullColumnsModalOpen)} onClose={() => setFullColumnsModalOpen(false)} activeOrderedIds={visibleFullIds} onChange={setFullColumnIds}/>
        <ReportPreviewHotkeysHelpModal open={hotkeysHelpOpen} onClose={() => setHotkeysHelpOpen(false)} showDuplicate={Boolean(onDuplicateTimeEntry)}/>
        <div ref={tableScrollRef} className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          {isFull ? (<table className="tt-rp-mtable tt-rp-mtable--time-wide">
            <thead>
              <tr>
                <ReportRowSelectHeader selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange} visibleRowKeys={displayRows.map((r) => r.rowKey)}/>
                {visibleFullIds.map((colId) => renderFullHeaderCell(colId))}
                {showEntryActions ? (<th key="actions-full" className="tt-rp-mtable__th tt-rp-mtable__th--brief-actions" scope="col">
                    Действия
                  </th>) : null}
              </tr>
            </thead>
            <tbody>
              <VirtualizedTableRows scrollRef={tableScrollRef} rowCount={displayRows.length} colSpan={fullTableColSpan} estimateRowHeight={56} renderRow={renderFullDataRow}/>
            </tbody>
          </table>) : (<table className="tt-rp-mtable tt-rp-mtable--time-brief">
            {briefColGroup}
            <thead>
              <tr>
                <ReportRowSelectHeader selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange} visibleRowKeys={displayRows.map((r) => r.rowKey)}/>
                {visibleBriefIds.map((colId) => renderBriefHeaderCell(colId))}
              </tr>
            </thead>
            <tbody>
              <VirtualizedTableRows scrollRef={tableScrollRef} rowCount={displayRows.length} colSpan={briefTableColSpan} estimateRowHeight={40} renderRow={renderBriefDataRow}/>
            </tbody>
          </table>)}
        </div>
        <footer className="tt-rp-mtable-dock" role="contentinfo" aria-label="Итоги отчёта">
          <div className="tt-rp-mtable-dock__stats">
            <span className="tt-rp-mtable-dock__stat">Итого: <strong>{entriesCount} {ruEntriesWord(entriesCount)}</strong></span>
            <span className="tt-rp-mtable-dock__stat">Отработано: <strong>{dockHours}</strong></span>
            <span className="tt-rp-mtable-dock__stat">Оплачиваемые часы: <strong>{dockBillable}</strong></span>
            <span className="tt-rp-mtable-dock__stat">Сумма: <strong>{dockSum}</strong></span>
            {headerPositionShares.length > 0 ? (
              <span className="tt-rp-mtable-dock__stat tt-rp-mtable-dock__stat--roles" aria-label="Доля по должностям">
                {headerPositionShares.map((share, i) => (
                  <span key={share.position}>
                    {i > 0 ? <span className="tt-rp-mtable-dock__role-sep" aria-hidden> · </span> : null}
                    <span title={`${share.position}: ${formatDecimalHoursAsHm(share.billableHours)} (${share.percent}%)`}>
                      <strong>{share.percent}%</strong> {share.position}
                    </span>
                  </span>
                ))}
              </span>
            ) : null}
          </div>
          {footerExtras ? (<>
            <span className="tt-rp-mtable-dock__sep" aria-hidden />
            <div className="tt-rp-mtable-dock__aside">{footerExtras}</div>
          </>) : null}
        </footer>
      </div>
    </div>);

    return (<>
      {tableBlock}
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
export function ExpenseExcelPreviewTable({ rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }: {
    rows: ExpenseExcelPreviewRow[];
    onPatch: PatchFn<ExpenseExcelPreviewRow>;
} & UserRowSelectionProps & PreviewServerReloadProps) {
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const categoryOptions = useMemo(() => mergeLabeledOptions(PREVIEW_CATEGORY_OPTIONS, rows.map((r) => ({
        id: r.categoryId,
        label: r.comment.trim() || r.categoryId,
    }))), [rows]);
    const renderRow = (i: number, measure: VirtualTableRowMeasureProps): ReactElement => {
        const r = rows[i];
        return (<tr key={r.rowKey} ref={measure.ref} data-index={measure['data-index']} className={rowTrClass(i, r.rowKey, selectedRowKeys)} aria-selected={isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined}>
                  <ReportRowSelectCell rowKey={r.rowKey} selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange}/>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">{i + 1}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--strong">{r.userName}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                    <SearchableSelect<LabeledOption> portalDropdown portalZIndex={TT_RP_SELECT_PORTAL_Z} className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label="Категория" placeholder="Категория…" emptyListText="Нет" noMatchText="Не найдено" value={r.categoryId} items={categoryOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} onSelect={(o) => onPatch(r.rowKey, { categoryId: o.id })}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--comment">
                    <textarea className="tt-rp-mtable__input tt-rp-mtable__textarea" rows={2} value={r.comment} onChange={(e) => onPatch(r.rowKey, { comment: e.target.value })}/>
                  </td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--muted" title="С сервера; если «—», поле status для строки в API не пришло.">
                    {r.statusLabel || '—'}
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
                </tr>);
    };
    const expenseColSpan = 7 + (onSelectedRowKeysChange ? 1 : 0);
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
        <div ref={tableScrollRef} className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          <table className="tt-rp-mtable tt-rp-mtable--wide">
            <thead>
              <tr>
                <ReportRowSelectHeader selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange} visibleRowKeys={rows.map((r) => r.rowKey)}/>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--rn">#</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--employee-head">
                  <div className="tt-rp-mtable__th-employee">
                    <span className="tt-rp-mtable__th-employee-label">Сотрудник</span>
                    {employeeColumnFilterSlot}
                  </div>
                </th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--pick">Категория / разрез</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--comment">Комментарий</th>
                <th className="tt-rp-mtable__th">Статус</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num">Всего</th>
                <th className="tt-rp-mtable__th tt-rp-mtable__th--num">Возмещаемые</th>
              </tr>
            </thead>
            <tbody>
              <VirtualizedTableRows scrollRef={tableScrollRef} rowCount={rows.length} colSpan={expenseColSpan} estimateRowHeight={72} renderRow={renderRow}/>
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
export function UninvoicedExcelPreviewTable({ rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }: {
    rows: UninvoicedExcelPreviewRow[];
    onPatch: PatchFn<UninvoicedExcelPreviewRow>;
} & UserRowSelectionProps & PreviewServerReloadProps) {
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const taskOptions = useMemo(() => mergeLabeledOptions(PREVIEW_TASK_OPTIONS, rows.map((r) => ({
        id: r.taskId,
        label: r.comment || r.taskId,
    }))), [rows]);
    const renderRow = (i: number, measure: VirtualTableRowMeasureProps): ReactElement => {
        const r = rows[i];
        return (<tr key={r.rowKey} ref={measure.ref} data-index={measure['data-index']} className={rowTrClass(i, r.rowKey, selectedRowKeys)} aria-selected={isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined}>
                  <ReportRowSelectCell rowKey={r.rowKey} selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange}/>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">{i + 1}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--strong">{r.userName}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                    <SearchableSelect<LabeledOption> portalDropdown portalZIndex={TT_RP_SELECT_PORTAL_Z} className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label="Проект" placeholder="Проект…" emptyListText="Нет" noMatchText="Не найдено" value={r.taskId} items={taskOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} onSelect={(o) => onPatch(r.rowKey, { taskId: o.id })}/>
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
                </tr>);
    };
    const uninvoicedColSpan = 6 + (onSelectedRowKeysChange ? 1 : 0);
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
        <div ref={tableScrollRef} className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          <table className="tt-rp-mtable tt-rp-mtable--wide">
            <thead>
              <tr>
                <ReportRowSelectHeader selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange} visibleRowKeys={rows.map((r) => r.rowKey)}/>
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
              <VirtualizedTableRows scrollRef={tableScrollRef} rowCount={rows.length} colSpan={uninvoicedColSpan} estimateRowHeight={72} renderRow={renderRow}/>
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
export function BudgetExcelPreviewTable({ rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }: {
    rows: BudgetExcelPreviewRow[];
    onPatch: PatchFn<BudgetExcelPreviewRow>;
} & UserRowSelectionProps & PreviewServerReloadProps) {
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const taskOptions = useMemo(() => mergeLabeledOptions(PREVIEW_TASK_OPTIONS, rows.map((r) => ({
        id: r.taskId,
        label: r.taskId,
    }))), [rows]);
    const renderRow = (i: number, measure: VirtualTableRowMeasureProps): ReactElement => {
        const r = rows[i];
        return (<tr key={r.rowKey} ref={measure.ref} data-index={measure['data-index']} className={rowTrClass(i, r.rowKey, selectedRowKeys)} aria-selected={isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined}>
                  <ReportRowSelectCell rowKey={r.rowKey} selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange}/>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--rn">{i + 1}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--strong">{r.userName}</td>
                  <td className="tt-rp-mtable__td tt-rp-mtable__td--pick">
                    <SearchableSelect<LabeledOption> portalDropdown portalZIndex={TT_RP_SELECT_PORTAL_Z} className="tt-rp-mtable__srch" buttonClassName="tt-rp-mtable__srch-btn" aria-label="Проект" placeholder="Проект…" emptyListText="Нет" noMatchText="Не найдено" value={r.taskId} items={taskOptions} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label} onSelect={(o) => onPatch(r.rowKey, { taskId: o.id })}/>
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
                </tr>);
    };
    const budgetColSpan = 5 + (onSelectedRowKeysChange ? 1 : 0);
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
        <div ref={tableScrollRef} className="tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x">
          <table className="tt-rp-mtable tt-rp-mtable--wide">
            <thead>
              <tr>
                <ReportRowSelectHeader selectedRowKeys={selectedRowKeys} onSelectedRowKeysChange={onSelectedRowKeysChange} visibleRowKeys={rows.map((r) => r.rowKey)}/>
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
              <VirtualizedTableRows scrollRef={tableScrollRef} rowCount={rows.length} colSpan={budgetColSpan} estimateRowHeight={56} renderRow={renderRow}/>
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
