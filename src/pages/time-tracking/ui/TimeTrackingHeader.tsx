import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
export type TimeTrackingHeaderProps = {
    trailing?: ReactNode;
};
export function TimeTrackingHeader({ trailing }: TimeTrackingHeaderProps) {
    const navigate = useNavigate();
    const handleBack = useCallback(() => navigate(routes.home), [navigate]);
    const withManager = Boolean(trailing);
    return (<header className={`time-page__header${withManager ? ' time-page__header--with-manager' : ''}`.trim()}>
      <button type="button" className="time-page__back-btn" onClick={handleBack} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        <span className="time-page__back-label">Назад</span>
      </button>
      <div className="time-page__header-divider"/>
      <div className="time-page__header-inner">
        <h1 className="time-page__title">Учёт времени</h1>
        {trailing ? <div className="time-page__header-trailing">{trailing}</div> : null}
      </div>
    </header>);
}
