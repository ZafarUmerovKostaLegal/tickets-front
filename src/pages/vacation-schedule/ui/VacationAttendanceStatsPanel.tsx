import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { fetchWorkdaySettings, workdayDtoToSettings } from '@entities/attendance';
import { listVacationAttendanceMarkers, listVacationScheduleEmployees } from '@entities/vacation';
import { DEFAULT_WORKDAY_SETTINGS } from '@shared/lib/attendanceSettings';
import {
    averageVacationLateMinutes,
    buildVacationAttendanceEmployeeStats,
    buildVacationAttendanceMonthStats,
    formatVacationAttendanceStatsPeriod,
    formatVacationLateMinutesTotal,
    summarizeVacationAttendanceStats,
    type VacationAttendanceEmployeeStats,
} from '../lib/vacationAttendanceStats';
import { buildVacationScheduleRowsFromUsers, filterVacationScheduleRowsExcludingPartners, type VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';
import './VacationAttendanceStatsPanel.css';

const VacationAttendanceStatsCharts = lazy(() => import('./VacationAttendanceStatsCharts').then((m) => ({ default: m.VacationAttendanceStatsCharts })));

function clampYear(y: number): number {
    return Math.min(2100, Math.max(2000, y));
}

function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CHART_LATE = '#f59e0b';
const CHART_ABSENT = '#ef4444';

type VacationAttendanceStatsPanelProps = {
    externalRefreshToken?: number;
};

type TopMetric = 'count' | 'minutes';

type SortKey = 'label' | 'lateCount' | 'lateMinutesTotal' | 'avgLate' | 'absentCount';

function truncateLabel(label: string, max = 24): string {
    if (label.length <= max)
        return label;
    return `${label.slice(0, max - 1)}…`;
}

function sortIndicator(active: boolean, dir: 'asc' | 'desc'): string {
    if (!active)
        return '↕';
    return dir === 'asc' ? '↑' : '↓';
}

export function VacationAttendanceStatsPanel({ externalRefreshToken = 0 }: VacationAttendanceStatsPanelProps) {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(() => clampYear(currentYear));
    const [yearInput, setYearInput] = useState(String(clampYear(currentYear)));
    const [employees, setEmployees] = useState<VacationScheduleEmployeeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadToken, setLoadToken] = useState(0);
    const [workdaySettings, setWorkdaySettings] = useState(DEFAULT_WORKDAY_SETTINGS);
    const [rawMarkers, setRawMarkers] = useState<Awaited<ReturnType<typeof listVacationAttendanceMarkers>>>([]);
    const [topMetric, setTopMetric] = useState<TopMetric>('count');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('lateCount');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        let cancelled = false;
        void fetchWorkdaySettings()
            .then((dto) => {
                if (!cancelled)
                    setWorkdaySettings(workdayDtoToSettings(dto));
            })
            .catch(() => {
                if (!cancelled)
                    setWorkdaySettings(DEFAULT_WORKDAY_SETTINGS);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setLoading(true);
        const y = year;
        const from = `${y}-01-01`;
        const today = new Date();
        const to = y === today.getFullYear() ? formatLocalDate(today) : `${y}-12-31`;
        void (async () => {
            const [empRows, allUsers, attendanceRows] = await Promise.all([
                listVacationScheduleEmployees(y),
                listColleaguesAsUsers().catch(() => [] as User[]),
                listVacationAttendanceMarkers(from, to),
            ]);
            if (cancelled)
                return;
            const scheduleRows: VacationScheduleEmployeeRow[] = empRows.map((e) => ({
                id: e.id,
                label: e.full_name,
                excelRowNo: e.excel_row_no,
                plannedPeriodNote: e.planned_period_note,
                systemUserId: e.auth_user_id ?? undefined,
                email: e.email ?? null,
            }));
            setEmployees(filterVacationScheduleRowsExcludingPartners(
                buildVacationScheduleRowsFromUsers(allUsers, scheduleRows),
                allUsers,
            ));
            setRawMarkers(attendanceRows);
        })()
            .catch((e: unknown) => {
                if (cancelled)
                    return;
                setEmployees([]);
                setRawMarkers([]);
                setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить статистику посещаемости');
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [year, loadToken, externalRefreshToken]);

    const employeeStats = useMemo(
        () => buildVacationAttendanceEmployeeStats(year, rawMarkers, employees, workdaySettings),
        [year, rawMarkers, employees, workdaySettings],
    );
    const monthStats = useMemo(
        () => buildVacationAttendanceMonthStats(year, rawMarkers),
        [year, rawMarkers],
    );
    const totals = useMemo(() => summarizeVacationAttendanceStats(employeeStats), [employeeStats]);
    const periodLabel = useMemo(() => formatVacationAttendanceStatsPeriod(year), [year]);

    const topLateChart = useMemo(() => {
        const source = topMetric === 'minutes'
            ? [...employeeStats].sort((a, b) => b.lateMinutesTotal - a.lateMinutesTotal || b.lateCount - a.lateCount)
            : employeeStats;
        return source
            .filter((r) => (topMetric === 'minutes' ? r.lateMinutesTotal > 0 : r.lateCount > 0))
            .slice(0, 10)
            .map((r) => ({
                name: truncateLabel(r.label),
                fullName: r.label,
                late: r.lateCount,
                minutes: r.lateMinutesTotal,
                value: topMetric === 'minutes' ? r.lateMinutesTotal : r.lateCount,
            }));
    }, [employeeStats, topMetric]);

    const pieData = useMemo(() => {
        if (totals.lateCount === 0 && totals.absentCount === 0)
            return [];
        return [
            { name: 'Опоздания', value: totals.lateCount, color: CHART_LATE },
            { name: 'Отсутствия', value: totals.absentCount, color: CHART_ABSENT },
        ];
    }, [totals]);

    const tableRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = q
            ? employeeStats.filter((r) => r.label.toLowerCase().includes(q))
            : [...employeeStats];
        rows.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'label')
                cmp = a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' });
            else if (sortKey === 'avgLate')
                cmp = averageVacationLateMinutes(a) - averageVacationLateMinutes(b);
            else
                cmp = a[sortKey] - b[sortKey];
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return rows;
    }, [employeeStats, search, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key)
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortKey(key);
            setSortDir(key === 'label' ? 'asc' : 'desc');
        }
    };

    const applyYearFromInput = () => {
        const n = Number.parseInt(yearInput.trim(), 10);
        if (!Number.isFinite(n))
            return;
        const c = clampYear(n);
        setYear(c);
        setYearInput(String(c));
    };

    const refetch = () => setLoadToken((t) => t + 1);

    return (
        <div className="vac-att-stats">
            <header className="vac-att-stats__header">
                <div className="vac-att-stats__bar">
                    <label className="vac-att-stats__year-label" htmlFor="vac-att-stats-year" title="Год (2000–2100)">
                        Год
                    </label>
                    <input
                        id="vac-att-stats-year"
                        className="vac-att-stats__year-input"
                        type="number"
                        min={2000}
                        max={2100}
                        value={yearInput}
                        onChange={(e) => setYearInput(e.target.value)}
                        onBlur={() => applyYearFromInput()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                applyYearFromInput();
                            }
                        }}
                    />
                    <button type="button" className="vac-att-stats__year-apply" onClick={() => applyYearFromInput()}>
                        Показать
                    </button>
                </div>
                <p className="vac-att-stats__period">{periodLabel}</p>
                <p className="vac-att-stats__bar-hint">
                    Как в отчёте посещаемости · начало дня {workdaySettings.startTime}
                    {workdaySettings.lateMinutes > 0 ? ` (+${workdaySettings.lateMinutes} мин)` : ''}
                </p>
            </header>

            {loadError && (
                <div className="vac-att-stats__err-wrap" role="alert">
                    <p className="vac-att-stats__error">{loadError}</p>
                    <button type="button" className="vac-att-stats__retry" onClick={refetch}>
                        Повторить
                    </button>
                </div>
            )}

            {loading && !loadError && (
                <div className="vac-att-stats__skeleton" aria-busy="true" aria-label="Загрузка статистики">
                    <div className="vac-att-stats__skeleton-kpis">
                        <span /><span /><span />
                    </div>
                    <div className="vac-att-stats__skeleton-chart" />
                    <div className="vac-att-stats__skeleton-table" />
                </div>
            )}

            {!loading && !loadError && (
                <>
                    <div className="vac-att-stats__kpis">
                        <article className="vac-att-stats__kpi vac-att-stats__kpi--late">
                            <span className="vac-att-stats__kpi-label">Опоздания</span>
                            <strong className="vac-att-stats__kpi-value">{totals.lateCount.toLocaleString('ru-RU')}</strong>
                            <span className="vac-att-stats__kpi-sub">
                                {formatVacationLateMinutesTotal(totals.lateMinutesTotal)} суммарно
                            </span>
                        </article>
                        <article className="vac-att-stats__kpi vac-att-stats__kpi--absent">
                            <span className="vac-att-stats__kpi-label">Отсутствия</span>
                            <strong className="vac-att-stats__kpi-value">{totals.absentCount.toLocaleString('ru-RU')}</strong>
                            <span className="vac-att-stats__kpi-sub">без отметки прохода</span>
                        </article>
                        <article className="vac-att-stats__kpi">
                            <span className="vac-att-stats__kpi-label">С нарушениями</span>
                            <strong className="vac-att-stats__kpi-value">{totals.employeesAffected.toLocaleString('ru-RU')}</strong>
                            <span className="vac-att-stats__kpi-sub">из {employees.length} в графике</span>
                        </article>
                        <article className="vac-att-stats__kpi vac-att-stats__kpi--avg">
                            <span className="vac-att-stats__kpi-label">Среднее опоздание</span>
                            <strong className="vac-att-stats__kpi-value">
                                {totals.lateCount > 0
                                    ? formatVacationLateMinutesTotal(Math.round(totals.lateMinutesTotal / totals.lateCount))
                                    : '—'}
                            </strong>
                            <span className="vac-att-stats__kpi-sub">на одно опоздание</span>
                        </article>
                    </div>

                    <Suspense fallback={<div className="vac-att-stats__skeleton-chart" aria-hidden />}>
                        <VacationAttendanceStatsCharts
                            topMetric={topMetric}
                            onTopMetricChange={setTopMetric}
                            topLateChart={topLateChart}
                            pieData={pieData}
                            monthStats={monthStats}
                        />
                    </Suspense>

                    <section className="vac-att-stats__table-wrap">
                        <div className="vac-att-stats__table-head">
                            <h2 className="vac-att-stats__card-title">Рейтинг сотрудников</h2>
                            <div className="vac-att-stats__table-tools">
                                <input
                                    type="search"
                                    className="vac-att-stats__search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Поиск по ФИО…"
                                    aria-label="Поиск сотрудника"
                                />
                                <span className="vac-att-stats__table-count">
                                    {tableRows.length} из {employeeStats.length}
                                </span>
                            </div>
                        </div>
                        {employeeStats.length === 0 ? (
                            <p className="vac-att-stats__empty">Нарушений посещаемости за период не зафиксировано.</p>
                        ) : tableRows.length === 0 ? (
                            <p className="vac-att-stats__empty">Никого не найдено по запросу «{search}».</p>
                        ) : (
                            <div className="vac-att-stats__table-scroll">
                                <table className="vac-att-stats__table">
                                    <thead>
                                        <tr>
                                            <th scope="col">#</th>
                                            <th scope="col">
                                                <button type="button" className="vac-att-stats__th-btn" onClick={() => toggleSort('label')}>
                                                    Сотрудник {sortIndicator(sortKey === 'label', sortDir)}
                                                </button>
                                            </th>
                                            <th scope="col">
                                                <button type="button" className="vac-att-stats__th-btn" onClick={() => toggleSort('lateCount')}>
                                                    Опоздания {sortIndicator(sortKey === 'lateCount', sortDir)}
                                                </button>
                                            </th>
                                            <th scope="col">
                                                <button type="button" className="vac-att-stats__th-btn" onClick={() => toggleSort('lateMinutesTotal')}>
                                                    Сумма {sortIndicator(sortKey === 'lateMinutesTotal', sortDir)}
                                                </button>
                                            </th>
                                            <th scope="col">
                                                <button type="button" className="vac-att-stats__th-btn" onClick={() => toggleSort('avgLate')}>
                                                    Среднее {sortIndicator(sortKey === 'avgLate', sortDir)}
                                                </button>
                                            </th>
                                            <th scope="col">
                                                <button type="button" className="vac-att-stats__th-btn" onClick={() => toggleSort('absentCount')}>
                                                    Отсутствия {sortIndicator(sortKey === 'absentCount', sortDir)}
                                                </button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((row: VacationAttendanceEmployeeStats) => {
                                            const globalRank = employeeStats.findIndex((r) => r.rowId === row.rowId) + 1;
                                            return (
                                                <tr
                                                    key={row.rowId}
                                                    className={globalRank <= 3 ? `vac-att-stats__table-row--top${globalRank}` : undefined}
                                                >
                                                    <td>
                                                        {globalRank <= 3 ? (
                                                            <span className={`vac-att-stats__rank vac-att-stats__rank--${globalRank}`}>{globalRank}</span>
                                                        ) : (
                                                            globalRank
                                                        )}
                                                    </td>
                                                    <td className="vac-att-stats__name">{row.label}</td>
                                                    <td className="vac-att-stats__num vac-att-stats__num--late">{row.lateCount}</td>
                                                    <td className="vac-att-stats__num">{formatVacationLateMinutesTotal(row.lateMinutesTotal)}</td>
                                                    <td className="vac-att-stats__num">{row.lateCount > 0 ? formatVacationLateMinutesTotal(averageVacationLateMinutes(row)) : '—'}</td>
                                                    <td className="vac-att-stats__num vac-att-stats__num--absent">{row.absentCount}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
