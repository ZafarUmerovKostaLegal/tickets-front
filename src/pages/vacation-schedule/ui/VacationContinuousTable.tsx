import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { buildUserKindYearCounts, formatPayrollMoney, sickPayTotal, vacationPayTotal, type VacationPayrollParams, } from '../lib/vacationPayrollFormulas';
import { basisSummaryForTooltip, hasVacationAbsenceBasisContent, type VacationAbsenceBasis } from '../lib/vacationAbsenceBasisStorage';
import { VACATION_KIND_COLORS, VACATION_MONTH_NAMES, parseVacationCellKey, vacationCellKey, vacationDayIsWeekendRu, vacationAttendanceLateTooltip, vacationKindHumanLabel, vacationKindSeal, vacationKindSealUsesDarkInk, vacationRowMarkRunEdges, vacationUiLegendFallback, vacationWeekdayShortRu, vacationYearDayColumns, type VacationAbsenceKind, type VacationAttendanceMarkCell, type VacationAttendanceMarksState, type VacationAttendanceWorkday, type VacationMarksState, type VacationScheduleEmployeeRow, type VacationUiLegendItem, type VacationYearDayColumn, } from '../lib/vacationScheduleModel';
import { DEFAULT_WORKDAY_SETTINGS } from '@shared/lib/attendanceSettings';
import {
    buildVacColSegs,
    readCssLenPx,
    remToPx,
    VAC_COL_OVERSCAN,
    VAC_ROW_OVERSCAN,
    type VacColSeg,
} from './vacationTableVirtual';
import './VacationContinuousTable.css';

function buildUserMarkStats(marks: VacationMarksState, year: number, employeeIds: Set<number>): Map<number, {
    months: number[];
    year: number;
}> {
    const stats = new Map<number, {
        months: number[];
        year: number;
    }>();
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
function cellDateLabel(year: number, monthIndex: number, day: number): string {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${d}.${m}.${year}`;
}

type DayMeta = { wknd: boolean; monthStart: boolean };

type VacationDayCellProps = {
    kind: VacationAbsenceKind | undefined;
    attendance: VacationAttendanceMarkCell | undefined;
    kindColors: Record<VacationAbsenceKind, string>;
    isWeekendEmpty: boolean;
    isMonthStart: boolean;
    isSelected: boolean;
    isToday: boolean;
    title: string;
    hasBasis: boolean;
    markRunStart: boolean;
    markRunEnd: boolean;
    readOnly: boolean;

    viewable?: boolean;
    attendanceHoverTip?: string | null;
    onAttendanceHover?: (e: MouseEvent, text: string) => void;
    onAttendanceHoverEnd?: () => void;
    onActivate?: (e: MouseEvent) => void;
};
function BasisPin() {
    return (<span className="vac-cont__basis-pin" aria-hidden>
        <svg className="vac-cont__basis-pin-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 3.5V3a2 2 0 114 0v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M6 3.5h4V8a2 2 0 01-1.25 1.86L8 10.25V14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    </span>);
}
function AbsenceMarkVisual({
    kind,
    color,
    markRunStart,
    markRunEnd,
}: {
    kind: VacationAbsenceKind;
    color: string;
    markRunStart: boolean;
    markRunEnd: boolean;
}) {
    const seal = vacationKindSeal(kind);
    const darkInk = vacationKindSealUsesDarkInk(kind);
    const inkCls = darkInk ? ' vac-cont__seal-ink--dark' : '';
    const single = markRunStart && markRunEnd;
    if (single) {
        return (
            <span
                className={`vac-cont__seal${inkCls}`}
                style={{ backgroundColor: color }}
                aria-hidden
            >
                {seal}
            </span>
        );
    }
    const pos = markRunStart ? 'start' : markRunEnd ? 'end' : 'mid';
    return (
        <span
            className={`vac-cont__range-bar vac-cont__range-bar--${pos}`}
            style={{ backgroundColor: color }}
            aria-hidden
        >
            {markRunStart ? (
                <span className={`vac-cont__range-label${inkCls}`}>{seal}</span>
            ) : null}
        </span>
    );
}
const VacationDayCell = memo(function VacationDayCell({ kind, attendance, kindColors, isWeekendEmpty, isMonthStart, isSelected, isToday, title, hasBasis, markRunStart, markRunEnd, readOnly, viewable = false, attendanceHoverTip, onAttendanceHover, onAttendanceHoverEnd, onActivate, }: VacationDayCellProps) {
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
        onMouseEnter: (e: MouseEvent) => onAttendanceHover?.(e, attendanceHoverTip),
        onMouseLeave: () => onAttendanceHoverEnd?.(),
    } : {};
    const markVisual = kind && bg
        ? <AbsenceMarkVisual kind={kind} color={bg} markRunStart={markRunStart} markRunEnd={markRunEnd} />
        : null;
    const overlays = (
        <>
            {markVisual}
            {attendance ? <span className="vac-cont__attendance-dot" aria-hidden /> : null}
            {hasBasis && kind ? <BasisPin /> : null}
        </>
    );
    if (!interactive) {
        return (<td role="gridcell" title={title} className={cls} {...hoverHandlers}>
            {overlays}
        </td>);
    }
    return (<td role="gridcell" className={cls} {...hoverHandlers}>
        <button type="button" className="vac-cont__cell-btn" title={title} aria-label={title} onClick={(e) => onActivate?.(e)} />
        {overlays}
    </td>);
});

function padStyle(px: number): CSSProperties {
    return { width: px, minWidth: px, maxWidth: px, padding: 0, border: 'none' };
}

function VirtualColPad({ width, as }: { width: number; as: 'th' | 'td' }) {
    if (width <= 0)
        return null;
    const style = padStyle(width);
    if (as === 'th')
        return <th className="vac-cont__virtual-pad" style={style} aria-hidden />;
    return <td className="vac-cont__virtual-pad" style={style} aria-hidden />;
}

function renderMonthHeaderSegs(virtualCols: VirtualItem[], colSegs: VacColSeg[]): ReactNode[] {
    const nodes: ReactNode[] = [];
    let i = 0;
    while (i < virtualCols.length) {
        const v = virtualCols[i]!;
        const seg = colSegs[v.index]!;
        if (seg.type === 'monthSum') {
            nodes.push(
                <th key={`ms-h-${seg.monthIndex}`} className="vac-cont__month-sum-head" rowSpan={3} scope="col">
                    <span className="vac-cont__head-vertical">Кол-во</span>
                </th>,
            );
            i += 1;
            continue;
        }
        let span = 1;
        while (i + span < virtualCols.length) {
            const nextV = virtualCols[i + span]!;
            const nextSeg = colSegs[nextV.index]!;
            if (nextSeg.type !== 'day' || nextSeg.monthIndex !== seg.monthIndex)
                break;
            if (nextV.index !== v.index + span)
                break;
            span += 1;
        }
        nodes.push(
            <th
                key={`mh-${seg.monthIndex}-${v.index}`}
                scope="colgroup"
                colSpan={span}
                data-vac-month-index={seg.monthIndex}
                className={[
                    'vac-cont__month-title',
                    seg.monthIndex > 0 && 'vac-cont__month-title--boundary',
                ].filter(Boolean).join(' ')}
            >
                {VACATION_MONTH_NAMES[seg.monthIndex]}
            </th>,
        );
        i += span;
    }
    return nodes;
}

type BodyRowProps = {
    emp: VacationScheduleEmployeeRow;
    userIndex: number;
    year: number;
    marks: VacationMarksState;
    attendanceMarks: VacationAttendanceMarksState;
    attendanceWorkday: VacationAttendanceWorkday;
    kindColors: Record<VacationAbsenceKind, string>;
    dayColumns: VacationYearDayColumn[];
    dayMeta: DayMeta[];
    colSegs: VacColSeg[];
    virtualCols: VirtualItem[];
    padLeft: number;
    padRight: number;
    userStats: Map<number, { months: number[]; year: number }>;
    kindYearCounts: Map<number, Record<VacationAbsenceKind, number>> | null;
    runEdgesByUser: Map<number, { runStartKeys: Set<string>; runEndKeys: Set<string> }>;
    payroll?: VacationContinuousTableProps['payroll'];
    basisByCell: Readonly<Record<string, VacationAbsenceBasis>>;
    selectedKey?: string;
    todayInfo: { monthIndex: number; day: number } | null;
    readOnlyDays: boolean;
    markedCellsClickable: boolean;
    onEmployeeClick?: (employeeId: number) => void;
    onDayCellClick?: VacationContinuousTableProps['onDayCellClick'];
    onAttendanceHover: (e: MouseEvent, text: string) => void;
    onAttendanceHoverEnd: () => void;
};

const VacationBodyRow = memo(function VacationBodyRow({
    emp,
    userIndex,
    year,
    marks,
    attendanceMarks,
    attendanceWorkday,
    kindColors,
    dayColumns,
    dayMeta,
    colSegs,
    virtualCols,
    padLeft,
    padRight,
    userStats,
    kindYearCounts,
    runEdgesByUser,
    payroll,
    basisByCell,
    selectedKey,
    todayInfo,
    readOnlyDays,
    markedCellsClickable,
    onEmployeeClick,
    onDayCellClick,
    onAttendanceHover,
    onAttendanceHoverEnd,
}: BodyRowProps) {
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

    return (
        <tr className={rowClass}>
            <td className="vac-cont__sticky-num">{displayRowNo}</td>
            <td className="vac-cont__sticky-name vac-cont__name-cell">
                {onEmployeeClick && !emp.systemOnly ? (
                    <button type="button" className="vac-cont__name-btn" title={nameTitleFinal} onClick={() => onEmployeeClick(emp.id)}>
                        {emp.label}
                    </button>
                ) : (
                    <span className={emp.systemOnly ? 'vac-cont__name-system' : undefined} title={nameTitleFinal}>{emp.label}</span>
                )}
            </td>
            <VirtualColPad width={padLeft} as="td" />
            {virtualCols.map((v) => {
                const seg = colSegs[v.index]!;
                if (seg.type === 'monthSum') {
                    return (
                        <td
                            key={`ms-${emp.id}-${seg.monthIndex}`}
                            className="vac-cont__sum-month"
                            title={`Дней отсутствия в ${VACATION_MONTH_NAMES[seg.monthIndex]}`}
                        >
                            {st?.months[seg.monthIndex] ?? 0}
                        </td>
                    );
                }
                const col = dayColumns[seg.dayColIndex]!;
                const key = vacationCellKey(emp.id, year, col.monthIndex, col.day);
                const cell = marks[key];
                const kind = cell?.kind;
                const meta = dayMeta[col.colIndex]!;
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

                const needsRichCell = Boolean(
                    kind
                    || attendance
                    || isSelected
                    || isToday
                    || !rowReadOnly
                    || viewable,
                );
                if (!needsRichCell) {
                    const emptyCls = [
                        'vac-cont__cell',
                        isWeekendEmpty && 'vac-cont__cell--weekend',
                        meta.monthStart && 'vac-cont__cell--month-start',
                    ].filter(Boolean).join(' ');
                    return (
                        <td key={key} role="gridcell" title={tip} className={emptyCls} />
                    );
                }

                return (
                    <VacationDayCell
                        key={key}
                        kind={kind}
                        attendance={attendance}
                        attendanceHoverTip={attendanceHoverTip}
                        onAttendanceHover={onAttendanceHover}
                        onAttendanceHoverEnd={onAttendanceHoverEnd}
                        kindColors={kindColors}
                        isWeekendEmpty={isWeekendEmpty}
                        isMonthStart={meta.monthStart}
                        isSelected={isSelected}
                        isToday={isToday}
                        title={tip}
                        hasBasis={hasBasis}
                        markRunStart={markRunStart}
                        markRunEnd={markRunEnd}
                        readOnly={rowReadOnly}
                        viewable={viewable}
                        onActivate={(e) => onDayCellClick?.({
                            employeeId: emp.id,
                            monthIndex: col.monthIndex,
                            day: col.day,
                            clientX: e.clientX,
                            clientY: e.clientY,
                        })}
                    />
                );
            })}
            <VirtualColPad width={padRight} as="td" />
            {payroll?.visible && (
                <>
                    <td className="vac-cont__pr-cell vac-cont__pr-cell--vac-d" title="Дней ежегодного отпуска в графике за год">
                        {annualDays}
                    </td>
                    <td className="vac-cont__pr-cell vac-cont__pr-cell--money vac-cont__pr-cell--vac-m" title="Оценка отпускных за отмеченные дни (см. панель параметров)">
                        {formatPayrollMoney(vacPay)}
                    </td>
                    <td className="vac-cont__pr-cell vac-cont__pr-cell--sick vac-cont__pr-cell--sick-d" title="Дней болезни в графике за год">
                        {sickDays}
                    </td>
                    <td className="vac-cont__pr-cell vac-cont__pr-cell--money vac-cont__pr-cell--sick vac-cont__pr-cell--sick-m" title="Оценка выплат по больничному (упрощённо)">
                        {formatPayrollMoney(sickPay)}
                    </td>
                </>
            )}
            <td className="vac-cont__sum-year" title="Всего дней отсутствия за год">
                {yearTotal}
            </td>
        </tr>
    );
});

export type VacationContinuousTableProps = {
    year: number;
    employees: VacationScheduleEmployeeRow[];
    marks: VacationMarksState;
    attendanceMarks?: VacationAttendanceMarksState;
    attendanceWorkday?: VacationAttendanceWorkday;
    legendItems?: ReadonlyArray<VacationUiLegendItem>;
    onEmployeeClick?: (employeeId: number) => void;
    emptyStateImportHint?: boolean;
    readOnlyDays?: boolean;
    onDayCellClick?: (payload: {
        employeeId: number;
        monthIndex: number;
        day: number;
        clientX: number;
        clientY: number;
    }) => void;
    selectedKey?: string;
    todayYear?: number;
    payroll?: {
        visible: boolean;
        params: VacationPayrollParams;
    };
    basisByCell?: Readonly<Record<string, VacationAbsenceBasis>>;

    markedCellsClickable?: boolean;

    showAttendanceLegend?: boolean;
};

export function VacationContinuousTable({ year, employees, marks, attendanceMarks = {}, attendanceWorkday = DEFAULT_WORKDAY_SETTINGS, legendItems = vacationUiLegendFallback(), onEmployeeClick, emptyStateImportHint = false, readOnlyDays = true, onDayCellClick, selectedKey, todayYear, payroll, basisByCell = {}, markedCellsClickable = false, showAttendanceLegend = false, }: VacationContinuousTableProps) {
    const [attendanceFloatTip, setAttendanceFloatTip] = useState<{ text: string; x: number; y: number } | null>(null);
    const showAttendanceFloatTip = useCallback((e: MouseEvent, text: string) => {
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
        const m = new Map<number, {
            runStartKeys: Set<string>;
            runEndKeys: Set<string>;
        }>();
        for (const emp of employees) {
            m.set(emp.id, vacationRowMarkRunEdges(emp.id, year, dayColumns, marks));
        }
        return m;
    }, [employees, year, dayColumns, marks]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
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
            const dayEl = el.querySelector<HTMLElement>('.vac-cont__th-day, .vac-cont__cell');
            const monthSumEl = el.querySelector<HTMLElement>('.vac-cont__month-sum-head, .vac-cont__sum-month');
            const rowEl = el.querySelector<HTMLElement>('.vac-cont__body-row');
            setDayW(dayEl && dayEl.offsetWidth > 0
                ? dayEl.offsetWidth
                : readCssLenPx(el, '--vac-day-w', 1.7));
            setMonthSumW(monthSumEl && monthSumEl.offsetWidth > 0
                ? monthSumEl.offsetWidth
                : readCssLenPx(el, '--vac-month-sum-w', 2.5));
            setRowH(rowEl && rowEl.offsetHeight > 0
                ? rowEl.offsetHeight
                : readCssLenPx(el, '--vac-row-h', 1.95));
            const corner = el.querySelector<HTMLElement>('.vac-cont__sticky-corner');
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
        let stopTimer: number | undefined;
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
    const padLeft = virtualCols.length > 0 ? virtualCols[0]!.start : 0;
    const padRight = virtualCols.length > 0
        ? colVirtualizer.getTotalSize() - virtualCols[virtualCols.length - 1]!.end
        : 0;

    const virtualRows = rowVirtualizer.getVirtualItems();
    const padTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
    const padBottom = virtualRows.length > 0
        ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
        : 0;

    const bodyColSpan = 2
        + (padLeft > 0 ? 1 : 0)
        + virtualCols.length
        + (padRight > 0 ? 1 : 0)
        + (payroll?.visible ? 4 : 0)
        + 1;

    const legendStrip = (<div className="vac-cont__legend-wrap">
        <span className="vac-cont__legend-cap">Ключ к отметкам</span>
        <ul className="vac-cont__legend" aria-label="Виды отсутствия и посещаемость">
            {legendItems.map((item) => (<li key={`${item.kind}-${item.kindCode}`} className="vac-cont__legend-item">
                <span
                    className={`vac-cont__legend-seal${vacationKindSealUsesDarkInk(item.kind) ? ' vac-cont__seal-ink--dark' : ''}`}
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                >
                    {item.seal}
                </span>
                <span className="vac-cont__legend-label">{item.label}</span>
            </li>))}
            {showAttendanceLegend ? (<>
                <li className="vac-cont__legend-item vac-cont__legend-item--attendance">
                    <span className="vac-cont__legend-seal vac-cont__legend-seal--icon" aria-hidden>⏱</span>
                    <span className="vac-cont__legend-label">Опоздание</span>
                </li>
                <li className="vac-cont__legend-item vac-cont__legend-item--attendance">
                    <span className="vac-cont__legend-seal vac-cont__legend-seal--icon" aria-hidden>✕</span>
                    <span className="vac-cont__legend-label">Отсутствие</span>
                </li>
            </>) : null}
        </ul>
    </div>);

    if (employees.length === 0) {
        return (<div className="vac-cont vac-cont--dense">
            {legendStrip}
            <p className="vac-cont__empty">За выбранный год график пока пуст.</p>
            {emptyStateImportHint && (<p className="vac-cont__empty-hint">
                Сотрудники появляются в графике автоматически после согласования заявки. Подать новую заявку — кнопка «+» в шапке.
            </p>)}
        </div>);
    }

    return (<div className="vac-cont vac-cont--dense">
        {legendStrip}
        <div className="vac-cont__scroll" ref={scrollContainerRef}>
            <table className="vac-cont__table" role="grid" ref={tableRef}>
                <thead>
                    <tr>
                        <th className="vac-cont__sticky-corner" colSpan={2} scope="colgroup">
                            {year}
                        </th>
                        <VirtualColPad width={padLeft} as="th" />
                        {renderMonthHeaderSegs(virtualCols, colSegs)}
                        <VirtualColPad width={padRight} as="th" />
                        {payroll?.visible && (<>
                            <th className="vac-cont__pr-head vac-cont__pr-head--vac vac-cont__pr-head--vac-d" rowSpan={3} scope="col" title="Календарные дни с видом «ежегодный отпуск» за год">
                                <span className="vac-cont__head-vertical">Отп. дн.</span>
                            </th>
                            <th className="vac-cont__pr-head vac-cont__pr-head--vac vac-cont__pr-head--money vac-cont__pr-head--vac-m" rowSpan={3} scope="col" title="Оценка: дни отпуска × (зарплата/29,3) × коэфф. отпуска">
                                <span className="vac-cont__head-vertical">Отп. ₽</span>
                            </th>
                            <th className="vac-cont__pr-head vac-cont__pr-head--sick vac-cont__pr-head--sick-d" rowSpan={3} scope="col" title="Дни с видом «болезнь» за год">
                                <span className="vac-cont__head-vertical">Бол. дн.</span>
                            </th>
                            <th className="vac-cont__pr-head vac-cont__pr-head--sick vac-cont__pr-head--money vac-cont__pr-head--sick-m" rowSpan={3} scope="col" title="Оценка: дни болезни × (зарплата/29,3) × ставка больничного">
                                <span className="vac-cont__head-vertical">Бол. ₽</span>
                            </th>
                        </>)}
                        <th className="vac-cont__year-sum-head" rowSpan={3} scope="col">
                            <span className="vac-cont__head-vertical vac-cont__head-vertical--wide">Всего</span>
                        </th>
                    </tr>
                    <tr>
                        <th className="vac-cont__sticky-num" rowSpan={2} scope="col">
                            №
                        </th>
                        <th className="vac-cont__sticky-name" rowSpan={2} scope="col">
                            ФИО сотрудника
                        </th>
                        <VirtualColPad width={padLeft} as="th" />
                        {virtualCols.map((v) => {
                            const seg = colSegs[v.index]!;
                            if (seg.type === 'monthSum')
                                return null;
                            const col = dayColumns[seg.dayColIndex]!;
                            const meta = dayMeta[col.colIndex]!;
                            const isToday = todayInfo?.monthIndex === col.monthIndex && todayInfo?.day === col.day;
                            return (
                                <th
                                    key={`d-${col.colIndex}`}
                                    scope="col"
                                    className={[
                                        'vac-cont__th-day',
                                        meta.wknd && 'vac-cont__th-day--weekend',
                                        meta.monthStart && 'vac-cont__th-day--month-start',
                                        isToday && 'vac-cont__th-day--today',
                                    ].filter(Boolean).join(' ')}
                                >
                                    {col.day}
                                </th>
                            );
                        })}
                        <VirtualColPad width={padRight} as="th" />
                    </tr>
                    <tr>
                        <VirtualColPad width={padLeft} as="th" />
                        {virtualCols.map((v) => {
                            const seg = colSegs[v.index]!;
                            if (seg.type === 'monthSum')
                                return null;
                            const col = dayColumns[seg.dayColIndex]!;
                            const meta = dayMeta[col.colIndex]!;
                            return (
                                <th
                                    key={`w-${col.colIndex}`}
                                    scope="col"
                                    className={[
                                        'vac-cont__th-wd',
                                        meta.wknd && 'vac-cont__th-wd--weekend',
                                        meta.monthStart && 'vac-cont__th-wd--month-start',
                                    ].filter(Boolean).join(' ')}
                                >
                                    {vacationWeekdayShortRu(year, col.monthIndex, col.day)}
                                </th>
                            );
                        })}
                        <VirtualColPad width={padRight} as="th" />
                    </tr>
                </thead>
                <tbody>
                    {padTop > 0 ? (
                        <tr className="vac-cont__virtual-spacer" aria-hidden>
                            <td colSpan={bodyColSpan} style={{ height: padTop, padding: 0, border: 'none', lineHeight: 0 }} />
                        </tr>
                    ) : null}
                    {virtualRows.map((vRow) => {
                        const emp = employees[vRow.index]!;
                        return (
                            <VacationBodyRow
                                key={emp.id}
                                emp={emp}
                                userIndex={vRow.index}
                                year={year}
                                marks={marks}
                                attendanceMarks={attendanceMarks}
                                attendanceWorkday={attendanceWorkday}
                                kindColors={kindColors}
                                dayColumns={dayColumns}
                                dayMeta={dayMeta}
                                colSegs={colSegs}
                                virtualCols={virtualCols}
                                padLeft={padLeft}
                                padRight={padRight}
                                userStats={userStats}
                                kindYearCounts={kindYearCounts}
                                runEdgesByUser={runEdgesByUser}
                                payroll={payroll}
                                basisByCell={basisByCell}
                                selectedKey={selectedKey}
                                todayInfo={todayInfo}
                                readOnlyDays={readOnlyDays}
                                markedCellsClickable={markedCellsClickable}
                                onEmployeeClick={onEmployeeClick}
                                onDayCellClick={onDayCellClick}
                                onAttendanceHover={showAttendanceFloatTip}
                                onAttendanceHoverEnd={hideAttendanceFloatTip}
                            />
                        );
                    })}
                    {padBottom > 0 ? (
                        <tr className="vac-cont__virtual-spacer" aria-hidden>
                            <td colSpan={bodyColSpan} style={{ height: padBottom, padding: 0, border: 'none', lineHeight: 0 }} />
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
        <p className="vac-cont__hint-mini">
            <span className="vac-cont__hint-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M8 7.2V11M8 4.9v.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            </span>
            <span>
                <b>Примечание.</b> Наведите на отметку дня — дата, ФИО и вид отсутствия.
                {showAttendanceLegend && ' По опозданию и отсутствию — время события.'}
                {markedCellsClickable && ' Клик по отметке — документы-основания периода.'}
                {!readOnlyDays && ' В режиме редактирования клик по дню меняет вид или снимает отметку.'}
                {' '}Столбцы «Кол-во» и «Всего» — число дней отсутствия за месяц и за год.
                {payroll?.visible &&
                    ' Колонки «Отп.» / «Бол.» — ориентировочный расчёт (не замена бухучёту).'}
            </span>
        </p>
        {attendanceFloatTip && typeof document !== 'undefined' ? createPortal(
            <div
                className="vac-cont__attendance-float-tip"
                role="tooltip"
                style={{
                    left: attendanceFloatTip.x,
                    top: attendanceFloatTip.y,
                }}
            >
                {attendanceFloatTip.text}
            </div>,
            document.body,
        ) : null}
    </div>);
}
