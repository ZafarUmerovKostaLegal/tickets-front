import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { useI18n } from '@shared/i18n';
import type { StatisticsLaborDetailRow, StatisticsLaborSort, StatisticsLaborSortKey } from './statisticsLaborTypes';

type Props = {
    rows: StatisticsLaborDetailRow[];
    query: string;
    onQueryChange: (value: string) => void;
    sort: StatisticsLaborSort;
    onSortChange: (next: StatisticsLaborSort) => void;
};

const SORT_KEYS: StatisticsLaborSortKey[] = [
    'partner_name',
    'team_name',
    'lawyer_name',
    'client_name',
    'project_name',
    'task_name',
    'work_type',
    'period_label',
    'hours',
    'billable_amount',
    'payment',
    'rate',
];

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
    return (
        <span className={`tt-statistics__sort-icon${active ? ' tt-statistics__sort-icon--active' : ''}`} aria-hidden>
            {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
    );
}

export function StatisticsDetailTable({ rows, query, onQueryChange, sort, onSortChange }: Props) {
    const { t } = useI18n();
    const base = 'timeTrackingPage.statistics.detailTable';

    const toggleSort = (key: StatisticsLaborSortKey) => {
        onSortChange(
            sort.key === key
                ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'hours' || key === 'payment' || key === 'billable_amount' || key === 'rate' ? 'desc' : 'asc' },
        );
    };

    const colLabel = (key: StatisticsLaborSortKey) => t(`${base}.columns.${key}`);

    return (
        <section className="tt-statistics__detail-section" aria-label={t(`${base}.aria`)}>
            <div className="tt-statistics__detail-head">
                <h3 className="tt-statistics__detail-title">{t(`${base}.title`)}</h3>
                <input
                    type="search"
                    className="tt-statistics__detail-search"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder={t(`${base}.searchPlaceholder`)}
                    aria-label={t(`${base}.searchAria`)}
                />
            </div>

            <div className="tt-statistics__table-card">
                <div className="tt-statistics__table-wrap tt-statistics__detail-wrap">
                    <table className="tt-statistics__detail-table">
                        <thead>
                            <tr>
                                {SORT_KEYS.map((key) => (
                                    <th key={key} scope="col">
                                        <button
                                            type="button"
                                            className="tt-statistics__sort-btn"
                                            onClick={() => toggleSort(key)}
                                            aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            <span>{colLabel(key)}</span>
                                            <SortIcon active={sort.key === key} dir={sort.dir} />
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={SORT_KEYS.length} className="tt-statistics__detail-empty">
                                        {t(`${base}.empty`)}
                                    </td>
                                </tr>
                            ) : rows.map((row) => {
                                const rate = row.billable_hours > 0 ? row.payment / row.billable_hours : 0;
                                return (
                                    <tr key={row.id}>
                                        <td>{row.partner_name}</td>
                                        <td>{row.team_name}</td>
                                        <td>{row.lawyer_name}</td>
                                        <td>{row.client_name}</td>
                                        <td>{row.project_name}</td>
                                        <td>{row.task_name}</td>
                                        <td>{row.work_type}</td>
                                        <td>{row.period_label}</td>
                                        <td className="tt-statistics__num">{fmtH(row.hours)}</td>
                                        <td className="tt-statistics__num">{fmtAmtWithIso(row.billable_amount || 0, row.currency)}</td>
                                        <td className="tt-statistics__num">{fmtAmtWithIso(row.payment, row.currency)}</td>
                                        <td className="tt-statistics__num">
                                            {row.billable_hours > 0 ? fmtAmtWithIso(rate, row.currency) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
