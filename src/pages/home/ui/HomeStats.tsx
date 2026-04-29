import { memo, useCallback } from 'react';
import type { StatusItem } from '@entities/ticket';
import type { TicketStats } from '../model/types';
type HomeStatsProps = {
    total: number;
    ticketStats: TicketStats;
    filterStatus: string;
    setFilterStatus: (v: string) => void;
    statuses: StatusItem[];
};
function resolveStatusValue(statuses: StatusItem[], tile: 'in_progress' | 'closed' | 'impossible'): string {
    if (tile === 'in_progress') {
        const exact = statuses.find((s) => s.value === 'in_progress');
        if (exact)
            return exact.value;
        const byLabel = statuses.find((s) => /в работе|progress/i.test(s.label));
        return byLabel?.value ?? 'in_progress';
    }
    if (tile === 'closed') {
        const exact = statuses.find((s) => s.value === 'closed');
        if (exact)
            return exact.value;
        const byLabel = statuses.find((s) => /закрыт/i.test(s.label));
        return byLabel?.value ?? 'closed';
    }
    const exact = statuses.find((s) => s.value === 'impossible');
    if (exact)
        return exact.value;
    const byLabel = statuses.find((s) => /невозмож|impossible/i.test(s.label + s.value));
    return byLabel?.value ?? 'impossible';
}
export const HomeStats = memo(function HomeStats({ total, ticketStats, filterStatus, setFilterStatus, statuses, }: HomeStatsProps) {
    const onTotal = useCallback(() => setFilterStatus(''), [setFilterStatus]);
    const onProgress = useCallback(() => {
        setFilterStatus(resolveStatusValue(statuses, 'in_progress'));
    }, [setFilterStatus, statuses]);
    const onClosed = useCallback(() => {
        setFilterStatus(resolveStatusValue(statuses, 'closed'));
    }, [setFilterStatus, statuses]);
    const onImpossible = useCallback(() => {
        setFilterStatus(resolveStatusValue(statuses, 'impossible'));
    }, [setFilterStatus, statuses]);
    const vInProgress = resolveStatusValue(statuses, 'in_progress');
    const vClosed = resolveStatusValue(statuses, 'closed');
    const vImpossible = resolveStatusValue(statuses, 'impossible');
    return (<div className="home-stats">
      <button type="button" className={`home-stats__card home-stats__card--total${filterStatus === '' ? ' home-stats__card--active' : ''}`} onClick={onTotal} aria-pressed={filterStatus === ''}>
        <div className="home-stats__icon-wrap home-stats__icon-wrap--total">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{total}</span>
          <span className="home-stats__label">Всего заявок</span>
        </div>
      </button>
      <button type="button" className={`home-stats__card home-stats__card--progress${filterStatus === vInProgress ? ' home-stats__card--active' : ''}`} onClick={onProgress} aria-pressed={filterStatus === vInProgress}>
        <div className="home-stats__icon-wrap home-stats__icon-wrap--progress">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{ticketStats.inProgress}</span>
          <span className="home-stats__label">В работе</span>
        </div>
      </button>
      <button type="button" className={`home-stats__card home-stats__card--closed${filterStatus === vClosed ? ' home-stats__card--active' : ''}`} onClick={onClosed} aria-pressed={filterStatus === vClosed}>
        <div className="home-stats__icon-wrap home-stats__icon-wrap--closed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{ticketStats.closed}</span>
          <span className="home-stats__label">Закрытые</span>
        </div>
      </button>
      <button type="button" className={`home-stats__card home-stats__card--impossible${filterStatus === vImpossible ? ' home-stats__card--active' : ''}`} onClick={onImpossible} aria-pressed={filterStatus === vImpossible}>
        <div className="home-stats__icon-wrap home-stats__icon-wrap--impossible">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{ticketStats.impossible}</span>
          <span className="home-stats__label">Невозможно</span>
        </div>
      </button>
    </div>);
});
