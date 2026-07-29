import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatTime } from '@shared/lib/formatDate';
import { useI18n } from '@shared/i18n';
import type { GroupedRow } from '../model/types';

function parseYmd(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year || new Date().getFullYear(), Math.max(0, (month || 1) - 1), day || 1);
}

function toYmd(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export function AttendanceMonthCalendar({
    selectedDate,
    onSelectDate,
}: {
    selectedDate: string;
    onSelectDate: (date: string) => void;
}) {
    const { locale } = useI18n();
    const selected = useMemo(() => parseYmd(selectedDate), [selectedDate]);
    const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

    useEffect(() => {
        setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }, [selected]);

    const localeTag = locale === 'en' ? 'en-US' : 'ru-RU';
    const monthTitle = new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(visibleMonth);
    const weekDays = useMemo(() => {
        const monday = new Date(2024, 0, 1);
        return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeTag, { weekday: 'short' })
            .format(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index))
            .replace('.', ''));
    }, [localeTag]);
    const cells = useMemo(() => {
        const year = visibleMonth.getFullYear();
        const month = visibleMonth.getMonth();
        const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: 42 }, (_, index) => {
            const day = index - firstDayOffset + 1;
            return day >= 1 && day <= daysInMonth ? new Date(year, month, day) : null;
        });
    }, [visibleMonth]);
    const todayYmd = toYmd(new Date());

    const moveMonth = (delta: number) => {
        setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    };

    return (<section className="att-daily__calendar" aria-label={monthTitle}>
        <div className="att-daily__calendar-head">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Предыдущий месяц">‹</button>
            <h2>{monthTitle}</h2>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Следующий месяц">›</button>
        </div>
        <div className="att-daily__weekdays" aria-hidden>
            {weekDays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="att-daily__calendar-grid">
            {cells.map((date, index) => date ? (() => {
                const ymd = toYmd(date);
                const active = ymd === selectedDate;
                const today = ymd === todayYmd;
                return (<button
                    key={ymd}
                    type="button"
                    className={`${active ? 'att-daily__day--active' : ''}${today ? ' att-daily__day--today' : ''}`}
                    aria-pressed={active}
                    onClick={() => onSelectDate(ymd)}
                >{date.getDate()}</button>);
            })() : <span key={`blank-${index}`} />)}
        </div>
    </section>);
}

type StatusColumn = {
    key: 'present' | 'absent' | 'late';
    title: string;
    rows: GroupedRow[];
    symbol: string;
};

export function AttendanceDailyStatusBoard({
    rows,
    loading,
}: {
    rows: GroupedRow[];
    loading: boolean;
}) {
    const { t, locale } = useI18n();
    const sorted = useMemo(() => [...rows].sort((left, right) => left.name.localeCompare(right.name, locale === 'en' ? 'en' : 'ru')), [locale, rows]);
    const columns: StatusColumn[] = [
        {
            key: 'late',
            title: t('attendancePage.kpi.lateDaily'),
            rows: sorted.filter((row) => row.status === 'late'),
            symbol: '!',
        },
        {
            key: 'absent',
            title: t('attendancePage.kpi.absent'),
            rows: sorted.filter((row) => row.status === 'absent'),
            symbol: '×',
        },
        {
            key: 'present',
            title: t('attendancePage.kpi.onTime'),
            rows: sorted.filter((row) => row.status !== 'late' && row.status !== 'absent'),
            symbol: '✓',
        },
    ];

    return (<div className="att-daily__status-grid">
        {columns.map((column) => (<section key={column.key} className={`att-daily__status att-daily__status--${column.key}`}>
            <header className="att-daily__status-head">
                <span className="att-daily__status-symbol" aria-hidden>{column.symbol}</span>
                <h2>{column.title}</h2>
                <span className="att-daily__status-count">{loading ? '…' : column.rows.length}</span>
            </header>
            <div className="att-daily__people">
                {loading ? Array.from({ length: 6 }, (_, index) => (<div key={index} className="att-daily__person att-daily__person--skeleton" />)) : column.rows.length > 0 ? column.rows.map((row) => (<article key={row.key} className="att-daily__person">
                    <span className="att-daily__avatar" aria-hidden>{initials(row.name)}</span>
                    <span className="att-daily__person-main">
                        <strong>{row.name || '—'}</strong>
                        <small>{row.department || row.email || '—'}</small>
                    </span>
                    <span className="att-daily__person-time">
                        {row.firstTime ? formatTime(row.firstTime) : '—'}
                    </span>
                </article>)) : (<p className="att-daily__status-empty">Нет сотрудников</p>)}
            </div>
        </section>))}
    </div>);
}

export function AttendanceDailyWorkspace({
    selectedDate,
    onSelectDate,
    rows,
    loading,
    summary,
}: {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    rows: GroupedRow[];
    loading: boolean;
    summary: ReactNode;
}) {
    return (<section className="att-daily">
        <aside className="att-daily__side">
            <AttendanceMonthCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />
            {summary}
        </aside>
        <AttendanceDailyStatusBoard rows={rows} loading={loading} />
    </section>);
}
