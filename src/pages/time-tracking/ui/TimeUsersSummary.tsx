import type { TimeUsersTotals } from '@entities/time-tracking/model/types';
function fmtHM(decimalHours: number): string {
    const totalMinutes = Math.round(decimalHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}
type Props = {
    totals: TimeUsersTotals;
};
export function TimeUsersSummary({ totals }: Props) {
    const { totalHours, teamCapacity, billableHours, nonBillableHours, teamWorkloadPercent } = totals;
    const utilizationPct = Math.min(Math.max(teamWorkloadPercent, 0), 100);
    const billablePct = totalHours > 0 ? Math.min((billableHours / totalHours) * 100, 100) : 0;
    return (<section className="tus time-users__summary--animate">
    <div className="tus__cards">

        <div className="tus__card">
          <div className="tus__card-icon tus__card-icon--total">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="tus__card-body">
            <span className="tus__card-label">Всего часов</span>
            <span className="tus__card-value">{fmtHM(totalHours)}</span>
          </div>
        </div>

        <div className="tus__card">
          <div className="tus__card-icon tus__card-icon--capacity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="tus__card-body">
            <span className="tus__card-label">
              Ёмкость команды <span className="tus__card-label-unit">(ч/нед)</span>
            </span>
            <span className="tus__card-value">{fmtHM(teamCapacity)}</span>
          </div>
        </div>

        <div className="tus__card tus__card--billable">
          <div className="tus__card-icon tus__card-icon--billable">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="tus__card-body">
            <span className="tus__card-label">Оплачиваемые</span>
            <span className="tus__card-value">{fmtHM(billableHours)}</span>
          </div>
          <div className="tus__card-accent tus__card-accent--billable"/>
        </div>

        <div className="tus__card tus__card--non-billable">
          <div className="tus__card-icon tus__card-icon--non-billable">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div className="tus__card-body">
            <span className="tus__card-label">Неоплачиваемые</span>
            <span className="tus__card-value">{fmtHM(nonBillableHours)}</span>
          </div>
          <div className="tus__card-accent tus__card-accent--non-billable"/>
        </div>

      </div>
    <div className="tus__util">
        <div className="tus__util-header">
          <span className="tus__util-label">Загрузка команды</span>
          <span className="tus__util-pct">{utilizationPct.toFixed(0)}%</span>
        </div>
        <div className="tus__util-track">
          <div className="tus__util-fill" style={{ width: `${utilizationPct}%` }} aria-valuenow={utilizationPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="tus__util-fill-billable" style={{ width: `${billablePct}%` }}/>
          </div>
        </div>
        <div className="tus__util-legend">
          <span className="tus__util-leg-item tus__util-leg-item--billable">
            <i />
            Оплачиваемые — {fmtHM(billableHours)}
          </span>
          <span className="tus__util-leg-item tus__util-leg-item--non-billable">
            <i />
            Неоплачиваемые — {fmtHM(nonBillableHours)}
          </span>
        </div>
      </div>

    </section>);
}
