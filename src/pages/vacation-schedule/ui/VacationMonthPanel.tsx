import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';
import type { VacationDayDetailRow } from './VacationDayDetails';

function monthCountLabel(count: number): string {
    if (count === 0)
        return 'Нет отсутствий';
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? 'отсутствие'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? 'отсутствия'
            : 'отсутствий';
    return `${count} ${word}`;
}

type Props = {
    year: number;
    monthIndex: number;
    open: boolean;
    rows: ReadonlyArray<VacationDayDetailRow>;
    onToggle: () => void;
    onOpenCard: (employeeId: number) => void;
    onOpenDocs: (employeeId: number, label: string) => void;
    showDocs: boolean;
};

export function VacationMonthPanel({ year, monthIndex, open, rows, onToggle, onOpenCard, onOpenDocs, showDocs }: Props) {
    const title = `${VACATION_MONTH_NAMES[monthIndex]} ${year}`;
    return (
        <aside className={`vac-month${open ? '' : ' vac-month--closed'}`} aria-label={`Отсутствия за ${title}`}>
            <div className="vac-month__bar">
                {open ? (
                    <div className="vac-month__heading">
                        <h2 className="vac-month__title">{title}</h2>
                        <p className="vac-month__count">{monthCountLabel(rows.length)}</p>
                    </div>
                ) : null}
                <button
                    type="button"
                    className="vac-month__toggle"
                    aria-expanded={open}
                    aria-label={open ? 'Свернуть детали месяца' : 'Показать детали месяца'}
                    title={open ? 'Свернуть' : title}
                    onClick={onToggle}
                >
                    {open ? '›' : '‹'}
                </button>
            </div>
            {open ? (
                rows.length === 0 ? (
                    <p className="vac-month__empty">В этом месяце отсутствий нет</p>
                ) : (
                    <ul className="vac-month__list">
                        {rows.map((row) => (
                            <li key={`${row.employeeId}-${row.kindLabel}`} className="vac-month__item" style={{ borderLeftColor: row.color }}>
                                <div className="vac-month__copy">
                                    <strong>{row.label}</strong>
                                    <span>{row.rangeLabel}</span>
                                </div>
                                <span className="vac-month__badge" style={{ color: row.color, background: `color-mix(in srgb, ${row.color} 16%, #fff)` }}>
                                    {row.kindLabel}
                                </span>
                                {row.canOpenCard ? (
                                    <span className="vac-month__links">
                                        <button type="button" onClick={() => onOpenCard(row.employeeId)}>Карточка</button>
                                        {showDocs && row.allowDocs !== false ? (
                                            <button type="button" onClick={() => onOpenDocs(row.employeeId, row.label)}>Документы</button>
                                        ) : null}
                                    </span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )
            ) : (
                <span className="vac-month__rail">{VACATION_MONTH_NAMES[monthIndex]}</span>
            )}
        </aside>
    );
}
