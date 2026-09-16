import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchDailyAttendanceReport,
    type AttendanceStatus,
    type DailyAttendanceItem,
} from '@entities/attendance';
import { resolveReportEmployeeInitials } from '@entities/time-tracking/lib/reportEmployeeInitials';
import { useI18n } from '@shared/i18n';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { formatTime } from '@shared/lib/formatDate';

export type AttendanceStatusFilter = 'all' | AttendanceStatus;

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

type SegmentTone = 'onTime' | 'late' | 'absent';

function segmentTone(status: AttendanceStatus): SegmentTone {
    if (status === 'late')
        return 'late';
    if (status === 'absent')
        return 'absent';
    return 'onTime';
}

export function AttendanceOverviewCard() {
    const { t, locale } = useI18n();
    const [selectedDate, setSelectedDate] = useState(() => toYmd(new Date()));
    const [filter, setFilter] = useState<AttendanceStatusFilter>('all');
    const [items, setItems] = useState<DailyAttendanceItem[]>([]);
    const [workdayStart, setWorkdayStart] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const days = useMemo(() => weekDays(selectedDate), [selectedDate]);

    const load = useCallback(async (day: string, signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            const report = await fetchDailyAttendanceReport(day, signal);
            if (signal?.aborted)
                return;
            setItems(report.items.filter(isEmployeeItem));
            setWorkdayStart(report.workday?.workday_start ?? null);
        }
        catch (e) {
            if (signal?.aborted)
                return;
            setItems([]);
            setWorkdayStart(null);
            setError(e instanceof Error ? e.message : t('attendancePage.errors.loadFailed'));
        }
        finally {
            if (!signal?.aborted)
                setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        const controller = new AbortController();
        void load(selectedDate, controller.signal);
        return () => controller.abort();
    }, [load, selectedDate]);

    const visibleItems = useMemo(
        () => items.filter((item) => matchesFilter(item, filter)),
        [filter, items],
    );

    const segments = useMemo(() => {
        const ordered = [...visibleItems].sort((a, b) => {
            const rank = (s: AttendanceStatus) => (s === 'present_on_time' ? 0 : s === 'late' ? 1 : 2);
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
    }, [visibleItems]);

    const dayStartLabel = useMemo(() => {
        const fromEvents = earliestArrival(items.filter((i) => i.status !== 'absent'));
        if (fromEvents)
            return formatHm(fromEvents);
        if (workdayStart)
            return formatHm(workdayStart);
        return null;
    }, [items, workdayStart]);

    const shiftWeek = (delta: number) => {
        const d = parseYmd(selectedDate);
        d.setDate(d.getDate() + delta * 7);
        setSelectedDate(toYmd(d));
    };

    const filters: { id: AttendanceStatusFilter; label: string }[] = [
        { id: 'all', label: t('attendancePage.filterAll') },
        { id: 'present_on_time', label: t('attendancePage.filter.onTime') },
        { id: 'late', label: t('attendancePage.filter.late') },
        { id: 'absent', label: t('attendancePage.filter.absent') },
    ];

    return (
        <section className="att-overview" aria-label={t('attendancePage.title')}>
            <header className="att-overview__head">
                <div className="att-overview__titles">
                    <h2 className="att-overview__title">{t('attendancePage.title')}</h2>
                    <p className="att-overview__date">{formatDayHeading(selectedDate, locale)}</p>
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
                        const active = ymd === selectedDate;
                        return (
                            <button
                                key={ymd}
                                type="button"
                                className={`att-overview__day${active ? ' att-overview__day--active' : ''}`}
                                aria-pressed={active}
                                onClick={() => setSelectedDate(ymd)}
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
                    <button type="button" onClick={() => void load(selectedDate)}>
                        {t('attendancePage.retry')}
                    </button>
                </div>
            ) : (
                <>
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

                    <div className="att-overview__meta">
                        <span>
                            {loading
                                ? '…'
                                : `${visibleItems.length} ${peopleWord(visibleItems.length, locale)}`}
                        </span>
                        <span>
                            {locale === 'en' ? 'Day start — ' : 'Начало дня — '}
                            {loading ? '…' : (dayStartLabel ?? '—')}
                        </span>
                    </div>
                </>
            )}
        </section>
    );
}
