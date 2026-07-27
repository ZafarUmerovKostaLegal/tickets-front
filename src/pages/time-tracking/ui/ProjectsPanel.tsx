import './TimeTrackingForms.css';
import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedLink } from '@shared/ui';
import { useNavigate } from 'react-router-dom';
import { listAllTimeManagerClientsMerged, listAllClientProjectsMerged, fetchProjectsBudgetMetrics, applyBudgetMetricsToProjects, getClientProject, patchClientProject, deleteClientProject, type TimeManagerClientRow, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { listPartners } from '@entities/user';
import type { UserPublic } from '@entities/user';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination, SearchableSelect, useAppDialog } from '@shared/ui';
import { showToast } from '@shared/ui/app-toast';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
import { buildProjectArchiveTogglePatch, buildProjectPauseTogglePatch } from '@entities/time-tracking/lib/projectArchiveRestore';
import { exportProjectsListExcel } from '@entities/time-tracking/lib/exportProjectsListExcel';
import { readInitialProjectsFilters, writeProjectsFiltersToStorage } from '@entities/time-tracking/lib/projectsFiltersStorage';
import type { ProjectRow, ProjectStatus, ProjectType } from '@entities/time-tracking/model/types';
import { getProjectDetailUrl, getTimeTrackingNewProjectUrl } from '@shared/config';
import { useI18n, ttProjectStatusLabel, ttProjectTypeLabel, ttProjectPluralWord } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { ProjectsSkeleton } from './ProjectsSkeleton';
import { ClientProjectModal } from './TimeTrackingClientProjectModal';
import { AddClientContactForClientModal } from './AddClientContactForClientModal';
function fmtAmt(n: number, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU')} ${cur}`;
}
function fmtGroupSpentByCurrency(projects: ProjectRow[]): string {
    const m = new Map<string, number>();
    for (const p of projects) {
        const c = (p.currency || 'USD').trim() || 'USD';
        const add = Number.isFinite(p.spent) ? p.spent : 0;
        m.set(c, (m.get(c) ?? 0) + add);
    }
    if (m.size === 0)
        return '—';
    const parts = [...m.entries()].sort(([a], [b]) => {
        const rank = (x: string) => (x === 'USD' ? 0 : x === 'UZS' ? 1 : 2);
        return rank(a) - rank(b) || a.localeCompare(b, 'en');
    });
    return parts.map(([cur, sum]) => fmtAmt(sum, cur)).join(' · ');
}
function remainingPct(budget: number, spent: number): number | null {
    if (!Number.isFinite(budget) || budget <= 0)
        return null;
    const pct = Math.round(((budget - spent) / budget) * 100);
    return Number.isFinite(pct) ? pct : null;
}
function spentPct(budget: number, spent: number) {
    if (!Number.isFinite(budget) || budget <= 0)
        return 0;
    return Math.min((spent / budget) * 100, 100);
}
const PP_ACTIONS_MENU_FALLBACK_W = 96;
const STATUS_DOT: Record<ProjectStatus, string> = {
    active: '#22c55e',
    paused: '#f59e0b',
    archived: '#94a3b8',
};
const TYPE_COLOR: Record<ProjectType, {
    color: string;
    bg: string;
}> = {
    'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'Пакет часов': { color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
};
const STATUS_OPTIONS: ProjectStatus[] = ['active', 'paused', 'archived'];
const PP_PARTNER_FILTER_NONE = '__none__';
const IcoChevron = ({ cls = '' }: {
    cls?: string;
}) => (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>);
const IcoPlus = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>);
const IcoCheck = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>);
const IcoFolder = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>);
const IcoSearch = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>);
const IcoDownload = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>);
function matchesProjectSearch(p: ProjectRow, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q)
        return true;
    const hay = `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim().toLowerCase();
    return hay.includes(q);
}
function StatusDropdown({ statusFilter, filteredCount, totalBeforeStatus, statusCounts, onSelect, t, }: {
    statusFilter: ProjectStatus | '';
    filteredCount: number;
    totalBeforeStatus: number;
    statusCounts: Record<ProjectStatus, number>;
    onSelect: (s: ProjectStatus | '') => void;
    t: ReturnType<typeof useI18n>['t'];
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const label = statusFilter
        ? `${ttProjectStatusLabel(statusFilter, t)} (${filteredCount})`
        : t('timeTrackingPage.projects.allProjectsFilter').replace('{count}', String(filteredCount));
    return (<div ref={ref} className="pp__status-wrap">
      <button type="button" className="pp__status-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label} <IcoChevron cls={`pp__status-chevron${open ? ' pp__status-chevron--open' : ''}`}/>
      </button>
      {open && (<div className="pp__status-dropdown">
          <button type="button" className={`pp__status-opt${!statusFilter ? ' pp__status-opt--on' : ''}`} onClick={() => {
                onSelect('');
                setOpen(false);
            }}>
            {!statusFilter && <IcoCheck />} {t('timeTrackingPage.projects.allProjectsFilter').replace('{count}', String(totalBeforeStatus))}
          </button>
          {STATUS_OPTIONS.map((s) => {
                const cnt = statusCounts[s];
                return (<button key={s} type="button" className={`pp__status-opt${statusFilter === s ? ' pp__status-opt--on' : ''}`} onClick={() => {
                        onSelect(s);
                        setOpen(false);
                    }}>
                <span className="pp__status-dot" style={{ background: STATUS_DOT[s] }}/>
                {statusFilter === s && <IcoCheck />} {ttProjectStatusLabel(s, t)} ({cnt})
              </button>);
            })}
        </div>)}
    </div>);
}
type PpStrFilterOption = {
    key: string;
};
type PpPartnerFilterOption = {
    key: string;
    label: string;
};

function BudgetBar({ progressPercent, budget, spent, t, }: {
    progressPercent?: number | null;
    budget?: number;
    spent?: number;
    t: ReturnType<typeof useI18n>['t'];
}) {
    const fallbackPct = (budget != null && spent != null) ? spentPct(budget, spent) : 0;
    const pct = Number.isFinite(progressPercent as number) ? Math.max(0, Number(progressPercent)) : fallbackPct;
    const over = pct > 100;
    const bluePct = Math.min(pct, 100);
    const redPct = over ? Math.min((pct - 100) * 0.8, 45) : 0;
    const title = Number.isFinite(progressPercent as number)
        ? t('timeTrackingPage.projects.table.progressTitle').replace('{percent}', String(Math.round(Number(progressPercent))))
        : t('timeTrackingPage.projects.table.spentBudgetTitle')
            .replace('{spent}', fmtAmt(spent ?? 0))
            .replace('{budget}', fmtAmt(budget ?? 0));
    return (<div className="pp__bar-wrap" title={title}>
      <div className="pp__bar">
        <div className="pp__bar-fill pp__bar-fill--blue" style={{ width: `${bluePct}%` }}/>
        {over && <div className="pp__bar-fill pp__bar-fill--red" style={{ width: `${redPct}%` }}/>}
      </div>
    </div>);
}
export function ProjectsPanel() {
    const navigate = useNavigate();
    const { t, locale } = useI18n();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const canManage = canManageTimeTrackingClients(user);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [apiProjects, setApiProjects] = useState<TimeManagerClientProjectRow[]>([]);
    const [apiClients, setApiClients] = useState<TimeManagerClientRow[]>([]);
    const initialFilters = useMemo(() => readInitialProjectsFilters(), []);
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>(initialFilters.statusFilter);
    const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
    const [clientFilter, setClientFilter] = useState(initialFilters.clientFilter);
    const [managerFilter, setManagerFilter] = useState(initialFilters.managerFilter);
    const [partnerFilter, setPartnerFilter] = useState(initialFilters.partnerFilter);
    const [partnerOptions, setPartnerOptions] = useState<PpPartnerFilterOption[]>([]);
    const [projectsTablePage, setProjectsTablePage] = useState(1);
    const PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [actionOpen, setActionOpen] = useState<string | null>(null);
    const [menuPlacement, setMenuPlacement] = useState<{
        top: number;
        left: number;
        minWidth: number;
        maxWidth: number;
    } | null>(null);
    const actionRef = useRef<HTMLDivElement>(null);
    const menuPortalRef = useRef<HTMLDivElement>(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);
    const [contactModalClient, setContactModalClient] = useState<{
        id: string;
        name: string;
        is_archived: boolean;
    } | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editModalKey, setEditModalKey] = useState(0);
    const [editInitial, setEditInitial] = useState<TimeManagerClientProjectRow | null>(null);
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
        const out: ProjectRow[] = [];
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
            .then((items: UserPublic[]) => {
                if (cancelled)
                    return;
                const opts: PpPartnerFilterOption[] = items
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
    const clientFilterOptions = useMemo((): PpStrFilterOption[] => [{ key: '' }, ...clientNames.map((n) => ({ key: n }))], [clientNames]);
    const managerFilterOptions = useMemo((): PpStrFilterOption[] => [{ key: '' }, ...managers.map((m) => ({ key: m }))], [managers]);
    const partnerFilterOptions = useMemo((): PpPartnerFilterOption[] => ([
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
    const visibleProjectIdsKey = useMemo(
        () => projectsPageSlice.map((project) => project.id).sort().join(','),
        [projectsPageSlice],
    );
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
        const map = new Map<string, ProjectRow[]>();
        for (const p of projectsPageSlice) {
            if (!map.has(p.client))
                map.set(p.client, []);
            map.get(p.client)!.push(p);
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
        const h = (e: MouseEvent) => {
            const t = e.target as Node;
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
    function toggleSelect(id: string) {
        setSelectedIds((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }
    function toggleCollapse(client: string) {
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
        return <ProjectsSkeleton />;
    return (<div className="pp">
      {loadError && (<p className="tt-settings__banner-error pp__load-error" role="alert">
          {loadError}
        </p>)}
      <div className="pp__topbar">
        <div className="pp__topbar-left">
          <h1 className="pp__title">{t('timeTrackingPage.projects.title')}</h1>
          <StatusDropdown statusFilter={statusFilter} filteredCount={filtered.length} totalBeforeStatus={baseFiltered.length} statusCounts={statusCounts} onSelect={setStatusFilter} t={t}/>
        </div>
        <div className="pp__topbar-right">
          <div className="tt-settings__search-wrap pp__projects-search">
            <span className="tt-settings__search-icon">
              <IcoSearch />
            </span>
            <input type="search" className="tt-settings__search" placeholder={t('timeTrackingPage.projects.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label={t('timeTrackingPage.projects.searchAria')}/>
          </div>
          <SearchableSelect<PpStrFilterOption> className={`tsp-srch--pp${clientFilter ? ' tsp-srch--pp--active' : ''}`} buttonId={clientFilterBtnId} value={clientFilter} items={clientFilterOptions} getOptionValue={(o) => o.key} getOptionLabel={(o) => (o.key ? o.key : t('timeTrackingPage.common.allClients'))} getSearchText={(o) => (o.key || t('timeTrackingPage.common.allClients').toLowerCase())} onSelect={(o) => setClientFilter(o.key)} portalDropdown portalZIndex={5000} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" placeholder={t('timeTrackingPage.projects.filterByClient')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.noMatch')} renderButtonContent={(o) => (<span>
                {o.key ? o.key : t('timeTrackingPage.projects.filterByClient')}
              </span>)}/>
          {partnerOptions.length > 0 && (<SearchableSelect<PpPartnerFilterOption> className={`tsp-srch--pp${partnerFilter ? ' tsp-srch--pp--active' : ''}`} buttonId={partnerFilterBtnId} value={partnerFilter} items={partnerFilterOptions} getOptionValue={(o) => o.key} getOptionLabel={(o) => o.label} getSearchText={(o) => o.label.toLowerCase()} onSelect={(o) => setPartnerFilter(o.key)} portalDropdown portalZIndex={5000} portalMinWidth={260} portalDropdownClassName="tsp-srch__dropdown--tall" placeholder={t('timeTrackingPage.projects.filterByPartner')} emptyListText={t('timeTrackingPage.projects.noPartners')} noMatchText={t('timeTrackingPage.common.noMatch')} renderButtonContent={(o) => (<span>
                {o.key ? o.label : t('timeTrackingPage.projects.filterByPartner')}
              </span>)}/>)}
          {managers.length > 0 && (<SearchableSelect<PpStrFilterOption> className={`tsp-srch--pp${managerFilter ? ' tsp-srch--pp--active' : ''}`} buttonId={managerFilterBtnId} value={managerFilter} items={managerFilterOptions} getOptionValue={(o) => o.key} getOptionLabel={(o) => (o.key ? o.key : t('timeTrackingPage.common.allManagers'))} getSearchText={(o) => (o.key || t('timeTrackingPage.common.allManagers').toLowerCase())} onSelect={(o) => setManagerFilter(o.key)} portalDropdown portalZIndex={5000} portalMinWidth={240} portalDropdownClassName="tsp-srch__dropdown--tall" placeholder={t('timeTrackingPage.projects.filterByManager')} emptyListText={t('timeTrackingPage.projects.noManagers')} noMatchText={t('timeTrackingPage.common.noMatch')} renderButtonContent={(o) => (<span>
                {o.key ? o.key : t('timeTrackingPage.projects.filterByManager')}
              </span>)}/>)}
          {partnerOptions.length > 0 && (
            <button
              type="button"
              className="pp__export-btn"
              disabled={exportBusy || !partnerExportReady || filtered.length === 0}
              title={!partnerExportReady
                ? t('timeTrackingPage.projects.exportPartnerHint')
                : filtered.length === 0
                  ? t('timeTrackingPage.projects.exportPartnerEmpty')
                  : undefined}
              onClick={() => void handleExportPartnerProjects()}
            >
              <IcoDownload />
              {exportBusy
                ? t('timeTrackingPage.common.loading')
                : t('timeTrackingPage.projects.exportPartnerList')}
            </button>
          )}
          <button type="button" className="pp__new-btn" disabled={!canManage} title={!canManage
            ? t('timeTrackingPage.common.manageRoleHint')
            : undefined} onClick={goToNewProject}>
            <IcoPlus /> {t('timeTrackingPage.projects.newProject')}
          </button>
        </div>
      </div>
      <div className="pp__table-wrap">
        <div className="pp__table">
          <div className="pp__thead">
            <span className="pp__th pp__th--check">
              <span className="pp__checkbox"/>
            </span>
            <span className="pp__th pp__th--name">{t('timeTrackingPage.projects.table.clientProject')}</span>
            <span className="pp__th pp__th--budget">{t('timeTrackingPage.projects.table.budget')}</span>
            <span className="pp__th pp__th--spent">{t('timeTrackingPage.projects.table.spent')}</span>
            <span className="pp__th pp__th--bar"/>
            <span className="pp__th pp__th--remaining">{t('timeTrackingPage.projects.table.remaining')}</span>
            <span className="pp__th pp__th--costs">{t('timeTrackingPage.projects.table.costs')}</span>
            <span className="pp__th pp__th--actions"/>
          </div>
          {filtered.length === 0 && (<div className="pp__empty">
              <IcoFolder />
              <span>
                {rows.length === 0
                ? t('timeTrackingPage.projects.empty.noProjects')
                : t('timeTrackingPage.projects.empty.noFilterMatch')}
              </span>
            </div>)}
          {groupedPage.map(([client, projects]) => {
            const isCollapsed = collapsed.has(client);
            const clientApi = apiClients.find((c) => c.name === client);
            const clientIdForContact = clientApi?.id;
            const clientArchivedForContact = clientApi?.is_archived ?? false;
            return (<div key={client} className={`pp__group${isCollapsed ? ' pp__group--collapsed' : ''}`}>
                <div className="pp__client-row">
                  <div className="pp__client-row-main" onClick={() => toggleCollapse(client)} role="button" tabIndex={0} aria-expanded={!isCollapsed} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCollapse(client)}>
                    <span className={`pp__client-chevron${!isCollapsed ? ' pp__client-chevron--open' : ''}`}>
                      <IcoChevron />
                    </span>
                    <span className="pp__client-name">{client}</span>
                    <span className="pp__client-meta">
                      {projects.length}{' '}
                      {ttProjectPluralWord(projects.length, t, locale)}
                    </span>
                    {isCollapsed && (<span className="pp__client-total" title={t('timeTrackingPage.projects.table.spentByCurrencyTitle')}>
                        {fmtGroupSpentByCurrency(projects)}
                      </span>)}
                  </div>
                  {canManage && clientIdForContact != null && (<button type="button" className="pp__client-add-contact" disabled={clientArchivedForContact} title={clientArchivedForContact
                        ? t('timeTrackingPage.projects.actions.clientArchivedContact')
                        : t('timeTrackingPage.projects.actions.addContact')} onClick={(e) => {
                        e.stopPropagation();
                        setContactModalClient({
                            id: clientIdForContact,
                            name: client,
                            is_archived: clientArchivedForContact,
                        });
                    }}>
                      <IcoPlus />
                      <span>{t('timeTrackingPage.common.contact')}</span>
                    </button>)}
                </div>
                {!isCollapsed &&
                    projects.map((p) => {
                        const hasBudgetConfigured = p.hasBudgetConfigured !== false;
                        const hasBudget = p.budget != null;
                        const spentVal = Number.isFinite(p.spent) ? p.spent : 0;
                        const rem = p.remaining ?? (hasBudget ? p.budget! - spentVal : null);
                        const over = rem != null && rem < 0;
                        const budgetVal = p.budget ?? 0;
                        const pctRaw = hasBudget && budgetVal > 0
                            ? (Number.isFinite(p.progressPercent as number)
                                ? Math.round(Number(p.progressPercent))
                                : remainingPct(budgetVal, spentVal))
                            : null;
                        const pct = pctRaw != null && Number.isFinite(pctRaw) ? pctRaw : null;
                        const typeMeta = TYPE_COLOR[p.type];
                        const isSelected = selectedIds.has(p.id);
                        const isActOpen = actionOpen === p.id;
                        return (<div key={p.id} className={`pp__row${isSelected ? ' pp__row--selected' : ''}`} onClick={() => navigate(getProjectDetailUrl(p.id, p.clientId))} style={{ cursor: 'pointer' }}>
                        <span className="pp__td pp__td--check" onClick={(e) => e.stopPropagation()}>
                          <span className={`pp__checkbox${isSelected ? ' pp__checkbox--on' : ''}`} onClick={() => toggleSelect(p.id)} role="checkbox" aria-checked={isSelected} tabIndex={0} onKeyDown={(e) => e.key === ' ' && toggleSelect(p.id)}>
                            {isSelected && <IcoCheck />}
                          </span>
                        </span>
                        <span className="pp__td pp__td--name">
                          <AnimatedLink className="pp__proj-name pp__proj-name--link" to={getProjectDetailUrl(p.id, p.clientId)}>
                            <span className="pp__proj-dot" style={{ background: STATUS_DOT[p.status] }}/>
                            {p.name}
                          </AnimatedLink>
                          <span className="pp__type-badge" style={{ color: typeMeta.color, background: typeMeta.bg }}>
                            {ttProjectTypeLabel(p.type, t)}
                          </span>
                        </span>
                        <span className="pp__td pp__td--budget">
                          {!hasBudgetConfigured
                                ? (<span className="pp__dash">{t('timeTrackingPage.projects.table.noBudget')}</span>)
                                : hasBudget
                                    ? fmtAmt(p.budget!, p.currency)
                                    : fmtAmt(0, p.currency)}
                        </span>
                        <span
                          className="pp__td pp__td--spent pp__metric-cell"
                          title={p.loggedHours != null
                            ? `${fmtAmt(spentVal, p.currency)} · ${t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', p.loggedHours.toLocaleString(localeTag(locale)))}`
                            : fmtAmt(spentVal, p.currency)}
                        >
                          <span className="pp__metric-primary">{fmtAmt(spentVal, p.currency)}</span>
                          {p.loggedHours != null ? (
                            <span className="pp__metric-sub">
                              {t('timeTrackingPage.projects.table.hoursLogged').replace('{hours}', p.loggedHours.toLocaleString(localeTag(locale)))}
                            </span>
                          ) : null}
                        </span>
                        <span className="pp__td pp__td--bar">
                          <BudgetBar progressPercent={p.progressPercent} budget={p.budget} spent={spentVal} t={t}/>
                        </span>
                        <span className={`pp__td pp__td--remaining pp__metric-cell${over ? ' pp__td--over' : ''}`}>
                          {rem != null ? (<>
                              <span className="pp__metric-primary pp__rem-val">
                                {over ? '−' : ''}
                                {fmtAmt(Math.abs(rem), p.currency)}
                              </span>
                              {pct != null && (
                                <span className={`pp__metric-sub pp__rem-pct${over ? ' pp__rem-pct--over' : ''}`}>
                                  {over ? '−' : ''}
                                  {Math.abs(pct)}%
                                </span>
                              )}
                            </>) : (<span className="pp__metric-primary pp__dash">{fmtAmt(0, p.currency)}</span>)}
                        </span>
                        <span className="pp__td pp__td--costs">
                          {p.costs > 0 ? (<span className="pp__costs-val">{fmtAmt(p.costs, p.currency)}</span>) : (<span className="pp__zero">0,00 {p.currency}</span>)}
                        </span>
                        <span className="pp__td pp__td--actions" onClick={(e) => e.stopPropagation()}>
                          <div className="pp__actions-wrap" ref={isActOpen ? actionRef : undefined}>
                            <button type="button" className={`pp__actions-btn${isActOpen ? ' pp__actions-btn--open' : ''}`} onClick={() => setActionOpen(isActOpen ? null : p.id)}>
                              {t('timeTrackingPage.projects.actions.actions')} <IcoChevron cls={`pp__actions-chevron${isActOpen ? ' pp__actions-chevron--open' : ''}`}/>
                            </button>
                          </div>
                        </span>
                      </div>);
                    })}
              </div>);
        })}
        </div>
        {filtered.length > PAGE ? (<Pagination className="pp__table-pagination" page={projectsTablePage} totalCount={filtered.length} pageSize={PAGE} onPageChange={setProjectsTablePage}/>) : null}
      </div>

      {contactModalClient && (<AddClientContactForClientModal clientId={contactModalClient.id} clientName={contactModalClient.name} clientArchived={contactModalClient.is_archived} canManage={canManage} onClose={() => setContactModalClient(null)}/>)}

      {actionOpen &&
            openActionProject &&
            createPortal(<div ref={menuPortalRef} className="pp__actions-menu pp__actions-menu--portal" style={menuPlacement
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
                    }} role="menu">
            <button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => {
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
                }}>
              {t('timeTrackingPage.common.edit')}
            </button>
            <button type="button" className="pp__actions-item" disabled={actionBusy} onClick={() => {
                    setActionOpen(null);
                    navigate(getProjectDetailUrl(openActionProject.id, openActionProject.clientId));
                }}>
              {t('timeTrackingPage.projects.actions.open')}
            </button>
            {openActionProject.status !== 'archived' && (<button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => {
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
                }}>
              {openActionProject.status === 'paused'
                    ? t('timeTrackingPage.projects.actions.resume')
                    : t('timeTrackingPage.projects.actions.pause')}
            </button>)}
            <button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => {
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
                }}>
              {openActionProject.status === 'archived' ? t('timeTrackingPage.projects.actions.restore') : t('timeTrackingPage.projects.actions.toArchive')}
            </button>
            <div className="pp__actions-sep"/>
            <button type="button" className="pp__actions-item pp__actions-item--danger" disabled={!canManage || actionBusy || openActionProject.deletable === false} title={!canManage
                    ? t('timeTrackingPage.common.manageRoleHint')
                    : openActionProject.deletable === false
                        ? t('timeTrackingPage.projects.actions.deleteBlocked')
                        : undefined} onClick={() => {
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
                }}>
              {t('timeTrackingPage.delete')}
            </button>
          </div>, document.body)}

      {editModalOpen && editInitial && (<ClientProjectModal key={editModalKey} mode="edit" fixedClientId={editInitial.client_id} initial={editInitial} canManage={canManage} onClose={() => {
                setEditModalOpen(false);
                setEditInitial(null);
            }} onSaved={() => {
                void reloadProjects();
            }}/>)}
    </div>);
}
