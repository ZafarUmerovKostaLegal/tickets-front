import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';
import type { VacationDayDetailRow } from './VacationDayDetails';

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
                {open ? <h2 className="vac-month__title">{title}</h2> : null}
                <button
                    type="button"
                    className="vac-month__toggle"
                    aria-expanded={open}
                    aria-label={open ? 'Свернуть детали месяца' : 'Показать детали месяца'}
                    title={open ? 'Свернуть' : title}
                    onClick={onToggle}
                >
                    {open ? '‹' : '›'}
                </button>
            </div>
            {open ? (
                rows.length === 0 ? (
                    <p className="vac-month__empty">В этом месяце отсутствий нет</p>
                ) : (
                    <ul className="vac-month__list">
                        {rows.map((row) => (
                            <li key={`${row.employeeId}-${row.kindLabel}`} className="vac-month__item">
                                <span className="vac-month__dot" style={{ background: row.color }} aria-hidden />
                                <div className="vac-month__copy">
                                    <strong>{row.label}</strong>
                                    <span>{row.rangeLabel}</span>
                                    {row.canOpenCard ? (
                                        <span className="vac-month__links">
                                            <button type="button" onClick={() => onOpenCard(row.employeeId)}>Карточка</button>
                                            {showDocs ? (
                                                <button type="button" onClick={() => onOpenDocs(row.employeeId, row.label)}>Документы</button>
                                            ) : null}
                                        </span>
                                    ) : null}
                                </div>
                                <span className="vac-month__badge" style={{ color: row.color, background: `color-mix(in srgb, ${row.color} 14%, #fff)` }}>
                                    {row.kindLabel}
                                </span>
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
