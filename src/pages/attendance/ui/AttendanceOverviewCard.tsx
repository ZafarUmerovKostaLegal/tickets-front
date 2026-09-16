import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchDailyAttendanceReport,
    fetchPeriodAttendanceReport,
    type AttendanceStatus,
    type DailyAttendanceItem,
    type PeriodAttendanceItem,
} from '@entities/attendance';
import { resolveReportEmployeeInitials } from '@entities/time-tracking/lib/reportEmployeeInitials';
import { useI18n } from '@shared/i18n';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { formatTime } from '@shared/lib/formatDate';

export type AttendanceStatusFilter = 'all' | AttendanceStatus;

type ListItem = DailyAttendanceItem & { date: string };

type EmployeeOption = {
    id: number;
    name: string;
};

function toYmd(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseYmd(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y || 1970, Math.max(0, (m || 1) - 1), d || 1);
}

function startOfWeekMonday(date: Date): Date {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
}

function weekDays(anchorYmd: string): string[] {
    const monday = startOfWeekMonday(parseYmd(anchorYmd));
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return toYmd(d);
    });
}

function isEmployeeItem(item: DailyAttendanceItem): boolean {
    return !isPartnerOrgRole(item.role, item.department);
}

function matchesFilter(item: DailyAttendanceItem, filter: AttendanceStatusFilter): boolean {
    if (filter === 'all')
        return true;
    return item.status === filter;
}

function peopleWord(count: number, locale: string): string {
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

function formatDayHeading(ymd: string, locale: string): string {
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

function formatPeriodHeading(from: string, to: string, locale: string): string {
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    const fmt = new Intl.DateTimeFormat(tag, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return `${fmt.format(parseYmd(from))} — ${fmt.format(parseYmd(to))}`;
}

function formatShortDate(ymd: string, locale: string): string {
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(tag, {
        day: 'numeric',
        month: 'short',
    }).format(parseYmd(ymd));
}

function weekdayShort(ymd: string, locale: string): string {
    const tag = locale === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(tag, { weekday: 'short' })
        .format(parseYmd(ymd))
        .replace('.', '');
}

function dayNumber(ymd: string): string {
    return String(parseYmd(ymd).getDate());
}

function earliestArrival(items: DailyAttendanceItem[]): string | null {
    let min: number | null = null;
    let iso: string | null = null;
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

function formatHm(isoOrTime: string): string {
    if (/^\d{1,2}:\d{2}/.test(isoOrTime))
        return isoOrTime.slice(0, 5);
    try {
        return new Date(isoOrTime).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return formatTime(isoOrTime).slice(0, 5);
    }
}

function parseEventMs(isoOrTime: string | null | undefined): number | null {
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

function combineDayAndHm(dayYmd: string, hm: string | null): number | null {
    if (!hm)
        return null;
    const m = hm.match(/^(\d{1,2}):(\d{2})/);
    if (!m)
        return parseEventMs(hm);
    const d = parseYmd(dayYmd);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d.getTime();
}

function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0)
        return '—';
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

function workedHoursLabel(
    item: DailyAttendanceItem,
    dayYmd: string,
    workdayEndHm: string | null,
): string {
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

type SegmentTone = 'onTime' | 'late' | 'absent';

function segmentTone(status: AttendanceStatus): SegmentTone {
    if (status === 'late')
        return 'late';
    if (status === 'absent')
        return 'absent';
    return 'onTime';
}

function mergeEmployeeOptions(
    prev: EmployeeOption[],
    source: DailyAttendanceItem[],
): EmployeeOption[] {
    const byId = new Map(prev.map((o) => [o.id, o]));
    for (const item of source) {
        if (item.app_user_id == null)
            continue;
        const name = item.display_name || item.camera_name || `#${item.app_user_id}`;
        const existing = byId.get(item.app_user_id);
        if (!existing || (name && name !== existing.name))
            byId.set(item.app_user_id, { id: item.app_user_id, name });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function AttendanceOverviewCard() {
    const { t, locale } = useI18n();
    const today = useMemo(() => toYmd(new Date()), []);
    const [selectedDate, setSelectedDate] = useState(today);
    const [periodFrom, setPeriodFrom] = useState(today);
    const [periodTo, setPeriodTo] = useState(today);
    const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all');
    const [filter, setFilter] = useState<AttendanceStatusFilter>('all');
    const [items, setItems] = useState<ListItem[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
    const [workdayStart, setWorkdayStart] = useState<string | null>(null);
    const [workdayEnd, setWorkdayEnd] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isPeriodMode = periodFrom !== periodTo;
    const days = useMemo(() => weekDays(selectedDate), [selectedDate]);

    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            let nextItems: ListItem[] = [];
            let nextWorkdayStart: string | null = null;
            let nextWorkdayEnd: string | null = null;

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
                const appUserId = selectedUserId === 'all' ? null : selectedUserId;
                const report = await fetchPeriodAttendanceReport(periodFrom, periodTo, {
                    appUserId,
                    signal,
                });
                if (signal?.aborted)
                    return;
                const periodItems = (report.items as PeriodAttendanceItem[]).filter(isEmployeeItem);
                nextItems = periodItems.map((item) => ({
                    ...item,
                    date: item.date || periodFrom,
                }));
                nextWorkdayStart = report.workday?.workday_start ?? null;
                nextWorkdayEnd = report.workday?.workday_end ?? null;
                if (selectedUserId === 'all')
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
    }, [periodFrom, periodTo, selectedUserId, t]);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const visibleItems = useMemo(() => {
        let rows = items.filter((item) => matchesFilter(item, filter));
        if (!isPeriodMode && selectedUserId !== 'all')
            rows = rows.filter((item) => item.app_user_id === selectedUserId);
        return rows;
    }, [filter, items, isPeriodMode, selectedUserId]);

    const segments = useMemo(() => {
        if (isPeriodMode)
            return [];
        const ordered = [...visibleItems].sort((a, b) => {
            const rank = (s: AttendanceStatus) => (s === 'late' ? 0 : s === 'absent' ? 1 : 2);
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
            const rank = (s: AttendanceStatus) => (s === 'late' ? 0 : s === 'absent' ? 1 : 2);
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
            const dept = (item.department || '').trim() || '—';
            const arrival = item.first_event_time ? formatHm(item.first_event_time) : '—';
            const departure = item.last_event_time ? formatHm(item.last_event_time) : '—';
            return {
                key: `${item.date}-${item.app_user_id ?? item.camera_employee_no}-${item.status}`,
                date: item.date,
                name,
                dept,
                arrival,
                departure,
                hours: workedHoursLabel(item, item.date, workdayEnd),
                status: item.status,
            };
        });
    }, [visibleItems, workdayEnd, locale, isPeriodMode]);

    const dayStartLabel = useMemo(() => {
        const fromEvents = earliestArrival(visibleItems.filter((i) => i.status !== 'absent'));
        if (fromEvents)
            return formatHm(fromEvents);
        if (workdayStart)
            return formatHm(workdayStart);
        return null;
    }, [visibleItems, workdayStart]);

    const selectDay = (ymd: string) => {
        setSelectedDate(ymd);
        setPeriodFrom(ymd);
        setPeriodTo(ymd);
    };

    const shiftWeek = (delta: number) => {
        const d = parseYmd(selectedDate);
        d.setDate(d.getDate() + delta * 7);
        const next = toYmd(d);
        setSelectedDate(next);
        if (!isPeriodMode) {
            setPeriodFrom(next);
            setPeriodTo(next);
        }
    };

    const onPeriodFromChange = (value: string) => {
        if (!value)
            return;
        setPeriodFrom(value);
        setSelectedDate(value);
        if (value > periodTo)
            setPeriodTo(value);
    };

    const onPeriodToChange = (value: string) => {
        if (!value)
            return;
        setPeriodTo(value);
        if (value < periodFrom)
            setPeriodFrom(value);
        setSelectedDate(value);
    };

    const filters: { id: AttendanceStatusFilter; label: string }[] = [
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

    return (
        <section className="att-overview" aria-label={t('attendancePage.title')}>
            <header className="att-overview__head">
                <div className="att-overview__titles">
                    <h2 className="att-overview__title">{t('attendancePage.title')}</h2>
                    <p className="att-overview__date">{heading}</p>
                </div>
                <div className="att-overview__filters" role="tablist" aria-label={t('attendancePage.type')}>
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            role="tab"
                            aria-selected={filter === f.id}
                            className={`att-overview__chip${filter === f.id ? ' att-overview__chip--active' : ''}`}
                            onClick={() => setFilter(f.id)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="att-overview__controls">
                <label className="att-overview__field">
                    <span>{t('attendancePage.periodFrom')}</span>
                    <input
                        type="date"
                        value={periodFrom}
                        max={periodTo}
                        onChange={(e) => onPeriodFromChange(e.target.value)}
                    />
                </label>
                <label className="att-overview__field">
                    <span>{t('attendancePage.periodTo')}</span>
                    <input
                        type="date"
                        value={periodTo}
                        min={periodFrom}
                        onChange={(e) => onPeriodToChange(e.target.value)}
                    />
                </label>
                <label className="att-overview__field att-overview__field--grow">
                    <span>{t('attendancePage.table.employee')}</span>
                    <select
                        value={selectedUserId === 'all' ? 'all' : String(selectedUserId)}
                        onChange={(e) => {
                            const v = e.target.value;
                            setSelectedUserId(v === 'all' ? 'all' : Number(v));
                        }}
                    >
                        <option value="all">{t('attendancePage.filterAll')}</option>
                        {employeeOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="att-overview__week" aria-label={locale === 'en' ? 'Week' : 'Неделя'}>
                <button
                    type="button"
                    className="att-overview__nav"
                    aria-label={locale === 'en' ? 'Previous week' : 'Предыдущая неделя'}
                    onClick={() => shiftWeek(-1)}
                >
                    ‹
                </button>
                <div className="att-overview__days">
                    {days.map((ymd) => {
                        const active = !isPeriodMode && ymd === periodFrom;
                        return (
                            <button
                                key={ymd}
                                type="button"
                                className={`att-overview__day${active ? ' att-overview__day--active' : ''}`}
                                aria-pressed={active}
                                onClick={() => selectDay(ymd)}
                            >
                                <span className="att-overview__dow">{weekdayShort(ymd, locale)}</span>
                                <span className="att-overview__dom">{dayNumber(ymd)}</span>
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    className="att-overview__nav"
                    aria-label={locale === 'en' ? 'Next week' : 'Следующая неделя'}
                    onClick={() => shiftWeek(1)}
                >
                    ›
                </button>
            </div>

            {error ? (
                <div className="att-overview__error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => void load()}>
                        {t('attendancePage.retry')}
                    </button>
                </div>
            ) : (
                <>
                    {!isPeriodMode ? (
                        <div
                            className={`att-overview__bar${loading ? ' att-overview__bar--loading' : ''}`}
                            role="img"
                            aria-label={
                                loading
                                    ? (locale === 'en' ? 'Loading attendance' : 'Загрузка посещаемости')
                                    : `${visibleItems.length} ${peopleWord(visibleItems.length, locale)}`
                            }
                        >
                            {loading
                                ? Array.from({ length: 24 }, (_, i) => (
                                    <span key={i} className="att-overview__seg att-overview__seg--skel" />
                                ))
                                : segments.length > 0
                                    ? segments.map((seg) => (
                                        <span
                                            key={seg.key}
                                            className={`att-overview__seg att-overview__seg--${seg.tone}`}
                                            title={seg.title}
                                            aria-label={seg.title}
                                        >
                                            <span className="att-overview__seg-ini" aria-hidden>
                                                {seg.initials}
                                            </span>
                                        </span>
                                    ))
                                    : (
                                        <span className="att-overview__bar-empty">
                                            {locale === 'en' ? 'No employees for this day' : 'Нет сотрудников за этот день'}
                                        </span>
                                    )}
                        </div>
                    ) : null}

                    <div className="att-overview__meta">
                        <span>
                            {loading ? '…' : metaCountLabel}
                        </span>
                        {!isPeriodMode ? (
                            <span>
                                {locale === 'en' ? 'Day start — ' : 'Начало дня — '}
                                {loading ? '…' : (dayStartLabel ?? '—')}
                            </span>
                        ) : null}
                    </div>

                    {!loading && listRows.length > 0 ? (
                        <div className="att-overview__list-wrap">
                            <table className={`att-overview__list${isPeriodMode ? ' att-overview__list--period' : ''}`}>
                                <thead>
                                    <tr>
                                        {isPeriodMode ? (
                                            <th scope="col">{t('attendancePage.table.date')}</th>
                                        ) : null}
                                        <th scope="col">{t('attendancePage.table.employee')}</th>
                                        <th scope="col">{t('attendancePage.table.arrival')}</th>
                                        <th scope="col">{t('attendancePage.table.departure')}</th>
                                        <th scope="col">{t('attendancePage.table.hours')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listRows.map((row) => (
                                        <tr
                                            key={row.key}
                                            className={`att-overview__list-row att-overview__list-row--${
                                                row.status === 'late'
                                                    ? 'late'
                                                    : row.status === 'absent'
                                                        ? 'absent'
                                                        : 'onTime'
                                            }`}
                                        >
                                            {isPeriodMode ? (
                                                <td className="att-overview__date-cell">
                                                    {formatShortDate(row.date, locale)}
                                                </td>
                                            ) : null}
                                            <td>
                                                <div className="att-overview__person">
                                                    <span className="att-overview__person-name">{row.name}</span>
                                                    <span className="att-overview__person-dept">{row.dept}</span>
                                                </div>
                                            </td>
                                            <td>{row.arrival}</td>
                                            <td>{row.departure}</td>
                                            <td>{row.hours}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </>
            )}
        </section>
    );
}
