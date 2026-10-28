import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { buildUserKindYearCounts, formatPayrollMoney, sickPayTotal, vacationPayTotal, } from '../lib/vacationPayrollFormulas';
import { basisSummaryForTooltip, hasVacationAbsenceBasisContent } from '../lib/vacationAbsenceBasisStorage';
import { VACATION_KIND_COLORS, VACATION_MONTH_NAMES, parseVacationCellKey, vacationCellKey, vacationDayIsWeekendRu, vacationAttendanceLateTooltip, vacationKindHumanLabel, vacationKindSeal, vacationKindSealUsesDarkInk, vacationRowMarkRunEdges, vacationUiLegendFallback, vacationWeekdayShortRu, vacationYearDayColumns, } from '../lib/vacationScheduleModel';
import { DEFAULT_WORKDAY_SETTINGS } from '@shared/lib/attendanceSettings';
import { buildVacColSegs, readCssLenPx, remToPx, VAC_COL_OVERSCAN, VAC_ROW_OVERSCAN, } from './vacationTableVirtual';
import './VacationContinuousTable.css';
function buildUserMarkStats(marks, year, employeeIds) {
    const stats = new Map();
    for (const id of employeeIds) {
        stats.set(id, { months: Array(12).fill(0), year: 0 });
    }
    for (const key of Object.keys(marks)) {
        const p = parseVacationCellKey(key);
        if (!p || p.year !== year)
            continue;
        if (!marks[key])
            continue;
        const s = stats.get(p.userId);
        if (!s)
            continue;
        s.months[p.monthIndex] += 1;
        s.year += 1;
    }
    return stats;
}
function cellDateLabel(year, monthIndex, day) {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${d}.${m}.${year}`;
}
function BasisPin() {
    return (_jsx("span", { className: "vac-cont__basis-pin", "aria-hidden": true, children: _jsxs("svg", { className: "vac-cont__basis-pin-svg", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("path", { d: "M6 3.5V3a2 2 0 114 0v.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", fill: "none" }), _jsx("path", { d: "M6 3.5h4V8a2 2 0 01-1.25 1.86L8 10.25V14", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" })] }) }));
}
function AbsenceMarkVisual({ kind, color, markRunStart, markRunEnd, }) {
    const seal = vacationKindSeal(kind);
    const darkInk = vacationKindSealUsesDarkInk(kind);
    const inkCls = darkInk ? ' vac-cont__seal-ink--dark' : '';
    const single = markRunStart && markRunEnd;
    if (single) {
        return (_jsx("span", { className: `vac-cont__seal${inkCls}`, style: { backgroundColor: color }, "aria-hidden": true, children: seal }));
    }
    const pos = markRunStart ? 'start' : markRunEnd ? 'end' : 'mid';
    return (_jsx("span", { className: `vac-cont__range-bar vac-cont__range-bar--${pos}`, style: { backgroundColor: color }, "aria-hidden": true, children: markRunStart ? (_jsx("span", { className: `vac-cont__range-label${inkCls}`, children: seal })) : null }));
}
const VacationDayCell = memo(function VacationDayCell({ kind, attendance, kindColors, isWeekendEmpty, isMonthStart, isSelected, isToday, title, hasBasis, markRunStart, markRunEnd, readOnly, viewable = false, attendanceHoverTip, onAttendanceHover, onAttendanceHoverEnd, onActivate, }) {
    const bg = kind ? kindColors[kind] : undefined;
    const viewOnly = readOnly && viewable && Boolean(kind);
    const interactive = !readOnly || viewOnly;
    const cls = [
        'vac-cont__cell',
        isWeekendEmpty && 'vac-cont__cell--weekend',
        isMonthStart && 'vac-cont__cell--month-start',
        !readOnly && 'vac-cont__cell--editable',
        viewOnly && 'vac-cont__cell--viewable',
        isSelected && 'vac-cont__cell--selected',
        isToday && !kind && 'vac-cont__cell--today',
        attendance && 'vac-cont__cell--attendance',
        attendance?.status === 'late' && 'vac-cont__cell--attendance-late',
        attendance?.status === 'absent' && 'vac-cont__cell--attendance-absent',
        hasBasis && kind && 'vac-cont__cell--has-basis',
        kind && 'vac-cont__cell--marked',
        kind && markRunStart && markRunEnd && 'vac-cont__cell--mark-single',
        kind && markRunStart && !markRunEnd && 'vac-cont__cell--mark-run-start',
        kind && markRunEnd && !markRunStart && 'vac-cont__cell--mark-run-end',
        kind && !markRunStart && !markRunEnd && 'vac-cont__cell--mark-run-mid',
    ]
        .filter(Boolean)
        .join(' ');
    const hoverHandlers = attendance && attendanceHoverTip ? {
        onMouseEnter: (e) => onAttendanceHover?.(e, attendanceHoverTip),
        onMouseLeave: () => onAttendanceHoverEnd?.(),
    } : {};
    const markVisual = kind && bg
        ? _jsx(AbsenceMarkVisual, { kind: kind, color: bg, markRunStart: markRunStart, markRunEnd: markRunEnd })
        : null;
    const overlays = (_jsxs(_Fragment, { children: [markVisual, attendance ? _jsx("span", { className: "vac-cont__attendance-dot", "aria-hidden": true }) : null, hasBasis && kind ? _jsx(BasisPin, {}) : null] }));
    if (!interactive) {
        return (_jsx("td", { role: "gridcell", title: title, className: cls, ...hoverHandlers, children: overlays }));
    }
    return (_jsxs("td", { role: "gridcell", className: cls, ...hoverHandlers, children: [_jsx("button", { type: "button", className: "vac-cont__cell-btn", title: title, "aria-label": title, onClick: (e) => onActivate?.(e) }), overlays] }));
});
function padStyle(px) {
    return { width: px, minWidth: px, maxWidth: px, padding: 0, border: 'none' };
}
function VirtualColPad({ width, as }) {
    if (width <= 0)
        return null;
    const style = padStyle(width);
    if (as === 'th')
        return _jsx("th", { className: "vac-cont__virtual-pad", style: style, "aria-hidden": true });
    return _jsx("td", { className: "vac-cont__virtual-pad", style: style, "aria-hidden": true });
}
function renderMonthHeaderSegs(virtualCols, colSegs) {
    const nodes = [];
    let i = 0;
    while (i < virtualCols.length) {
        const v = virtualCols[i];
        const seg = colSegs[v.index];
        if (seg.type === 'monthSum') {
            nodes.push(_jsx("th", { className: "vac-cont__month-sum-head", rowSpan: 3, scope: "col", children: _jsx("span", { className: "vac-cont__head-vertical", children: "\u041A\u043E\u043B-\u0432\u043E" }) }, `ms-h-${seg.monthIndex}`));
            i += 1;
            continue;
        }
        let span = 1;
        while (i + span < virtualCols.length) {
            const nextV = virtualCols[i + span];
            const nextSeg = colSegs[nextV.index];
            if (nextSeg.type !== 'day' || nextSeg.monthIndex !== seg.monthIndex)
                break;
            if (nextV.index !== v.index + span)
                break;
            span += 1;
        }
        nodes.push(_jsx("th", { scope: "colgroup", colSpan: span, "data-vac-month-index": seg.monthIndex, className: [
                'vac-cont__month-title',
                seg.monthIndex > 0 && 'vac-cont__month-title--boundary',
            ].filter(Boolean).join(' '), children: VACATION_MONTH_NAMES[seg.monthIndex] }, `mh-${seg.monthIndex}-${v.index}`));
        i += span;
    }
    return nodes;
}
const VacationBodyRow = memo(function VacationBodyRow({ emp, userIndex, year, marks, attendanceMarks, attendanceWorkday, kindColors, dayColumns, dayMeta, colSegs, virtualCols, padLeft, padRight, userStats, kindYearCounts, runEdgesByUser, payroll, basisByCell, selectedKey, todayInfo, readOnlyDays, markedCellsClickable, onEmployeeClick, onDayCellClick, onAttendanceHover, onAttendanceHoverEnd, }) {
    const st = userStats.get(emp.id);
    const yearTotal = st?.year ?? 0;
    const counts = kindYearCounts?.get(emp.id);
    const annualDays = counts?.annual ?? 0;
    const sickDays = counts?.sick ?? 0;
    const pr = payroll;
    const vacPay = pr?.visible ? vacationPayTotal(annualDays, pr.params) : 0;
    const sickPay = pr?.visible ? sickPayTotal(sickDays, pr.params) : 0;
    const runEdges = runEdgesByUser.get(emp.id);
    const periodHint = emp.plannedPeriodNote?.trim()
        ? `Период (из файла): ${emp.plannedPeriodNote}`
        : undefined;
    const nameTitle = [
        periodHint,
        onEmployeeClick
            ? !readOnlyDays
                ? 'ФИО — карточка с днями; ячейка даты — выбор вида отсутствия'
                : 'Нажмите, чтобы открыть список дней'
            : null,
    ]
        .filter(Boolean)
        .join(' · ');
    const rowClass = [
        'vac-cont__body-row',
        emp.systemOnly && 'vac-cont__body-row--system-only',
    ].filter(Boolean).join(' ');
    const rowReadOnly = readOnlyDays || !!emp.systemOnly;
    const systemHint = emp.systemOnly
        ? 'Сотрудник зарегистрирован в системе. Чтобы отмечать дни — добавьте его в график вручную (меню «Действия» → «Добавить сотрудника») или попросите сотрудника подать заявку.'
        : null;
    const nameTitleFinal = [nameTitle, systemHint].filter(Boolean).join(' · ') || undefined;
    const displayRowNo = userIndex + 1;
    return (_jsxs("tr", { className: rowClass, children: [_jsx("td", { className: "vac-cont__sticky-num", children: displayRowNo }), _jsx("td", { className: "vac-cont__sticky-name vac-cont__name-cell", children: onEmployeeClick && !emp.systemOnly ? (_jsx("button", { type: "button", className: "vac-cont__name-btn", title: nameTitleFinal, onClick: () => onEmployeeClick(emp.id), children: emp.label })) : (_jsx("span", { className: emp.systemOnly ? 'vac-cont__name-system' : undefined, title: nameTitleFinal, children: emp.label })) }), _jsx(VirtualColPad, { width: padLeft, as: "td" }), virtualCols.map((v) => {
                const seg = colSegs[v.index];
                if (seg.type === 'monthSum') {
                    return (_jsx("td", { className: "vac-cont__sum-month", title: `Дней отсутствия в ${VACATION_MONTH_NAMES[seg.monthIndex]}`, children: st?.months[seg.monthIndex] ?? 0 }, `ms-${emp.id}-${seg.monthIndex}`));
                }
                const col = dayColumns[seg.dayColIndex];
                const key = vacationCellKey(emp.id, year, col.monthIndex, col.day);
                const cell = marks[key];
                const kind = cell?.kind;
                const meta = dayMeta[col.colIndex];
                const attendance = emp.isPartner ? undefined : attendanceMarks[key];
                const dateStr = cellDateLabel(year, col.monthIndex, col.day);
                const attendanceHoverTip = attendance
                    ? attendance.status === 'late'
                        ? vacationAttendanceLateTooltip(attendance.firstEventTime, attendanceWorkday)
                            ?? (attendance.firstEventTime ? `Опоздание (приход ${attendance.firstEventTime})` : 'Опоздание')
                        : [
                            'Отсутствие — нет отметки прохода',
                            attendance.explanationText ? `Объяснение: ${attendance.explanationText}` : null,
                        ].filter(Boolean).join(' · ')
                    : null;
                const attendanceLabel = attendance
                    ? attendance.status === 'late'
                        ? 'Опоздание'
                        : 'Отсутствие'
                    : null;
                const tipParts = [
                    kind
                        ? `${dateStr} · ${emp.label} · ${vacationKindHumanLabel(kind)}`
                        : `${dateStr} · ${emp.label}`,
                    attendanceLabel,
                    attendance?.explanationText ? `Объяснение: ${attendance.explanationText}` : null,
                    basisSummaryForTooltip(basisByCell[key]),
                    emp.systemOnly ? 'Не в графике' : null,
                ].filter(Boolean);
                const tip = tipParts.join('\n');
                const hasBasis = Boolean(kind && hasVacationAbsenceBasisContent(basisByCell[key]));
                const isSelected = selectedKey === key;
                const isToday = todayInfo?.monthIndex === col.monthIndex && todayInfo?.day === col.day;
                const markRunStart = Boolean(kind && runEdges?.runStartKeys.has(key));
                const markRunEnd = Boolean(kind && runEdges?.runEndKeys.has(key));
                const viewable = markedCellsClickable && !emp.systemOnly && Boolean(kind);
                const isWeekendEmpty = meta.wknd && !kind;
                const needsRichCell = Boolean(kind
                    || attendance
                    || isSelected
                    || isToday
                    || !rowReadOnly
                    || viewable);
                if (!needsRichCell) {
                    const emptyCls = [
                        'vac-cont__cell',
                        isWeekendEmpty && 'vac-cont__cell--weekend',
                        meta.monthStart && 'vac-cont__cell--month-start',
                    ].filter(Boolean).join(' ');
                    return (_jsx("td", { role: "gridcell", title: tip, className: emptyCls }, key));
                }
                return (_jsx(VacationDayCell, { kind: kind, attendance: attendance, attendanceHoverTip: attendanceHoverTip, onAttendanceHover: onAttendanceHover, onAttendanceHoverEnd: onAttendanceHoverEnd, kindColors: kindColors, isWeekendEmpty: isWeekendEmpty, isMonthStart: meta.monthStart, isSelected: isSelected, isToday: isToday, title: tip, hasBasis: hasBasis, markRunStart: markRunStart, markRunEnd: markRunEnd, readOnly: rowReadOnly, viewable: viewable, onActivate: (e) => onDayCellClick?.({
                        employeeId: emp.id,
                        monthIndex: col.monthIndex,
                        day: col.day,
                        clientX: e.clientX,
                        clientY: e.clientY,
                    }) }, key));
            }), _jsx(VirtualColPad, { width: padRight, as: "td" }), payroll?.visible && (_jsxs(_Fragment, { children: [_jsx("td", { className: "vac-cont__pr-cell vac-cont__pr-cell--vac-d", title: "\u0414\u043D\u0435\u0439 \u0435\u0436\u0435\u0433\u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u043F\u0443\u0441\u043A\u0430 \u0432 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u0437\u0430 \u0433\u043E\u0434", children: annualDays }), _jsx("td", { className: "vac-cont__pr-cell vac-cont__pr-cell--money vac-cont__pr-cell--vac-m", title: "\u041E\u0446\u0435\u043D\u043A\u0430 \u043E\u0442\u043F\u0443\u0441\u043A\u043D\u044B\u0445 \u0437\u0430 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0435 \u0434\u043D\u0438 (\u0441\u043C. \u043F\u0430\u043D\u0435\u043B\u044C \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432)", children: formatPayrollMoney(vacPay) }), _jsx("td", { className: "vac-cont__pr-cell vac-cont__pr-cell--sick vac-cont__pr-cell--sick-d", title: "\u0414\u043D\u0435\u0439 \u0431\u043E\u043B\u0435\u0437\u043D\u0438 \u0432 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u0437\u0430 \u0433\u043E\u0434", children: sickDays }), _jsx("td", { className: "vac-cont__pr-cell vac-cont__pr-cell--money vac-cont__pr-cell--sick vac-cont__pr-cell--sick-m", title: "\u041E\u0446\u0435\u043D\u043A\u0430 \u0432\u044B\u043F\u043B\u0430\u0442 \u043F\u043E \u0431\u043E\u043B\u044C\u043D\u0438\u0447\u043D\u043E\u043C\u0443 (\u0443\u043F\u0440\u043E\u0449\u0451\u043D\u043D\u043E)", children: formatPayrollMoney(sickPay) })] })), _jsx("td", { className: "vac-cont__sum-year", title: "\u0412\u0441\u0435\u0433\u043E \u0434\u043D\u0435\u0439 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F \u0437\u0430 \u0433\u043E\u0434", children: yearTotal })] }));
});
export function VacationContinuousTable({ year, employees, marks, attendanceMarks = {}, attendanceWorkday = DEFAULT_WORKDAY_SETTINGS, legendItems = vacationUiLegendFallback(), onEmployeeClick, emptyStateImportHint = false, readOnlyDays = true, onDayCellClick, selectedKey, todayYear, payroll, basisByCell = {}, markedCellsClickable = false, showAttendanceLegend = false, }) {
    const [attendanceFloatTip, setAttendanceFloatTip] = useState(null);
    const showAttendanceFloatTip = useCallback((e, text) => {
        setAttendanceFloatTip({ text, x: e.clientX, y: e.clientY });
    }, []);
    const hideAttendanceFloatTip = useCallback(() => setAttendanceFloatTip(null), []);
    const kindColors = useMemo(() => {
        const m = { ...VACATION_KIND_COLORS };
        for (const it of legendItems) {
            m[it.kind] = it.color;
        }
        return m;
    }, [legendItems]);
    const dayColumns = useMemo(() => vacationYearDayColumns(year), [year]);
    const colSegs = useMemo(() => buildVacColSegs(dayColumns), [dayColumns]);
    const dayMeta = useMemo(() => dayColumns.map((col) => ({
        wknd: vacationDayIsWeekendRu(year, col.monthIndex, col.day),
        monthStart: col.day === 1 && col.monthIndex > 0,
    })), [dayColumns, year]);
    const employeeIdSet = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);
    const userStats = useMemo(() => buildUserMarkStats(marks, year, employeeIdSet), [marks, year, employeeIdSet]);
    const kindYearCounts = useMemo(() => (payroll?.visible ? buildUserKindYearCounts(marks, year, employeeIdSet) : null), [marks, year, employeeIdSet, payroll?.visible]);
    const todayInfo = useMemo(() => {
        if (todayYear !== year)
            return null;
        const now = new Date();
        return { monthIndex: now.getMonth(), day: now.getDate() };
    }, [todayYear, year]);
    const runEdgesByUser = useMemo(() => {
        const m = new Map();
        for (const emp of employees) {
            m.set(emp.id, vacationRowMarkRunEdges(emp.id, year, dayColumns, marks));
        }
        return m;
    }, [employees, year, dayColumns, marks]);
    const scrollContainerRef = useRef(null);
    const tableRef = useRef(null);
    const didScrollToMonthRef = useRef(false);
    const [dayW, setDayW] = useState(() => remToPx(1.7));
    const [monthSumW, setMonthSumW] = useState(() => remToPx(2.5));
    const [rowH, setRowH] = useState(() => remToPx(1.95));
    const [stickyLeftW, setStickyLeftW] = useState(() => remToPx(2.25 + 14));
    useLayoutEffect(() => {
        const el = tableRef.current;
        if (!el)
            return;
        const measure = () => {
            const dayEl = el.querySelector('.vac-cont__th-day, .vac-cont__cell');
            const monthSumEl = el.querySelector('.vac-cont__month-sum-head, .vac-cont__sum-month');
            const rowEl = el.querySelector('.vac-cont__body-row');
            setDayW(dayEl && dayEl.offsetWidth > 0
                ? dayEl.offsetWidth
                : readCssLenPx(el, '--vac-day-w', 1.7));
            setMonthSumW(monthSumEl && monthSumEl.offsetWidth > 0
                ? monthSumEl.offsetWidth
                : readCssLenPx(el, '--vac-month-sum-w', 2.5));
            setRowH(rowEl && rowEl.offsetHeight > 0
                ? rowEl.offsetHeight
                : readCssLenPx(el, '--vac-row-h', 1.95));
            const corner = el.querySelector('.vac-cont__sticky-corner');
            if (corner && corner.offsetWidth > 0)
                setStickyLeftW(corner.offsetWidth);
            else
                setStickyLeftW(readCssLenPx(el, '--vac-num-w', 2.25) + readCssLenPx(el, '--vac-name-w', 14));
        };
        measure();
        if (typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [year, employees.length, payroll?.visible]);
    const colVirtualizer = useVirtualizer({
        horizontal: true,
        count: colSegs.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => (colSegs[index]?.type === 'monthSum' ? monthSumW : dayW),
        overscan: VAC_COL_OVERSCAN,
        scrollPaddingStart: stickyLeftW,
    });
    const rowVirtualizer = useVirtualizer({
        count: employees.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => rowH,
        overscan: VAC_ROW_OVERSCAN,
    });
    useLayoutEffect(() => {
        colVirtualizer.measure();
    }, [colVirtualizer, dayW, monthSumW, colSegs.length]);
    useLayoutEffect(() => {
        rowVirtualizer.measure();
    }, [rowVirtualizer, rowH, employees.length]);
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el)
            return;
        let stopTimer;
        const onScroll = () => {
            if (!el.classList.contains('vac-cont__scroll--scrolling'))
                el.classList.add('vac-cont__scroll--scrolling');
            if (stopTimer != null)
                window.clearTimeout(stopTimer);
            stopTimer = window.setTimeout(() => {
                el.classList.remove('vac-cont__scroll--scrolling');
                stopTimer = undefined;
            }, 140);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
            if (stopTimer != null)
                window.clearTimeout(stopTimer);
            el.classList.remove('vac-cont__scroll--scrolling');
        };
    }, [employees.length]);
    useLayoutEffect(() => {
        didScrollToMonthRef.current = false;
    }, [year]);
    useLayoutEffect(() => {
        if (didScrollToMonthRef.current || employees.length === 0)
            return;
        const now = new Date();
        if (year !== now.getFullYear())
            return;
        const month = now.getMonth();
        const idx = colSegs.findIndex((s) => s.type === 'day' && s.monthIndex === month && s.day === 1);
        if (idx < 0)
            return;
        didScrollToMonthRef.current = true;
        colVirtualizer.scrollToIndex(idx, { align: 'start' });
        requestAnimationFrame(() => {
            colVirtualizer.scrollToIndex(idx, { align: 'start' });
        });
    }, [year, employees.length, colSegs, colVirtualizer, dayW, monthSumW, stickyLeftW]);
    const virtualCols = colVirtualizer.getVirtualItems();
    const padLeft = virtualCols.length > 0 ? virtualCols[0].start : 0;
    const padRight = virtualCols.length > 0
        ? colVirtualizer.getTotalSize() - virtualCols[virtualCols.length - 1].end
        : 0;
    const virtualRows = rowVirtualizer.getVirtualItems();
    const padTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const padBottom = virtualRows.length > 0
        ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
        : 0;
    const bodyColSpan = 2
        + (padLeft > 0 ? 1 : 0)
        + virtualCols.length
        + (padRight > 0 ? 1 : 0)
        + (payroll?.visible ? 4 : 0)
        + 1;
    const legendStrip = (_jsxs("div", { className: "vac-cont__legend-wrap", children: [_jsx("span", { className: "vac-cont__legend-cap", children: "\u041A\u043B\u044E\u0447 \u043A \u043E\u0442\u043C\u0435\u0442\u043A\u0430\u043C" }), _jsxs("ul", { className: "vac-cont__legend", "aria-label": "\u0412\u0438\u0434\u044B \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F \u0438 \u043F\u043E\u0441\u0435\u0449\u0430\u0435\u043C\u043E\u0441\u0442\u044C", children: [legendItems.map((item) => (_jsxs("li", { className: "vac-cont__legend-item", children: [_jsx("span", { className: `vac-cont__legend-seal${vacationKindSealUsesDarkInk(item.kind) ? ' vac-cont__seal-ink--dark' : ''}`, style: { backgroundColor: item.color }, "aria-hidden": true, children: item.seal }), _jsx("span", { className: "vac-cont__legend-label", children: item.label })] }, `${item.kind}-${item.kindCode}`))), showAttendanceLegend ? (_jsxs(_Fragment, { children: [_jsxs("li", { className: "vac-cont__legend-item vac-cont__legend-item--attendance", children: [_jsx("span", { className: "vac-cont__legend-seal vac-cont__legend-seal--icon", "aria-hidden": true, children: "\u23F1" }), _jsx("span", { className: "vac-cont__legend-label", children: "\u041E\u043F\u043E\u0437\u0434\u0430\u043D\u0438\u0435" })] }), _jsxs("li", { className: "vac-cont__legend-item vac-cont__legend-item--attendance", children: [_jsx("span", { className: "vac-cont__legend-seal vac-cont__legend-seal--icon", "aria-hidden": true, children: "\u2715" }), _jsx("span", { className: "vac-cont__legend-label", children: "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435" })] })] })) : null] })] }));
    if (employees.length === 0) {
        return (_jsxs("div", { className: "vac-cont vac-cont--dense", children: [legendStrip, _jsx("p", { className: "vac-cont__empty", children: "\u0417\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0433\u043E\u0434 \u0433\u0440\u0430\u0444\u0438\u043A \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442." }), emptyStateImportHint && (_jsx("p", { className: "vac-cont__empty-hint", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438 \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0432 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u0430\u044F\u0432\u043A\u0438. \u041F\u043E\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0437\u0430\u044F\u0432\u043A\u0443 \u2014 \u043A\u043D\u043E\u043F\u043A\u0430 \u00AB+\u00BB \u0432 \u0448\u0430\u043F\u043A\u0435." }))] }));
    }
    return (_jsxs("div", { className: "vac-cont vac-cont--dense", children: [legendStrip, _jsx("div", { className: "vac-cont__scroll", ref: scrollContainerRef, children: _jsxs("table", { className: "vac-cont__table", role: "grid", ref: tableRef, children: [_jsxs("thead", { children: [_jsxs("tr", { children: [_jsx("th", { className: "vac-cont__sticky-corner", colSpan: 2, scope: "colgroup", children: year }), _jsx(VirtualColPad, { width: padLeft, as: "th" }), renderMonthHeaderSegs(virtualCols, colSegs), _jsx(VirtualColPad, { width: padRight, as: "th" }), payroll?.visible && (_jsxs(_Fragment, { children: [_jsx("th", { className: "vac-cont__pr-head vac-cont__pr-head--vac vac-cont__pr-head--vac-d", rowSpan: 3, scope: "col", title: "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0435 \u0434\u043D\u0438 \u0441 \u0432\u0438\u0434\u043E\u043C \u00AB\u0435\u0436\u0435\u0433\u043E\u0434\u043D\u044B\u0439 \u043E\u0442\u043F\u0443\u0441\u043A\u00BB \u0437\u0430 \u0433\u043E\u0434", children: _jsx("span", { className: "vac-cont__head-vertical", children: "\u041E\u0442\u043F. \u0434\u043D." }) }), _jsx("th", { className: "vac-cont__pr-head vac-cont__pr-head--vac vac-cont__pr-head--money vac-cont__pr-head--vac-m", rowSpan: 3, scope: "col", title: "\u041E\u0446\u0435\u043D\u043A\u0430: \u0434\u043D\u0438 \u043E\u0442\u043F\u0443\u0441\u043A\u0430 \u00D7 (\u0437\u0430\u0440\u043F\u043B\u0430\u0442\u0430/29,3) \u00D7 \u043A\u043E\u044D\u0444\u0444. \u043E\u0442\u043F\u0443\u0441\u043A\u0430", children: _jsx("span", { className: "vac-cont__head-vertical", children: "\u041E\u0442\u043F. \u20BD" }) }), _jsx("th", { className: "vac-cont__pr-head vac-cont__pr-head--sick vac-cont__pr-head--sick-d", rowSpan: 3, scope: "col", title: "\u0414\u043D\u0438 \u0441 \u0432\u0438\u0434\u043E\u043C \u00AB\u0431\u043E\u043B\u0435\u0437\u043D\u044C\u00BB \u0437\u0430 \u0433\u043E\u0434", children: _jsx("span", { className: "vac-cont__head-vertical", children: "\u0411\u043E\u043B. \u0434\u043D." }) }), _jsx("th", { className: "vac-cont__pr-head vac-cont__pr-head--sick vac-cont__pr-head--money vac-cont__pr-head--sick-m", rowSpan: 3, scope: "col", title: "\u041E\u0446\u0435\u043D\u043A\u0430: \u0434\u043D\u0438 \u0431\u043E\u043B\u0435\u0437\u043D\u0438 \u00D7 (\u0437\u0430\u0440\u043F\u043B\u0430\u0442\u0430/29,3) \u00D7 \u0441\u0442\u0430\u0432\u043A\u0430 \u0431\u043E\u043B\u044C\u043D\u0438\u0447\u043D\u043E\u0433\u043E", children: _jsx("span", { className: "vac-cont__head-vertical", children: "\u0411\u043E\u043B. \u20BD" }) })] })), _jsx("th", { className: "vac-cont__year-sum-head", rowSpan: 3, scope: "col", children: _jsx("span", { className: "vac-cont__head-vertical vac-cont__head-vertical--wide", children: "\u0412\u0441\u0435\u0433\u043E" }) })] }), _jsxs("tr", { children: [_jsx("th", { className: "vac-cont__sticky-num", rowSpan: 2, scope: "col", children: "\u2116" }), _jsx("th", { className: "vac-cont__sticky-name", rowSpan: 2, scope: "col", children: "\u0424\u0418\u041E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430" }), _jsx(VirtualColPad, { width: padLeft, as: "th" }), virtualCols.map((v) => {
                                            const seg = colSegs[v.index];
                                            if (seg.type === 'monthSum')
                                                return null;
                                            const col = dayColumns[seg.dayColIndex];
                                            const meta = dayMeta[col.colIndex];
                                            const isToday = todayInfo?.monthIndex === col.monthIndex && todayInfo?.day === col.day;
                                            return (_jsx("th", { scope: "col", className: [
                                                    'vac-cont__th-day',
                                                    meta.wknd && 'vac-cont__th-day--weekend',
                                                    meta.monthStart && 'vac-cont__th-day--month-start',
                                                    isToday && 'vac-cont__th-day--today',
                                                ].filter(Boolean).join(' '), children: col.day }, `d-${col.colIndex}`));
                                        }), _jsx(VirtualColPad, { width: padRight, as: "th" })] }), _jsxs("tr", { children: [_jsx(VirtualColPad, { width: padLeft, as: "th" }), virtualCols.map((v) => {
                                            const seg = colSegs[v.index];
                                            if (seg.type === 'monthSum')
                                                return null;
                                            const col = dayColumns[seg.dayColIndex];
                                            const meta = dayMeta[col.colIndex];
                                            return (_jsx("th", { scope: "col", className: [
                                                    'vac-cont__th-wd',
                                                    meta.wknd && 'vac-cont__th-wd--weekend',
                                                    meta.monthStart && 'vac-cont__th-wd--month-start',
                                                ].filter(Boolean).join(' '), children: vacationWeekdayShortRu(year, col.monthIndex, col.day) }, `w-${col.colIndex}`));
                                        }), _jsx(VirtualColPad, { width: padRight, as: "th" })] })] }), _jsxs("tbody", { children: [padTop > 0 ? (_jsx("tr", { className: "vac-cont__virtual-spacer", "aria-hidden": true, children: _jsx("td", { colSpan: bodyColSpan, style: { height: padTop, padding: 0, border: 'none', lineHeight: 0 } }) })) : null, virtualRows.map((vRow) => {
                                    const emp = employees[vRow.index];
                                    return (_jsx(VacationBodyRow, { emp: emp, userIndex: vRow.index, year: year, marks: marks, attendanceMarks: attendanceMarks, attendanceWorkday: attendanceWorkday, kindColors: kindColors, dayColumns: dayColumns, dayMeta: dayMeta, colSegs: colSegs, virtualCols: virtualCols, padLeft: padLeft, padRight: padRight, userStats: userStats, kindYearCounts: kindYearCounts, runEdgesByUser: runEdgesByUser, payroll: payroll, basisByCell: basisByCell, selectedKey: selectedKey, todayInfo: todayInfo, readOnlyDays: readOnlyDays, markedCellsClickable: markedCellsClickable, onEmployeeClick: onEmployeeClick, onDayCellClick: onDayCellClick, onAttendanceHover: showAttendanceFloatTip, onAttendanceHoverEnd: hideAttendanceFloatTip }, emp.id));
                                }), padBottom > 0 ? (_jsx("tr", { className: "vac-cont__virtual-spacer", "aria-hidden": true, children: _jsx("td", { colSpan: bodyColSpan, style: { height: padBottom, padding: 0, border: 'none', lineHeight: 0 } }) })) : null] })] }) }), _jsxs("p", { className: "vac-cont__hint-mini", children: [_jsx("span", { className: "vac-cont__hint-icon", "aria-hidden": true, children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("circle", { cx: "8", cy: "8", r: "6.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M8 7.2V11M8 4.9v.01", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }) }), _jsxs("span", { children: [_jsx("b", { children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435." }), " \u041D\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430 \u043E\u0442\u043C\u0435\u0442\u043A\u0443 \u0434\u043D\u044F \u2014 \u0434\u0430\u0442\u0430, \u0424\u0418\u041E \u0438 \u0432\u0438\u0434 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F.", showAttendanceLegend && ' По опозданию и отсутствию — время события.', markedCellsClickable && ' Клик по отметке — документы-основания периода.', !readOnlyDays && ' В режиме редактирования клик по дню меняет вид или снимает отметку.', ' ', "\u0421\u0442\u043E\u043B\u0431\u0446\u044B \u00AB\u041A\u043E\u043B-\u0432\u043E\u00BB \u0438 \u00AB\u0412\u0441\u0435\u0433\u043E\u00BB \u2014 \u0447\u0438\u0441\u043B\u043E \u0434\u043D\u0435\u0439 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F \u0437\u0430 \u043C\u0435\u0441\u044F\u0446 \u0438 \u0437\u0430 \u0433\u043E\u0434.", payroll?.visible &&
                                ' Колонки «Отп.» / «Бол.» — ориентировочный расчёт (не замена бухучёту).'] })] }), attendanceFloatTip && typeof document !== 'undefined' ? createPortal(_jsx("div", { className: "vac-cont__attendance-float-tip", role: "tooltip", style: {
                    left: attendanceFloatTip.x,
                    top: attendanceFloatTip.y,
                }, children: attendanceFloatTip.text }), document.body) : null] }));
}
