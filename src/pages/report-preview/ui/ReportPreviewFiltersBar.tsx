import { useEffect, useId, useRef, useState } from 'react';
import type { ReportsFilterUser } from '@entities/time-tracking';
import type { PeriodGranularity } from '@entities/time-tracking/model/reportsPanelConfig';
import { PERIOD_OPTIONS } from '@entities/time-tracking/model/reportsPanelConfig';
import { DatePicker } from '@shared/ui/DatePicker';
import { useI18n, ttReportPeriodLabel } from '@shared/i18n';
import { ReportsUserFilterDropdown } from '@pages/time-tracking/ui/ReportsUserFilterDropdown';
import { ReportPreviewTeamFilter, type ReportPreviewTeamFilterProps } from './ReportPreviewTeamFilter';

const IcoChevLeft = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M15 18l-6-6 6-6" />
</svg>);
const IcoChevRight = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M9 18l6-6-6-6" />
</svg>);
const IcoChevDown = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M6 9l6 6 6-6" />
</svg>);

export type ReportPreviewFiltersBarProps = {
    periodTitle: string;
    periodGranularity: PeriodGranularity;
    onPeriodGranularityChange: (g: PeriodGranularity) => void;
    onPrevPeriod: () => void;
    onNextPeriod: () => void;
    users: ReportsFilterUser[];
    usersError?: string | null;
    selectedUserIds: number[];
    onSelectedUserIdsChange: (ids: number[]) => void;
    dateFrom: string;
    dateTo: string;
    onDateFromChange: (iso: string) => void;
    onDateToChange: (iso: string) => void;
    customRangeActive: boolean;
    onResetCustomRange: () => void;
    disabled?: boolean;
    
    hidePeriodControls?: boolean;
    teamFilter?: Omit<ReportPreviewTeamFilterProps, 'disabled'>;
};

export function ReportPreviewFiltersBar({
    periodTitle,
    periodGranularity,
    onPeriodGranularityChange,
    onPrevPeriod,
    onNextPeriod,
    users,
    usersError,
    selectedUserIds,
    onSelectedUserIdsChange,
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    customRangeActive,
    onResetCustomRange,
    disabled = false,
    hidePeriodControls = false,
    teamFilter,
}: ReportPreviewFiltersBarProps) {
    const { t } = useI18n();
    const rangeId = useId();
    const [periodDropdown, setPeriodDropdown] = useState(false);
    const periodDropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!periodDropdown || hidePeriodControls)
            return;
        const h = (e: MouseEvent) => {
            if (periodDropdownRef.current?.contains(e.target as Node))
                return;
            setPeriodDropdown(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [periodDropdown, hidePeriodControls]);
    return (<div className={`tt-rp-preview__filters${hidePeriodControls ? ' tt-rp-preview__filters--period-locked' : ''}`}>
        <div className="tt-reports__header tt-rp-preview__filters-header">
            <div className="tt-reports__header-left">
                {hidePeriodControls ? (<h2 className="tt-reports__period-title">{periodTitle}</h2>) : (<>
                    <button type="button" className="tt-reports__nav-btn" onClick={onPrevPeriod} disabled={disabled || periodGranularity === 'all'} aria-label={t('timeTrackingPage.reports.header.prevPeriod')}>
                        <IcoChevLeft />
                    </button>
                    <h2 className="tt-reports__period-title">{periodTitle}</h2>
                    <button type="button" className="tt-reports__nav-btn" onClick={onNextPeriod} disabled={disabled || periodGranularity === 'all'} aria-label={t('timeTrackingPage.reports.header.nextPeriod')}>
                        <IcoChevRight />
                    </button>
                </>)}
            </div>
            <div className="tt-reports__header-right">
                {usersError ? (<p className="tt-reports__users-filter-err" role="status">{usersError}</p>) : null}
                {teamFilter ? (<ReportPreviewTeamFilter {...teamFilter} disabled={disabled} />) : null}
                <ReportsUserFilterDropdown users={users} selected={selectedUserIds} onChange={onSelectedUserIdsChange} disabled={disabled} />
                {!hidePeriodControls ? (<div className="tt-reports__period-dropdown-wrap" ref={periodDropdownRef}>
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown" disabled={disabled} onClick={() => !disabled && setPeriodDropdown((v) => !v)} aria-expanded={periodDropdown}>
                        {ttReportPeriodLabel(periodGranularity, t)} <IcoChevDown />
                    </button>
                    {periodDropdown && !disabled && (<div className="tt-reports__period-dropdown" role="listbox">
                        {PERIOD_OPTIONS.map((opt) => (<button key={opt.id} type="button" role="option" aria-selected={periodGranularity === opt.id} className={`tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`} onClick={() => {
                            onPeriodGranularityChange(opt.id);
                            setPeriodDropdown(false);
                        }}>
                            {ttReportPeriodLabel(opt.id, t)}
                        </button>))}
                    </div>)}
                </div>) : null}
            </div>
        </div>
        {!hidePeriodControls ? (<div className="tt-reports__date-range tt-rp-preview__filters-dates" aria-label={t('timeTrackingPage.reports.dateRange.aria')}>
            <span className="tt-reports__date-range-title">{t('timeTrackingPage.reports.dateRange.title')}</span>
            <div className="tt-reports__date-field">
                <span className="tt-reports__date-field-label" id={`${rangeId}-from`}>
                    {t('timeTrackingPage.reports.dateRange.from')}
                </span>
                <DatePicker value={dateFrom} max={dateTo} onChange={onDateFromChange} disabled={disabled} aria-labelledby={`${rangeId}-from`} portal buttonClassName="tt-reports__date-picker-btn" />
            </div>
            <div className="tt-reports__date-field">
                <span className="tt-reports__date-field-label" id={`${rangeId}-to`}>
                    {t('timeTrackingPage.reports.dateRange.to')}
                </span>
                <DatePicker value={dateTo} min={dateFrom} onChange={onDateToChange} disabled={disabled} aria-labelledby={`${rangeId}-to`} portal buttonClassName="tt-reports__date-picker-btn" />
            </div>
            {customRangeActive && !disabled ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={onResetCustomRange}>
                {t('timeTrackingPage.reports.dateRange.backToPeriod').replace('{period}', ttReportPeriodLabel(periodGranularity, t).toLowerCase())}
            </button>) : null}
        </div>) : null}
    </div>);
}
