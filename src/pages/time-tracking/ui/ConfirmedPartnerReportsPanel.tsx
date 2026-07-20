import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    createPartnerConfirmationComment,
    deletePartnerReportConfirmation,
    revokePartnerReportConfirmationSignature,
    getReportSnapshot,
    isForbiddenError,
    fetchAllInvoices,
    listPartnerConfirmationComments,
    listPartnerReportConfirmationsConfirmed,
    listTimeTrackingUsers,
    notifyPartnerConfirmedReportsListInvalidate,
    type InvoiceDto,
    type PartnerConfirmedReportComment,
    type PartnerReportConfirmationRequest,
    type TimeTrackingUserRow,
    type TimeManagerClientProjectRow,
    PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT,
} from '@entities/time-tracking';
import { formatIsoRangeTitle, formatIsoDateLabel, reportsYearStartIso, reportsYtdRange } from '@entities/time-tracking/lib/reportsPeriodRange';
import {
    buildPartnerReportDisplayMetaFromSnapshot,
    resolvePartnerReportClientLabel,
    resolvePartnerReportDisplayMeta,
    resolvePartnerReportProjectLabel,
    type PartnerReportRowDisplayMeta,
} from '@entities/time-tracking/lib/partnerReportDisplay';
import {
    enrichPartnerReportClientNamesFromRows,
    loadPartnerReportDisplayLookups,
    type PartnerReportClientMeta,
} from '@entities/time-tracking/lib/partnerReportDisplayLookups';
import {
    findInvoiceForPartnerConfirmedRow,
    generateInvoiceFromPartnerConfirmedReport,
    PartnerConfirmedInvoiceMismatchError,
    PartnerConfirmedInvoiceNoLinesError,
} from '@pages/time-tracking/lib/partnerConfirmedInvoice';
import { openConfirmedPartnerReportPreview } from '@pages/time-tracking/lib/partnerReportPreviewNav';
import { exportPartnerConfirmedReportExcel } from '@pages/time-tracking/lib/exportPartnerConfirmedReportExcel';
import {
    applyPartnerConfirmationCommentsSummary,
    hydratePartnerConfirmationCommentsSummaries,
    summarizePartnerConfirmationComments,
} from '@pages/time-tracking/lib/partnerConfirmationCommentsSummary';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { getInvoiceDetailUrl } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { getUsers, type User } from '@entities/user';
import { DatePicker } from '@shared/ui/DatePicker';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useAppDialog } from '@shared/ui';
import { canViewAllForReviewReports } from '@entities/time-tracking/model/timeTrackingAccess';
import {
    PartnerConfirmedCommentsCell,
    PartnerConfirmedCommentsDrawer,
    partnerConfirmedCommentsCountLabel,
} from './PartnerConfirmedCommentsDrawer';
import { PartnerReportEmptyBadge, partnerReportIsEmpty } from './PartnerReportEmptyBadge';
import { PartnerReportsListLoading } from './PartnerReportsListLoading';
import { MonthlyPartnerArchivePanel } from './MonthlyPartnerArchivePanel';
import type { PartnerConfirmedSubview } from '@entities/time-tracking/model/reportsPanelConfig';

type PartnerUserMeta = {
    label: string;
    initials: string | null;
};

function normalizeSystemInitials(raw: string | null | undefined): string | null {
    const stored = (raw ?? '').trim().toUpperCase().replace(/Ё/g, 'Е');
    return stored || null;
}

function partnerInitialsForId(id: number, usersById: Map<number, PartnerUserMeta>): string {
    return usersById.get(id)?.initials ?? '—';
}
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

const IcoDownload = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
</svg>);

const IcoInvoice = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="14" y2="17" />
</svg>);

const IcoSpinner = () => (<svg className="tt-partner-confirmed__btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="10" opacity="0.22" />
    <path d="M12 2a10 10 0 0 1 10 10" />
</svg>);

const IcoTrash = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
</svg>);

function canDeletePartnerConfirmedRow(
    r: PartnerReportConfirmationRequest,
    userId: number | null | undefined,
    canManageAll: boolean,
): boolean {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0)
        return false;
    return Number(r.submittedByAuthUserId) === uid || canManageAll;
}

function canRevokePartnerSignature(
    r: PartnerReportConfirmationRequest,
    partnerAuthUserId: number,
    userId: number | null | undefined,
    canManageAll: boolean,
): boolean {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0)
        return false;
    if (Number(r.submittedByAuthUserId) === uid || canManageAll)
        return true;
    return Number(partnerAuthUserId) === uid;
}

function fmtIsoDateShort(iso: string | null | undefined, locale: 'ru' | 'en'): string {
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

function formatPeriodCompact(from: string, to: string, locale: 'ru' | 'en'): string {
    const tag = localeTag(locale);
    const fmt = (iso: string) => {
        const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
        if (Number.isNaN(d.getTime()))
            return iso.slice(0, 10);
        return d.toLocaleDateString(tag, { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    return `${fmt(from)} – ${fmt(to)}`;
}

const IcoRevoke = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7v6h6" />
        <path d="M3 13a9 9 0 1 0 3-7.7L3 7" />
    </svg>
);

function PartnerSignaturesList({
    signatures,
    usersById,
    locale,
    canRevoke,
    revokeDisabledReason,
    revokeBusyPartnerId,
    revokeTitle,
    revokeAria,
    revokeBusyLabel,
    onRevoke,
}: {
    signatures: PartnerReportConfirmationRequest['signatures'];
    usersById: Map<number, PartnerUserMeta>;
    locale: 'ru' | 'en';
    canRevoke: (partnerAuthUserId: number) => boolean;
    revokeDisabledReason: string | null;
    revokeBusyPartnerId: number | null;
    revokeTitle: (partnerName: string) => string;
    revokeAria: string;
    revokeBusyLabel: string;
    onRevoke: (partnerAuthUserId: number, partnerName: string) => void;
}) {
    if (signatures.length === 0)
        return <span className="tt-partner-confirmed__empty-cell">—</span>;
    return (
        <div className="rp-partner-initials tt-partner-confirmed__sig-compact" role="list">
            {signatures.map((s, i) => {
                const meta = usersById.get(s.partnerAuthUserId);
                const name = meta?.label ?? `ID ${s.partnerAuthUserId}`;
                const initials = partnerInitialsForId(s.partnerAuthUserId, usersById);
                const when = fmtIsoDateShort(s.confirmedAt, locale);
                const chipTitle = initials === '—'
                    ? `${name} · ${when}`
                    : `${initials} · ${name} · ${when}`;
                const showRevoke = canRevoke(s.partnerAuthUserId);
                const busy = revokeBusyPartnerId === s.partnerAuthUserId;
                const blocked = Boolean(revokeDisabledReason);
                const revokeTip = busy
                    ? revokeBusyLabel
                    : blocked
                        ? (revokeDisabledReason ?? '')
                        : revokeTitle(name);
                return (
                    <span
                        key={`${s.partnerAuthUserId}-${s.confirmedAt}-${i}`}
                        role="listitem"
                        className={`tt-partner-confirmed__sig-chip${showRevoke ? ' tt-partner-confirmed__sig-chip--revokable' : ''}`}
                    >
                        <span
                            className="rp-partner-initials__chip rp-partner-initials__chip--signed"
                            title={chipTitle}
                        >
                            {initials}
                        </span>
                        {showRevoke ? (
                            <button
                                type="button"
                                className="tt-partner-confirmed__sig-revoke-icon"
                                disabled={busy || blocked || (revokeBusyPartnerId != null && !busy)}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRevoke(s.partnerAuthUserId, name);
                                }}
                                title={revokeTip}
                                aria-label={busy ? revokeBusyLabel : `${revokeAria}: ${name}`}
                            >
                                {busy ? <IcoSpinner /> : <IcoRevoke />}
                            </button>
                        ) : null}
                    </span>
                );
            })}
        </div>
    );
}

function userLabel(map: Map<number, PartnerUserMeta>, id: number): string {
    return map.get(id)?.label ?? `ID ${id}`;
}

type PartnerFilterItem = {
    id: string;
    name: string;
    search: string;
};

function collectPartnerAuthUserIds(rows: readonly PartnerReportConfirmationRequest[]): number[] {
    const ids = new Set<number>();
    for (const r of rows) {
        for (const id of r.requiredPartnerAuthUserIds)
            ids.add(id);
        for (const id of r.pendingPartnerAuthUserIds)
            ids.add(id);
        for (const s of r.signatures)
            ids.add(s.partnerAuthUserId);
    }
    return [...ids];
}

function rowMatchesPartnerFilter(r: PartnerReportConfirmationRequest, partnerAuthUserId: number): boolean {
    if (r.requiredPartnerAuthUserIds.includes(partnerAuthUserId))
        return true;
    if (r.pendingPartnerAuthUserIds.includes(partnerAuthUserId))
        return true;
    return r.signatures.some((s) => s.partnerAuthUserId === partnerAuthUserId);
}

function isFullyConfirmed(r: PartnerReportConfirmationRequest): boolean {
    return String(r.status || '').trim().toLowerCase() === 'fully_confirmed';
}

export function ConfirmedPartnerReportsPanel({ subView, onSubViewChange, }: {
    subView: PartnerConfirmedSubview;
    onSubViewChange: (next: PartnerConfirmedSubview) => void;
}) {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAppDialog();
    const { t, locale } = useI18n();
    const { user: currentUser } = useCurrentUser();
    const canManageAll = canViewAllForReviewReports(currentUser);
    const defaultRange = useMemo(() => reportsYtdRange(), []);
    const yearStart = useMemo(() => reportsYearStartIso(), []);
    const [filterDateFrom, setFilterDateFrom] = useState(defaultRange.dateFrom);
    const [filterDateTo, setFilterDateTo] = useState(defaultRange.dateTo);
    const [partnerFilterId, setPartnerFilterId] = useState('');
    const [rows, setRows] = useState<PartnerReportConfirmationRequest[]>([]);
    const [archiveRows, setArchiveRows] = useState<PartnerReportConfirmationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [refreshBusy, setRefreshBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [archiveError, setArchiveError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [usersById, setUsersById] = useState<Map<number, PartnerUserMeta>>(new Map());
    const [projectRows, setProjectRows] = useState<TimeManagerClientProjectRow[]>([]);
    const [clientNamesById, setClientNamesById] = useState<Map<string, string>>(new Map());
    const [clientMetaByProjectId, setClientMetaByProjectId] = useState<Map<string, PartnerReportClientMeta>>(new Map());
    const [extraRowMetaByProjectId, setExtraRowMetaByProjectId] = useState<Map<string, PartnerReportRowDisplayMeta>>(new Map());
    const snapshotMetaAttemptedRef = useRef<Set<string>>(new Set());
    const [exportBusySnapshotId, setExportBusySnapshotId] = useState<string | null>(null);
    const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
    const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
    const [revokeBusyKey, setRevokeBusyKey] = useState<string | null>(null);
    const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
    const [drawerComments, setDrawerComments] = useState<PartnerConfirmedReportComment[]>([]);
    const [commentsDrawerRow, setCommentsDrawerRow] = useState<PartnerReportConfirmationRequest | null>(null);
    const [commentComposeDraft, setCommentComposeDraft] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsSubmitting, setCommentsSubmitting] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const commentsHydrateSeqRef = useRef({ rows: 0, archive: 0 });

    const patchRowCommentsSummary = useCallback((requestId: string, comments: PartnerConfirmedReportComment[]) => {
        const summary = summarizePartnerConfirmationComments(comments);
        const patch = (list: PartnerReportConfirmationRequest[]) => list.map((row) => (
            row.id === requestId
                ? applyPartnerConfirmationCommentsSummary(row, summary)
                : row
        ));
        setRows(patch);
        setArchiveRows(patch);
        setCommentsDrawerRow((prev) => (prev && prev.id === requestId
            ? applyPartnerConfirmationCommentsSummary(prev, summary)
            : prev));
    }, []);

    const hydrateCommentsForRows = useCallback((
        list: PartnerReportConfirmationRequest[],
        target: 'rows' | 'archive',
    ) => {
        const seq = ++commentsHydrateSeqRef.current[target];
        void hydratePartnerConfirmationCommentsSummaries(list).then((hydrated) => {
            if (seq !== commentsHydrateSeqRef.current[target])
                return;
            const apply = (prev: PartnerReportConfirmationRequest[]) => {
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
            };
            if (target === 'archive')
                setArchiveRows(apply);
            else
                setRows(apply);
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

    const loadUsers = useCallback(() => {
        void Promise.all([
            listTimeTrackingUsers().catch(() => [] as TimeTrackingUserRow[]),
            getUsers(true).catch(() => [] as User[]),
        ]).then(([ttUsers, authUsers]) => {
            const m = new Map<number, PartnerUserMeta>();
            for (const r of ttUsers) {
                const label = r.display_name?.trim() || r.email?.trim() || `ID ${r.id}`;
                m.set(r.id, { label, initials: normalizeSystemInitials(r.initials) });
            }
            for (const u of authUsers) {
                if (!u.id)
                    continue;
                const label = u.display_name?.trim() || u.email?.trim() || `ID ${u.id}`;
                const initials = normalizeSystemInitials(u.initials);
                const prev = m.get(u.id);
                m.set(u.id, {
                    label: prev?.label || label,
                    initials: initials ?? prev?.initials ?? null,
                });
            }
            setUsersById(m);
        }).catch(() => {
            setUsersById(new Map());
        });
    }, []);

    const usersLabelById = useMemo(() => {
        const m = new Map<number, string>();
        for (const [id, meta] of usersById)
            m.set(id, meta.label);
        return m;
    }, [usersById]);
    const loadMeta = useCallback(() => {
        void loadPartnerReportDisplayLookups().then(({ projectRows: projects, clientNamesById: clientMap, clientMetaByProjectId: projectClientMeta }) => {
            setProjectRows(projects);
            setClientNamesById(clientMap);
            setClientMetaByProjectId(projectClientMeta);
        }).catch(() => {
            setProjectRows([]);
            setClientNamesById(new Map());
            setClientMetaByProjectId(new Map());
        });
    }, []);

    const loadInvoices = useCallback(() => {
        if (!filterDateFrom.trim() || !filterDateTo.trim() || filterDateFrom > filterDateTo)
            return;
        void fetchAllInvoices({
            dateFrom: filterDateFrom,
            dateTo: filterDateTo,
        }).then((items) => {
            setInvoices(Array.isArray(items) ? items : []);
        }).catch(() => {
            setInvoices([]);
        });
    }, [filterDateFrom, filterDateTo]);

    const dateRangeInvalid = Boolean(filterDateFrom && filterDateTo && filterDateFrom > filterDateTo);

    const fetchConfirmed = useCallback(async (opts?: {
        silent?: boolean;
    }) => {
        const silent = opts?.silent === true;
        if (dateRangeInvalid) {
            setRows([]);
            setError(t('timeTrackingPage.reports.partnerConfirmed.filters.invalidRange'));
            setLoading(false);
            setRefreshBusy(false);
            return;
        }
        if (!silent)
            setLoading(true);
        else
            setRefreshBusy(true);
        setError(null);
        try {
            const list = await listPartnerReportConfirmationsConfirmed({
                dateFrom: filterDateFrom.trim() || undefined,
                dateTo: filterDateTo.trim() || undefined,
            });
            const rowsList = Array.isArray(list) ? list : [];
            setRows(rowsList);
            setClientNamesById((prev) => {
                const next = new Map(prev);
                enrichPartnerReportClientNamesFromRows(next, rowsList);
                return next;
            });
            hydrateCommentsForRows(rowsList, 'rows');
        }
        catch (e) {
            setRows([]);
            setError(e instanceof Error ? e.message : t('timeTrackingPage.reports.partnerConfirmed.loadFailed'));
        }
        finally {
            if (!silent)
                setLoading(false);
            else
                setRefreshBusy(false);
        }
    }, [dateRangeInvalid, filterDateFrom, filterDateTo, hydrateCommentsForRows, t]);

    const fetchArchive = useCallback(async () => {
        setArchiveLoading(true);
        setArchiveError(null);
        try {
            const list = await listPartnerReportConfirmationsConfirmed({ before: yearStart });
            const rowsList = Array.isArray(list) ? list : [];
            setArchiveRows(rowsList);
            setClientNamesById((prev) => {
                const next = new Map(prev);
                enrichPartnerReportClientNamesFromRows(next, rowsList);
                return next;
            });
            hydrateCommentsForRows(rowsList, 'archive');
        }
        catch (e) {
            setArchiveRows([]);
            setArchiveError(e instanceof Error ? e.message : t('timeTrackingPage.reports.partnerConfirmed.loadFailed'));
        }
        finally {
            setArchiveLoading(false);
        }
    }, [hydrateCommentsForRows, t, yearStart]);

    useEffect(() => {
        loadUsers();
        loadMeta();
        loadInvoices();
    }, [loadUsers, loadMeta, loadInvoices]);

    useEffect(() => {
        void fetchConfirmed();
    }, [fetchConfirmed]);

    useEffect(() => {
        const onInv = () => {
            void fetchConfirmed({ silent: true });
            loadInvoices();
            if (archiveOpen)
                void fetchArchive();
        };
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
    }, [fetchConfirmed, fetchArchive, archiveOpen, loadInvoices]);

    useEffect(() => {
        if (!archiveOpen)
            return;
        void fetchArchive();
    }, [archiveOpen, fetchArchive]);

    useEffect(() => {
        const allRows = [...rows, ...archiveRows];
        const pending = allRows.filter((row) => {
            if (!row.snapshotId.trim())
                return false;
            if (snapshotMetaAttemptedRef.current.has(row.projectId))
                return false;
            const meta = resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
            return !meta.projectName || !meta.clientName;
        });
        if (pending.length === 0)
            return;
        let cancelled = false;
        void (async () => {
            const updates = new Map<string, PartnerReportRowDisplayMeta>();
            await Promise.all(pending.map(async (row) => {
                snapshotMetaAttemptedRef.current.add(row.projectId);
                if (updates.has(row.projectId))
                    return;
                try {
                    const snapshot = await getReportSnapshot(row.snapshotId);
                    updates.set(row.projectId, buildPartnerReportDisplayMetaFromSnapshot(snapshot, row));
                }
                catch {
                }
            }));
            if (cancelled || updates.size === 0)
                return;
            setExtraRowMetaByProjectId((prev) => {
                const next = new Map(prev);
                for (const [projectId, meta] of updates) {
                    if (!next.has(projectId))
                        next.set(projectId, meta);
                }
                return next;
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [archiveRows, clientMetaByProjectId, clientNamesById, projectRows, rows]);

    const resolveProjectLabel = useCallback((r: PartnerReportConfirmationRequest) => {
        return resolvePartnerReportProjectLabel(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows]);

    const resolveClientLabel = useCallback((r: PartnerReportConfirmationRequest) => {
        return resolvePartnerReportClientLabel(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows]);

    const filterRows = useCallback((source: PartnerReportConfirmationRequest[]) => {
        const partnerId = partnerFilterId.trim() ? Number(partnerFilterId) : null;
        const q = query.trim().toLowerCase();
        return source.filter((r) => {
            if (partnerId != null && Number.isFinite(partnerId) && !rowMatchesPartnerFilter(r, partnerId))
                return false;
            if (!q)
                return true;
            const pendingNames = r.pendingPartnerAuthUserIds.map((id) => userLabel(usersById, id));
            const partnerInitials = [
                ...r.requiredPartnerAuthUserIds,
                ...r.signatures.map((s) => s.partnerAuthUserId),
                ...r.pendingPartnerAuthUserIds,
            ].map((id) => partnerInitialsForId(id, usersById));
            const hay = [
                r.title,
                resolveProjectLabel(r),
                resolveClientLabel(r),
                r.lastComment?.text ?? '',
                r.id,
                r.projectId,
                r.snapshotId,
                r.dateFrom,
                r.dateTo,
                r.status,
                String(r.submittedByAuthUserId),
                ...r.requiredPartnerAuthUserIds.map(String),
                ...r.signatures.map((s) => String(s.partnerAuthUserId)),
                ...pendingNames,
                ...partnerInitials,
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [partnerFilterId, query, resolveClientLabel, resolveProjectLabel, usersById]);

    const filtered = useMemo(() => filterRows(rows), [filterRows, rows]);
    const filteredArchive = useMemo(() => filterRows(archiveRows), [filterRows, archiveRows]);
    const hasActiveFilters = Boolean(query.trim() || partnerFilterId.trim());

    const partnerFilterItems = useMemo((): PartnerFilterItem[] => {
        const allOpt: PartnerFilterItem = {
            id: '',
            name: t('timeTrackingPage.reports.partnerConfirmed.filters.allPartners'),
            search: t('timeTrackingPage.reports.partnerConfirmed.filters.allPartners'),
        };
        const ids = collectPartnerAuthUserIds([...rows, ...archiveRows]);
        const collator = new Intl.Collator(localeTag(locale));
        ids.sort((a, b) => collator.compare(userLabel(usersById, a), userLabel(usersById, b)));
        return [
            allOpt,
            ...ids.map((id) => {
                const name = userLabel(usersById, id);
                const initials = partnerInitialsForId(id, usersById);
                return { id: String(id), name, search: `${name} ${initials} ${id}` };
            }),
        ];
    }, [archiveRows, locale, rows, t, usersById]);

    const openReportPreviewForRow = useCallback((r: PartnerReportConfirmationRequest) => {
        void openConfirmedPartnerReportPreview(r, navigate);
    }, [navigate]);

    const openInvoiceForRow = useCallback((invoiceId: string) => {
        navigate(getInvoiceDetailUrl(invoiceId));
    }, [navigate]);

    const generateInvoiceForRow = useCallback(async (r: PartnerReportConfirmationRequest) => {
        const existing = findInvoiceForPartnerConfirmedRow(r, invoices);
        if (existing) {
            openInvoiceForRow(existing.id);
            return;
        }
        if (!isFullyConfirmed(r)) {
            await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.invoicePartialBlocked') });
            return;
        }
        const clientId = resolvePartnerReportDisplayMeta(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId).clientId;
        if (!clientId.trim()) {
            await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.invoiceNoClient') });
            return;
        }
        setInvoiceBusyId(r.id);
        try {
            const created = await generateInvoiceFromPartnerConfirmedReport({ row: r, clientId });
            loadInvoices();
            openInvoiceForRow(created.id);
        }
        catch (e) {
            if (e instanceof PartnerConfirmedInvoiceNoLinesError) {
                await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.invoiceNoLines') });
                return;
            }
            if (e instanceof PartnerConfirmedInvoiceMismatchError) {
                await showAlert({
                    message: `${t('timeTrackingPage.reports.partnerConfirmed.invoiceFailed')}: ${e.message}`,
                });
                return;
            }
            const base = e instanceof Error ? e.message : t('timeTrackingPage.reports.partnerConfirmed.invoiceFailed');
            const hint = isForbiddenError(e)
                ? t('timeTrackingPage.invoices.errors.partnerConfirmHint')
                : '';
            await showAlert({ message: `${base}${hint}` });
        }
        finally {
            setInvoiceBusyId(null);
        }
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, invoices, loadInvoices, openInvoiceForRow, projectRows, showAlert, t]);

    const exportSnapshotExcel = useCallback(async (r: PartnerReportConfirmationRequest) => {
        setExportBusySnapshotId(r.snapshotId.trim() || r.id);
        try {
            await exportPartnerConfirmedReportExcel(r);
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.partnerConfirmed.exportFailed'),
            });
        }
        finally {
            setExportBusySnapshotId(null);
        }
    }, [showAlert, t]);

    const deleteRow = useCallback(async (r: PartnerReportConfirmationRequest) => {
        const uid = currentUser?.id;
        if (uid == null || deleteBusyId != null || invoiceBusyId != null || exportBusySnapshotId != null)
            return;
        if (!canDeletePartnerConfirmedRow(r, uid, canManageAll))
            return;
        const linkedInvoice = findInvoiceForPartnerConfirmedRow(r, invoices);
        if (linkedInvoice)
            return;
        const ok = await showConfirm({
            title: t('timeTrackingPage.reports.partnerConfirmed.deleteConfirmTitle'),
            message: t('timeTrackingPage.reports.partnerConfirmed.deleteConfirmMessage'),
            confirmLabel: t('timeTrackingPage.reports.partnerConfirmed.deleteConfirmLabel'),
            variant: 'danger',
        });
        if (!ok)
            return;
        setDeleteBusyId(r.id);
        try {
            await deletePartnerReportConfirmation(r.id);
            notifyPartnerConfirmedReportsListInvalidate();
            if (commentsDrawerRow?.id === r.id)
                closeCommentsDrawer();
            await fetchConfirmed({ silent: true });
            if (archiveOpen)
                await fetchArchive();
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.partnerConfirmed.deleteFailed'),
            });
        }
        finally {
            setDeleteBusyId(null);
        }
    }, [
        archiveOpen,
        canManageAll,
        closeCommentsDrawer,
        commentsDrawerRow?.id,
        currentUser?.id,
        deleteBusyId,
        exportBusySnapshotId,
        fetchArchive,
        fetchConfirmed,
        invoiceBusyId,
        invoices,
        showAlert,
        showConfirm,
        t,
    ]);

    const revokeSignature = useCallback(async (
        r: PartnerReportConfirmationRequest,
        partnerAuthUserId: number,
        partnerName: string,
    ) => {
        const uid = currentUser?.id;
        if (uid == null || revokeBusyKey != null || deleteBusyId != null || invoiceBusyId != null)
            return;
        if (!canRevokePartnerSignature(r, partnerAuthUserId, uid, canManageAll))
            return;
        const linkedInvoice = findInvoiceForPartnerConfirmedRow(r, invoices);
        if (linkedInvoice) {
            await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureBlockedInvoice') });
            return;
        }
        const ok = await showConfirm({
            title: t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureConfirmTitle'),
            message: t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureConfirmMessage').replace('{name}', partnerName),
            confirmLabel: t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureConfirmLabel'),
            variant: 'danger',
        });
        if (!ok)
            return;
        const busyKey = `${r.id}:${partnerAuthUserId}`;
        setRevokeBusyKey(busyKey);
        try {
            const updated = await revokePartnerReportConfirmationSignature(r.id, partnerAuthUserId);
            notifyPartnerConfirmedReportsListInvalidate();
            const patch = (list: PartnerReportConfirmationRequest[]) => list.map((row) => (
                row.id === updated.id ? updated : row
            ));
            setRows(patch);
            setArchiveRows(patch);
            setCommentsDrawerRow((prev) => (prev && prev.id === updated.id ? updated : prev));
            await fetchConfirmed({ silent: true });
            if (archiveOpen)
                await fetchArchive();
        }
        catch (e) {
            const forbidden = isForbiddenError(e);
            await showAlert({
                message: forbidden
                    ? t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureForbidden')
                    : (e instanceof Error ? e.message : t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureFailed')),
            });
        }
        finally {
            setRevokeBusyKey(null);
        }
    }, [
        archiveOpen,
        canManageAll,
        currentUser?.id,
        deleteBusyId,
        fetchArchive,
        fetchConfirmed,
        invoiceBusyId,
        invoices,
        revokeBusyKey,
        showAlert,
        showConfirm,
        t,
    ]);

    const countLabel = loading
        ? t('timeTrackingPage.reports.partnerConfirmed.loading')
        : t('timeTrackingPage.reports.partnerConfirmed.count')
            .replace('{filtered}', String(filtered.length))
            .replace('{total}', String(rows.length));

    const ytdHeading = filterDateFrom.trim() && filterDateTo.trim()
        ? t('timeTrackingPage.reports.partnerConfirmed.ytdHeading')
            .replace('{from}', formatIsoDateLabel(filterDateFrom, localeTag(locale)))
            .replace('{to}', formatIsoDateLabel(filterDateTo, localeTag(locale)))
        : t('timeTrackingPage.reports.partnerConfirmed.filters.period');

    const columnLabels = useMemo(() => ({
        client: t('timeTrackingPage.reports.partnerConfirmed.columns.client'),
        project: t('timeTrackingPage.reports.partnerConfirmed.columns.project'),
        period: t('timeTrackingPage.reports.partnerConfirmed.columns.period'),
        partners: t('timeTrackingPage.reports.partnerConfirmed.columns.partners'),
        comments: t('timeTrackingPage.reports.partnerConfirmed.columns.comments'),
        actions: t('timeTrackingPage.reports.partnerConfirmed.columns.actions'),
    }), [t]);

    const renderTable = (list: PartnerReportConfirmationRequest[]) => (<div className="tt-reports__table-wrap tt-reports__table-wrap--scroll-x tt-partner-confirmed__table-wrap">
        <table className="tt-reports__table tt-partner-confirmed__table tt-partner-confirmed__table--readonly tt-partner-confirmed__table--confirmed" aria-label={t('timeTrackingPage.reports.partnerConfirmed.tableAria')}>
            <thead>
                <tr>
                    <th scope="col">{columnLabels.client}</th>
                    <th scope="col">{columnLabels.project}</th>
                    <th scope="col">{columnLabels.period}</th>
                    <th scope="col">{columnLabels.partners}</th>
                    <th scope="col">{columnLabels.comments}</th>
                    <th scope="col" className="tt-partner-confirmed__th-actions">{columnLabels.actions}</th>
                </tr>
            </thead>
            <tbody>
                {list.map((r) => {
                    const commentsCount = r.commentsCount ?? 0;
                    const commentsPreview = r.lastComment?.text?.trim() || null;
                    const commentsCountLabel = partnerConfirmedCommentsCountLabel(commentsCount, locale, {
                        zero: t('timeTrackingPage.reports.partnerConfirmed.commentsCountZero'),
                        one: t('timeTrackingPage.reports.partnerConfirmed.commentsCountOne'),
                        few: t('timeTrackingPage.reports.partnerConfirmed.commentsCountFew'),
                        many: t('timeTrackingPage.reports.partnerConfirmed.commentsCountMany'),
                    });
                    const linkedInvoice = findInvoiceForPartnerConfirmedRow(r, invoices);
                    const invoiceBusy = invoiceBusyId === r.id;
                    const canGenerateInvoice = isFullyConfirmed(r);
                    const canDelete = canDeletePartnerConfirmedRow(r, currentUser?.id, canManageAll);
                    const deleteBusy = deleteBusyId === r.id;
                    const actionsBusy = deleteBusyId != null || invoiceBusyId != null || exportBusySnapshotId != null || revokeBusyKey != null;
                    const deleteBlockedByInvoice = Boolean(linkedInvoice);
                    const revokeBlockedByInvoice = Boolean(linkedInvoice);
                    const rowRevokeBusyPartnerId = revokeBusyKey?.startsWith(`${r.id}:`)
                        ? Number(revokeBusyKey.slice(r.id.length + 1))
                        : null;
                    const deleteTitle = !canDelete
                        ? t('timeTrackingPage.reports.partnerConfirmed.deleteForbidden')
                        : deleteBlockedByInvoice
                            ? t('timeTrackingPage.reports.partnerConfirmed.deleteBlockedInvoice')
                            : deleteBusy
                                ? t('timeTrackingPage.reports.partnerConfirmed.deleteBusy')
                                : t('timeTrackingPage.reports.partnerConfirmed.deleteTitle');
                    const deleteAria = deleteBusy
                        ? t('timeTrackingPage.reports.partnerConfirmed.deleteBusyAria')
                        : deleteTitle;
                    const invoiceTitle = linkedInvoice
                        ? t('timeTrackingPage.reports.partnerConfirmed.invoiceOpenTitle')
                        : invoiceBusy
                            ? t('timeTrackingPage.reports.partnerConfirmed.invoiceBusy')
                            : canGenerateInvoice
                                ? t('timeTrackingPage.reports.partnerConfirmed.invoiceGenerateTitle')
                                : t('timeTrackingPage.reports.partnerConfirmed.invoicePartialBlocked');
                    const invoiceAria = linkedInvoice
                        ? t('timeTrackingPage.reports.partnerConfirmed.invoiceOpenAria')
                        : invoiceBusy
                            ? t('timeTrackingPage.reports.partnerConfirmed.invoiceBusyAria')
                            : canGenerateInvoice
                                ? t('timeTrackingPage.reports.partnerConfirmed.invoiceGenerateAria')
                                : t('timeTrackingPage.reports.partnerConfirmed.invoicePartialBlocked');
                    return (<tr key={r.id}>
                    <td className="tt-partner-confirmed__td-client" data-label={columnLabels.client}>{resolveClientLabel(r)}</td>
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
                    <td className="tt-partner-confirmed__td-period" data-label={columnLabels.period} title={formatIsoRangeTitle(r.dateFrom, r.dateTo, { prefix: false, locale: localeTag(locale) })}>
                        {formatPeriodCompact(r.dateFrom, r.dateTo, locale)}
                    </td>
                    <td className="tt-partner-confirmed__cell-multiline tt-partner-confirmed__td-partners" data-label={columnLabels.partners}>
                        <PartnerSignaturesList
                            signatures={r.signatures}
                            usersById={usersById}
                            locale={locale}
                            canRevoke={(partnerAuthUserId) => canRevokePartnerSignature(r, partnerAuthUserId, currentUser?.id, canManageAll)}
                            revokeDisabledReason={revokeBlockedByInvoice
                                ? t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureBlockedInvoice')
                                : null}
                            revokeBusyPartnerId={Number.isFinite(rowRevokeBusyPartnerId) ? rowRevokeBusyPartnerId : null}
                            revokeTitle={(name) => t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureTitle').replace('{name}', name)}
                            revokeAria={t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureAria')}
                            revokeBusyLabel={t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureBusy')}
                            onRevoke={(partnerAuthUserId, partnerName) => {
                                void revokeSignature(r, partnerAuthUserId, partnerName);
                            }}
                        />
                    </td>
                    <td className="tt-partner-confirmed__td-comments" data-label={columnLabels.comments}>
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
                    <td className="tt-partner-confirmed__actions-cell tt-partner-confirmed__td-actions" data-label={columnLabels.actions}>
                        <div className="tt-partner-confirmed__actions" role="group" aria-label={columnLabels.actions}>
                            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn tt-partner-confirmed__icon-btn--primary" onClick={() => openReportPreviewForRow(r)} title={t('timeTrackingPage.reports.partnerConfirmed.previewTitle')} aria-label={t('timeTrackingPage.reports.partnerConfirmed.previewAria')}>
                                <IcoEye />
                            </button>
                            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn" disabled={exportBusySnapshotId === r.snapshotId} onClick={() => void exportSnapshotExcel(r)} title={exportBusySnapshotId === r.snapshotId ? t('timeTrackingPage.reports.partnerConfirmed.exportBusy') : t('timeTrackingPage.reports.partnerConfirmed.exportTitle')} aria-label={exportBusySnapshotId === r.snapshotId ? t('timeTrackingPage.reports.partnerConfirmed.exportBusyAria') : t('timeTrackingPage.reports.partnerConfirmed.exportAria')}>
                                {exportBusySnapshotId === r.snapshotId ? <IcoSpinner /> : <IcoDownload />}
                            </button>
                            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn" disabled={invoiceBusy || (!linkedInvoice && !canGenerateInvoice)} onClick={() => void generateInvoiceForRow(r)} title={invoiceTitle} aria-label={invoiceAria}>
                                {invoiceBusy ? <IcoSpinner /> : <IcoInvoice />}
                            </button>
                            {canDelete ? (
                                <button
                                    type="button"
                                    className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn tt-partner-confirmed__icon-btn--danger"
                                    disabled={actionsBusy || deleteBlockedByInvoice}
                                    onClick={() => void deleteRow(r)}
                                    title={deleteTitle}
                                    aria-label={deleteAria}
                                >
                                    {deleteBusy ? <IcoSpinner /> : <IcoTrash />}
                                </button>
                            ) : null}
                        </div>
                    </td>
                </tr>);
                })}
            </tbody>
        </table>
    </div>);

    return (<div className="tt-partner-confirmed" aria-labelledby="tt-partner-confirmed-heading">
        <div className="tt-partner-confirmed__head">
            <div>
                <h2 id="tt-partner-confirmed-heading" className="tt-partner-confirmed__title">
                    {t('timeTrackingPage.reports.partnerConfirmed.title')}
                </h2>
                <p className="tt-partner-confirmed__subtitle">
                    {subView === 'archive'
                        ? t('timeTrackingPage.reports.monthlyArchive.subtitle')
                        : ytdHeading}
                </p>
            </div>
            {subView === 'list' ? (
                <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" disabled={loading || refreshBusy} onClick={() => void fetchConfirmed({ silent: true })} title={t('timeTrackingPage.reports.partnerConfirmed.refreshTitle')} aria-label={t('timeTrackingPage.reports.partnerConfirmed.refreshTitle')}>
                    {refreshBusy ? <IcoSpinner /> : <IcoRefresh />}
                </button>
            ) : null}
        </div>

        <div className="tt-reports__type-block tt-partner-confirmed__scope" role="group" aria-label={t('timeTrackingPage.reports.partnerConfirmed.subView.aria')}>
            <p className="tt-reports__type-block-title">{t('timeTrackingPage.reports.partnerConfirmed.subView.aria')}</p>
            <div className="tt-reports__type-nav">
                <button type="button" className={`tt-reports__type-tab${subView === 'list' ? ' tt-reports__type-tab--active' : ''}`} aria-pressed={subView === 'list'} onClick={() => onSubViewChange('list')}>
                    {t('timeTrackingPage.reports.partnerConfirmed.subView.list')}
                </button>
                <button type="button" className={`tt-reports__type-tab${subView === 'archive' ? ' tt-reports__type-tab--active' : ''}`} aria-pressed={subView === 'archive'} onClick={() => onSubViewChange('archive')}>
                    {t('timeTrackingPage.reports.partnerConfirmed.subView.archive')}
                </button>
            </div>
        </div>

        {subView === 'archive' ? (
            <MonthlyPartnerArchivePanel embedded />
        ) : (<>
        <div className="tt-partner-confirmed__filters">
            <div className="tt-partner-confirmed__filter-group">
                <span className="tt-partner-confirmed__filter-label">{t('timeTrackingPage.reports.partnerConfirmed.filters.period')}</span>
                <div className="tt-partner-confirmed__filter-dates-row">
                    <span className="tt-partner-confirmed__filter-date-label">{t('timeTrackingPage.reports.partnerConfirmed.filters.dateFrom')}</span>
                    <DatePicker value={filterDateFrom} max={filterDateTo || undefined} onChange={setFilterDateFrom} emptyLabel={t('timeTrackingPage.reports.partnerConfirmed.filters.dateEmpty')} portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title={t('timeTrackingPage.reports.partnerConfirmed.filters.dateFrom')} showChevron />
                    {filterDateFrom ? (<button type="button" className="tt-partner-confirmed__filter-date-clear" onClick={() => setFilterDateFrom('')} aria-label={t('timeTrackingPage.reports.partnerConfirmed.filters.clearDateFrom')} title={t('timeTrackingPage.reports.partnerConfirmed.filters.reset')}>
                        ×
                    </button>) : null}
                    <span className="tt-partner-confirmed__filter-date-sep" aria-hidden>—</span>
                    <span className="tt-partner-confirmed__filter-date-label">{t('timeTrackingPage.reports.partnerConfirmed.filters.dateTo')}</span>
                    <DatePicker value={filterDateTo} min={filterDateFrom || undefined} onChange={setFilterDateTo} emptyLabel={t('timeTrackingPage.reports.partnerConfirmed.filters.dateEmpty')} portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title={t('timeTrackingPage.reports.partnerConfirmed.filters.dateTo')} showChevron />
                    {filterDateTo ? (<button type="button" className="tt-partner-confirmed__filter-date-clear" onClick={() => setFilterDateTo('')} aria-label={t('timeTrackingPage.reports.partnerConfirmed.filters.clearDateTo')} title={t('timeTrackingPage.reports.partnerConfirmed.filters.reset')}>
                        ×
                    </button>) : null}
                </div>
            </div>
            <div className="tt-partner-confirmed__filter-group tt-partner-confirmed__filter-partner">
                <label className="tt-partner-confirmed__filter-label" htmlFor="tt-partner-confirmed-partner-btn">{t('timeTrackingPage.reports.partnerConfirmed.filters.partner')}</label>
                <SearchableSelect<PartnerFilterItem> className="tsp-srch" buttonClassName="tsp-srch__btn" buttonId="tt-partner-confirmed-partner-btn" portalDropdown portalZIndex={10050} portalMinWidth={280} placeholder={t('timeTrackingPage.reports.partnerConfirmed.filters.allPartners')} emptyListText={t('timeTrackingPage.reports.partnerConfirmed.filters.allPartners')} noMatchText={t('timeTrackingPage.common.notFound')} value={partnerFilterId} items={partnerFilterItems} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.search} onSelect={(o) => setPartnerFilterId(o.id)} aria-label={t('timeTrackingPage.reports.partnerConfirmed.filters.partnerFilterAria')} />
            </div>
        </div>

        <div className="tt-partner-confirmed__toolbar">
            <label className="tt-partner-confirmed__search-label" htmlFor="tt-partner-confirmed-search">
                {t('timeTrackingPage.reports.partnerConfirmed.searchLabel')}
            </label>
            <input id="tt-partner-confirmed-search" type="search" className="tt-reports__table-search-input tt-partner-confirmed__search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('timeTrackingPage.reports.partnerConfirmed.searchPlaceholder')} spellCheck={false} autoComplete="off" disabled={loading} />
            <span className={`tt-partner-confirmed__count${loading ? ' tt-partner-confirmed__count--loading' : ''}`} role="status">
                {loading ? (<>
                    <svg className="tt-partner-confirmed__count-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" opacity="0.22" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    {countLabel}
                </>) : countLabel}
            </span>
        </div>

        {error ? (<p className="tt-reports__table-err tt-partner-confirmed__err" role="alert">{error}</p>) : null}

        {loading ? (<PartnerReportsListLoading label={t('timeTrackingPage.reports.partnerConfirmed.loading')} columns={6} />) : null}

        {!loading && !error && rows.length === 0 ? (<p className="tt-partner-confirmed__empty">{t('timeTrackingPage.reports.partnerConfirmed.empty')}</p>) : null}

        {!loading && !error && rows.length > 0 ? renderTable(filtered) : null}

        {!loading && hasActiveFilters && filtered.length === 0 && rows.length > 0 ? (<p className="tt-partner-confirmed__empty">{t('timeTrackingPage.reports.partnerConfirmed.noFilterMatch')}</p>) : null}

        <div className="tt-partner-confirmed__archive">
            <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setArchiveOpen((v) => !v)} aria-expanded={archiveOpen} disabled={loading}>
                {archiveOpen
                    ? t('timeTrackingPage.reports.partnerConfirmed.archiveHide')
                    : t('timeTrackingPage.reports.partnerConfirmed.archiveToggle').replace('{before}', yearStart)}
            </button>
            {archiveOpen ? (<div className="tt-partner-confirmed__archive-body">
                <h3 className="tt-partner-confirmed__archive-title">
                    {t('timeTrackingPage.reports.partnerConfirmed.archiveHeading').replace('{before}', yearStart)}
                </h3>
                {archiveLoading ? (<PartnerReportsListLoading label={t('timeTrackingPage.reports.partnerConfirmed.loading')} columns={6} />) : null}
                {archiveError ? (<p className="tt-reports__table-err tt-partner-confirmed__err" role="alert">{archiveError}</p>) : null}
                {!archiveLoading && !archiveError && archiveRows.length === 0 ? (<p className="tt-partner-confirmed__empty">{t('timeTrackingPage.reports.partnerConfirmed.archiveEmpty')}</p>) : null}
                {!archiveLoading && !archiveError && archiveRows.length > 0 ? renderTable(filteredArchive) : null}
                {!archiveLoading && hasActiveFilters && filteredArchive.length === 0 && archiveRows.length > 0 ? (<p className="tt-partner-confirmed__empty">{t('timeTrackingPage.reports.partnerConfirmed.noFilterMatch')}</p>) : null}
            </div>) : null}
        </div>

        <PartnerConfirmedCommentsDrawer open={commentsDrawerRow != null} row={commentsDrawerRow} projectLabel={commentsDrawerRow ? resolveProjectLabel(commentsDrawerRow) : ''} clientLabel={commentsDrawerRow ? resolveClientLabel(commentsDrawerRow) : ''} periodLabel={commentsDrawerRow ? formatIsoRangeTitle(commentsDrawerRow.dateFrom, commentsDrawerRow.dateTo, { prefix: false, locale: localeTag(locale) }) : ''} comments={drawerComments} usersById={usersLabelById} locale={locale} draft={commentComposeDraft} onDraftChange={setCommentComposeDraft} onAdd={addCommentForOpenRow} onClose={closeCommentsDrawer} currentUserId={currentUser?.id ?? null} loading={commentsLoading} submitting={commentsSubmitting} error={commentsError} labels={{
            title: t('timeTrackingPage.reports.partnerConfirmed.commentsDrawerTitle'),
            empty: t('timeTrackingPage.reports.partnerConfirmed.commentsEmpty'),
            loading: t('timeTrackingPage.reports.partnerConfirmed.loading'),
            composePlaceholder: t('timeTrackingPage.reports.partnerConfirmed.commentsComposePlaceholder'),
            add: t('timeTrackingPage.reports.partnerConfirmed.commentsAdd'),
            close: t('timeTrackingPage.reports.partnerConfirmed.commentsClose'),
            you: t('timeTrackingPage.reports.partnerConfirmed.commentsYou'),
            composeDisabledPartial: t('timeTrackingPage.reports.partnerConfirmed.commentsComposeDisabledPartial'),
        }} />
        </>)}
    </div>);
}
