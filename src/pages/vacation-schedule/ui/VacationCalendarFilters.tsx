import type { VacationAbsenceKind, VacationUiLegendItem } from '../lib/vacationScheduleModel';
import type { VacationCalendarStatus } from '../lib/vacationCalendarFacts';

const STATUSES: ReadonlyArray<{ id: VacationCalendarStatus; label: string }> = [
    { id: 'all', label: 'Все' },
    { id: 'away', label: 'Согласованы' },
    { id: 'planned', label: 'Ожидают' },
    { id: 'declined', label: 'Отклонены' },
];

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
    lates?: { count: number; hidden: boolean; onToggle: () => void } | null;
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
    lates = null,
}: Props) {
    return (
        <div className="vac-toolbar" aria-label="Фильтры календаря">
            <div className="vac-toolbar__controls">
                <div className="vac-filters__year">
                    <button type="button" aria-label="Предыдущий год" onClick={() => onYearChange(year - 1)} disabled={year <= 2000}>‹</button>
                    <span>{year}</span>
                    <button type="button" aria-label="Следующий год" onClick={() => onYearChange(year + 1)} disabled={year >= 2100}>›</button>
                </div>
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
                <div className="vac-filters__modes" role="group" aria-label="Режим просмотра">
                    <button
                        type="button"
                        className={`vac-filters__mode${!monthOpen ? ' vac-filters__mode--on' : ''}`}
                        aria-pressed={!monthOpen}
                        onClick={onShowYear}
                    >
                        Год
                    </button>
                    <button
                        type="button"
                        className={`vac-filters__mode${monthOpen ? ' vac-filters__mode--on' : ''}`}
                        aria-pressed={monthOpen}
                        onClick={onShowMonth}
                    >
                        Месяц
                    </button>
                </div>
            </div>
            {(legend.some((item) => (kindCounts.get(item.kind) ?? 0) > 0) || (lates && lates.count > 0)) ? (
            <div className="vac-toolbar__legend" role="group" aria-label="Легенда">
                {legend.filter((item) => (kindCounts.get(item.kind) ?? 0) > 0).map((item) => {
                    const hidden = hiddenKinds.has(item.kind);
                    return (
                        <button
                            key={item.kind}
                            type="button"
                            className={`vac-filters__legend-row${hidden ? ' vac-filters__legend-row--off' : ''}`}
                            aria-pressed={!hidden}
                            title={hidden ? `Показать: ${item.label}` : `Скрыть: ${item.label}`}
                            onClick={() => onToggleKind(item.kind)}
                        >
                            <i style={{ background: item.color }} aria-hidden />
                            <span>{item.label}</span>
                            <b>{kindCounts.get(item.kind) ?? 0}</b>
                        </button>
                    );
                })}
                {lates && lates.count > 0 ? (
                    <button
                        type="button"
                        className={`vac-filters__legend-row${lates.hidden ? ' vac-filters__legend-row--off' : ''}`}
                        aria-pressed={!lates.hidden}
                        title={lates.hidden ? 'Показать опоздания' : 'Скрыть опоздания'}
                        onClick={lates.onToggle}
                    >
                        <i style={{ background: '#b45309' }} aria-hidden />
                        <span>Опоздание</span>
                        <b>{lates.count}</b>
                    </button>
                ) : null}
            </div>
            ) : null}
        </div>
    );
}
