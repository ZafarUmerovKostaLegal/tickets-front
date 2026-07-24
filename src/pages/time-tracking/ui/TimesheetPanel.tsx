import { useState, useMemo, useEffect, useCallback, useRef, } from 'react';
import './TimesheetPanel.css';
import { createPortal } from 'react-dom';
import { TimesheetGrantUnlockConfirm, TimesheetDeleteConfirm } from './TimesheetModals';
import { EntryModal } from './TimesheetEntryModal';
import { upsertTimeTrackingUser, listProjectTasksCached, listTimeEntries, createTimeEntry, patchTimeEntry, deleteTimeEntry, grantTimeEntryEditUnlock, submitWeeklyTime, listWeeklySubmissions, isTimeTrackingHttpError, isWorkDateInClosedReportingPeriod, isClosedReportingWeekEditingBlockedForSubject, setUserSubmittedWeeks, mergeUserSubmittedWeek, persistTimesheetTimerStopToApi, type TimeTrackingUserRow, type CreateTimeEntryBody, type PatchTimeEntryBody, } from '@entities/time-tracking';
import { canGrantTimeEntryEditUnlock, canOverrideReportPreviewWeeklyLock } from '@entities/time-tracking/model/timeTrackingAccess';
import { loadTimesheetProjectCatalogForEntriesView, type ProjectOption, } from './timesheetProjectLoader';
import { useCurrentUser } from '@shared/hooks';
import type { User } from '@entities/user';
import { userFromTimeTrackingRowForUpsert } from '@entities/time-tracking/model/managerViewUser';
import { TimesheetSkeleton } from './TimesheetSkeleton';
import { TT_TIMER_PAUSE_CHANGED_EVENT, TT_TIMER_STOPPED_EVENT, type TtTimerPauseChangedDetail, type TtTimerStoppedDetail } from '@widgets/global-timer';
import { OutlookCalendarSelect } from '@shared/ui/OutlookCalendarSelect';
import { displayOutlookCalendarLabel } from '@shared/ui/outlookCalendarSelectUtils';
import { outlookCalendarAccentColor, outlookCalendarAccentStyle } from '@shared/ui/outlookCalendarColors';
import { DatePicker } from '@shared/ui/DatePicker';
import { parseDurationToSeconds, MIN_ENTRY_SECONDS, } from '@shared/lib/formatTrackingHours';
import { TT_TIMER_STORAGE_CHANGED_EVENT, notifyTimesheetTimerStorageChanged, type TtTimerStorageChangedDetail } from '@shared/lib/ttTimerLocalStorage';
import { showConfirm } from '@shared/ui/app-dialog';
import { showToast } from '@shared/ui/app-toast';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import {
    formatCalendarEventCellLabel,
    formatCalendarEventTime,
    OUTLOOK_CALL_TASK_NAME,
} from '@entities/todo/lib/calendarEventHelpers';
import type { CalendarEvent } from '@entities/todo/lib/calendarApi';
import { useTimesheetOutlookCalendar } from '../model/useTimesheetOutlookCalendar';
import { TimesheetOutlookEventModal } from './TimesheetOutlookEventModal';
import { resolveOutlookCalendarDisplayName, TimesheetOutlookDayAgendaModal } from './TimesheetOutlookDayAgendaModal';
import { type TimesheetEntryRowData } from './TimesheetEntryRow';
import { entryHoursForTotals, useRunningTimerLiveSeconds } from './timesheetLiveTimer';
import { TimesheetDayFooter, TimesheetDayHeader, TimesheetDayBlock, TimesheetEntryRowItem, type TimesheetEntryRowHandlers } from './TimesheetDayGroupParts';
import { TimesheetVirtualList } from './TimesheetVirtualList';
import { buildTimesheetVirtualItems, type TimesheetVirtualItem } from './timesheetVirtualTypes';

import {
    startOfWeek,
    addDays,
    startOfMonth,
    endOfMonth,
    addMonths,
    isSameMonth,
    weekdayLabels,
    type TimesheetViewMode,
    type ViewTxPhase,
    VIEW_TX_HIDE_MS,
    VIEW_TX_SKEL_MS,
    VIEW_TX_SHOW_MS,
    readStoredTimesheetViewMode,
    writeStoredTimesheetViewMode,
    type WeekDayOrder,
    readStoredWeekDayOrder,
    writeStoredWeekDayOrder,
    reorderWeekDaysFromToday,
    isSameDay,
    formatDate,
    getTodayDate,
    TIMESHEET_CALENDAR_MAX_MONTHS_AHEAD,
    isFutureCalendarDay,
    isFutureWorkDateYmd,
    parseYmd,
    fmtShort,
    fmtHours,
    fmtDateHeading,
} from './timesheetDateUtils';
import {
    type TimeEntry,
    type ClientTaskOption,
    type RunningTimerState,
    type TimerPersistPayload,
    entryBaseDurationSeconds,
    formatTimeEntryDescriptionForClipboard,
    copyTextToClipboard,
    weeklyCapHoursFromProfile,
    draftEntryFromOutlookEvent,
    cloneEntryForDate,
    mapProjectTasksToOptions,
    isDraftTimeEntryId,
    buildDescription,
    uniqEntriesById,
    mapTimeEntryRowToUi,
    hoursToDurationSeconds,
    elapsedMsToSeconds,
    withHours,
    addSeconds,
    timerStorageKey,
    readRunningTimerFromStorage,
    applyTimerSnapshotToEntries,
    parseTimerPayload,
} from './timesheetEntryModel';

const MONTH_CELL_OUTLOOK_CAP = 2;
export { parseDurationToSeconds as parseDurationFromUserInput };
function TimerBusyHintModal({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onCloseRef.current();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open]);
    if (!open)
        return null;
    return createPortal(<div className="tsp-ov" role="presentation">
        <div className="tsp-m tsp-m--hint-dialog" role="dialog" aria-modal="true" aria-labelledby="tsp-timer-hint-title" onClick={(e) => e.stopPropagation()}>
            <div className="tsp-m__head">
                <h3 id="tsp-timer-hint-title" className="tsp-m__title">{t('timeTrackingPage.timerHint.title')}</h3>
                <button type="button" className="tsp-m__x" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="tsp-m__body tsp-m__body--hint">
                <div className="tsp-m__hint-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                </div>
                <p className="tsp-m__hint-lead">
                    {t('timeTrackingPage.timerHint.body')}
                </p>
            </div>
            <div className="tsp-m__foot">
                <button type="button" className="tsp-m__btn tsp-m__btn--ok" onClick={onClose}>
                    {t('timeTrackingPage.understood')}
                </button>
            </div>
        </div>
    </div>, document.body);
}
export type TimesheetPanelProps = {
    managedEntriesUserId?: number | null;
    managedEntriesUserRow?: TimeTrackingUserRow | null;
};
export function TimesheetPanel(props?: TimesheetPanelProps) {
    const { t, locale } = useI18n();
    const dateTag = localeTag(locale);
    const calWeekdayLabels = useMemo(() => weekdayLabels(t), [t]);
    const { managedEntriesUserId = null, managedEntriesUserRow = null, } = props ?? {};
    const { user: currentUser, loading: userLoading } = useCurrentUser();
    const entriesAuthUserId = useMemo(() => {
        if (!currentUser)
            return null;
        if (managedEntriesUserId != null &&
            managedEntriesUserId > 0 &&
            managedEntriesUserId !== currentUser.id) {
            return managedEntriesUserId;
        }
        return currentUser.id;
    }, [currentUser, managedEntriesUserId]);
    const upsertUserForEntries = useMemo((): User | null => {
        if (!currentUser || !entriesAuthUserId)
            return null;
        if (entriesAuthUserId === currentUser.id)
            return currentUser;
        if (managedEntriesUserRow?.id === entriesAuthUserId) {
            return userFromTimeTrackingRowForUpsert(currentUser, managedEntriesUserRow);
        }
        return currentUser;
    }, [currentUser, entriesAuthUserId, managedEntriesUserRow]);
    const isColleagueTimesheetView = Boolean(currentUser && entriesAuthUserId != null && entriesAuthUserId !== currentUser.id);
    const viewerCanOverrideWeeklyLock = useMemo(() => canOverrideReportPreviewWeeklyLock(currentUser), [currentUser]);
    const grantUnlockEligible = useMemo(() => Boolean(currentUser && entriesAuthUserId != null && canGrantTimeEntryEditUnlock(currentUser, entriesAuthUserId)), [currentUser, entriesAuthUserId]);
    const [grantUnlockBusy, setGrantUnlockBusy] = useState(false);
    const [submitWeekBusy, setSubmitWeekBusy] = useState(false);
    const [grantUnlockConfirmOpen, setGrantUnlockConfirmOpen] = useState(false);
    const isSubjectDayReportingBlocked = useCallback((ymd: string) => {
        if (entriesAuthUserId == null)
            return false;
        return isClosedReportingWeekEditingBlockedForSubject(entriesAuthUserId, ymd, viewerCanOverrideWeeklyLock);
    }, [entriesAuthUserId, viewerCanOverrideWeeklyLock]);
    const today = getTodayDate();
    const [projectsState, setProjectsState] = useState<{
        loading: boolean;
        items: ProjectOption[];
        error: string | null;
    }>({ loading: true, items: [], error: null });
    const [tasksByProjectId, setTasksByProjectId] = useState<Record<string, ClientTaskOption[]>>({});
    const [loadingProjectTaskIds, setLoadingProjectTaskIds] = useState<ReadonlySet<string>>(() => new Set());
    const tasksByProjectIdRef = useRef(tasksByProjectId);
    tasksByProjectIdRef.current = tasksByProjectId;
    const pendingProjectTaskLoadsRef = useRef(new Set<string>());
    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
    const [calendarAnchor, setCalendarAnchor] = useState<Date>(() => startOfMonth(new Date()));
    const initialTimesheetMode = readStoredTimesheetViewMode() ?? 'day';
    const [viewMode, setViewMode] = useState<TimesheetViewMode>(initialTimesheetMode);
    const [entriesScopeMode, setEntriesScopeMode] = useState<TimesheetViewMode>(initialTimesheetMode);
    const [viewTxPhase, setViewTxPhase] = useState<ViewTxPhase>('idle');
    const viewTxTimersRef = useRef<number[]>([]);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    type EntriesSyncBanner = { message: string; variant: 'danger' | 'amber' | 'success' };
    const setEntriesBanner = useCallback((b: EntriesSyncBanner | null) => {
        if (!b)
            return;
        const variant = b.variant === 'danger' ? 'error' : b.variant === 'amber' ? 'warning' : 'success';
        const message = b.variant === 'amber'
            ? `${b.message} ${t('timeTrackingPage.timesheet.weekClosedBannerSub')}`.trim()
            : b.message;
        showToast({ message, variant });
    }, [t]);
    const [entriesHydrated, setEntriesHydrated] = useState(false);
    const projectCatalogVersion = useMemo(() => projectsState.items.map((p) => p.id).join('|'), [projectsState.items]);
    const projectCatalogSubject = useMemo(() => {
        if (!currentUser || !entriesAuthUserId || entriesAuthUserId === currentUser.id)
            return null;
        return upsertUserForEntries;
    }, [currentUser, entriesAuthUserId, upsertUserForEntries]);
    const loadProjectsFailedMessage = t('timeTrackingPage.errors.loadProjectsFailed');
    const [modal, setModal] = useState<{
        open: boolean;
        date: string;
        edit?: TimeEntry;
        clone?: TimeEntry;
        preferredTaskName?: string;
        preserveCloneHours?: boolean;
    }>({ open: false, date: formatDate(today) });
    const [outlookEventDetail, setOutlookEventDetail] = useState<{
        event: CalendarEvent;
        day: Date;
    } | null>(null);
    const [outlookDayAgenda, setOutlookDayAgenda] = useState<{
        day: Date;
        events: CalendarEvent[];
    } | null>(null);
    const requestProjectTasks = useCallback((projectId: string) => {
        const pid = projectId.trim();
        if (!pid)
            return;
        if (tasksByProjectIdRef.current[pid] !== undefined)
            return;
        if (pendingProjectTaskLoadsRef.current.has(pid))
            return;
        const project = projectsState.items.find((p) => p.id === pid);
        if (!project)
            return;
        pendingProjectTaskLoadsRef.current.add(pid);
        setLoadingProjectTaskIds((prev) => new Set(prev).add(pid));
        void listProjectTasksCached(project.clientId, project.id)
            .then((tasks) => {
                setTasksByProjectId((prev) => ({ ...prev, [pid]: mapProjectTasksToOptions(tasks) }));
            })
            .catch(() => {
                setTasksByProjectId((prev) => ({ ...prev, [pid]: [] }));
            })
            .finally(() => {
                pendingProjectTaskLoadsRef.current.delete(pid);
                setLoadingProjectTaskIds((prev) => {
                    const next = new Set(prev);
                    next.delete(pid);
                    return next;
                });
            });
    }, [projectsState.items]);
    const entryProjectIdsKey = useMemo(() => {
        const ids = new Set<string>();
        for (const e of entries) {
            if (e.projectId)
                ids.add(e.projectId);
        }
        return [...ids].sort().join('|');
    }, [entries]);
    const entryModalProjects = useMemo((): ProjectOption[] => {
        const items = projectsState.items;
        // New/clone: only open projects. Edit: open + the entry's project (even if archived).
        const active = items.filter((p) => !p.isClosed);
        if (!modal.open)
            return active;
        const seed = modal.edit ?? modal.clone;
        const pid = seed?.projectId?.trim();
        if (!modal.edit) {
            return active;
        }
        if (!pid || active.some((p) => p.id === pid))
            return active;
        const fromCatalog = items.find((p) => p.id === pid);
        if (fromCatalog)
            return [...active, fromCatalog];
        return [...active, {
            id: pid,
            name: seed!.project || pid,
            client: seed!.client || '',
            clientId: '',
            color: seed!.color,
            currency: seed!.projectCurrency || 'USD',
            recordsLanguage: 'ENG',
            isClosed: true,
        }];
    }, [projectsState.items, modal.open, modal.edit, modal.clone]);
    const modalSeedProjectId = useMemo(() => {
        if (!modal.open)
            return '';
        return modal.edit?.projectId ?? modal.clone?.projectId ?? entryModalProjects[0]?.id ?? '';
    }, [modal.open, modal.edit?.projectId, modal.clone?.projectId, entryModalProjects]);
    const neededProjectIdsKey = useMemo(() => {
        const ids = new Set<string>();
        for (const id of entryProjectIdsKey ? entryProjectIdsKey.split('|').filter(Boolean) : [])
            ids.add(id);
        if (modalSeedProjectId)
            ids.add(modalSeedProjectId);
        return [...ids].sort().join('|');
    }, [entryProjectIdsKey, modalSeedProjectId]);
    useEffect(() => {
        if (!projectCatalogVersion) {
            setTasksByProjectId({});
            return;
        }
        if (!neededProjectIdsKey)
            return;
        for (const projectId of neededProjectIdsKey.split('|').filter(Boolean))
            requestProjectTasks(projectId);
    }, [neededProjectIdsKey, projectCatalogVersion, requestProjectTasks]);
    useEffect(() => {
        if (userLoading)
            return;
        if (!currentUser) {
            setProjectsState({ loading: false, items: [], error: null });
            return;
        }
        let cancelled = false;
        setProjectsState((s) => ({ ...s, loading: true, error: null }));
        void loadTimesheetProjectCatalogForEntriesView(currentUser, projectCatalogSubject ? { subjectUser: projectCatalogSubject } : undefined, locale)
            .then(({ items, error }) => {
                if (cancelled)
                    return;
                setProjectsState({ loading: false, items, error });
            })
            .catch((e) => {
                if (cancelled)
                    return;
                setProjectsState({
                    loading: false,
                    items: [],
                    error: e instanceof Error ? e.message : loadProjectsFailedMessage,
                });
            });
        return () => {
            cancelled = true;
        };
    }, [currentUser, userLoading, locale, loadProjectsFailedMessage, projectCatalogSubject]);
    const blockingSkeleton = userLoading || projectsState.loading || !entriesHydrated;
    const [timerBusyHintOpen, setTimerBusyHintOpen] = useState(false);
    const [activeDay, setActiveDay] = useState<Date>(() => getTodayDate());
    const [query, setQuery] = useState('');
    const [billableOnly, setBillableOnly] = useState(false);
    const [weekDayOrder, setWeekDayOrder] = useState<WeekDayOrder>(() => readStoredWeekDayOrder());
    const [weekDayFilter, setWeekDayFilter] = useState<'all' | string>('all');
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const contentScrollRef = useRef<HTMLDivElement | null>(null);
    const viewStackScrollRef = useRef<HTMLDivElement | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [runningTimer, setRunningTimer] = useState<RunningTimerState | null>(null);
    const runningTimerRef = useRef<RunningTimerState | null>(null);
    runningTimerRef.current = runningTimer;
    const entriesRef = useRef(entries);
    entriesRef.current = entries;
    const upsertUserForEntriesRef = useRef(upsertUserForEntries);
    upsertUserForEntriesRef.current = upsertUserForEntries;
    const entriesAuthUserIdRef = useRef(entriesAuthUserId);
    entriesAuthUserIdRef.current = entriesAuthUserId;
    const projectsCatalogRef = useRef(projectsState.items);
    projectsCatalogRef.current = projectsState.items;
    const liveExtraSec = useRunningTimerLiveSeconds(runningTimer);
    const entriesRange = useMemo(() => {
        if (entriesScopeMode === 'calendar') {
            const sm = startOfMonth(calendarAnchor);
            const em = endOfMonth(calendarAnchor);
            return { from: formatDate(sm), to: formatDate(em) };
        }
        return { from: formatDate(weekStart), to: formatDate(addDays(weekStart, 6)) };
    }, [entriesScopeMode, calendarAnchor, weekStart]);
    useEffect(() => {
        writeStoredTimesheetViewMode(viewMode);
    }, [viewMode]);
    useEffect(() => {
        setEntries([]);
        setRunningTimer(null);
        setEntriesHydrated(false);
    }, [entriesAuthUserId]);
    useEffect(() => {
        if (viewTxPhase !== 'idle')
            return;
        setEntriesScopeMode(viewMode);
    }, [viewMode, viewTxPhase]);
    const clearViewTxTimers = () => {
        viewTxTimersRef.current.forEach((id) => window.clearTimeout(id));
        viewTxTimersRef.current = [];
    };
    useEffect(() => () => clearViewTxTimers(), []);
    function beginSegViewSwitch(next: TimesheetViewMode) {
        if (next === viewMode || viewTxPhase !== 'idle')
            return;
        if (next === 'calendar') {
            setCalendarAnchor(startOfMonth(activeDay));
        }
        setEntriesScopeMode(next);
        setViewTxPhase('hiding');
        clearViewTxTimers();
        viewTxTimersRef.current.push(window.setTimeout(() => {
            setViewMode(next);
            setViewTxPhase('skel');
            viewTxTimersRef.current.push(window.setTimeout(() => {
                setViewTxPhase('showing');
                viewTxTimersRef.current.push(window.setTimeout(() => {
                    setViewTxPhase('idle');
                    clearViewTxTimers();
                }, VIEW_TX_SHOW_MS));
            }, VIEW_TX_SKEL_MS));
        }, VIEW_TX_HIDE_MS));
    }
    useEffect(() => {
        if (!entriesAuthUserId || userLoading)
            return;
        let cancelled = false;
        setEntriesBanner(null);
        const from = entriesRange.from;
        const to = entriesRange.to;
        const uid = entriesAuthUserId;
        const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
        void (async () => {
            try {
                const [rows, submittedWeeks] = await Promise.all([
                    listTimeEntries(uid, from, to),
                    listWeeklySubmissions(uid, from, to).catch(() => []),
                ]);
                if (cancelled)
                    return;
                setUserSubmittedWeeks(uid, submittedWeeks.map((r) => ({
                    weekStart: r.weekStart,
                    weekEnd: r.weekEnd,
                })));
                let mapped = rows.map((r) => mapTimeEntryRowToUi(r, byId));
                if (currentUser?.id && uid !== currentUser.id) {
                    setRunningTimer(null);
                }
                else {
                    const restored = readRunningTimerFromStorage(uid);
                    setRunningTimer(restored);
                    if (restored) {
                        try {
                            const raw = localStorage.getItem(timerStorageKey(uid));
                            const p = raw ? parseTimerPayload(raw) : null;
                            if (p && p.authUserId === uid) {
                                mapped = applyTimerSnapshotToEntries(mapped, p);
                                if (!mapped.some((e) => e.id === p.entryId)) {
                                    const snapBase = entryBaseDurationSeconds(p.snapshot);
                                    mapped = [...mapped, {
                                        ...p.snapshot,
                                        durationSeconds: snapBase,
                                        hours: snapBase / 3600,
                                    }];
                                }
                            }
                        }
                        catch {
                        }
                    }
                }
                setEntries(uniqEntriesById(mapped));
            }
            catch (e) {
                if (!cancelled) {
                    const msg = e instanceof Error ? e.message : t('timeTrackingPage.errors.loadEntriesFailed');
                    setEntriesBanner({
                        message: /403|forbidden|недостаточно|запрещ/i.test(msg)
                            ? `${msg}${t('timeTrackingPage.timesheet.employeeEntriesAccessHint')}`
                            : msg,
                        variant: 'danger',
                    });
                    setEntries([]);
                    setRunningTimer(null);
                }
            }
            finally {
                if (!cancelled)
                    setEntriesHydrated(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [entriesAuthUserId, currentUser?.id, userLoading, entriesRange.from, entriesRange.to, projectCatalogVersion, t]);
    useEffect(() => {
        if (!entriesAuthUserId || isColleagueTimesheetView)
            return;
        const uid = entriesAuthUserId;
        const syncFromStorage = () => {
            const next = readRunningTimerFromStorage(uid);
            setRunningTimer((prev) => {
                if (!next && !prev)
                    return prev;
                if (!next)
                    return null;
                if (prev &&
                    prev.entryId === next.entryId &&
                    prev.startedAt === next.startedAt &&
                    Boolean(prev.paused) === Boolean(next.paused)) {
                    return prev;
                }
                return next;
            });
            try {
                const raw = localStorage.getItem(timerStorageKey(uid));
                const p = raw ? parseTimerPayload(raw) : null;
                if (p && p.authUserId === uid) {
                    setEntries((prev) => applyTimerSnapshotToEntries(prev, p));
                }
            }
            catch {
            }
        };
        syncFromStorage();
        const onStorageChanged = (ev: Event) => {
            const e = ev as CustomEvent<TtTimerStorageChangedDetail>;
            if (e.detail?.authUserId === uid)
                syncFromStorage();
        };
        const onStorage = (ev: StorageEvent) => {
            if (ev.key === timerStorageKey(uid))
                syncFromStorage();
        };
        window.addEventListener(TT_TIMER_STORAGE_CHANGED_EVENT, onStorageChanged as EventListener);
        window.addEventListener('storage', onStorage);
        const fallback = window.setInterval(syncFromStorage, 30_000);
        return () => {
            window.clearInterval(fallback);
            window.removeEventListener(TT_TIMER_STORAGE_CHANGED_EVENT, onStorageChanged as EventListener);
            window.removeEventListener('storage', onStorage);
        };
    }, [entriesAuthUserId, isColleagueTimesheetView]);
    useEffect(() => {
        if (entriesAuthUserId)
            return;
        setRunningTimer(null);
    }, [entriesAuthUserId]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    useEffect(() => {
        setWeekDayFilter('all');
    }, [weekStart]);
    useEffect(() => {
        writeStoredWeekDayOrder(weekDayOrder);
    }, [weekDayOrder]);
    const thisWeekStart = startOfWeek(today);
    const isCurrentWeek = isSameDay(weekStart, thisWeekStart);
    const weekOrderedDays = useMemo(() => weekDayOrder === 'today'
        ? reorderWeekDaysFromToday(weekDays, weekStart, today)
        : weekDays, [weekDays, weekDayOrder, weekStart, today]);
    const weekListDays = useMemo(() => {
        if (weekDayFilter === 'all')
            return weekOrderedDays;
        return weekOrderedDays.filter((d) => formatDate(d) === weekDayFilter);
    }, [weekOrderedDays, weekDayFilter]);
    const activeDayYmd = useMemo(() => formatDate(activeDay), [activeDay]);
    const activeDayInClosedWeek = useMemo(() => isWorkDateInClosedReportingPeriod(activeDayYmd), [activeDayYmd]);
    const showGrantUnlockStrip = grantUnlockEligible && isColleagueTimesheetView && entriesAuthUserId != null && activeDayInClosedWeek;
    const activeDayReportingBlocked = isSubjectDayReportingBlocked(activeDayYmd);
    useEffect(() => {
        if (!showGrantUnlockStrip)
            setGrantUnlockConfirmOpen(false);
    }, [showGrantUnlockStrip]);
    const hoursPerDay = useMemo(() => weekDays.map((d) => {
        const key = formatDate(d);
        return entries.filter((e) => e.date === key).reduce((s, e) => s + entryHoursForTotals(e, runningTimer, liveExtraSec), 0);
    }), [weekDays, entries, runningTimer, liveExtraSec]);
    const weekTotal = hoursPerDay.reduce((s, h) => s + h, 0);
    const weekNormHours = useMemo(() => {
        const cap = managedEntriesUserRow && managedEntriesUserRow.id === entriesAuthUserId
            ? managedEntriesUserRow.weekly_capacity_hours
            : currentUser?.weekly_capacity_hours;
        return weeklyCapHoursFromProfile(cap);
    }, [currentUser?.weekly_capacity_hours, managedEntriesUserRow, entriesAuthUserId]);
    const hoursByDate = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of entries) {
            m.set(e.date, (m.get(e.date) ?? 0) + entryHoursForTotals(e, runningTimer, liveExtraSec));
        }
        return m;
    }, [entries, runningTimer, liveExtraSec]);
    const voidInfoByDate = useMemo(() => {
        const m = new Map<string, { hasReject: boolean; hasRealloc: boolean }>();
        for (const e of entries) {
            if (!e.isVoided)
                continue;
            const o = m.get(e.date) ?? { hasReject: false, hasRealloc: false };
            if (e.voidKind === 'reallocated')
                o.hasRealloc = true;
            else
                o.hasReject = true;
            m.set(e.date, o);
        }
        return m;
    }, [entries]);
    const monthTotal = useMemo(() => {
        const y = calendarAnchor.getFullYear();
        const mo = calendarAnchor.getMonth();
        return entries.reduce((s, e) => {
            const parts = e.date.split('-').map(Number);
            const ys = parts[0];
            const ms = parts[1];
            if (ys === y && ms === mo + 1)
                return s + entryHoursForTotals(e, runningTimer, liveExtraSec);
            return s;
        }, 0);
    }, [entries, calendarAnchor, runningTimer, liveExtraSec]);
    const monthNormHours = useMemo(() => (weekNormHours * 52) / 12, [weekNormHours]);
    const periodTotal = viewMode === 'calendar' ? monthTotal : weekTotal;
    const periodNorm = viewMode === 'calendar' ? monthNormHours : weekNormHours;
    const periodBarPct = periodNorm > 0 ? Math.min(100, (periodTotal / periodNorm) * 100) : 0;
    const handleSubmitWeek = useCallback(async () => {
        if (entriesAuthUserId == null || submitWeekBusy)
            return;
        setSubmitWeekBusy(true);
        try {
            const anchor = viewMode === 'day' ? activeDayYmd : formatDate(weekDays[weekDays.length - 1] ?? activeDay);
            const out = await submitWeeklyTime(entriesAuthUserId, anchor);
            if (out.weekStart && out.weekEnd) {
                mergeUserSubmittedWeek(entriesAuthUserId, {
                    weekStart: out.weekStart,
                    weekEnd: out.weekEnd,
                });
            }
            setEntriesBanner({
                message: out.created
                    ? t('timeTrackingPage.timesheet.submitWeekSuccess')
                    : t('timeTrackingPage.timesheet.submitWeekAlready'),
                variant: 'success',
            });
        }
        catch (e) {
            setEntriesBanner({
                message: e instanceof Error ? e.message : t('timeTrackingPage.timesheet.submitWeekFailed'),
                variant: 'danger',
            });
        }
        finally {
            setSubmitWeekBusy(false);
        }
    }, [entriesAuthUserId, submitWeekBusy, activeDayYmd, viewMode, weekDays, activeDay, t, setEntriesBanner]);
    const calendarCells = useMemo(() => {
        const sm = startOfMonth(calendarAnchor);
        const lead = (sm.getDay() + 6) % 7;
        const gridStart = addDays(sm, -lead);
        return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    }, [calendarAnchor]);
    const outlookCalendar = useTimesheetOutlookCalendar({
        enabled: viewMode === 'calendar',
        calendarAnchor,
        calendarDays: calendarCells,
    });
    const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const canGoNextByWeek = weekStart.getTime() < thisWeekStart.getTime();
    const canGoNextByMonth = monthIndex(calendarAnchor) < monthIndex(today) + TIMESHEET_CALENDAR_MAX_MONTHS_AHEAD;
    function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
    function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
    function goToday() {
        setWeekStart(startOfWeek(today));
        setActiveDay(today);
    }
    function prevPeriod() {
        if (viewMode === 'calendar')
            setCalendarAnchor((d) => addMonths(d, -1));
        else
            prevWeek();
    }
    function nextPeriod() {
        if (viewMode === 'calendar') {
            if (!canGoNextByMonth)
                return;
            setCalendarAnchor((d) => addMonths(d, 1));
        }
        else {
            if (!canGoNextByWeek)
                return;
            nextWeek();
        }
    }
    function goTodayPeriod() {
        if (viewMode === 'calendar') {
            setCalendarAnchor(startOfMonth(today));
            setActiveDay(today);
        }
        else {
            goToday();
        }
    }
    function openAdd(date: string) {
        const ymd = date.trim().slice(0, 10);
        if (isFutureWorkDateYmd(ymd, today)) {
            setEntriesBanner({
                message: t('timeTrackingPage.timesheet.futureDates'),
                variant: 'amber',
            });
            return;
        }
        if (isSubjectDayReportingBlocked(ymd)) {
            setEntriesBanner({
                message: t('timeTrackingPage.errors.periodClosedPickDate'),
                variant: 'amber',
            });
            return;
        }
        setModal({ open: true, date: ymd });
    }
    function openEdit(entry: TimeEntry) { setModal({ open: true, date: entry.date, edit: entry }); }
    function openAddFromClone(source: TimeEntry) {
        const todayYmd = formatDate(today);
        if (isSubjectDayReportingBlocked(todayYmd)) {
            setEntriesBanner({
                message: t('timeTrackingPage.errors.periodClosedPickDate'),
                variant: 'amber',
            });
            return;
        }
        setActiveDay(today);
        setWeekStart(startOfWeek(today));
        setModal({ open: true, date: todayYmd, clone: cloneEntryForDate(source, todayYmd) });
    }
    function closeModal() {
        setModal((m) => ({ ...m, open: false, edit: undefined, clone: undefined, preferredTaskName: undefined, preserveCloneHours: undefined }));
    }
    function openAddFromOutlookEvent(ev: CalendarEvent, day: Date) {
        const ymd = formatDate(day);
        if (isFutureWorkDateYmd(ymd, today)) {
            setEntriesBanner({
                message: t('timeTrackingPage.timesheet.futureDates'),
                variant: 'amber',
            });
            return;
        }
        if (isSubjectDayReportingBlocked(ymd)) {
            setEntriesBanner({
                message: t('timeTrackingPage.errors.periodClosedPickDate'),
                variant: 'amber',
            });
            return;
        }
        setOutlookEventDetail(null);
        setActiveDay(day);
        setModal({
            open: true,
            date: ymd,
            clone: draftEntryFromOutlookEvent(ev, day),
            preferredTaskName: OUTLOOK_CALL_TASK_NAME,
            preserveCloneHours: true,
        });
    }
    async function handleCopyEntry(entry: TimeEntry) {
        const text = formatTimeEntryDescriptionForClipboard(entry);
        if (!text) {
            showToast({
                message: t('timeTrackingPage.timesheet.copyEntryEmpty'),
                variant: 'warning',
            });
            return;
        }
        const ok = await copyTextToClipboard(text);
        showToast({
            message: ok
                ? t('timeTrackingPage.timesheet.copyEntrySuccess')
                : t('timeTrackingPage.timesheet.copyEntryFailed'),
            variant: ok ? 'success' : 'error',
        });
    }
    async function handleEntryAction(entry: TimeEntry, action: 'start' | 'edit') {
        const todayYmd = formatDate(today);
        if (entry.date === todayYmd) {
            if (action === 'start')
                toggleRun(entry.id);
            else
                openEdit(entry);
            return;
        }
        const entryDateLabel = fmtDateHeading(parseYmd(entry.date), dateTag);
        const ok = await showConfirm({
            title: t('timeTrackingPage.timesheet.copyToTodayTitle'),
            message: t('timeTrackingPage.timesheet.copyToTodayMessage').replace('{date}', entryDateLabel),
            confirmLabel: t('timeTrackingPage.timesheet.copyToTodayYes'),
            cancelLabel: action === 'edit'
                ? t('timeTrackingPage.timesheet.copyToTodayEditOriginal')
                : t('timeTrackingPage.timesheet.copyToTodayNo'),
        });
        if (ok) {
            openAddFromClone(entry);
            return;
        }
        if (action === 'edit')
            openEdit(entry);
    }
    const handleEntryActionRef = useRef(handleEntryAction);
    handleEntryActionRef.current = handleEntryAction;
    const handleCopyEntryRef = useRef(handleCopyEntry);
    handleCopyEntryRef.current = handleCopyEntry;
    const onEntryStart = useCallback((entry: TimesheetEntryRowData) => {
        void handleEntryActionRef.current(entry as TimeEntry, 'start');
    }, []);
    const onEntryEdit = useCallback((entry: TimesheetEntryRowData) => {
        void handleEntryActionRef.current(entry as TimeEntry, 'edit');
    }, []);
    const onEntryCopy = useCallback((entry: TimesheetEntryRowData) => {
        void handleCopyEntryRef.current(entry as TimeEntry);
    }, []);
    const onEntryDelete = useCallback((entry: TimesheetEntryRowData) => {
        setDeleteTarget(entry as TimeEntry);
    }, []);
    useEffect(() => {
        function isEditableTarget(t: EventTarget | null): boolean {
            const el = t as HTMLElement | null;
            if (!el)
                return false;
            if (el.isContentEditable)
                return true;
            const tag = el.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select')
                return true;
            return false;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey)
                return;
            if (modal.open || outlookEventDetail || outlookDayAgenda || deleteTarget || timerBusyHintOpen || grantUnlockConfirmOpen)
                return;
            if (viewTxPhase !== 'idle')
                return;
            const editable = isEditableTarget(e.target);
            const key = e.key;
            if (key === '/' && !editable) {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select?.();
                return;
            }
            if (editable) {
                if ((key === 'n' || key === 'N') && e.target === searchInputRef.current && !query.trim()) {
                    e.preventDefault();
                    searchInputRef.current?.blur();
                    const ymd = formatDate(activeDay);
                    if (!isSubjectDayReportingBlocked(ymd))
                        openAdd(ymd);
                    return;
                }
                if (key === 'Escape' && e.target === searchInputRef.current) {
                    if (query || billableOnly) {
                        e.preventDefault();
                        setQuery('');
                        setBillableOnly(false);
                        searchInputRef.current?.blur();
                    }
                }
                return;
            }
            if (key === 'ArrowLeft') {
                e.preventDefault();
                prevPeriod();
            }
            else if (key === 'ArrowRight') {
                e.preventDefault();
                nextPeriod();
            }
            else if (key === 't' || key === 'T' || key === 'Home') {
                e.preventDefault();
                goTodayPeriod();
            }
            else if (key === 'n' || key === 'N' || key === '+') {
                e.preventDefault();
                const ymd = formatDate(activeDay);
                if (isSubjectDayReportingBlocked(ymd))
                    return;
                openAdd(ymd);
            }
            else if (key === 'd' || key === 'D') {
                e.preventDefault();
                beginSegViewSwitch('day');
            }
            else if (key === 'w' || key === 'W') {
                e.preventDefault();
                beginSegViewSwitch('week');
            }
            else if (key === 'm' || key === 'M') {
                e.preventDefault();
                beginSegViewSwitch('calendar');
            }
            else if (key === 'Escape' && (query || billableOnly)) {
                e.preventDefault();
                setQuery('');
                setBillableOnly(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modal.open, outlookEventDetail, outlookDayAgenda, deleteTarget, timerBusyHintOpen, grantUnlockConfirmOpen, viewTxPhase, viewMode, activeDay, query, billableOnly, isSubjectDayReportingBlocked]);
    async function persistTimerStopToApi(entryId: string, merged: TimeEntry) {
        const user = upsertUserForEntriesRef.current;
        const uid = entriesAuthUserIdRef.current;
        if (!user?.id || !uid)
            return;
        if (isSubjectDayReportingBlocked(merged.date)) {
            setEntriesBanner({
                message: t('timeTrackingPage.errors.weekClosedServer'),
                variant: 'amber',
            });
            return;
        }
        const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
        try {
            const durationSeconds = merged.durationSeconds > 0 ? merged.durationSeconds : hoursToDurationSeconds(merged.hours);
            const result = await persistTimesheetTimerStopToApi({
                authUserId: uid,
                entryId,
                totalDurationSeconds: durationSeconds,
                snapshot: merged,
                user,
                canOverrideWeeklyLock: viewerCanOverrideWeeklyLock,
            });
            if (!result.saved) {
                if (result.reason === 'blocked') {
                    setEntriesBanner({
                        message: t('timeTrackingPage.errors.weekClosedServer'),
                        variant: 'amber',
                    });
                }
                else if (result.reason !== 'too_short' && result.reason !== 'in_flight') {
                    setEntriesBanner({
                        message: t('timeTrackingPage.errors.saveTimerFailed'),
                        variant: 'danger',
                    });
                }
                return;
            }
            const next = mapTimeEntryRowToUi(result.row, byId);
            setEntries((prev) => {
                const stripped = prev.filter((x) => x.id !== entryId && x.id !== next.id);
                return uniqEntriesById([...stripped, next]);
            });
        }
        catch (e) {
            setEntriesBanner({
                message: e instanceof Error ? e.message : t('timeTrackingPage.errors.saveTimerFailed'),
                variant: isTimeTrackingHttpError(e, 409) ? 'amber' : 'danger',
            });
        }
    }
    const persistTimerStopToApiRef = useRef(persistTimerStopToApi);
    persistTimerStopToApiRef.current = persistTimerStopToApi;
    function flushStopTimer(prev: RunningTimerState) {
        const uid = entriesAuthUserIdRef.current;
        const elapsedMs = Date.now() - prev.startedAt;
        const addSec = elapsedMsToSeconds(elapsedMs);
        const prevId = prev.entryId;
        const ent = entriesRef.current.find((x) => x.id === prevId);
        const merged = ent ? addSeconds(ent, addSec) : null;
        setEntries((ents) => ents.map((row) => (row.id === prevId ? addSeconds(row, addSec) : row)));
        if (uid) {
            try {
                localStorage.removeItem(timerStorageKey(uid));
                notifyTimesheetTimerStorageChanged(uid);
            }
            catch {
            }
        }
        if (merged && (merged.durationSeconds || 0) >= MIN_ENTRY_SECONDS)
            void persistTimerStopToApi(prevId, merged);
    }
    async function saveEntry(e: TimeEntry) {
        const upsertU = upsertUserForEntries;
        const uid = entriesAuthUserId;
        if (!upsertU || !uid)
            throw new Error(t('timeTrackingPage.errors.userUnknown'));
        if (isSubjectDayReportingBlocked(e.date)) {
            setEntriesBanner({
                message: t('timeTrackingPage.errors.periodClosedPickDate'),
                variant: 'amber',
            });
            throw new Error(t('timeTrackingPage.errors.periodClosedShort'));
        }
        setEntriesBanner(null);
        try {
            await upsertTimeTrackingUser(upsertU);
            const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
            const hoursPositive = Number.isFinite(e.hours) && e.hours > 0;
            if (!hoursPositive) {
                const zeroSnapshot = withHours(e, 0);
                setEntries((prev) => {
                    const without = prev.filter((x) => x.id !== e.id);
                    return [...without, zeroSnapshot];
                });
                const prevRt = runningTimerRef.current;
                if (prevRt?.entryId === e.id) {
                    try {
                        const payload: TimerPersistPayload = {
                            v: 1,
                            authUserId: uid,
                            entryId: e.id,
                            startedAt: prevRt.startedAt,
                            snapshot: zeroSnapshot,
                        };
                        localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload));
                        notifyTimesheetTimerStorageChanged(uid);
                    }
                    catch {
                    }
                    return;
                }
                if (prevRt)
                    flushStopTimer(prevRt);
                const startedAt = Date.now();
                try {
                    const payload: TimerPersistPayload = {
                        v: 1,
                        authUserId: uid,
                        entryId: e.id,
                        startedAt,
                        snapshot: zeroSnapshot,
                    };
                    localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload));
                    notifyTimesheetTimerStorageChanged(uid);
                }
                catch {
                }
                setRunningTimer({ entryId: e.id, startedAt, paused: false });
                return;
            }
            const desc = buildDescription(e.task, e.notes);
            const durationSeconds = e.durationSeconds > 0 ? e.durationSeconds : hoursToDurationSeconds(e.hours);
            if (isDraftTimeEntryId(e.id)) {
                const body: CreateTimeEntryBody = {
                    workDate: e.date,
                    durationSeconds,
                    isBillable: e.billable,
                    projectId: e.projectId ?? null,
                    taskId: e.taskId ?? null,
                    description: desc,
                };
                if (typeof e.billableFxAsOf === 'string' && e.billableFxAsOf.trim()) {
                    body.billableFxAsOf = e.billableFxAsOf.trim();
                }
                const row = await createTimeEntry(uid, body);
                setEntries((prev) => [...prev.filter((x) => x.id !== e.id), mapTimeEntryRowToUi(row, byId)]);
            }
            else {
                const patch: PatchTimeEntryBody = {
                    workDate: e.date,
                    isBillable: e.billable,
                    projectId: e.projectId ?? null,
                    taskId: e.taskId ?? null,
                    description: desc,
                };
                if (durationSeconds >= 1)
                    patch.durationSeconds = durationSeconds;
                if (e.billableFxAsOf === null)
                    patch.billableFxAsOf = null;
                else if (typeof e.billableFxAsOf === 'string' && e.billableFxAsOf.trim()) {
                    patch.billableFxAsOf = e.billableFxAsOf.trim();
                }
                const row = await patchTimeEntry(uid, e.id, patch);
                setEntries((prev) => prev.map((x) => (x.id === e.id ? mapTimeEntryRowToUi(row, byId) : x)));
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : t('timeTrackingPage.errors.saveEntryFailed');
            setEntriesBanner({
                message: msg,
                variant: isTimeTrackingHttpError(err, 409) ? 'amber' : 'danger',
            });
            throw err;
        }
    }
    async function deleteEntry(id: string) {
        const uid = entriesAuthUserId;
        const upsertU = upsertUserForEntries;
        setRunningTimer((rt) => {
            if (rt?.entryId === id && uid) {
                try {
                    localStorage.removeItem(timerStorageKey(uid));
                    notifyTimesheetTimerStorageChanged(uid);
                }
                catch {
                }
                return null;
            }
            return rt;
        });
        if (upsertU && uid && !isDraftTimeEntryId(id)) {
            const forDelete = entriesRef.current.find((x) => x.id === id);
            if (forDelete && isSubjectDayReportingBlocked(forDelete.date)) {
                setEntriesBanner({
                    message: t('timeTrackingPage.errors.deleteWeekClosed'),
                    variant: 'amber',
                });
                return;
            }
            setEntriesBanner(null);
            try {
                await upsertTimeTrackingUser(upsertU);
                const afterDelete = await deleteTimeEntry(uid, id);
                if (afterDelete != null) {
                    const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]));
                    setEntries((prev) => prev.map((e) => (e.id === id ? mapTimeEntryRowToUi(afterDelete, byId) : e)));
                    setEntriesBanner({ message: t('timeTrackingPage.errors.voidedSuccess'), variant: 'success' });
                }
                else {
                    setEntries((prev) => prev.filter((e) => e.id !== id));
                    setEntriesBanner({ message: t('timeTrackingPage.errors.deletedSuccess'), variant: 'success' });
                }
            }
            catch (e) {
                setEntriesBanner({
                    message: e instanceof Error ? e.message : t('timeTrackingPage.errors.deleteFailed'),
                    variant: isTimeTrackingHttpError(e, 409) ? 'amber' : 'danger',
                });
                return;
            }
            return;
        }
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setEntriesBanner({ message: t('timeTrackingPage.errors.deletedSuccess'), variant: 'success' });
    }
    function toggleRun(id: string) {
        if (isColleagueTimesheetView)
            return;
        const ent = entriesRef.current.find((x) => x.id === id);
        if (ent?.isVoided)
            return;
        if (ent && isSubjectDayReportingBlocked(ent.date))
            return;
        const uid = entriesAuthUserId;
        const prev = runningTimerRef.current;
        if (prev?.entryId === id) {
            flushStopTimer(prev);
            setRunningTimer(null);
            return;
        }
        if (prev && prev.entryId !== id) {
            setTimerBusyHintOpen(true);
            return;
        }
        const startedAt = Date.now();
        const entry = entriesRef.current.find((e) => e.id === id);
        if (uid && entry) {
            try {
                const payload: TimerPersistPayload = {
                    v: 1,
                    authUserId: uid,
                    entryId: id,
                    startedAt,
                    snapshot: entry,
                };
                localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload));
                notifyTimesheetTimerStorageChanged(uid);
            }
            catch {
            }
        }
        setRunningTimer({ entryId: id, startedAt, paused: false });
    }
    useEffect(() => {
        const onStopped = (ev: Event) => {
            if (isColleagueTimesheetView)
                return;
            const e = ev as CustomEvent<TtTimerStoppedDetail>;
            const { entryId, totalHours, serverEntryId, persisted } = e.detail;
            setRunningTimer((rt) => (rt?.entryId === entryId ? null : rt));
            const ent = entriesRef.current.find((x) => x.id === entryId);
            if (!ent)
                return;
            const stoppedSec = e.detail.totalDurationSeconds;
            const merged: TimeEntry = typeof stoppedSec === 'number' && Number.isFinite(stoppedSec) && stoppedSec >= 0
                ? { ...ent, durationSeconds: Math.trunc(stoppedSec), hours: stoppedSec / 3600 }
                : withHours(ent, totalHours);
            const nextId = serverEntryId && serverEntryId !== entryId ? serverEntryId : entryId;
            setEntries((prev) => {
                const stripped = prev.filter((row) => row.id !== entryId && row.id !== nextId);
                return [...stripped, { ...merged, id: nextId }];
            });
            if (!persisted && (merged.durationSeconds || 0) >= MIN_ENTRY_SECONDS) {
                void persistTimerStopToApiRef.current(entryId, merged);
            }
        };
        const onPauseChanged = (ev: Event) => {
            if (isColleagueTimesheetView)
                return;
            const e = ev as CustomEvent<TtTimerPauseChangedDetail>;
            const { entryId, totalHours, paused } = e.detail;
            const ent = entriesRef.current.find((x) => x.id === entryId);
            if (!ent)
                return;
            const pausedSec = e.detail.totalDurationSeconds;
            const merged: TimeEntry = typeof pausedSec === 'number' && Number.isFinite(pausedSec) && pausedSec >= 0
                ? { ...ent, durationSeconds: Math.trunc(pausedSec), hours: pausedSec / 3600 }
                : withHours(ent, totalHours);
            setEntries((prev) => prev.map((row) => (row.id === entryId ? merged : row)));
            if (paused) {
                setRunningTimer({ entryId, startedAt: Date.now(), paused: true });
                return;
            }
            setRunningTimer({ entryId, startedAt: Date.now(), paused: false });
        };
        window.addEventListener(TT_TIMER_STOPPED_EVENT, onStopped as EventListener);
        window.addEventListener(TT_TIMER_PAUSE_CHANGED_EVENT, onPauseChanged as EventListener);
        return () => {
            window.removeEventListener(TT_TIMER_STOPPED_EVENT, onStopped as EventListener);
            window.removeEventListener(TT_TIMER_PAUSE_CHANGED_EVENT, onPauseChanged as EventListener);
        };
    }, [isColleagueTimesheetView]);
    const displayDays = viewMode === 'week' ? weekListDays : [activeDay];
    const weekFiltersActive = viewMode === 'week' && (weekDayFilter !== 'all' || weekDayOrder !== 'monday');
    const filterActive = query.trim().length > 0 || billableOnly || weekFiltersActive;
    const rawDayGroups = useMemo(() => displayDays.map((d) => {
        const key = formatDate(d);
        const rows = entries.filter((e) => e.date === key);
        return { date: d, key, rows };
    }), [displayDays, entries]);
    const dayGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rawDayGroups
            .map((g) => {
                let rows = g.rows;
                if (q) {
                    rows = rows.filter((e) => {
                        const t = `${e.project} ${e.client} ${e.task} ${e.notes}`.toLowerCase();
                        return t.includes(q);
                    });
                }
                if (billableOnly)
                    rows = rows.filter((e) => e.billable);
                return { ...g, rows };
            })
            .filter((g) => g.rows.length > 0);
    }, [rawDayGroups, query, billableOnly]);
    const totalRowsInPeriod = viewMode === 'week'
        ? weekDays.reduce((s, d) => s + entries.filter((e) => e.date === formatDate(d)).length, 0)
        : rawDayGroups.reduce((s, g) => s + g.rows.length, 0);
    const shownRowsInPeriod = dayGroups.reduce((s, g) => s + g.rows.length, 0);
    const hasAnyEntries = totalRowsInPeriod > 0;
    const hasEntries = dayGroups.length > 0;
    function resetFilters() {
        setQuery('');
        setBillableOnly(false);
        setWeekDayFilter('all');
        setWeekDayOrder('monday');
    }
    const weekClosedTitle = t('timeTrackingPage.timesheet.weekClosedShort');
    const entryRowHandlers = useMemo((): TimesheetEntryRowHandlers => ({
        runningTimer,
        rowReportingBlocked: false,
        isColleagueTimesheetView,
        fmtHours,
        t,
        onStart: onEntryStart,
        onEdit: onEntryEdit,
        onCopy: onEntryCopy,
        onDelete: onEntryDelete,
    }), [
        runningTimer,
        isColleagueTimesheetView,
        fmtHours,
        t,
        onEntryStart,
        onEntryEdit,
        onEntryCopy,
        onEntryDelete,
    ]);
    const virtualTimesheetItems = useMemo(() => buildTimesheetVirtualItems(dayGroups, {
        showHeaders: viewMode === 'week',
        viewMode,
        today,
        isSubjectDayReportingBlocked: (dateYmd) => entriesAuthUserId != null && isSubjectDayReportingBlocked(dateYmd),
        entryHoursForTotals: (entry) => entryHoursForTotals(entry, runningTimer, liveExtraSec),
    }), [
        dayGroups,
        viewMode,
        today,
        entriesAuthUserId,
        isSubjectDayReportingBlocked,
        runningTimer,
        liveExtraSec,
    ]);
    const renderVirtualTimesheetItem = useCallback((item: TimesheetVirtualItem) => {
        if (item.kind === 'header') {
            const dayTotal = item.group.rows.reduce(
                (sum, entry) => sum + entryHoursForTotals(entry, runningTimer, liveExtraSec),
                0,
            );
            return (
                <TimesheetDayHeader
                    group={item.group}
                    isToday={item.isToday}
                    dayTotal={dayTotal}
                    addBlocked={item.addBlocked}
                    dateTag={dateTag}
                    weekClosedTitle={weekClosedTitle}
                    fmtHours={fmtHours}
                    t={t}
                    onAdd={openAdd}
                />
            );
        }
        if (item.kind === 'row') {
            const rowBlocked = entriesAuthUserId != null && isSubjectDayReportingBlocked(item.entry.date);
            return (
                <TimesheetEntryRowItem
                    entry={item.entry}
                    handlers={{
                        ...entryRowHandlers,
                        rowReportingBlocked: rowBlocked,
                    }}
                />
            );
        }
        if (item.kind === 'day-block') {
            return (
                <TimesheetDayBlock
                    group={item.group}
                    isToday={item.isToday}
                    dayTotal={item.dayTotal}
                    addBlocked={item.addBlocked}
                    showHeader={viewMode === 'week'}
                    dateTag={dateTag}
                    weekClosedTitle={weekClosedTitle}
                    fmtHours={fmtHours}
                    t={t}
                    onAdd={openAdd}
                    entryRowHandlers={entryRowHandlers}
                    isRowBlocked={(dateYmd) => entriesAuthUserId != null && isSubjectDayReportingBlocked(dateYmd)}
                />
            );
        }
        return (
            <TimesheetDayFooter
                dayTotal={item.dayTotal}
                addBlocked={item.addBlocked}
                weekClosedTitle={weekClosedTitle}
                fmtHours={fmtHours}
                t={t}
                onAdd={openAdd}
                groupKey={item.group.key}
            />
        );
    }, [
        runningTimer,
        liveExtraSec,
        dateTag,
        weekClosedTitle,
        fmtHours,
        t,
        openAdd,
        entryRowHandlers,
        entriesAuthUserId,
        isSubjectDayReportingBlocked,
        viewMode,
    ]);
    if (blockingSkeleton) {
        return <TimesheetSkeleton layout={viewMode === 'calendar' ? 'calendar' : 'week'} />;
    }
    const headingViewMode = viewTxPhase !== 'idle' ? entriesScopeMode : viewMode;
    const headDate = headingViewMode === 'calendar'
        ? (() => {
            const raw = calendarAnchor.toLocaleDateString(dateTag, { month: 'long', year: 'numeric' });
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        })()
        : headingViewMode === 'day'
            ? fmtDateHeading(activeDay, dateTag)
            : isCurrentWeek
                ? `${t('timeTrackingPage.timesheet.thisWeekPrefix')} ${weekStart.toLocaleDateString(dateTag, { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString(dateTag, { day: 'numeric', month: 'short' })}`
                : `${weekStart.toLocaleDateString(dateTag, { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString(dateTag, { day: 'numeric', month: 'short' })}`;
    const showReturnToToday = headingViewMode === 'calendar' ? !isSameMonth(calendarAnchor, today) : !isCurrentWeek;
    const canGoNextNav = viewMode === 'calendar' ? canGoNextByMonth : canGoNextByWeek;
    const nextArrTitle = viewMode === 'calendar'
        ? (canGoNextByMonth ? t('timeTrackingPage.timesheet.nextMonthShort') : t('timeTrackingPage.timesheet.nextMonthBlocked'))
        : (canGoNextByWeek ? t('timeTrackingPage.timesheet.forwardShort') : t('timeTrackingPage.timesheet.forwardWeekBlocked'));
    const timesheetScrollRef = viewMode === 'calendar' ? viewStackScrollRef : contentScrollRef;
    const timesheetFooter = (<div className="tsp__foot">
        <div className="tsp__foot-total">
            <span className="tsp__foot-total-lbl">
                {viewMode === 'calendar' ? t('timeTrackingPage.timesheet.footerTotalMonth') : t('timeTrackingPage.timesheet.footerTotalWeek')}
            </span>
            <span className="tsp__foot-total-n">{fmtHours(periodTotal)}</span>
        </div>
        <div className="tsp__submit-wrap">
            <button type="button" className="tsp__submit" disabled={entriesAuthUserId == null || submitWeekBusy} onClick={() => void handleSubmitWeek()}>
                {submitWeekBusy ? t('timeTrackingPage.saving') : t('timeTrackingPage.timesheet.submitApproval')}
            </button>
            <button className="tsp__submit-arr" aria-label={t('timeTrackingPage.timesheet.submitOptionsAria')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>
        </div>
    </div>);
    return (<div className={`tsp${viewMode === 'calendar' ? ' tsp--calendar-layout' : ''}`}>
        <div className={`tsp__top${headingViewMode === 'day' && activeDayReportingBlocked ? ' tsp__top--day-week-closed' : ''}`}>
            <div className="tsp__top-l">
                <button type="button" className="tsp__arr" onClick={prevPeriod} aria-label={headingViewMode === 'calendar' ? t('timeTrackingPage.timesheet.prevMonth') : t('timeTrackingPage.timesheet.back')} title={headingViewMode === 'calendar' ? t('timeTrackingPage.timesheet.prevMonthShort') : t('timeTrackingPage.timesheet.backShort')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button type="button" className="tsp__arr" onClick={nextPeriod} disabled={!canGoNextNav} aria-label={`${headingViewMode === 'calendar' ? t('timeTrackingPage.timesheet.nextMonth') : t('timeTrackingPage.timesheet.forward')}${!canGoNextNav ? t('timeTrackingPage.timesheet.navDisabledSuffix') : ''}`} title={nextArrTitle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>

                <h2 className="tsp__heading">{headDate}</h2>

                {headingViewMode === 'day' && (<DatePicker value={formatDate(activeDay)} max={formatDate(today)} onChange={(iso) => {
                    const [y, m, d] = iso.split('-').map((n) => Number(n));
                    if (!y || !m || !d)
                        return;
                    const dt = new Date(y, m - 1, d);
                    if (dt > today)
                        return;
                    setActiveDay(dt);
                    setWeekStart(startOfWeek(dt));
                }} className={`tsp__date-jump-wrap${activeDayReportingBlocked ? ' tsp__date-jump-wrap--week-closed' : ''}`} buttonClassName="tsp__date-jump-btn" title={t('timeTrackingPage.timesheet.jumpToDate')} />)}

                {headingViewMode === 'day' && (<button type="button" className="tsp__top-add" onClick={() => openAdd(formatDate(activeDay))} disabled={activeDayReportingBlocked} title={activeDayReportingBlocked ? weekClosedTitle : t('timeTrackingPage.timesheet.addTime')} aria-label={t('timeTrackingPage.timesheet.addTime')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {t('timeTrackingPage.timesheet.addTime')}
                </button>)}

                {showReturnToToday ? (<button type="button" className="tsp__return" onClick={goTodayPeriod} title={t('timeTrackingPage.timesheet.returnTodayTitle')}>
                    {t('timeTrackingPage.timesheet.today')}
                </button>) : (<span className="tsp__return tsp__return--passive" aria-hidden>
                    {t('timeTrackingPage.timesheet.today')}
                </span>)}
            </div>

            <div className="tsp__top-r">
                {viewMode === 'calendar' ? (<div className="tsp__cal-outlook" role="group" aria-label={t('timeTrackingPage.timesheet.outlookCalendarAria')}>
                    {!outlookCalendar.connected ? (<button
                        type="button"
                        className="tsp__cal-outlook-connect"
                        onClick={outlookCalendar.connect}
                        disabled={!outlookCalendar.statusChecked}
                    >
                        {t('timeTrackingPage.timesheet.connectCalendar')}
                    </button>) : (<>
                        {outlookCalendar.calendars.length > 0 ? (
                        <OutlookCalendarSelect
                            value={outlookCalendar.calendarId}
                            onChange={outlookCalendar.setCalendarId}
                            calendars={outlookCalendar.calendars}
                            showLabel={t('timeTrackingPage.timesheet.calendarShow')}
                            listAriaLabel={t('timeTrackingPage.timesheet.calendarListAria')}
                            defaultCalendarLabel={t('timeTrackingPage.timesheet.calendarDefault')}
                            allCalendarsId={outlookCalendar.allCalendarsId}
                            allCalendarsLabel={t('timeTrackingPage.timesheet.calendarAll')}
                            disabled={!outlookCalendar.statusChecked}
                        />
                        ) : null}
                        <button
                            type="button"
                            className="tsp__cal-outlook-connect tsp__cal-outlook-reconnect"
                            onClick={outlookCalendar.reconnect}
                            disabled={!outlookCalendar.statusChecked}
                            title={t('timeTrackingPage.timesheet.reconnectCalendarTitle')}
                        >
                            {t('timeTrackingPage.timesheet.reconnectCalendar')}
                        </button>
                    </>)}
                    {outlookCalendar.connectError ? (<span className="tsp__cal-outlook-err" role="alert">{outlookCalendar.connectError}</span>) : null}
                    {outlookCalendar.eventsError ? (<span className="tsp__cal-outlook-err" role="alert">
                        {outlookCalendar.eventsError === 'events_partial_failed'
                            ? t('timeTrackingPage.timesheet.calendarEventsPartialError')
                            : t('timeTrackingPage.timesheet.calendarEventsLoadError')}
                    </span>) : null}
                </div>) : null}
                <div className="tsp__seg">
                    <button type="button" className={`tsp__seg-btn${viewMode === 'day' ? ' tsp__seg-btn--on' : ''}`} disabled={viewTxPhase !== 'idle'} onClick={() => beginSegViewSwitch('day')}>
                        {t('timeTrackingPage.timesheet.day')}
                    </button>
                    <button type="button" className={`tsp__seg-btn${viewMode === 'week' ? ' tsp__seg-btn--on' : ''}`} disabled={viewTxPhase !== 'idle'} onClick={() => beginSegViewSwitch('week')}>
                        {t('timeTrackingPage.timesheet.week')}
                    </button>
                    <button type="button" className={`tsp__seg-btn${viewMode === 'calendar' ? ' tsp__seg-btn--on' : ''}`} disabled={viewTxPhase !== 'idle'} onClick={() => beginSegViewSwitch('calendar')}>
                        {t('timeTrackingPage.timesheet.calendar')}
                    </button>
                </div>
            </div>
        </div>
        {showGrantUnlockStrip ? (<div className="tsp__grant-unlock" role="region" aria-label={t('timeTrackingPage.timesheet.grantUnlockAria')}>
            <span className="tsp__grant-unlock-txt">
                {t('timeTrackingPage.timesheet.grantUnlockDay')} (<strong>{activeDayYmd}</strong>).
            </span>
            <button type="button" className="tsp__grant-unlock-btn" disabled={grantUnlockBusy} onClick={() => setGrantUnlockConfirmOpen(true)}>
                {t('timeTrackingPage.timesheet.grantUnlockBtn')}
            </button>
        </div>) : null}
        <div ref={viewStackScrollRef} className={viewTxPhase === 'idle'
            ? 'tsp__view-stack'
            : `tsp__view-stack tsp__view-stack--${viewTxPhase}`}>
            <div className="tsp__view-live">
                <div className={`tsp__strip${viewMode === 'calendar' ? ' tsp__strip--calendar' : ''}`}>
                    {viewMode === 'calendar' ? (<div className="tsp__cal">
                        {outlookCalendar.isAllCalendars && outlookCalendar.calendars.length > 0 ? (
                            <ul className="tsp__cal-legend" aria-label={t('timeTrackingPage.timesheet.calendarLegendAria')}>
                                {[...outlookCalendar.calendars]
                                    .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
                                    .map((cal) => {
                                        const accent = outlookCalendarAccentColor(
                                            cal.id,
                                            outlookCalendar.calendarColorOrder,
                                        );
                                        const name = displayOutlookCalendarLabel(cal.name);
                                        return (
                                            <li key={cal.id} className="tsp__cal-legend-item" title={name}>
                                                <span
                                                    className="tsp__cal-legend-dot"
                                                    style={outlookCalendarAccentStyle(accent)}
                                                    aria-hidden
                                                />
                                                <span className="tsp__cal-legend-label">{name}</span>
                                            </li>
                                        );
                                    })}
                            </ul>
                        ) : null}
                        <div className="tsp__cal-dows">
                            {calWeekdayLabels.map((w, di) => (<div key={w} className={`tsp__cal-dow${di >= 5 ? ' tsp__cal-dow--wknd' : ''}`}>
                                {w}
                            </div>))}
                        </div>
                        <div className="tsp__cal-grid">
                            {calendarCells.map((d, i) => {
                                const inMonth = isSameMonth(d, calendarAnchor);
                                const k = formatDate(d);
                                const h = hoursByDate.get(k) ?? 0;
                                const voidInfo = voidInfoByDate.get(k);
                                const voidCalClass = voidInfo?.hasReject
                                    ? 'tsp__cal-cell--void-reject'
                                    : voidInfo?.hasRealloc
                                        ? 'tsp__cal-cell--void-realloc'
                                        : '';
                                const isTodayCell = isSameDay(d, today);
                                const isActiveCell = isSameDay(d, activeDay);
                                const isFuture = isFutureCalendarDay(d, today) && !isTodayCell;
                                const dow = i % 7;
                                const isWkndCol = dow >= 5;
                                const cellWeekClosed = entriesAuthUserId != null && isSubjectDayReportingBlocked(k);
                                const dayOutlookEvents = outlookCalendar.connected
                                    ? outlookCalendar.getEventsForDateKey(k)
                                    : [];
                                const visibleOutlookEvents = dayOutlookEvents.slice(0, MONTH_CELL_OUTLOOK_CAP);
                                const hiddenOutlookCount = Math.max(0, dayOutlookEvents.length - visibleOutlookEvents.length);
                                const cellTitleParts = [
                                    d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
                                    ...dayOutlookEvents.map((ev) => {
                                        const subject = ev.subject?.trim() || t('timeTrackingPage.timesheet.outlookEventFallback');
                                        const time = formatCalendarEventTime(ev);
                                        const calName = outlookCalendar.isAllCalendars && ev.calendarId
                                            ? (ev.calendarId === 'default'
                                                ? t('timeTrackingPage.timesheet.calendarDefault')
                                                : displayOutlookCalendarLabel(
                                                    outlookCalendar.calendars.find((c) => c.id === ev.calendarId)?.name ?? '',
                                                ))
                                            : '';
                                        const line = time ? `${time} · ${subject}` : subject;
                                        return calName ? `${line} · ${calName}` : line;
                                    }),
                                ];
                                return (<button key={i} type="button" className={[
                                    'tsp__cal-cell',
                                    !inMonth ? 'tsp__cal-cell--muted' : '',
                                    isWkndCol ? 'tsp__cal-cell--wknd' : '',
                                    isTodayCell ? 'tsp__cal-cell--today' : '',
                                    isActiveCell ? 'tsp__cal-cell--active' : '',
                                    isFuture ? 'tsp__cal-cell--future' : '',
                                    cellWeekClosed ? 'tsp__cal-cell--week-closed' : '',
                                    voidCalClass,
                                ]
                                    .filter(Boolean)
                                    .join(' ')} onClick={() => {
                                        setActiveDay(d);
                                        if (isFuture && dayOutlookEvents.length > 0)
                                            setOutlookDayAgenda({ day: d, events: dayOutlookEvents });
                                    }} title={cellTitleParts.join('\n')}>
                                    <span className="tsp__cal-cell-n">{d.getDate()}</span>
                                    {dayOutlookEvents.length > 0 ? (<div className="tsp__cal-cell-events">
                                        {visibleOutlookEvents.map((ev) => {
                                            const { time, subject } = formatCalendarEventCellLabel(ev);
                                            const evKey = `${ev.calendarId ?? 'default'}-${ev.id}`;
                                            const tinted = outlookCalendar.isAllCalendars;
                                            const accent = tinted
                                                ? outlookCalendarAccentColor(
                                                    ev.calendarId ?? 'default',
                                                    outlookCalendar.calendarColorOrder,
                                                )
                                                : null;
                                            const title = formatCalendarEventTime(ev);
                                            return (<button
                                                key={evKey}
                                                type="button"
                                                className={`tsp__cal-cell-ev${tinted ? ' tsp__cal-cell-ev--tinted' : ''}`}
                                                style={accent ? outlookCalendarAccentStyle(accent) : undefined}
                                                title={title ? `${title} · ${subject}` : subject}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOutlookEventDetail({ event: ev, day: d });
                                                }}
                                            >
                                                {time ? <span className="tsp__cal-cell-ev-time">{time}</span> : null}
                                                <span className="tsp__cal-cell-ev-subj">{subject}</span>
                                            </button>);
                                        })}
                                        {hiddenOutlookCount > 0 ? (
                                            <button
                                                type="button"
                                                className="tsp__cal-cell-ev-more"
                                                title={t('timeTrackingPage.timesheet.outlookMoreTitle').replace('{count}', String(dayOutlookEvents.length))}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOutlookDayAgenda({ day: d, events: dayOutlookEvents });
                                                }}
                                            >
                                                {t('timeTrackingPage.timesheet.outlookMoreCount').replace('{count}', String(hiddenOutlookCount))}
                                            </button>
                                        ) : null}
                                    </div>) : null}
                                    {h > 0
                                        ? <span className="tsp__cal-cell-h">{fmtHours(h)}</span>
                                        : voidInfo
                                            ? (<span className={`tsp__cal-cell-void-hint${voidInfo.hasReject ? ' tsp__cal-cell-void-hint--reject' : ' tsp__cal-cell-void-hint--realloc'}`} title={t('timeTrackingPage.timesheet.voidOffAccount')}>
                                                —
                                            </span>)
                                            : null}
                                </button>);
                            })}
                        </div>
                    </div>) : (weekDays.map((d, i) => {
                        const isToday = isSameDay(d, today);
                        const isActive = isSameDay(d, activeDay) && viewMode === 'day';
                        const h = hoursPerDay[i];
                        const isWknd = i >= 5;
                        const pct = Math.min(100, (h / 8) * 100);
                        const isFuture = isFutureCalendarDay(d, today) && !isToday;
                        const dayYmd = formatDate(d);
                        const stripDayQuickBlocked = entriesAuthUserId != null && isSubjectDayReportingBlocked(dayYmd);
                        const vInfo = voidInfoByDate.get(dayYmd);
                        const voidDayClass = vInfo?.hasReject
                            ? 'tsp__day--void-reject'
                            : vInfo?.hasRealloc
                                ? 'tsp__day--void-realloc'
                                : '';
                        return (<div key={i} role="button" tabIndex={0} className={[
                            'tsp__day',
                            isToday ? 'tsp__day--today' : '',
                            isActive ? 'tsp__day--active' : '',
                            isWknd ? 'tsp__day--wknd' : '',
                            isFuture ? 'tsp__day--future' : '',
                            stripDayQuickBlocked ? 'tsp__day--week-closed' : '',
                            voidDayClass,
                        ]
                            .filter(Boolean)
                            .join(' ')} onClick={() => {
                                setActiveDay(d);
                                if (!isFuture)
                                    setViewMode('day');
                            }} onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setActiveDay(d);
                                    if (!isFuture)
                                        setViewMode('day');
                                }
                            }} title={d.toLocaleDateString(dateTag, { weekday: 'long', day: 'numeric', month: 'long' })}>
                            <span className="tsp__day-wk">{fmtShort(d, dateTag)}</span>
                            <span className="tsp__day-n">{d.getDate()}</span>

                            <div className="tsp__day-bar-wrap">
                                <div className={`tsp__day-bar${h > 0 ? ' tsp__day-bar--on' : ''}${pct >= 100 ? ' tsp__day-bar--full' : ''}`} style={{ width: `${pct}%` }} />
                            </div>

                            <span className={`tsp__day-h${h > 0 ? ' tsp__day-h--on' : ''}`}>
                                {h > 0 ? fmtHours(h) : <span className="tsp__day-h-zero">—</span>}
                            </span>

                            <button type="button" className="tsp__day-quick" onClick={(e) => {
                                e.stopPropagation();
                                if (isFuture)
                                    return;
                                openAdd(formatDate(d));
                            }} aria-label={`${t('timeTrackingPage.timesheet.addTimeForDay')} ${fmtShort(d, dateTag)}`} tabIndex={-1} disabled={stripDayQuickBlocked || isFuture} title={isFuture
                                ? t('timeTrackingPage.timesheet.futureDates')
                                : (stripDayQuickBlocked ? weekClosedTitle : undefined)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        </div>);
                    }))}

                    <div className="tsp__wtotal">
                        <span className="tsp__wtotal-lbl">
                            {viewMode === 'calendar' ? (<>
                                {t('timeTrackingPage.timesheet.totalForMonth')}
                                <br />
                                {t('timeTrackingPage.timesheet.forMonth')}
                            </>) : (<>
                                {t('timeTrackingPage.timesheet.totalForWeek')}
                                <br />
                                {t('timeTrackingPage.timesheet.forWeek')}
                            </>)}
                        </span>
                        <span className={`tsp__wtotal-n${periodTotal > 0 ? ' tsp__wtotal-n--on' : ''}${periodBarPct >= 100 ? ' tsp__wtotal-n--full' : ''}`}>{fmtHours(periodTotal)}</span>
                        <div className="tsp__wtotal-bar-wrap" title={`${Math.round((periodTotal / periodNorm) * 100)}% ${t('timeTrackingPage.timesheet.percentOf')} ${fmtHours(periodNorm)}`}>
                            <div className={`tsp__wtotal-bar${periodBarPct >= 100 ? ' tsp__wtotal-bar--full' : ''}`} style={{ width: `${periodBarPct}%` }} />
                        </div>
                        <span className="tsp__wtotal-cap">{t('timeTrackingPage.timesheet.ofCap')} {fmtHours(periodNorm)}</span>
                    </div>
                </div>
                <div className={`tsp__content${viewMode === 'calendar' ? ' tsp__content--calendar' : ''}`} ref={contentScrollRef}>
                    {(hasAnyEntries || filterActive || viewMode === 'week') && (<div className="tsp__filter-bar" role="search">
                        <div className="tsp__filter-search">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                                <circle cx="11" cy="11" r="7" />
                                <path d="M21 21l-4.3-4.3" />
                            </svg>
                            <input ref={searchInputRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('timeTrackingPage.timesheet.searchPlaceholder')} aria-label={t('timeTrackingPage.timesheet.searchAria')} />
                            {query && (<button type="button" className="tsp__filter-search-clear" onClick={() => setQuery('')} aria-label={t('timeTrackingPage.timesheet.clearSearch')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>)}
                        </div>
                        {viewMode === 'week' && (<div className="tsp__filter-week" role="group" aria-label={t('timeTrackingPage.timesheet.weekDayFiltersAria')}>
                            <div className="tsp__filter-week-sort" role="group" aria-label={t('timeTrackingPage.timesheet.weekDayOrderAria')}>
                                <button type="button" className={`tsp__filter-chip${weekDayOrder === 'monday' ? ' tsp__filter-chip--on' : ''}`} onClick={() => { setWeekDayOrder('monday'); setWeekDayFilter('all'); }} aria-pressed={weekDayOrder === 'monday'} title={t('timeTrackingPage.timesheet.weekOrderMondayTitle')}>
                                    {t('timeTrackingPage.timesheet.weekOrderMonday')}
                                </button>
                                <button type="button" className={`tsp__filter-chip${weekDayOrder === 'today' ? ' tsp__filter-chip--on' : ''}`} onClick={() => {
                                    setWeekDayOrder('today');
                                    setWeekDayFilter('all');
                                    const now = getTodayDate();
                                    setWeekStart(startOfWeek(now));
                                    setActiveDay(now);
                                }} aria-pressed={weekDayOrder === 'today'} title={t('timeTrackingPage.timesheet.weekOrderTodayTitle')}>
                                    {t('timeTrackingPage.timesheet.weekOrderToday')}
                                </button>
                            </div>
                            <div className="tsp__filter-week-days" role="group" aria-label={t('timeTrackingPage.timesheet.weekDayPickAria')}>
                                <button type="button" className={`tsp__filter-day${weekDayFilter === 'all' ? ' tsp__filter-day--on' : ''}`} onClick={() => setWeekDayFilter('all')} aria-pressed={weekDayFilter === 'all'}>
                                    {t('timeTrackingPage.timesheet.weekAllDays')}
                                </button>
                                {weekDays.map((d) => {
                                    const key = formatDate(d);
                                    const isToday = isSameDay(d, today);
                                    const isFuture = isFutureCalendarDay(d, today) && !isToday;
                                    const label = `${fmtShort(d, dateTag)} ${d.getDate()}`;
                                    return (<button key={key} type="button" className={[
                                        'tsp__filter-day',
                                        weekDayFilter === key ? ' tsp__filter-day--on' : '',
                                        isToday ? ' tsp__filter-day--today' : '',
                                        isFuture ? ' tsp__filter-day--future' : '',
                                    ].filter(Boolean).join(' ')} onClick={() => setWeekDayFilter((prev) => prev === key ? 'all' : key)} aria-pressed={weekDayFilter === key} disabled={isFuture} title={isFuture ? t('timeTrackingPage.timesheet.futureDates') : undefined}>
                                        {label}
                                    </button>);
                                })}
                            </div>
                        </div>)}
                        <button type="button" className={`tsp__filter-chip${billableOnly ? ' tsp__filter-chip--on' : ''}`} onClick={() => setBillableOnly((v) => !v)} aria-pressed={billableOnly} title={t('timeTrackingPage.timesheet.billableOnlyTitle')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t('timeTrackingPage.timesheet.billableOnly')}
                        </button>
                        {filterActive && (<button type="button" className="tsp__filter-reset" onClick={resetFilters} title={t('timeTrackingPage.timesheet.resetFiltersTitle')}>
                            {t('timeTrackingPage.timesheet.reset')}
                        </button>)}
                        <div className="tsp__filter-meta" aria-live="polite">
                            {filterActive
                                ? `${t('timeTrackingPage.timesheet.shownPrefix')} ${shownRowsInPeriod} ${t('timeTrackingPage.timesheet.ofWord')} ${totalRowsInPeriod}`
                                : `${t('timeTrackingPage.timesheet.totalEntries')} ${totalRowsInPeriod}`}
                        </div>
                    </div>)}
                    {!hasEntries ? (filterActive ? (<div className="tsp__empty tsp__empty--filter">
                        <div className="tsp__empty-ico-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <circle cx="11" cy="11" r="7" />
                                <path d="M21 21l-4.3-4.3" />
                            </svg>
                        </div>
                        <p className="tsp__empty-h">{t('timeTrackingPage.timesheet.emptyFilterTitle')}</p>
                        <p className="tsp__empty-s">{t('timeTrackingPage.timesheet.emptyFilterDesc')}</p>
                        <button className="tsp__empty-cta tsp__empty-cta--ghost" onClick={resetFilters}>
                            {t('timeTrackingPage.timesheet.resetFilters')}
                        </button>
                    </div>) : (<div className="tsp__empty">
                        <div className="tsp__empty-ico-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 7v5l3.5 2" />
                            </svg>
                        </div>
                        <p className="tsp__empty-h">{t('timeTrackingPage.timesheet.emptyDayTitle')}</p>
                        <p className="tsp__empty-s">{t('timeTrackingPage.timesheet.emptyDayDesc')}</p>
                        <button type="button" className="tsp__empty-cta" onClick={() => openAdd(formatDate(activeDay))} disabled={activeDayReportingBlocked} title={activeDayReportingBlocked ? weekClosedTitle : undefined}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {t('timeTrackingPage.timesheet.addTime')}
                        </button>
                    </div>)) : (<div className="tsp__groups">
                        <TimesheetVirtualList
                            scrollRef={timesheetScrollRef}
                            items={virtualTimesheetItems}
                            renderItem={(item) => (
                                <div
                                    className={[
                                        'tsp__virtual-block',
                                        item.kind === 'header' ? 'tsp__virtual-block--header' : '',
                                        item.kind === 'row' ? 'tsp__virtual-block--row' : '',
                                        item.kind === 'footer' ? 'tsp__virtual-block--footer' : '',
                                    ].filter(Boolean).join(' ')}
                                >
                                    {renderVirtualTimesheetItem(item)}
                                </div>
                            )}
                        />
                    </div>)}
                </div>
                {viewMode !== 'calendar' ? timesheetFooter : null}
            </div>
            {viewTxPhase === 'skel' ? (<div className="tsp__view-skel-layer" aria-hidden>
                <TimesheetSkeleton layout={viewMode === 'calendar' ? 'calendar' : 'week'} showChrome={false} />
            </div>) : null}
        </div>
        {viewMode === 'calendar' ? timesheetFooter : null}

        {modal.open && entriesAuthUserId != null && (<EntryModal key={`${modal.date}_${modal.edit?.id ?? modal.clone?.id ?? 'new'}_${modal.preferredTaskName ?? ''}`} entry={modal.edit} clone={modal.clone} defaultDate={modal.date} preferredTaskName={modal.preferredTaskName} preserveCloneHours={modal.preserveCloneHours} projects={entryModalProjects} projectsLoading={projectsState.loading} projectsLoadError={projectsState.error} tasksByProjectId={tasksByProjectId} loadingProjectTaskIds={loadingProjectTaskIds} onRequestProjectTasks={requestProjectTasks} entriesSubjectAuthUserId={entriesAuthUserId} viewerCanOverrideWeeklyLock={viewerCanOverrideWeeklyLock} onClose={closeModal} onSave={saveEntry} />)}
        {outlookDayAgenda ? (
            <TimesheetOutlookDayAgendaModal
                day={outlookDayAgenda.day}
                events={outlookDayAgenda.events}
                isAllCalendars={outlookCalendar.isAllCalendars}
                calendarColorOrder={outlookCalendar.calendarColorOrder}
                calendarNameFor={(calendarId) => resolveOutlookCalendarDisplayName(
                    calendarId ?? 'default',
                    outlookCalendar.calendars,
                    t('timeTrackingPage.timesheet.calendarDefault'),
                )}
                onClose={() => setOutlookDayAgenda(null)}
                onSelectEvent={(ev) => {
                    setOutlookDayAgenda(null);
                    setOutlookEventDetail({ event: ev, day: outlookDayAgenda.day });
                }}
            />
        ) : null}
        {outlookEventDetail ? (<TimesheetOutlookEventModal
            event={outlookEventDetail.event}
            day={outlookEventDetail.day}
            addBlocked={isFutureCalendarDay(outlookEventDetail.day, today)
                || isSubjectDayReportingBlocked(formatDate(outlookEventDetail.day))}
            addBlockedTitle={isFutureCalendarDay(outlookEventDetail.day, today)
                ? t('timeTrackingPage.timesheet.futureDates')
                : weekClosedTitle}
            onClose={() => setOutlookEventDetail(null)}
            onAddTime={() => openAddFromOutlookEvent(outlookEventDetail.event, outlookEventDetail.day)}
        />) : null}
        {grantUnlockConfirmOpen && showGrantUnlockStrip && entriesAuthUserId != null ? (<TimesheetGrantUnlockConfirm workDateYmd={activeDayYmd} busy={grantUnlockBusy} onCancel={() => {
            if (!grantUnlockBusy)
                setGrantUnlockConfirmOpen(false);
        }} onConfirm={() => {
            const uid = entriesAuthUserId;
            if (!uid || grantUnlockBusy)
                return;
            setGrantUnlockConfirmOpen(false);
            void (async () => {
                try {
                    setGrantUnlockBusy(true);
                    const out = await grantTimeEntryEditUnlock(uid, activeDayYmd);
                    const until = new Date(out.expiresAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
                    setEntriesBanner({ message: t('timeTrackingPage.timesheet.grantUnlockSuccess').replace('{date}', activeDayYmd).replace('{until}', until), variant: 'success' });
                }
                catch (e) {
                    setEntriesBanner({
                        message: e instanceof Error ? e.message : t('timeTrackingPage.errors.grantUnlockFailed'),
                        variant: 'danger',
                    });
                }
                finally {
                    setGrantUnlockBusy(false);
                }
            })();
        }} />) : null}
        <TimerBusyHintModal open={timerBusyHintOpen} onClose={() => setTimerBusyHintOpen(false)} />
        {deleteTarget && (<TimesheetDeleteConfirm entry={deleteTarget} busy={deleteBusy} onCancel={() => {
            if (deleteBusy)
                return;
            setDeleteTarget(null);
        }} onConfirm={async () => {
            const id = deleteTarget.id;
            setDeleteBusy(true);
            try {
                await deleteEntry(id);
            }
            finally {
                setDeleteBusy(false);
                setDeleteTarget(null);
            }
        }} />)}
    </div>);
}
