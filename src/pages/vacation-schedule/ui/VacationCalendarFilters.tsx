import { useState } from 'react';
import type { VacationAbsenceKind, VacationUiLegendItem } from '../lib/vacationScheduleModel';
import type { VacationCalendarStatus } from '../lib/vacationCalendarFacts';

const STATUSES: ReadonlyArray<{ id: VacationCalendarStatus; label: string }> = [
    { id: 'all', label: 'Все' },
    { id: 'away', label: 'В отпуске' },
    { id: 'planned', label: 'Запланирован' },
    { id: 'declined', label: 'Отклонён' },
];

export type VacationTodayRow = {
    employeeId: number;
    label: string;
    teamName: string;
    initials: string;
    color: string;
    kindLabel: string;
    rangeLabel: string;
};

type Props = {
    year: number;
    onYearChange: (year: number) => void;
    status: VacationCalendarStatus;
    onStatusChange: (status: VacationCalendarStatus) => void;
    monthOpen: boolean;
    onShowYear: () => void;
    onShowMonth: () => void;
    legend: ReadonlyArray<VacationUiLegendItem>;
    kindCounts: ReadonlyMap<VacationAbsenceKind, number>;
    hiddenKinds: ReadonlySet<VacationAbsenceKind>;
    onToggleKind: (kind: VacationAbsenceKind) => void;
    todayLabel: string;
    todayRows: ReadonlyArray<VacationTodayRow>;
    onPickToday: (employeeId: number) => void;
};

export function VacationCalendarFilters({
    year,
    onYearChange,
    status,
    onStatusChange,
    monthOpen,
    onShowYear,
    onShowMonth,
    legend,
    kindCounts,
    hiddenKinds,
    onToggleKind,
    todayLabel,
    todayRows,
    onPickToday,
}: Props) {
    const [filtersOpen, setFiltersOpen] = useState(true);

    return (
        <aside className="vac-filters" aria-label="Фильтры календаря">
            <section className="vac-filters__block">
                <button
                    type="button"
                    className="vac-filters__head"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((open) => !open)}
                >
                    Фильтры
                    <svg className={`vac-filters__chev${filtersOpen ? ' vac-filters__chev--open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
                {filtersOpen ? (
                    <div className="vac-filters__body">
                        <div className="vac-filters__year">
                            <button type="button" aria-label="Предыдущий год" onClick={() => onYearChange(year - 1)} disabled={year <= 2000}>‹</button>
                            <span>{year}</span>
                            <button type="button" aria-label="Следующий год" onClick={() => onYearChange(year + 1)} disabled={year >= 2100}>›</button>
                        </div>
                        <p className="vac-filters__label">Статус</p>
                        <div className="vac-filters__chips" role="group" aria-label="Статус отсутствия">
                            {STATUSES.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`vac-filters__chip vac-filters__chip--${item.id}${status === item.id ? ' vac-filters__chip--on' : ''}`}
                                    aria-pressed={status === item.id}
                                    onClick={() => onStatusChange(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <p className="vac-filters__label">Режим просмотра</p>
                        <div className="vac-filters__modes" role="group" aria-label="Режим просмотра">
                            <button
                                type="button"
                                className={`vac-filters__mode${!monthOpen ? ' vac-filters__mode--on' : ''}`}
                                aria-pressed={!monthOpen}
                                onClick={onShowYear}
                            >
                                Годовой
                            </button>
                            <button
                                type="button"
                                className={`vac-filters__mode${monthOpen ? ' vac-filters__mode--on' : ''}`}
                                aria-pressed={monthOpen}
                                onClick={onShowMonth}
                            >
                                Месячный
                            </button>
                        </div>
                    </div>
                ) : null}
            </section>
            <section className="vac-filters__block">
                <p className="vac-filters__head vac-filters__head--static">Легенда</p>
                <ul className="vac-filters__legend">
                    {legend.map((item) => {
                        const hidden = hiddenKinds.has(item.kind);
                        return (
                            <li key={item.kind}>
                                <button
                                    type="button"
                                    className={`vac-filters__legend-row${hidden ? ' vac-filters__legend-row--off' : ''}`}
                                    aria-pressed={!hidden}
                                    onClick={() => onToggleKind(item.kind)}
                                >
                                    <i style={{ background: item.color }} aria-hidden />
                                    <span>{item.label}</span>
                                    <b>{kindCounts.get(item.kind) ?? 0}</b>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
            <section className="vac-filters__block">
                <p className="vac-filters__head vac-filters__head--static">Сегодня</p>
                <p className="vac-filters__today-date">{todayLabel}</p>
                {todayRows.length === 0 ? (
                    <p className="vac-filters__empty">Сегодня отсутствий нет</p>
                ) : (
                    <ul className="vac-filters__today">
                        {todayRows.map((row) => (
                            <li key={`${row.employeeId}-${row.kindLabel}`}>
                                <button type="button" className="vac-filters__today-row" onClick={() => onPickToday(row.employeeId)}>
                                    <span className="vac-filters__avatar" style={{ background: row.color }} aria-hidden>{row.initials}</span>
                                    <span className="vac-filters__today-copy">
                                        <strong>{row.label}</strong>
                                        <span>{row.teamName} · {row.rangeLabel}</span>
                                    </span>
                                    <span className="vac-filters__kind" style={{ color: row.color }}>{row.kindLabel}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <p className="vac-filters__note">В один день может быть несколько сотрудников. На календаре видны все, кто прошёл фильтры.</p>
        </aside>
    );
}
