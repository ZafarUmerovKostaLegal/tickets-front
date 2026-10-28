import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPartnerConfirmationComment, patchPartnerConfirmationComment, deletePartnerReportConfirmation, revokePartnerReportConfirmationSignature, getReportSnapshot, isForbiddenError, fetchAllInvoices, listPartnerConfirmationComments, listPartnerReportConfirmationsConfirmed, listTimeTrackingUsers, notifyPartnerConfirmedReportsListInvalidate, PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, } from '@entities/time-tracking';
import { formatIsoRangeTitle, formatIsoDateLabel, reportsYearStartIso, reportsYtdRange } from '@entities/time-tracking/lib/reportsPeriodRange';
import { buildPartnerReportDisplayMetaFromSnapshot, resolvePartnerReportClientLabel, resolvePartnerReportDisplayMeta, resolvePartnerReportProjectLabel, } from '@entities/time-tracking/lib/partnerReportDisplay';
import { enrichPartnerReportClientNamesFromRows, loadPartnerReportDisplayLookups, } from '@entities/time-tracking/lib/partnerReportDisplayLookups';
import { findInvoiceForPartnerConfirmedRow, generateCombinedInvoiceFromConfirmedReports, generateInvoiceFromPartnerConfirmedReport, PartnerConfirmedCombinedCurrencyError, invoiceCreatedBeforeAllSignatures, pendingPartnerDisplayNames, PartnerConfirmedInvoiceMismatchError, PartnerConfirmedInvoiceNoLinesError, } from '@pages/time-tracking/lib/partnerConfirmedInvoice';
import { formatUnpaidExpenseListLines, isProjectUnpaidExpensesError, } from '@pages/time-tracking/lib/projectUnpaidExpenses';
import { openConfirmedPartnerReportPreview } from '@pages/time-tracking/lib/partnerReportPreviewNav';
import { exportPartnerConfirmedReportExcel } from '@pages/time-tracking/lib/exportPartnerConfirmedReportExcel';
import { applyPartnerConfirmationCommentsSummary, hydratePartnerConfirmationCommentsSummaries, summarizePartnerConfirmationComments, } from '@pages/time-tracking/lib/partnerConfirmationCommentsSummary';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { getInvoiceDetailUrl } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { getUsers } from '@entities/user';
import { DatePicker } from '@shared/ui/DatePicker';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useAppDialog } from '@shared/ui';
import { canViewAllForReviewReports } from '@entities/time-tracking/model/timeTrackingAccess';
import { PartnerConfirmedCommentsCell, PartnerConfirmedCommentsDrawer, partnerConfirmedCommentsCountLabel, } from './PartnerConfirmedCommentsDrawer';
import { PartnerReportEmptyBadge, partnerReportIsEmpty } from './PartnerReportEmptyBadge';
import { PartnerReportsListLoading } from './PartnerReportsListLoading';
import { MonthlyPartnerArchivePanel } from './MonthlyPartnerArchivePanel';
function normalizeSystemInitials(raw) {
    const stored = (raw ?? '').trim().toUpperCase().replace(/Ё/g, 'Е');
    return stored || null;
}
function partnerInitialsForId(id, usersById) {
    return usersById.get(id)?.initials ?? '—';
}
const IcoRefresh = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }), _jsx("path", { d: "M3 3v5h5" }), _jsx("path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" }), _jsx("path", { d: "M16 21h5v-5" })] }));
const IcoEye = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }));
const IcoDownload = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
const IcoInvoice = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "8", y1: "13", x2: "16", y2: "13" }), _jsx("line", { x1: "8", y1: "17", x2: "14", y2: "17" })] }));
const IcoSpinner = () => (_jsxs("svg", { className: "tt-partner-confirmed__btn-spinner", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10", opacity: "0.22" }), _jsx("path", { d: "M12 2a10 10 0 0 1 10 10" })] }));
const IcoTrash = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }), _jsx("line", { x1: "10", y1: "11", x2: "10", y2: "17" }), _jsx("line", { x1: "14", y1: "11", x2: "14", y2: "17" })] }));
function canDeletePartnerConfirmedRow(r, userId, canManageAll) {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0)
        return false;
    return Number(r.submittedByAuthUserId) === uid || canManageAll;
}
function canRevokePartnerSignature(r, partnerAuthUserId, userId, canManageAll) {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0)
        return false;
    if (Number(r.submittedByAuthUserId) === uid || canManageAll)
        return true;
    return Number(partnerAuthUserId) === uid;
}
function fmtIsoDateShort(iso, locale) {
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
function formatPeriodCompact(from, to, locale) {
    const tag = localeTag(locale);
    const fmt = (iso) => {
        const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
        if (Number.isNaN(d.getTime()))
            return iso.slice(0, 10);
        return d.toLocaleDateString(tag, { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    return `${fmt(from)} – ${fmt(to)}`;
}
const IcoRevoke = () => (_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M3 7v6h6" }), _jsx("path", { d: "M3 13a9 9 0 1 0 3-7.7L3 7" })] }));
function PartnerSignaturesList({ signatures, usersById, locale, canRevoke, revokeDisabledReason, revokeBusyPartnerId, revokeTitle, revokeAria, revokeBusyLabel, onRevoke, }) {
    if (signatures.length === 0)
        return _jsx("span", { className: "tt-partner-confirmed__empty-cell", children: "\u2014" });
    return (_jsx("div", { className: "rp-partner-initials tt-partner-confirmed__sig-compact", role: "list", children: signatures.map((s, i) => {
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
            return (_jsxs("span", { role: "listitem", className: `tt-partner-confirmed__sig-chip${showRevoke ? ' tt-partner-confirmed__sig-chip--revokable' : ''}`, children: [_jsx("span", { className: "rp-partner-initials__chip rp-partner-initials__chip--signed", title: chipTitle, children: initials }), showRevoke ? (_jsx("button", { type: "button", className: "tt-partner-confirmed__sig-revoke-icon", disabled: busy || blocked || (revokeBusyPartnerId != null && !busy), onClick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRevoke(s.partnerAuthUserId, name);
                        }, title: revokeTip, "aria-label": busy ? revokeBusyLabel : `${revokeAria}: ${name}`, children: busy ? _jsx(IcoSpinner, {}) : _jsx(IcoRevoke, {}) })) : null] }, `${s.partnerAuthUserId}-${s.confirmedAt}-${i}`));
        }) }));
}
function userLabel(map, id) {
    return map.get(id)?.label ?? `ID ${id}`;
}
function collectPartnerAuthUserIds(rows) {
    const ids = new Set();
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
function rowMatchesPartnerFilter(r, partnerAuthUserId) {
    if (r.requiredPartnerAuthUserIds.includes(partnerAuthUserId))
        return true;
    if (r.pendingPartnerAuthUserIds.includes(partnerAuthUserId))
        return true;
    return r.signatures.some((s) => s.partnerAuthUserId === partnerAuthUserId);
}
function isFullyConfirmed(r) {
    return String(r.status || '').trim().toLowerCase() === 'fully_confirmed';
}
export function ConfirmedPartnerReportsPanel({ subView, onSubViewChange, }) {
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
    const [rows, setRows] = useState([]);
    const [archiveRows, setArchiveRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [refreshBusy, setRefreshBusy] = useState(false);
    const [error, setError] = useState(null);
    const [archiveError, setArchiveError] = useState(null);
    const [query, setQuery] = useState('');
    const [usersById, setUsersById] = useState(new Map());
    const [projectRows, setProjectRows] = useState([]);
    const [clientNamesById, setClientNamesById] = useState(new Map());
    const [clientMetaByProjectId, setClientMetaByProjectId] = useState(new Map());
    const [extraRowMetaByProjectId, setExtraRowMetaByProjectId] = useState(new Map());
    const snapshotMetaAttemptedRef = useRef(new Set());
    const [exportBusySnapshotId, setExportBusySnapshotId] = useState(null);
    const [invoiceBusyId, setInvoiceBusyId] = useState(null);
    const [combinedBusy, setCombinedBusy] = useState(false);
    const [selectedReportIds, setSelectedReportIds] = useState(() => new Set());
    const [trackingUsers, setTrackingUsers] = useState([]);
    const [deleteBusyId, setDeleteBusyId] = useState(null);
    const [revokeBusyKey, setRevokeBusyKey] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [drawerComments, setDrawerComments] = useState([]);
    const [commentsDrawerRow, setCommentsDrawerRow] = useState(null);
    const [commentComposeDraft, setCommentComposeDraft] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsSubmitting, setCommentsSubmitting] = useState(false);
    const [commentsError, setCommentsError] = useState(null);
    const commentsHydrateSeqRef = useRef({ rows: 0, archive: 0 });
    const patchRowCommentsSummary = useCallback((requestId, comments) => {
        const summary = summarizePartnerConfirmationComments(comments);
        const patch = (list) => list.map((row) => (row.id === requestId
            ? applyPartnerConfirmationCommentsSummary(row, summary)
            : row));
        setRows(patch);
        setArchiveRows(patch);
        setCommentsDrawerRow((prev) => (prev && prev.id === requestId
            ? applyPartnerConfirmationCommentsSummary(prev, summary)
            : prev));
    }, []);
    const hydrateCommentsForRows = useCallback((list, target) => {
        const seq = ++commentsHydrateSeqRef.current[target];
        void hydratePartnerConfirmationCommentsSummaries(list).then((hydrated) => {
            if (seq !== commentsHydrateSeqRef.current[target])
                return;
            const apply = (prev) => {
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
    const openCommentsDrawer = useCallback((row) => {
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
            .catch((e) => {
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
        catch (e) {
            const msg = e instanceof Error && e.message.trim()
                ? e.message
                : t('timeTrackingPage.reports.partnerConfirmed.commentsSaveError');
            setCommentsError(msg);
        }
        finally {
            setCommentsSubmitting(false);
        }
    }, [commentComposeDraft, commentsDrawerRow, commentsSubmitting, drawerComments, patchRowCommentsSummary, t]);
    const editCommentForOpenRow = useCallback(async (commentId, text) => {
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
        catch (e) {
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
    const loadUsers = useCallback(() => {
        void Promise.all([
            listTimeTrackingUsers().catch(() => []),
            getUsers(true).catch(() => []),
        ]).then(([ttUsers, authUsers]) => {
            setTrackingUsers(ttUsers);
            const m = new Map();
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
        const m = new Map();
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
    const fetchConfirmed = useCallback(async (opts) => {
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
            const sid = row.snapshotId.trim();
            if (!sid)
                return false;
            if (snapshotMetaAttemptedRef.current.has(sid))
                return false;
            const meta = resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
            return !meta.projectName || !meta.clientName;
        });
        if (pending.length === 0)
            return;
        let cancelled = false;
        void (async () => {
            const updates = new Map();
            await Promise.all(pending.map(async (row) => {
                const sid = row.snapshotId.trim();
                snapshotMetaAttemptedRef.current.add(sid);
                if (updates.has(row.projectId))
                    return;
                try {
                    const snapshot = await getReportSnapshot(sid);
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
    }, [archiveRows, clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows, rows]);
    const resolveProjectLabel = useCallback((r) => {
        return resolvePartnerReportProjectLabel(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows]);
    const resolveClientLabel = useCallback((r) => {
        return resolvePartnerReportClientLabel(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows]);
    const filterRows = useCallback((source) => {
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
    const partnerFilterItems = useMemo(() => {
        const allOpt = {
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
    const openReportPreviewForRow = useCallback((r) => {
        void openConfirmedPartnerReportPreview(r, navigate);
    }, [navigate]);
    const openInvoiceForRow = useCallback((invoiceId) => {
        navigate(getInvoiceDetailUrl(invoiceId));
    }, [navigate]);
    const generateInvoiceForRow = useCallback(async (r) => {
        const existing = findInvoiceForPartnerConfirmedRow(r, invoices);
        if (existing) {
            openInvoiceForRow(existing.id);
            return;
        }
        const fullyConfirmed = isFullyConfirmed(r);
        if (!fullyConfirmed) {
            const names = pendingPartnerDisplayNames(r, new Map([...usersById.entries()].map(([id, meta]) => [id, meta.label])));
            const ok = await showConfirm({
                title: t('timeTrackingPage.reports.partnerConfirmed.invoiceExceptionConfirmTitle'),
                message: names
                    ? t('timeTrackingPage.reports.partnerConfirmed.invoiceExceptionConfirmMessage').replace('{names}', names)
                    : t('timeTrackingPage.reports.partnerConfirmed.invoiceExceptionConfirmMessageNone'),
                confirmLabel: t('timeTrackingPage.reports.partnerConfirmed.invoiceExceptionConfirmLabel'),
            });
            if (!ok)
                return;
        }
        const clientId = resolvePartnerReportDisplayMeta(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId).clientId;
        if (!clientId.trim()) {
            await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.invoiceNoClient') });
            return;
        }
        setInvoiceBusyId(r.id);
        try {
            const created = await generateInvoiceFromPartnerConfirmedReport({
                row: r,
                clientId,
                allowUnsignedPartners: !fullyConfirmed,
            });
            loadInvoices();
            openInvoiceForRow(created.id);
        }
        catch (e) {
            if (isProjectUnpaidExpensesError(e)) {
                await showAlert({
                    message: t('timeTrackingPage.reports.partnerConfirmed.invoiceUnpaidExpenses')
                        .replace('{count}', String(e.expenses.length))
                        .replace('{list}', formatUnpaidExpenseListLines(e.expenses)),
                });
                return;
            }
            const unpaidMsg = e instanceof Error ? e.message : '';
            if (/неоплаченн|unpaid|PROJECT_UNPAID_EXPENSES/i.test(unpaidMsg)) {
                await showAlert({ message: unpaidMsg });
                return;
            }
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
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, invoices, loadInvoices, openInvoiceForRow, projectRows, showAlert, showConfirm, t, usersById]);
    const selectedRows = useMemo(() => rows.filter((row) => selectedReportIds.has(row.id)), [rows, selectedReportIds]);
    const combineClients = useMemo(() => {
        const seen = new Map();
        for (const row of selectedRows) {
            const meta = resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
            const clientId = meta.clientId.trim();
            if (!clientId || seen.has(clientId))
                continue;
            seen.set(clientId, resolveClientLabel(row));
        }
        return [...seen.entries()].map(([id, name]) => ({ id, name }));
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows, resolveClientLabel, selectedRows]);
    const toggleReportSelected = useCallback((id) => {
        setSelectedReportIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }, []);
    const toggleVisibleReports = useCallback((list, on) => {
        setSelectedReportIds((prev) => {
            const next = new Set(prev);
            for (const row of list) {
                if (on)
                    next.add(row.id);
                else
                    next.delete(row.id);
            }
            return next;
        });
    }, []);
    const createCombinedInvoice = useCallback(async () => {
        if (selectedRows.length < 2 || combinedBusy)
            return;
        const payer = combineClients[0];
        if (!payer) {
            await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.invoiceNoClient') });
            return;
        }
        const ok = await showConfirm({
            title: t('timeTrackingPage.reports.partnerConfirmed.combineConfirmTitle'),
            message: t('timeTrackingPage.reports.partnerConfirmed.combineConfirmMessage')
                .replace('{count}', String(selectedRows.length))
                .replace('{payer}', payer.name),
            confirmLabel: t('timeTrackingPage.reports.partnerConfirmed.combineConfirmLabel'),
        });
        if (!ok)
            return;
        setCombinedBusy(true);
        try {
            const projectMeta = selectedRows.flatMap((row) => {
                const projectId = String(row.projectId ?? '').trim();
                if (!projectId)
                    return [];
                const meta = resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
                return [{
                        id: projectId,
                        name: resolveProjectLabel(row),
                        clientId: meta.clientId.trim() || payer.id,
                        clientName: resolveClientLabel(row),
                    }];
            });
            const uniqueProjects = [...new Map(projectMeta.map((project) => [project.id, project])).values()];
            const created = await generateCombinedInvoiceFromConfirmedReports({
                rows: selectedRows,
                payerClientId: payer.id,
                projectMeta: uniqueProjects,
                users: trackingUsers,
            });
            setSelectedReportIds(new Set());
            loadInvoices();
            openInvoiceForRow(created.id);
        }
        catch (e) {
            if (e instanceof PartnerConfirmedCombinedCurrencyError) {
                await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.combineCurrencyMismatch') });
                return;
            }
            if (isProjectUnpaidExpensesError(e)) {
                await showAlert({
                    message: t('timeTrackingPage.reports.partnerConfirmed.invoiceUnpaidExpenses')
                        .replace('{count}', String(e.expenses.length))
                        .replace('{list}', formatUnpaidExpenseListLines(e.expenses)),
                });
                return;
            }
            if (e instanceof PartnerConfirmedInvoiceNoLinesError) {
                await showAlert({ message: t('timeTrackingPage.reports.partnerConfirmed.combineNoLines') });
                return;
            }
            const base = e instanceof Error ? e.message : t('timeTrackingPage.reports.partnerConfirmed.combineFailed');
            await showAlert({ message: base });
        }
        finally {
            setCombinedBusy(false);
        }
    }, [clientMetaByProjectId, clientNamesById, combineClients, combinedBusy, extraRowMetaByProjectId, loadInvoices, openInvoiceForRow, projectRows, resolveClientLabel, resolveProjectLabel, selectedRows, showAlert, showConfirm, t, trackingUsers]);
    const exportSnapshotExcel = useCallback(async (r) => {
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
    const deleteRow = useCallback(async (r) => {
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
    const revokeSignature = useCallback(async (r, partnerAuthUserId, partnerName) => {
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
            const patch = (list) => list.map((row) => (row.id === updated.id ? updated : row));
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
    const renderTable = (list, selectable = false) => {
        const selectedVisible = selectable ? list.filter((row) => selectedReportIds.has(row.id)).length : 0;
        const allVisibleSelected = selectable && list.length > 0 && selectedVisible === list.length;
        return (_jsx("div", { className: "tt-reports__table-wrap tt-reports__table-wrap--scroll-x tt-partner-confirmed__table-wrap", children: _jsxs("table", { className: `tt-reports__table tt-partner-confirmed__table tt-partner-confirmed__table--readonly tt-partner-confirmed__table--confirmed${selectable ? ' tt-partner-confirmed__table--selectable' : ''}`, "aria-label": t('timeTrackingPage.reports.partnerConfirmed.tableAria'), children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: columnLabels.client }), _jsx("th", { scope: "col", children: columnLabels.project }), _jsx("th", { scope: "col", children: columnLabels.period }), _jsx("th", { scope: "col", children: columnLabels.partners }), _jsx("th", { scope: "col", children: columnLabels.comments }), _jsx("th", { scope: "col", className: "tt-partner-confirmed__th-actions", children: _jsxs("span", { className: "tt-partner-confirmed__actions-head", children: [selectable ? (_jsx("label", { className: "tt-partner-confirmed__row-check-btn", children: _jsx("input", { className: "tt-partner-confirmed__row-check", type: "checkbox", checked: allVisibleSelected, ref: (el) => {
                                                        if (el)
                                                            el.indeterminate = selectedVisible > 0 && !allVisibleSelected;
                                                    }, onChange: () => toggleVisibleReports(list, !allVisibleSelected), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.combineSelectAll') }) })) : null, _jsx("span", { children: columnLabels.actions })] }) })] }) }), _jsx("tbody", { children: list.map((r) => {
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
                            const fullyConfirmed = isFullyConfirmed(r);
                            const canDelete = canDeletePartnerConfirmedRow(r, currentUser?.id, canManageAll);
                            const deleteBusy = deleteBusyId === r.id;
                            const actionsBusy = deleteBusyId != null || invoiceBusyId != null || combinedBusy || exportBusySnapshotId != null || revokeBusyKey != null;
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
                                    : fullyConfirmed
                                        ? t('timeTrackingPage.reports.partnerConfirmed.invoiceGenerateTitle')
                                        : t('timeTrackingPage.reports.partnerConfirmed.invoiceUnsignedTitle');
                            const invoiceAria = linkedInvoice
                                ? t('timeTrackingPage.reports.partnerConfirmed.invoiceOpenAria')
                                : invoiceBusy
                                    ? t('timeTrackingPage.reports.partnerConfirmed.invoiceBusyAria')
                                    : fullyConfirmed
                                        ? t('timeTrackingPage.reports.partnerConfirmed.invoiceGenerateAria')
                                        : t('timeTrackingPage.reports.partnerConfirmed.invoiceUnsignedAria');
                            return (_jsxs("tr", { className: selectable && selectedReportIds.has(r.id) ? 'is-selected' : '', children: [_jsx("td", { className: "tt-partner-confirmed__td-client", "data-label": columnLabels.client, children: resolveClientLabel(r) }), _jsx("td", { className: "tt-partner-confirmed__cell-title tt-partner-confirmed__td-primary", "data-label": columnLabels.project, children: _jsxs("span", { className: "tt-partner-confirmed__project-cell", children: [_jsx("span", { className: "tt-partner-confirmed__card-client", children: resolveClientLabel(r) }), _jsx("span", { children: resolveProjectLabel(r) }), partnerReportIsEmpty(r) ? (_jsx(PartnerReportEmptyBadge, { label: t('timeTrackingPage.reports.partnerConfirmed.emptyReportBadge'), title: t('timeTrackingPage.reports.partnerConfirmed.emptyReportTitle') })) : null, linkedInvoice && invoiceCreatedBeforeAllSignatures(linkedInvoice.internalNote) ? (_jsxs("span", { className: "tt-partner-confirmed__unsigned-invoice", title: t('timeTrackingPage.reports.forReview.unsignedInvoiceTitle').replace('{date}', fmtIsoDateShort(linkedInvoice.createdAt, locale)), children: [_jsx("span", { className: "tt-partner-confirmed__unsigned-invoice-tag", children: t('timeTrackingPage.reports.forReview.unsignedInvoiceTag') }), _jsx("span", { className: "tt-partner-confirmed__unsigned-invoice-meta", children: t('timeTrackingPage.reports.forReview.unsignedInvoiceMeta').replace('{date}', fmtIsoDateShort(linkedInvoice.createdAt, locale)) })] })) : null] }) }), _jsx("td", { className: "tt-partner-confirmed__td-period", "data-label": columnLabels.period, title: formatIsoRangeTitle(r.dateFrom, r.dateTo, { prefix: false, locale: localeTag(locale) }), children: formatPeriodCompact(r.dateFrom, r.dateTo, locale) }), _jsx("td", { className: "tt-partner-confirmed__cell-multiline tt-partner-confirmed__td-partners", "data-label": columnLabels.partners, children: _jsx(PartnerSignaturesList, { signatures: r.signatures, usersById: usersById, locale: locale, canRevoke: (partnerAuthUserId) => canRevokePartnerSignature(r, partnerAuthUserId, currentUser?.id, canManageAll), revokeDisabledReason: revokeBlockedByInvoice
                                                ? t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureBlockedInvoice')
                                                : null, revokeBusyPartnerId: Number.isFinite(rowRevokeBusyPartnerId) ? rowRevokeBusyPartnerId : null, revokeTitle: (name) => t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureTitle').replace('{name}', name), revokeAria: t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureAria'), revokeBusyLabel: t('timeTrackingPage.reports.partnerConfirmed.revokeSignatureBusy'), onRevoke: (partnerAuthUserId, partnerName) => {
                                                void revokeSignature(r, partnerAuthUserId, partnerName);
                                            } }) }), _jsx("td", { className: "tt-partner-confirmed__td-comments", "data-label": columnLabels.comments, children: _jsx(PartnerConfirmedCommentsCell, { count: commentsCount, preview: commentsPreview, countLabel: commentsCountLabel, openLabel: t('timeTrackingPage.reports.partnerConfirmed.commentsOpen').replace('{project}', resolveProjectLabel(r)), emptyLabel: t('timeTrackingPage.reports.partnerConfirmed.commentsCountZero'), onOpen: () => openCommentsDrawer(r), compact: true }) }), _jsx("td", { className: "tt-partner-confirmed__actions-cell tt-partner-confirmed__td-actions", "data-label": columnLabels.actions, children: _jsxs("div", { className: "tt-partner-confirmed__actions", role: "group", "aria-label": columnLabels.actions, children: [selectable ? (_jsx("label", { className: "tt-partner-confirmed__row-check-btn", title: t('timeTrackingPage.reports.partnerConfirmed.combineSelectRow').replace('{project}', resolveProjectLabel(r)), children: _jsx("input", { className: "tt-partner-confirmed__row-check", type: "checkbox", checked: selectedReportIds.has(r.id), onChange: () => toggleReportSelected(r.id), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.combineSelectRow').replace('{project}', resolveProjectLabel(r)) }) })) : null, _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn tt-partner-confirmed__icon-btn--primary", onClick: () => openReportPreviewForRow(r), title: t('timeTrackingPage.reports.partnerConfirmed.previewTitle'), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.previewAria'), children: _jsx(IcoEye, {}) }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn", disabled: exportBusySnapshotId === r.snapshotId, onClick: () => void exportSnapshotExcel(r), title: exportBusySnapshotId === r.snapshotId ? t('timeTrackingPage.reports.partnerConfirmed.exportBusy') : t('timeTrackingPage.reports.partnerConfirmed.exportTitle'), "aria-label": exportBusySnapshotId === r.snapshotId ? t('timeTrackingPage.reports.partnerConfirmed.exportBusyAria') : t('timeTrackingPage.reports.partnerConfirmed.exportAria'), children: exportBusySnapshotId === r.snapshotId ? _jsx(IcoSpinner, {}) : _jsx(IcoDownload, {}) }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn", disabled: invoiceBusy, onClick: () => void generateInvoiceForRow(r), title: invoiceTitle, "aria-label": invoiceAria, children: invoiceBusy ? _jsx(IcoSpinner, {}) : _jsx(IcoInvoice, {}) }), canDelete ? (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn tt-partner-confirmed__icon-btn--danger", disabled: actionsBusy || deleteBlockedByInvoice, onClick: () => void deleteRow(r), title: deleteTitle, "aria-label": deleteAria, children: deleteBusy ? _jsx(IcoSpinner, {}) : _jsx(IcoTrash, {}) })) : null] }) })] }, r.id));
                        }) })] }) }));
    };
    return (_jsxs("div", { className: "tt-partner-confirmed", "aria-labelledby": "tt-partner-confirmed-heading", children: [_jsxs("div", { className: "tt-partner-confirmed__head", children: [_jsxs("div", { children: [_jsx("h2", { id: "tt-partner-confirmed-heading", className: "tt-partner-confirmed__title", children: t('timeTrackingPage.reports.partnerConfirmed.title') }), _jsx("p", { className: "tt-partner-confirmed__subtitle", children: subView === 'archive'
                                    ? t('timeTrackingPage.reports.monthlyArchive.subtitle')
                                    : ytdHeading })] }), subView === 'list' ? (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon", disabled: loading || refreshBusy, onClick: () => void fetchConfirmed({ silent: true }), title: t('timeTrackingPage.reports.partnerConfirmed.refreshTitle'), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.refreshTitle'), children: refreshBusy ? _jsx(IcoSpinner, {}) : _jsx(IcoRefresh, {}) })) : null] }), _jsxs("div", { className: "tt-reports__type-block tt-partner-confirmed__scope", role: "group", "aria-label": t('timeTrackingPage.reports.partnerConfirmed.subView.aria'), children: [_jsx("p", { className: "tt-reports__type-block-title", children: t('timeTrackingPage.reports.partnerConfirmed.subView.aria') }), _jsxs("div", { className: "tt-reports__type-nav", children: [_jsx("button", { type: "button", className: `tt-reports__type-tab${subView === 'list' ? ' tt-reports__type-tab--active' : ''}`, "aria-pressed": subView === 'list', onClick: () => onSubViewChange('list'), children: t('timeTrackingPage.reports.partnerConfirmed.subView.list') }), _jsx("button", { type: "button", className: `tt-reports__type-tab${subView === 'archive' ? ' tt-reports__type-tab--active' : ''}`, "aria-pressed": subView === 'archive', onClick: () => onSubViewChange('archive'), children: t('timeTrackingPage.reports.partnerConfirmed.subView.archive') })] })] }), subView === 'archive' ? (_jsx(MonthlyPartnerArchivePanel, { embedded: true })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-partner-confirmed__filters", children: [_jsxs("div", { className: "tt-partner-confirmed__filter-group", children: [_jsx("span", { className: "tt-partner-confirmed__filter-label", children: t('timeTrackingPage.reports.partnerConfirmed.filters.period') }), _jsxs("div", { className: "tt-partner-confirmed__filter-dates-row", children: [_jsx("span", { className: "tt-partner-confirmed__filter-date-label", children: t('timeTrackingPage.reports.partnerConfirmed.filters.dateFrom') }), _jsx(DatePicker, { value: filterDateFrom, max: filterDateTo || undefined, onChange: setFilterDateFrom, emptyLabel: t('timeTrackingPage.reports.partnerConfirmed.filters.dateEmpty'), portal: true, portalZIndex: 10050, buttonClassName: "tt-reports__date-picker-btn", title: t('timeTrackingPage.reports.partnerConfirmed.filters.dateFrom'), showChevron: true }), filterDateFrom ? (_jsx("button", { type: "button", className: "tt-partner-confirmed__filter-date-clear", onClick: () => setFilterDateFrom(''), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.filters.clearDateFrom'), title: t('timeTrackingPage.reports.partnerConfirmed.filters.reset'), children: "\u00D7" })) : null, _jsx("span", { className: "tt-partner-confirmed__filter-date-sep", "aria-hidden": true, children: "\u2014" }), _jsx("span", { className: "tt-partner-confirmed__filter-date-label", children: t('timeTrackingPage.reports.partnerConfirmed.filters.dateTo') }), _jsx(DatePicker, { value: filterDateTo, min: filterDateFrom || undefined, onChange: setFilterDateTo, emptyLabel: t('timeTrackingPage.reports.partnerConfirmed.filters.dateEmpty'), portal: true, portalZIndex: 10050, buttonClassName: "tt-reports__date-picker-btn", title: t('timeTrackingPage.reports.partnerConfirmed.filters.dateTo'), showChevron: true }), filterDateTo ? (_jsx("button", { type: "button", className: "tt-partner-confirmed__filter-date-clear", onClick: () => setFilterDateTo(''), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.filters.clearDateTo'), title: t('timeTrackingPage.reports.partnerConfirmed.filters.reset'), children: "\u00D7" })) : null] })] }), _jsxs("div", { className: "tt-partner-confirmed__filter-group tt-partner-confirmed__filter-partner", children: [_jsx("label", { className: "tt-partner-confirmed__filter-label", htmlFor: "tt-partner-confirmed-partner-btn", children: t('timeTrackingPage.reports.partnerConfirmed.filters.partner') }), _jsx(SearchableSelect, { className: "tsp-srch", buttonClassName: "tsp-srch__btn", buttonId: "tt-partner-confirmed-partner-btn", portalDropdown: true, portalZIndex: 10050, portalMinWidth: 280, placeholder: t('timeTrackingPage.reports.partnerConfirmed.filters.allPartners'), emptyListText: t('timeTrackingPage.reports.partnerConfirmed.filters.allPartners'), noMatchText: t('timeTrackingPage.common.notFound'), value: partnerFilterId, items: partnerFilterItems, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.name, getSearchText: (o) => o.search, onSelect: (o) => setPartnerFilterId(o.id), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.filters.partnerFilterAria') })] }), !loading && !error && rows.length > 0 ? (_jsxs("div", { className: "tt-partner-confirmed__combine", children: [_jsx("span", { children: t('timeTrackingPage.reports.partnerConfirmed.combineSelected').replace('{count}', String(selectedRows.length)) }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", disabled: selectedRows.length < 2 || combinedBusy, title: selectedRows.length < 2 ? t('timeTrackingPage.reports.partnerConfirmed.combineNeedTwo') : t('timeTrackingPage.reports.partnerConfirmed.combineAction'), onClick: () => void createCombinedInvoice(), children: combinedBusy ? t('timeTrackingPage.reports.partnerConfirmed.combineBusy') : t('timeTrackingPage.reports.partnerConfirmed.combineAction') })] })) : null] }), _jsxs("div", { className: "tt-partner-confirmed__toolbar", children: [_jsx("label", { className: "tt-partner-confirmed__search-label", htmlFor: "tt-partner-confirmed-search", children: t('timeTrackingPage.reports.partnerConfirmed.searchLabel') }), _jsx("input", { id: "tt-partner-confirmed-search", type: "search", className: "tt-reports__table-search-input tt-partner-confirmed__search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('timeTrackingPage.reports.partnerConfirmed.searchPlaceholder'), spellCheck: false, autoComplete: "off", disabled: loading }), _jsx("span", { className: `tt-partner-confirmed__count${loading ? ' tt-partner-confirmed__count--loading' : ''}`, role: "status", children: loading ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "tt-partner-confirmed__count-spinner", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10", opacity: "0.22" }), _jsx("path", { d: "M12 2a10 10 0 0 1 10 10" })] }), countLabel] })) : countLabel })] }), error ? (_jsx("p", { className: "tt-reports__table-err tt-partner-confirmed__err", role: "alert", children: error })) : null, loading ? (_jsx(PartnerReportsListLoading, { label: t('timeTrackingPage.reports.partnerConfirmed.loading'), columns: 6 })) : null, !loading && !error && rows.length === 0 ? (_jsx("p", { className: "tt-partner-confirmed__empty", children: t('timeTrackingPage.reports.partnerConfirmed.empty') })) : null, !loading && !error && rows.length > 0 ? renderTable(filtered, true) : null, !loading && hasActiveFilters && filtered.length === 0 && rows.length > 0 ? (_jsx("p", { className: "tt-partner-confirmed__empty", children: t('timeTrackingPage.reports.partnerConfirmed.noFilterMatch') })) : null, _jsxs("div", { className: "tt-partner-confirmed__archive", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => setArchiveOpen((v) => !v), "aria-expanded": archiveOpen, disabled: loading, children: archiveOpen
                                    ? t('timeTrackingPage.reports.partnerConfirmed.archiveHide')
                                    : t('timeTrackingPage.reports.partnerConfirmed.archiveToggle').replace('{before}', yearStart) }), archiveOpen ? (_jsxs("div", { className: "tt-partner-confirmed__archive-body", children: [_jsx("h3", { className: "tt-partner-confirmed__archive-title", children: t('timeTrackingPage.reports.partnerConfirmed.archiveHeading').replace('{before}', yearStart) }), archiveLoading ? (_jsx(PartnerReportsListLoading, { label: t('timeTrackingPage.reports.partnerConfirmed.loading'), columns: 6 })) : null, archiveError ? (_jsx("p", { className: "tt-reports__table-err tt-partner-confirmed__err", role: "alert", children: archiveError })) : null, !archiveLoading && !archiveError && archiveRows.length === 0 ? (_jsx("p", { className: "tt-partner-confirmed__empty", children: t('timeTrackingPage.reports.partnerConfirmed.archiveEmpty') })) : null, !archiveLoading && !archiveError && archiveRows.length > 0 ? renderTable(filteredArchive) : null, !archiveLoading && hasActiveFilters && filteredArchive.length === 0 && archiveRows.length > 0 ? (_jsx("p", { className: "tt-partner-confirmed__empty", children: t('timeTrackingPage.reports.partnerConfirmed.noFilterMatch') })) : null] })) : null] }), _jsx(PartnerConfirmedCommentsDrawer, { open: commentsDrawerRow != null, row: commentsDrawerRow, projectLabel: commentsDrawerRow ? resolveProjectLabel(commentsDrawerRow) : '', clientLabel: commentsDrawerRow ? resolveClientLabel(commentsDrawerRow) : '', periodLabel: commentsDrawerRow ? formatIsoRangeTitle(commentsDrawerRow.dateFrom, commentsDrawerRow.dateTo, { prefix: false, locale: localeTag(locale) }) : '', comments: drawerComments, usersById: usersLabelById, locale: locale, draft: commentComposeDraft, onDraftChange: setCommentComposeDraft, onAdd: addCommentForOpenRow, onEdit: editCommentForOpenRow, onClose: closeCommentsDrawer, currentUserId: currentUser?.id ?? null, loading: commentsLoading, submitting: commentsSubmitting, error: commentsError, canModerateComments: canManageAll, labels: {
                            title: t('timeTrackingPage.reports.partnerConfirmed.commentsDrawerTitle'),
                            empty: t('timeTrackingPage.reports.partnerConfirmed.commentsEmpty'),
                            loading: t('timeTrackingPage.reports.partnerConfirmed.loading'),
                            composePlaceholder: t('timeTrackingPage.reports.partnerConfirmed.commentsComposePlaceholder'),
                            add: t('timeTrackingPage.reports.partnerConfirmed.commentsAdd'),
                            close: t('timeTrackingPage.reports.partnerConfirmed.commentsClose'),
                            you: t('timeTrackingPage.reports.partnerConfirmed.commentsYou'),
                            composeDisabledPartial: t('timeTrackingPage.reports.partnerConfirmed.commentsComposeDisabledPartial'),
                            edit: t('timeTrackingPage.reports.partnerConfirmed.commentsEdit'),
                            save: t('timeTrackingPage.reports.partnerConfirmed.commentsSave'),
                            cancel: t('timeTrackingPage.reports.partnerConfirmed.commentsCancel'),
                            edited: t('timeTrackingPage.reports.partnerConfirmed.commentsEdited'),
                        } })] }))] }));
}
