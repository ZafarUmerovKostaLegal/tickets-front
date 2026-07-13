import { useEffect, useRef, useState } from 'react';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { useI18n } from '@shared/i18n';
import type { StatisticsLaborKpi } from './statisticsLaborTypes';

const DONUT_FILL_MS = 900;

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

function useAnimatedDonutPercent(target: number): number {
    const [value, setValue] = useState(0);
    const valueRef = useRef(0);
    const rafRef = useRef(0);

    useEffect(() => {
        const prefersReduced = typeof window !== 'undefined'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            valueRef.current = target;
            setValue(target);
            return;
        }

        const from = valueRef.current;
        const start = performance.now();
        cancelAnimationFrame(rafRef.current);

        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / DONUT_FILL_MS);
            const next = from + (target - from) * easeOutCubic(t);
            valueRef.current = next;
            setValue(next);
            if (t < 1)
                rafRef.current = requestAnimationFrame(tick);
            else
                valueRef.current = target;
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target]);

    return value;
}

type Props = {
    kpi: StatisticsLaborKpi;
    /** When true, show accrued + paid financial cards (finance tab). */
    financeMode?: boolean;
};

export function StatisticsSummary({ kpi, financeMode = false }: Props) {
    const { t } = useI18n();
    const k = 'timeTrackingPage.reports.kpi';
    const sk = 'timeTrackingPage.statistics.kpi';

    const billPct = kpi.totalHours > 0
        ? Math.min((kpi.billableHours / kpi.totalHours) * 100, 100)
        : 0;
    const animatedBillPct = useAnimatedDonutPercent(billPct);
    const animatedNonBillPct = 100 - animatedBillPct;

    const accrued = kpi.billableAmount || 0;
    const paid = kpi.paidAmount || 0;
    const currency = kpi.billableCurrency || kpi.paidCurrency || 'USD';
    const showAccrued = accrued > 0;
    const showPaid = paid > 0;
    const showAccruedRate = (kpi.accruedRatePerHour || 0) > 0;
    const showPaidRate = (kpi.ratePerHour || 0) > 0;

    return (
        <section className="tt-statistics__summary" aria-label={t('timeTrackingPage.statistics.summaryAria')}>
            <article className="tt-statistics__summary-card tt-statistics__summary-card--total">
                <div className="tt-statistics__summary-icon tt-statistics__summary-icon--total" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </div>
                <div className="tt-statistics__summary-body">
                    <span className="tt-statistics__summary-label">{t(`${k}.totalHours`)}</span>
                    <span className="tt-statistics__summary-value">{fmtH(kpi.totalHours)}</span>
                </div>
            </article>

            <article className="tt-statistics__summary-card tt-statistics__summary-card--split">
                <div className="tt-statistics__donut" aria-hidden>
                    <svg viewBox="0 0 36 36" className="tt-statistics__donut-svg">
                        <circle
                            className="tt-statistics__donut-ring tt-statistics__donut-ring--billable"
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="var(--app-accent, #4f46e5)"
                            strokeWidth="3.2"
                            strokeDasharray={`${animatedBillPct} ${100 - animatedBillPct}`}
                            strokeLinecap="round"
                            transform="rotate(-90 18 18)"
                        />
                        <circle
                            className="tt-statistics__donut-ring tt-statistics__donut-ring--nonbillable"
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="color-mix(in srgb, var(--app-accent, #4f46e5) 22%, var(--app-border, #e2e8f0))"
                            strokeWidth="3.2"
                            strokeDasharray={`${animatedNonBillPct} ${100 - animatedNonBillPct}`}
                            strokeDashoffset={-animatedBillPct}
                            transform="rotate(-90 18 18)"
                        />
                    </svg>
                    <span className="tt-statistics__donut-pct">{Math.round(animatedBillPct)}%</span>
                </div>
                <div className="tt-statistics__split-legend">
                    <div className="tt-statistics__split-item">
                        <span className="tt-statistics__split-head">
                            <span className="tt-statistics__split-dot tt-statistics__split-dot--billable" />
                            <span>{t(`${k}.billable`)}</span>
                        </span>
                        <span className="tt-statistics__split-value">{fmtH(kpi.billableHours)}</span>
                    </div>
                    <div className="tt-statistics__split-item">
                        <span className="tt-statistics__split-head">
                            <span className="tt-statistics__split-dot tt-statistics__split-dot--nonbillable" />
                            <span>{t(`${k}.nonBillable`)}</span>
                        </span>
                        <span className="tt-statistics__split-value">{fmtH(kpi.nonBillableHours)}</span>
                    </div>
                </div>
            </article>

            <article className="tt-statistics__summary-card tt-statistics__summary-card--amount">
                <div className="tt-statistics__summary-icon tt-statistics__summary-icon--amount" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                </div>
                <div className="tt-statistics__summary-body">
                    <span className="tt-statistics__summary-label">{t(`${sk}.accruedAmount`)}</span>
                    <span className="tt-statistics__summary-value">
                        {showAccrued ? fmtAmtWithIso(accrued, currency) : '—'}
                    </span>
                    {financeMode ? (
                        <span className="tt-statistics__summary-sub">
                            {t(`${sk}.paidAmount`)}:{' '}
                            {showPaid ? fmtAmtWithIso(paid, currency) : '—'}
                        </span>
                    ) : null}
                </div>
            </article>

            <article className="tt-statistics__summary-card tt-statistics__summary-card--rate">
                <div className="tt-statistics__summary-icon tt-statistics__summary-icon--rate" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                        <path d="M3 3v18h18" />
                        <path d="M7 16l4-6 4 3 5-8" />
                    </svg>
                </div>
                <div className="tt-statistics__summary-body">
                    <span className="tt-statistics__summary-label">{t(`${sk}.accruedRatePerHour`)}</span>
                    <span className="tt-statistics__summary-value">
                        {showAccruedRate ? fmtAmtWithIso(kpi.accruedRatePerHour, currency) : '—'}
                    </span>
                    {financeMode ? (
                        <span className="tt-statistics__summary-sub">
                            {t(`${sk}.paidRatePerHour`)}:{' '}
                            {showPaidRate ? fmtAmtWithIso(kpi.ratePerHour, currency) : '—'}
                        </span>
                    ) : null}
                </div>
            </article>
        </section>
    );
}
