import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { VirtualizedTableRows } from '@shared/ui/VirtualizedTableRows';
import { createPortal } from 'react-dom';
import { ReportPreviewDateTimeFilterPopover } from './ReportPreviewDateTimeFilterPopover';
import { ReportPreviewTextFilterPopover } from './ReportPreviewTextFilterPopover';
import { ReportPreviewScopeColorFilterPopover, SCOPE_COLOR_NONE } from './ReportPreviewScopeColorFilterPopover';
import { ReportPreviewScopeColorPicker } from './ReportPreviewScopeColorPicker';
import { REPORT_PREVIEW_SCOPE_DEFAULT } from '../lib/reportPreviewScopePalette';
import { isClosedReportingWeekEditingBlockedForSubject, isWorkDateInClosedReportingPeriod, listProjectTasksCached, } from '@entities/time-tracking';
import { formatDecimalHoursAsHm, formatReportBillableHoursRu, sumDecimalHoursForMinuteDisplay, } from '@shared/lib/formatTrackingHours';
import { syncTextareaHeightToContent } from '@shared/lib/syncTextareaHeight';
import { fmtAmtWithIso } from '@entities/time-tracking/lib/reportsFormatUtils';
import { DecimalDurationInput } from './DecimalDurationInput';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { isKostaLegalInternalTask } from '../lib/reportPreviewInternalTask';
/** Above `.tt-rp-mtable-wrap--fullscreen` (12000) and dock so bottom-row menus stay visible. */
const TT_RP_SELECT_PORTAL_Z = 15000;
import { PREVIEW_CATEGORY_OPTIONS, PREVIEW_TASK_OPTIONS, } from '../lib/previewFormOptions';
import { computeTimePreviewRowAmountToPay, recomputeTimePreviewRowAmountToPay, timePreviewRowsForPageExport, } from '../lib/reportPreviewPartnerExcel';
import { buildReportPreviewPositionShare, itemMatchesPositionShareFilter, rowMatchesPositionShareFilter, togglePositionShareFilter } from '../lib/reportPreviewPositionShare';
import { buildTimePreviewDuplicateRowKeySet, TIME_PREVIEW_DUPLICATE_ROW_TITLE, } from '../lib/reportPreviewDuplicateRows';
import { formatRuHmFromIso, formatRuYmd, getLocalYmdAndHmFromIso, getLocalYmdFromIso, localYmdAndHmToIso, sortTimePreviewRowsByScopeThenChrono, sortTimePreviewRowsChronologically, } from '../lib/briefRecordDateTimeEdit';
import { TIME_BRIEF_COLUMN_ORDER_DEFAULT, briefColumnColWidth, loadBriefColumnsFromStorage, loadBriefColumnsRemember, normalizeBriefColumnsForUi, resolveBriefFlexColumnId, saveBriefColumnsRemember, saveBriefColumnsToStorage, } from '../lib/timeBriefReportColumns';
import { TIME_FULL_COLUMN_ORDER_DEFAULT, loadFullColumnsFromStorage, normalizeFullColumnsForUi, saveFullColumnsToStorage, } from '../lib/timeFullReportColumns';
import { ReportPreviewRuDateField } from './ReportPreviewRuDateField';
import { ReportPreviewTimeBriefColumnsModal } from './ReportPreviewTimeBriefColumnConstructor';
import { ReportPreviewTimeFullColumnsModal } from './ReportPreviewTimeFullColumnsModal';
import { ReportPreviewHotkeysHelpModal } from './ReportPreviewHotkeysHelpModal';
import { formatPrimaryShortcut } from '../lib/reportPreviewHotkeys';
function isTimeRowEditingLockedForViewer(r, viewerCanOverrideWeeklyLock) {
    if (r.rowKind !== 'entry' || !r.timeEntryId?.trim())
        return false;
    if (r.isVoided)
        return true;
    const wd = r.workDate?.trim().slice(0, 10) ?? '';
    if (!wd)
        return false;
    return isClosedReportingWeekEditingBlockedForSubject(r.authUserId, wd, viewerCanOverrideWeeklyLock);
}
function timeEntryVoidTrModifier(r) {
    if (r.rowKind !== 'entry' || !r.isVoided)
        return '';
    return r.voidKind === 'reallocated'
        ? ' tt-rp-mtable__tr--void-realloc'
        : ' tt-rp-mtable__tr--void-reject';
}
function timeEntryDuplicateTrModifier(isDuplicate) {
    return isDuplicate ? ' tt-rp-mtable__tr--duplicate' : '';
}
function timeEntrySessionCopyTrModifier(r) {
    return r.isSessionCopy ? ' tt-rp-mtable__tr--session-copy' : '';
}
function SessionCopyMark({ row }) {
    if (!row.isSessionCopy)
        return null;
    if (row.sessionCopyEdited) {
        return (_jsx("span", { className: "tt-rp-mtable__copy-dot", title: "\u041A\u043E\u043F\u0438\u044F, \u0441\u043E\u0437\u0434\u0430\u043D\u043D\u0430\u044F \u0432 \u044D\u0442\u043E\u0439 \u0441\u0435\u0441\u0441\u0438\u0438", "aria-label": "\u041A\u043E\u043F\u0438\u044F" }));
    }
    return (_jsx("span", { className: "tt-rp-mtable__copy-badge", title: "\u041A\u043E\u043F\u0438\u044F, \u0441\u043E\u0437\u0434\u0430\u043D\u043D\u0430\u044F \u0432 \u044D\u0442\u043E\u0439 \u0441\u0435\u0441\u0441\u0438\u0438", children: "\u041A\u043E\u043F\u0438\u044F" }));
}
function InternalTaskMark({ row }) {
    if (!isKostaLegalInternalTask(row.taskName, row.taskId))
        return null;
    return (_jsx("span", { className: "tt-rp-mtable__internal-badge", title: "Kosta Legal Internal", children: "INT" }));
}
function timePreviewRowsForTotals(displayRows) {
    return timePreviewRowsForPageExport(displayRows);
}
function formatReportPreviewDurationHours(hours) {
    return formatDecimalHoursAsHm(Number.isFinite(hours) ? hours : 0);
}
function ruEntriesWord(n) {
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
function briefRowDateTimeParts(r) {
    if (r.rowKind === 'aggregate' || !r.workDate.trim())
        return null;
    const wd = r.workDate.slice(0, 10);
    const parsed = getLocalYmdAndHmFromIso(r.recordedAt);
    const timeHm = parsed?.hm ?? '12:00';
    const recLocalYmd = getLocalYmdFromIso(r.recordedAt);
    const dayMismatch = Boolean(recLocalYmd && recLocalYmd !== wd);
    return { wd, timeHm, recLocalYmd, dayMismatch, effectiveDate: recLocalYmd ?? wd };
}
function TimePreviewBriefDateCell({ r, onPatch, weekLocked, }) {
    const u = useId();
    const idWd = `${u}-wd`;
    const parts = briefRowDateTimeParts(r);
    if (!parts) {
        return (_jsx("span", { className: "tt-rp-mtable__td--muted", title: "\u0414\u043B\u044F \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u043D\u0435\u0442 \u043E\u0434\u043D\u043E\u0439 \u0434\u0430\u0442\u044B \u0437\u0430\u043F\u0438\u0441\u0438", children: "\u2014" }));
    }
    const onDateChange = (ymd) => {
        onPatch(r.rowKey, { workDate: ymd, recordedAt: localYmdAndHmToIso(ymd, parts.timeHm) });
    };
    return (_jsxs("div", { className: "tt-rp-brief-dt tt-rp-brief-dt--date-only", children: [_jsx("span", { className: "tt-rp-brief-dt__label--sr", id: idWd, children: "\u0414\u0430\u0442\u0430 \u0437\u0430\u043F\u0438\u0441\u0438" }), _jsx(ReportPreviewRuDateField, { id: idWd, variant: "brief", value: parts.wd, onChange: onDateChange, "aria-labelledby": idWd, title: weekLocked ? 'Неделя по дате закрыта — можно сменить дату на день из открытого периода' : undefined }), weekLocked ? (_jsx("p", { className: "tt-rp-brief-dt__hint tt-rp-brief-dt__hint--lock", role: "status", children: "\u041D\u0435\u0434\u0435\u043B\u044F \u043F\u043E \u0434\u0430\u0442\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u0430. \u041C\u043E\u0436\u043D\u043E \u0441\u043C\u0435\u043D\u0438\u0442\u044C \u0434\u0430\u0442\u0443, \u0432\u0440\u0435\u043C\u044F \u0438\u043B\u0438 \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C." })) : null] }));
}
function TimePreviewBriefTimeCell({ r, onPatch, userName, }) {
    const u = useId();
    const idRt = `${u}-rt`;
    const parts = briefRowDateTimeParts(r);
    if (!parts) {
        return (_jsx("span", { className: "tt-rp-mtable__td--muted", title: "\u0414\u043B\u044F \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u043D\u0435\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0437\u0430\u043F\u0438\u0441\u0438", children: "\u2014" }));
    }
    const onTimeChange = (hm) => {
        onPatch(r.rowKey, { recordedAt: localYmdAndHmToIso(parts.effectiveDate, hm) });
    };
    const recordedInSystemLabel = parts.recLocalYmd
        ? `Записано в системе: ${formatRuYmd(parts.recLocalYmd)}, ${formatRuHmFromIso(r.recordedAt)}`
        : `Записано в системе: ${r.recordedAt}`;
    return (_jsxs("div", { className: "tt-rp-brief-dt tt-rp-brief-dt--time-only", children: [_jsx("span", { className: "tt-rp-brief-dt__label--sr", id: idRt, children: "\u0412\u0440\u0435\u043C\u044F \u0437\u0430\u043F\u0438\u0441\u0438" }), _jsxs("div", { className: "tt-rp-brief-dt__time-wrap", children: [_jsx("input", { className: "tt-rp-brief-dt__input tt-rp-brief-dt__input--time", type: "time", lang: "ru", step: 60, value: parts.timeHm, onChange: (e) => onTimeChange(e.target.value), onInput: (e) => onTimeChange(e.currentTarget.value), title: r.recordedAt.trim() ? `ISO: ${r.recordedAt}` : undefined, "aria-labelledby": idRt, "aria-label": `Время записи, ${userName}` }), parts.dayMismatch ? (_jsx("button", { type: "button", className: "tt-rp-brief-dt__sysinfo", title: recordedInSystemLabel, "aria-label": recordedInSystemLabel, children: _jsx("span", { className: "tt-rp-brief-dt__sysinfo-icon", "aria-hidden": true, children: "i" }) })) : null] })] }));
}
function TimePreviewBriefDateReadonly({ r }) {
    if (r.rowKind === 'aggregate' || !r.workDate.trim()) {
        return (_jsx("span", { className: "tt-rp-mtable__td--muted", title: "\u0414\u043B\u044F \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u043D\u0435\u0442 \u043E\u0434\u043D\u043E\u0439 \u0434\u0430\u0442\u044B \u0437\u0430\u043F\u0438\u0441\u0438", children: "\u2014" }));
    }
    return (_jsx("span", { className: "tt-rp-mtable__readonly", children: formatRuYmd(r.workDate.slice(0, 10)) }));
}
function TimePreviewBriefTimeReadonly({ r }) {
    if (r.rowKind === 'aggregate' || !r.workDate.trim()) {
        return (_jsx("span", { className: "tt-rp-mtable__td--muted", title: "\u0414\u043B\u044F \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u043D\u0435\u0442 \u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0437\u0430\u043F\u0438\u0441\u0438", children: "\u2014" }));
    }
    const title = r.recordedAt.trim() ? `ISO: ${r.recordedAt}` : undefined;
    return (_jsx("span", { className: "tt-rp-mtable__readonly", title: title, children: formatRuHmFromIso(r.recordedAt) }));
}
function RpBool({ checked, ariaLabel, onChange, disabled = false, }) {
    return (_jsx("input", { type: "checkbox", className: "tt-rp-mtable__cb", checked: checked, disabled: disabled, onChange: (e) => onChange(e.target.checked), "aria-label": ariaLabel }));
}
function TimePreviewReadonlyText({ value, }) {
    if (typeof value === 'number') {
        const display = Number.isFinite(value) ? String(value) : '—';
        return (_jsx("span", { className: "tt-rp-mtable__readonly", title: display === '—' ? undefined : display, children: display }));
    }
    const raw = String(value ?? '').replace(/\r\n/g, '\n');
    const display = raw.trim().length === 0 ? '—' : raw;
    return (_jsx("span", { className: "tt-rp-mtable__readonly", title: display === '—' ? undefined : display, children: display }));
}
const TIME_PREVIEW_NOTE_AUTOSIZE_MAX_FULL_PX = 200;
function TimePreviewNoteTextarea({ value, disabled, ariaLabel, variant, onValue, }) {
    const ref = useRef(null);
    const syncHeight = () => {
        syncTextareaHeightToContent(ref.current, variant === 'brief' ? undefined : TIME_PREVIEW_NOTE_AUTOSIZE_MAX_FULL_PX);
    };
    useLayoutEffect(() => {
        syncHeight();
    }, [value, variant, disabled]);
    const cls = variant === 'brief'
        ? 'tt-rp-mtable__input tt-rp-mtable__textarea tt-rp-mtable__textarea--brief tt-rp-mtable__textarea--autosize'
        : 'tt-rp-mtable__input tt-rp-mtable__textarea tt-rp-mtable__textarea--autosize';
    return (_jsx("textarea", { ref: ref, className: cls, rows: variant === 'brief' ? 1 : 2, value: value, disabled: disabled, placeholder: "note = description", "aria-label": ariaLabel, onChange: (e) => {
            onValue(e.target.value);
            requestAnimationFrame(syncHeight);
        } }));
}
function isReportRowSelected(rowKey, selectedRowKeys) {
    return Boolean(selectedRowKeys?.has(rowKey));
}
function timeEntryFlashTrModifier(rowKey, flashRowKey) {
    return flashRowKey && flashRowKey === rowKey ? ' tt-rp-mtable__tr--flash-restored' : '';
}
function rowTrClass(_i, rowKey, selectedRowKeys, timeWeekLocked = false) {
    const parts = ['tt-rp-mtable__tr--pickable'];
    if (isReportRowSelected(rowKey, selectedRowKeys))
        parts.push('tt-rp-mtable__tr--selected');
    if (timeWeekLocked)
        parts.push('tt-rp-mtable__tr--server-week-locked');
    return parts.join(' ');
}
function ReportRowSelectHeader({ selectedRowKeys, visibleRowKeys, onSelectedRowKeysChange, }) {
    if (!onSelectedRowKeysChange || visibleRowKeys.length <= 0)
        return null;
    const selected = selectedRowKeys ?? new Set();
    const allSelected = visibleRowKeys.every((k) => selected.has(k));
    return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--select", scope: "col", children: _jsx(RpBool, { checked: allSelected, ariaLabel: allSelected ? 'Снять выделение со всех строк' : 'Выделить все видимые строки', onChange: (checked) => {
                onSelectedRowKeysChange(checked ? new Set(visibleRowKeys) : new Set());
            } }) }));
}
function ReportRowSelectCell({ rowKey, selectedRowKeys, onSelectedRowKeysChange, }) {
    if (!onSelectedRowKeysChange)
        return null;
    const selected = isReportRowSelected(rowKey, selectedRowKeys);
    return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--select", onClick: (e) => e.stopPropagation(), children: _jsx(RpBool, { checked: selected, ariaLabel: selected ? 'Снять выделение со строки' : 'Выделить строку', onChange: (checked) => {
                const next = new Set(selectedRowKeys ?? []);
                if (checked)
                    next.add(rowKey);
                else
                    next.delete(rowKey);
                onSelectedRowKeysChange(next);
            } }) }));
}
function mergeLabeledOptions(base, fromRows) {
    const m = new Map();
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
function timeReportTaskProjectKey(clientId, projectId) {
    return `${clientId.trim()}\x1f${projectId.trim()}`;
}
function buildTimeReportTaskOptionsForProject(clientId, projectId, allRows, apiByProject) {
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
function useTimeReportTaskOptionsByProject(rows) {
    const [tasksByProjectKey, setTasksByProjectKey] = useState({});
    const projectPairs = useMemo(() => {
        const uniq = new Set();
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
            const next = {};
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
function briefMatchesSubstr(hay, needle) {
    if (!needle.trim())
        return true;
    return hay.toLowerCase().includes(needle.trim().toLowerCase());
}
function briefFilterEmployeeQ(r, q) {
    if (!q.trim())
        return true;
    return briefMatchesSubstr(`${r.employeeName} ${r.userName}`.replace(/\s+/g, ' ').trim(), q);
}
function briefFilterWhenQ(r, q) {
    if (!q.trim())
        return true;
    const pack = [r.workDate, r.recordedAt];
    const loc = getLocalYmdAndHmFromIso(r.recordedAt);
    if (loc) {
        pack.push(loc.ymd, loc.hm, formatRuYmd(loc.ymd));
    }
    const w = r.workDate?.slice(0, 10);
    if (w)
        pack.push(w, formatRuYmd(w));
    return briefMatchesSubstr(pack.join(' \u200c '), q);
}
function briefFilterTaskQ(r, q) {
    if (!q.trim())
        return true;
    return briefMatchesSubstr(`${r.taskId} ${r.taskName}`.replace(/\s+/g, ' ').trim(), q);
}
function briefFilterNoteQ(r, q) {
    if (!q.trim())
        return true;
    return briefMatchesSubstr(`${r.note}\n${r.description}`.replace(/\s+/g, ' ').trim(), q);
}
function briefFilterDurationQ(r, q, pick) {
    if (!q.trim())
        return true;
    const v = pick(r);
    const h = Number.isFinite(v) ? v : 0;
    if (briefMatchesSubstr(String(h), q))
        return true;
    return briefMatchesSubstr(formatReportBillableHoursRu(h), q) || briefMatchesSubstr(formatDecimalHoursAsHm(h), q);
}
function PreviewServerReloadBtn({ onRequestServerReload, serverReloadBusy, }) {
    if (!onRequestServerReload)
        return null;
    return (_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-mtable-toolbar__btn--reload", onClick: () => onRequestServerReload(), disabled: Boolean(serverReloadBusy), "aria-busy": Boolean(serverReloadBusy), title: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u043E\u0442\u0447\u0451\u0442 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438 \u0432 \u044F\u0447\u0435\u0439\u043A\u0430\u0445 \u0441\u0431\u0440\u043E\u0441\u044F\u0442\u0441\u044F.", children: [serverReloadBusy ? _jsx("span", { className: "tt-rp-mtable-toolbar__btn-spin", "aria-hidden": true }) : null, "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430"] }));
}
function normalizeHexColor(value) {
    const raw = String(value).trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(raw))
        return REPORT_PREVIEW_SCOPE_DEFAULT;
    return raw.toUpperCase();
}
/** Valid #RRGGBB or null (empty / invalid). */
function parseScopeHexColor(value) {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!/^#([0-9A-F]{6})$/.test(raw))
        return null;
    return raw;
}
function briefFilterScopeColorQ(r, selected) {
    if (selected.length === 0)
        return true;
    const color = parseScopeHexColor(r.scopeColor);
    if (!color)
        return selected.includes(SCOPE_COLOR_NONE);
    return selected.includes(color);
}
function collectUsedScopeColors(rows) {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
        const c = parseScopeHexColor(r.scopeColor);
        if (!c || seen.has(c))
            continue;
        seen.add(c);
        out.push(c);
    }
    return out.sort();
}
const IcoDownload = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
function IcoTableFullscreen({ exit }) {
    return (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: exit
            ? (_jsxs(_Fragment, { children: [_jsx("path", { d: "M4 14h6v6" }), _jsx("path", { d: "M20 10h-6V4" }), _jsx("path", { d: "M14 10l7-7" }), _jsx("path", { d: "M3 21l7-7" })] }))
            : (_jsxs(_Fragment, { children: [_jsx("path", { d: "M15 3h6v6" }), _jsx("path", { d: "M9 21H3v-6" }), _jsx("path", { d: "M21 3l-7 7" }), _jsx("path", { d: "M3 21l7-7" })] })) }));
}
function PreviewExcelDownloadBtn({ onDownloadExcel, downloadExcelBusy, exportRows, }) {
    if (!onDownloadExcel)
        return null;
    return (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-rp-mtable-toolbar__btn", onClick: () => void onDownloadExcel(exportRows), disabled: Boolean(downloadExcelBusy), title: downloadExcelBusy ? 'Формирование Excel…' : 'Скачать отчёт в Excel (по видимым строкам на странице)', "aria-label": downloadExcelBusy ? 'Формирование Excel' : 'Скачать отчёт Excel по видимым строкам', children: _jsx(IcoDownload, {}) }));
}
function TimeBriefMoveEntryDialog({ open, row, projectOptions, onClose, onConfirm, busy, }) {
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
        const h = (e) => {
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
    return createPortal(_jsx("div", { className: "tt-rp-mtable-move-ov", role: "presentation", children: _jsxs("div", { className: "tt-rp-mtable-move", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-t`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tt-rp-mtable-move__head", children: [_jsx("h2", { id: `${uid}-t`, className: "tt-rp-mtable-move__title", children: "\u041F\u0435\u0440\u0435\u043D\u043E\u0441 \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442" }), _jsx("button", { type: "button", className: "tt-rp-mtable-move__x", onClick: onClose, disabled: busy, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("p", { className: "tt-rp-mtable-move__lead", children: ["\u0417\u0430\u043F\u0438\u0441\u044C ", _jsx("strong", { children: row.employeeName || row.userName }), " \u2014 ", row.workDate?.slice(0, 10) ?? '—', ". \u0412\u0441\u044F \u0437\u0430\u043F\u0438\u0441\u044C (\u0432\u0440\u0435\u043C\u044F, \u0437\u0430\u0434\u0430\u0447\u0430, \u0442\u0435\u043A\u0441\u0442) \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F, \u0441\u043C\u0435\u043D\u0438\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0435\u043A\u0442 \u0438 \u043A\u043B\u0438\u0435\u043D\u0442 \u0432 \u0443\u0447\u0451\u0442\u0435."] }), _jsxs("div", { className: "tt-rp-mtable-move__field", children: [_jsx("label", { className: "tt-rp-mtable-move__lbl", htmlFor: `${uid}-prj`, children: "\u0426\u0435\u043B\u0435\u0432\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442" }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 14000, portalMinWidth: 320, buttonId: `${uid}-prj`, value: pick, items: items, getOptionValue: (p) => p.id, getOptionLabel: (p) => (p.client ? `${p.name} — ${p.client}` : p.name), getSearchText: (p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim(), placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u2026", emptyListText: "\u041D\u0435\u0442 \u0434\u0440\u0443\u0433\u0438\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", disabled: busy, onSelect: (p) => {
                                setPick(p.id);
                            } })] }), _jsxs("div", { className: "tt-rp-mtable-move__foot", children: [_jsx("button", { type: "button", className: "tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ghost", onClick: onClose, disabled: busy, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ok", disabled: !pick || busy, onClick: () => void onConfirm(pick), children: busy ? 'Сохранение…' : 'Перенести' })] })] }) }), document.body);
}
function TimeDuplicateEntryDialog({ open, row, workDateMin, workDateMax, canOverrideClosedWeek, onClose, onConfirm, busy, }) {
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
        const h = (e) => {
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
    return createPortal(_jsx("div", { className: "tt-rp-mtable-move-ov", role: "presentation", children: _jsxs("div", { className: "tt-rp-mtable-move", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-dup-t`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tt-rp-mtable-move__head", children: [_jsx("h2", { id: `${uid}-dup-t`, className: "tt-rp-mtable-move__title", children: "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C" }), _jsx("button", { type: "button", className: "tt-rp-mtable-move__x", onClick: onClose, disabled: busy, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("p", { className: "tt-rp-mtable-move__lead", children: ["\u041A\u043E\u043F\u0438\u044F \u0434\u043B\u044F ", _jsx("strong", { children: row.employeeName || row.userName }), ": \u0443\u043A\u0430\u0436\u0438\u0442\u0435 ", _jsx("strong", { children: "\u0434\u0430\u0442\u0443 \u0440\u0430\u0431\u043E\u0442\u044B" }), " \u0438 ", _jsx("strong", { children: "\u0432\u0440\u0435\u043C\u044F \u0437\u0430\u043F\u0438\u0441\u0438" }), " \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0438. \u0427\u0430\u0441\u044B, \u0437\u0430\u0434\u0430\u0447\u0430 \u0438 \u0442\u0435\u043A\u0441\u0442 \u0441\u043E\u0432\u043F\u0430\u0434\u0443\u0442 \u0441 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E."] }), _jsxs("div", { className: "tt-rp-mtable-move__field", children: [_jsx("label", { className: "tt-rp-mtable-move__lbl", htmlFor: `${uid}-dup-d`, children: "\u0414\u0430\u0442\u0430 \u0440\u0430\u0431\u043E\u0442\u044B" }), _jsx(ReportPreviewRuDateField, { id: `${uid}-dup-d`, variant: "dialog", min: min, max: max, value: wd, onChange: setWd, disabled: busy, "aria-labelledby": `${uid}-dup-d` })] }), _jsxs("div", { className: "tt-rp-mtable-move__field", children: [_jsx("label", { className: "tt-rp-mtable-move__lbl", htmlFor: `${uid}-dup-time`, children: "\u0412\u0440\u0435\u043C\u044F \u0437\u0430\u043F\u0438\u0441\u0438" }), _jsx("input", { id: `${uid}-dup-time`, className: "tt-rp-mtable__input tt-rp-mtable__input--emp", type: "time", lang: "ru", step: 60, value: hm, onChange: (e) => setHm(e.target.value), disabled: busy })] }), weekLockedForPick ? (_jsx("p", { className: "tt-rp-mtable-move__lead", role: "status", children: "\u042D\u0442\u0430 \u0434\u0430\u0442\u0430 \u0432 \u0437\u0430\u043A\u0440\u044B\u0442\u043E\u043C \u043E\u0442\u0447\u0451\u0442\u043D\u043E\u043C \u043F\u0435\u0440\u0438\u043E\u0434\u0435 \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0430\u0442\u0443 \u0432 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u043C \u043F\u0435\u0440\u0438\u043E\u0434\u0435 \u0438\u043B\u0438 \u043E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u043A \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443." })) : null, _jsxs("div", { className: "tt-rp-mtable-move__foot", children: [_jsx("button", { type: "button", className: "tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ghost", onClick: onClose, disabled: busy, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "tt-rp-mtable-move__btn tt-rp-mtable-move__btn--ok", disabled: !wd || weekLockedForPick || busy, onClick: () => void onConfirm(wd, iso), children: busy ? 'Создание…' : 'Создать копию' })] })] }) }), document.body);
}
export function TimeExcelPreviewTable({ projectTitle, viewMode = 'brief', rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, timeSave, canOverrideClosedWeek = false, briefEmployeeQuery, moveProjectOptions = [], onDeleteTimeEntry, onMoveTimeEntryToProject, onDuplicateTimeEntry, onGrantEditUnlock, canGrantEditUnlockForTarget, editUnlockPendingCompoundKey = null, onAddTimeEntry, timeEntryWorkDateBounds = null, timeEntryActionPendingRowKey = null, employeePartnerPick = null, readOnly = false, onUnlockEdit, confirmedEditUnlocked = false, onDownloadExcel, downloadExcelBusy, footerExtras = null, flashRowKey = null, hotkeyDuplicateRowKey = null, onHotkeyDuplicateConsumed, onActiveTimeRowKey, canUndo = false, onUndo, onSaveNow, scopeDefinitionsSlot = null, scopeColorBusy, onScopeColorValueChange, onApplyScopeColorToSelection, onClearScopeColorFromSelection, }) {
    const isFull = viewMode === 'full';
    const readOnlyUi = Boolean(readOnly);
    // In confirmed (read-only) preview still show delete when handler is provided.
    const showEntryActions = !isFull && (Boolean(onDeleteTimeEntry)
        || Boolean(onApplyScopeColorToSelection)
        || (!readOnlyUi && (Boolean(onMoveTimeEntryToProject) || Boolean(onDuplicateTimeEntry) || Boolean(onGrantEditUnlock))));
    const showActionsColumn = Boolean(showEntryActions);
    const [briefColumnIds, setBriefColumnIds] = useState(() => {
        const loaded = loadBriefColumnsFromStorage(showActionsColumn);
        if (loaded?.length)
            return normalizeBriefColumnsForUi(loaded, showActionsColumn);
        return normalizeBriefColumnsForUi([...TIME_BRIEF_COLUMN_ORDER_DEFAULT], showActionsColumn);
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
    const onBriefColumnsRememberChange = (enabled) => {
        setBriefColumnsRemember(enabled);
        saveBriefColumnsRemember(enabled);
        if (enabled)
            saveBriefColumnsToStorage(normalizeBriefColumnsForUi(briefColumnIds, showActionsColumn));
    };
    const visibleBriefIds = useMemo(() => normalizeBriefColumnsForUi(briefColumnIds, showActionsColumn), [briefColumnIds, showActionsColumn]);
    const [fullColumnIds, setFullColumnIds] = useState(() => {
        const loaded = loadFullColumnsFromStorage();
        return normalizeFullColumnsForUi(loaded?.length ? loaded : [...TIME_FULL_COLUMN_ORDER_DEFAULT]);
    });
    useEffect(() => {
        saveFullColumnsToStorage(normalizeFullColumnsForUi(fullColumnIds));
    }, [fullColumnIds]);
    const visibleFullIds = useMemo(() => normalizeFullColumnsForUi(fullColumnIds), [fullColumnIds]);
    const [briefColumnsModalOpen, setBriefColumnsModalOpen] = useState(false);
    const [fullColumnsModalOpen, setFullColumnsModalOpen] = useState(false);
    const [hotkeysHelpOpen, setHotkeysHelpOpen] = useState(false);
    const [moveTargetRow, setMoveTargetRow] = useState(null);
    const [duplicateTargetRow, setDuplicateTargetRow] = useState(null);
    const [tableFullscreen, setTableFullscreen] = useState(false);
    const [bfWhen, setBfWhen] = useState('');
    const [bfTask, setBfTask] = useState('');
    const [bfNote, setBfNote] = useState('');
    const [bfBill, setBfBill] = useState('');
    const [bfScopeColors, setBfScopeColors] = useState([]);
    const [bfPositions, setBfPositions] = useState([]);
    const [scopeGroupingEnabled, setScopeGroupingEnabled] = useState(false);
    const [toolbarSearch, setToolbarSearch] = useState('');
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef(null);
    const [bfRecordedOrder, setBfRecordedOrder] = useState('asc');
    useEffect(() => {
        if (!moreMenuOpen)
            return;
        const onDoc = (e) => {
            if (moreMenuRef.current?.contains(e.target))
                return;
            setMoreMenuOpen(false);
        };
        const onKey = (e) => {
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
        const onKey = (e) => {
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
        const m = new Map();
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
    const employeePartnerSelectItems = useMemo(() => {
        if (employeePartnerPick == null || employeePartnerPick.loading)
            return null;
        const m = new Map();
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
    const renderEmployeeBodyCell = (colId, r, i, wk) => {
        if (readOnlyUi) {
            const label = (r.employeeName || r.userName || '').trim() || '—';
            const pos = (r.employeePosition ?? '').trim();
            const text = pos ? `${label} (${pos})` : label;
            return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly tt-rp-mtable__td--employee", children: _jsx("span", { className: "tt-rp-mtable__readonly", children: text }) }, colId));
        }
        if (r.rowKind === 'aggregate') {
            if (employeePartnerPick != null && !employeePartnerPick.loading) {
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly tt-rp-mtable__td--employee", children: _jsx("span", { className: "tt-rp-mtable__td--muted", title: "\u0414\u043B\u044F \u0441\u0442\u0440\u043E\u043A\u0438-\u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u0432\u044B\u0431\u043E\u0440 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D", children: r.employeeName || r.userName }) }, colId));
            }
            return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee", children: _jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--emp", type: "text", value: r.employeeName, onChange: (e) => {
                        const v = e.target.value;
                        onPatch(r.rowKey, { employeeName: v, userName: v });
                    }, disabled: wk, "aria-label": `Сотрудник, строка ${i + 1}` }) }, colId));
        }
        if (employeePartnerPick != null) {
            if (employeePartnerPick.loading) {
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee", children: _jsx("span", { className: "tt-rp-mtable__td--muted", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432\u2026" }) }, colId));
            }
            const items = employeePartnerSelectItems ?? [];
            const selId = String(r.authUserId);
            const value = items.some((x) => x.id === selId) ? selId : '';
            return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee", children: _jsxs("div", { className: "tt-rp-mtable__emp-cell", children: [r.isSessionCopy ? _jsx(SessionCopyMark, { row: r }) : null, _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: TT_RP_SELECT_PORTAL_Z, portalDropdownClassName: "tsp-srch__dropdown--tall", className: "tt-rp-mtable__srch", buttonClassName: "tt-rp-mtable__srch-btn", "aria-label": `Сотрудник, строка ${i + 1}`, placeholder: items.length === 0 ? 'Нет участников с доступом к проекту' : 'Выберите сотрудника…', emptyListText: "\u041D\u0435\u0442 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: value, items: items, getOptionValue: (o) => o.id, getOptionLabel: (o) => (o.position ? `${o.label} (${o.position})` : o.label), getSearchText: (o) => o.search, disabled: wk, onSelect: (o) => {
                                const id = Number(o.id);
                                if (!Number.isFinite(id))
                                    return;
                                onPatch(r.rowKey, {
                                    authUserId: id,
                                    employeeName: o.label,
                                    userName: o.label,
                                    employeePosition: o.position,
                                });
                            } })] }) }, colId));
        }
        return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick tt-rp-mtable__td--employee", children: _jsxs("div", { className: "tt-rp-mtable__emp-cell", children: [r.isSessionCopy ? _jsx(SessionCopyMark, { row: r }) : null, _jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--emp", type: "text", value: r.employeeName, onChange: (e) => {
                            const v = e.target.value;
                            onPatch(r.rowKey, { employeeName: v, userName: v });
                        }, disabled: wk, "aria-label": `Сотрудник, строка ${i + 1}` })] }) }, colId));
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
    const positionShares = useMemo(() => buildReportPreviewPositionShare(timePreviewRowsForTotals(rows)), [rows]);
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
    const tableScrollRef = useRef(null);
    const showRowSelect = Boolean(onSelectedRowKeysChange);
    const scopedSelectionBusy = Boolean(scopeColorBusy);
    const entriesCount = rowsForTotals.length;
    const dockHours = formatReportPreviewDurationHours(totals.hDisplay);
    const dockBillable = formatReportPreviewDurationHours(totals.bhDisplay);
    const dockSum = fmtAmtWithIso(totals.atp, totals.cur);
    const briefTableColSpan = visibleBriefIds.length + (showRowSelect ? 1 : 0);
    const fullTableColSpan = visibleFullIds.length + (showEntryActions ? 1 : 0) + (showRowSelect ? 1 : 0);
    const briefFlexColId = resolveBriefFlexColumnId(visibleBriefIds);
    const briefColGroup = (_jsxs("colgroup", { children: [showRowSelect ? _jsx("col", { style: { width: '2.5rem' } }) : null, visibleBriefIds.map((colId) => {
                const w = briefColumnColWidth(colId, briefFlexColId);
                return w ? _jsx("col", { style: { width: w } }, colId) : _jsx("col", {}, colId);
            })] }));
    const renderFullDataRow = (i, measure) => {
        const r = displayRows[i];
        const wk = isTimeRowEditingLockedForViewer(r, canOverrideClosedWeek);
        const isDuplicate = duplicateRowKeys.has(r.rowKey);
        const scopeColor = parseScopeHexColor(r.scopeColor);
        const hasScopeColor = Boolean(scopeColor);
        return (_jsxs("tr", { ref: measure.ref, "data-index": measure['data-index'], className: `${rowTrClass(i, r.rowKey, selectedRowKeys, wk)}${hasScopeColor ? ' tt-rp-mtable__tr--scoped' : ''}${timeEntryVoidTrModifier(r)}${timeEntryDuplicateTrModifier(isDuplicate)}${timeEntrySessionCopyTrModifier(r)}${timeEntryFlashTrModifier(r.rowKey, flashRowKey)}`, style: hasScopeColor ? { ['--tt-rp-row-scope-bg']: scopeColor } : undefined, title: r.isSessionCopy ? 'Копия, созданная в этой сессии' : isDuplicate ? TIME_PREVIEW_DUPLICATE_ROW_TITLE : undefined, "aria-selected": isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined, children: [_jsx(ReportRowSelectCell, { rowKey: r.rowKey, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange }), visibleFullIds.map((colId) => renderFullBodyCell(colId, r, i, wk)), showEntryActions ? (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--brief-actions", onClick: (e) => e.stopPropagation(), children: renderEntryRowActions(r, wk, i) }, "actions-full")) : null] }, r.rowKey));
    };
    const renderBriefDataRow = (i, measure) => {
        const r = displayRows[i];
        const wk = isTimeRowEditingLockedForViewer(r, canOverrideClosedWeek);
        const isDuplicate = duplicateRowKeys.has(r.rowKey);
        const scopeColor = parseScopeHexColor(r.scopeColor);
        const hasScopeColor = Boolean(scopeColor);
        return (_jsxs("tr", { ref: measure.ref, "data-index": measure['data-index'], className: `${rowTrClass(i, r.rowKey, selectedRowKeys, wk)}${hasScopeColor ? ' tt-rp-mtable__tr--scoped' : ''}${timeEntryVoidTrModifier(r)}${timeEntryDuplicateTrModifier(isDuplicate)}${timeEntrySessionCopyTrModifier(r)}${timeEntryFlashTrModifier(r.rowKey, flashRowKey)}`, style: hasScopeColor ? { ['--tt-rp-row-scope-bg']: scopeColor } : undefined, title: r.isSessionCopy ? 'Копия, созданная в этой сессии' : isDuplicate ? TIME_PREVIEW_DUPLICATE_ROW_TITLE : undefined, "aria-selected": isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined, children: [_jsx(ReportRowSelectCell, { rowKey: r.rowKey, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange }), visibleBriefIds.map((colId) => renderBriefBodyCell(colId, r, i, wk))] }, r.rowKey));
    };
    const resolveScopeTargetKeys = (rowKey) => {
        if (selectedRowKeys && selectedRowKeys.has(rowKey) && selectedRowKeys.size > 1)
            return selectedRowKeys;
        return new Set([rowKey]);
    };
    const renderEntryRowActions = (r, wk, i) => {
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
        return (_jsxs("div", { className: "tt-rp-mtable__brief-row-actions", role: "group", "aria-label": `Действия, строка ${i + 1}`, children: [canScope ? (_jsx(ReportPreviewScopeColorPicker, { value: rowScope, usedColors: usedScopeColors, disabled: scopedSelectionBusy || pending, title: scopeTitle, "aria-label": `Scope цвет, строка ${i + 1}`, onPick: (color) => {
                        const next = normalizeHexColor(color);
                        onScopeColorValueChange?.(next);
                        void onApplyScopeColorToSelection?.(resolveScopeTargetKeys(r.rowKey), next);
                    } })) : null, canScope && rowScope && onClearScopeColorFromSelection ? (_jsx("button", { type: "button", className: "tt-rp-mtable__row-act tt-rp-mtable__row-act--scope-clear", title: "\u0423\u0431\u0440\u0430\u0442\u044C Scope-\u0446\u0432\u0435\u0442", disabled: scopedSelectionBusy || pending, onClick: () => void onClearScopeColorFromSelection(resolveScopeTargetKeys(r.rowKey)), "aria-label": `Убрать Scope цвет, строка ${i + 1}`, children: _jsx("span", { className: "tt-rp-mtable__row-act-ico", "aria-hidden": true, children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) }) })) : null, showUnlockBtn ? (_jsx("button", { type: "button", className: "tt-rp-mtable__row-act tt-rp-mtable__row-act--unlock", title: "\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443 \u043F\u0440\u0430\u0432\u043A\u0438 \u0437\u0430 \u044D\u0442\u043E\u0442 \u0434\u0435\u043D\u044C \u043D\u0430 24 \u0447\u0430\u0441\u0430 (\u043F\u0440\u043E\u0434\u043B\u0435\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u0440\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u043C \u043D\u0430\u0436\u0430\u0442\u0438\u0438)", disabled: unlockBusy || pending, onClick: () => void onGrantEditUnlock?.(r.authUserId, wdUnlock), "aria-label": "\u0420\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u0430\u0432\u043A\u0438 \u0437\u0430 \u044D\u0442\u043E\u0442 \u0434\u0435\u043D\u044C \u043D\u0430 24 \u0447\u0430\u0441\u0430", children: _jsx("span", { className: "tt-rp-mtable__row-act-ico", "aria-hidden": true, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "5", y: "11", width: "14", height: "11", rx: "2" }), _jsx("path", { d: "M8 11V7a4 4 0 0 1 8 0v4" })] }) }) })) : null, onDuplicateTimeEntry ? (_jsx("button", { type: "button", className: "tt-rp-mtable__row-act", title: `Дублировать запись (выбор даты и времени) · ${formatPrimaryShortcut('D')}`, disabled: Boolean(wk) || pending, onClick: () => {
                        onActiveTimeRowKey?.(r.rowKey);
                        setDuplicateTargetRow(r);
                    }, "aria-label": "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C", children: _jsx("span", { className: "tt-rp-mtable__row-act-ico", "aria-hidden": true, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }), _jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })] }) }) })) : null, onMoveTimeEntryToProject ? (_jsx("button", { type: "button", className: "tt-rp-mtable__row-act", title: "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0437\u0430\u043F\u0438\u0441\u044C \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442", disabled: Boolean(wk) || pending, onClick: () => {
                        onActiveTimeRowKey?.(r.rowKey);
                        setMoveTargetRow(r);
                    }, "aria-label": "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442", children: _jsx("span", { className: "tt-rp-mtable__row-act-ico", "aria-hidden": true, children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M5 12h14M12 5l7 7-7 7" }) }) }) })) : null, onDeleteTimeEntry ? (_jsx("button", { type: "button", className: "tt-rp-mtable__row-act tt-rp-mtable__row-act--del", title: wk ? 'Удалить запись (неделя закрыта — правки недоступны)' : 'Удалить запись', disabled: pending, onClick: () => {
                        onActiveTimeRowKey?.(r.rowKey);
                        void onDeleteTimeEntry(r.rowKey);
                    }, "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C", children: _jsx("span", { className: "tt-rp-mtable__row-act-ico", "aria-hidden": true, children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }) }) }) })) : null] }));
    };
    const renderBriefHeaderCell = (colId) => {
        switch (colId) {
            case 'employee':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--employee-head tt-rp-brief-th", children: _jsxs("div", { className: "tt-rp-brief-th__row", children: [_jsx("span", { className: "tt-rp-brief-th__label", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), readOnlyUi ? null : employeeColumnFilterSlot] }) }, colId));
            case 'recordDate':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--brief-date tt-rp-brief-th", children: _jsxs("div", { className: "tt-rp-brief-th__row", children: [_jsx("span", { className: "tt-rp-brief-th__label", children: "\u0414\u0430\u0442\u0430 \u0437\u0430\u043F\u0438\u0441\u0438" }), readOnlyUi ? null : (_jsx(ReportPreviewDateTimeFilterPopover, { whenQuery: bfWhen, onWhenQueryChange: setBfWhen, recordedOrder: bfRecordedOrder, onRecordedOrderChange: setBfRecordedOrder }))] }) }, colId));
            case 'recordTime':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--brief-time tt-rp-brief-th", children: _jsx("div", { className: "tt-rp-brief-th__row", children: _jsx("span", { className: "tt-rp-brief-th__label", children: "\u0412\u0440\u0435\u043C\u044F \u0437\u0430\u043F\u0438\u0441\u0438" }) }) }, colId));
            case 'task':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--pick tt-rp-brief-th", children: _jsxs("div", { className: "tt-rp-brief-th__row", children: [_jsx("span", { className: "tt-rp-brief-th__label", children: "\u0417\u0430\u0434\u0430\u0447\u0430" }), readOnlyUi ? null : (_jsx(ReportPreviewTextFilterPopover, { "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440: \u0437\u0430\u0434\u0430\u0447\u0430", title: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0437\u0430\u0434\u0430\u0447\u0435", value: bfTask, onChange: setBfTask, placeholder: "id, \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435\u2026", hint: "\u0421\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u043F\u043E id \u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0437\u0430\u0434\u0430\u0447\u0438." }))] }) }, colId));
            case 'note':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--comment tt-rp-brief-th", children: _jsxs("div", { className: "tt-rp-brief-th__row", children: [_jsx("span", { className: "tt-rp-brief-th__label", title: "\u041F\u043E\u043B\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F (\u043A\u0430\u043A \u0432 \u0434\u0430\u043D\u043D\u044B\u0445)", children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }), readOnlyUi ? null : (_jsx(ReportPreviewTextFilterPopover, { "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440: \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", title: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0442\u0435\u043A\u0441\u0442\u0443", value: bfNote, onChange: setBfNote, placeholder: "\u0422\u0435\u043A\u0441\u0442\u2026", hint: "\u041F\u043E note \u0438 description \u0441\u0442\u0440\u043E\u043A\u0438." }))] }) }, colId));
            case 'workHours':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--num", title: "\u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043E\u0442\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F (\u0447:\u043C\u043C)", children: _jsx("div", { className: "tt-rp-brief-th__row", children: _jsx("span", { className: "tt-rp-brief-th__label", children: "\u041E\u0442\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E" }) }) }, colId));
            case 'billHours':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--num", title: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0447\u0430\u0441\u044B (\u0447:\u043C\u043C)", children: _jsxs("div", { className: "tt-rp-brief-th__row", children: [_jsx("span", { className: "tt-rp-brief-th__label", children: "\u041E\u043F\u043B\u0430\u0447. \u0447\u0430\u0441\u044B" }), readOnlyUi ? null : (_jsx(ReportPreviewTextFilterPopover, { "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440: \u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0447\u0430\u0441\u044B", title: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043E\u043F\u043B\u0430\u0447. \u0447\u0430\u0441\u0430\u043C", value: bfBill, onChange: setBfBill, placeholder: "7:30, 1,5\u2026", hint: "\u041F\u043E \u0434\u0435\u0441\u044F\u0442\u0438\u0447\u043D\u044B\u043C \u0447\u0430\u0441\u0430\u043C \u0438 \u0444\u043E\u0440\u043C\u0430\u0442\u0443 \u0447:\u043C\u043C." }))] }) }, colId));
            case 'sum':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num tt-rp-brief-th tt-rp-brief-th--sum", title: "\u041E\u043F\u043B\u0430\u0447. \u0447\u0430\u0441\u044B \u00D7 \u0441\u0442\u0430\u0432\u043A\u0430, \u0431\u0435\u0437 \u0440\u0443\u0447\u043D\u043E\u0433\u043E \u0432\u0432\u043E\u0434\u0430", children: _jsx("div", { className: "tt-rp-brief-th__row", children: _jsx("span", { className: "tt-rp-brief-th__label", children: "\u0421\u0443\u043C\u043C\u0430" }) }) }, colId));
            case 'actions':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--brief-actions tt-rp-brief-th", scope: "col", title: "Scope-\u0446\u0432\u0435\u0442, \u0434\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435, \u043F\u0435\u0440\u0435\u043D\u043E\u0441 \u0438\u043B\u0438 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438", children: _jsxs("div", { className: "tt-rp-brief-th__row tt-rp-brief-th__row--actions", children: [_jsx("span", { className: "tt-rp-brief-th__label", children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" }), _jsx(ReportPreviewScopeColorFilterPopover, { usedColors: usedScopeColors, selected: bfScopeColors, onChange: setBfScopeColors })] }) }, colId));
            default:
                return null;
        }
    };
    const timeReportTaskSelect = (r, wk) => {
        const key = timeReportTaskProjectKey(r.clientId?.trim() ?? '', r.projectId?.trim() ?? '');
        const items = taskOptionsByProject.get(key) ?? [];
        const catalogReady = Object.prototype.hasOwnProperty.call(tasksByProjectKey, key);
        return (_jsx(SearchableSelect, { portalDropdown: true, portalZIndex: TT_RP_SELECT_PORTAL_Z, portalDropdownClassName: "tsp-srch__dropdown--tall", className: "tt-rp-mtable__srch", buttonClassName: "tt-rp-mtable__srch-btn", "aria-label": `Задача, ${r.userName}`, placeholder: catalogReady ? 'Задача…' : 'Загрузка задач…', emptyListText: catalogReady ? 'Нет задач' : 'Загрузка задач…', noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: r.taskId, items: items, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, disabled: wk, onSelect: (o) => onPatch(r.rowKey, { taskId: o.id, taskName: o.label }) }));
    };
    const renderBriefBodyCell = (colId, r, i, wk) => {
        switch (colId) {
            case 'employee':
                return renderEmployeeBodyCell(colId, r, i, wk);
            case 'recordDate':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--brief-date", children: readOnlyUi ? (_jsx(TimePreviewBriefDateReadonly, { r: r })) : (_jsx(TimePreviewBriefDateCell, { r: r, onPatch: onPatch, weekLocked: wk })) }, colId));
            case 'recordTime':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--brief-time", children: readOnlyUi ? (_jsx(TimePreviewBriefTimeReadonly, { r: r })) : (_jsx(TimePreviewBriefTimeCell, { r: r, onPatch: onPatch, userName: r.userName })) }, colId));
            case 'task':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick", children: readOnlyUi
                        ? (_jsxs("span", { className: "tt-rp-mtable__readonly tt-rp-mtable__task-with-badge", children: [_jsx(InternalTaskMark, { row: r }), ((r.taskName || r.taskId || '').trim() || '—')] }))
                        : (_jsxs("div", { className: "tt-rp-mtable__brief-task", children: [_jsx(InternalTaskMark, { row: r }), timeReportTaskSelect(r, wk)] })) }, colId));
            case 'note':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--comment", children: readOnlyUi
                        ? (_jsx("span", { className: "tt-rp-mtable__readonly tt-rp-mtable__readonly--pre", children: String(r.note ?? '').trim() ? r.note : '—' }))
                        : (_jsx(TimePreviewNoteTextarea, { variant: "brief", value: r.note, disabled: wk, ariaLabel: `note/description, ${r.userName}`, onValue: (v) => {
                                onPatch(r.rowKey, { note: v, description: v });
                            } })) }, colId));
            case 'workHours':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: readOnlyUi
                        ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: formatReportPreviewDurationHours(r.hours) }))
                        : (_jsx(DecimalDurationInput, { className: "tt-rp-mtable__input tt-rp-mtable__input--duration", valueHours: Number.isFinite(r.hours) ? r.hours : 0, onCommit: (hours) => {
                                if (r.isBillable) {
                                    const next = { ...r, hours, billableHours: hours };
                                    onPatch(r.rowKey, { hours, billableHours: hours, amountToPay: recomputeTimePreviewRowAmountToPay(next) });
                                }
                                else {
                                    onPatch(r.rowKey, { hours });
                                }
                            }, disabled: wk, "aria-label": `Отработано, ${r.userName}` })) }, colId));
            case 'billHours':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: readOnlyUi
                        ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: formatReportPreviewDurationHours(r.billableHours) }))
                        : (_jsx(DecimalDurationInput, { className: "tt-rp-mtable__input tt-rp-mtable__input--duration", valueHours: Number.isFinite(r.billableHours) ? r.billableHours : 0, onCommit: (bh) => {
                                const atp = recomputeTimePreviewRowAmountToPay({ ...r, billableHours: bh });
                                onPatch(r.rowKey, { billableHours: bh, amountToPay: atp });
                            }, disabled: wk, "aria-label": `Оплачиваемые часы, ${r.userName}` })) }, colId));
            case 'sum':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--sum-ro", title: "\u041E\u043F\u043B\u0430\u0447. \u0447\u0430\u0441\u044B \u00D7 \u0441\u0442\u0430\u0432\u043A\u0430", children: _jsx("span", { className: "tt-rp-mtable__sum-val", children: fmtAmtWithIso(computeTimePreviewRowAmountToPay(r), r.currency) }) }, colId));
            case 'actions':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--brief-actions", onClick: (e) => e.stopPropagation(), children: renderEntryRowActions(r, wk, i) }, colId));
            default:
                return null;
        }
    };
    const renderFullHeaderCell = (colId) => {
        switch (colId) {
            case 'rn':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--rn", children: "#" }, colId));
            case 'employee':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--employee-head", children: _jsxs("div", { className: "tt-rp-mtable__th-employee", children: [_jsx("span", { className: "tt-rp-mtable__th-employee-label", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), readOnlyUi ? null : employeeColumnFilterSlot] }) }, colId));
            case 'authUserId':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--tight", title: "authUserId", children: "ID" }, colId));
            case 'employeePosition':
                return (_jsx("th", { className: "tt-rp-mtable__th", title: "employeePosition", children: "\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C" }, colId));
            case 'workDate':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "workDate" }, colId));
            case 'recordedAt':
                return (_jsx("th", { className: "tt-rp-mtable__th", title: "recordedAt (ISO)", children: "recordedAt" }, colId));
            case 'clientId':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "clientId" }, colId));
            case 'clientName':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "clientName" }, colId));
            case 'projectId':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "projectId" }, colId));
            case 'projectName':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "projectName" }, colId));
            case 'projectCode':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "projectCode" }, colId));
            case 'task':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--pick", title: "\u0417\u0430\u0434\u0430\u0447\u0430 \u0438\u0437 \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u0438\u043A\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u0430: id \u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u044E\u0442\u0441\u044F \u0432\u044B\u0431\u043E\u0440\u043E\u043C", children: "\u0417\u0430\u0434\u0430\u0447\u0430" }, colId));
            case 'note':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--comment", children: "note / description" }, colId));
            case 'billableHours':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", title: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0447\u0430\u0441\u044B (\u0447:\u043C\u043C)", children: "\u041E\u043F\u043B\u0430\u0447. \u0447\u0430\u0441\u044B" }, colId));
            case 'isBillable':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--tight", title: "isBillable", children: "\u043E\u043F\u043B." }, colId));
            case 'taskBillableByDefault':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--tight", title: "taskBillableByDefault", children: "\u0437\u0430\u0434\u0430\u0447\u0430 \u043E\u043F\u043B." }, colId));
            case 'isInvoiced':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--tight", title: "isInvoiced", children: "\u0432 \u0441\u0447\u0451\u0442\u0435" }, colId));
            case 'isPaid':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--tight", title: "isPaid", children: "\u0441\u0447\u0451\u0442 \u043E\u043F\u043B." }, colId));
            case 'isWeekSubmitted':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--tight", title: "isWeekSubmitted", children: "\u043D\u0435\u0434. \u0441\u0434\u0430\u043D\u0430" }, colId));
            case 'billableRate':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", title: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0437\u0430 \u0447\u0430\u0441 (\u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442 \u0441\u0443\u043C\u043C\u0443)", children: "billableRate" }, colId));
            case 'amountToPay':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", title: "\u041E\u043F\u043B\u0430\u0447. \u0447\u0430\u0441\u044B \u00D7 \u0441\u0442\u0430\u0432\u043A\u0430, \u0431\u0435\u0437 \u0440\u0443\u0447\u043D\u043E\u0433\u043E \u0432\u0432\u043E\u0434\u0430", children: "\u0421\u0443\u043C\u043C\u0430" }, colId));
            case 'costRate':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", children: "costRate" }, colId));
            case 'costAmount':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", children: "costAmount" }, colId));
            case 'sourceEntryCount':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", title: "\u0414\u043B\u044F \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0438 = 1, \u0434\u043B\u044F \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 = \u0447\u0438\u0441\u043B\u043E \u0441\u0432\u0451\u0440\u043D\u0443\u0442\u044B\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439", children: "sourceEntryCount" }, colId));
            case 'currency':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "currency" }, colId));
            case 'externalReferenceUrl':
                return (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--comment", children: "externalReferenceUrl" }, colId));
            case 'invoiceId':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "invoiceId" }, colId));
            case 'invoiceNumber':
                return (_jsx("th", { className: "tt-rp-mtable__th", children: "invoiceNumber" }, colId));
            default:
                return null;
        }
    };
    const renderFullBodyCell = (colId, r, i, wk) => {
        switch (colId) {
            case 'rn':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--rn", children: i + 1 }, colId));
            case 'employee':
                return renderEmployeeBodyCell(colId, r, i, wk);
            case 'authUserId':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly tt-rp-mtable__td--tight", "aria-label": `authUserId, ${r.userName}`, children: _jsx(TimePreviewReadonlyText, { value: r.authUserId }) }, colId));
            case 'employeePosition':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly", "aria-label": `Должность, ${r.userName}`, children: _jsx(TimePreviewReadonlyText, { value: r.employeePosition }) }, colId));
            case 'workDate':
                return (_jsx("td", { className: "tt-rp-mtable__td", children: r.rowKind === 'aggregate' || !r.workDate.trim()
                        ? (_jsx("span", { className: "tt-rp-mtable__td--muted", title: "\u0414\u043B\u044F \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u00AB\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u2192 \u043F\u0440\u043E\u0435\u043A\u0442\u00BB \u043E\u0434\u043D\u0430 \u0434\u0430\u0442\u0430 \u043D\u0435 \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F", children: "\u2014" }))
                        : readOnlyUi
                            ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: formatRuYmd(r.workDate.slice(0, 10)) }))
                            : (_jsx(ReportPreviewRuDateField, { variant: "table", value: r.workDate.slice(0, 10), onChange: (ymd) => onPatch(r.rowKey, { workDate: ymd }), title: wk ? 'Можно сменить дату на день из открытого периода' : undefined })) }, colId));
            case 'recordedAt':
                return (_jsx("td", { className: "tt-rp-mtable__td", children: r.rowKind === 'aggregate'
                        ? (_jsx("span", { className: "tt-rp-mtable__td--muted", title: "\u0414\u043B\u044F \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u043D\u0435\u0442 \u043E\u0434\u043D\u043E\u0433\u043E recordedAt", children: "\u2014" }))
                        : readOnlyUi
                            ? (_jsx("span", { className: "tt-rp-mtable__readonly", title: r.recordedAt, children: `${formatRuYmd(getLocalYmdFromIso(r.recordedAt) ?? r.workDate.slice(0, 10))}, ${formatRuHmFromIso(r.recordedAt)}` }))
                            : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--iso", type: "text", value: r.recordedAt, onChange: (e) => onPatch(r.rowKey, { recordedAt: e.target.value }), placeholder: "ISO\u2026", "aria-label": `recordedAt, ${r.userName}`, disabled: wk })) }, colId));
            case 'clientId':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly", "aria-label": `clientId, ${r.userName}`, children: _jsx(TimePreviewReadonlyText, { value: r.clientId }) }, colId));
            case 'clientName':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly", "aria-label": `clientName, ${r.userName}`, children: _jsx(TimePreviewReadonlyText, { value: r.clientName }) }, colId));
            case 'projectId':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly", "aria-label": `projectId, ${r.userName}`, children: _jsx(TimePreviewReadonlyText, { value: r.projectId }) }, colId));
            case 'projectName':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly", "aria-label": `projectName, ${r.userName}`, children: _jsx(TimePreviewReadonlyText, { value: r.projectName }) }, colId));
            case 'projectCode':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--readonly", "aria-label": `projectCode, ${r.userName}`, children: _jsx(TimePreviewReadonlyText, { value: r.projectCode }) }, colId));
            case 'task':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick", children: readOnlyUi
                        ? (_jsxs("span", { className: "tt-rp-mtable__readonly tt-rp-mtable__task-with-badge", children: [_jsx(InternalTaskMark, { row: r }), ((r.taskName || r.taskId || '').trim() || '—')] }))
                        : (_jsxs("div", { className: "tt-rp-mtable__brief-task", children: [_jsx(InternalTaskMark, { row: r }), timeReportTaskSelect(r, wk)] })) }, colId));
            case 'note':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--comment", children: readOnlyUi
                        ? (_jsx("span", { className: "tt-rp-mtable__readonly tt-rp-mtable__readonly--pre", children: String(r.note ?? '').trim() ? r.note : '—' }))
                        : (_jsx(TimePreviewNoteTextarea, { variant: "full", value: r.note, disabled: wk, ariaLabel: `note/description, ${r.userName}`, onValue: (v) => {
                                onPatch(r.rowKey, { note: v, description: v });
                            } })) }, colId));
            case 'billableHours':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: readOnlyUi
                        ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: formatReportPreviewDurationHours(r.billableHours) }))
                        : (_jsx(DecimalDurationInput, { className: "tt-rp-mtable__input tt-rp-mtable__input--duration", valueHours: Number.isFinite(r.billableHours) ? r.billableHours : 0, onCommit: (bh) => {
                                const atp = recomputeTimePreviewRowAmountToPay({ ...r, billableHours: bh });
                                onPatch(r.rowKey, { billableHours: bh, amountToPay: atp });
                            }, disabled: wk, "aria-label": `Оплачиваемые часы, ${r.userName}` })) }, colId));
            case 'isBillable':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--tight", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: r.isBillable ? 'Да' : 'Нет' })) : (_jsx(RpBool, { checked: r.isBillable, ariaLabel: `isBillable, ${r.userName}`, disabled: wk, onChange: (v) => {
                            const newBh = v ? r.hours : r.billableHours;
                            const next = { ...r, isBillable: v, billableHours: newBh };
                            onPatch(r.rowKey, { isBillable: v, billableHours: newBh, amountToPay: recomputeTimePreviewRowAmountToPay(next) });
                        } })) }, colId));
            case 'taskBillableByDefault':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--tight", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: r.taskBillableByDefault ? 'Да' : 'Нет' })) : (_jsx(RpBool, { checked: r.taskBillableByDefault, ariaLabel: `taskBillableByDefault, ${r.userName}`, disabled: wk, onChange: (v) => onPatch(r.rowKey, { taskBillableByDefault: v }) })) }, colId));
            case 'isInvoiced':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--tight", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: r.isInvoiced ? 'Да' : 'Нет' })) : (_jsx(RpBool, { checked: r.isInvoiced, ariaLabel: `isInvoiced, ${r.userName}`, disabled: wk, onChange: (v) => onPatch(r.rowKey, { isInvoiced: v }) })) }, colId));
            case 'isPaid':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--tight", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: r.isPaid ? 'Да' : 'Нет' })) : (_jsx(RpBool, { checked: r.isPaid, ariaLabel: `isPaid, ${r.userName}`, disabled: wk, onChange: (v) => onPatch(r.rowKey, { isPaid: v }) })) }, colId));
            case 'isWeekSubmitted':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--tight", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: r.isWeekSubmitted ? 'Да' : 'Нет' })) : (_jsx(RpBool, { checked: r.isWeekSubmitted, ariaLabel: `isWeekSubmitted, ${r.userName}`, disabled: wk, onChange: (v) => onPatch(r.rowKey, { isWeekSubmitted: v }) })) }, colId));
            case 'billableRate':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: Number.isFinite(r.billableRate) ? String(r.billableRate) : '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 0.01, min: 0, value: r.billableRate, onChange: (e) => {
                            const v = parseFloat(e.target.value);
                            const rate = Number.isFinite(v) ? v : 0;
                            onPatch(r.rowKey, {
                                billableRate: rate,
                                amountToPay: recomputeTimePreviewRowAmountToPay({ ...r, billableRate: rate }),
                            });
                        }, disabled: wk, "aria-label": `billableRate, ${r.userName}` })) }, colId));
            case 'amountToPay':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num tt-rp-mtable__td--sum-ro", title: "\u041E\u043F\u043B\u0430\u0447. \u0447\u0430\u0441\u044B \u00D7 \u0441\u0442\u0430\u0432\u043A\u0430", children: _jsx("span", { className: "tt-rp-mtable__sum-val", "aria-label": `Сумма к оплате, ${r.userName}`, children: fmtAmtWithIso(computeTimePreviewRowAmountToPay(r), r.currency) }) }, colId));
            case 'costRate':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: Number.isFinite(r.costRate) ? String(r.costRate) : '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 0.01, min: 0, value: r.costRate, onChange: (e) => {
                            const v = parseFloat(e.target.value);
                            const cr = Number.isFinite(v) ? v : 0;
                            onPatch(r.rowKey, {
                                costRate: cr,
                                costAmount: Math.round(r.hours * cr * 100) / 100,
                            });
                        }, disabled: wk, "aria-label": `costRate, ${r.userName}` })) }, colId));
            case 'costAmount':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: Number.isFinite(r.costAmount) ? String(r.costAmount) : '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 0.01, min: 0, value: Number.isFinite(r.costAmount) ? r.costAmount : '', onChange: (e) => {
                            const v = parseFloat(e.target.value);
                            onPatch(r.rowKey, { costAmount: Number.isFinite(v) ? v : 0 });
                        }, disabled: wk, "aria-label": `costAmount, ${r.userName}` })) }, colId));
            case 'sourceEntryCount':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: Number.isFinite(r.sourceEntryCount) ? String(r.sourceEntryCount) : '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 1, min: 0, value: r.sourceEntryCount, onChange: (e) => {
                            const v = parseInt(e.target.value, 10);
                            onPatch(r.rowKey, { sourceEntryCount: Number.isFinite(v) && v >= 0 ? v : 0 });
                        }, disabled: wk, "aria-label": `sourceEntryCount, ${r.userName}` })) }, colId));
            case 'currency':
                return (_jsx("td", { className: "tt-rp-mtable__td", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: r.currency || '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--cur", type: "text", maxLength: 8, value: r.currency, onChange: (e) => onPatch(r.rowKey, { currency: e.target.value.toUpperCase().slice(0, 8) }), disabled: wk, "aria-label": `currency, ${r.userName}` })) }, colId));
            case 'externalReferenceUrl':
                return (_jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--comment", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly tt-rp-mtable__readonly--pre", children: String(r.externalReferenceUrl ?? '').trim() || '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--url", type: "url", value: r.externalReferenceUrl, onChange: (e) => onPatch(r.rowKey, { externalReferenceUrl: e.target.value }), placeholder: "https://\u2026", disabled: wk, "aria-label": `externalReferenceUrl, ${r.userName}` })) }, colId));
            case 'invoiceId':
                return (_jsx("td", { className: "tt-rp-mtable__td", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: String(r.invoiceId ?? '').trim() || '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--idtext", type: "text", value: r.invoiceId, onChange: (e) => onPatch(r.rowKey, { invoiceId: e.target.value }), disabled: wk, "aria-label": `invoiceId, ${r.userName}` })) }, colId));
            case 'invoiceNumber':
                return (_jsx("td", { className: "tt-rp-mtable__td", children: readOnlyUi ? (_jsx("span", { className: "tt-rp-mtable__readonly", children: String(r.invoiceNumber ?? '').trim() || '—' })) : (_jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--name", type: "text", value: r.invoiceNumber, onChange: (e) => onPatch(r.rowKey, { invoiceNumber: e.target.value }), disabled: wk, "aria-label": `invoiceNumber, ${r.userName}` })) }, colId));
            default:
                return null;
        }
    };
    const tableBlock = (_jsx("div", { className: `tt-rp-mtable-wrap${tableFullscreen ? ' tt-rp-mtable-wrap--fullscreen' : ''}`, children: _jsxs("div", { className: "tt-rp-mtable-card", children: [_jsxs("header", { className: "tt-rp-mtable-head tt-rp-mtable-head--calm tt-rp-mtable-head--composed", children: [_jsxs("div", { className: "tt-rp-mtable-toolbar tt-rp-mtable-toolbar--calm tt-rp-mtable-toolbar--composed", role: "toolbar", "aria-label": "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043E\u0442\u0447\u0451\u0442\u0430", children: [_jsxs("div", { className: "tt-rp-mtable-title-row", children: [_jsx("h2", { className: "tt-rp-mtable-title", children: projectTitle }), (() => {
                                            const saveUi = readOnlyUi ? 'ro' : (timeSave?.ui ?? 'idle');
                                            const title = readOnlyUi
                                                ? (onUnlockEdit ? 'Нажмите «Редактировать», чтобы править строки' : 'Редактирование недоступно')
                                                : saveUi === 'saving'
                                                    ? 'Сохранение на сервер…'
                                                    : saveUi === 'saved'
                                                        ? (timeSave?.message ?? 'Сохранено')
                                                        : saveUi === 'err'
                                                            ? (timeSave?.message ?? 'Ошибка сохранения')
                                                            : 'Нет несохранённых изменений';
                                            return (_jsxs("span", { className: `tt-rp-mtable-save-ind tt-rp-mtable-save-ind--${saveUi}`, title: title, role: "status", "aria-live": "polite", "aria-label": title, children: [_jsx("span", { className: "tt-rp-mtable-save-ind__dot", "aria-hidden": true }), _jsx("span", { className: "tt-rp-mtable-save-ind__text", children: saveUi === 'ro' ? 'Просмотр' : saveUi === 'saving' ? 'Сохранение…' : saveUi === 'saved' ? 'Сохранено' : saveUi === 'err' ? 'Ошибка' : '' })] }));
                                        })()] }), _jsxs("label", { className: "tt-rp-mtable-search", children: [_jsx("span", { className: "tt-rp-mtable-search__ico", "aria-hidden": true, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("path", { d: "M20 20l-3-3" })] }) }), _jsx("input", { type: "search", className: "tt-rp-mtable-search__input", value: toolbarSearch, onChange: (e) => setToolbarSearch(e.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0437\u0430\u043F\u0438\u0441\u044F\u043C\u2026", autoComplete: "off", spellCheck: false })] }), !readOnlyUi && onAddTimeEntry ? (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-mtable-toolbar__btn--add", onClick: () => void onAddTimeEntry(), disabled: Boolean(serverReloadBusy || timeSave?.ui === 'saving' || timeEntryActionPendingRowKey != null), title: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0437\u0430\u043F\u0438\u0441\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438", children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" })) : null, scopeDefinitionsSlot, scopeDefinitionsSlot || usedScopeColors.length > 0 ? (_jsxs("button", { type: "button", className: `tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-scope-compose${scopeGroupingEnabled ? ' tt-rp-scope-compose--active' : ''}`, "aria-pressed": scopeGroupingEnabled, title: scopeGroupingEnabled ? 'Вернуть обычный порядок строк по дате' : 'Сгруппировать строки по цветам Scope', onClick: () => setScopeGroupingEnabled((enabled) => !enabled), children: [_jsxs("span", { className: "tt-rp-scope-compose__icon", "aria-hidden": true, children: [_jsx("span", { style: { backgroundColor: usedScopeColors[0] ?? REPORT_PREVIEW_SCOPE_DEFAULT } }), _jsx("span", { style: { backgroundColor: usedScopeColors[1] ?? usedScopeColors[0] ?? REPORT_PREVIEW_SCOPE_DEFAULT } }), _jsx("span", { style: { backgroundColor: usedScopeColors[2] ?? usedScopeColors[0] ?? REPORT_PREVIEW_SCOPE_DEFAULT } })] }), "\u041F\u043E \u0446\u0432\u0435\u0442\u0430\u043C"] })) : null, _jsxs("div", { className: "tt-rp-mtable-toolbar__trail", children: [onUnlockEdit ? (_jsx("button", { type: "button", className: `tt-reports__btn tt-rp-mtable-toolbar__btn ${confirmedEditUnlocked ? 'tt-reports__btn--outline' : 'tt-reports__btn--accent'}`, onClick: () => void onUnlockEdit(), title: confirmedEditUnlocked ? 'Вернуться к просмотру' : 'Редактировать строки подтверждённого отчёта', "aria-pressed": confirmedEditUnlocked, children: confirmedEditUnlocked ? 'Готово' : 'Редактировать' })) : null, !readOnlyUi ? (_jsxs("div", { className: "tt-rp-mtable-more", ref: moreMenuRef, children: [_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-rp-mtable-toolbar__btn tt-rp-mtable-more__btn", onClick: () => setMoreMenuOpen((v) => !v), "aria-expanded": moreMenuOpen, "aria-haspopup": "menu", title: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F", children: ["\u0415\u0449\u0451", _jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), moreMenuOpen ? (_jsxs("div", { className: "tt-rp-mtable-more__menu", role: "menu", children: [_jsx("button", { type: "button", role: "menuitem", className: "tt-rp-mtable-more__item", onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                if (isFull)
                                                                    setFullColumnsModalOpen(true);
                                                                else
                                                                    setBriefColumnsModalOpen(true);
                                                            }, children: "\u041A\u043E\u043B\u043E\u043D\u043A\u0438" }), onRequestServerReload ? (_jsx("button", { type: "button", role: "menuitem", className: "tt-rp-mtable-more__item", disabled: Boolean(serverReloadBusy), onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                onRequestServerReload();
                                                            }, children: serverReloadBusy ? 'Обновление…' : 'Обновить с сервера' })) : null, onUndo ? (_jsxs("button", { type: "button", role: "menuitem", className: "tt-rp-mtable-more__item", disabled: !canUndo || Boolean(serverReloadBusy || timeSave?.ui === 'saving' || timeEntryActionPendingRowKey != null), onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                void onUndo();
                                                            }, children: ["\u041E\u0442\u043C\u0435\u043D\u0430 (", formatPrimaryShortcut('Z'), ")"] })) : null, onSaveNow ? (_jsxs("button", { type: "button", role: "menuitem", className: "tt-rp-mtable-more__item", disabled: Boolean(serverReloadBusy || timeSave?.ui === 'saving'), onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                void onSaveNow();
                                                            }, children: ["\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C (", formatPrimaryShortcut('S'), ")"] })) : null, onDownloadExcel ? (_jsx("button", { type: "button", role: "menuitem", className: "tt-rp-mtable-more__item", disabled: Boolean(downloadExcelBusy), onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                void onDownloadExcel(rowsForTotals);
                                                            }, children: downloadExcelBusy ? 'Excel…' : 'Скачать Excel' })) : null, (onUndo || onSaveNow || onDuplicateTimeEntry) ? (_jsx("button", { type: "button", role: "menuitem", className: "tt-rp-mtable-more__item", onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                setHotkeysHelpOpen(true);
                                                            }, children: "\u0413\u043E\u0440\u044F\u0447\u0438\u0435 \u043A\u043B\u0430\u0432\u0438\u0448\u0438" })) : null] })) : null] })) : (_jsx(PreviewExcelDownloadBtn, { onDownloadExcel: onDownloadExcel, downloadExcelBusy: downloadExcelBusy, exportRows: rowsForTotals })), _jsx("button", { type: "button", className: "tt-rp-mtable-fullscreen-btn", onClick: () => setTableFullscreen((v) => !v), title: tableFullscreen ? 'Свернуть таблицу' : 'Развернуть таблицу на весь экран', "aria-label": tableFullscreen ? 'Свернуть таблицу' : 'Развернуть таблицу на весь экран', "aria-pressed": tableFullscreen, children: _jsx(IcoTableFullscreen, { exit: tableFullscreen }) })] })] }), headerPositionShares.length > 0 ? (_jsx("div", { className: "tt-rp-mtable-position-shares", "aria-label": "\u0414\u043E\u043B\u044F \u043F\u043E \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044F\u043C", children: headerPositionShares.map((share) => {
                                const active = bfPositions.includes(share.position);
                                return (_jsxs("button", { type: "button", className: `tt-rp-mtable-position-shares__item${active ? ' tt-rp-mtable-position-shares__item--on' : ''}${bfPositions.length > 0 && !active ? ' tt-rp-mtable-position-shares__item--dim' : ''}`, title: active
                                        ? `Скрыть ${share.position}`
                                        : `Показать только ${share.position}: ${formatDecimalHoursAsHm(share.billableHours)} (${share.percent}%)`, "aria-pressed": active, onClick: () => setBfPositions((prev) => togglePositionShareFilter(prev, share.position)), children: [_jsxs("strong", { children: [share.percent, "%"] }), ' ', share.position] }, share.position));
                            }) })) : null] }), _jsx(ReportPreviewTimeBriefColumnsModal, { open: !readOnlyUi && !isFull && briefColumnsModalOpen, onClose: () => setBriefColumnsModalOpen(false), includeActionsColumn: showActionsColumn, activeOrderedIds: visibleBriefIds, onChange: setBriefColumnIds, rememberEnabled: briefColumnsRemember, onRememberEnabledChange: onBriefColumnsRememberChange }), _jsx(ReportPreviewTimeFullColumnsModal, { open: Boolean(!readOnlyUi && isFull && fullColumnsModalOpen), onClose: () => setFullColumnsModalOpen(false), activeOrderedIds: visibleFullIds, onChange: setFullColumnIds }), _jsx(ReportPreviewHotkeysHelpModal, { open: hotkeysHelpOpen, onClose: () => setHotkeysHelpOpen(false), showDuplicate: Boolean(onDuplicateTimeEntry) }), _jsx("div", { ref: tableScrollRef, className: "tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x", children: isFull ? (_jsxs("table", { className: "tt-rp-mtable tt-rp-mtable--time-wide", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx(ReportRowSelectHeader, { selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange, visibleRowKeys: displayRows.map((r) => r.rowKey) }), visibleFullIds.map((colId) => renderFullHeaderCell(colId)), showEntryActions ? (_jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--brief-actions", scope: "col", children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" }, "actions-full")) : null] }) }), _jsx("tbody", { children: _jsx(VirtualizedTableRows, { scrollRef: tableScrollRef, rowCount: displayRows.length, colSpan: fullTableColSpan, estimateRowHeight: 56, renderRow: renderFullDataRow }) })] })) : (_jsxs("table", { className: "tt-rp-mtable tt-rp-mtable--time-brief", children: [briefColGroup, _jsx("thead", { children: _jsxs("tr", { children: [_jsx(ReportRowSelectHeader, { selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange, visibleRowKeys: displayRows.map((r) => r.rowKey) }), visibleBriefIds.map((colId) => renderBriefHeaderCell(colId))] }) }), _jsx("tbody", { children: _jsx(VirtualizedTableRows, { scrollRef: tableScrollRef, rowCount: displayRows.length, colSpan: briefTableColSpan, estimateRowHeight: 40, renderRow: renderBriefDataRow }) })] })) }), _jsxs("footer", { className: "tt-rp-mtable-dock", role: "contentinfo", "aria-label": "\u0418\u0442\u043E\u0433\u0438 \u043E\u0442\u0447\u0451\u0442\u0430", children: [_jsxs("div", { className: "tt-rp-mtable-dock__stats", children: [_jsxs("span", { className: "tt-rp-mtable-dock__stat", children: ["\u0418\u0442\u043E\u0433\u043E: ", _jsxs("strong", { children: [entriesCount, " ", ruEntriesWord(entriesCount)] })] }), _jsxs("span", { className: "tt-rp-mtable-dock__stat", children: ["\u041E\u0442\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E: ", _jsx("strong", { children: dockHours })] }), _jsxs("span", { className: "tt-rp-mtable-dock__stat", children: ["\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0447\u0430\u0441\u044B: ", _jsx("strong", { children: dockBillable })] }), _jsxs("span", { className: "tt-rp-mtable-dock__stat", children: ["\u0421\u0443\u043C\u043C\u0430: ", _jsx("strong", { children: dockSum })] }), headerPositionShares.length > 0 ? (_jsx("span", { className: "tt-rp-mtable-dock__stat tt-rp-mtable-dock__stat--roles", "aria-label": "\u0414\u043E\u043B\u044F \u043F\u043E \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044F\u043C", children: headerPositionShares.map((share, i) => (_jsxs("span", { children: [i > 0 ? _jsx("span", { className: "tt-rp-mtable-dock__role-sep", "aria-hidden": true, children: " \u00B7 " }) : null, _jsxs("span", { title: `${share.position}: ${formatDecimalHoursAsHm(share.billableHours)} (${share.percent}%)`, children: [_jsxs("strong", { children: [share.percent, "%"] }), " ", share.position] })] }, share.position))) })) : null] }), footerExtras ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "tt-rp-mtable-dock__sep", "aria-hidden": true }), _jsx("div", { className: "tt-rp-mtable-dock__aside", children: footerExtras })] })) : null] })] }) }));
    return (_jsxs(_Fragment, { children: [tableBlock, _jsx(TimeBriefMoveEntryDialog, { open: Boolean(moveTargetRow), row: moveTargetRow, projectOptions: moveProjectOptions, busy: moveDialogBusy, onClose: () => {
                    setMoveTargetRow(null);
                }, onConfirm: async (projectId) => {
                    if (!moveTargetRow || !onMoveTimeEntryToProject)
                        return;
                    try {
                        await Promise.resolve(onMoveTimeEntryToProject(moveTargetRow.rowKey, projectId));
                        setMoveTargetRow(null);
                    }
                    catch {
                    }
                } }), _jsx(TimeDuplicateEntryDialog, { open: Boolean(duplicateTargetRow), row: duplicateTargetRow, workDateMin: dupBounds.min, workDateMax: dupBounds.max, canOverrideClosedWeek: canOverrideClosedWeek, busy: duplicateDialogBusy, onClose: () => {
                    setDuplicateTargetRow(null);
                }, onConfirm: async (workDateYmd, recordedAtIso) => {
                    if (!duplicateTargetRow || !onDuplicateTimeEntry)
                        return;
                    try {
                        await Promise.resolve(onDuplicateTimeEntry(duplicateTargetRow.rowKey, workDateYmd, recordedAtIso));
                        setDuplicateTargetRow(null);
                    }
                    catch {
                    }
                } })] }));
}
export function ExpenseExcelPreviewTable({ rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }) {
    const tableScrollRef = useRef(null);
    const categoryOptions = useMemo(() => mergeLabeledOptions(PREVIEW_CATEGORY_OPTIONS, rows.map((r) => ({
        id: r.categoryId,
        label: r.comment.trim() || r.categoryId,
    }))), [rows]);
    const renderRow = (i, measure) => {
        const r = rows[i];
        return (_jsxs("tr", { ref: measure.ref, "data-index": measure['data-index'], className: rowTrClass(i, r.rowKey, selectedRowKeys), "aria-selected": isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined, children: [_jsx(ReportRowSelectCell, { rowKey: r.rowKey, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--rn", children: i + 1 }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--strong", children: r.userName }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick", children: _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: TT_RP_SELECT_PORTAL_Z, className: "tt-rp-mtable__srch", buttonClassName: "tt-rp-mtable__srch-btn", "aria-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", placeholder: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u2026", emptyListText: "\u041D\u0435\u0442", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: r.categoryId, items: categoryOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => onPatch(r.rowKey, { categoryId: o.id }) }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--comment", children: _jsx("textarea", { className: "tt-rp-mtable__input tt-rp-mtable__textarea", rows: 2, value: r.comment, onChange: (e) => onPatch(r.rowKey, { comment: e.target.value }) }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--muted", title: "\u0421 \u0441\u0435\u0440\u0432\u0435\u0440\u0430; \u0435\u0441\u043B\u0438 \u00AB\u2014\u00BB, \u043F\u043E\u043B\u0435 status \u0434\u043B\u044F \u0441\u0442\u0440\u043E\u043A\u0438 \u0432 API \u043D\u0435 \u043F\u0440\u0438\u0448\u043B\u043E.", children: r.statusLabel || '—' }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: _jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 0.01, min: 0, value: r.total, onChange: (e) => {
                            const v = parseFloat(e.target.value);
                            onPatch(r.rowKey, { total: Number.isFinite(v) ? v : 0 });
                        } }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: _jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 0.01, min: 0, value: r.billable, onChange: (e) => {
                            const v = parseFloat(e.target.value);
                            onPatch(r.rowKey, { billable: Number.isFinite(v) ? v : 0 });
                        } }) })] }, r.rowKey));
    };
    const expenseColSpan = 7 + (onSelectedRowKeysChange ? 1 : 0);
    return (_jsx("div", { className: "tt-rp-mtable-wrap", children: _jsxs("div", { className: "tt-rp-mtable-card", children: [_jsx("header", { className: "tt-rp-mtable-head", children: _jsxs("div", { className: "tt-rp-mtable-head-text", children: [_jsxs("div", { className: "tt-rp-mtable-title-row", children: [_jsx("h2", { className: "tt-rp-mtable-title", children: "\u0420\u0430\u0441\u0445\u043E\u0434\u044B" }), _jsx(PreviewServerReloadBtn, { onRequestServerReload: onRequestServerReload, serverReloadBusy: serverReloadBusy })] }), _jsx("p", { className: "tt-rp-mtable-sub", children: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430; \u043F\u0440\u0430\u0432\u043A\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430." })] }) }), _jsx("div", { ref: tableScrollRef, className: "tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x", children: _jsxs("table", { className: "tt-rp-mtable tt-rp-mtable--wide", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx(ReportRowSelectHeader, { selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange, visibleRowKeys: rows.map((r) => r.rowKey) }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--rn", children: "#" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--employee-head", children: _jsxs("div", { className: "tt-rp-mtable__th-employee", children: [_jsx("span", { className: "tt-rp-mtable__th-employee-label", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), employeeColumnFilterSlot] }) }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--pick", children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F / \u0440\u0430\u0437\u0440\u0435\u0437" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--comment", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("th", { className: "tt-rp-mtable__th", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", children: "\u0412\u0441\u0435\u0433\u043E" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", children: "\u0412\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u044B\u0435" })] }) }), _jsx("tbody", { children: _jsx(VirtualizedTableRows, { scrollRef: tableScrollRef, rowCount: rows.length, colSpan: expenseColSpan, estimateRowHeight: 72, renderRow: renderRow }) })] }) })] }) }));
}
export function UninvoicedExcelPreviewTable({ rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }) {
    const tableScrollRef = useRef(null);
    const taskOptions = useMemo(() => mergeLabeledOptions(PREVIEW_TASK_OPTIONS, rows.map((r) => ({
        id: r.taskId,
        label: r.comment || r.taskId,
    }))), [rows]);
    const renderRow = (i, measure) => {
        const r = rows[i];
        return (_jsxs("tr", { ref: measure.ref, "data-index": measure['data-index'], className: rowTrClass(i, r.rowKey, selectedRowKeys), "aria-selected": isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined, children: [_jsx(ReportRowSelectCell, { rowKey: r.rowKey, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--rn", children: i + 1 }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--strong", children: r.userName }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick", children: _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: TT_RP_SELECT_PORTAL_Z, className: "tt-rp-mtable__srch", buttonClassName: "tt-rp-mtable__srch-btn", "aria-label": "\u041F\u0440\u043E\u0435\u043A\u0442", placeholder: "\u041F\u0440\u043E\u0435\u043A\u0442\u2026", emptyListText: "\u041D\u0435\u0442", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: r.taskId, items: taskOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => onPatch(r.rowKey, { taskId: o.id }) }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--comment", children: _jsx("textarea", { className: "tt-rp-mtable__input tt-rp-mtable__textarea", rows: 2, value: r.comment, onChange: (e) => onPatch(r.rowKey, { comment: e.target.value }) }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: _jsx(DecimalDurationInput, { className: "tt-rp-mtable__input tt-rp-mtable__input--duration", valueHours: r.hours, onCommit: (hours) => onPatch(r.rowKey, { hours }), "aria-label": `Часы, ${r.userName}` }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: _jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 0.01, min: 0, value: r.amount, onChange: (e) => {
                            const v = parseFloat(e.target.value);
                            onPatch(r.rowKey, { amount: Number.isFinite(v) ? v : 0 });
                        } }) })] }, r.rowKey));
    };
    const uninvoicedColSpan = 6 + (onSelectedRowKeysChange ? 1 : 0);
    return (_jsx("div", { className: "tt-rp-mtable-wrap", children: _jsxs("div", { className: "tt-rp-mtable-card", children: [_jsx("header", { className: "tt-rp-mtable-head", children: _jsxs("div", { className: "tt-rp-mtable-head-text", children: [_jsxs("div", { className: "tt-rp-mtable-title-row", children: [_jsx("h2", { className: "tt-rp-mtable-title", children: "\u041D\u0435 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E" }), _jsx(PreviewServerReloadBtn, { onRequestServerReload: onRequestServerReload, serverReloadBusy: serverReloadBusy })] }), _jsx("p", { className: "tt-rp-mtable-sub", children: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430; \u043F\u0440\u0430\u0432\u043A\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430." })] }) }), _jsx("div", { ref: tableScrollRef, className: "tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x", children: _jsxs("table", { className: "tt-rp-mtable tt-rp-mtable--wide", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx(ReportRowSelectHeader, { selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange, visibleRowKeys: rows.map((r) => r.rowKey) }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--rn", children: "#" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--employee-head", children: _jsxs("div", { className: "tt-rp-mtable__th-employee", children: [_jsx("span", { className: "tt-rp-mtable__th-employee-label", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), employeeColumnFilterSlot] }) }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--pick", children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--comment", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", title: "\u0424\u043E\u0440\u043C\u0430\u0442 \u0447:\u043C\u043C", children: "\u0427\u0430\u0441\u044B" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", children: "\u0421\u0443\u043C\u043C\u0430" })] }) }), _jsx("tbody", { children: _jsx(VirtualizedTableRows, { scrollRef: tableScrollRef, rowCount: rows.length, colSpan: uninvoicedColSpan, estimateRowHeight: 72, renderRow: renderRow }) })] }) })] }) }));
}
export function BudgetExcelPreviewTable({ rows, onPatch, selectedRowKeys = null, onSelectedRowKeysChange, employeeColumnFilterSlot, onRequestServerReload, serverReloadBusy, }) {
    const tableScrollRef = useRef(null);
    const taskOptions = useMemo(() => mergeLabeledOptions(PREVIEW_TASK_OPTIONS, rows.map((r) => ({
        id: r.taskId,
        label: r.taskId,
    }))), [rows]);
    const renderRow = (i, measure) => {
        const r = rows[i];
        return (_jsxs("tr", { ref: measure.ref, "data-index": measure['data-index'], className: rowTrClass(i, r.rowKey, selectedRowKeys), "aria-selected": isReportRowSelected(r.rowKey, selectedRowKeys) ? true : undefined, children: [_jsx(ReportRowSelectCell, { rowKey: r.rowKey, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--rn", children: i + 1 }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--strong", children: r.userName }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--pick", children: _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: TT_RP_SELECT_PORTAL_Z, className: "tt-rp-mtable__srch", buttonClassName: "tt-rp-mtable__srch-btn", "aria-label": "\u041F\u0440\u043E\u0435\u043A\u0442", placeholder: "\u041F\u0440\u043E\u0435\u043A\u0442\u2026", emptyListText: "\u041D\u0435\u0442", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: r.taskId, items: taskOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => onPatch(r.rowKey, { taskId: o.id }) }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: _jsx(DecimalDurationInput, { className: "tt-rp-mtable__input tt-rp-mtable__input--duration", valueHours: r.hoursLogged, onCommit: (hours) => onPatch(r.rowKey, { hoursLogged: hours }), "aria-label": `Часы (факт), ${r.userName}` }) }), _jsx("td", { className: "tt-rp-mtable__td tt-rp-mtable__td--num", children: _jsx("input", { className: "tt-rp-mtable__input tt-rp-mtable__input--num", type: "number", step: 0.01, min: 0, value: r.amountLogged, onChange: (e) => {
                            const v = parseFloat(e.target.value);
                            onPatch(r.rowKey, { amountLogged: Number.isFinite(v) ? v : 0 });
                        } }) })] }, r.rowKey));
    };
    const budgetColSpan = 5 + (onSelectedRowKeysChange ? 1 : 0);
    return (_jsx("div", { className: "tt-rp-mtable-wrap", children: _jsxs("div", { className: "tt-rp-mtable-card", children: [_jsx("header", { className: "tt-rp-mtable-head", children: _jsxs("div", { className: "tt-rp-mtable-head-text", children: [_jsxs("div", { className: "tt-rp-mtable-title-row", children: [_jsx("h2", { className: "tt-rp-mtable-title", children: "\u0411\u044E\u0434\u0436\u0435\u0442" }), _jsx(PreviewServerReloadBtn, { onRequestServerReload: onRequestServerReload, serverReloadBusy: serverReloadBusy })] }), _jsx("p", { className: "tt-rp-mtable-sub", children: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430; \u043F\u0440\u0430\u0432\u043A\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430." })] }) }), _jsx("div", { ref: tableScrollRef, className: "tt-rp-mtable-scroll tt-rp-mtable-scroll--sticky-x", children: _jsxs("table", { className: "tt-rp-mtable tt-rp-mtable--wide", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx(ReportRowSelectHeader, { selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: onSelectedRowKeysChange, visibleRowKeys: rows.map((r) => r.rowKey) }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--rn", children: "#" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--employee-head", children: _jsxs("div", { className: "tt-rp-mtable__th-employee", children: [_jsx("span", { className: "tt-rp-mtable__th-employee-label", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), employeeColumnFilterSlot] }) }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--pick", children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", title: "\u0424\u043E\u0440\u043C\u0430\u0442 \u0447:\u043C\u043C", children: "\u0427\u0430\u0441\u044B (\u0444\u0430\u043A\u0442)" }), _jsx("th", { className: "tt-rp-mtable__th tt-rp-mtable__th--num", children: "\u0421\u0443\u043C\u043C\u0430 (\u0444\u0430\u043A\u0442)" })] }) }), _jsx("tbody", { children: _jsx(VirtualizedTableRows, { scrollRef: tableScrollRef, rowCount: rows.length, colSpan: budgetColSpan, estimateRowHeight: 56, renderRow: renderRow }) })] }) })] }) }));
}
