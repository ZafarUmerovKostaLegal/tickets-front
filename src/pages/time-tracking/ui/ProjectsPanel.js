import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TimeTrackingForms.css';
import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedLink } from '@shared/ui';
import { useNavigate } from 'react-router-dom';
import { listAllTimeManagerClientsMerged, listAllClientProjectsMerged, fetchProjectsBudgetMetrics, applyBudgetMetricsToProjects, getClientProject, patchClientProject, deleteClientProject, } from '@entities/time-tracking';
import { listPartners } from '@entities/user';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination, SearchableSelect, useAppDialog } from '@shared/ui';
import { showToast } from '@shared/ui/app-toast';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
import { buildProjectArchiveTogglePatch, buildProjectPauseTogglePatch } from '@entities/time-tracking/lib/projectArchiveRestore';
import { exportProjectsListExcel } from '@entities/time-tracking/lib/exportProjectsListExcel';
import { readInitialProjectsFilters, writeProjectsFiltersToStorage } from '@entities/time-tracking/lib/projectsFiltersStorage';
import { getProjectDetailUrl, getTimeTrackingNewProjectUrl } from '@shared/config';
import { useI18n, ttProjectStatusLabel, ttProjectTypeLabel, ttProjectPluralWord } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { ProjectsSkeleton } from './ProjectsSkeleton';
import { ClientProjectModal } from './TimeTrackingClientProjectModal';
import { AddClientContactForClientModal } from './AddClientContactForClientModal';
function fmtAmt(n, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU')} ${cur}`;
}
function fmtGroupSpentByCurrency(projects) {
    const m = new Map();
    for (const p of projects) {
        const c = (p.currency || 'USD').trim() || 'USD';
        const add = Number.isFinite(p.spent) ? p.spent : 0;
        m.set(c, (m.get(c) ?? 0) + add);
    }
    if (m.size === 0)
        return '—';
    const parts = [...m.entries()].sort(([a], [b]) => {
        const rank = (x) => (x === 'USD' ? 0 : x === 'UZS' ? 1 : 2);
        return rank(a) - rank(b) || a.localeCompare(b, 'en');
    });
    return parts.map(([cur, sum]) => fmtAmt(sum, cur)).join(' · ');
}
function remainingPct(budget, spent) {
    if (!Number.isFinite(budget) || budget <= 0)
        return null;
    const pct = Math.round(((budget - spent) / budget) * 100);
    return Number.isFinite(pct) ? pct : null;
}
function spentPct(budget, spent) {
    if (!Number.isFinite(budget) || budget <= 0)
        return 0;
    return Math.min((spent / budget) * 100, 100);
}
const PP_ACTIONS_MENU_FALLBACK_W = 96;
const STATUS_DOT = {
    active: '#22c55e',
    paused: '#f59e0b',
    archived: '#94a3b8',
};
const TYPE_COLOR = {
    'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'Пакет часов': { color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
};
const STATUS_OPTIONS = ['active', 'paused', 'archived'];
const PP_PARTNER_FILTER_NONE = '__none__';
const IcoChevron = ({ cls = '' }) => (_jsx("svg", { className: cls, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
const IcoPlus = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }));
const IcoCheck = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }));
const IcoFolder = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }) }));
const IcoSearch = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.35-4.35" })] }));
const IcoDownload = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
function matchesProjectSearch(p, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return true;
    const hay = `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim().toLowerCase();
    return hay.includes(q);
}
function StatusDropdown({ statusFilter, filteredCount, totalBeforeStatus, statusCounts, onSelect, t, }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const h = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const label = statusFilter
        ? `${ttProjectStatusLabel(statusFilter, t)} (${filteredCount})`
        : t('timeTrackingPage.projects.allProjectsFilter').replace('{count}', String(filteredCount));
    return (_jsxs("div", { ref: ref, className: "pp__status-wrap", children: [_jsxs("button", { type: "button", className: "pp__status-btn", onClick: () => setOpen((v) => !v), "aria-expanded": open, children: [label, " ", _jsx(IcoChevron, { cls: `pp__status-chevron${open ? ' pp__status-chevron--open' : ''}` })] }), open && (_jsxs("div", { className: "pp__status-dropdown", children: [_jsxs("button", { type: "button", className: `pp__status-opt${!statusFilter ? ' pp__status-opt--on' : ''}`, onClick: () => {
                            onSelect('');
                            setOpen(false);
                        }, children: [!statusFilter && _jsx(IcoCheck, {}), " ", t('timeTrackingPage.projects.allProjectsFilter').replace('{count}', String(totalBeforeStatus))] }), STATUS_OPTIONS.map((s) => {
                        const cnt = statusCounts[s];
                        return (_jsxs("button", { type: "button", className: `pp__status-opt${statusFilter === s ? ' pp__status-opt--on' : ''}`, onClick: () => {
                                onSelect(s);
                                setOpen(false);
                            }, children: [_jsx("span", { className: "pp__status-dot", style: { background: STATUS_DOT[s] } }), statusFilter === s && _jsx(IcoCheck, {}), " ", ttProjectStatusLabel(s, t), " (", cnt, ")"] }, s));
                    })] }))] }));
}
function BudgetBar({ progressPercent, budget, spent, t, }) {
    const fallbackPct = (budget != null && spent != null) ? spentPct(budget, spent) : 0;
    const pct = Number.isFinite(progressPercent) ? Math.max(0, Number(progressPercent)) : fallbackPct;
    const over = pct > 100;
    const bluePct = Math.min(pct, 100);
    const redPct = over ? Math.min((pct - 100) * 0.8, 45) : 0;
    const title = Number.isFinite(progressPercent)
        ? t('timeTrackingPage.projects.table.progressTitle').replace('{percent}', String(Math.round(Number(progressPercent))))
        : t('timeTrackingPage.projects.table.spentBudgetTitle')
            .replace('{spent}', fmtAmt(spent ?? 0))
            .replace('{budget}', fmtAmt(budget ?? 0));
    return (_jsx("div", { className: "pp__bar-wrap", title: title, children: _jsxs("div", { className: "pp__bar", children: [_jsx("div", { className: "pp__bar-fill pp__bar-fill--blue", style: { width: `${bluePct}%` } }), over && _jsx("div", { className: "pp__bar-fill pp__bar-fill--red", style: { width: `${redPct}%` } })] }) }));
}
export function ProjectsPanel() {
    const navigate = useNavigate();
    const { t, locale } = useI18n();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const canManage = canManageTimeTrackingClients(user);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [apiProjects, setApiProjects] = useState([]);
    const [apiClients, setApiClients] = useState([]);
    const initialFilters = useMemo(() => readInitialProjectsFilters(), []);
    const [statusFilter, setStatusFilter] = useState(initialFilters.statusFilter);
    const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
    const [clientFilter, setClientFilter] = useState(initialFilters.clientFilter);
    const [managerFilter, setManagerFilter] = useState(initialFilters.managerFilter);
    const [partnerFilter, setPartnerFilter] = useState(initialFilters.partnerFilter);
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [projectsTablePage, setProjectsTablePage] = useState(1);
    const PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [collapsed, setCollapsed] = useState(new Set());
    const [actionOpen, setActionOpen] = useState(null);
    const [menuPlacement, setMenuPlacement] = useState(null);
    const actionRef = useRef(null);
    const menuPortalRef = useRef(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);
    const [contactModalClient, setContactModalClient] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editModalKey, setEditModalKey] = useState(0);
    const [editInitial, setEditInitial] = useState(null);
    const clientFilterBtnId = useId();
    const managerFilterBtnId = useId();
    const partnerFilterBtnId = useId();
    const reloadProjects = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [clients, allProjects] = await Promise.all([
                listAllTimeManagerClientsMerged(),
                listAllClientProjectsMerged(true),
            ]);
            setApiClients(clients);
            setApiProjects(allProjects);
        }
        catch (e) {
            setApiProjects([]);
            setApiClients([]);
            setLoadError(e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.loadFailed'));
        }
        finally {
            setLoading(false);
        }
    }, [t]);
    const rows = useMemo(() => {
        const clientById = new Map(apiClients.map((c) => [c.id, c]));
        const out = [];
        for (const p of apiProjects) {
            const c = clientById.get(p.client_id);
            if (!c)
                continue;
            out.push(mapClientProjectToProjectRow(p, c));
        }
        return out;
    }, [apiProjects, apiClients]);
    useEffect(() => {
        void reloadProjects();
    }, [reloadProjects]);
    useEffect(() => {
        let cancelled = false;
        void listPartners()
            .then((items) => {
            if (cancelled)
                return;
            const opts = items
                .map((p) => {
                const name = (p.display_name?.trim() || p.email?.trim() || `ID ${p.id}`).trim();
                return { key: String(p.id), label: name };
            })
                .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
            setPartnerOptions(opts);
        })
            .catch(() => {
            if (!cancelled)
                setPartnerOptions([]);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        setProjectsTablePage(1);
    }, [statusFilter, clientFilter, managerFilter, partnerFilter, searchQuery]);
    useEffect(() => {
        writeProjectsFiltersToStorage({
            statusFilter,
            searchQuery,
            clientFilter,
            managerFilter,
            partnerFilter,
        });
    }, [statusFilter, searchQuery, clientFilter, managerFilter, partnerFilter]);
    const clientNames = useMemo(() => [...new Set(rows.map((p) => p.client))].sort(), [rows]);
    const managers = useMemo(() => {
        const all = rows.flatMap((p) => p.managers ?? []);
        return [...new Set(all)].sort();
    }, [rows]);
    const clientFilterOptions = useMemo(() => [{ key: '' }, ...clientNames.map((n) => ({ key: n }))], [clientNames]);
    const managerFilterOptions = useMemo(() => [{ key: '' }, ...managers.map((m) => ({ key: m }))], [managers]);
    const partnerFilterOptions = useMemo(() => ([
        { key: '', label: t('timeTrackingPage.common.allPartners') },
        { key: PP_PARTNER_FILTER_NONE, label: t('timeTrackingPage.projects.noPartnerFilter') },
        ...partnerOptions,
    ]), [partnerOptions, t]);
    const baseFiltered = useMemo(() => rows.filter((p) => {
        if (!matchesProjectSearch(p, searchQuery))
            return false;
        if (clientFilter && p.client !== clientFilter)
            return false;
        if (managerFilter && !(p.managers ?? []).includes(managerFilter))
            return false;
        if (partnerFilter === PP_PARTNER_FILTER_NONE) {
            if ((p.partnerAuthUserIds ?? []).length > 0)
                return false;
        }
        else if (partnerFilter) {
            const uid = Number(partnerFilter);
            if (!Number.isFinite(uid))
                return false;
            const participants = p.participantAuthUserIds ?? [];
            if (!participants.includes(uid))
                return false;
        }
        return true;
    }), [rows, searchQuery, clientFilter, managerFilter, partnerFilter]);
    const statusCounts = useMemo(() => ({
        active: baseFiltered.filter((p) => p.status === 'active').length,
        paused: baseFiltered.filter((p) => p.status === 'paused').length,
        archived: baseFiltered.filter((p) => p.status === 'archived').length,
    }), [baseFiltered]);
    const filtered = useMemo(() => baseFiltered.filter((p) => !statusFilter || p.status === statusFilter), [baseFiltered, statusFilter]);
    const fixedClientIdForCreate = useMemo(() => {
        if (!clientFilter)
            return null;
        const c = apiClients.find((x) => x.name === clientFilter);
        return c?.id ?? null;
    }, [clientFilter, apiClients]);
    const projectsPageSlice = useMemo(() => {
        const ordered = [...filtered].sort((a, b) => {
            const c = a.client.localeCompare(b.client, 'ru', { sensitivity: 'base' });
            if (c !== 0)
                return c;
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });
        const start = (projectsTablePage - 1) * PAGE;
        return ordered.slice(start, start + PAGE);
    }, [filtered, projectsTablePage, PAGE]);
    const visibleProjectIdsKey = useMemo(() => projectsPageSlice.map((project) => project.id).sort().join(','), [projectsPageSlice]);
    useEffect(() => {
        const ids = visibleProjectIdsKey ? visibleProjectIdsKey.split(',') : [];
        if (loading || ids.length === 0)
            return;
        let cancelled = false;
        void fetchProjectsBudgetMetrics(ids)
            .then((metrics) => {
            if (!cancelled)
                setApiProjects((prev) => applyBudgetMetricsToProjects(prev, metrics));
        })
            .catch(() => { });
        return () => {
            cancelled = true;
        };
    }, [loading, visibleProjectIdsKey]);
    const groupedPage = useMemo(() => {
        const map = new Map();
        for (const p of projectsPageSlice) {
            if (!map.has(p.client))
                map.set(p.client, []);
            map.get(p.client).push(p);
        }
        return Array.from(map.entries());
    }, [projectsPageSlice]);
    const openActionProject = useMemo(() => (actionOpen ? rows.find((r) => r.id === actionOpen) ?? null : null), [actionOpen, rows]);
    useEffect(() => {
        if (actionOpen && !rows.some((r) => r.id === actionOpen))
            setActionOpen(null);
    }, [actionOpen, rows]);
    useLayoutEffect(() => {
        if (!actionOpen) {
            setMenuPlacement(null);
            return;
        }
        const wrap = actionRef.current;
        const btn = wrap?.querySelector('.pp__actions-btn');
        if (!(btn instanceof HTMLElement)) {
            setMenuPlacement(null);
            return;
        }
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const maxW = Math.min(280, vw - pad * 2);
        const measure = () => {
            const menu = menuPortalRef.current;
            const r = btn.getBoundingClientRect();
            const mw = menu ? menu.getBoundingClientRect().width : Math.max(PP_ACTIONS_MENU_FALLBACK_W, r.width);
            const mh = menu ? menu.getBoundingClientRect().height : 200;
            let left = r.right - mw;
            left = Math.max(pad, Math.min(left, vw - mw - pad));
            let top = r.bottom + 5;
            if (top + mh > vh - pad) {
                top = Math.max(pad, r.top - mh - 5);
            }
            setMenuPlacement({
                top,
                left,
                minWidth: r.width,
                maxWidth: maxW,
            });
        };
        measure();
        let raf1 = 0;
        let raf2 = 0;
        raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(measure);
        });
        return () => {
            window.cancelAnimationFrame(raf1);
            window.cancelAnimationFrame(raf2);
        };
    }, [actionOpen]);
    useEffect(() => {
        if (!actionOpen)
            return;
        const h = (e) => {
            const t = e.target;
            if (actionRef.current?.contains(t))
                return;
            if (menuPortalRef.current?.contains(t))
                return;
            setActionOpen(null);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [actionOpen]);
    useEffect(() => {
        if (!actionOpen)
            return;
        const close = () => setActionOpen(null);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [actionOpen]);
    function toggleSelect(id) {
        setSelectedIds((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }
    function toggleCollapse(client) {
        setCollapsed((prev) => {
            const n = new Set(prev);
            n.has(client) ? n.delete(client) : n.add(client);
            return n;
        });
    }
    const partnerExportReady = Boolean(partnerFilter && partnerFilter !== PP_PARTNER_FILTER_NONE);
    const handleExportPartnerProjects = useCallback(async () => {
        if (!partnerExportReady) {
            showToast({ message: t('timeTrackingPage.projects.exportPartnerHint'), variant: 'warning' });
            return;
        }
        if (filtered.length === 0) {
            showToast({ message: t('timeTrackingPage.projects.exportPartnerEmpty'), variant: 'warning' });
            return;
        }
        const partnerLabel = partnerOptions.find((o) => o.key === partnerFilter)?.label
            || partnerFilter;
        setExportBusy(true);
        try {
            const file = await exportProjectsListExcel({
                projects: filtered,
                partnerLabel,
                columnLabels: {
                    client: t('timeTrackingPage.projects.exportCols.client'),
                    project: t('timeTrackingPage.projects.exportCols.project'),
                    type: t('timeTrackingPage.projects.exportCols.type'),
                    status: t('timeTrackingPage.projects.exportCols.status'),
                    budget: t('timeTrackingPage.projects.exportCols.budget'),
                    spent: t('timeTrackingPage.projects.exportCols.spent'),
                    remaining: t('timeTrackingPage.projects.exportCols.remaining'),
                    currency: t('timeTrackingPage.projects.exportCols.currency'),
                    hours: t('timeTrackingPage.projects.exportCols.hours'),
                    sheetName: t('timeTrackingPage.projects.exportPartnerSheet'),
                },
                statusLabel: (status) => ttProjectStatusLabel(status, t),
                typeLabel: (type) => ttProjectTypeLabel(type, t),
            });
            showToast({
                message: t('timeTrackingPage.projects.exportPartnerDone').replace('{file}', file),
                variant: 'info',
            });
        }
        catch (e) {
            const msg = e instanceof Error && e.message === 'empty'
                ? t('timeTrackingPage.projects.exportPartnerEmpty')
                : (e instanceof Error ? e.message : t('timeTrackingPage.projects.exportPartnerFailed'));
            showToast({ message: msg || t('timeTrackingPage.projects.exportPartnerFailed'), variant: 'error' });
        }
        finally {
            setExportBusy(false);
        }
    }, [filtered, partnerExportReady, partnerFilter, partnerOptions, t]);
    function goToNewProject() {
        navigate(getTimeTrackingNewProjectUrl(fixedClientIdForCreate));
    }
    if (loading)
        return _jsx(ProjectsSkeleton, {});
    return (_jsxs("div", { className: "pp", children: [loadError && (_jsx("p", { className: "tt-settings__banner-error pp__load-error", role: "alert", children: loadError })), _jsxs("div", { className: "pp__topbar", children: [_jsxs("div", { className: "pp__topbar-left", children: [_jsx("h1", { className: "pp__title", children: t('timeTrackingPage.projects.title') }), _jsx(StatusDropdown, { statusFilter: statusFilter, filteredCount: filtered.length, totalBeforeStatus: baseFiltered.length, statusCounts: statusCounts, onSelect: setStatusFilter, t: t })] }), _jsxs("div", { className: "pp__topbar-right", children: [_jsxs("div", { className: "tt-settings__search-wrap pp__projects-search", children: [_jsx("span", { className: "tt-settings__search-icon", children: _jsx(IcoSearch, {}) }), _jsx("input", { type: "search", className: "tt-settings__search", placeholder: t('timeTrackingPage.projects.searchPlaceholder'), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), "aria-label": t('timeTrackingPage.projects.searchAria') })] }), _jsx(SearchableSelect, { className: `tsp-srch--pp${clientFilter ? ' tsp-srch--pp--active' : ''}`, buttonId: clientFilterBtnId, value: clientFilter, items: clientFilterOptions, getOptionValue: (o) => o.key, getOptionLabel: (o) => (o.key ? o.key : t('timeTrackingPage.common.allClients')), getSearchText: (o) => (o.key || t('timeTrackingPage.common.allClients').toLowerCase()), onSelect: (o) => setClientFilter(o.key), portalDropdown: true, portalZIndex: 5000, portalMinWidth: 300, portalDropdownClassName: "tsp-srch__dropdown--tall", placeholder: t('timeTrackingPage.projects.filterByClient'), emptyListText: t('timeTrackingPage.common.noClients'), noMatchText: t('timeTrackingPage.common.noMatch'), renderButtonContent: (o) => (_jsx("span", { children: o.key ? o.key : t('timeTrackingPage.projects.filterByClient') })) }), partnerOptions.length > 0 && (_jsx(SearchableSelect, { className: `tsp-srch--pp${partnerFilter ? ' tsp-srch--pp--active' : ''}`, buttonId: partnerFilterBtnId, value: partnerFilter, items: partnerFilterOptions, getOptionValue: (o) => o.key, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label.toLowerCase(), onSelect: (o) => setPartnerFilter(o.key), portalDropdown: true, portalZIndex: 5000, portalMinWidth: 260, portalDropdownClassName: "tsp-srch__dropdown--tall", placeholder: t('timeTrackingPage.projects.filterByPartner'), emptyListText: t('timeTrackingPage.projects.noPartners'), noMatchText: t('timeTrackingPage.common.noMatch'), renderButtonContent: (o) => (_jsx("span", { children: o.key ? o.label : t('timeTrackingPage.projects.filterByPartner') })) })), managers.length > 0 && (_jsx(SearchableSelect, { className: `tsp-srch--pp${managerFilter ? ' tsp-srch--pp--active' : ''}`, buttonId: managerFilterBtnId, value: managerFilter, items: managerFilterOptions, getOptionValue: (o) => o.key, getOptionLabel: (o) => (o.key ? o.key : t('timeTrackingPage.common.allManagers')), getSearchText: (o) => (o.key || t('timeTrackingPage.common.allManagers').toLowerCase()), onSelect: (o) => setManagerFilter(o.key), portalDropdown: true, portalZIndex: 5000, portalMinWidth: 240, portalDropdownClassName: "tsp-srch__dropdown--tall", placeholder: t('timeTrackingPage.projects.filterByManager'), emptyListText: t('timeTrackingPage.projects.noManagers'), noMatchText: t('timeTrackingPage.common.noMatch'), renderButtonContent: (o) => (_jsx("span", { children: o.key ? o.key : t('timeTrackingPage.projects.filterByManager') })) })), partnerOptions.length > 0 && (_jsxs("button", { type: "button", className: "pp__export-btn", disabled: exportBusy || !partnerExportReady || filtered.length === 0, title: !partnerExportReady
                                    ? t('timeTrackingPage.projects.exportPartnerHint')
                                    : filtered.length === 0
                                        ? t('timeTrackingPage.projects.exportPartnerEmpty')
                                        : undefined, onClick: () => void handleExportPartnerProjects(), children: [_jsx(IcoDownload, {}), exportBusy
                                        ? t('timeTrackingPage.common.loading')
                                        : t('timeTrackingPage.projects.exportPartnerList')] })), _jsxs("button", { type: "button", className: "pp__new-btn", disabled: !canManage, title: !canManage
                                    ? t('timeTrackingPage.common.manageRoleHint')
                                    : undefined, onClick: goToNewProject, children: [_jsx(IcoPlus, {}), " ", t('timeTrackingPage.projects.newProject')] })] })] }), _jsxs("div", { className: "pp__table-wrap", children: [_jsxs("div", { className: "pp__table", children: [_jsxs("div", { className: "pp__thead", children: [_jsx("span", { className: "pp__th pp__th--check", children: _jsx("span", { className: "pp__checkbox" }) }), _jsx("span", { className: "pp__th pp__th--name", children: t('timeTrackingPage.projects.table.clientProject') }), _jsx("span", { className: "pp__th pp__th--budget", children: t('timeTrackingPage.projects.table.budget') }), _jsx("span", { className: "pp__th pp__th--spent", children: t('timeTrackingPage.projects.table.spent') }), _jsx("span", { className: "pp__th pp__th--bar" }), _jsx("span", { className: "pp__th pp__th--remaining", children: t('timeTrackingPage.projects.table.remaining') }), _jsx("span", { className: "pp__th pp__th--costs", children: t('timeTrackingPage.projects.table.costs') }), _jsx("span", { className: "pp__th pp__th--actions" })] }), filtered.length === 0 && (_jsxs("div", { className: "pp__empty", children: [_jsx(IcoFolder, {}), _jsx("span", { children: rows.length === 0
                                            ? t('timeTrackingPage.projects.empty.noProjects')
                                            : t('timeTrackingPage.projects.empty.noFilterMatch') })] })), groupedPage.map(([client, projects]) => {
                                const isCollapsed = collapsed.has(client);
                                const clientApi = apiClients.find((c) => c.name === client);
                                const clientIdForContact = clientApi?.id;
                                const clientArchivedForContact = clientApi?.is_archived ?? false;
                                return (_jsxs("div", { className: `pp__group${isCollapsed ? ' pp__group--collapsed' : ''}`, children: [_jsxs("div", { className: "pp__client-row", children: [_jsxs("div", { className: "pp__client-row-main", onClick: () => toggleCollapse(client), role: "button", tabIndex: 0, "aria-expanded": !isCollapsed, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && toggleCollapse(client), children: [_jsx("span", { className: `pp__client-chevron${!isCollapsed ? ' pp__client-chevron--open' : ''}`, children: _jsx(IcoChevron, {}) }), _jsx("span", { className: "pp__client-name", children: client }), _jsxs("span", { className: "pp__client-meta", children: [projects.length, ' ', ttProjectPluralWord(projects.length, t, locale)] }), isCollapsed && (_jsx("span", { className: "pp__client-total", title: t('timeTrackingPage.projects.table.spentByCurrencyTitle'), children: fmtGroupSpentByCurrency(projects) }))] }), canManage && clientIdForContact != null && (_jsxs("button", { type: "button", className: "pp__client-add-contact", disabled: clientArchivedForContact, title: clientArchivedForContact
                                                        ? t('timeTrackingPage.projects.actions.clientArchivedContact')
                                                        : t('timeTrackingPage.projects.actions.addContact'), onClick: (e) => {
                                                        e.stopPropagation();
                                                        setContactModalClient({
                                                            id: clientIdForContact,
                                                            name: client,
                                                            is_archived: clientArchivedForContact,
                                                        });
                                                    }, children: [_jsx(IcoPlus, {}), _jsx("span", { children: t('timeTrackingPage.common.contact') })] }))] }), !isCollapsed &&
                                            projects.map((p) => {
                                                const hasBudgetConfigured = p.hasBudgetConfigured !== false;
                                                const hasBudget = p.budget != null;
                                                const spentVal = Number.isFinite(p.spent) ? p.spent : 0;
                                                const rem = p.remaining ?? (hasBudget ? p.budget - spentVal : null);
                                                const over = rem != null && rem < 0;
                                                const budgetVal = p.budget ?? 0;
                                                const pctRaw = hasBudget && budgetVal > 0
                                                    ? (Number.isFinite(p.progressPercent)
                                                        ? Math.round(Number(p.progressPercent))
                                                        : remainingPct(budgetVal, spentVal))
                                                    : null;
                                                const pct = pctRaw != null && Number.isFinite(pctRaw) ? pctRaw : null;
                                                const typeMeta = TYPE_COLOR[p.type];
                                                const isSelected = selectedIds.has(p.id);
                                                const isActOpen = actionOpen === p.id;
                                                return (_jsxs("div", { className: `pp__row${isSelected ? ' pp__row--selected' : ''}`, onClick: () => navigate(getProjectDetailUrl(p.id, p.clientId)), style: { cursor: 'pointer' }, children: [_jsx("span", { className: "pp__td pp__td--check", onClick: (e) => e.stopPropagation(), children: _jsx("span", { className: `pp__checkbox${isSelected ? ' pp__checkbox--on' : ''}`, onClick: () => toggleSelect(p.id), role: "checkbox", "aria-checked": isSelected, tabIndex: 0, onKeyDown: (e) => e.key === ' ' && toggleSelect(p.id), children: isSelected && _jsx(IcoCheck, {}) }) }), _jsxs("span", { className: "pp__td pp__td--name", children: [_jsxs(AnimatedLink, { className: "pp__proj-name pp__proj-name--link", to: getProjectDetailUrl(p.id, p.clientId), children: [_jsx("span", { className: "pp__proj-dot", style: { background: STATUS_DOT[p.status] } }), p.name] }), _jsx("span", { className: "pp__type-badge", style: { color: typeMeta.color, background: typeMeta.bg }, children: ttProjectTypeLabel(p.type, t) })] }), _jsx("span", { className: "pp__td pp__td--budget", children: !hasBudgetConfigured
                                                                ? (_jsx("span", { className: "pp__dash", children: t('timeTrackingPage.projects.table.noBudget') }))
                                                                : hasBudget
                                                                    ? fmtAmt(p.budget, p.currency)
                                                                    : fmtAmt(0, p.currency) }), _jsxs("span", { className: "pp__td pp__td--spent pp__metric-cell", title: p.loggedHours != null
                                                                ? `${fmtAmt(spentVal, p.currency)} · ${t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', p.loggedHours.toLocaleString(localeTag(locale)))}`
                                                                : fmtAmt(spentVal, p.currency), children: [_jsx("span", { className: "pp__metric-primary", children: fmtAmt(spentVal, p.currency) }), p.loggedHours != null ? (_jsx("span", { className: "pp__metric-sub", children: t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', p.loggedHours.toLocaleString(localeTag(locale))) })) : null] }), _jsx("span", { className: "pp__td pp__td--bar", children: _jsx(BudgetBar, { progressPercent: p.progressPercent, budget: p.budget, spent: spentVal, t: t }) }), _jsx("span", { className: `pp__td pp__td--remaining pp__metric-cell${over ? ' pp__td--over' : ''}`, children: rem != null ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "pp__metric-primary pp__rem-val", children: [over ? '−' : '', fmtAmt(Math.abs(rem), p.currency)] }), pct != null && (_jsxs("span", { className: `pp__metric-sub pp__rem-pct${over ? ' pp__rem-pct--over' : ''}`, children: [over ? '−' : '', Math.abs(pct), "%"] }))] })) : (_jsx("span", { className: "pp__metric-primary pp__dash", children: fmtAmt(0, p.currency) })) }), _jsx("span", { className: "pp__td pp__td--costs", children: p.costs > 0 ? (_jsx("span", { className: "pp__costs-val", children: fmtAmt(p.costs, p.currency) })) : (_jsxs("span", { className: "pp__zero", children: ["0,00 ", p.currency] })) }), _jsx("span", { className: "pp__td pp__td--actions", onClick: (e) => e.stopPropagation(), children: _jsx("div", { className: "pp__actions-wrap", ref: isActOpen ? actionRef : undefined, children: _jsxs("button", { type: "button", className: `pp__actions-btn${isActOpen ? ' pp__actions-btn--open' : ''}`, onClick: () => setActionOpen(isActOpen ? null : p.id), children: [t('timeTrackingPage.projects.actions.actions'), " ", _jsx(IcoChevron, { cls: `pp__actions-chevron${isActOpen ? ' pp__actions-chevron--open' : ''}` })] }) }) })] }, p.id));
                                            })] }, client));
                            })] }), filtered.length > PAGE ? (_jsx(Pagination, { className: "pp__table-pagination", page: projectsTablePage, totalCount: filtered.length, pageSize: PAGE, onPageChange: setProjectsTablePage })) : null] }), contactModalClient && (_jsx(AddClientContactForClientModal, { clientId: contactModalClient.id, clientName: contactModalClient.name, clientArchived: contactModalClient.is_archived, canManage: canManage, onClose: () => setContactModalClient(null) })), actionOpen &&
                openActionProject &&
                createPortal(_jsxs("div", { ref: menuPortalRef, className: "pp__actions-menu pp__actions-menu--portal", style: menuPlacement
                        ? {
                            top: menuPlacement.top,
                            left: menuPlacement.left,
                            minWidth: menuPlacement.minWidth,
                            maxWidth: menuPlacement.maxWidth,
                        }
                        : {
                            position: 'fixed',
                            left: '-9999px',
                            top: 0,
                            visibility: 'hidden',
                            pointerEvents: 'none',
                            width: 'max-content',
                            minWidth: PP_ACTIONS_MENU_FALLBACK_W,
                            maxWidth: Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 16 : 280),
                        }, role: "menu", children: [_jsx("button", { type: "button", className: "pp__actions-item", disabled: !canManage || actionBusy, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => {
                                void (async () => {
                                    if (!canManage)
                                        return;
                                    setActionBusy(true);
                                    try {
                                        const row = await getClientProject(openActionProject.clientId, openActionProject.id);
                                        setEditInitial(row);
                                        setEditModalKey((k) => k + 1);
                                        setEditModalOpen(true);
                                        setActionOpen(null);
                                    }
                                    catch (e) {
                                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.loadProjectFailed') });
                                    }
                                    finally {
                                        setActionBusy(false);
                                    }
                                })();
                            }, children: t('timeTrackingPage.common.edit') }), _jsx("button", { type: "button", className: "pp__actions-item", disabled: actionBusy, onClick: () => {
                                setActionOpen(null);
                                navigate(getProjectDetailUrl(openActionProject.id, openActionProject.clientId));
                            }, children: t('timeTrackingPage.projects.actions.open') }), openActionProject.status !== 'archived' && (_jsx("button", { type: "button", className: "pp__actions-item", disabled: !canManage || actionBusy, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => {
                                void (async () => {
                                    if (!canManage)
                                        return;
                                    const pausing = openActionProject.status !== 'paused';
                                    if (pausing) {
                                        const okPause = await showConfirm({
                                            title: t('timeTrackingPage.projects.pauseConfirm.title'),
                                            message: t('timeTrackingPage.projects.pauseConfirm.message').replace('{name}', openActionProject.name),
                                            confirmLabel: t('timeTrackingPage.projects.actions.pause'),
                                        });
                                        if (!okPause)
                                            return;
                                    }
                                    setActionBusy(true);
                                    try {
                                        await patchClientProject(openActionProject.clientId, openActionProject.id, buildProjectPauseTogglePatch(pausing));
                                        setActionOpen(null);
                                        await reloadProjects();
                                        showToast({
                                            message: pausing
                                                ? t('timeTrackingPage.projects.pauseConfirm.paused')
                                                : t('timeTrackingPage.projects.pauseConfirm.resumed'),
                                            variant: 'success',
                                        });
                                    }
                                    catch (e) {
                                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.updateFailed') });
                                    }
                                    finally {
                                        setActionBusy(false);
                                    }
                                })();
                            }, children: openActionProject.status === 'paused'
                                ? t('timeTrackingPage.projects.actions.resume')
                                : t('timeTrackingPage.projects.actions.pause') })), _jsx("button", { type: "button", className: "pp__actions-item", disabled: !canManage || actionBusy, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => {
                                void (async () => {
                                    if (!canManage)
                                        return;
                                    const restoring = openActionProject.status === 'archived';
                                    if (!restoring) {
                                        const okArchive = await showConfirm({
                                            title: t('timeTrackingPage.projects.archiveConfirm.title'),
                                            message: t('timeTrackingPage.projects.archiveConfirm.message').replace('{name}', openActionProject.name),
                                            confirmLabel: t('timeTrackingPage.projects.actions.toArchive'),
                                        });
                                        if (!okArchive)
                                            return;
                                    }
                                    setActionBusy(true);
                                    try {
                                        await patchClientProject(openActionProject.clientId, openActionProject.id, buildProjectArchiveTogglePatch(!restoring));
                                        setActionOpen(null);
                                        await reloadProjects();
                                        showToast({
                                            message: restoring
                                                ? t('timeTrackingPage.projects.archiveConfirm.restored')
                                                : t('timeTrackingPage.projects.archiveConfirm.archived'),
                                            variant: 'success',
                                        });
                                    }
                                    catch (e) {
                                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.updateFailed') });
                                    }
                                    finally {
                                        setActionBusy(false);
                                    }
                                })();
                            }, children: openActionProject.status === 'archived' ? t('timeTrackingPage.projects.actions.restore') : t('timeTrackingPage.projects.actions.toArchive') }), _jsx("div", { className: "pp__actions-sep" }), _jsx("button", { type: "button", className: "pp__actions-item pp__actions-item--danger", disabled: !canManage || actionBusy || openActionProject.deletable === false, title: !canManage
                                ? t('timeTrackingPage.common.manageRoleHint')
                                : openActionProject.deletable === false
                                    ? t('timeTrackingPage.projects.actions.deleteBlocked')
                                    : undefined, onClick: () => {
                                void (async () => {
                                    if (!canManage)
                                        return;
                                    if (openActionProject.deletable === false) {
                                        await showAlert({ message: `${t('timeTrackingPage.projects.actions.deleteBlocked')}.` });
                                        return;
                                    }
                                    const okDelete = await showConfirm({
                                        title: t('timeTrackingPage.projects.deleteConfirm.title'),
                                        message: t('timeTrackingPage.projects.deleteConfirm.message').replace('{name}', openActionProject.name),
                                        variant: 'danger',
                                        confirmLabel: t('timeTrackingPage.delete'),
                                    });
                                    if (!okDelete)
                                        return;
                                    setActionBusy(true);
                                    try {
                                        await deleteClientProject(openActionProject.clientId, openActionProject.id);
                                        setActionOpen(null);
                                        await reloadProjects();
                                    }
                                    catch (e) {
                                        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.projects.errors.deleteFailed') });
                                    }
                                    finally {
                                        setActionBusy(false);
                                    }
                                })();
                            }, children: t('timeTrackingPage.delete') })] }), document.body), editModalOpen && editInitial && (_jsx(ClientProjectModal, { mode: "edit", fixedClientId: editInitial.client_id, initial: editInitial, canManage: canManage, onClose: () => {
                    setEditModalOpen(false);
                    setEditInitial(null);
                }, onSaved: () => {
                    void reloadProjects();
                } }, editModalKey))] }));
}
