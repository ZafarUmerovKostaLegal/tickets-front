import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReportSnapshot, listPartnerReportConfirmationsConfirmed, listTimeTrackingUsers, PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, } from '@entities/time-tracking';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { PartnerReportEmptyBadge, partnerReportIsEmpty } from './PartnerReportEmptyBadge';
import { buildPartnerReportDisplayMetaFromSnapshot, resolvePartnerReportClientLabel, resolvePartnerReportDisplayMeta, resolvePartnerReportProjectLabel, } from '@entities/time-tracking/lib/partnerReportDisplay';
import { enrichPartnerReportClientNamesFromRows, loadPartnerReportDisplayLookups, } from '@entities/time-tracking/lib/partnerReportDisplayLookups';
import { openConfirmedPartnerReportPreview } from '@pages/time-tracking/lib/partnerReportPreviewNav';
import { exportPartnerConfirmedReportExcel } from '@pages/time-tracking/lib/exportPartnerConfirmedReportExcel';
import { buildMonthlyArchiveTree, filterReportsByQuery, parseMonthKey, } from '@pages/time-tracking/lib/partnerMonthlyArchive';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';
import { PartnerReportsListLoading } from './PartnerReportsListLoading';
const IcoRefresh = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }), _jsx("path", { d: "M3 3v5h5" }), _jsx("path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" }), _jsx("path", { d: "M16 21h5v-5" })] }));
const IcoFolder = () => (_jsx("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, children: _jsx("path", { d: "M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z", opacity: "0.92" }) }));
const IcoFile = () => (_jsxs("svg", { width: "26", height: "26", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }));
const IcoEye = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }));
const IcoDownload = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
const IcoGrid = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }), _jsx("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" })] }));
const IcoList = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("line", { x1: "8", y1: "6", x2: "21", y2: "6" }), _jsx("line", { x1: "8", y1: "12", x2: "21", y2: "12" }), _jsx("line", { x1: "8", y1: "18", x2: "21", y2: "18" }), _jsx("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }), _jsx("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }), _jsx("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })] }));
const IcoSpinner = () => (_jsxs("svg", { className: "tt-partner-confirmed__btn-spinner", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10", opacity: "0.22" }), _jsx("path", { d: "M12 2a10 10 0 0 1 10 10" })] }));
function monthLabel(month, locale) {
    const d = new Date(2020, month - 1, 1);
    return d.toLocaleDateString(localeTag(locale), { month: 'long' });
}
function capitalizeMonth(label, locale) {
    if (!label)
        return label;
    if (locale === 'en')
        return label;
    return label.charAt(0).toUpperCase() + label.slice(1);
}
export function MonthlyPartnerArchivePanel({ embedded = false }) {
    const navigate = useNavigate();
    const { showAlert } = useAppDialog();
    const { t, locale } = useI18n();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshBusy, setRefreshBusy] = useState(false);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [view, setView] = useState('grid');
    const [nav, setNav] = useState({ level: 'root' });
    const [usersById, setUsersById] = useState(new Map());
    const [projectRows, setProjectRows] = useState([]);
    const [clientNamesById, setClientNamesById] = useState(new Map());
    const [clientMetaByProjectId, setClientMetaByProjectId] = useState(new Map());
    const [extraRowMetaByProjectId, setExtraRowMetaByProjectId] = useState(new Map());
    const snapshotMetaAttemptedRef = useRef(new Set());
    const [exportBusySnapshotId, setExportBusySnapshotId] = useState(null);
    const resolveProjectLabel = useCallback((r) => {
        return resolvePartnerReportProjectLabel(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows]);
    const resolveClientLabel = useCallback((r) => {
        return resolvePartnerReportClientLabel(r, projectRows, clientNamesById, extraRowMetaByProjectId, clientMetaByProjectId);
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows]);
    const fetchAll = useCallback(async (opts) => {
        const silent = opts?.silent === true;
        if (!silent)
            setLoading(true);
        else
            setRefreshBusy(true);
        setError(null);
        try {
            const list = await listPartnerReportConfirmationsConfirmed();
            const rowsList = Array.isArray(list) ? list : [];
            setRows(rowsList);
            setClientNamesById((prev) => {
                const next = new Map(prev);
                enrichPartnerReportClientNamesFromRows(next, rowsList);
                return next;
            });
        }
        catch (e) {
            setRows([]);
            setError(e instanceof Error ? e.message : t('timeTrackingPage.reports.monthlyArchive.loadFailed'));
        }
        finally {
            if (!silent)
                setLoading(false);
            else
                setRefreshBusy(false);
        }
    }, [t]);
    useEffect(() => {
        void listTimeTrackingUsers().then((list) => {
            const m = new Map();
            for (const r of list) {
                m.set(r.id, r.display_name?.trim() || r.email?.trim() || `ID ${r.id}`);
            }
            setUsersById(m);
        }).catch(() => setUsersById(new Map()));
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
    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);
    useEffect(() => {
        const onInv = () => void fetchAll({ silent: true });
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
    }, [fetchAll]);
    useEffect(() => {
        let cancelled = false;
        const pending = rows.filter((row) => {
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
        void (async () => {
            const updates = new Map();
            for (const row of pending.slice(0, 12)) {
                const sid = row.snapshotId.trim();
                snapshotMetaAttemptedRef.current.add(sid);
                try {
                    const snapshot = await getReportSnapshot(sid);
                    if (cancelled)
                        return;
                    updates.set(row.projectId, buildPartnerReportDisplayMetaFromSnapshot(snapshot, row));
                }
                catch {
                }
            }
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
    }, [clientMetaByProjectId, clientNamesById, extraRowMetaByProjectId, projectRows, rows]);
    const filteredRows = useMemo(() => filterReportsByQuery(rows, query, (r) => ({
        project: resolveProjectLabel(r),
        client: resolveClientLabel(r),
    })), [query, resolveClientLabel, resolveProjectLabel, rows]);
    const tree = useMemo(() => buildMonthlyArchiveTree(filteredRows), [filteredRows]);
    const currentYearFolder = useMemo(() => {
        if (nav.level === 'root')
            return null;
        return tree.find((y) => y.year === nav.year) ?? null;
    }, [nav, tree]);
    const currentMonthFolder = useMemo(() => {
        if (nav.level !== 'month' || !currentYearFolder)
            return null;
        return currentYearFolder.months.find((m) => m.key === nav.monthKey) ?? null;
    }, [currentYearFolder, nav]);
    const openPreview = useCallback((r) => {
        void openConfirmedPartnerReportPreview(r, navigate, {
            returnTo: `${routes.timeTracking}?tab=reports&reportsSection=partner-confirmed&partnerView=archive`,
        });
    }, [navigate]);
    const exportExcel = useCallback(async (r) => {
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
    const goUp = useCallback(() => {
        setNav((prev) => {
            if (prev.level === 'month')
                return { level: 'year', year: prev.year };
            if (prev.level === 'year')
                return { level: 'root' };
            return prev;
        });
    }, []);
    const breadcrumb = useMemo(() => {
        const root = t('timeTrackingPage.reports.monthlyArchive.breadcrumbRoot');
        if (nav.level === 'root')
            return [{ label: root, onClick: null }];
        const yearLabel = String(nav.year);
        if (nav.level === 'year') {
            return [
                { label: root, onClick: () => setNav({ level: 'root' }) },
                { label: yearLabel, onClick: null },
            ];
        }
        const parsed = parseMonthKey(nav.monthKey);
        const mLabel = parsed
            ? `${capitalizeMonth(monthLabel(parsed.month, locale), locale)} ${parsed.year}`
            : nav.monthKey;
        return [
            { label: root, onClick: () => setNav({ level: 'root' }) },
            { label: yearLabel, onClick: () => setNav({ level: 'year', year: nav.year }) },
            { label: mLabel, onClick: null },
        ];
    }, [locale, nav, t]);
    const countLabel = loading
        ? t('timeTrackingPage.reports.monthlyArchive.loading')
        : t('timeTrackingPage.reports.monthlyArchive.count').replace('{count}', String(filteredRows.length));
    const renderFolderCard = (opts) => (_jsxs("button", { type: "button", className: `tt-drive__item tt-drive__item--folder${view === 'list' ? ' tt-drive__item--list' : ''}`, onClick: opts.onOpen, onDoubleClick: opts.onOpen, title: opts.title, children: [_jsx("span", { className: "tt-drive__item-icon tt-drive__item-icon--folder", "aria-hidden": true, children: _jsx(IcoFolder, {}) }), _jsxs("span", { className: "tt-drive__item-body", children: [_jsx("span", { className: "tt-drive__item-title", children: opts.title }), _jsx("span", { className: "tt-drive__item-sub", children: opts.subtitle })] })] }, opts.key));
    const partnerNames = useCallback((r) => {
        if (r.signatures.length === 0)
            return '—';
        return r.signatures
            .map((s) => usersById.get(s.partnerAuthUserId) ?? `ID ${s.partnerAuthUserId}`)
            .join(', ');
    }, [usersById]);
    const renderFileCard = (r) => {
        const project = resolveProjectLabel(r);
        const client = resolveClientLabel(r);
        const period = formatIsoRangeTitle(r.dateFrom, r.dateTo, { prefix: false, locale: localeTag(locale) });
        const busy = exportBusySnapshotId === r.snapshotId;
        return (_jsxs("div", { className: `tt-drive__item tt-drive__item--file${view === 'list' ? ' tt-drive__item--list' : ''}`, role: "button", tabIndex: 0, title: `${project} · ${client}`, onClick: () => openPreview(r), onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openPreview(r);
                }
            }, children: [_jsxs("div", { className: "tt-drive__item-main", children: [_jsx("span", { className: "tt-drive__item-icon tt-drive__item-icon--file", "aria-hidden": true, children: _jsx(IcoFile, {}) }), _jsxs("span", { className: "tt-drive__item-body", children: [_jsx("span", { className: "tt-drive__item-title", title: project, children: _jsxs("span", { className: "tt-partner-confirmed__project-cell", children: [_jsx("span", { children: project }), partnerReportIsEmpty(r) ? (_jsx(PartnerReportEmptyBadge, { label: t('timeTrackingPage.reports.partnerConfirmed.emptyReportBadge'), title: t('timeTrackingPage.reports.partnerConfirmed.emptyReportTitle') })) : null] }) }), _jsx("span", { className: "tt-drive__item-sub", title: client, children: client }), _jsx("span", { className: "tt-drive__item-meta", title: period, children: period }), view === 'list' ? (_jsx("span", { className: "tt-drive__item-meta tt-drive__item-meta--partners", title: partnerNames(r), children: partnerNames(r) })) : null] })] }), _jsxs("span", { className: "tt-drive__item-actions", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn", onClick: () => openPreview(r), title: t('timeTrackingPage.reports.partnerConfirmed.previewTitle'), "aria-label": t('timeTrackingPage.reports.partnerConfirmed.previewAria'), children: _jsx(IcoEye, {}) }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon tt-partner-confirmed__icon-btn", disabled: busy, onClick: () => void exportExcel(r), title: busy
                                ? t('timeTrackingPage.reports.partnerConfirmed.exportBusy')
                                : t('timeTrackingPage.reports.partnerConfirmed.exportTitle'), "aria-label": busy
                                ? t('timeTrackingPage.reports.partnerConfirmed.exportBusyAria')
                                : t('timeTrackingPage.reports.partnerConfirmed.exportAria'), children: busy ? _jsx(IcoSpinner, {}) : _jsx(IcoDownload, {}) })] })] }, r.id));
    };
    let body = null;
    if (loading) {
        body = _jsx(PartnerReportsListLoading, { label: t('timeTrackingPage.reports.monthlyArchive.loading'), columns: 4 });
    }
    else if (error) {
        body = _jsx("p", { className: "tt-reports__table-err tt-partner-confirmed__err", role: "alert", children: error });
    }
    else if (nav.level === 'root') {
        if (tree.length === 0) {
            body = _jsx("p", { className: "tt-partner-confirmed__empty", children: query.trim()
                    ? t('timeTrackingPage.reports.monthlyArchive.noFilterMatch')
                    : t('timeTrackingPage.reports.monthlyArchive.empty') });
        }
        else {
            body = (_jsx("div", { className: `tt-drive__grid${view === 'list' ? ' tt-drive__grid--list' : ''}`, children: tree.map((yearFolder) => renderFolderCard({
                    key: `y-${yearFolder.year}`,
                    title: String(yearFolder.year),
                    subtitle: t('timeTrackingPage.reports.monthlyArchive.yearCount')
                        .replace('{count}', String(yearFolder.reportCount))
                        .replace('{months}', String(yearFolder.months.length)),
                    onOpen: () => setNav({ level: 'year', year: yearFolder.year }),
                })) }));
        }
    }
    else if (nav.level === 'year') {
        const months = currentYearFolder?.months ?? [];
        if (months.length === 0) {
            body = _jsx("p", { className: "tt-partner-confirmed__empty", children: t('timeTrackingPage.reports.monthlyArchive.emptyFolder') });
        }
        else {
            body = (_jsx("div", { className: `tt-drive__grid${view === 'list' ? ' tt-drive__grid--list' : ''}`, children: months.map((m) => renderFolderCard({
                    key: m.key,
                    title: capitalizeMonth(monthLabel(m.month, locale), locale),
                    subtitle: t('timeTrackingPage.reports.monthlyArchive.monthCount')
                        .replace('{count}', String(m.reports.length)),
                    onOpen: () => setNav({ level: 'month', year: m.year, monthKey: m.key }),
                })) }));
        }
    }
    else {
        const files = currentMonthFolder?.reports ?? [];
        if (files.length === 0) {
            body = _jsx("p", { className: "tt-partner-confirmed__empty", children: t('timeTrackingPage.reports.monthlyArchive.emptyFolder') });
        }
        else {
            body = (_jsx("div", { className: `tt-drive__grid${view === 'list' ? ' tt-drive__grid--list' : ''}`, children: files.map(renderFileCard) }));
        }
    }
    return (_jsxs("div", { className: `tt-drive${embedded ? ' tt-drive--embedded' : ' tt-partner-confirmed'}`, "aria-labelledby": embedded ? undefined : 'tt-monthly-archive-heading', children: [!embedded ? (_jsxs("div", { className: "tt-partner-confirmed__head", children: [_jsxs("div", { children: [_jsx("h2", { id: "tt-monthly-archive-heading", className: "tt-partner-confirmed__title", children: t('timeTrackingPage.reports.monthlyArchive.title') }), _jsx("p", { className: "tt-partner-confirmed__subtitle", children: t('timeTrackingPage.reports.monthlyArchive.subtitle') })] }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon", disabled: loading || refreshBusy, onClick: () => void fetchAll({ silent: true }), title: t('timeTrackingPage.reports.monthlyArchive.refreshTitle'), "aria-label": t('timeTrackingPage.reports.monthlyArchive.refreshTitle'), children: refreshBusy ? _jsx(IcoSpinner, {}) : _jsx(IcoRefresh, {}) })] })) : null, _jsxs("div", { className: "tt-drive__content", children: [_jsxs("nav", { className: "tt-drive__crumbs", "aria-label": t('timeTrackingPage.reports.monthlyArchive.breadcrumbAria'), children: [nav.level !== 'root' ? (_jsxs("button", { type: "button", className: "tt-drive__crumb-back", onClick: goUp, children: ["\u2190 ", t('timeTrackingPage.reports.monthlyArchive.back')] })) : null, _jsx("ol", { className: "tt-drive__crumb-list", children: breadcrumb.map((crumb, i) => (_jsxs("li", { className: "tt-drive__crumb-item", children: [i > 0 ? _jsx("span", { className: "tt-drive__crumb-sep", "aria-hidden": true, children: "/" }) : null, crumb.onClick ? (_jsx("button", { type: "button", className: "tt-drive__crumb-link", onClick: crumb.onClick, children: crumb.label })) : (_jsx("span", { className: "tt-drive__crumb-current", "aria-current": "page", children: crumb.label }))] }, `${crumb.label}-${i}`))) })] }), _jsxs("div", { className: "tt-partner-confirmed__toolbar tt-drive__toolbar", children: [_jsx("input", { id: "tt-monthly-archive-search", type: "search", className: "tt-reports__table-search-input tt-partner-confirmed__search tt-drive__search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('timeTrackingPage.reports.monthlyArchive.searchPlaceholder'), "aria-label": t('timeTrackingPage.reports.monthlyArchive.searchLabel'), spellCheck: false, autoComplete: "off", disabled: loading }), _jsx("span", { className: "tt-partner-confirmed__count tt-drive__count", role: "status", children: countLabel }), _jsxs("div", { className: "tt-drive__toolbar-actions", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon", disabled: loading || refreshBusy, onClick: () => void fetchAll({ silent: true }), title: t('timeTrackingPage.reports.monthlyArchive.refreshTitle'), "aria-label": t('timeTrackingPage.reports.monthlyArchive.refreshTitle'), children: refreshBusy ? _jsx(IcoSpinner, {}) : _jsx(IcoRefresh, {}) }), _jsxs("div", { className: "tt-drive__view-toggle", role: "group", "aria-label": t('timeTrackingPage.reports.monthlyArchive.viewAria'), children: [_jsx("button", { type: "button", className: `tt-drive__view-btn${view === 'grid' ? ' tt-drive__view-btn--active' : ''}`, "aria-pressed": view === 'grid', onClick: () => setView('grid'), title: t('timeTrackingPage.reports.monthlyArchive.viewGrid'), children: _jsx(IcoGrid, {}) }), _jsx("button", { type: "button", className: `tt-drive__view-btn${view === 'list' ? ' tt-drive__view-btn--active' : ''}`, "aria-pressed": view === 'list', onClick: () => setView('list'), title: t('timeTrackingPage.reports.monthlyArchive.viewList'), children: _jsx(IcoList, {}) })] })] })] }), _jsx("div", { className: "tt-drive__body", children: body })] })] }));
}
