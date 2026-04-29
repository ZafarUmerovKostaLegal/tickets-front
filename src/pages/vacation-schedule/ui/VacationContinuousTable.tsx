import type { CSSProperties, MouseEvent } from 'react';
import { Fragment, memo, useMemo } from 'react';
import { buildUserKindYearCounts, formatPayrollMoney, sickPayTotal, vacationPayTotal, type VacationPayrollParams, } from '../lib/vacationPayrollFormulas';
import { basisSummaryForTooltip, hasVacationAbsenceBasisContent, type VacationAbsenceBasis } from '../lib/vacationAbsenceBasisStorage';
import { VACATION_KIND_COLORS, VACATION_MONTH_NAMES, parseVacationCellKey, vacationCellKey, vacationDayIsWeekendRu, vacationKindHumanLabel, vacationMonthHeaderSpans, vacationRowMarkRunEdges, vacationUiLegendFallback, vacationWeekdayShortRu, vacationYearDayColumns, type VacationAbsenceKind, type VacationMarksState, type VacationScheduleEmployeeRow, type VacationUiLegendItem, type VacationYearDayColumn, } from '../lib/vacationScheduleModel';
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
type VacationDayCellProps = {
    kind: VacationAbsenceKind | undefined;
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
    onActivate?: (e: MouseEvent) => void;
};
function BasisPin() {
    return (<span className="vac-cont__basis-pin" aria-hidden>
      <svg className="vac-cont__basis-pin-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3.5V3a2 2 0 114 0v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M6 3.5h4V8a2 2 0 01-1.25 1.86L8 10.25V14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </span>);
}
const VacationDayCell = memo(function VacationDayCell({ kind, kindColors, isWeekendEmpty, isMonthStart, isSelected, isToday, title, hasBasis, markRunStart, markRunEnd, readOnly, onActivate, }: VacationDayCellProps) {
    const bg = kind ? kindColors[kind] : undefined;
    const cls = [
        'vac-cont__cell',
        isWeekendEmpty && 'vac-cont__cell--weekend',
        isMonthStart && 'vac-cont__cell--month-start',
        !readOnly && 'vac-cont__cell--editable',
        isSelected && 'vac-cont__cell--selected',
        isToday && !kind && 'vac-cont__cell--today',
        hasBasis && kind && 'vac-cont__cell--has-basis',
        kind && markRunStart && 'vac-cont__cell--mark-run-start',
        kind && markRunEnd && 'vac-cont__cell--mark-run-end',
    ]
        .filter(Boolean)
        .join(' ');
    const style = bg ? ({ backgroundColor: bg } as CSSProperties) : undefined;
    if (readOnly) {
        return (<td role="gridcell" title={title} className={cls} style={style}>
          {hasBasis && kind ? <BasisPin/> : null}
        </td>);
    }
    return (<td role="gridcell" className={cls} style={style}>
      <button type="button" className="vac-cont__cell-btn" title={title} aria-label={title} onClick={(e) => onActivate?.(e)}/>
      {hasBasis && kind ? <BasisPin/> : null}
    </td>);
});
export type VacationContinuousTableProps = {
    year: number;
    employees: VacationScheduleEmployeeRow[];
    marks: VacationMarksState;
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
};
export function VacationContinuousTable({ year, employees, marks, legendItems = vacationUiLegendFallback(), onEmployeeClick, emptyStateImportHint = false, readOnlyDays = true, onDayCellClick, selectedKey, todayYear, payroll, basisByCell = {}, }: VacationContinuousTableProps) {
    const kindColors = useMemo(() => {
        const m = { ...VACATION_KIND_COLORS };
        for (const it of legendItems) {
            m[it.kind] = it.color;
        }
        return m;
    }, [legendItems]);
    const dayColumns = useMemo(() => vacationYearDayColumns(year), [year]);
    const monthSpans = useMemo(() => vacationMonthHeaderSpans(dayColumns), [dayColumns]);
    const dayColsByMonth = useMemo(() => {
        const buckets: VacationYearDayColumn[][] = Array.from({ length: 12 }, () => []);
        for (const col of dayColumns) {
            buckets[col.monthIndex]!.push(col);
        }
        return buckets;
    }, [dayColumns]);
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
    const legendStrip = (<ul className="vac-cont__legend" aria-label="Виды отсутствия">
      {legendItems.map((item) => (<li key={`${item.kind}-${item.kindCode}`} className="vac-cont__legend-item">
          <span className="vac-cont__legend-swatch" style={{ backgroundColor: item.color }} aria-hidden/>
          <span className="vac-cont__legend-label">{item.label}</span>
        </li>))}
    </ul>);
    if (employees.length === 0) {
        return (<div className="vac-cont">
        {legendStrip}
        <p className="vac-cont__empty">За выбранный год график не загружен или список сотрудников пуст.</p>
        {emptyStateImportHint && (<p className="vac-cont__empty-hint">
            Загрузите файл Excel через кнопку «Загрузить график (Excel)» в панели года (если есть права).
          </p>)}
      </div>);
    }
    return (<div className="vac-cont">
      {legendStrip}
      <div className="vac-cont__scroll">
        <table className="vac-cont__table" role="grid">
          <thead>
            <tr>
              <th className="vac-cont__sticky-corner" colSpan={2} scope="colgroup">
                {year}
              </th>
              {monthSpans.map((s) => (<Fragment key={`mh-${s.monthIndex}`}>
                  <th scope="colgroup" colSpan={s.span} className={[
                'vac-cont__month-title',
                s.monthIndex > 0 && 'vac-cont__month-title--boundary',
            ]
                .filter(Boolean)
                .join(' ')}>
                    {VACATION_MONTH_NAMES[s.monthIndex]}
                  </th>
                  <th className="vac-cont__month-sum-head" rowSpan={3} scope="col">
                    <span className="vac-cont__head-vertical">Кол-во</span>
                  </th>
                </Fragment>))}
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
              {dayColumns.map((col, i) => {
            const meta = dayMeta[i]!;
            const isToday = todayInfo?.monthIndex === col.monthIndex && todayInfo?.day === col.day;
            return (<th key={`d-${col.colIndex}`} scope="col" className={[
                    'vac-cont__th-day',
                    meta.wknd && 'vac-cont__th-day--weekend',
                    meta.monthStart && 'vac-cont__th-day--month-start',
                    isToday && 'vac-cont__th-day--today',
                ]
                    .filter(Boolean)
                    .join(' ')}>
                    {col.day}
                  </th>);
        })}
            </tr>
            <tr>
              {dayColumns.map((col, i) => {
            const meta = dayMeta[i]!;
            return (<th key={`w-${col.colIndex}`} scope="col" className={[
                    'vac-cont__th-wd',
                    meta.wknd && 'vac-cont__th-wd--weekend',
                    meta.monthStart && 'vac-cont__th-wd--month-start',
                ]
                    .filter(Boolean)
                    .join(' ')}>
                    {vacationWeekdayShortRu(year, col.monthIndex, col.day)}
                  </th>);
        })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, userIndex) => {
            const st = userStats.get(emp.id);
            const yearTotal = st?.year ?? 0;
            const counts = kindYearCounts?.get(emp.id);
            const annualDays = counts?.annual ?? 0;
            const sickDays = counts?.sick ?? 0;
            const pr = payroll;
            const vacPay = pr?.visible ? vacationPayTotal(annualDays, pr.params) : 0;
            const sickPay = pr?.visible ? sickPayTotal(sickDays, pr.params) : 0;
            const runEdges = runEdgesByUser.get(emp.id);
            const rowNo = emp.excelRowNo != null ? emp.excelRowNo : userIndex + 1;
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
            return (<tr key={emp.id} className="vac-cont__body-row">
                  <td className="vac-cont__sticky-num">{rowNo}</td>
                  <td className="vac-cont__sticky-name vac-cont__name-cell">
                    {onEmployeeClick ? (<button type="button" className="vac-cont__name-btn" title={nameTitle || undefined} onClick={() => onEmployeeClick(emp.id)}>
                        {emp.label}
                      </button>) : (<span title={nameTitle || undefined}>{emp.label}</span>)}
                  </td>
                  {dayColsByMonth.map((cols, monthIndex) => (<Fragment key={`mrow-${emp.id}-${monthIndex}`}>
                      {cols.map((col) => {
                        const key = vacationCellKey(emp.id, year, col.monthIndex, col.day);
                        const cell = marks[key];
                        const kind = cell?.kind;
                        const meta = dayMeta[col.colIndex]!;
                        const dateStr = cellDateLabel(year, col.monthIndex, col.day);
                        const tipParts = [
                            kind
                                ? `${dateStr} · ${emp.label} · ${vacationKindHumanLabel(kind)}`
                                : `${dateStr} · ${emp.label}`,
                            basisSummaryForTooltip(basisByCell[key]),
                        ].filter(Boolean);
                        const tip = tipParts.join('\n');
                        const hasBasis = Boolean(kind && hasVacationAbsenceBasisContent(basisByCell[key]));
                        const isSelected = selectedKey === key;
                        const isToday = todayInfo?.monthIndex === col.monthIndex && todayInfo?.day === col.day;
                        const markRunStart = Boolean(kind && runEdges?.runStartKeys.has(key));
                        const markRunEnd = Boolean(kind && runEdges?.runEndKeys.has(key));
                        return (<VacationDayCell key={key} kind={kind} kindColors={kindColors} isWeekendEmpty={meta.wknd && !kind} isMonthStart={meta.monthStart} isSelected={isSelected} isToday={isToday} title={tip} hasBasis={hasBasis} markRunStart={markRunStart} markRunEnd={markRunEnd} readOnly={readOnlyDays} onActivate={(e) => onDayCellClick?.({
                                employeeId: emp.id,
                                monthIndex: col.monthIndex,
                                day: col.day,
                                clientX: e.clientX,
                                clientY: e.clientY,
                            })}/>);
                    })}
                      <td className="vac-cont__sum-month" title={`Дней отсутствия в ${VACATION_MONTH_NAMES[monthIndex]}`}>
                        {st?.months[monthIndex] ?? 0}
                      </td>
                    </Fragment>))}
                  {payroll?.visible && (<>
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
                    </>)}
                  <td className="vac-cont__sum-year" title="Всего дней отсутствия за год">
                    {yearTotal}
                  </td>
                </tr>);
        })}
          </tbody>
        </table>
      </div>
      <p className="vac-cont__hint-mini">
        <span className="vac-cont__hint-icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 7.2V11M8 4.9v.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </span>
        <span>
          Подсказка: наведите на ячейку дня — дата, ФИО и вид отсутствия; при сохранённом основании — также комментарий или вложения (пока только в этом браузере).
          {!readOnlyDays && ' С правом редактирования: клик по дню — выбрать вид или снять отметку.'} Колонки «Кол-во» / «Всего» — число дней отсутствий.
          {payroll?.visible &&
              ' Колонки «Отп.» / «Бол.» — ориентировочный расчёт по средней зарплате из панели выше (не замена бухучёту).'}
        </span>
      </p>
    </div>);
}
