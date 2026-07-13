import type { TranslationKey } from '@shared/i18n';
import { TimesheetEntryRow, type TimesheetEntryRowData } from './TimesheetEntryRow';
import type { TimesheetRunningTimer } from './timesheetLiveTimer';
import type { TimesheetDayGroupData } from './timesheetVirtualTypes';

type TimesheetDayHeaderProps = {
    group: TimesheetDayGroupData;
    isToday: boolean;
    dayTotal: number;
    addBlocked: boolean;
    dateTag: string;
    weekClosedTitle: string;
    fmtHours: (h: number) => string;
    t: (key: TranslationKey) => string;
    onAdd: (dateYmd: string) => void;
};

export function TimesheetDayHeader({
    group,
    isToday,
    dayTotal,
    addBlocked,
    dateTag,
    weekClosedTitle,
    fmtHours,
    t,
    onAdd,
}: TimesheetDayHeaderProps) {
    return (
        <div className={`tsp__ghd${isToday ? ' tsp__ghd--today' : ''}${addBlocked ? ' tsp__ghd--week-closed' : ''}`}>
            <span className="tsp__ghd-name">
                {group.date.toLocaleDateString(dateTag, { weekday: 'long', day: 'numeric', month: 'long' })
                    .replace(/^\w/, (c) => c.toUpperCase())}
                {isToday ? <span className="tsp__ghd-badge">{t('timeTrackingPage.timesheet.today')}</span> : null}
            </span>
            <span className="tsp__ghd-total">{fmtHours(dayTotal)}</span>
            <button
                type="button"
                className="tsp__ghd-add"
                onClick={() => onAdd(group.key)}
                aria-label={t('timeTrackingPage.add')}
                disabled={addBlocked}
                title={addBlocked ? weekClosedTitle : undefined}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
        </div>
    );
}

type TimesheetDayFooterProps = {
    dayTotal: number;
    addBlocked: boolean;
    weekClosedTitle: string;
    fmtHours: (h: number) => string;
    t: (key: TranslationKey) => string;
    onAdd: (dateYmd: string) => void;
    groupKey: string;
};

export function TimesheetDayFooter({
    dayTotal,
    addBlocked,
    weekClosedTitle,
    fmtHours,
    t,
    onAdd,
    groupKey,
}: TimesheetDayFooterProps) {
    return (
        <div className="tsp__day-sum">
            <span className="tsp__day-sum-r">
                <span>{t('timeTrackingPage.timesheet.totalLabel')}</span>
                <span className="tsp__day-sum-n">{fmtHours(dayTotal)}</span>
            </span>
            <button
                type="button"
                className="tsp__day-sum-add"
                onClick={() => onAdd(groupKey)}
                disabled={addBlocked}
                title={addBlocked ? weekClosedTitle : undefined}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('timeTrackingPage.timesheet.addTime')}
            </button>
        </div>
    );
}

export type TimesheetEntryRowHandlers = {
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

export function TimesheetEntryRowItem({
    entry,
    handlers,
}: {
    entry: TimesheetEntryRowData;
    handlers: TimesheetEntryRowHandlers;
}) {
    return (
        <TimesheetEntryRow
            entry={entry}
            runningTimer={handlers.runningTimer}
            rowReportingBlocked={handlers.rowReportingBlocked}
            isColleagueTimesheetView={handlers.isColleagueTimesheetView}
            fmtHours={handlers.fmtHours}
            t={handlers.t}
            onStart={handlers.onStart}
            onEdit={handlers.onEdit}
            onCopy={handlers.onCopy}
            onDelete={handlers.onDelete}
        />
    );
}

type TimesheetDayBlockProps = {
    group: TimesheetDayGroupData;
    isToday: boolean;
    dayTotal: number;
    addBlocked: boolean;
    showHeader: boolean;
    dateTag: string;
    weekClosedTitle: string;
    fmtHours: (h: number) => string;
    t: (key: TranslationKey) => string;
    onAdd: (dateYmd: string) => void;
    entryRowHandlers: TimesheetEntryRowHandlers;
    isRowBlocked: (dateYmd: string) => boolean;
};

export function TimesheetDayBlock({
    group,
    isToday,
    dayTotal,
    addBlocked,
    showHeader,
    dateTag,
    weekClosedTitle,
    fmtHours,
    t,
    onAdd,
    entryRowHandlers,
    isRowBlocked,
}: TimesheetDayBlockProps) {
    const rowBlocked = isRowBlocked(group.key);
    return (
        <div className="tsp__day-block" data-day={group.key}>
            {showHeader ? (
                <TimesheetDayHeader
                    group={group}
                    isToday={isToday}
                    dayTotal={dayTotal}
                    addBlocked={addBlocked}
                    dateTag={dateTag}
                    weekClosedTitle={weekClosedTitle}
                    fmtHours={fmtHours}
                    t={t}
                    onAdd={onAdd}
                />
            ) : null}
            {group.rows.map((entry) => (
                <TimesheetEntryRowItem
                    key={entry.id}
                    entry={entry}
                    handlers={{
                        ...entryRowHandlers,
                        rowReportingBlocked: rowBlocked,
                    }}
                />
            ))}
            <TimesheetDayFooter
                dayTotal={dayTotal}
                addBlocked={addBlocked}
                weekClosedTitle={weekClosedTitle}
                fmtHours={fmtHours}
                t={t}
                onAdd={onAdd}
                groupKey={group.key}
            />
        </div>
    );
}
