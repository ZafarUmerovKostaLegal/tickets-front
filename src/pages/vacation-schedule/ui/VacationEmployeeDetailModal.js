import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDialog } from '@shared/ui';
import { deleteVacationAbsenceDay, deleteVacationManualEntry, deleteVacationManualEntryDocument, deleteVacationScheduleEmployee, getVacationScheduleEmployee, listVacationAttendanceMarkers, listVacationManualEntries, patchVacationScheduleEmployee, } from '@entities/vacation';
import { listColleaguesAsUsers } from '@entities/contacts';
import { fetchWorkdaySettings, workdayDtoToSettings } from '@entities/attendance';
import { DEFAULT_WORKDAY_SETTINGS } from '@shared/lib/attendanceSettings';
import { isHiddenSystemUser } from '@shared/lib';
import { ruDaysWord } from '../lib/leaveRequestDisplay';
import { apiAbsenceKindToUi, formatVacationLateMinutes, formatVacationLateMinutesTotal, vacationAttendanceArrivalClock, vacationAttendanceLateMinutes, vacationDayIsWeekendRu, vacationKindHumanLabel, VACATION_MONTH_NAMES, } from '../lib/vacationScheduleModel';
import { VacationDocLightbox } from './VacationDocLightbox';
import './VacationEmployeeDetailModal.css';
function formatIsoDateRu(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return iso;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12)
        return iso;
    return `${d} ${VACATION_MONTH_NAMES[mo - 1]} ${y}`;
}
function parseIsoParts(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return null;
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31)
        return null;
    return { year, monthIndex, day };
}
function summarizeAttendanceForUser(markers, appUserId, year, workday) {
    const days = [];
    let lateCount = 0;
    let absentCount = 0;
    let lateMinutesTotal = 0;
    for (const marker of markers) {
        if (marker.app_user_id !== appUserId)
            continue;
        const parts = parseIsoParts(marker.date);
        if (!parts || parts.year !== year)
            continue;
        if (vacationDayIsWeekendRu(year, parts.monthIndex, parts.day))
            continue;
        if (marker.status === 'late') {
            lateCount += 1;
            const minutes = vacationAttendanceLateMinutes(marker.first_event_time, workday);
            if (minutes != null && minutes > 0)
                lateMinutesTotal += minutes;
            days.push({
                date: marker.date,
                status: 'late',
                minutes,
                arrival: vacationAttendanceArrivalClock(marker.first_event_time),
                explanation: marker.explanation_text,
            });
        }
        else if (marker.status === 'absent') {
            absentCount += 1;
            days.push({
                date: marker.date,
                status: 'absent',
                minutes: null,
                arrival: null,
                explanation: marker.explanation_text,
            });
        }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    return { lateCount, absentCount, lateMinutesTotal, days };
}
function userLabel(u) {
    return (u.display_name?.trim() || u.email || `Пользователь ${u.id}`).trim();
}
export function VacationEmployeeDetailModal({ employeeId, year, onClose, canEdit = false, canViewDocs = false, onScheduleMutated, }) {
    const { showConfirm } = useAppDialog();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fullName, setFullName] = useState('');
    const [authUserId, setAuthUserId] = useState(null);
    const [plannedNote, setPlannedNote] = useState(null);
    const [excelRow, setExcelRow] = useState(null);
    const [days, setDays] = useState([]);
    const [deletingId, setDeletingId] = useState(null);
    const [deletingEmployee, setDeletingEmployee] = useState(false);
    const [manualEntries, setManualEntries] = useState([]);
    const [preview, setPreview] = useState(null);
    const [busyEntryId, setBusyEntryId] = useState(null);
    const [linkOptions, setLinkOptions] = useState([]);
    const [selectedLinkUserId, setSelectedLinkUserId] = useState('');
    const [linkSaving, setLinkSaving] = useState(false);
    const [workdaySettings, setWorkdaySettings] = useState(DEFAULT_WORKDAY_SETTINGS);
    const [attendance, setAttendance] = useState(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceError, setAttendanceError] = useState(null);
    const absenceByKind = useMemo(() => {
        const map = new Map();
        for (const d of days) {
            const ui = apiAbsenceKindToUi(d.kind);
            const label = ui ? vacationKindHumanLabel(ui) : d.kind;
            map.set(label, (map.get(label) ?? 0) + 1);
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'));
    }, [days]);
    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        void Promise.all([
            getVacationScheduleEmployee(employeeId, year),
            canViewDocs
                ? listVacationManualEntries({ year, employeeId }).catch(() => [])
                : Promise.resolve([]),
        ])
            .then(([row, entries]) => {
            setFullName(row.full_name);
            setAuthUserId(row.auth_user_id);
            setSelectedLinkUserId(row.auth_user_id != null ? String(row.auth_user_id) : '');
            setPlannedNote(row.planned_period_note);
            setExcelRow(row.excel_row_no);
            setDays(row.absence_days ?? []);
            setManualEntries(entries);
        })
            .catch((e) => {
            setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
        })
            .finally(() => {
            setLoading(false);
        });
    }, [employeeId, year, canViewDocs]);
    useEffect(() => {
        load();
    }, [load]);
    useEffect(() => {
        if (!canEdit)
            return;
        let cancelled = false;
        void listColleaguesAsUsers()
            .then((list) => {
            if (cancelled)
                return;
            const opts = list
                .filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u))
                .map((u) => ({
                id: String(u.id),
                userId: u.id,
                label: userLabel(u),
                email: u.email,
            }))
                .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
            setLinkOptions(opts);
        })
            .catch(() => setLinkOptions([]));
        return () => {
            cancelled = true;
        };
    }, [canEdit]);
    useEffect(() => {
        let cancelled = false;
        if (authUserId == null || authUserId <= 0) {
            setAttendance(null);
            setAttendanceError(null);
            setAttendanceLoading(false);
            return;
        }
        setAttendanceLoading(true);
        setAttendanceError(null);
        const from = `${year}-01-01`;
        const today = new Date();
        const to = year === today.getFullYear()
            ? `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            : `${year}-12-31`;
        void Promise.all([
            listVacationAttendanceMarkers(from, to),
            fetchWorkdaySettings().then(workdayDtoToSettings).catch(() => DEFAULT_WORKDAY_SETTINGS),
        ])
            .then(([markers, workday]) => {
            if (cancelled)
                return;
            setWorkdaySettings(workday);
            setAttendance(summarizeAttendanceForUser(markers, authUserId, year, workday));
        })
            .catch((e) => {
            if (cancelled)
                return;
            setAttendance(null);
            setAttendanceError(e instanceof Error ? e.message : 'Не удалось загрузить посещаемость');
        })
            .finally(() => {
            if (!cancelled)
                setAttendanceLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [authUserId, year]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);
    const handleDeleteDay = async (absenceDayId) => {
        if (!Number.isFinite(absenceDayId))
            return;
        setDeletingId(absenceDayId);
        try {
            await deleteVacationAbsenceDay(absenceDayId);
            onScheduleMutated?.();
            setDays((prev) => prev.filter((d) => d.id !== absenceDayId));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить день');
        }
        finally {
            setDeletingId(null);
        }
    };
    const handleDeleteDoc = async (entryId, docId) => {
        const ok = await showConfirm({
            title: 'Удалить документ-основание?',
            message: 'Документ будет удалён из записи. Нельзя удалить последний документ, если основание обязательно.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!ok)
            return;
        setBusyEntryId(entryId);
        setError(null);
        try {
            await deleteVacationManualEntryDocument(entryId, docId);
            setManualEntries((prev) => prev.map((en) => en.id === entryId
                ? { ...en, documents: en.documents.filter((d) => d.id !== docId) }
                : en));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить документ');
        }
        finally {
            setBusyEntryId(null);
        }
    };
    const handleDeleteManualEntry = async (entryId) => {
        const ok = await showConfirm({
            title: 'Удалить ручную запись?',
            message: 'Запись, её документы и связанные дни графика будут удалены.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!ok)
            return;
        setBusyEntryId(entryId);
        setError(null);
        try {
            await deleteVacationManualEntry(entryId);
            setManualEntries((prev) => prev.filter((en) => en.id !== entryId));
            onScheduleMutated?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить запись');
        }
        finally {
            setBusyEntryId(null);
        }
    };
    const handleDeleteEmployee = async () => {
        const ok = await showConfirm({
            title: 'Удалить строку из графика?',
            message: 'Все отмеченные дни отсутствий этого сотрудника за год будут удалены.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!ok) {
            return;
        }
        setDeletingEmployee(true);
        setError(null);
        try {
            await deleteVacationScheduleEmployee(employeeId);
            onScheduleMutated?.();
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить сотрудника');
        }
        finally {
            setDeletingEmployee(false);
        }
    };
    const handleSaveAuthLink = async () => {
        const nextId = selectedLinkUserId ? Number(selectedLinkUserId) : null;
        if (nextId === authUserId)
            return;
        const selected = nextId != null ? linkOptions.find((o) => o.userId === nextId) : null;
        setLinkSaving(true);
        setError(null);
        try {
            await patchVacationScheduleEmployee(employeeId, {
                auth_user_id: nextId,
                email: selected?.email ?? null,
            });
            setAuthUserId(nextId);
            onScheduleMutated?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сохранить связку с пользователем');
        }
        finally {
            setLinkSaving(false);
        }
    };
    return createPortal(_jsxs("div", { className: "vac-emp-ov", role: "dialog", "aria-modal": "true", "aria-labelledby": "vac-emp-title", children: [_jsxs("div", { className: "vac-emp-card", children: [_jsxs("div", { className: "vac-emp-card__head", children: [_jsx("h2", { id: "vac-emp-title", className: "vac-emp-card__title", children: loading ? 'Загрузка…' : fullName || 'Сотрудник' }), _jsx("button", { type: "button", className: "vac-emp-card__x", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-emp-card__body", children: [error && (_jsx("p", { className: "vac-emp-card__err", role: "alert", children: error })), !error && !loading && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "vac-emp-card__meta", children: ["\u0413\u043E\u0434 \u0433\u0440\u0430\u0444\u0438\u043A\u0430: ", _jsx("strong", { children: year }), excelRow != null && (_jsxs(_Fragment, { children: [' ', "\u00B7 \u0418\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u2116 \u0441\u0442\u0440\u043E\u043A\u0438: ", _jsx("strong", { children: excelRow })] }))] }), plannedNote?.trim() && (_jsxs("p", { className: "vac-emp-card__note", children: [_jsx("span", { className: "vac-emp-card__note-lbl", children: "\u041F\u0435\u0440\u0438\u043E\u0434:" }), " ", plannedNote] })), _jsxs("section", { className: "vac-emp-card__summary", "aria-label": "\u0421\u0432\u043E\u0434\u043A\u0430 \u0437\u0430 \u0433\u043E\u0434", children: [_jsx("h3", { className: "vac-emp-card__sub", children: "\u0421\u0432\u043E\u0434\u043A\u0430" }), _jsxs("div", { className: "vac-emp-card__kpis", children: [_jsxs("article", { className: "vac-emp-card__kpi", children: [_jsx("span", { className: "vac-emp-card__kpi-label", children: "\u0412 \u0433\u0440\u0430\u0444\u0438\u043A\u0435" }), _jsx("strong", { className: "vac-emp-card__kpi-value", children: days.length }), _jsxs("span", { className: "vac-emp-card__kpi-sub", children: [ruDaysWord(days.length), " \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0439"] })] }), _jsxs("article", { className: "vac-emp-card__kpi vac-emp-card__kpi--late", children: [_jsx("span", { className: "vac-emp-card__kpi-label", children: "\u041E\u043F\u043E\u0437\u0434\u0430\u043D\u0438\u044F" }), _jsx("strong", { className: "vac-emp-card__kpi-value", children: authUserId == null
                                                                    ? '—'
                                                                    : attendanceLoading
                                                                        ? '…'
                                                                        : (attendance?.lateCount ?? 0) }), _jsx("span", { className: "vac-emp-card__kpi-sub", children: authUserId == null
                                                                    ? 'нужна связка'
                                                                    : attendanceLoading
                                                                        ? 'загрузка…'
                                                                        : formatVacationLateMinutesTotal(attendance?.lateMinutesTotal ?? 0) })] }), _jsxs("article", { className: "vac-emp-card__kpi vac-emp-card__kpi--absent", children: [_jsx("span", { className: "vac-emp-card__kpi-label", children: "\u0411\u0435\u0437 \u043F\u0440\u043E\u0445\u043E\u0434\u0430" }), _jsx("strong", { className: "vac-emp-card__kpi-value", children: authUserId == null
                                                                    ? '—'
                                                                    : attendanceLoading
                                                                        ? '…'
                                                                        : (attendance?.absentCount ?? 0) }), _jsx("span", { className: "vac-emp-card__kpi-sub", children: "\u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439" })] }), _jsxs("article", { className: "vac-emp-card__kpi", children: [_jsx("span", { className: "vac-emp-card__kpi-label", children: "\u0421\u0440\u0435\u0434. \u043E\u043F\u043E\u0437\u0434." }), _jsx("strong", { className: "vac-emp-card__kpi-value vac-emp-card__kpi-value--sm", children: authUserId == null || !attendance || attendance.lateCount === 0
                                                                    ? '—'
                                                                    : formatVacationLateMinutesTotal(Math.round(attendance.lateMinutesTotal / attendance.lateCount)) }), _jsx("span", { className: "vac-emp-card__kpi-sub", children: "\u043D\u0430 \u043E\u0434\u043D\u043E \u043E\u043F\u043E\u0437\u0434\u0430\u043D\u0438\u0435" })] })] }), absenceByKind.length > 0 && (_jsx("ul", { className: "vac-emp-card__kind-totals", "aria-label": "\u041F\u043E \u0432\u0438\u0434\u0430\u043C \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0439", children: absenceByKind.map(([label, count]) => (_jsxs("li", { className: "vac-emp-card__kind-total", children: [_jsx("span", { className: "vac-emp-card__kind-total-label", children: label }), _jsxs("span", { className: "vac-emp-card__kind-total-count", children: [count, " ", ruDaysWord(count)] })] }, label))) })), authUserId == null && (_jsx("p", { className: "vac-emp-card__hint", children: "\u041F\u0440\u0438\u0432\u044F\u0436\u0438\u0442\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u2014 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u043E\u043F\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0438 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F \u043F\u043E \u043F\u0440\u043E\u0445\u043E\u0434\u0430\u043C." })), attendanceError && (_jsx("p", { className: "vac-emp-card__hint vac-emp-card__hint--err", children: attendanceError })), !attendanceLoading && attendance && attendance.days.length > 0 && (_jsxs("details", { className: "vac-emp-card__att-details", children: [_jsxs("summary", { children: ["\u0414\u0435\u0442\u0430\u043B\u0438 \u043F\u043E\u0441\u0435\u0449\u0430\u0435\u043C\u043E\u0441\u0442\u0438 (", attendance.days.length, ")"] }), _jsx("ul", { className: "vac-emp-card__att-list", children: attendance.days.map((row) => (_jsxs("li", { className: `vac-emp-card__att-li vac-emp-card__att-li--${row.status}`, children: [_jsx("span", { className: "vac-emp-card__att-date", children: formatIsoDateRu(row.date) }), _jsx("span", { className: "vac-emp-card__att-status", children: row.status === 'late'
                                                                        ? (row.minutes != null && row.minutes > 0
                                                                            ? `Опоздание +${formatVacationLateMinutes(row.minutes)}`
                                                                            : 'Опоздание')
                                                                        : 'Без прохода' }), row.arrival && (_jsxs("span", { className: "vac-emp-card__att-meta", children: ["\u043F\u0440\u0438\u0445\u043E\u0434 ", row.arrival] })), row.explanation?.trim() && (_jsx("span", { className: "vac-emp-card__att-meta", title: row.explanation, children: row.explanation.trim() }))] }, `${row.date}-${row.status}`))) }), _jsxs("p", { className: "vac-emp-card__hint", children: ["\u041D\u043E\u0440\u043C\u0430 \u043F\u0440\u0438\u0445\u043E\u0434\u0430: ", workdaySettings.startTime, workdaySettings.lateMinutes > 0 ? ` (+${workdaySettings.lateMinutes} мин)` : '', ". \u0414\u043E \u0441\u0435\u0433\u043E\u0434\u043D\u044F\u0448\u043D\u0435\u0433\u043E \u0434\u043D\u044F \u0432 ", year, " \u0433."] })] }))] }), canEdit && (_jsxs("div", { className: "vac-emp-card__link-box", children: [_jsx("label", { className: "vac-emp-card__link-label", htmlFor: "vac-emp-auth-link", children: "\u0421\u0432\u044F\u0437\u043A\u0430 \u0441 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C \u0441\u0438\u0441\u0442\u0435\u043C\u044B" }), _jsxs("div", { className: "vac-emp-card__link-row", children: [_jsxs("select", { id: "vac-emp-auth-link", className: "vac-emp-card__link-select", value: selectedLinkUserId, disabled: linkSaving, onChange: (ev) => setSelectedLinkUserId(ev.target.value), children: [_jsx("option", { value: "", children: "\u041D\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D" }), linkOptions.map((opt) => (_jsxs("option", { value: opt.id, children: [opt.label, " (", opt.email, ")"] }, opt.id)))] }), _jsx("button", { type: "button", className: "vac-emp-card__link-save", disabled: linkSaving || (selectedLinkUserId ? Number(selectedLinkUserId) : null) === authUserId, onClick: () => void handleSaveAuthLink(), children: linkSaving ? 'Сохранение…' : 'Сохранить' })] })] })), _jsx("h3", { className: "vac-emp-card__sub", children: "\u0414\u043D\u0438 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0439" }), days.length === 0 ? (_jsx("p", { className: "vac-emp-card__empty", children: "\u041D\u0435\u0442 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0445 \u0434\u043D\u0435\u0439 \u0437\u0430 \u044D\u0442\u043E\u0442 \u0433\u043E\u0434." })) : (_jsx("ul", { className: "vac-emp-card__list", children: days.map((d) => {
                                            const ui = apiAbsenceKindToUi(d.kind);
                                            const label = ui ? vacationKindHumanLabel(ui) : d.kind;
                                            const rowKey = d.id != null ? String(d.id) : `${d.absence_on}-${d.kind}-${label}`;
                                            return (_jsxs("li", { className: "vac-emp-card__li", children: [_jsx("span", { className: "vac-emp-card__li-date", children: formatIsoDateRu(d.absence_on) }), _jsx("span", { className: "vac-emp-card__li-kind", children: label }), canEdit && d.id != null && (_jsx("button", { type: "button", className: "vac-emp-card__li-del", disabled: deletingId === d.id || deletingEmployee, onClick: () => void handleDeleteDay(d.id), children: deletingId === d.id ? '…' : 'Удалить' }))] }, rowKey));
                                        }) })), canViewDocs && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "vac-emp-card__sub", children: "\u0420\u0443\u0447\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 (\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F)" }), manualEntries.length === 0 ? (_jsx("p", { className: "vac-emp-card__empty", children: "\u041D\u0435\u0442 \u0440\u0443\u0447\u043D\u044B\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0441 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438 \u0437\u0430 \u044D\u0442\u043E\u0442 \u0433\u043E\u0434." })) : (_jsx("ul", { className: "vac-emp-card__entries", children: manualEntries.map((en) => (_jsxs("li", { className: "vac-emp-entry", children: [_jsxs("div", { className: "vac-emp-entry__head", children: [_jsx("span", { className: "vac-emp-entry__kind", children: en.label_ru || en.kind }), _jsxs("span", { className: "vac-emp-entry__period", children: [formatIsoDateRu(en.date_from), " \u2014 ", formatIsoDateRu(en.date_to)] })] }), en.reason?.trim() && (_jsx("p", { className: "vac-emp-entry__reason", children: en.reason })), en.created_by_name && (_jsxs("p", { className: "vac-emp-entry__author", children: ["\u0412\u043D\u0451\u0441: ", en.created_by_name] })), _jsx("ul", { className: "vac-emp-entry__docs", children: en.documents.length === 0 ? (_jsx("li", { className: "vac-emp-entry__doc vac-emp-entry__doc--empty", children: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442" })) : en.documents.map((doc) => (_jsxs("li", { className: "vac-emp-entry__doc", children: [_jsxs("button", { type: "button", className: "vac-emp-entry__doc-name", title: `Предпросмотр ${doc.original_filename}`, onClick: () => setPreview({ entryId: en.id, docId: doc.id, filename: doc.original_filename, contentType: doc.content_type }), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }), _jsx("span", { children: doc.original_filename })] }), canEdit && (_jsx("button", { type: "button", className: "vac-emp-entry__doc-del", disabled: busyEntryId === en.id, onClick: () => void handleDeleteDoc(en.id, doc.id), "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442", children: "\u00D7" }))] }, doc.id))) }), canEdit && (_jsx("div", { className: "vac-emp-entry__actions", children: _jsx("button", { type: "button", className: "vac-emp-entry__del", disabled: busyEntryId === en.id, onClick: () => void handleDeleteManualEntry(en.id), children: busyEntryId === en.id ? 'Удаление…' : 'Удалить запись' }) }))] }, en.id))) }))] })), canEdit && (_jsx("div", { className: "vac-emp-card__footer", children: _jsx("button", { type: "button", className: "vac-emp-card__del-employee", disabled: deletingEmployee || deletingId != null, onClick: () => void handleDeleteEmployee(), children: deletingEmployee ? 'Удаление…' : 'Удалить из графика' }) }))] }))] })] }), preview && (_jsx(VacationDocLightbox, { entryId: preview.entryId, docId: preview.docId, filename: preview.filename, contentType: preview.contentType, onClose: () => setPreview(null) }))] }), document.body);
}
