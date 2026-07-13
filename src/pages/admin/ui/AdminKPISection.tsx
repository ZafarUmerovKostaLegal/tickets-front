import type { AdminMetrics } from '../model/types';
type AdminKPISectionProps = {
    metrics: AdminMetrics;
    loading: boolean;
    usersCount: number;
};
const KPI_CARDS = [
    { key: 'active', label: 'Активные', sub: 'из пользователей', color: 'blue', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { key: 'blocked', label: 'Заблокированные', sub: 'флаг блокировки', color: 'orange', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> },
    { key: 'archived', label: 'Архив', sub: 'в архиве', color: 'green', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> },
    { key: 'roles', label: 'Ролей', sub: 'уникальных', color: 'violet', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
] as const;
export function AdminKPISection({ metrics, loading, usersCount }: AdminKPISectionProps) {
    const values = {
        active: metrics.activeUsers,
        blocked: metrics.blockedUsers,
        archived: metrics.archivedUsers,
        roles: metrics.roles.length,
    };
    const subs = {
        active: `из ${metrics.totalUsers} пользователей`,
        blocked: 'флаг блокировки',
        archived: 'в архиве',
        roles: 'уникальных',
    };
    return (<section className="ap__kpi" style={{ gap: 'var(--ap-kpi-gap)' }}>
      {KPI_CARDS.map((card) => (<div key={card.key} className={`ap__kpi-card ap__kpi-card--${card.color}`} style={{ borderRadius: 'var(--ap-kpi-card-border-radius)', padding: 'var(--ap-kpi-card-padding)', gap: 'var(--ap-kpi-card-gap)', background: 'var(--ap-kpi-card-bg)', border: 'var(--ap-kpi-card-border)' }}>
          <div className="ap__kpi-icon">{card.icon}</div>
          {loading && usersCount === 0 ? (<div className="ap__kpi-skel" style={{ gap: 'var(--ap-kpi-skel-gap)' }}><span style={{ height: 'var(--ap-skel-md-height)', width: 'var(--ap-skel-md-width)', borderRadius: 'var(--ap-skel-border-radius)' }}/><span style={{ height: 'var(--ap-skel-sm-height)', width: 'var(--ap-skel-sm-width)', borderRadius: 'var(--ap-skel-border-radius)' }}/></div>) : (<>
              <span className="ap__kpi-value" style={{ fontSize: 'var(--ap-kpi-value-font-size)', fontWeight: 'var(--ap-kpi-value-font-weight)' }}>{values[card.key]}</span>
              <span className="ap__kpi-label" style={{ fontSize: 'var(--ap-kpi-label-font-size)', color: 'var(--ap-kpi-label-color)', fontWeight: 'var(--ap-kpi-label-font-weight)' }}>{card.label}</span>
              <span className="ap__kpi-sub" style={{ fontSize: 'var(--ap-kpi-sub-font-size)', color: 'var(--ap-kpi-sub-color)' }}>{subs[card.key]}</span>
            </>)}
        </div>))}
    </section>);
}
