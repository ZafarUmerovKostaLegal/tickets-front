import { type ReactNode } from 'react';
import { routes } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { clearReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
import '@pages/time-tracking/ui/TimePageShell.css';
import './ReportPreviewPage.css';

export const REPORTS_TAB_URL = `${routes.timeTracking}?tab=reports`;

export type ReportPreviewNavBarProps = {
    hint?: string | null;
    hintTitle?: string | null;
    projectSlot?: ReactNode;
    timeReportViewSlot?: ReactNode;
    extrasSlot?: ReactNode;
};
export function ReportPreviewNavBar({ hint, hintTitle, projectSlot, timeReportViewSlot, extrasSlot }: ReportPreviewNavBarProps) {
    const onLeave = () => {
        void clearReportPreviewTransfer();
    };
    return (<nav className="time-page__navbar tt-rp-preview__navbar" aria-label="Предпросмотр отчёта">
        <div className="tt-rp-preview__navbar-start">
            <AppBackButton to={REPORTS_TAB_URL} onClick={onLeave} hideLabelOnMobile />
            <AppHomeLogo withSeparator />
            <div className="time-page__navbar-sep" aria-hidden="true" />
            <span className="time-page__navbar-title">Отчёты</span>
        </div>
        <div className="tt-rp-preview__navbar-center">
            <div className="tt-rp-preview__navbar-center-leading">
                <div className="time-page__navbar-tabs" role="tablist" aria-label="Текущий раздел">
                    <span className="time-page__navbar-tab time-page__navbar-tab--active" role="tab" aria-selected="true" tabIndex={-1}>
                        Предпросмотр
                    </span>
                </div>
                {timeReportViewSlot ? (<div className="tt-rp-preview__navbar-view-slot">{timeReportViewSlot}</div>) : null}
            </div>
            {extrasSlot ? (<div className="tt-rp-preview__navbar-extras">{extrasSlot}</div>) : null}
        </div>
        <div className="tt-rp-preview__navbar-end">
            <div className="time-page__navbar-settings">
                <AppPageSettings />
            </div>
            {projectSlot !== undefined
                ? projectSlot
                : hint
                    ? (<span className="tt-rp-preview__navbar-hint" title={hintTitle ?? undefined}>{hint}</span>)
                    : null}
        </div>
    </nav>);
}
