import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteVacationAbsenceDay, getVacationKindCodes, getVacationKindLegend, getVacationPartners, invalidateAttendanceMarkersCache, listVacationAbsenceDays, listVacationAttendanceMarkers, listVacationScheduleEmployees, patchVacationAbsenceDay, postVacationEmployeeAbsenceDay, syncVacationScheduleEmployees, } from '@entities/vacation';
import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { useCurrentUser } from '@shared/hooks';
import { canEditVacationSchedule, canViewVacationManualEntryDocs } from '../model/vacationScheduleAccess';
import { loadVacationAbsenceBasisMap, pruneVacationAbsenceBasisForYear, removeVacationAbsenceBasis, setVacationAbsenceBasis, type VacationAbsenceBasis, } from '../lib/vacationAbsenceBasisStorage';
import { buildVacationScheduleRowsFromUsers, coerceVacationAbsenceDayRow, isVacationSystemRowId, markVacationSchedulePartnerRows, mergeUsersWithVacationPartners, vacationAttendanceMarksFromApi, vacationCellKey, vacationIsoDateFromParts, vacationMarksFromAbsenceDays, vacationUiLegendFromKindCodes, vacationUiLegendFromKindLegendApi, type VacationAttendanceMarksState, type VacationMarkCell, type VacationMarksState, type VacationScheduleEmployeeRow, type VacationUiLegendItem, } from '../lib/vacationScheduleModel';
import type { VacationAbsenceDayApi, VacationPartnerApi } from '@entities/vacation';
import { fetchWorkdaySettings, workdayDtoToSettings } from '@entities/attendance';
import { DEFAULT_WORKDAY_SETTINGS, type WorkdaySettings } from '@shared/lib/attendanceSettings';
import { loadVacationPayrollPrefs, saveVacationPayrollPrefs, type VacationPayrollParams, type VacationPayrollPrefs, } from '../lib/vacationPayrollFormulas';
import { VacationAddEmployeeModal } from './VacationAddEmployeeModal';
import { VacationManualEntryModal } from './VacationManualEntryModal';
import { VacationPeriodDocsModal } from './VacationPeriodDocsModal';
import { VacationContinuousTable } from './VacationContinuousTable';
import { VacationDayEditPopover } from './VacationDayEditPopover';
import { VacationEmployeeDetailModal } from './VacationEmployeeDetailModal';
import { VacationPayrollSettingsModal } from './VacationPayrollSettingsModal';
import { VacationScheduleSkeleton } from './VacationScheduleSkeleton';
import './VacationScheduleGrid.css';
function clampYear(y: number): number {
    return Math.min(2100, Math.max(2000, y));
}
function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
type DayPickerState = {
    employeeId: number;
    monthIndex: number;
    day: number;
    clientX: number;
    clientY: number;
    current: VacationMarkCell | undefined;
};

export type VacationScheduleHeaderActions = {
    canManage: boolean;
    onAddEmployee: () => void;
    payrollShowColumns: boolean;
    onPayrollToggle: () => void;
    onPayrollParams: () => void;
};

type VacationScheduleGridProps = {
    onHeaderActionsChange?: (actions: VacationScheduleHeaderActions | null) => void;

    externalRefreshToken?: number;
};

export function VacationScheduleGrid({ onHeaderActionsChange, externalRefreshToken = 0 }: VacationScheduleGridProps) {
    const { user } = useCurrentUser();
    const canEditSchedule = canEditVacationSchedule(user);
    const canViewDocs = canViewVacationManualEntryDocs(user);
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(() => clampYear(currentYear));
    const [yearInput, setYearInput] = useState(String(clampYear(currentYear)));
    const [employees, setEmployees] = useState<VacationScheduleEmployeeRow[]>([]);
    const [marks, setMarks] = useState<VacationMarksState>({});
    const [attendanceMarks, setAttendanceMarks] = useState<VacationAttendanceMarksState>({});
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [workdaySettings, setWorkdaySettings] = useState<WorkdaySettings>(DEFAULT_WORKDAY_SETTINGS);
    const [legendItems, setLegendItems] = useState<VacationUiLegendItem[]>(() => vacationUiLegendFromKindCodes(null));
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadToken, setLoadToken] = useState(0);
    const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
    const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
    const [manualEntryOpen, setManualEntryOpen] = useState(false);
    const [periodDocs, setPeriodDocs] = useState<{ employeeId: number; employeeName: string; dateIso: string } | null>(null);
    const [dayPicker, setDayPicker] = useState<DayPickerState | null>(null);
    const [daySaving, setDaySaving] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [editModeActive, setEditModeActive] = useState(false);
    const [payrollPrefs, setPayrollPrefs] = useState<VacationPayrollPrefs>(() => loadVacationPayrollPrefs(clampYear(currentYear)));
    const [payrollModalOpen, setPayrollModalOpen] = useState(false);
    const [basisByCell, setBasisByCell] = useState<Record<string, VacationAbsenceBasis>>(() => loadVacationAbsenceBasisMap());
    const [employeeSearch, setEmployeeSearch] = useState('');
    const filteredEmployees = useMemo(() => {
        const q = employeeSearch.trim().toLowerCase();
        if (!q)
            return employees;
        return employees.filter((row) => {
            const label = row.label.toLowerCase();
            const email = row.email?.toLowerCase() ?? '';
            return label.includes(q) || email.includes(q);
        });
    }, [employees, employeeSearch]);
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
        if (!canEditSchedule)
            return;
        let cancelled = false;
        void fetchWorkdaySettings()
            .then((dto) => {
                if (!cancelled)
                    setWorkdaySettings(workdayDtoToSettings(dto));
            })
            .catch(() => {
                if (!cancelled)
                    setWorkdaySettings(DEFAULT_WORKDAY_SETTINGS);
            });
        return () => {
            cancelled = true;
        };
    }, [canEditSchedule]);
    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setLoading(true);
        const y = year;
        const from = `${y}-01-01`;
        const absenceTo = `${y}-12-31`;
        const today = new Date();
        const attendanceTo = y === today.getFullYear() ? formatLocalDate(today) : `${y}-12-31`;
        void (async () => {
            if (canEditSchedule) {
                try {
                    await syncVacationScheduleEmployees(y);
                }
                catch {
                }
            }
            if (canEditSchedule && (loadToken > 0 || externalRefreshToken > 0))
                invalidateAttendanceMarkersCache();
            if (canEditSchedule)
                setAttendanceLoading(true);
            const attendancePromise = canEditSchedule
                ? listVacationAttendanceMarkers(from, attendanceTo).catch(() => null)
                : Promise.resolve(null);
            const [empRows, dayRows, allUsers, partners, attendanceRows] = await Promise.all([
                listVacationScheduleEmployees(y),
                listVacationAbsenceDays(y, { dateFrom: from, dateTo: absenceTo }),
                listColleaguesAsUsers().catch(() => [] as User[]),
                getVacationPartners().catch(() => [] as VacationPartnerApi[]),
                attendancePromise,
            ]);
            if (cancelled)
                return;
            const scheduleRows: VacationScheduleEmployeeRow[] = empRows.map((e) => ({
                id: e.id,
                label: e.full_name,
                excelRowNo: e.excel_row_no,
                plannedPeriodNote: e.planned_period_note,
                systemUserId: e.auth_user_id ?? undefined,
                email: e.email ?? null,
            }));
            const usersWithPartners = mergeUsersWithVacationPartners(allUsers, partners);
            const partnerIds = partners.map((p) => p.user_id);
            const rows = markVacationSchedulePartnerRows(
                buildVacationScheduleRowsFromUsers(usersWithPartners, scheduleRows),
                usersWithPartners,
                partnerIds,
            );
            const idSet = new Set(rows.map((e) => e.id));
            const coerced = dayRows
                .map((row) => coerceVacationAbsenceDayRow(row))
                .filter((x): x is VacationAbsenceDayApi => x != null);
            setEmployees(rows);
            setMarks(vacationMarksFromAbsenceDays(y, coerced, idSet, rows));
            if (canEditSchedule && attendanceRows) {
                setAttendanceMarks(vacationAttendanceMarksFromApi(y, attendanceRows, rows));
            }
            else {
                setAttendanceMarks({});
            }
            if (canEditSchedule)
                setAttendanceLoading(false);
        })()
            .catch((e: unknown) => {
            if (cancelled)
                return;
            setEmployees([]);
            setMarks({});
            setAttendanceMarks({});
            setAttendanceLoading(false);
            setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить график отсутствий');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [year, loadToken, externalRefreshToken, canEditSchedule]);
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
        if (isVacationSystemRowId(p.employeeId))
            return;
        const key = vacationCellKey(p.employeeId, year, p.monthIndex, p.day);
        const current = marks[key];
        if (canEditSchedule && editModeActive) {
            setMutationError(null);
            setDayPicker({ ...p, current });
            return;
        }
        if (canViewDocs && current?.kind) {
            const emp = employees.find((e) => e.id === p.employeeId);
            setPeriodDocs({
                employeeId: p.employeeId,
                employeeName: emp?.label ?? '',
                dateIso: vacationIsoDateFromParts(year, p.monthIndex, p.day),
            });
        }
    }, [canEditSchedule, canViewDocs, editModeActive, employees, marks, year]);
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
    useEffect(() => {
        onHeaderActionsChange?.({
            canManage: canEditSchedule,
            onAddEmployee: () => setAddEmployeeOpen(true),
            payrollShowColumns: payrollPrefs.showColumns,
            onPayrollToggle: () => setPayrollShowColumns(!payrollPrefs.showColumns),
            onPayrollParams: () => setPayrollModalOpen(true),
        });
        return () => onHeaderActionsChange?.(null);
    }, [canEditSchedule, onHeaderActionsChange, payrollPrefs.showColumns, setPayrollShowColumns]);
    return (<div className="vac-vsg">
      <div className="vac-vsg__bar">
        <label className="vac-vsg__year-label" htmlFor="vac-year-input" title="Год графика (2000–2100)">
          Год
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

        <input
          type="search"
          className="vac-vsg__employee-search"
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
          placeholder="Поиск сотрудника…"
          aria-label="Поиск сотрудника"
        />
        {employeeSearch.trim() ? (
          <span className="vac-vsg__employee-search-count">
            {filteredEmployees.length} из {employees.length}
          </span>
        ) : null}

        {canEditSchedule && attendanceLoading ? (
          <span className="vac-vsg__attendance-status" role="status">
            Загрузка посещаемости…
          </span>
        ) : null}

        <span className="vac-vsg__bar-spacer" aria-hidden/>

        {canEditSchedule && (<button type="button" className="vac-vsg__manual-entry-btn" onClick={() => setManualEntryOpen(true)} title="Внести запись в график вручную с документом-основанием">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M12 18v-6"/>
              <path d="M9 15h6"/>
            </svg>
            Ручная запись
          </button>)}

        {canEditSchedule && (<button type="button" className={`vac-vsg__edit-mode-btn${editModeActive ? ' vac-vsg__edit-mode-btn--on' : ''}`} onClick={() => setEditModeActive((v) => !v)} title={editModeActive
                ? 'Режим редактирования включён — клик по ячейке меняет данные. Нажмите, чтобы выключить.'
                : 'Включить режим редактирования ячеек'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {editModeActive ? 'Ред.: ВКЛ' : 'Ред.: ВЫКЛ'}
          </button>)}
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

      <div className="vac-vsg__table-area">
        {loading && <VacationScheduleSkeleton />}

        {!loading && !loadError && filteredEmployees.length === 0 && employees.length > 0 && (
          <p className="vac-vsg__search-empty" role="status">
            По запросу «{employeeSearch.trim()}» сотрудники не найдены.
          </p>
        )}
        {!loading && !loadError && (filteredEmployees.length > 0 || employees.length === 0) && (<VacationContinuousTable year={year} employees={filteredEmployees} marks={marks} attendanceMarks={attendanceMarks} attendanceWorkday={workdaySettings} legendItems={legendItems} showAttendanceLegend={canEditSchedule} basisByCell={basisByCell} onEmployeeClick={(id) => {
                if (isVacationSystemRowId(id))
                    return;
                setDetailEmployeeId(id);
            }} emptyStateImportHint={canEditSchedule} readOnlyDays={!canEditSchedule || !editModeActive} markedCellsClickable={canViewDocs && !editModeActive} onDayCellClick={handleDayCellClick} selectedKey={selectedKey} todayYear={currentYear} payroll={{
                visible: payrollPrefs.showColumns,
                params: payrollPrefs.params,
            }}/>)}
      </div>

      <VacationPayrollSettingsModal open={payrollModalOpen} onClose={() => setPayrollModalOpen(false)} params={payrollPrefs.params} onSave={patchPayrollParams}/>

      {canEditSchedule && (
          <VacationAddEmployeeModal open={addEmployeeOpen} onClose={() => setAddEmployeeOpen(false)} year={year} onSuccess={refetch}/>
        )}

      {canEditSchedule && (
          <VacationManualEntryModal open={manualEntryOpen} onClose={() => setManualEntryOpen(false)} year={year} employees={employees} legendItems={legendItems} onSuccess={refetch}/>
        )}

      {detailEmployeeId != null && (<VacationEmployeeDetailModal employeeId={detailEmployeeId} year={year} onClose={() => setDetailEmployeeId(null)} canEdit={canEditSchedule} canViewDocs={canViewDocs} onScheduleMutated={refetch}/>)}

      {periodDocs != null && (<VacationPeriodDocsModal open year={year} employeeId={periodDocs.employeeId} employeeName={periodDocs.employeeName} dateIso={periodDocs.dateIso} onClose={() => setPeriodDocs(null)}/>)}

      <VacationDayEditPopover key={selectedKey ?? 'vac-day-closed'} open={popoverOpen} x={dayPicker?.clientX ?? 0} y={dayPicker?.clientY ?? 0} legendItems={legendItems} current={popoverCurrent} saving={daySaving} cellKey={selectedKey} initialBasis={selectedKey ? basisByCell[selectedKey] : undefined} onPersistBasis={persistBasis} context={popoverContext} onPickKindCode={(code) => void handlePickKindCode(code)} onClear={() => void handleClearDay()} onClose={closeDayPicker}/>
    </div>);
}
