import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteVacationAbsenceDay, getVacationKindCodes, getVacationKindLegend, getVacationPartners, invalidateAttendanceMarkersCache, listVacationAbsenceDays, listVacationAttendanceMarkers, listVacationScheduleEmployees, patchVacationAbsenceDay, postVacationEmployeeAbsenceDay, syncVacationScheduleEmployees, } from '@entities/vacation';
import { listColleaguesAsUsers } from '@entities/contacts';
import { useCurrentUser } from '@shared/hooks';
import { canEditVacationSchedule, canViewVacationManualEntryDocs } from '../model/vacationScheduleAccess';
import { loadVacationAbsenceBasisMap, pruneVacationAbsenceBasisForYear, removeVacationAbsenceBasis, setVacationAbsenceBasis, } from '../lib/vacationAbsenceBasisStorage';
import { buildVacationScheduleRowsFromUsers, coerceVacationAbsenceDayRow, isVacationSystemRowId, markVacationSchedulePartnerRows, mergeUsersWithScheduleEmployees, mergeUsersWithVacationPartners, vacationAttendanceMarksFromApi, vacationCellKey, vacationIsoDateFromParts, vacationMarksFromAbsenceDays, vacationUiLegendFromKindCodes, vacationUiLegendFromKindLegendApi, } from '../lib/vacationScheduleModel';
import { fetchWorkdaySettings, workdayDtoToSettings } from '@entities/attendance';
import { DEFAULT_WORKDAY_SETTINGS } from '@shared/lib/attendanceSettings';
import { loadVacationPayrollPrefs, saveVacationPayrollPrefs, } from '../lib/vacationPayrollFormulas';
import { VacationAddEmployeeModal } from './VacationAddEmployeeModal';
import { VacationManualEntryModal } from './VacationManualEntryModal';
import { VacationPeriodDocsModal } from './VacationPeriodDocsModal';
import { VacationContinuousTable } from './VacationContinuousTable';
import { VacationDayEditPopover } from './VacationDayEditPopover';
import { VacationEmployeeDetailModal } from './VacationEmployeeDetailModal';
import { VacationPayrollSettingsModal } from './VacationPayrollSettingsModal';
import { VacationScheduleSkeleton } from './VacationScheduleSkeleton';
import './VacationScheduleGrid.css';
function clampYear(y) {
    return Math.min(2100, Math.max(2000, y));
}
function formatLocalDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function VacationScheduleGrid({ onHeaderActionsChange, externalRefreshToken = 0 }) {
    const { user } = useCurrentUser();
    const canEditSchedule = canEditVacationSchedule(user);
    const canViewDocs = canViewVacationManualEntryDocs(user);
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(() => clampYear(currentYear));
    const [yearInput, setYearInput] = useState(String(clampYear(currentYear)));
    const [employees, setEmployees] = useState([]);
    const [marks, setMarks] = useState({});
    const [attendanceMarks, setAttendanceMarks] = useState({});
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [workdaySettings, setWorkdaySettings] = useState(DEFAULT_WORKDAY_SETTINGS);
    const [legendItems, setLegendItems] = useState(() => vacationUiLegendFromKindCodes(null));
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [loadToken, setLoadToken] = useState(0);
    const [detailEmployeeId, setDetailEmployeeId] = useState(null);
    const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
    const [manualEntryOpen, setManualEntryOpen] = useState(false);
    const [periodDocs, setPeriodDocs] = useState(null);
    const [dayPicker, setDayPicker] = useState(null);
    const [daySaving, setDaySaving] = useState(false);
    const [mutationError, setMutationError] = useState(null);
    const [editModeActive, setEditModeActive] = useState(false);
    const [payrollPrefs, setPayrollPrefs] = useState(() => loadVacationPayrollPrefs(clampYear(currentYear)));
    const [payrollModalOpen, setPayrollModalOpen] = useState(false);
    const [basisByCell, setBasisByCell] = useState(() => loadVacationAbsenceBasisMap());
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [tableExpanded, setTableExpanded] = useState(false);
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
                listColleaguesAsUsers().catch(() => []),
                getVacationPartners().catch(() => []),
                attendancePromise,
            ]);
            if (cancelled)
                return;
            const scheduleRows = empRows.map((e) => ({
                id: e.id,
                label: e.full_name,
                excelRowNo: e.excel_row_no,
                plannedPeriodNote: e.planned_period_note,
                systemUserId: e.auth_user_id ?? undefined,
                email: e.email ?? null,
            }));
            const usersWithPartners = mergeUsersWithScheduleEmployees(mergeUsersWithVacationPartners(allUsers, partners), scheduleRows);
            const partnerIds = partners.map((p) => p.user_id);
            const rows = markVacationSchedulePartnerRows(buildVacationScheduleRowsFromUsers(usersWithPartners, scheduleRows), usersWithPartners, partnerIds);
            const idSet = new Set(rows.map((e) => e.id));
            const coerced = dayRows
                .map((row) => coerceVacationAbsenceDayRow(row))
                .filter((x) => x != null);
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
            .catch((e) => {
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
    const handleDayCellClick = useCallback((p) => {
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
    const handlePickKindCode = useCallback(async (kindCode) => {
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
        catch (e) {
            setMutationError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setDaySaving(false);
        }
    }, [closeDayPicker, dayPicker, refetch, year]);
    const persistBasis = useCallback((cellKey, basis) => {
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
        catch (e) {
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
    const patchPayrollParams = useCallback((patch) => {
        setPayrollPrefs((prev) => {
            const next = { ...prev, params: { ...prev.params, ...patch } };
            saveVacationPayrollPrefs(year, next);
            return next;
        });
    }, [year]);
    const setPayrollShowColumns = useCallback((showColumns) => {
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
    useEffect(() => {
        if (!tableExpanded)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                setTableExpanded(false);
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [tableExpanded]);
    return (_jsxs("div", { className: `vac-vsg${tableExpanded ? ' vac-vsg--expanded' : ''}`, children: [_jsxs("div", { className: `vac-vsg__expand-shell${tableExpanded ? ' vac-vsg__expand-shell--on' : ''}`, children: [_jsxs("div", { className: "vac-vsg__bar", children: [_jsx("label", { className: "vac-vsg__year-label", htmlFor: "vac-year-input", title: "\u0413\u043E\u0434 \u0433\u0440\u0430\u0444\u0438\u043A\u0430 (2000\u20132100)", children: "\u0413\u043E\u0434" }), _jsx("input", { id: "vac-year-input", className: "vac-vsg__year-input", type: "number", min: 2000, max: 2100, value: yearInput, onChange: (e) => setYearInput(e.target.value), onBlur: () => applyYearFromInput(), onKeyDown: (e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        applyYearFromInput();
                                    }
                                } }), _jsx("button", { type: "button", className: "vac-vsg__year-apply", onClick: () => applyYearFromInput(), children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C" }), _jsx("input", { type: "search", className: "vac-vsg__employee-search", value: employeeSearch, onChange: (e) => setEmployeeSearch(e.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430\u2026", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430" }), employeeSearch.trim() ? (_jsxs("span", { className: "vac-vsg__employee-search-count", children: [filteredEmployees.length, " \u0438\u0437 ", employees.length] })) : null, canEditSchedule && attendanceLoading ? (_jsx("span", { className: "vac-vsg__attendance-status", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u043E\u0441\u0435\u0449\u0430\u0435\u043C\u043E\u0441\u0442\u0438\u2026" })) : null, _jsx("span", { className: "vac-vsg__bar-spacer", "aria-hidden": true }), _jsxs("button", { type: "button", className: `vac-vsg__expand-btn${tableExpanded ? ' vac-vsg__expand-btn--on' : ''}`, onClick: () => setTableExpanded((v) => !v), title: tableExpanded ? 'Свернуть таблицу' : 'Растянуть таблицу на весь экран', "aria-label": tableExpanded ? 'Свернуть таблицу' : 'Растянуть таблицу на весь экран', "aria-pressed": tableExpanded, children: [tableExpanded ? (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "4 14 10 14 10 20" }), _jsx("polyline", { points: "20 10 14 10 14 4" }), _jsx("line", { x1: "14", y1: "10", x2: "21", y2: "3" }), _jsx("line", { x1: "3", y1: "21", x2: "10", y2: "14" })] })) : (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "15 3 21 3 21 9" }), _jsx("polyline", { points: "9 21 3 21 3 15" }), _jsx("line", { x1: "21", y1: "3", x2: "14", y2: "10" }), _jsx("line", { x1: "3", y1: "21", x2: "10", y2: "14" })] })), tableExpanded ? 'Свернуть' : 'Растянуть'] }), canEditSchedule && (_jsxs("button", { type: "button", className: "vac-vsg__manual-entry-btn", onClick: () => setManualEntryOpen(true), title: "\u0412\u043D\u0435\u0441\u0442\u0438 \u0437\u0430\u043F\u0438\u0441\u044C \u0432 \u0433\u0440\u0430\u0444\u0438\u043A \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0441 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u043C-\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435\u043C", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("path", { d: "M14 2v6h6" }), _jsx("path", { d: "M12 18v-6" }), _jsx("path", { d: "M9 15h6" })] }), "\u0420\u0443\u0447\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C"] })), canEditSchedule && (_jsxs("button", { type: "button", className: `vac-vsg__edit-mode-btn${editModeActive ? ' vac-vsg__edit-mode-btn--on' : ''}`, onClick: () => setEditModeActive((v) => !v), title: editModeActive
                                    ? 'Режим редактирования включён — клик по ячейке меняет данные. Нажмите, чтобы выключить.'
                                    : 'Включить режим редактирования ячеек', children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }), editModeActive ? 'Ред.: ВКЛ' : 'Ред.: ВЫКЛ'] }))] }), mutationError && (_jsx("p", { className: "vac-vsg__mutation-err", role: "alert", children: mutationError })), loadError && (_jsxs("div", { className: "vac-vsg__err-wrap", role: "alert", children: [_jsx("p", { className: "vac-vsg__error", children: loadError }), _jsx("button", { type: "button", className: "vac-vsg__retry", onClick: refetch, children: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441" })] })), _jsxs("div", { className: "vac-vsg__table-area", children: [loading && _jsx(VacationScheduleSkeleton, {}), !loading && !loadError && filteredEmployees.length === 0 && employees.length > 0 && (_jsxs("p", { className: "vac-vsg__search-empty", role: "status", children: ["\u041F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 \u00AB", employeeSearch.trim(), "\u00BB \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B."] })), !loading && !loadError && (filteredEmployees.length > 0 || employees.length === 0) && (_jsx(VacationContinuousTable, { year: year, employees: filteredEmployees, marks: marks, attendanceMarks: attendanceMarks, attendanceWorkday: workdaySettings, legendItems: legendItems, showAttendanceLegend: canEditSchedule, basisByCell: basisByCell, onEmployeeClick: (id) => {
                                    if (isVacationSystemRowId(id))
                                        return;
                                    setDetailEmployeeId(id);
                                }, emptyStateImportHint: canEditSchedule, readOnlyDays: !canEditSchedule || !editModeActive, markedCellsClickable: canViewDocs && !editModeActive, onDayCellClick: handleDayCellClick, selectedKey: selectedKey, todayYear: currentYear, payroll: {
                                    visible: payrollPrefs.showColumns,
                                    params: payrollPrefs.params,
                                } }))] })] }), _jsx(VacationPayrollSettingsModal, { open: payrollModalOpen, onClose: () => setPayrollModalOpen(false), params: payrollPrefs.params, onSave: patchPayrollParams }), canEditSchedule && (_jsx(VacationAddEmployeeModal, { open: addEmployeeOpen, onClose: () => setAddEmployeeOpen(false), year: year, onSuccess: refetch })), canEditSchedule && (_jsx(VacationManualEntryModal, { open: manualEntryOpen, onClose: () => setManualEntryOpen(false), year: year, employees: employees, legendItems: legendItems, onSuccess: refetch })), detailEmployeeId != null && (_jsx(VacationEmployeeDetailModal, { employeeId: detailEmployeeId, year: year, onClose: () => setDetailEmployeeId(null), canEdit: canEditSchedule, canViewDocs: canViewDocs, onScheduleMutated: refetch })), periodDocs != null && (_jsx(VacationPeriodDocsModal, { open: true, year: year, employeeId: periodDocs.employeeId, employeeName: periodDocs.employeeName, dateIso: periodDocs.dateIso, onClose: () => setPeriodDocs(null) })), _jsx(VacationDayEditPopover, { open: popoverOpen, x: dayPicker?.clientX ?? 0, y: dayPicker?.clientY ?? 0, legendItems: legendItems, current: popoverCurrent, saving: daySaving, cellKey: selectedKey, initialBasis: selectedKey ? basisByCell[selectedKey] : undefined, onPersistBasis: persistBasis, context: popoverContext, onPickKindCode: (code) => void handlePickKindCode(code), onClear: () => void handleClearDay(), onClose: closeDayPicker }, selectedKey ?? 'vac-day-closed')] }));
}
