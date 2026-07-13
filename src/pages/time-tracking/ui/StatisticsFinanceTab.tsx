import { useMemo } from 'react';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import type { LaborStatisticsChartsApi } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { StatisticsTeamTab } from './StatisticsTeamTab';
import { StatisticsFinanceChartSection } from './StatisticsFinanceChartSection';
import {
    efficiencyToChartRows,
    hoursVsPaymentToChartRows,
} from './statisticsFinanceChartUtils';

type Props = {
    charts: LaborStatisticsChartsApi | null;
};

export function StatisticsFinanceTab({ charts }: Props) {
    const { t } = useI18n();
    const f = 'timeTrackingPage.statistics.finance';
    const w = 'timeTrackingPage.statistics.widgets';

    const hoursVsPayment = charts?.hours_vs_payment ?? [];
    const efficiency = charts?.payment_efficiency_ranking ?? [];

    const hoursVsPaymentRows = useMemo(
        () => hoursVsPaymentToChartRows(hoursVsPayment),
        [hoursVsPayment],
    );
    const efficiencyRows = useMemo(
        () => efficiencyToChartRows(efficiency),
        [efficiency],
    );

    const hoursVsPaymentTable = (
        <div className="tt-statistics__table-wrap">
            <table className="tt-statistics__detail-table">
                <thead>
                    <tr>
                        <th scope="col">{t(`${f}.client`)}</th>
                        <th scope="col">{t(`${f}.hours`)}</th>
                        <th scope="col">{t(`${f}.accrued`)}</th>
                        <th scope="col">{t(`${f}.paid`)}</th>
                    </tr>
                </thead>
                <tbody>
                    {hoursVsPayment.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="tt-statistics__detail-empty">{t(`${w}.noData`)}</td>
                        </tr>
                    ) : hoursVsPayment.map((row) => (
                        <tr key={row.name}>
                            <td>{row.name}</td>
                            <td className="tt-statistics__num">{fmtH(row.hours)}</td>
                            <td className="tt-statistics__num">{fmtAmtWithIso(row.billable_amount || 0, row.currency)}</td>
                            <td className="tt-statistics__num">{fmtAmtWithIso(row.payment, row.currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const efficiencyTable = (
        <div className="tt-statistics__table-wrap">
            <table className="tt-statistics__detail-table">
                <thead>
                    <tr>
                        <th scope="col">{t(`${f}.client`)}</th>
                        <th scope="col">{t(`${f}.hours`)}</th>
                        <th scope="col">{t(`${f}.paid`)}</th>
                        <th scope="col">{t(`${f}.rate`)}</th>
                    </tr>
                </thead>
                <tbody>
                    {efficiency.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="tt-statistics__detail-empty">{t(`${w}.noData`)}</td>
                        </tr>
                    ) : efficiency.map((row) => (
                        <tr key={row.name}>
                            <td>{row.name}</td>
                            <td className="tt-statistics__num">{fmtH(row.hours)}</td>
                            <td className="tt-statistics__num">{fmtAmtWithIso(row.payment, row.currency)}</td>
                            <td className="tt-statistics__num">{fmtAmtWithIso(row.rate_per_hour, row.currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="tt-statistics__tab-body">
            <StatisticsFinanceChartSection
                title={t(`${f}.hoursVsPayment`)}
                rows={hoursVsPaymentRows}
                seriesMode="accrued_vs_paid"
                emptyText={t(`${w}.noData`)}
                table={hoursVsPaymentTable}
            />

            <StatisticsFinanceChartSection
                title={t(`${f}.efficiency`)}
                rows={efficiencyRows}
                seriesMode="rate"
                allowMetricToggle={false}
                emptyText={t(`${w}.noData`)}
                table={efficiencyTable}
            />

            <StatisticsTeamTab charts={charts} />
        </div>
    );
}
