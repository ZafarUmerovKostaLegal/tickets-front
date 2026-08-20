import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    confirmPartnerReportConfirmation,
    createPartnerConfirmationComment,
    patchPartnerConfirmationComment,
    deletePartnerReportConfirmation,
    fetchReportsUsersForFilter,
    listPartnerConfirmationComments,
    listPartnerReportConfirmationsPending,
    notifyPartnerConfirmedReportsListInvalidate,
    patchPartnerReportConfirmationPriority,
    type PartnerConfirmedReportComment,
    type PartnerPendingListScope,
    type PartnerReportConfirmationRequest,
    type PartnerReviewPriority,
    type ReportsFilterUser,
    type TimeManagerClientProjectRow,
} from '@entities/time-tracking';
import { getUsers, type User } from '@entities/user';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import {
    resolvePartnerReportClientLabel,
    resolvePartnerReportProjectLabel,
} from '@entities/time-tracking/lib/partnerReportDisplay';
import {
    enrichPartnerReportClientNamesFromRows,
    loadPartnerReportDisplayLookups,
    type PartnerReportClientMeta,
} from '@entities/time-tracking/lib/partnerReportDisplayLookups';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from '@entities/time-tracking/model/partnerConfirmedReports';
import {
    FOR_REVIEW_PRIORITY_ORDER,
    forReviewPriority,
    type ForReviewPriority,
} from '@entities/time-tracking/lib/forReviewPriority';
import { canViewAllForReviewReports } from '@entities/time-tracking/model/timeTrackingAccess';
import { openForReviewReportPreview } from '@pages/time-tracking/lib/partnerReportPreviewNav';
import {
    applyPartnerConfirmationCommentsSummary,
    hydratePartnerConfirmationCommentsSummaries,
    summarizePartnerConfirmationComments,
} from '@pages/time-tracking/lib/partnerConfirmationCommentsSummary';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { useAppDialog } from '@shared/ui';
import {
    PartnerConfirmedCommentsCell,
    PartnerConfirmedCommentsDrawer,
    partnerConfirmedCommentsCountLabel,
} from './PartnerConfirmedCommentsDrawer';
import { PartnerReportEmptyBadge, partnerReportIsEmpty } from './PartnerReportEmptyBadge';
import { PartnerReportsListLoading } from './PartnerReportsListLoading';

const FOR_REVIEW_PAGE_SIZE = 50;

const IcoRefresh = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
</svg>);

const IcoEye = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
</svg>);

const IcoCheck = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
</svg>);

const IcoTrash = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
</svg>);

const IcoSpinner = () => (<svg className="tt-partner-confirmed__btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="10" opacity="0.22" />
    <path d="M12 2a10 10 0 0 1 10 10" />
</svg>);

const IcoChevDown = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="6 9 12 15 18 9" />
</svg>);

type ForReviewPrioritySelectProps = {
    value: ForReviewPriority;
    disabled?: boolean;
    busy?: boolean;
    labels: Record<ForReviewPriority, string>;
    titles: Record<ForReviewPriority, string>;
    changeTitle: string;
    changeAria: string;
    busyLabel: string;
    onChange: (next: PartnerReviewPriority) => void;
};

function ForReviewPrioritySelect({
    value,
    disabled = false,
    busy = false,
    labels,
    titles,
    changeTitle,
    changeAria,
    busyLabel,
    onChange,
}: ForReviewPrioritySelectProps) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t) || menuRef.current?.contains(t))
                return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    useLayoutEffect(() => {
        if (!open) {
            setMenuBox(null);
            return;
        }
        const update = () => {
            const el = wrapRef.current;
            if (!el)
                return;
            const r = el.getBoundingClientRect();
            const width = Math.max(r.width, 168);
            let left = r.left;
            if (left + width > window.innerWidth - 8)
                left = Math.max(8, window.innerWidth - 8 - width);
            setMenuBox({ top: r.bottom + 4, left, width });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open]);

    return (
        <div
            ref={wrapRef}
            className="tt-for-review__priority-dd"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className={`tt-for-review__priority-trigger tt-for-review__priority-trigger--${value}${open ? ' tt-for-review__priority-trigger--open' : ''}`}
                disabled={disabled || busy}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={open ? listId : undefined}
                aria-label={changeAria}
                title={busy ? busyLabel : changeTitle}
                onClick={() => {
                    if (disabled || busy)
                        return;
                    setOpen((v) => !v);
                }}
            >
                <span className={`tt-for-review__priority-dot tt-for-review__priority-dot--${value}`} aria-hidden />
                <span className="tt-for-review__priority-trigger-label">{labels[value]}</span>
                <span className="tt-for-review__priority-chev" aria-hidden><IcoChevDown /></span>
            </button>
            {open && menuBox && !disabled
                ? createPortal(
                    <div
                        ref={menuRef}
                        id={listId}
                        className="tt-for-review__priority-menu"
                        role="listbox"
                        aria-label={changeAria}
                        style={{ top: menuBox.top, left: menuBox.left, minWidth: menuBox.width }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {FOR_REVIEW_PRIORITY_ORDER.map((key) => (
                            <button
                                key={key}
                                type="button"
                                role="option"
                                aria-selected={key === value}
                                className={`tt-for-review__priority-opt tt-for-review__priority-opt--${key}${key === value ? ' tt-for-review__priority-opt--active' : ''}`}
                                title={titles[key]}
                                onClick={() => {
                                    setOpen(false);
                                    if (key !== value)
                                        onChange(key);
                                }}
                            >
                                <span className={`tt-for-review__priority-dot tt-for-review__priority-dot--${key}`} aria-hidden />
                                <span>{labels[key]}</span>
                            </button>
                        ))}
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
}

function fmtIsoWhen(iso: string | null | undefined, locale: 'ru' | 'en'): string {
    if (!iso?.trim())
        return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()))
            return iso;
        return d.toLocaleString(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' });
    }
    catch {
        return iso;
    }
}

type PartnerUserMeta = {
    label: string;
    initials: string | null;
};

function normalizeSystemInitials(raw: string | null | undefined): string | null {
    const stored = (raw ?? '').trim().toUpperCase().replace(/Ё/g, 'Е');
    return stored || null;
}

function buildPartnerUsersMap(users: ReportsFilterUser[]): Map<number, PartnerUserMeta> {
    const map = new Map<number, PartnerUserMeta>();
    for (const u of users) {
        if (!u.id)
            continue;
        const label = u.displayName?.trim() || u.email?.trim() || `ID ${u.id}`;
        map.set(u.id, { label, initials: normalizeSystemInitials(u.initials) });
    }
    return map;
}

function applyAuthUserInitials(map: Map<number, PartnerUserMeta>, authUsers: User[]): void {
    for (const u of authUsers) {
        if (!u.id)
            continue;
        const label = u.display_name?.trim() || u.email?.trim() || `ID ${u.id}`;
        const initials = normalizeSystemInitials(u.initials);
        const prev = map.get(u.id);
        map.set(u.id, {
            label: prev?.label || label,
            initials: initials ?? prev?.initials ?? null,
        });
    }
}

function partnerInitialsForId(id: number, usersById: Map<number, PartnerUserMeta>): string {
    return usersById.get(id)?.initials ?? '—';
}

function PartnerInitialsCell({ row, usersById, locale, signedTitle, pendingTitle, }: {
    row: PartnerReportConfirmationRequest;
    usersById: Map<number, PartnerUserMeta>;
    locale: 'ru' | 'en';
    signedTitle: (initials: string, when: string) => string;
    pendingTitle: (initials: string) => string;
}) {
    const partnerIds = row.requiredPartnerAuthUserIds.length > 0
        ? row.requiredPartnerAuthUserIds
        : [...new Set([
            ...row.signatures.map((s) => s.partnerAuthUserId),
            ...row.pendingPartnerAuthUserIds,
        ])];
    if (partnerIds.length === 0)
        return <>—</>;
    const signedAtById = new Map(row.signatures.map((s) => [s.partnerAuthUserId, s.confirmedAt]));
    return (
      <div className="rp-partner-initials" role="list">
        {partnerIds.map((partnerId) => {
            const meta = usersById.get(partnerId);
            const initials = partnerInitialsForId(partnerId, usersById);
            const signedAt = signedAtById.get(partnerId);
            const signed = Boolean(signedAt);
            const titleBase = initials === '—' && meta?.label
                ? meta.label
                : initials;
            const title = signed
                ? signedTitle(titleBase, fmtIsoWhen(signedAt, locale))
                : pendingTitle(titleBase);
            return (
              <span
                key={partnerId}
                role="listitem"
                className={`rp-partner-initials__chip${signed ? ' rp-partner-initials__chip--signed' : ' rp-partner-initials__chip--pending'}`}
                title={title}
              >
                {initials}
              </span>
            );
        })}
      </div>
    );
}

const FOR_REVIEW_LIST_SCOPE_KEY = 'tt-for-review-list-scope';
const FOR_REVIEW_PRIORITY_FILTER_KEY = 'tt-for-review-priority-filter';

type ForReviewPriorityFilter = 'all' | ForReviewPriority;

function readForReviewListScope(): PartnerPendingListScope {
    try {
        const raw = sessionStorage.getItem(FOR_REVIEW_LIST_SCOPE_KEY);
        if (raw === 'all' || raw === 'mine')
            return raw;
    }
    catch {

    }
    return 'mine';
}

function readForReviewPriorityFilter(): ForReviewPriorityFilter {
    try {
        const raw = sessionStorage.getItem(FOR_REVIEW_PRIORITY_FILTER_KEY);
        if (raw === 'all' || raw === 'red' || raw === 'yellow' || raw === 'green')
            return raw;
    }
    catch {

    }
    return 'all';
}

export function ForReviewReportsPanel() {
    const navigate = useNavigate();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const { t, locale } = useI18n();
    const [rows, setRows] = useState<PartnerReportConfirmationRequest[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [priorityTotals, setPriorityTotals] = useState<Record<ForReviewPriority | 'all', number>>({
        all: 0,
        red: 0,
        yellow: 0,
        green: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshBusy, setRefreshBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [projectRows, setProjectRows] = useState<TimeManagerClientProjectRow[]>([]);
    const [clientNamesById, setClientNamesById] = useState<Map<string, string>>(new Map());
    const [clientMetaByProjectId, setClientMetaByProjectId] = useState<Map<string, PartnerReportClientMeta>>(new Map());
    const [usersById, setUsersById] = useState<Map<number, PartnerUserMeta>>(new Map());
    const [confirmBusyId, setConfirmBusyId] = useState<string | null>(null);
    const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
    const [priorityBusyId, setPriorityBusyId] = useState<string | null>(null);
    const [drawerComments, setDrawerComments] = useState<PartnerConfirmedReportComment[]>([]);
    const [commentsDrawerRow, setCommentsDrawerRow] = useState<PartnerReportConfirmationRequest | null>(null);
    const [commentComposeDraft, setCommentComposeDraft] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsSubmitting, setCommentsSubmitting] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const commentsHydrateSeqRef = useRef(0);
    const canViewAll = canViewAllForReviewReports(user);
    const [listScope, setListScope] = useState<PartnerPendingListScope>(() => {
        const saved = readForReviewListScope();
        return saved === 'all' ? 'all' : 'mine';
    });
    const [priorityFilter, setPriorityFilter] = useState<ForReviewPriorityFilter>(readForReviewPriorityFilter);
    const effectiveScope: PartnerPendingListScope = canViewAll && listScope === 'all' ? 'all' : 'mine';
    const pageCount = Math.max(1, Math.ceil(total / FOR_REVIEW_PAGE_SIZE) || 1);

    const usersByIdLabels = useMemo(() => {
        const map = new Map<number, string>();
        for (const [id, meta] of usersById) {
            map.set(id, meta.label);
        }
        return map;
    }, [usersById]);

    const patchRowCommentsSummary = useCallback((requestId: string, comments: PartnerConfirmedReportComment[]) => {
        const summary = summarizePartnerConfirmationComments(comments);
        setRows((list) => list.map((row) => (
            row.id === requestId
                ? applyPartnerConfirmationCommentsSummary(row, summary)
                : row
        )));
        setCommentsDrawerRow((prev) => (prev && prev.id === requestId
            ? applyPartnerConfirmationCommentsSummary(prev, summary)
            : prev));
    }, []);

    const hydrateCommentsForRows = useCallback((list: PartnerReportConfirmationRequest[]) => {
        const seq = ++commentsHydrateSeqRef.current;
        void hydratePartnerConfirmationCommentsSummaries(list).then((hydrated) => {
            if (seq !== commentsHydrateSeqRef.current)
                return;
            setRows((prev) => {
                if (prev.length === 0)
                    return prev;
                const byId = new Map(hydrated.map((row) => [row.id, row]));
                let changed = false;
                const next = prev.map((row) => {
                    const h = byId.get(row.id);
                    if (!h)
                        return row;
                    if (row.commentsCount === h.commentsCount && row.lastComment === h.lastComment)
                        return row;
                    changed = true;
                    return applyPartnerConfirmationCommentsSummary(row, {
                        commentsCount: h.commentsCount ?? 0,
                        lastComment: h.lastComment ?? null,
                    });
                });
                return changed ? next : prev;
            });
        });
    }, []);

    const openCommentsDrawer = useCallback((row: PartnerReportConfirmationRequest) => {
        setCommentsDrawerRow(row);
        setCommentComposeDraft('');
        setCommentsError(null);
        setDrawerComments([]);
        setCommentsLoading(true);
        void listPartnerConfirmationComments(row.id)
            .then((list) => {
                setDrawerComments(list);
                patchRowCommentsSummary(row.id, list);
            })
            .catch((e: unknown) => {
                const msg = e instanceof Error && e.message.trim()
                    ? e.message
                    : t('timeTrackingPage.reports.partnerConfirmed.commentsLoadError');
                setCommentsError(msg);
            })
            .finally(() => setCommentsLoading(false));
    }, [patchRowCommentsSummary, t]);

    const closeCommentsDrawer = useCallback(() => {
        setCommentsDrawerRow(null);
        setCommentComposeDraft('');
        setDrawerComments([]);
        setCommentsError(null);
        setCommentsLoading(false);
        setCommentsSubmitting(false);
    }, []);

    const addCommentForOpenRow = useCallback(async () => {
        const row = commentsDrawerRow;
        const text = commentComposeDraft.trim();
        if (!row || !text || commentsSubmitting)
            return;
        setCommentsSubmitting(true);
        setCommentsError(null);
        try {
            const created = await createPartnerConfirmationComment(row.id, text);
            const next = [...drawerComments, created];
            setDrawerComments(next);
            patchRowCommentsSummary(row.id, next);
            setCommentComposeDraft('');
        }
        catch (e: unknown) {
            const msg = e instanceof Error && e.message.trim()
                ? e.message
                : t('timeTrackingPage.reports.partnerConfirmed.commentsSaveError');
            setCommentsError(msg);
        }
        finally {
            setCommentsSubmitting(false);
        }
    }, [commentComposeDraft, commentsDrawerRow, commentsSubmitting, drawerComments, patchRowCommentsSummary, t]);

    const editCommentForOpenRow = useCallback(async (commentId: string, text: string) => {
        const row = commentsDrawerRow;
        const nextText = text.trim();
        if (!row || !commentId || !nextText || commentsSubmitting)
            return false;
        setCommentsSubmitting(true);
        setCommentsError(null);
        try {
            const updated = await patchPartnerConfirmationComment(row.id, commentId, nextText);
            const next = drawerComments.map((c) => (c.id === updated.id ? updated : c));
            setDrawerComments(next);
            patchRowCommentsSummary(row.id, next);
        }
        catch (e: unknown) {
            const msg = e instanceof Error && e.message.trim()
                ? e.message
                : t('timeTrackingPage.reports.partnerConfirmed.commentsEditError');
            setCommentsError(msg);
            throw e;
        }
        finally {
            setCommentsSubmitting(false);
        }
    }, [commentsDrawerRow, commentsSubmitting, drawerComments, patchRowCommentsSummary, t]);

    useEffect(() => {
        if (!canViewAll && listScope === 'all')
            setListScope('mine');
    }, [canViewAll, listScope]);

    useEffect(() => {
        if (!canViewAll)
            return;
        try {
            sessionStorage.setItem(FOR_REVIEW_LIST_SCOPE_KEY, listScope);
        }
        catch {

        }
    }, [canViewAll, listScope]);

    useEffect(() => {
        try {
            sessionStorage.setItem(FOR_REVIEW_PRIORITY_FILTER_KEY, priorityFilter);
        }
        catch {

        }
    }, [priorityFilter]);

    const loadMeta = useCallback(() => {
        void Promise.all([
            loadPartnerReportDisplayLookups(),
            fetchReportsUsersForFilter().catch(() => [] as ReportsFilterUser[]),
            getUsers(true).catch(() => [] as User[]),
        ]).then(([lookups, reportUsers, authUsers]) => {
            setProjectRows(lookups.projectRows);
            setClientNamesById(lookups.clientNamesById);
            setClientMetaByProjectId(lookups.clientMetaByProjectId);
            const usersMap = buildPartnerUsersMap(Array.isArray(reportUsers) ? reportUsers : []);
            applyAuthUserInitials(usersMap, Array.isArray(authUsers) ? authUsers : []);
            setUsersById(usersMap);
        }).catch(() => {
            setProjectRows([]);
            setClientNamesById(new Map());
            setClientMetaByProjectId(new Map());
            setUsersById(new Map());
        });
    }, []);

    const fetchPending = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent === true;
        if (!silent)
            setLoading(true);
        else
            setRefreshBusy(true);
        setError(null);
        try {
            const priority = priorityFilter === 'all' ? null : priorityFilter;
            const pageResult = await listPartnerReportConfirmationsPending({
                scope: effectiveScope,
                priority,
                page,
                pageSize: FOR_REVIEW_PAGE_SIZE,
            });
            const list = Array.isArray(pageResult.items) ? pageResult.items : [];
            setRows(list);
            setTotal(pageResult.total);
            const counts = pageResult.priorityCounts;
            if (counts) {
                setPriorityTotals({
                    all: counts.all,
                    red: counts.red,
                    yellow: counts.yellow,
                    green: counts.green,
                });
            }
            else if (priorityFilter === 'all') {
                setPriorityTotals((prev) => ({ ...prev, all: pageResult.total }));
            }
            setClientNamesById((prev) => {
                const next = new Map(prev);
                enrichPartnerReportClientNamesFromRows(next, list);
                return next;
            });
            hydrateCommentsForRows(list);
        }
        catch (e) {
            setRows([]);
            setTotal(0);
            setError(e instanceof Error ? e.message : t('timeTrackingPage.reports.forReview.loadFailed'));
        }
        finally {
            if (!silent)
                setLoading(false);
            else
                setRefreshBusy(false);
        }
    }, [effectiveScope, hydrateCommentsForRows, page, priorityFilter, t]);

    useEffect(() => {
        loadMeta();
    }, [loadMeta]);

    useEffect(() => {
        void fetchPending();
    }, [fetchPending]);

    useEffect(() => {
        if (page > pageCount)
            setPage(pageCount);
    }, [page, pageCount]);

    useEffect(() => {
        const onInv = () => {
            void fetchPending({ silent: true });
        };
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
    }, [fetchPending]);

    const resolveProjectLabel = useCallback((r: PartnerReportConfirmationRequest) => {
        return resolvePartnerReportProjectLabel(r, projectRows, clientNamesById, undefined, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, projectRows]);

    const resolveClientLabel = useCallback((r: PartnerReportConfirmationRequest) => {
        return resolvePartnerReportClientLabel(r, projectRows, clientNamesById, undefined, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, projectRows]);

    const filterRows = useCallback((source: PartnerReportConfirmationRequest[]) => {
        const q = query.trim().toLowerCase();
        if (!q)
            return source;
        return source.filter((r) => {
            const partnerHay = r.requiredPartnerAuthUserIds
                .map((id) => {
                    const meta = usersById.get(id);
                    return `${meta?.initials ?? ''} ${meta?.label ?? ''} ${id}`;
                })
                .join(' ');
            const priority = forReviewPriority(r);
            const hay = [
                resolveProjectLabel(r),
                resolveClientLabel(r),
                formatIsoRangeTitle(r.dateFrom, r.dateTo),
                r.dateFrom,
                r.dateTo,
                fmtIsoWhen(r.createdAt, locale),
                r.title,
                r.id,
                r.projectId,
                partnerHay,
                t(`timeTrackingPage.reports.forReview.priority.${priority}`),
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [locale, query, resolveClientLabel, resolveProjectLabel, t, usersById]);

    const filtered = useMemo(() => filterRows(rows), [filterRows, rows]);

    const hasActivePriorityFilter = priorityFilter !== 'all';

    const canSetPriority = useCallback((r: PartnerReportConfirmationRequest) => {
        const uid = user?.id;
        if (uid == null)
            return false;
        return r.submittedByAuthUserId === uid || canViewAll;
    }, [canViewAll, user?.id]);

    const changePriority = useCallback(async (r: PartnerReportConfirmationRequest, next: PartnerReviewPriority) => {
        if (priorityBusyId != null || forReviewPriority(r) === next || !canSetPriority(r))
            return;
        setPriorityBusyId(r.id);
        try {
            const updated = await patchPartnerReportConfirmationPriority(r.id, next);
            setRows((list) => list.map((row) => (row.id === r.id ? { ...row, ...updated } : row)));
            notifyPartnerConfirmedReportsListInvalidate();
            await fetchPending({ silent: true });
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.forReview.priorityChangeFailed'),
            });
        }
        finally {
            setPriorityBusyId(null);
        }
    }, [canSetPriority, fetchPending, priorityBusyId, showAlert, t]);

    const openReportPreviewForRow = useCallback((r: PartnerReportConfirmationRequest) => {
        void openForReviewReportPreview(r, navigate);
    }, [navigate]);

    const confirmRow = useCallback(async (r: PartnerReportConfirmationRequest) => {
        const uid = user?.id;
        if (uid == null || confirmBusyId != null)
            return;
        if (!r.pendingPartnerAuthUserIds.includes(uid))
            return;
        setConfirmBusyId(r.id);
        try {
            const out = await confirmPartnerReportConfirmation(r.id);
            notifyPartnerConfirmedReportsListInvalidate();
            await fetchPending({ silent: true });
            if (out.status === 'fully_confirmed') {
                await showAlert({ message: t('timeTrackingPage.reports.forReview.confirmFullyDone') });
            }
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.forReview.confirmFailed'),
            });
        }
        finally {
            setConfirmBusyId(null);
        }
    }, [confirmBusyId, fetchPending, showAlert, t, user?.id]);

    const deleteRow = useCallback(async (r: PartnerReportConfirmationRequest) => {
        const uid = user?.id;
        if (uid == null || deleteBusyId != null || confirmBusyId != null)
            return;
        const canDelete = r.submittedByAuthUserId === uid || canViewAll;
        if (!canDelete)
            return;
        const ok = await showConfirm({
            title: t('timeTrackingPage.reports.forReview.deleteConfirmTitle'),
            message: t('timeTrackingPage.reports.forReview.deleteConfirmMessage'),
            confirmLabel: t('timeTrackingPage.reports.forReview.deleteConfirmLabel'),
            variant: 'danger',
        });
        if (!ok)
            return;
        setDeleteBusyId(r.id);
        try {
            await deletePartnerReportConfirmation(r.id);
            notifyPartnerConfirmedReportsListInvalidate();
            await fetchPending({ silent: true });
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.forReview.deleteFailed'),
            });
        }
        finally {
            setDeleteBusyId(null);
        }
    }, [canViewAll, confirmBusyId, deleteBusyId, fetchPending, showAlert, showConfirm, t, user?.id]);

    const signedPartnerTitle = useCallback((initials: string, when: string) =>
        t('timeTrackingPage.reports.forReview.partnerSignedTitle')
            .replace('{initials}', initials)
            .replace('{when}', when), [t]);

    const pendingPartnerTitle = useCallback((initials: string) =>
        t('timeTrackingPage.reports.forReview.partnerPendingTitle')
            .replace('{initials}', initials), [t]);

    const countLabel = loading
        ? t('timeTrackingPage.reports.forReview.loading')
        : t('timeTrackingPage.reports.forReview.count')
            .replace('{filtered}', String(filtered.length))
            .replace('{total}', String(total));

    const columnLabels = useMemo(() => ({
        project: t('timeTrackingPage.reports.forReview.columns.project'),
        client: t('timeTrackingPage.reports.forReview.columns.client'),
        period: t('timeTrackingPage.reports.forReview.columns.period'),
        priority: t('timeTrackingPage.reports.forReview.columns.priority'),
        partners: t('timeTrackingPage.reports.forReview.columns.partners'),
        createdAt: t('timeTrackingPage.reports.forReview.columns.createdAt'),
        comments: t('timeTrackingPage.reports.partnerConfirmed.columns.comments'),
        actions: t('timeTrackingPage.reports.forReview.columns.actions'),
    }), [t]);

    const priorityTabLabel = useCallback((key: ForReviewPriorityFilter) => {
        const label = t(`timeTrackingPage.reports.forReview.priorityFilter.${key}`);
        return t('timeTrackingPage.reports.forReview.priorityFilter.count')
            .replace('{label}', label)
            .replace('{count}', String(priorityTotals[key]));
    }, [priorityTotals, t]);

    const priorityLabels = useMemo(() => ({
        red: t('timeTrackingPage.reports.forReview.priority.red'),
        yellow: t('timeTrackingPage.reports.forReview.priority.yellow'),
        green: t('timeTrackingPage.reports.forReview.priority.green'),
    }), [t]);

    const priorityTitles = useMemo(() => ({
        red: t('timeTrackingPage.reports.forReview.priority.redTitle'),
        yellow: t('timeTrackingPage.reports.forReview.priority.yellowTitle'),
        green: t('timeTrackingPage.reports.forReview.priority.greenTitle'),
    }), [t]);

    const renderTable = (list: PartnerReportConfirmationRequest[]) => (<div className="tt-reports__table-wrap tt-reports__table-wrap--scroll-x tt-partner-confirmed__table-wrap">
        <table className="tt-reports__table tt-partner-confirmed__table tt-partner-confirmed__table--readonly tt-partner-confirmed__table--for-review" aria-label={t('timeTrackingPage.reports.forReview.tableAria')}>
            <thead>
                <tr>
                    <th scope="col">{columnLabels.client}</th>
                    <th scope="col">{columnLabels.project}</th>
                    <th scope="col">{columnLabels.period}</th>
                    <th scope="col">{columnLabels.priority}</th>
                    <th scope="col">{columnLabels.partners}</th>
                    <th scope="col">{columnLabels.createdAt}</th>
                    <th scope="col">{columnLabels.comments}</th>
                    <th scope="col" className="tt-partner-confirmed__th-actions">{columnLabels.actions}</th>
                </tr>
            </thead>
            <tbody>
                {list.map((r) => {
                    const priority = forReviewPriority(r);
                    const canConfirm = user?.id != null && r.pendingPartnerAuthUserIds.includes(user.id);
                    const canDelete = user?.id != null
                        && (r.submittedByAuthUserId === user.id || canViewAll);
                    const allowPriorityEdit = canSetPriority(r);
                    const confirmBusy = confirmBusyId === r.id;
                    const deleteBusy = deleteBusyId === r.id;
                    const priorityBusy = priorityBusyId === r.id;
                    const actionsBusy = confirmBusyId != null || deleteBusyId != null || priorityBusyId != null;
                    const commentsCount = r.commentsCount ?? 0;
                    const commentsPreview = r.lastComment?.text?.trim() || null;
                    const commentsCountLabel = partnerConfirmedCommentsCountLabel(commentsCount, locale, {
                        zero: t('timeTrackingPage.reports.partnerConfirmed.commentsCountZero'),
                        one: t('timeTrackingPage.reports.partnerConfirmed.commentsCountOne'),
                        few: t('timeTrackingPage.reports.partnerConfirmed.commentsCountFew'),
                        many: t('timeTrackingPage.reports.partnerConfirmed.commentsCountMany'),
                    });
                    const openRow = () => openReportPreviewForRow(r);
                    return (<tr
                        key={r.id}
                        className="tt-partner-confirmed__row tt-partner-confirmed__row--clickable"
                        tabIndex={0}
                        role="link"
                        title={t('timeTrackingPage.reports.forReview.previewTitle')}
                        onClick={openRow}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openRow();
                            }
                        }}
                    >
                        <td className="tt-partner-confirmed__td-client" data-label={columnLabels.client}>
                          <span className="tt-partner-confirmed__td-client-text">{resolveClientLabel(r)}</span>
                        </td>
                        <td className="tt-partner-confirmed__cell-title tt-partner-confirmed__td-primary" data-label={columnLabels.project}>
                            <span className="tt-partner-confirmed__project-cell">
                                <span className="tt-partner-confirmed__card-client">{resolveClientLabel(r)}</span>
                                <span>{resolveProjectLabel(r)}</span>
                                {partnerReportIsEmpty(r) ? (
                                    <PartnerReportEmptyBadge
                                        label={t('timeTrackingPage.reports.partnerConfirmed.emptyReportBadge')}
                                        title={t('timeTrackingPage.reports.partnerConfirmed.emptyReportTitle')}
                                    />
                                ) : null}
                            </span>
                        </td>
                        <td className="tt-partner-confirmed__td-period" data-label={columnLabels.period}>{formatIsoRangeTitle(r.dateFrom, r.dateTo, { prefix: false, locale: localeTag(locale) })}</td>
                        <td className="tt-partner-confirmed__td-priority" data-label={columnLabels.priority}>
                            {allowPriorityEdit ? (
                                <ForReviewPrioritySelect
                                    value={priority}
                                    disabled={actionsBusy && !priorityBusy}
                                    busy={priorityBusy}
                                    labels={priorityLabels}
                                    titles={priorityTitles}
                                    changeTitle={t('timeTrackingPage.reports.forReview.priorityChangeTitle')}
                                    changeAria={t('timeTrackingPage.reports.forReview.priorityChangeAria')}
                                    busyLabel={t('timeTrackingPage.reports.forReview.priorityChangeBusy')}
                                    onChange={(next) => void changePriority(r, next)}
                                />
                            ) : (
                                <span
                                  className={`tt-for-review__priority-badge tt-for-review__priority-badge--${priority}`}
                                  title={t(`timeTrackingPage.reports.forReview.priority.${priority}Title`)}
                                >
                                    <span className={`tt-for-review__priority-dot tt-for-review__priority-dot--${priority}`} aria-hidden />
                                    {t(`timeTrackingPage.reports.forReview.priority.${priority}`)}
                                </span>
                            )}
                        </td>
                        <td className="tt-partner-confirmed__td-partners" data-label={columnLabels.partners}>
                            <PartnerInitialsCell
                              row={r}
                              usersById={usersById}
                              locale={locale}
                              signedTitle={signedPartnerTitle}
                              pendingTitle={pendingPartnerTitle}
                            />
                        </td>
                        <td className="tt-partner-confirmed__td-nowrap" data-label={columnLabels.createdAt}>{fmtIsoWhen(r.createdAt, locale)}</td>
                        <td
                            className="tt-partner-confirmed__td-comments"
                            data-label={columnLabels.comments}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        >
                            <PartnerConfirmedCommentsCell
                              count={commentsCount}
                              preview={commentsPreview}
                              countLabel={commentsCountLabel}
                              openLabel={t('timeTrackingPage.reports.partnerConfirmed.commentsOpen').replace('{project}', resolveProjectLabel(r))}
                              emptyLabel={t('timeTrackingPage.reports.partnerConfirmed.commentsCountZero')}
                              onOpen={() => openCommentsDrawer(r)}
                              compact
                            />
                        </td>
                        <td
                            className="tt-partner-confirmed__actions-cell tt-partner-confirmed__td-actions"
                            data-label={columnLabels.actions}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        >
                            <div className="tt-partner-confirmed__actions" role="group" aria-label={columnLabels.actions}>
                                <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn tt-partner-confirmed__icon-btn--primary" onClick={() => openReportPreviewForRow(r)} title={t('timeTrackingPage.reports.forReview.previewTitle')} aria-label={t('timeTrackingPage.reports.forReview.previewAria')}>
                                    <IcoEye />
                                </button>
                                {canConfirm ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn" disabled={actionsBusy} onClick={() => void confirmRow(r)} title={confirmBusy ? t('timeTrackingPage.reports.forReview.confirmBusy') : t('timeTrackingPage.reports.forReview.confirmTitle')} aria-label={confirmBusy ? t('timeTrackingPage.reports.forReview.confirmBusyAria') : t('timeTrackingPage.reports.forReview.confirmAria')}>
                                    {confirmBusy ? <IcoSpinner /> : <IcoCheck />}
                                </button>) : null}
                                {canDelete ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn tt-partner-confirmed__icon-btn--danger" disabled={actionsBusy} onClick={() => void deleteRow(r)} title={deleteBusy ? t('timeTrackingPage.reports.forReview.deleteBusy') : t('timeTrackingPage.reports.forReview.deleteTitle')} aria-label={deleteBusy ? t('timeTrackingPage.reports.forReview.deleteBusyAria') : t('timeTrackingPage.reports.forReview.deleteAria')}>
                                    {deleteBusy ? <IcoSpinner /> : <IcoTrash />}
                                </button>) : null}
                            </div>
                        </td>
                    </tr>);
                })}
            </tbody>
        </table>
    </div>);

    return (<div className="tt-partner-confirmed" aria-labelledby="tt-for-review-heading">
        <div className="tt-partner-confirmed__head">
            <div>
                <h2 id="tt-for-review-heading" className="tt-partner-confirmed__title">
                    {t('timeTrackingPage.reports.forReview.title')}
                </h2>
            </div>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" disabled={loading || refreshBusy} onClick={() => void fetchPending({ silent: true })} title={t('timeTrackingPage.reports.forReview.refreshTitle')} aria-label={t('timeTrackingPage.reports.forReview.refreshTitle')}>
                {refreshBusy ? <IcoSpinner /> : <IcoRefresh />}
            </button>
        </div>

        {canViewAll ? (<div className="tt-reports__type-block tt-reports__partner-scope tt-partner-confirmed__scope" role="group" aria-label={t('timeTrackingPage.reports.forReview.listScope.aria')}>
            <p className="tt-reports__type-block-title">{t('timeTrackingPage.reports.forReview.listScope.aria')}</p>
            <div className="tt-reports__type-nav">
                <button type="button" className={`tt-reports__type-tab${effectiveScope === 'mine' ? ' tt-reports__type-tab--active' : ''}`} aria-pressed={effectiveScope === 'mine'} onClick={() => { setListScope('mine'); setPage(1); }}>
                    {t('timeTrackingPage.reports.forReview.listScope.mine')}
                </button>
                <button type="button" className={`tt-reports__type-tab${effectiveScope === 'all' ? ' tt-reports__type-tab--active' : ''}`} aria-pressed={effectiveScope === 'all'} onClick={() => { setListScope('all'); setPage(1); }}>
                    {t('timeTrackingPage.reports.forReview.listScope.all')}
                </button>
            </div>
        </div>) : null}

        <div className="tt-reports__type-block tt-for-review__priority-filters" role="group" aria-label={t('timeTrackingPage.reports.forReview.priorityFilter.aria')}>
            <p className="tt-reports__type-block-title">{t('timeTrackingPage.reports.forReview.priorityFilter.aria')}</p>
            <div className="tt-reports__type-nav">
                <button type="button" className={`tt-reports__type-tab${priorityFilter === 'all' ? ' tt-reports__type-tab--active' : ''}`} aria-pressed={priorityFilter === 'all'} onClick={() => { setPriorityFilter('all'); setPage(1); }}>
                    {priorityTabLabel('all')}
                </button>
                {FOR_REVIEW_PRIORITY_ORDER.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`tt-reports__type-tab${priorityFilter === key ? ' tt-reports__type-tab--active' : ''}`}
                      aria-pressed={priorityFilter === key}
                      onClick={() => { setPriorityFilter(key); setPage(1); }}
                    >
                        <span className={`tt-for-review__priority-dot tt-for-review__priority-dot--${key}`} aria-hidden />
                        {priorityTabLabel(key)}
                    </button>
                ))}
            </div>
        </div>

        <div className="tt-partner-confirmed__toolbar">
            <label className="tt-partner-confirmed__search-label" htmlFor="tt-for-review-search">
                {t('timeTrackingPage.reports.forReview.searchLabel')}
            </label>
            <input id="tt-for-review-search" type="search" className="tt-reports__table-search-input tt-partner-confirmed__search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('timeTrackingPage.reports.forReview.searchPlaceholder')} spellCheck={false} autoComplete="off" disabled={loading} />
            <span className={`tt-partner-confirmed__count${loading ? ' tt-partner-confirmed__count--loading' : ''}`} role="status">
                {loading ? (<>
                    <svg className="tt-partner-confirmed__count-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" opacity="0.22" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    {countLabel}
                </>) : countLabel}
            </span>
            <span className="tt-reports__partner-legend-note">{t('timeTrackingPage.reports.forReview.partnersLegend')}</span>
        </div>

        {error ? (<p className="tt-reports__table-err tt-partner-confirmed__err" role="alert">{error}</p>) : null}

        {loading ? (<PartnerReportsListLoading label={t('timeTrackingPage.reports.forReview.loading')} columns={8} />) : null}

        {!loading && !error && total === 0 ? (<p className="tt-partner-confirmed__empty">{hasActivePriorityFilter
            ? t('timeTrackingPage.reports.forReview.noFilterMatch')
            : effectiveScope === 'all'
                ? t('timeTrackingPage.reports.forReview.emptyAll')
                : t('timeTrackingPage.reports.forReview.empty')}</p>) : null}

        {!loading && !error && total > 0 && filtered.length > 0 ? renderTable(filtered) : null}

        {!loading && filtered.length === 0 && total > 0 ? (<p className="tt-partner-confirmed__empty">{query.trim()
            ? t('timeTrackingPage.reports.forReview.noSearchMatch')
            : hasActivePriorityFilter
                ? t('timeTrackingPage.reports.forReview.noFilterMatch')
                : t('timeTrackingPage.reports.forReview.noSearchMatch')}</p>) : null}

        {!loading && !error && total > FOR_REVIEW_PAGE_SIZE ? (
            <div className="tt-for-review__pager" role="navigation" aria-label={t('timeTrackingPage.reports.forReview.pagerAria')}>
                <button
                  type="button"
                  className="tt-reports__btn tt-reports__btn--outline"
                  disabled={page <= 1 || refreshBusy}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                    {t('timeTrackingPage.reports.forReview.pagerPrev')}
                </button>
                <span className="tt-for-review__pager-status">
                    {t('timeTrackingPage.reports.forReview.pagerStatus')
                        .replace('{page}', String(page))
                        .replace('{pages}', String(pageCount))
                        .replace('{total}', String(total))}
                </span>
                <button
                  type="button"
                  className="tt-reports__btn tt-reports__btn--outline"
                  disabled={page >= pageCount || refreshBusy}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                    {t('timeTrackingPage.reports.forReview.pagerNext')}
                </button>
            </div>
        ) : null}

        <PartnerConfirmedCommentsDrawer open={commentsDrawerRow != null} row={commentsDrawerRow} projectLabel={commentsDrawerRow ? resolveProjectLabel(commentsDrawerRow) : ''} clientLabel={commentsDrawerRow ? resolveClientLabel(commentsDrawerRow) : ''} periodLabel={commentsDrawerRow ? formatIsoRangeTitle(commentsDrawerRow.dateFrom, commentsDrawerRow.dateTo, { prefix: false, locale: localeTag(locale) }) : ''} comments={drawerComments} usersById={usersByIdLabels} locale={locale} draft={commentComposeDraft} onDraftChange={setCommentComposeDraft} onAdd={addCommentForOpenRow} onEdit={editCommentForOpenRow} onClose={closeCommentsDrawer} currentUserId={user?.id ?? null} loading={commentsLoading} submitting={commentsSubmitting} error={commentsError} allowCompose canModerateComments={canViewAll} labels={{
            title: t('timeTrackingPage.reports.partnerConfirmed.commentsDrawerTitle'),
            empty: t('timeTrackingPage.reports.partnerConfirmed.commentsEmpty'),
            loading: t('timeTrackingPage.reports.forReview.loading'),
            composePlaceholder: t('timeTrackingPage.reports.partnerConfirmed.commentsComposePlaceholder'),
            add: t('timeTrackingPage.reports.partnerConfirmed.commentsAdd'),
            close: t('timeTrackingPage.reports.partnerConfirmed.commentsClose'),
            you: t('timeTrackingPage.reports.partnerConfirmed.commentsYou'),
            edit: t('timeTrackingPage.reports.partnerConfirmed.commentsEdit'),
            save: t('timeTrackingPage.reports.partnerConfirmed.commentsSave'),
            cancel: t('timeTrackingPage.reports.partnerConfirmed.commentsCancel'),
            edited: t('timeTrackingPage.reports.partnerConfirmed.commentsEdited'),
        }} />
    </div>);
}
