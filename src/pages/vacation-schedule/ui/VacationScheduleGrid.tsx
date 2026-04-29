import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteVacationAbsenceDay, getVacationKindCodes, getVacationKindLegend, listVacationAbsenceDays, listVacationScheduleEmployees, patchVacationAbsenceDay, postVacationEmployeeAbsenceDay, } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { canEditVacationSchedule } from '../model/vacationScheduleAccess';
import { loadVacationAbsenceBasisMap, pruneVacationAbsenceBasisForYear, removeVacationAbsenceBasis, setVacationAbsenceBasis, type VacationAbsenceBasis, } from '../lib/vacationAbsenceBasisStorage';
import { coerceVacationAbsenceDayRow, vacationCellKey, vacationIsoDateFromParts, vacationMarksFromAbsenceDays, vacationUiLegendFromKindCodes, vacationUiLegendFromKindLegendApi, type VacationMarkCell, type VacationMarksState, type VacationScheduleEmployeeRow, type VacationUiLegendItem, } from '../lib/vacationScheduleModel';
import type { VacationAbsenceDayApi } from '@entities/vacation';
import { loadVacationPayrollPrefs, saveVacationPayrollPrefs, type VacationPayrollParams, type VacationPayrollPrefs, } from '../lib/vacationPayrollFormulas';
import { VacationAddEmployeeModal } from './VacationAddEmployeeModal';
import { VacationContinuousTable } from './VacationContinuousTable';
import { VacationDayEditPopover } from './VacationDayEditPopover';
import { VacationEmployeeDetailModal } from './VacationEmployeeDetailModal';
import { VacationScheduleImportModal } from './VacationScheduleImportModal';
import { VacationScheduleSkeleton } from './VacationScheduleSkeleton';
import './VacationScheduleGrid.css';
function clampYear(y: number): number {
    return Math.min(2100, Math.max(2000, y));
}
type DayPickerState = {
    employeeId: number;
    monthIndex: number;
    day: number;
    clientX: number;
    clientY: number;
    current: VacationMarkCell | undefined;
};
export function VacationScheduleGrid() {
    const { user } = useCurrentUser();
    const canEditSchedule = canEditVacationSchedule(user);
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(() => clampYear(currentYear));
    const [yearInput, setYearInput] = useState(String(clampYear(currentYear)));
    const [employees, setEmployees] = useState<VacationScheduleEmployeeRow[]>([]);
    const [marks, setMarks] = useState<VacationMarksState>({});
    const [legendItems, setLegendItems] = useState<VacationUiLegendItem[]>(() => vacationUiLegendFromKindCodes(null));
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadToken, setLoadToken] = useState(0);
    const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
    const [dayPicker, setDayPicker] = useState<DayPickerState | null>(null);
    const [daySaving, setDaySaving] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [editModeActive, setEditModeActive] = useState(false);
    const [payrollPrefs, setPayrollPrefs] = useState<VacationPayrollPrefs>(() => loadVacationPayrollPrefs(clampYear(currentYear)));
    const [basisByCell, setBasisByCell] = useState<Record<string, VacationAbsenceBasis>>(() => loadVacationAbsenceBasisMap());
    useEffect(() => {
        let cancelled = false;
        void getVacationKindLegend()
            .then((leg) => {
            if (!cancelled)
                setLegendItems(vacationUiLegendFromKindLegendApi(leg));
        })
            .catch(() => {
            void getVacationKindCodes()
                .then((codes) => {
                if (!cancelled)
                    setLegendItems(vacationUiLegendFromKindCodes(codes));
            })
                .catch(() => {
                if (!cancelled)
                    setLegendItems(vacationUiLegendFromKindCodes(null));
            });
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        setPayrollPrefs(loadVacationPayrollPrefs(year));
    }, [year]);
    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setLoading(true);
        const y = year;
        const from = `${y}-01-01`;
        const to = `${y}-12-31`;
        void Promise.all([
            listVacationScheduleEmployees(y),
            listVacationAbsenceDays(y, { dateFrom: from, dateTo: to }),
        ])
            .then(([empRows, dayRows]) => {
            if (cancelled)
                return;
            const mapped: VacationScheduleEmployeeRow[] = empRows.map((e) => ({
                id: e.id,
                label: e.full_name,
                excelRowNo: e.excel_row_no,
                plannedPeriodNote: e.planned_period_note,
            }));
            const idSet = new Set(mapped.map((e) => e.id));
            const coerced = dayRows
                .map((row) => coerceVacationAbsenceDayRow(row))
                .filter((x): x is VacationAbsenceDayApi => x != null);
            setEmployees(mapped);
            setMarks(vacationMarksFromAbsenceDays(y, coerced, idSet));
        })
            .catch((e: unknown) => {
            if (cancelled)
                return;
            setEmployees([]);
            setMarks({});
            setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить график отсутствий');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [year, loadToken]);
    useEffect(() => {
        if (loading || loadError)
            return;
        const markKeys = new Set(Object.keys(marks));
        setBasisByCell((prev) => pruneVacationAbsenceBasisForYear(year, markKeys, prev));
    }, [loading, loadError, year, marks]);
    const applyYearFromInput = () => {
        const n = Number.parseInt(yearInput.trim(), 10);
        if (!Number.isFinite(n))
            return;
        const c = clampYear(n);
        setYear(c);
        setYearInput(String(c));
        setEditModeActive(false);
    };
    const refetch = useCallback(() => setLoadToken((t) => t + 1), []);
    const closeDayPicker = useCallback(() => setDayPicker(null), []);
    const handleDayCellClick = useCallback((p: {
        employeeId: number;
        monthIndex: number;
        day: number;
        clientX: number;
        clientY: number;
    }) => {
        if (!canEditSchedule || !editModeActive)
            return;
        setMutationError(null);
        const key = vacationCellKey(p.employeeId, year, p.monthIndex, p.day);
        setDayPicker({ ...p, current: marks[key] });
    }, [canEditSchedule, editModeActive, marks, year]);
    const handlePickKindCode = useCallback(async (kindCode: number) => {
        if (!dayPicker)
            return;
        const { employeeId, monthIndex, day, current } = dayPicker;
        const iso = vacationIsoDateFromParts(year, monthIndex, day);
        setMutationError(null);
        if (current?.kindCode === kindCode) {
            closeDayPicker();
            return;
        }
        setDaySaving(true);
        try {
            if (!current) {
                await postVacationEmployeeAbsenceDay(employeeId, { absence_on: iso, kind_code: kindCode });
            }
            else if (current.absenceDayId != null) {
                await patchVacationAbsenceDay(current.absenceDayId, { kind_code: kindCode });
            }
            else {
                setMutationError('У отметки нет id в ответе сервера. Нажмите «Показать» по году ещё раз или обновите страницу.');
                return;
            }
            closeDayPicker();
            refetch();
        }
        catch (e: unknown) {
            setMutationError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setDaySaving(false);
        }
    }, [closeDayPicker, dayPicker, refetch, year]);
    const persistBasis = useCallback((cellKey: string, basis: VacationAbsenceBasis | null) => {
        setBasisByCell((prev) => setVacationAbsenceBasis(cellKey, basis, prev));
    }, []);
    const handleClearDay = useCallback(async () => {
        if (!dayPicker?.current)
            return;
        const aid = dayPicker.current.absenceDayId;
        if (aid == null) {
            setMutationError('Нельзя снять отметку без id записи. Нажмите «Показать» по году или обновите страницу.');
            return;
        }
        const basisKey = vacationCellKey(dayPicker.employeeId, year, dayPicker.monthIndex, dayPicker.day);
        setDaySaving(true);
        setMutationError(null);
        try {
            await deleteVacationAbsenceDay(aid);
            setBasisByCell((prev) => removeVacationAbsenceBasis(basisKey, prev));
            closeDayPicker();
            refetch();
        }
        catch (e: unknown) {
            setMutationError(e instanceof Error ? e.message : 'Не удалось удалить отметку');
        }
        finally {
            setDaySaving(false);
        }
    }, [closeDayPicker, dayPicker, refetch, year]);
    const popoverOpen = dayPicker != null && canEditSchedule;
    const popoverCurrent = useMemo(() => {
        if (!dayPicker)
            return undefined;
        return dayPicker.current;
    }, [dayPicker]);
    const selectedKey = dayPicker
        ? vacationCellKey(dayPicker.employeeId, year, dayPicker.monthIndex, dayPicker.day)
        : undefined;
    const popoverContext = useMemo(() => {
        if (!dayPicker)
            return undefined;
        const emp = employees.find((e) => e.id === dayPicker.employeeId);
        const d = String(dayPicker.day).padStart(2, '0');
        const m = String(dayPicker.monthIndex + 1).padStart(2, '0');
        return { employeeName: emp?.label ?? '', dateLabel: `${d}.${m}.${year}` };
    }, [dayPicker, employees, year]);
    const patchPayrollParams = useCallback((patch: Partial<VacationPayrollParams>) => {
        setPayrollPrefs((prev) => {
            const next = { ...prev, params: { ...prev.params, ...patch } };
            saveVacationPayrollPrefs(year, next);
            return next;
        });
    }, [year]);
    const setPayrollShowColumns = useCallback((showColumns: boolean) => {
        setPayrollPrefs((prev) => {
            const next = { ...prev, showColumns };
            saveVacationPayrollPrefs(year, next);
            return next;
        });
    }, [year]);
    const scheduleTodayStats = useMemo(() => {
        const total = employees.length;
        if (year !== currentYear || total === 0) {
            return {
                total,
                vacation: 0,
                sick: 0,
                remote: 0,
                business: 0,
                todayInactive: true,
            };
        }
        const now = new Date();
        const mi = now.getMonth();
        const d = now.getDate();
        let vacation = 0;
        let sick = 0;
        let remote = 0;
        let business = 0;
        for (const emp of employees) {
            const k = marks[vacationCellKey(emp.id, year, mi, d)]?.kind;
            if (k === 'annual')
                vacation += 1;
            else if (k === 'sick')
                sick += 1;
            else if (k === 'remote')
                remote += 1;
            else if (k === 'business')
                business += 1;
        }
        return {
            total,
            vacation,
            sick,
            remote,
            business,
            todayInactive: false,
        };
    }, [employees, marks, year, currentYear]);
    return (<div className="vac-vsg">
      <div className="vac-vsg__top">
        <div className="vac-vsg__payroll-bar" aria-label="Ориентировочный расчёт выплат">
          <label className="vac-vsg__payroll-toggle vac-vsg__payroll-toggle--hero">
            <input type="checkbox" checked={payrollPrefs.showColumns} onChange={(e) => setPayrollShowColumns(e.target.checked)}/>
            <span>Показать оценку отпускных и больничных</span>
          </label>
        </div>
        {payrollPrefs.showColumns && (<div className="vac-vsg__payroll-expand">
            <div className="vac-vsg__payroll-fields">
              <label className="vac-vsg__payroll-field">
                <span>Средняя зарплата / мес., ₽</span>
                <input type="number" min={0} step={1000} className="vac-vsg__payroll-input" value={payrollPrefs.params.avgMonthlySalary > 0 ? payrollPrefs.params.avgMonthlySalary : ''} onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                    patchPayrollParams({ avgMonthlySalary: 0 });
                    return;
                }
                const v = Number.parseFloat(raw);
                patchPayrollParams({ avgMonthlySalary: Number.isFinite(v) && v >= 0 ? v : 0 });
            }} placeholder="0"/>
              </label>
              <label className="vac-vsg__payroll-field">
                <span>Ср. кал. дней в мес.</span>
                <input type="number" min={1} max={31} step={0.1} className="vac-vsg__payroll-input vac-vsg__payroll-input--narrow" value={payrollPrefs.params.avgCalendarDaysPerMonth} onChange={(e) => {
                const v = Number.parseFloat(e.target.value);
                patchPayrollParams({
                    avgCalendarDaysPerMonth: Number.isFinite(v) ? Math.min(31, Math.max(1, v)) : 29.3,
                });
            }}/>
              </label>
              <label className="vac-vsg__payroll-field">
                <span>Ставка больничного (0–1)</span>
                <input type="number" min={0} max={1} step={0.05} className="vac-vsg__payroll-input vac-vsg__payroll-input--narrow" value={payrollPrefs.params.sickLeavePayRate} onChange={(e) => {
                const v = Number.parseFloat(e.target.value);
                patchPayrollParams({
                    sickLeavePayRate: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6,
                });
            }}/>
              </label>
              <label className="vac-vsg__payroll-field">
                <span>Коэфф. отпуска (0–2)</span>
                <input type="number" min={0} max={2} step={0.05} className="vac-vsg__payroll-input vac-vsg__payroll-input--narrow" value={payrollPrefs.params.vacationPayRate} onChange={(e) => {
                const v = Number.parseFloat(e.target.value);
                patchPayrollParams({
                    vacationPayRate: Number.isFinite(v) ? Math.min(2, Math.max(0, v)) : 1,
                });
            }}/>
              </label>
            </div>
            <p className="vac-vsg__payroll-note">
              Ориентир: среднедневной = зарплата / ср. дней в месяце; отпускные и больничные считаются по дням в графике с видами «ежегодный отпуск» и «болезнь». Не учитывает лимиты ФСС, стаж, МРОТ и пр.
            </p>
          </div>)}
        <div className="vac-vsg__stats" aria-label="Сводка на сегодня">
          <div className="vac-vsg__stat-card">
            <div className="vac-vsg__stat-icon vac-vsg__stat-icon--slate" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="vac-vsg__stat-text">
              <span className="vac-vsg__stat-value">
                {scheduleTodayStats.total}
              </span>
              <span className="vac-vsg__stat-sub">всего</span>
            </div>
          </div>
          <div className="vac-vsg__stat-card">
            <div className="vac-vsg__stat-icon vac-vsg__stat-icon--purple" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div className="vac-vsg__stat-text">
              <span className="vac-vsg__stat-value">
                {scheduleTodayStats.todayInactive ? '—' : scheduleTodayStats.vacation}
              </span>
              <span className="vac-vsg__stat-sub">
                {scheduleTodayStats.todayInactive ? 'не текущий год' : 'сегодня'}
              </span>
            </div>
          </div>
          <div className="vac-vsg__stat-card">
            <div className="vac-vsg__stat-icon vac-vsg__stat-icon--rose" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </div>
            <div className="vac-vsg__stat-text">
              <span className="vac-vsg__stat-value">
                {scheduleTodayStats.todayInactive ? '—' : scheduleTodayStats.sick}
              </span>
              <span className="vac-vsg__stat-sub">
                {scheduleTodayStats.todayInactive ? 'не текущий год' : 'сегодня'}
              </span>
            </div>
          </div>
          <div className="vac-vsg__stat-card">
            <div className="vac-vsg__stat-icon vac-vsg__stat-icon--sky" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="14" rx="2"/>
                <path d="M6 18h12M8 22h8"/>
              </svg>
            </div>
            <div className="vac-vsg__stat-text">
              <span className="vac-vsg__stat-value">
                {scheduleTodayStats.todayInactive ? '—' : scheduleTodayStats.remote}
              </span>
              <span className="vac-vsg__stat-sub">
                {scheduleTodayStats.todayInactive ? 'не текущий год' : 'сегодня'}
              </span>
            </div>
          </div>
          <div className="vac-vsg__stat-card">
            <div className="vac-vsg__stat-icon vac-vsg__stat-icon--green" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
            <div className="vac-vsg__stat-text">
              <span className="vac-vsg__stat-value">
                {scheduleTodayStats.todayInactive ? '—' : scheduleTodayStats.business}
              </span>
              <span className="vac-vsg__stat-sub">
                {scheduleTodayStats.todayInactive ? 'не текущий год' : 'сегодня'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="vac-vsg__toolbar">
        <label className="vac-vsg__year-label" htmlFor="vac-year-input">
          Год графика (2000–2100)
        </label>
        <input id="vac-year-input" className="vac-vsg__year-input" type="number" min={2000} max={2100} value={yearInput} onChange={(e) => setYearInput(e.target.value)} onBlur={() => applyYearFromInput()} onKeyDown={(e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyYearFromInput();
            }
        }}/>
        <button type="button" className="vac-vsg__year-apply" onClick={() => applyYearFromInput()}>
          Показать
        </button>
        {canEditSchedule && (<button type="button" className={`vac-vsg__edit-mode-btn${editModeActive ? ' vac-vsg__edit-mode-btn--on' : ''}`} onClick={() => setEditModeActive((v) => !v)} title={editModeActive
                ? 'Режим редактирования включён — клик по ячейке меняет данные. Нажмите, чтобы выключить.'
                : 'Включить режим редактирования ячеек'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {editModeActive ? 'Редактирование: ВКЛ' : 'Редактирование: ВЫКЛ'}
          </button>)}
        <span className="vac-vsg__toolbar-spacer" aria-hidden/>
        {canEditSchedule && (<>
            <button type="button" className="vac-vsg__add-emp-btn" onClick={() => setAddEmployeeOpen(true)}>
              Добавить сотрудника
            </button>
            <button type="button" className="vac-vsg__import-btn" onClick={() => setImportModalOpen(true)}>
              Загрузить график (Excel)
            </button>
          </>)}
      </div>

      {mutationError && (<p className="vac-vsg__mutation-err" role="alert">
          {mutationError}
        </p>)}

      {loadError && (<div className="vac-vsg__err-wrap" role="alert">
          <p className="vac-vsg__error">{loadError}</p>
          <button type="button" className="vac-vsg__retry" onClick={refetch}>
            Повторить запрос
          </button>
        </div>)}

      {loading && <VacationScheduleSkeleton />}

      {!loading && !loadError && (<VacationContinuousTable year={year} employees={employees} marks={marks} legendItems={legendItems} basisByCell={basisByCell} onEmployeeClick={(id) => setDetailEmployeeId(id)} emptyStateImportHint={canEditSchedule} readOnlyDays={!canEditSchedule || !editModeActive} onDayCellClick={handleDayCellClick} selectedKey={selectedKey} todayYear={currentYear} payroll={{
                visible: payrollPrefs.showColumns,
                params: payrollPrefs.params,
            }}/>)}

      {canEditSchedule && (<>
          <VacationScheduleImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} defaultYear={year} onImportSuccess={refetch}/>
          <VacationAddEmployeeModal open={addEmployeeOpen} onClose={() => setAddEmployeeOpen(false)} year={year} onSuccess={refetch}/>
        </>)}

      {detailEmployeeId != null && (<VacationEmployeeDetailModal employeeId={detailEmployeeId} year={year} onClose={() => setDetailEmployeeId(null)} canEdit={canEditSchedule} onScheduleMutated={refetch}/>)}

      <VacationDayEditPopover key={selectedKey ?? 'vac-day-closed'} open={popoverOpen} x={dayPicker?.clientX ?? 0} y={dayPicker?.clientY ?? 0} legendItems={legendItems} current={popoverCurrent} saving={daySaving} cellKey={selectedKey} initialBasis={selectedKey ? basisByCell[selectedKey] : undefined} onPersistBasis={persistBasis} context={popoverContext} onPickKindCode={(code) => void handlePickKindCode(code)} onClear={() => void handleClearDay()} onClose={closeDayPicker}/>
    </div>);
}
