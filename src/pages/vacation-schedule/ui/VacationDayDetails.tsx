import { useEffect } from 'react';
import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';

const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'] as const;

function weekdayLabel(year: number, monthIndex: number, day: number): string {
    return WEEKDAYS[(new Date(year, monthIndex, day).getDay() + 6) % 7];
}

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
    endMonthIndex?: number;
    endDay?: number;
    rows: ReadonlyArray<VacationDayDetailRow>;
    onClose: () => void;
    onOpenCard: (employeeId: number) => void;
    onOpenDocs: (employeeId: number, label: string) => void;
    showDocs: boolean;
};

export function VacationDayDetails({ year, monthIndex, day, endMonthIndex = monthIndex, endDay = day, rows, onClose, onOpenCard, onOpenDocs, showDocs }: Props) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const startSerial = monthIndex * 40 + day;
    const endSerial = endMonthIndex * 40 + endDay;
    const fromMonth = startSerial <= endSerial ? monthIndex : endMonthIndex;
    const fromDay = startSerial <= endSerial ? day : endDay;
    const toMonth = startSerial <= endSerial ? endMonthIndex : monthIndex;
    const toDay = startSerial <= endSerial ? endDay : day;
    const sameDay = fromMonth === toMonth && fromDay === toDay;
    const title = sameDay
        ? `${day} ${VACATION_MONTH_NAMES[monthIndex]} ${year}`
        : fromMonth === toMonth
            ? `${fromDay}–${toDay} ${VACATION_MONTH_NAMES[fromMonth]} ${year}`
            : `${fromDay} ${VACATION_MONTH_NAMES[fromMonth]} – ${toDay} ${VACATION_MONTH_NAMES[toMonth]} ${year}`;

    return (
        <section className="vac-day" aria-label="Детали дня">
            <header className="vac-day__head">
                <div>
                    <p className="vac-day__kicker">{sameDay ? weekdayLabel(year, fromMonth, fromDay) : 'Период'}</p>
                    <h2 className="vac-day__title">{title}</h2>
                    {sameDay ? <p className="vac-day__hint">Нажмите второй день, чтобы выбрать период</p> : null}
                </div>
                <button type="button" className="vac-day__close" onClick={onClose} aria-label="Закрыть">
                    ×
                </button>
            </header>
            {rows.length === 0 ? (
                <p className="vac-day__empty">В этот день отсутствий нет.</p>
            ) : (
                <>
                    <h3 className="vac-day__events">События</h3>
                    <ul className="vac-day__list">
                        {rows.map((row) => (
                            <li key={`${row.employeeId}-${row.kindLabel}`} className="vac-day__item">
                                <span className="vac-day__dot" style={{ background: row.color }} aria-hidden />
                                <div className="vac-day__copy">
                                    <strong>{row.label}</strong>
                                    <span>{row.rangeLabel}</span>
                                    {row.canOpenCard ? (
                                        <span className="vac-day__links">
                                            <button type="button" onClick={() => onOpenCard(row.employeeId)}>Карточка</button>
                                            {showDocs ? (
                                                <button type="button" onClick={() => onOpenDocs(row.employeeId, row.label)}>Документы</button>
                                            ) : null}
                                        </span>
                                    ) : null}
                                </div>
                                <span className="vac-day__badge" style={{ color: row.color, background: `color-mix(in srgb, ${row.color} 14%, #fff)` }}>
                                    {row.kindLabel}
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}
