import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { useI18n } from '@shared/i18n';
import { CHART_TOOLTIP, GRID_STROKE, TICK_FILL } from './statisticsInteractiveCharts';
import { StatisticsChartAnchor, StatisticsRechartsPortalTooltip } from './StatisticsRechartsPortalTooltip';
import {
    applyFinanceTopN,
    chartHeightForRows,
    defaultSortKeyForMode,
    filterRowsByCurrency,
    financeRowsSummary,
    listCurrencies,
    pickDefaultCurrency,
    shortenCategoryLabel,
    sortFinanceRows,
    type FinanceChartMetric,
    type FinanceChartRow,
    type FinanceChartSeriesMode,
    type FinanceChartView,
    type FinanceSortKey,
    type FinanceTopN,
} from './statisticsFinanceChartUtils';

const ACCRUED_COLOR = '#6366f1';
const PAID_COLOR = '#10b981';
const HOURS_COLOR = '#64748b';
const BILLABLE_COLOR = '#4f46e5';
const RATE_COLOR = '#f59e0b';
const COLLECTION_COLOR = '#0ea5e9';

type TooltipPayloadItem = {
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
    payload?: FinanceChartRow & { label?: string };
};

function extractFinanceRow(data: unknown): FinanceChartRow | null {
    if (!data || typeof data !== 'object')
        return null;
    const obj = data as Record<string, unknown>;
    const payload = (obj.payload && typeof obj.payload === 'object'
        ? obj.payload
        : obj) as Partial<FinanceChartRow>;
    if (typeof payload.id !== 'string' || typeof payload.name !== 'string')
        return null;
    return payload as FinanceChartRow;
}

type Props = {
    title: string;
    ariaLabel?: string;
    rows: FinanceChartRow[];
    seriesMode: FinanceChartSeriesMode;
    allowMetricToggle?: boolean;
    /** Enable «Сбор %» metric (paid/accrued). Default true for money-capable modes. */
    allowCollectionMetric?: boolean;
    emptyText: string;
    table: ReactNode;
    onCategoryClick?: (row: FinanceChartRow) => void;
    interactive?: boolean;
};

type ChartLabels = {
    hours: string;
    billableHours: string;
    accrued: string;
    paid: string;
    rate: string;
    collection: string;
};

function FinanceChartTooltip({
    active,
    payload,
    seriesMode,
    labels,
}: {
    active?: boolean;
    payload?: readonly TooltipPayloadItem[];
    seriesMode: FinanceChartSeriesMode;
    labels: ChartLabels;
}) {
    if (!active || !payload?.length)
        return null;
    const row = payload[0]?.payload;
    if (!row)
        return null;
    const currency = row.currency;
    return (
        <div className="tt-statistics__finance-chart-tooltip">
            <div className="tt-statistics__finance-chart-tooltip__title">{row.name}</div>
            <ul className="tt-statistics__finance-chart-tooltip__list">
                <li>
                    <span className="tt-statistics__finance-chart-tooltip__dot" style={{ background: HOURS_COLOR }} />
                    <span>{labels.hours}</span>
                    <strong>{fmtH(row.hours)}</strong>
                </li>
                {Math.abs(row.billableHours - row.hours) > 0.001 ? (
                    <li>
                        <span className="tt-statistics__finance-chart-tooltip__dot" style={{ background: BILLABLE_COLOR }} />
                        <span>{labels.billableHours}</span>
                        <strong>{fmtH(row.billableHours)}</strong>
                    </li>
                ) : null}
                {seriesMode !== 'rate' ? (
                    <li>
                        <span className="tt-statistics__finance-chart-tooltip__dot" style={{ background: ACCRUED_COLOR }} />
                        <span>{labels.accrued}</span>
                        <strong>{fmtAmtWithIso(row.accrued, currency)}</strong>
                    </li>
                ) : null}
                <li>
                    <span className="tt-statistics__finance-chart-tooltip__dot" style={{ background: PAID_COLOR }} />
                    <span>{labels.paid}</span>
                    <strong>{fmtAmtWithIso(row.paid, currency)}</strong>
                </li>
                {seriesMode === 'rate' || row.ratePerHour > 0 ? (
                    <li>
                        <span className="tt-statistics__finance-chart-tooltip__dot" style={{ background: RATE_COLOR }} />
                        <span>{labels.rate}</span>
                        <strong>{fmtAmtWithIso(row.ratePerHour, currency)}</strong>
                    </li>
                ) : null}
                <li className="tt-statistics__finance-chart-tooltip__meta">
                    <span className="tt-statistics__finance-chart-tooltip__dot" style={{ background: COLLECTION_COLOR }} />
                    <span>{labels.collection}</span>
                    <strong>{row.collectionRatio.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</strong>
                </li>
            </ul>
        </div>
    );
}

export function StatisticsFinanceChartSection({
    title,
    ariaLabel,
    rows,
    seriesMode,
    allowMetricToggle = true,
    allowCollectionMetric = true,
    emptyText,
    table,
    onCategoryClick,
    interactive = false,
}: Props) {
    const { t } = useI18n();
    const fc = 'timeTrackingPage.statistics.financeCharts';
    const currencies = useMemo(() => listCurrencies(rows), [rows]);
    const [currency, setCurrency] = useState<string | null>(() => pickDefaultCurrency(rows));
    const [metric, setMetric] = useState<FinanceChartMetric>(() => (
        seriesMode === 'hours_vs_billable' ? 'hours' : 'money'
    ));
    const [view, setView] = useState<FinanceChartView>('chart');
    const [topN, setTopN] = useState<FinanceTopN>(10);
    const [sortKey, setSortKey] = useState<FinanceSortKey>(() => defaultSortKeyForMode(seriesMode, 'money'));
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        const next = pickDefaultCurrency(rows);
        setCurrency((prev) => {
            if (prev && currencies.includes(prev))
                return prev;
            return next;
        });
    }, [rows, currencies]);

    const effectiveMetric: FinanceChartMetric = allowMetricToggle
        ? metric
        : (seriesMode === 'rate' || seriesMode === 'collection_ratio'
            ? (seriesMode === 'collection_ratio' ? 'collection' : 'money')
            : (seriesMode === 'hours_vs_billable' ? 'hours' : 'money'));

    useEffect(() => {
        setSortKey(defaultSortKeyForMode(seriesMode, effectiveMetric));
    }, [seriesMode, effectiveMetric]);

    const filtered = useMemo(() => {
        if (effectiveMetric === 'hours')
            return rows;
        return filterRowsByCurrency(rows, currency);
    }, [rows, currency, effectiveMetric]);

    const prepared = useMemo(() => {
        const sorted = sortFinanceRows(filtered, sortKey, 'desc');
        return applyFinanceTopN(sorted, topN, t(`${fc}.other`));
    }, [filtered, sortKey, topN, t, fc]);

    const summary = useMemo(() => financeRowsSummary(prepared.filter((r) => r.id !== '__other__')), [prepared]);

    const chartData = useMemo(() => prepared.map((r) => ({
        ...r,
        label: shortenCategoryLabel(r.name),
    })), [prepared]);

    const height = chartHeightForRows(chartData.length);
    const showCurrencyChips = currencies.length > 0 && effectiveMetric !== 'hours';
    const showCollection = allowCollectionMetric && seriesMode !== 'rate';

    const labels: ChartLabels = {
        hours: t(`${fc}.hours`),
        billableHours: t(`${fc}.billableHours`),
        accrued: t(`${fc}.accrued`),
        paid: t(`${fc}.paid`),
        rate: t(`${fc}.rate`),
        collection: t(`${fc}.collection`),
    };

    const handleBarClick = (data: unknown) => {
        if (!onCategoryClick || !interactive)
            return;
        const row = extractFinanceRow(data);
        if (!row || row.id === '__other__')
            return;
        onCategoryClick(row);
    };

    const handleBarEnter = (data: unknown) => {
        const row = extractFinanceRow(data);
        setActiveId(row?.id ?? null);
    };

    const xTick = (v: number) => {
        if (effectiveMetric === 'hours')
            return fmtH(v);
        if (effectiveMetric === 'collection' || seriesMode === 'collection_ratio')
            return `${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}%`;
        return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    };

    const showHoursBars = seriesMode !== 'rate' && seriesMode !== 'collection_ratio' && effectiveMetric === 'hours';
    const showMoneyBars = seriesMode !== 'rate' && seriesMode !== 'collection_ratio' && effectiveMetric === 'money';
    const showCollectionBars = seriesMode === 'collection_ratio' || effectiveMetric === 'collection';

    return (
        <section className="tt-statistics__finance-chart-section" aria-label={ariaLabel ?? title}>
            <div className="tt-statistics__finance-chart-head">
                <h3 className="tt-statistics__section-title">{title}</h3>
                <div className="tt-statistics__finance-chart-controls">
                    {allowMetricToggle ? (
                        <div className="tt-statistics__finance-chart-toggle" role="group" aria-label={t(`${fc}.metricAria`)}>
                            <button
                                type="button"
                                className={`tt-statistics__finance-chart-toggle-btn${effectiveMetric === 'hours' ? ' is-active' : ''}`}
                                aria-pressed={effectiveMetric === 'hours'}
                                onClick={() => setMetric('hours')}
                            >
                                {t(`${fc}.metricHours`)}
                            </button>
                            <button
                                type="button"
                                className={`tt-statistics__finance-chart-toggle-btn${effectiveMetric === 'money' ? ' is-active' : ''}`}
                                aria-pressed={effectiveMetric === 'money'}
                                onClick={() => setMetric('money')}
                            >
                                {t(`${fc}.metricMoney`)}
                            </button>
                            {showCollection ? (
                                <button
                                    type="button"
                                    className={`tt-statistics__finance-chart-toggle-btn${effectiveMetric === 'collection' ? ' is-active' : ''}`}
                                    aria-pressed={effectiveMetric === 'collection'}
                                    onClick={() => setMetric('collection')}
                                >
                                    {t(`${fc}.metricCollection`)}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="tt-statistics__finance-chart-toggle" role="group" aria-label={t(`${fc}.viewAria`)}>
                        <button
                            type="button"
                            className={`tt-statistics__finance-chart-toggle-btn${view === 'chart' ? ' is-active' : ''}`}
                            aria-pressed={view === 'chart'}
                            onClick={() => setView('chart')}
                        >
                            {t(`${fc}.viewChart`)}
                        </button>
                        <button
                            type="button"
                            className={`tt-statistics__finance-chart-toggle-btn${view === 'table' ? ' is-active' : ''}`}
                            aria-pressed={view === 'table'}
                            onClick={() => setView('table')}
                        >
                            {t(`${fc}.viewTable`)}
                        </button>
                    </div>
                </div>
            </div>

            {view === 'chart' && rows.length > 0 ? (
                <div className="tt-statistics__finance-chart-tools">
                    {showCurrencyChips && currencies.length > 1 ? (
                        <div className="tt-statistics__finance-chart-currencies" role="group" aria-label={t(`${fc}.currencyFilter`)}>
                            {currencies.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className={`tt-statistics__finance-chart-chip${currency === c ? ' is-active' : ''}`}
                                    aria-pressed={currency === c}
                                    onClick={() => setCurrency(c)}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    ) : showCurrencyChips && currency ? (
                        <p className="tt-statistics__finance-chart-currency-note">{t(`${fc}.currency`)}: {currency}</p>
                    ) : null}

                    <div className="tt-statistics__finance-chart-filters">
                        <label className="tt-statistics__finance-chart-select">
                            <span>{t(`${fc}.sortBy`)}</span>
                            <select
                                value={sortKey}
                                onChange={(e) => setSortKey(e.target.value as FinanceSortKey)}
                                aria-label={t(`${fc}.sortBy`)}
                            >
                                <option value="hours">{t(`${fc}.hours`)}</option>
                                <option value="billableHours">{t(`${fc}.billableHours`)}</option>
                                <option value="accrued">{t(`${fc}.accrued`)}</option>
                                <option value="paid">{t(`${fc}.paid`)}</option>
                                <option value="collectionRatio">{t(`${fc}.collection`)}</option>
                                {seriesMode === 'rate' ? <option value="ratePerHour">{t(`${fc}.rate`)}</option> : null}
                                <option value="name">{t(`${fc}.sortName`)}</option>
                            </select>
                        </label>
                        <div className="tt-statistics__finance-chart-toggle" role="group" aria-label={t(`${fc}.topNAria`)}>
                            {([5, 10, 20, 0] as FinanceTopN[]).map((n) => (
                                <button
                                    key={String(n)}
                                    type="button"
                                    className={`tt-statistics__finance-chart-toggle-btn${topN === n ? ' is-active' : ''}`}
                                    aria-pressed={topN === n}
                                    onClick={() => setTopN(n)}
                                >
                                    {n === 0 ? t(`${fc}.topAll`) : t(`${fc}.topN`).replace('{n}', String(n))}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="tt-statistics__finance-chart-kpis" aria-label={t(`${fc}.summaryAria`)}>
                        <div className="tt-statistics__finance-chart-kpi">
                            <span>{t(`${fc}.hours`)}</span>
                            <strong>{fmtH(summary.hours)}</strong>
                        </div>
                        <div className="tt-statistics__finance-chart-kpi">
                            <span>{t(`${fc}.accrued`)}</span>
                            <strong>{fmtAmtWithIso(summary.accrued, currency ?? prepared[0]?.currency ?? '')}</strong>
                        </div>
                        <div className="tt-statistics__finance-chart-kpi">
                            <span>{t(`${fc}.paid`)}</span>
                            <strong>{fmtAmtWithIso(summary.paid, currency ?? prepared[0]?.currency ?? '')}</strong>
                        </div>
                        <div className="tt-statistics__finance-chart-kpi">
                            <span>{t(`${fc}.collection`)}</span>
                            <strong>{summary.collectionRatio.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</strong>
                        </div>
                    </div>
                </div>
            ) : null}

            {view === 'table' ? (
                <div className="tt-statistics__table-card">{table}</div>
            ) : rows.length === 0 ? (
                <p className="tt-statistics__widget-empty">{emptyText}</p>
            ) : chartData.length === 0 ? (
                <p className="tt-statistics__widget-empty">{t(`${fc}.noRowsInCurrency`)}</p>
            ) : (
                <div className="tt-statistics__finance-chart-wrap">
                    <StatisticsChartAnchor className="tt-statistics__finance-chart-anchor">
                        <ResponsiveContainer width="100%" height={height}>
                            <BarChart
                                layout="vertical"
                                data={chartData}
                                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                                barCategoryGap="18%"
                                barGap={4}
                            >
                                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fill: TICK_FILL, fontSize: 11 }} tickFormatter={xTick} />
                                <YAxis type="category" dataKey="label" width={128} tick={{ fill: TICK_FILL, fontSize: 11 }} />
                                <Tooltip
                                    {...CHART_TOOLTIP}
                                    content={(props) => (
                                        <StatisticsRechartsPortalTooltip {...props}>
                                            <FinanceChartTooltip
                                                active={props.active}
                                                payload={props.payload as readonly TooltipPayloadItem[] | undefined}
                                                seriesMode={seriesMode}
                                                labels={labels}
                                            />
                                        </StatisticsRechartsPortalTooltip>
                                    )}
                                />
                                {seriesMode === 'rate' ? (
                                    <Bar dataKey="ratePerHour" name={labels.rate} fill={RATE_COLOR} radius={[0, 4, 4, 0]} cursor={interactive ? 'pointer' : undefined} onClick={handleBarClick}>
                                        {chartData.map((r) => <Cell key={`rate-${r.id}`} fill={RATE_COLOR} opacity={activeId && activeId !== r.id ? 0.45 : 1} />)}
                                    </Bar>
                                ) : showCollectionBars ? (
                                    <Bar dataKey="collectionRatio" name={labels.collection} fill={COLLECTION_COLOR} radius={[0, 4, 4, 0]} cursor={interactive ? 'pointer' : undefined} onClick={handleBarClick} onMouseEnter={handleBarEnter} onMouseLeave={() => setActiveId(null)}>
                                        {chartData.map((r) => <Cell key={`c-${r.id}`} fill={COLLECTION_COLOR} opacity={activeId && activeId !== r.id ? 0.45 : 1} />)}
                                    </Bar>
                                ) : showHoursBars ? (
                                    <>
                                        <Bar dataKey="hours" name={labels.hours} fill={HOURS_COLOR} radius={[0, 4, 4, 0]} cursor={interactive ? 'pointer' : undefined} onClick={handleBarClick} onMouseEnter={handleBarEnter} onMouseLeave={() => setActiveId(null)}>
                                            {chartData.map((r) => <Cell key={`h-${r.id}`} fill={HOURS_COLOR} opacity={activeId && activeId !== r.id ? 0.45 : 1} />)}
                                        </Bar>
                                        {(seriesMode === 'hours_vs_billable' || chartData.some((r) => Math.abs(r.billableHours - r.hours) > 0.001)) ? (
                                            <Bar dataKey="billableHours" name={labels.billableHours} fill={BILLABLE_COLOR} radius={[0, 4, 4, 0]} cursor={interactive ? 'pointer' : undefined} onClick={handleBarClick} onMouseEnter={handleBarEnter} onMouseLeave={() => setActiveId(null)}>
                                                {chartData.map((r) => <Cell key={`bh-${r.id}`} fill={BILLABLE_COLOR} opacity={activeId && activeId !== r.id ? 0.45 : 1} />)}
                                            </Bar>
                                        ) : null}
                                    </>
                                ) : showMoneyBars ? (
                                    <>
                                        <Bar dataKey="accrued" name={labels.accrued} fill={ACCRUED_COLOR} radius={[0, 4, 4, 0]} cursor={interactive ? 'pointer' : undefined} onClick={handleBarClick} onMouseEnter={handleBarEnter} onMouseLeave={() => setActiveId(null)}>
                                            {chartData.map((r) => <Cell key={`a-${r.id}`} fill={ACCRUED_COLOR} opacity={activeId && activeId !== r.id ? 0.45 : 1} />)}
                                        </Bar>
                                        <Bar dataKey="paid" name={labels.paid} fill={PAID_COLOR} radius={[0, 4, 4, 0]} cursor={interactive ? 'pointer' : undefined} onClick={handleBarClick} onMouseEnter={handleBarEnter} onMouseLeave={() => setActiveId(null)}>
                                            {chartData.map((r) => <Cell key={`p-${r.id}`} fill={PAID_COLOR} opacity={activeId && activeId !== r.id ? 0.45 : 1} />)}
                                        </Bar>
                                    </>
                                ) : seriesMode === 'paid' ? (
                                    <Bar dataKey="paid" name={labels.paid} fill={PAID_COLOR} radius={[0, 4, 4, 0]} cursor={interactive ? 'pointer' : undefined} onClick={handleBarClick}>
                                        {chartData.map((r) => <Cell key={`paid-${r.id}`} fill={PAID_COLOR} />)}
                                    </Bar>
                                ) : null}
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="tt-statistics__finance-chart-legend" aria-hidden>
                            {seriesMode === 'rate' ? (
                                <span><i style={{ background: RATE_COLOR }} />{labels.rate}</span>
                            ) : showCollectionBars ? (
                                <span><i style={{ background: COLLECTION_COLOR }} />{labels.collection}</span>
                            ) : showHoursBars ? (
                                <>
                                    <span><i style={{ background: HOURS_COLOR }} />{labels.hours}</span>
                                    {(seriesMode === 'hours_vs_billable' || chartData.some((r) => Math.abs(r.billableHours - r.hours) > 0.001)) ? (
                                        <span><i style={{ background: BILLABLE_COLOR }} />{labels.billableHours}</span>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <span><i style={{ background: ACCRUED_COLOR }} />{labels.accrued}</span>
                                    <span><i style={{ background: PAID_COLOR }} />{labels.paid}</span>
                                </>
                            )}
                        </div>
                    </StatisticsChartAnchor>
                </div>
            )}
        </section>
    );
}
