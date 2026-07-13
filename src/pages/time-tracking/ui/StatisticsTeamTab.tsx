import { useMemo } from 'react';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import type { LaborStatisticsChartsApi } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { StatisticsStackedBarList } from './StatisticsStackedBarList';
import { StatisticsWidgetCard } from './StatisticsWidgetCard';
import { StatisticsFinanceChartSection } from './StatisticsFinanceChartSection';
import type { StatisticsChartDrillKind } from './statisticsChartDrillDown';
import type { StackedBarRow } from './statisticsChartTypes';
import { teamFinanceToChartRows } from './statisticsFinanceChartUtils';

type Props = {
    charts: LaborStatisticsChartsApi | null;
    onDrillDown?: (kind: StatisticsChartDrillKind, row: StackedBarRow) => void;
};

export function StatisticsTeamTab({ charts, onDrillDown }: Props) {
    const { t } = useI18n();
    const w = 'timeTrackingPage.statistics.widgets';
    const tf = 'timeTrackingPage.statistics.teamFinance';

    const byTeams = useMemo(() => {
        return (charts?.by_teams ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            primary: r.billable_hours,
            secondary: r.non_billable_hours,
        }));
    }, [charts?.by_teams]);

    const financeRows = charts?.by_teams_finance ?? [];
    const chartRows = useMemo(() => teamFinanceToChartRows(financeRows), [financeRows]);

    const financeTable = (
        <div className="tt-statistics__table-wrap">
            <table className="tt-statistics__detail-table">
                <thead>
                    <tr>
                        <th scope="col">{t(`${tf}.team`)}</th>
                        <th scope="col">{t(`${tf}.hours`)}</th>
                        <th scope="col">{t(`${tf}.billableHours`)}</th>
                        <th scope="col">{t(`${tf}.accrued`)}</th>
                        <th scope="col">{t(`${tf}.paid`)}</th>
                    </tr>
                </thead>
                <tbody>
                    {financeRows.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="tt-statistics__detail-empty">{t(`${w}.noData`)}</td>
                        </tr>
                    ) : financeRows.map((row) => (
                        <tr
                            key={row.team_id || row.team_name}
                            className={onDrillDown && row.team_id ? 'tt-statistics__row--clickable' : undefined}
                            onClick={onDrillDown && row.team_id
                                ? () => onDrillDown('team', {
                                    id: row.team_id,
                                    name: row.team_name,
                                    primary: row.billable_hours,
                                    secondary: Math.max(0, row.hours - row.billable_hours),
                                })
                                : undefined}
                        >
                            <td>{row.team_name}</td>
                            <td className="tt-statistics__num">{fmtH(row.hours)}</td>
                            <td className="tt-statistics__num">{fmtH(row.billable_hours)}</td>
                            <td className="tt-statistics__num">{fmtAmtWithIso(row.billable_amount, row.currency)}</td>
                            <td className="tt-statistics__num">{fmtAmtWithIso(row.paid_amount, row.currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="tt-statistics__tab-body">
            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byTeams`)}
                detailHint={onDrillDown ? t(`${w}.hintDrillTeam`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byTeams}
                    interactive={Boolean(onDrillDown)}
                    searchable
                    scrollable
                    onRowClick={onDrillDown ? (row) => onDrillDown('team', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsFinanceChartSection
                title={t(`${tf}.title`)}
                ariaLabel={t(`${tf}.aria`)}
                rows={chartRows}
                seriesMode="hours_vs_billable"
                emptyText={t(`${w}.noData`)}
                table={financeTable}
                interactive={Boolean(onDrillDown)}
                onCategoryClick={onDrillDown
                    ? (row) => onDrillDown('team', {
                        id: row.id,
                        name: row.name,
                        primary: row.billableHours,
                        secondary: Math.max(0, row.hours - row.billableHours),
                    })
                    : undefined}
            />
        </div>
    );
}
