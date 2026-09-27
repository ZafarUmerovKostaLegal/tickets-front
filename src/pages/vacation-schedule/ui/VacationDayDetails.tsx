import { useEffect } from 'react';
import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';

const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'] as const;

export type VacationDayDetailRow = {
    employeeId: number;
    label: string;
    teamName: string;
    color: string;
    kindLabel: string;
    rangeLabel: string;
    canOpenCard: boolean;
};

type Props = {
    year: number;
    monthIndex: number;
    day: number;
    rows: ReadonlyArray<VacationDayDetailRow>;
    onClose: () => void;
    onOpenCard: (employeeId: number) => void;
    onOpenDocs: (employeeId: number, label: string) => void;
    showDocs: boolean;
};

export function VacationDayDetails({ year, monthIndex, day, rows, onClose, onOpenCard, onOpenDocs, showDocs }: Props) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const weekday = WEEKDAYS[(new Date(year, monthIndex, day).getDay() + 6) % 7];

    return (
        <section className="vac-day" aria-label="Детали дня">
            <header className="vac-day__head">
                <div>
                    <p className="vac-day__kicker">{weekday}</p>
                    <h2 className="vac-day__title">{day} {VACATION_MONTH_NAMES[monthIndex]} {year}</h2>
                </div>
                <button type="button" className="vac-day__close" onClick={onClose} aria-label="Закрыть">
                    ×
                </button>
            </header>
            {rows.length === 0 ? (
                <p className="vac-day__empty">В этот день отсутствий нет.</p>
            ) : (
                <ul className="vac-day__list">
                    {rows.map((row) => (
                        <li key={`${row.employeeId}-${row.kindLabel}`} className="vac-day__item">
                            <span className="vac-day__dot" style={{ background: row.color }} aria-hidden />
                            <div className="vac-day__copy">
                                <strong>{row.label}</strong>
                                <span>{row.teamName} · {row.rangeLabel}</span>
                                <span className="vac-day__kind" style={{ color: row.color }}>{row.kindLabel}</span>
                            </div>
                            <div className="vac-day__actions">
                                {row.canOpenCard ? (
                                    <button type="button" onClick={() => onOpenCard(row.employeeId)}>Карточка</button>
                                ) : null}
                                {row.canOpenCard && showDocs ? (
                                    <button type="button" onClick={() => onOpenDocs(row.employeeId, row.label)}>Документы</button>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
