import { useEffect, useMemo, useState } from 'react';
import { listTimeTrackingTeams, type TimeTrackingTeamRow } from '@entities/time-tracking';
import {
    getVacationRosterHidden,
    listVacationAbsenceDays,
    listVacationLeaveRequests,
    listVacationScheduleEmployees,
    type VacationAbsenceDayApi,
    type VacationLeaveRequestApi,
    type VacationScheduleEmployeeApi,
} from '@entities/vacation';
import {
    buildVacationAnalytics,
    formatAnalyticsRange,
    type AnalyticsAbsence,
    type AnalyticsBookedLeave,
    type AnalyticsConflictRange,
    type AnalyticsPerson,
    type AnalyticsReport,
} from '../lib/vacationAnalytics';
import { absenceKindToUi } from '../lib/vacationScheduleModel';
import './VacationAnalyticsPanel.css';

type Props = {
    year: number;
    onYearChange: (year: number) => void;
};

function ruCount(count: number, one: string, few: string, many: string): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11)
        return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
        return few;
    return many;
}

function todayIso(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

function todayLabel(): string {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date());
}

function teamMemberIds(team: TimeTrackingTeamRow): Set<number> {
    return new Set([team.partner_auth_user_id, ...team.member_auth_user_ids].filter((id) => id > 0));
}

function toPeople(
    employees: VacationScheduleEmployeeApi[],
    teams: TimeTrackingTeamRow[],
    hiddenUsers: ReadonlySet<number>,
    hiddenEmployees: ReadonlySet<number>,
): AnalyticsPerson[] {
    const active = teams
        .filter((team) => !team.is_archived)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    const people: AnalyticsPerson[] = [];
    for (const employee of employees) {
        if (employee.id <= 0)
            continue;
        const authId = employee.auth_user_id;
        if (authId != null && hiddenUsers.has(authId))
            continue;
        if (authId == null && hiddenEmployees.has(employee.id))
            continue;
        const team = authId == null ? undefined : active.find((item) => teamMemberIds(item).has(authId));
        people.push({
            id: employee.id,
            name: employee.full_name.trim() || 'Сотрудник',
            teamId: team?.id ?? 'none',
            teamName: team?.name ?? 'Без команды',
            authUserId: authId,
        });
    }
    return people;
}

function toAbsences(days: VacationAbsenceDayApi[]): AnalyticsAbsence[] {
    const out: AnalyticsAbsence[] = [];
    for (const day of days) {
        const kind = absenceKindToUi(day.kind, day.kind_code);
        if (kind !== 'annual' && kind !== 'sick' && kind !== 'dayoff')
            continue;
        out.push({
            personId: day.employee_id,
            iso: day.absence_on.slice(0, 10),
            kind,
        });
    }
    return out;
}

const BOOKED_LEAVE_STATUSES = new Set(['pending', 'pending_final', 'approved']);

function toBookedLeaves(requests: VacationLeaveRequestApi[]): AnalyticsBookedLeave[] {
    return requests
        .filter((request) => request.kind === 'annual_vacation' && BOOKED_LEAVE_STATUSES.has(request.status))
        .map((request) => ({
            authUserId: request.employee_user_id,
            from: request.date_from.slice(0, 10),
            to: request.date_to.slice(0, 10),
        }));
}

function heatStyle(percent: number, over: boolean): { background: string; color: string } | undefined {
    if (percent <= 0)
        return undefined;
    const mix = Math.min(100, Math.round(percent * 300) + 12);
    const tone = over ? '#e11d48' : 'var(--app-accent, #4f46e5)';
    return {
        background: `color-mix(in srgb, ${tone} ${mix}%, var(--app-surface, #fff))`,
        color: percent > 0.18 || over ? '#fff' : 'var(--app-text, #0f172a)',
    };
}

export function VacationAnalyticsPanel({ year, onYearChange }: Props) {
    const [people, setPeople] = useState<AnalyticsPerson[] | null>(null);
    const [days, setDays] = useState<AnalyticsAbsence[]>([]);
    const [bookedLeaves, setBookedLeaves] = useState<AnalyticsBookedLeave[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setPeople(null);
        setError(null);
        void Promise.all([
            listVacationScheduleEmployees(year),
            listTimeTrackingTeams().catch(() => [] as TimeTrackingTeamRow[]),
            listVacationAbsenceDays(year),
            getVacationRosterHidden().catch(() => ({ authUserIds: [] as number[], employeeIds: [] as number[] })),
            listVacationLeaveRequests({ scope: 'all', status: 'any' }).catch(() => [] as VacationLeaveRequestApi[]),
        ])
            .then(([employees, teams, absences, hidden, requests]) => {
                if (cancelled)
                    return;
                setPeople(toPeople(employees, teams, new Set(hidden.authUserIds), new Set(hidden.employeeIds)));
                setDays(toAbsences(absences));
                setBookedLeaves(toBookedLeaves(requests));
            })
            .catch((err: unknown) => {
                if (cancelled)
                    return;
                setPeople([]);
                setDays([]);
                setError(err instanceof Error ? err.message : 'Не удалось собрать анализ');
            });
        return () => {
            cancelled = true;
        };
    }, [year]);

    const report: AnalyticsReport | null = useMemo(() => {
        if (!people)
            return null;
        return buildVacationAnalytics({
            year,
            todayIso: todayIso(),
            people,
            days,
            teamLimitPercent: 40,
            quotaWorkingDays: 21,
            bookedLeaves,
        });
    }, [bookedLeaves, days, people, year]);

    const stepYear = (delta: number) => {
        onYearChange(Math.min(2100, Math.max(2000, year + delta)));
    };

    return (
        <section className="vac-an" aria-label={`Анализ отпусков ${year}`}>
            <div className="vac-an__head">
                <div>
                    <h2>Анализ отпусков {year}</h2>
                    <p>
                        {report
                            ? `${report.employeeCount} ${ruCount(report.employeeCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${report.teamCount} ${ruCount(report.teamCount, 'команда', 'команды', 'команд')} · данные на ${todayLabel()}`
                            : 'Собираем график и команды…'}
                    </p>
                </div>
                <div className="vac-an__year">
                    <button type="button" onClick={() => stepYear(-1)} aria-label="Предыдущий год">‹</button>
                    <span>{year}</span>
                    <button type="button" onClick={() => stepYear(1)} aria-label="Следующий год">›</button>
                </div>
            </div>
            {error ? <p className="vac-an__error">{error}</p> : null}
            {!report ? <p className="vac-an__wait">Считаем отсутствие по командам…</p> : <AnalyticsBody report={report} />}
        </section>
    );
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatConflictRange(range: AnalyticsConflictRange): string {
    const span = formatAnalyticsRange(range.from, range.to);
    if (range.kind === 'sick')
        return `больничный ${span}`;
    if (range.kind === 'dayoff')
        return `неоплачиваемый ${span}`;
    return span;
}
const VACATION_QUOTA_DAYS = 21;

function AnalyticsBody({ report }: { report: AnalyticsReport }) {
    const conflictPreview = report.conflicts.slice(0, 8);
    return (
        <>
            <div className="vac-an__kpis">
                <article>
                    <b>{report.vacationWorkingDays}</b>
                    <span>рабочих дней отпуска</span>
                </article>
                <article>
                    <b>{report.averageVacation.toFixed(1)}</b>
                    <span>в среднем на человека, норма {VACATION_QUOTA_DAYS} дн.</span>
                </article>
                <article>
                    <b className={report.conflicts.length > 0 ? 'is-bad' : undefined}>{report.conflicts.length}</b>
                    <span>{ruCount(report.conflicts.length, 'период', 'периода', 'периодов')} выше лимита команды</span>
                </article>
                <article>
                    <b>{report.withoutVacation}</b>
                    <span>{ruCount(report.withoutVacation, 'сотрудник', 'сотрудника', 'сотрудников')} без отпуска</span>
                </article>
                <article>
                    <b>{report.sickWorkingDays}</b>
                    <span>рабочих дней больничных</span>
                </article>
            </div>

            <section className="vac-an__card">
                <h3>Нагрузка по месяцам</h3>
                <p>Доля рабочих дней вне офиса: отпуск, больничный и неоплачиваемый. Красным — месяц, где в среднем отсутствует больше 40% команды.</p>
                <div className="vac-an__heat-scroll">
                    <div className="vac-an__heat">
                        <div />
                        {MONTHS.map((month) => <div key={month} className="vac-an__heat-h">{month}</div>)}
                        {report.heatmap.map((row) => (
                            <div key={row.teamId} className="vac-an__heat-row">
                                <div className="vac-an__heat-name">{row.teamName}</div>
                                {row.months.map((cell, index) => (
                                    <div key={MONTHS[index]} className="vac-an__heat-cell" style={heatStyle(cell.percent, cell.over)}>
                                        {cell.percent > 0 ? `${Math.round(cell.percent * 100)}%` : ''}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="vac-an__split">
                <section className="vac-an__card">
                    <h3>Конфликты по лимиту</h3>
                    <p>В команде одновременно отсутствуют больше людей, чем разрешает лимит.</p>
                    <ul>
                        {conflictPreview.length === 0 ? <li><span>Таких периодов нет</span></li> : conflictPreview.map((conflict) => (
                            <li key={`${conflict.teamId}-${conflict.from}`} className="vac-an__conflict">
                                <div className="vac-an__conflict-top">
                                    <span>{conflict.teamName}: {formatAnalyticsRange(conflict.from, conflict.to)}</span>
                                    <b>{conflict.max} из {conflict.size}</b>
                                </div>
                                <ul className="vac-an__people">
                                    {conflict.people.map((person) => (
                                        <li key={person.id}>
                                            <span>{person.name}</span>
                                            <span>{person.ranges.map(formatConflictRange).join(', ')}</span>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </section>
                <section className="vac-an__card">
                    <h3>Где можно ставить отпуск</h3>
                    <p>{report.looksAhead ? 'Пять самых свободных недель до конца года.' : 'Пять самых свободных недель этого года.'}</p>
                    <ul>
                        {report.freeWeeks.length === 0 ? <li><span>В этом году недель для оценки не осталось</span></li> : report.freeWeeks.map((week) => (
                            <li key={week.from}>
                                <span>{formatAnalyticsRange(week.from, week.to)}</span>
                                <span>{week.personDays === 0 ? 'никто не отсутствует' : `${week.personDays} чел.-дн.`}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            <section className="vac-an__card">
                <h3>Сотрудники</h3>
                <div className="vac-an__table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Сотрудник</th>
                                <th>Команда</th>
                                <th>Отпуск</th>
                                <th>Остаток</th>
                                <th>Больничный</th>
                                <th>Неоплачиваемый</th>
                                <th>Замечания</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.employees.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.name}</td>
                                    <td>{row.teamName}</td>
                                    <td>
                                        <span className="vac-an__bar" aria-hidden><i style={{ width: `${Math.min(100, row.vacationDays / VACATION_QUOTA_DAYS * 100)}%` }} /></span>
                                        {row.vacationDays} дн.
                                    </td>
                                    <td className={row.remaining < 0 ? 'is-bad' : undefined}>{row.remaining}</td>
                                    <td>{row.sickDays}</td>
                                    <td>{row.dayOffDays}</td>
                                    <td>
                                        {row.noVacation ? <em className="vac-an__tag is-warn">не запланирован</em> : null}
                                        {row.shortBlock ? <em className="vac-an__tag">нет 14 непрерывных дн.</em> : null}
                                        {row.overQuota ? <em className="vac-an__tag is-warn">больше нормы</em> : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
