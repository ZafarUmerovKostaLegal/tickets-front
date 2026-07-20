import { memo } from 'react';
import type { TranslationKey } from '@shared/i18n';
import {
    entryBaseDurationSeconds,
    useRunningTimerLiveSeconds,
    type TimesheetRunningTimer,
} from './timesheetLiveTimer';

export type TimesheetEntryRowData = {
    id: string;
    date: string;
    project: string;
    client: string;
    task: string;
    notes: string;
    hours: number;
    durationSeconds?: number;
    billable: boolean;
    color: string;
    isVoided?: boolean;
    voidKind?: 'reallocated' | 'rejected' | null;
};

function formatClockFromMs(totalMs: number): string {
    if (!Number.isFinite(totalMs) || totalMs < 0)
        return '0:00:00';
    const s = Math.max(0, Math.floor(totalMs / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

type TimesheetEntryRowProps = {
    entry: TimesheetEntryRowData;
    runningTimer: TimesheetRunningTimer | null;
    rowReportingBlocked: boolean;
    isColleagueTimesheetView: boolean;
    fmtHours: (h: number) => string;
    t: (key: TranslationKey) => string;
    onStart: (entry: TimesheetEntryRowData) => void;
    onEdit: (entry: TimesheetEntryRowData) => void;
    onCopy: (entry: TimesheetEntryRowData) => void;
    onDelete: (entry: TimesheetEntryRowData) => void;
};

function TimesheetEntryRowTime({
    entry,
    isRunning,
    runningTimer,
    fmtHours,
}: {
    entry: TimesheetEntryRowData;
    isRunning: boolean;
    runningTimer: TimesheetRunningTimer | null;
    fmtHours: (h: number) => string;
}) {
    const liveExtraSec = useRunningTimerLiveSeconds(isRunning ? runningTimer : null);
    if (isRunning) {
        const liveSec = entryBaseDurationSeconds(entry) + liveExtraSec;
        return <span className="tsp__row-h">{formatClockFromMs(liveSec * 1000)}</span>;
    }
    return <span className="tsp__row-h">{fmtHours(entry.hours)}</span>;
}

export const TimesheetEntryRow = memo(function TimesheetEntryRow({
    entry: e,
    runningTimer,
    rowReportingBlocked,
    isColleagueTimesheetView,
    fmtHours,
    t,
    onStart,
    onEdit,
    onCopy,
    onDelete,
}: TimesheetEntryRowProps) {
    const isRun = runningTimer?.entryId === e.id;
    const voidLocked = Boolean(e.isVoided);
    const voidRowClass = e.isVoided
        ? (e.voidKind === 'reallocated' ? ' tsp__row--void-realloc' : ' tsp__row--void-reject')
        : '';
    const weekClosedTitle = t('timeTrackingPage.timesheet.weekClosedRow');

    return (
        <div className={`tsp__row${isRun ? ' tsp__row--run' : ''}${rowReportingBlocked ? ' tsp__row--week-closed' : ''}${voidRowClass}`}>
            <span className="tsp__row-bar" style={{ background: e.color }} />
            <div className="tsp__row-txt">
                <p className="tsp__row-proj">
                    <strong>{e.project.trim() || e.task.trim() || t('timeTrackingPage.timesheet.noProject')}</strong>
                    {e.client.trim() ? <span className="tsp__row-client">({e.client})</span> : null}
                    {!e.billable && <span className="tsp__row-nb">Non-billable</span>}
                    {e.isVoided
                        ? (<span className="tsp__row-void-badge" title={t('timeTrackingPage.timesheet.voidLocked')}>
                            {e.voidKind === 'reallocated' ? t('timeTrackingPage.timesheet.voidBadgeRealloc') : t('timeTrackingPage.timesheet.voidBadgeReject')}
                          </span>)
                        : null}
                </p>
                {e.project.trim() && e.task.trim() ? <p className="tsp__row-task">{e.task}</p> : null}
                {e.notes && <p className="tsp__row-notes">{e.notes}</p>}
            </div>
            <div className="tsp__row-acts">
                <TimesheetEntryRowTime entry={e} isRunning={isRun} runningTimer={runningTimer} fmtHours={fmtHours} />
                <button type="button" className={`tsp__row-start${isRun ? ' tsp__row-start--stop' : ''}`} disabled={isColleagueTimesheetView || rowReportingBlocked || voidLocked} title={isColleagueTimesheetView
                    ? t('timeTrackingPage.timesheet.timerOwnSheetOnly')
                    : voidLocked
                        ? t('timeTrackingPage.timesheet.voidLocked')
                        : rowReportingBlocked
                            ? t('timeTrackingPage.timesheet.weekClosedTimer')
                            : undefined} onClick={() => void onStart(e)}>
                    {isRun
                        ? <><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>{t('timeTrackingPage.timesheet.timerStop')}</>
                        : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" /></svg>{t('timeTrackingPage.timesheet.timerStart')}</>}
                </button>
                <button type="button" className="tsp__row-edit" onClick={() => void onEdit(e)} title={voidLocked ? t('timeTrackingPage.timesheet.voidEditBlocked') : rowReportingBlocked ? weekClosedTitle : t('timeTrackingPage.timesheet.editEntry')} disabled={rowReportingBlocked || voidLocked}>
                    {t('timeTrackingPage.edit')}
                </button>
                <button
                    type="button"
                    className="tsp__row-copy"
                    onClick={() => void onCopy(e)}
                    aria-label={t('timeTrackingPage.timesheet.copyEntry')}
                    title={e.notes.trim() ? t('timeTrackingPage.timesheet.copyEntry') : t('timeTrackingPage.timesheet.copyEntryEmpty')}
                    disabled={!e.notes.trim()}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                </button>
                <button className="tsp__row-del" onClick={() => onDelete(e)} aria-label={t('timeTrackingPage.delete')} title={voidLocked ? t('timeTrackingPage.timesheet.voidLocked') : rowReportingBlocked ? t('timeTrackingPage.timesheet.weekClosedDelete') : t('timeTrackingPage.timesheet.deleteEntry')} disabled={rowReportingBlocked || voidLocked}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" />
                    </svg>
                </button>
            </div>
        </div>
    );
});
