import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { exportAttendanceEmployeePeriodExcel, fetchAttendance, fetchDailyAttendanceReport, fetchPeriodAttendanceReport, } from '@entities/attendance';
import { resolveReportEmployeeInitials } from '@entities/time-tracking/lib/reportEmployeeInitials';
import { useI18n } from '@shared/i18n';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { formatTime } from '@shared/lib/formatDate';
import { DatePicker } from '@shared/ui/DatePicker';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useAppToast } from '@shared/ui';
const ALL_EMPLOYEE_KEY = 'all';
function employeeOptionKey(item) {
    const cameraNo = (item.camera_employee_no || '').trim();
    // Prefer camera id — works even when app_user mappings are empty.
    if (cameraNo)
        return `c:${cameraNo}`;
    if (item.app_user_id != null)
        return `u:${item.app_user_id}`;
    return '';
}
function matchesEmployeeSelection(item, selectedKey, selected) {
    if (selectedKey === ALL_EMPLOYEE_KEY)
        return true;
    if (selectedKey.startsWith('u:')) {
        if (item.app_user_id === Number(selectedKey.slice(2)))
            return true;
    }
    if (selectedKey.startsWith('c:')) {
        if ((item.camera_employee_no || '').trim() === selectedKey.slice(2))
            return true;
    }
    if (selected?.cameraEmployeeNo) {
        if ((item.camera_employee_no || '').trim() === selected.cameraEmployeeNo)
            return true;
    }
    if (selected?.appUserId != null && item.app_user_id === selected.appUserId)
        return true;
    if (selected?.name) {
        const n = selected.name.trim().toLowerCase();
        if ((item.display_name || '').trim().toLowerCase() === n)
            return true;
        if ((item.camera_name || '').trim().toLowerCase() === n)
            return true;
    }
    return false;
}
function iterYmdInclusive(from, to) {
    const out = [];
    const cur = parseYmd(from);
    const end = parseYmd(to);
    if (cur > end)
        return out;
    while (cur <= end) {
        out.push(toYmd(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}
function toYmd(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function parseYmd(value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y || 1970, Math.max(0, (m || 1) - 1), d || 1);
}
function startOfWeekMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
}
function weekDays(anchorYmd) {
    const monday = startOfWeekMonday(parseYmd(anchorYmd));
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return toYmd(d);
    });
}
function isEmployeeItem(item) {
    return !isPartnerOrgRole(item.role, item.position ?? item.department);
}
function matchesFilter(item, filter) {
    if (filter === 'all')
        return true;
    return item.status === filter;
}
function peopleWord(count, locale) {
    if (locale === 'en')
        return count === 1 ? 'person tracked' : 'people tracked';
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11)
        return 'человек в учёте';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
        return 'человека в учёте';
    return 'человек в учёте';
}
function formatDayHeading(ymd, locale) {
    const date = parseYmd(ymd);
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    const raw = new Intl.DateTimeFormat(tag, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}
function formatPeriodHeading(from, to, locale) {
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    const fmt = new Intl.DateTimeFormat(tag, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return `${fmt.format(parseYmd(from))} — ${fmt.format(parseYmd(to))}`;
}
function formatShortDate(ymd, locale) {
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(tag, {
        day: 'numeric',
        month: 'short',
    }).format(parseYmd(ymd));
}
function weekdayShort(ymd, locale) {
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(tag, { weekday: 'short' })
        .format(parseYmd(ymd))
        .replace('.', '');
}
function dayNumber(ymd) {
    return String(parseYmd(ymd).getDate());
}
function earliestArrival(items) {
    let min = null;
    let iso = null;
    for (const item of items) {
        if (!item.first_event_time)
            continue;
        const t = new Date(item.first_event_time).getTime();
        if (Number.isNaN(t))
            continue;
        if (min === null || t < min) {
            min = t;
            iso = item.first_event_time;
        }
    }
    return iso;
}
function formatHm(isoOrTime) {
    const parsed = new Date(isoOrTime);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    if (/^\d{1,2}:\d{2}/.test(isoOrTime))
        return isoOrTime.slice(0, 5);
    try {
        return formatTime(isoOrTime).slice(0, 5);
    }
    catch {
        return '—';
    }
}
function parseEventMs(isoOrTime) {
    if (!isoOrTime)
        return null;
    if (/^\d{1,2}:\d{2}/.test(isoOrTime)) {
        const [h, m] = isoOrTime.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m))
            return null;
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d.getTime();
    }
    const t = new Date(isoOrTime).getTime();
    return Number.isNaN(t) ? null : t;
}
function combineDayAndHm(dayYmd, hm) {
    if (!hm)
        return null;
    const m = hm.match(/^(\d{1,2}):(\d{2})/);
    if (!m)
        return parseEventMs(hm);
    const d = parseYmd(dayYmd);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d.getTime();
}
function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0)
        return '—';
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}
function workedHoursLabel(item, dayYmd, workdayEndHm) {
    const arrivalMs = parseEventMs(item.first_event_time);
    if (arrivalMs == null)
        return '—';
    const lastMs = parseEventMs(item.last_event_time ?? null);
    let endMs = lastMs != null && lastMs > arrivalMs ? lastMs : null;
    if (endMs == null) {
        const today = toYmd(new Date());
        if (dayYmd === today)
            endMs = Date.now();
        else
            endMs = combineDayAndHm(dayYmd, workdayEndHm ? formatHm(workdayEndHm) : '18:00');
    }
    if (endMs == null || endMs < arrivalMs)
        return '—';
    return formatDuration(endMs - arrivalMs);
}
function segmentTone(status) {
    if (status === 'late')
        return 'late';
    if (status === 'absent')
        return 'absent';
    return 'onTime';
}
function mergeEmployeeOptions(prev, source) {
    const byKey = new Map(prev.map((o) => [o.key, o]));
    for (const item of source) {
        const cameraNo = (item.camera_employee_no || '').trim();
        if (item.app_user_id == null && !cameraNo)
            continue;
        const key = employeeOptionKey(item);
        if (!key || key === 'c:')
            continue;
        const name = item.display_name || item.camera_name || (item.app_user_id != null
            ? `#${item.app_user_id}`
            : `Hikvision #${cameraNo}`);
        const existing = byKey.get(key);
        if (!existing || (name && name !== existing.name)) {
            byKey.set(key, {
                key,
                name,
                appUserId: item.app_user_id,
                cameraEmployeeNo: cameraNo,
            });
        }
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}
export function AttendanceOverviewCard() {
    const { t, locale } = useI18n();
    const { pushToast } = useAppToast();
    const today = useMemo(() => toYmd(new Date()), []);
    const [selectedDate, setSelectedDate] = useState(today);
    const [periodFrom, setPeriodFrom] = useState(today);
    const [periodTo, setPeriodTo] = useState(today);
    const [selectedEmployeeKey, setSelectedEmployeeKey] = useState(ALL_EMPLOYEE_KEY);
    const [filter, setFilter] = useState('all');
    const [items, setItems] = useState([]);
    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [workdayStart, setWorkdayStart] = useState(null);
    const [workdayEnd, setWorkdayEnd] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [exportBusy, setExportBusy] = useState(false);
    const isPeriodMode = periodFrom !== periodTo;
    const days = useMemo(() => weekDays(selectedDate), [selectedDate]);
    const selectedEmployee = useMemo(() => employeeOptions.find((o) => o.key === selectedEmployeeKey) ?? null, [employeeOptions, selectedEmployeeKey]);
    const canExportEmployeePeriod = selectedEmployeeKey !== ALL_EMPLOYEE_KEY && Boolean(selectedEmployee);
    const load = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            let nextItems = [];
            let nextWorkdayStart = null;
            let nextWorkdayEnd = null;
            if (periodFrom === periodTo) {
                const report = await fetchDailyAttendanceReport(periodFrom, signal);
                if (signal?.aborted)
                    return;
                const dayItems = report.items.filter(isEmployeeItem);
                nextItems = dayItems.map((item) => ({ ...item, date: periodFrom }));
                nextWorkdayStart = report.workday?.workday_start ?? null;
                nextWorkdayEnd = report.workday?.workday_end ?? null;
                setEmployeeOptions((prev) => mergeEmployeeOptions(prev, dayItems));
            }
            else {
                const selected = employeeOptions.find((o) => o.key === selectedEmployeeKey) ?? null;
                // Do not pass app_user_id while mappings may be empty — it returns an empty roster.
                // Always load the period from DB, then filter on the client by camera / name.
                const report = await fetchPeriodAttendanceReport(periodFrom, periodTo, {
                    appUserId: null,
                    signal,
                });
                if (signal?.aborted)
                    return;
                let periodItems = report.items.filter(isEmployeeItem);
                if (selectedEmployeeKey !== ALL_EMPLOYEE_KEY) {
                    periodItems = periodItems.filter((item) => (matchesEmployeeSelection(item, selectedEmployeeKey, selected)));
                }
                // If period rows exist but have no punch times, rebuild from daily reports.
                const missingTimes = periodItems.length > 0
                    && !periodItems.some((item) => Boolean(item.first_event_time));
                if (missingTimes || (selectedEmployeeKey !== ALL_EMPLOYEE_KEY && periodItems.length === 0)) {
                    const daysInRange = iterYmdInclusive(periodFrom, periodTo);
                    const dailyReports = await Promise.all(daysInRange.map((day) => fetchDailyAttendanceReport(day, signal)));
                    if (signal?.aborted)
                        return;
                    periodItems = dailyReports.flatMap((daily) => {
                        const day = daily.date || periodFrom;
                        return daily.items
                            .filter(isEmployeeItem)
                            .filter((item) => matchesEmployeeSelection(item, selectedEmployeeKey, selected))
                            .map((item) => ({ ...item, date: day }));
                    });
                    const wd = dailyReports.find((d) => d.workday)?.workday;
                    if (wd) {
                        nextWorkdayStart = wd.workday_start ?? null;
                        nextWorkdayEnd = wd.workday_end ?? null;
                    }
                }
                nextItems = periodItems.map((item) => ({
                    ...item,
                    date: item.date || periodFrom,
                }));
                if (!nextWorkdayStart)
                    nextWorkdayStart = report.workday?.workday_start ?? null;
                if (!nextWorkdayEnd)
                    nextWorkdayEnd = report.workday?.workday_end ?? null;
                setEmployeeOptions((prev) => mergeEmployeeOptions(prev, periodItems));
            }
            setItems(nextItems);
            setWorkdayStart(nextWorkdayStart);
            setWorkdayEnd(nextWorkdayEnd);
        }
        catch (e) {
            if (signal?.aborted)
                return;
            setItems([]);
            setWorkdayStart(null);
            setWorkdayEnd(null);
            setError(e instanceof Error ? e.message : t('attendancePage.errors.loadFailed'));
        }
        finally {
            if (!signal?.aborted)
                setLoading(false);
        }
    }, [periodFrom, periodTo, selectedEmployeeKey, t]);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);
    const visibleItems = useMemo(() => {
        let rows = items.filter((item) => matchesFilter(item, filter));
        if (selectedEmployeeKey !== ALL_EMPLOYEE_KEY) {
            const selected = employeeOptions.find((o) => o.key === selectedEmployeeKey) ?? null;
            rows = rows.filter((item) => matchesEmployeeSelection(item, selectedEmployeeKey, selected));
        }
        return rows;
    }, [filter, items, selectedEmployeeKey, employeeOptions]);
    const employeeSelectItems = useMemo(() => {
        const allLabel = t('attendancePage.filterAll');
        return [
            {
                key: ALL_EMPLOYEE_KEY,
                name: allLabel,
                appUserId: null,
                cameraEmployeeNo: '',
            },
            ...employeeOptions,
        ];
    }, [employeeOptions, t]);
    const segments = useMemo(() => {
        if (isPeriodMode)
            return [];
        const ordered = [...visibleItems].sort((a, b) => {
            const rank = (s) => (s === 'late' ? 0 : s === 'absent' ? 1 : 2);
            return rank(a.status) - rank(b.status);
        });
        return ordered.map((item) => {
            const title = item.display_name || item.camera_name || '—';
            const initials = resolveReportEmployeeInitials({
                displayName: item.display_name || item.camera_name,
                email: item.email,
            }) || '?';
            return {
                key: `${item.app_user_id ?? item.camera_employee_no}-${item.status}`,
                tone: segmentTone(item.status),
                title,
                initials,
            };
        });
    }, [visibleItems, isPeriodMode]);
    const listRows = useMemo(() => {
        const ranked = [...visibleItems].sort((a, b) => {
            if (isPeriodMode) {
                const byDate = a.date.localeCompare(b.date);
                if (byDate !== 0)
                    return byDate;
            }
            const rank = (s) => (s === 'late' ? 0 : s === 'absent' ? 1 : 2);
            const byStatus = rank(a.status) - rank(b.status);
            if (byStatus !== 0)
                return byStatus;
            const ta = parseEventMs(a.first_event_time) ?? Number.POSITIVE_INFINITY;
            const tb = parseEventMs(b.first_event_time) ?? Number.POSITIVE_INFINITY;
            if (ta !== tb)
                return ta - tb;
            return (a.display_name || '').localeCompare(b.display_name || '', locale === 'en' ? 'en' : 'ru');
        });
        return ranked.map((item) => {
            const name = item.display_name || item.camera_name || '—';
            const subtitle = (item.position
                || item.department
                || item.role
                || '').trim();
            const arrival = item.first_event_time ? formatHm(item.first_event_time) : '—';
            const departure = item.last_event_time ? formatHm(item.last_event_time) : '—';
            return {
                key: `${item.date}-${item.app_user_id ?? item.camera_employee_no}-${item.status}`,
                date: item.date,
                name,
                dept: subtitle,
                arrival,
                departure,
                hours: workedHoursLabel(item, item.date, workdayEnd),
                status: item.status,
                statusLabel: item.status === 'late'
                    ? t('attendancePage.arrival.late')
                    : item.status === 'absent'
                        ? t('attendancePage.arrival.absent')
                        : null,
            };
        });
    }, [visibleItems, workdayEnd, locale, isPeriodMode, t]);
    const dayStartLabel = useMemo(() => {
        const fromEvents = earliestArrival(visibleItems.filter((i) => i.status !== 'absent'));
        if (fromEvents)
            return formatHm(fromEvents);
        if (workdayStart)
            return formatHm(workdayStart);
        return null;
    }, [visibleItems, workdayStart]);
    const selectDay = (ymd) => {
        setSelectedDate(ymd);
        setPeriodFrom(ymd);
        setPeriodTo(ymd);
    };
    const shiftWeek = (delta) => {
        const d = parseYmd(selectedDate);
        d.setDate(d.getDate() + delta * 7);
        const next = toYmd(d);
        setSelectedDate(next);
        if (!isPeriodMode) {
            setPeriodFrom(next);
            setPeriodTo(next);
        }
    };
    const onPeriodFromChange = (value) => {
        if (!value)
            return;
        setPeriodFrom(value);
        setSelectedDate(value);
        if (value > periodTo)
            setPeriodTo(value);
    };
    const onPeriodToChange = (value) => {
        if (!value)
            return;
        setPeriodTo(value);
        if (value < periodFrom)
            setPeriodFrom(value);
        setSelectedDate(value);
    };
    const handleExportEmployeeExcel = async () => {
        if (!canExportEmployeePeriod || !selectedEmployee) {
            pushToast({
                message: t('attendancePage.errors.exportSelectEmployee'),
                variant: 'warning',
            });
            return;
        }
        setExportBusy(true);
        try {
            const exportRows = items.filter((item) => (matchesEmployeeSelection(item, selectedEmployeeKey, selectedEmployee)));
            let rawMarks = [];
            const personId = selectedEmployee.cameraEmployeeNo.trim();
            if (personId) {
                try {
                    rawMarks = await fetchAttendance({
                        dateFrom: periodFrom,
                        dateTo: periodTo,
                        personId,
                        maxRecordsPerDevice: 5000,
                    });
                }
                catch {
                    rawMarks = [];
                }
            }
            await exportAttendanceEmployeePeriodExcel({
                employeeName: selectedEmployee.name,
                dateFrom: periodFrom,
                dateTo: periodTo,
                items: exportRows,
                rawMarks,
            });
        }
        catch (e) {
            pushToast({
                message: e instanceof Error ? e.message : t('attendancePage.errors.exportFailed'),
                variant: 'error',
            });
        }
        finally {
            setExportBusy(false);
        }
    };
    const filters = [
        { id: 'all', label: t('attendancePage.filterAll') },
        { id: 'present_on_time', label: t('attendancePage.filter.onTime') },
        { id: 'late', label: t('attendancePage.filter.late') },
        { id: 'absent', label: t('attendancePage.filter.absent') },
    ];
    const heading = isPeriodMode
        ? formatPeriodHeading(periodFrom, periodTo, locale)
        : formatDayHeading(periodFrom, locale);
    const metaCountLabel = isPeriodMode
        ? (locale === 'en'
            ? `${visibleItems.length} records`
            : `${visibleItems.length} записей`)
        : `${visibleItems.length} ${peopleWord(visibleItems.length, locale)}`;
    return (_jsxs("section", { className: "att-overview", "aria-label": t('attendancePage.title'), children: [_jsxs("header", { className: "att-overview__head", children: [_jsxs("div", { className: "att-overview__titles", children: [_jsx("h2", { className: "att-overview__title", children: t('attendancePage.title') }), _jsx("p", { className: "att-overview__date", children: heading })] }), _jsx("div", { className: "att-overview__filters", role: "tablist", "aria-label": t('attendancePage.type'), children: filters.map((f) => (_jsx("button", { type: "button", role: "tab", "aria-selected": filter === f.id, className: `att-overview__chip${filter === f.id ? ' att-overview__chip--active' : ''}`, onClick: () => setFilter(f.id), children: f.label }, f.id))) })] }), _jsxs("div", { className: "att-overview__controls", children: [_jsxs("div", { className: "att-overview__field", children: [_jsx("span", { id: "att-overview-from-lbl", children: t('attendancePage.periodFrom') }), _jsx(DatePicker, { id: "att-overview-from", className: "att-overview__datepicker", buttonClassName: "att-overview__datepicker-btn", value: periodFrom, max: periodTo, onChange: onPeriodFromChange, portal: true, portalZIndex: 12000, showChevron: true, "aria-labelledby": "att-overview-from-lbl" })] }), _jsxs("div", { className: "att-overview__field", children: [_jsx("span", { id: "att-overview-to-lbl", children: t('attendancePage.periodTo') }), _jsx(DatePicker, { id: "att-overview-to", className: "att-overview__datepicker", buttonClassName: "att-overview__datepicker-btn", value: periodTo, min: periodFrom, onChange: onPeriodToChange, portal: true, portalZIndex: 12000, showChevron: true, "aria-labelledby": "att-overview-to-lbl" })] }), _jsxs("div", { className: "att-overview__field att-overview__field--grow", children: [_jsx("span", { id: "att-overview-employee-lbl", children: t('attendancePage.table.employee') }), _jsx(SearchableSelect, { className: "att-overview__employee-select", buttonClassName: "att-overview__employee-btn", portalDropdown: true, portalZIndex: 12000, portalMinWidth: 280, "aria-labelledby": "att-overview-employee-lbl", placeholder: t('attendancePage.selectPlaceholder'), emptyListText: locale === 'en' ? 'No employees' : 'Нет сотрудников', noMatchText: locale === 'en' ? 'Nothing found' : 'Ничего не найдено', value: selectedEmployeeKey, items: employeeSelectItems, getOptionValue: (o) => o.key, getOptionLabel: (o) => o.name, getSearchText: (o) => o.name, onSelect: (o) => setSelectedEmployeeKey(o.key) })] }), _jsxs("div", { className: "att-overview__field att-overview__field--action", children: [_jsx("span", { className: "att-overview__field-spacer", "aria-hidden": true, children: "\u00A0" }), _jsx("button", { type: "button", className: "att-overview__excel-btn", disabled: loading || exportBusy || !canExportEmployeePeriod, title: canExportEmployeePeriod
                                    ? t('attendancePage.export.excelHint')
                                    : t('attendancePage.errors.exportSelectEmployee'), onClick: () => void handleExportEmployeeExcel(), children: exportBusy
                                    ? t('attendancePage.export.excelBusy')
                                    : t('attendancePage.export.excelEmployeePeriod') })] })] }), _jsxs("div", { className: "att-overview__week", "aria-label": locale === 'en' ? 'Week' : 'Неделя', children: [_jsx("button", { type: "button", className: "att-overview__nav", "aria-label": locale === 'en' ? 'Previous week' : 'Предыдущая неделя', onClick: () => shiftWeek(-1), children: "\u2039" }), _jsx("div", { className: "att-overview__days", children: days.map((ymd) => {
                            const active = !isPeriodMode && ymd === periodFrom;
                            return (_jsxs("button", { type: "button", className: `att-overview__day${active ? ' att-overview__day--active' : ''}`, "aria-pressed": active, onClick: () => selectDay(ymd), children: [_jsx("span", { className: "att-overview__dow", children: weekdayShort(ymd, locale) }), _jsx("span", { className: "att-overview__dom", children: dayNumber(ymd) })] }, ymd));
                        }) }), _jsx("button", { type: "button", className: "att-overview__nav", "aria-label": locale === 'en' ? 'Next week' : 'Следующая неделя', onClick: () => shiftWeek(1), children: "\u203A" })] }), error ? (_jsxs("div", { className: "att-overview__error", role: "alert", children: [_jsx("span", { children: error }), _jsx("button", { type: "button", onClick: () => void load(), children: t('attendancePage.retry') })] })) : (_jsxs(_Fragment, { children: [!isPeriodMode ? (_jsx("div", { className: `att-overview__bar${loading ? ' att-overview__bar--loading' : ''}`, role: "img", "aria-label": loading
                            ? (locale === 'en' ? 'Loading attendance' : 'Загрузка посещаемости')
                            : `${visibleItems.length} ${peopleWord(visibleItems.length, locale)}`, children: loading
                            ? Array.from({ length: 24 }, (_, i) => (_jsx("span", { className: "att-overview__seg att-overview__seg--skel" }, i)))
                            : segments.length > 0
                                ? segments.map((seg) => (_jsx("span", { className: `att-overview__seg att-overview__seg--${seg.tone}`, title: seg.title, "aria-label": seg.title, children: _jsx("span", { className: "att-overview__seg-ini", "aria-hidden": true, children: seg.initials }) }, seg.key)))
                                : (_jsx("span", { className: "att-overview__bar-empty", children: locale === 'en' ? 'No employees for this day' : 'Нет сотрудников за этот день' })) })) : null, _jsxs("div", { className: "att-overview__meta", children: [_jsx("span", { children: loading ? '…' : metaCountLabel }), !isPeriodMode ? (_jsxs("span", { children: [locale === 'en' ? 'Day start — ' : 'Начало дня — ', loading ? '…' : (dayStartLabel ?? '—')] })) : null] }), !loading && listRows.length > 0 ? (_jsx("div", { className: "att-overview__list-wrap", children: _jsxs("table", { className: `att-overview__list${isPeriodMode ? ' att-overview__list--period' : ''}`, children: [_jsx("thead", { children: _jsxs("tr", { children: [isPeriodMode ? (_jsx("th", { scope: "col", children: t('attendancePage.table.date') })) : null, _jsx("th", { scope: "col", children: t('attendancePage.table.employee') }), _jsx("th", { scope: "col", children: t('attendancePage.table.arrival') }), _jsx("th", { scope: "col", children: t('attendancePage.table.departure') }), _jsx("th", { scope: "col", children: t('attendancePage.table.hours') })] }) }), _jsx("tbody", { children: listRows.map((row) => (_jsxs("tr", { className: `att-overview__list-row att-overview__list-row--${row.status === 'late'
                                            ? 'late'
                                            : row.status === 'absent'
                                                ? 'absent'
                                                : 'onTime'}`, children: [isPeriodMode ? (_jsx("td", { className: "att-overview__date-cell", children: formatShortDate(row.date, locale) })) : null, _jsx("td", { children: _jsxs("div", { className: "att-overview__person", children: [_jsxs("div", { className: "att-overview__person-top", children: [_jsx("span", { className: "att-overview__person-name", children: row.name }), row.statusLabel ? (_jsx("span", { className: `att-overview__status-tag att-overview__status-tag--${row.status === 'late' ? 'late' : 'absent'}`, children: row.statusLabel })) : null] }), row.dept ? (_jsx("span", { className: "att-overview__person-dept", children: row.dept })) : null] }) }), _jsx("td", { className: row.status === 'late' ? 'att-overview__arrival' : undefined, children: row.arrival }), _jsx("td", { children: row.departure }), _jsx("td", { children: row.hours })] }, row.key))) })] }) })) : null] }))] }));
}
