import type { VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';

export type VacationTimelineBar = {
    employeeId: number;
    label: string;
    color: string;
    startDay: number;
    endDay: number;
    pending: boolean;
    remote: boolean;
    unpaid: boolean;
};

type Person = VacationScheduleEmployeeRow & { teamName: string };

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type Props = {
    year: number;
    monthIndex: number;
    daysInMonth: number;
    todayDay: number | null;
    people: Person[];
    selectedIds: ReadonlySet<number>;
    bars: VacationTimelineBar[];
    outCounts: number[];
    pickedStart: number | null;
    pickedEnd: number | null;
    onPickRange: (startDay: number, endDay: number) => void;
    onToggle: (person: Person) => void;
};

export function VacationMonthTimeline({ year, monthIndex, daysInMonth, todayDay, people, selectedIds, bars, outCounts, pickedStart, pickedEnd, onPickRange, onToggle }: Props) {
    const groups: { name: string; people: Person[] }[] = [];
    for (const person of people) {
        const last = groups[groups.length - 1];
        if (!last || last.name !== person.teamName)
            groups.push({ name: person.teamName, people: [person] });
        else
            last.people.push(person);
    }
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
    const selected = selectedIds.size > 0;
    const picked = (day: number) => pickedStart != null && pickedEnd != null && day >= pickedStart && day <= pickedEnd;

    return (
        <div className="vac-gantt">
            <div className="vac-gantt__scroll">
                <div className="vac-gantt__sheet" style={{ ['--vac-days' as string]: daysInMonth }}>
                    <div className="vac-gantt__row vac-gantt__row--head">
                        <div className="vac-gantt__name vac-gantt__name--head">Сотрудники</div>
                        <div className="vac-gantt__track">
                            {days.map((day) => (
                                <button type="button" key={day} className={`vac-gantt__head-day${todayDay === day ? ' is-today' : ''}${picked(day) ? ' is-picked' : ''}`} onClick={() => onPickRange(day, day)}>
                                    <b>{day}</b>
                                    <span>{WEEK[(new Date(year, monthIndex, day).getDay() + 6) % 7]}</span>
                                </button>
                            ))}
                            {todayDay != null ? (
                                <i className="vac-gantt__today" style={{ left: `${((todayDay - 0.5) / daysInMonth) * 100}%` }} />
                            ) : null}
                        </div>
                    </div>
                    {groups.map((group) => (
                        <section key={group.name}>
                            <h3 className="vac-gantt__team">{group.name} · {group.people.length}</h3>
                            {group.people.map((person) => {
                                const on = !selected || selectedIds.has(person.id);
                                const personBars = bars.filter((bar) => bar.employeeId === person.id);
                                return (
                                    <div key={person.id} className={`vac-gantt__row${on ? '' : ' is-off'}`}>
                                        <button type="button" className="vac-gantt__name" aria-pressed={selectedIds.has(person.id)} onClick={() => onToggle(person)}>
                                            <span className={`vac-gantt__check${selectedIds.has(person.id) || !selected ? ' is-on' : ''}`} aria-hidden />
                                            <span>{person.label}</span>
                                        </button>
                                        <div className="vac-gantt__track">
                                            {days.map((day) => (
                                                <button type="button" key={day} className={`vac-gantt__cell${todayDay === day ? ' is-today' : ''}${picked(day) ? ' is-picked' : ''}`} aria-label={`${day}`} onClick={() => onPickRange(day, day)} />
                                            ))}
                                            {personBars.map((bar) => (
                                                <span
                                                    key={`${bar.employeeId}-${bar.startDay}-${bar.label}-${bar.pending}`}
                                                    className={`vac-gantt__bar${bar.pending ? ' is-pending' : ''}${bar.remote ? ' is-remote' : ''}${bar.unpaid ? ' is-unpaid' : ''}${picked(bar.startDay) && picked(bar.endDay) ? ' is-picked' : ''}`}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => onPickRange(bar.startDay, bar.endDay)}
                                                    style={{
                                                        left: `${((bar.startDay - 1) / daysInMonth) * 100}%`,
                                                        width: `${((bar.endDay - bar.startDay + 1) / daysInMonth) * 100}%`,
                                                        background: bar.pending || bar.remote ? 'transparent' : bar.color,
                                                        color: bar.pending || bar.remote ? bar.color : '#fff',
                                                        borderColor: bar.color,
                                                    }}
                                                    title={`${person.label}: ${bar.label}`}
                                                >
                                                    {bar.label}
                                                </span>
                                            ))}
                                            {todayDay != null ? (
                                                <i className="vac-gantt__today" style={{ left: `${((todayDay - 0.5) / daysInMonth) * 100}%` }} />
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    ))}
                    <div className="vac-gantt__row vac-gantt__row--sum">
                        <div className="vac-gantt__name">Отсутствуют</div>
                        <div className="vac-gantt__track">
                            {days.map((day) => {
                                const count = outCounts[day] ?? 0;
                                return (
                                    <div key={day} className={`vac-gantt__sum${count >= 4 ? ' is-hot' : ''}${count === 0 ? ' is-empty' : ''}`}>
                                        {count > 0 ? count : ''}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <p className="vac-gantt__note">
                Сплошная полоса — согласовано. Пунктир — ждёт согласования. Красная цифра — в этот день нет четырёх и больше человек.
            </p>
        </div>
    );
}

