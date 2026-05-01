import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedLink } from '@shared/ui';
import { useNavigate } from 'react-router-dom';
import { listAllTimeManagerClientsMerged, listAllClientProjectsForClientMerged, getClientProject, patchClientProject, deleteClientProject, isForbiddenError, type TimeManagerClientRow, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination, SearchableSelect, useAppDialog } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeManagerClients } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
import type { ProjectRow, ProjectStatus, ProjectType } from '@entities/time-tracking/model/types';
import { getProjectDetailUrl, getTimeTrackingNewProjectUrl } from '@shared/config';
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
function remainingPct(budget: number, spent: number) {
    if (!Number.isFinite(budget) || budget <= 0)
        return 0;
    return Math.round(((budget - spent) / budget) * 100);
}
function spentPct(budget: number, spent: number) {
    if (!Number.isFinite(budget) || budget <= 0)
        return 0;
    return Math.min((spent / budget) * 100, 100);
}
const PP_ACTIONS_MENU_FALLBACK_W = 96;
function todayLocalIsoDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const STATUS_LABEL: Record<ProjectStatus, string> = {
    active: 'Активные',
    paused: 'На паузе',
    archived: 'Архив',
};
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
};
const STATUS_OPTIONS: ProjectStatus[] = ['active', 'paused', 'archived'];
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
function StatusDropdown({ statusFilter, filteredCount, totalBeforeStatus, statusCounts, onSelect, }: {
    statusFilter: ProjectStatus | '';
    filteredCount: number;
    totalBeforeStatus: number;
    statusCounts: Record<ProjectStatus, number>;
    onSelect: (s: ProjectStatus | '') => void;
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
        ? `${STATUS_LABEL[statusFilter]} (${filteredCount})`
        : `Все проекты (${filteredCount})`;
    return (<div ref={ref} className="pp__status-wrap">
      <button type="button" className="pp__status-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label} <IcoChevron cls={`pp__status-chevron${open ? ' pp__status-chevron--open' : ''}`}/>
      </button>
      {open && (<div className="pp__status-dropdown">
          <button type="button" className={`pp__status-opt${!statusFilter ? ' pp__status-opt--on' : ''}`} onClick={() => {
                onSelect('');
                setOpen(false);
            }}>
            {!statusFilter && <IcoCheck />} Все проекты ({totalBeforeStatus})
          </button>
          {STATUS_OPTIONS.map((s) => {
                const cnt = statusCounts[s];
                return (<button key={s} type="button" className={`pp__status-opt${statusFilter === s ? ' pp__status-opt--on' : ''}`} onClick={() => {
                        onSelect(s);
                        setOpen(false);
                    }}>
                <span className="pp__status-dot" style={{ background: STATUS_DOT[s] }}/>
                {statusFilter === s && <IcoCheck />} {STATUS_LABEL[s]} ({cnt})
              </button>);
            })}
        </div>)}
    </div>);
}
type PpStrFilterOption = {
    key: string;
};

function BudgetBar({ budget, spent }: {
    budget: number;
    spent: number;
}) {
    const over = spent > budget;
    const bluePct = over ? 100 : spentPct(budget, spent);
    const redPct = over ? Math.min(((spent - budget) / budget) * 80, 45) : 0;
    return (<div className="pp__bar-wrap" title={`Потрачено: ${fmtAmt(spent)} / Бюджет: ${fmtAmt(budget)}`}>
      <div className="pp__bar">
        <div className="pp__bar-fill pp__bar-fill--blue" style={{ width: `${bluePct}%` }}/>
        {over && <div className="pp__bar-fill pp__bar-fill--red" style={{ width: `${redPct}%` }}/>}
      </div>
    </div>);
}
export function ProjectsPanel() {
    const navigate = useNavigate();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const canManage = canManageTimeManagerClients(user?.role);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [rows, setRows] = useState<ProjectRow[]>([]);
    const [apiClients, setApiClients] = useState<TimeManagerClientRow[]>([]);
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('active');
    const [clientFilter, setClientFilter] = useState('');
    const [managerFilter, setManagerFilter] = useState('');
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
    const reloadProjects = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const clients = await listAllTimeManagerClientsMerged();
            setApiClients(clients);
            const out: ProjectRow[] = [];
            for (const c of clients) {
                try {
                    const projs = await listAllClientProjectsForClientMerged(c.id);
                    for (const p of projs) {
                        out.push(mapClientProjectToProjectRow(p, c));
                    }
                }
                catch (e) {
                    if (!isForbiddenError(e))
                        throw e;
                }
            }
            setRows(out);
        }
        catch (e) {
            setRows([]);
            setApiClients([]);
            setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить проекты');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void reloadProjects();
    }, [reloadProjects]);
    useEffect(() => {
        setProjectsTablePage(1);
    }, [statusFilter, clientFilter, managerFilter]);
    const clientNames = useMemo(() => [...new Set(rows.map((p) => p.client))].sort(), [rows]);
    const managers = useMemo(() => {
        const all = rows.flatMap((p) => p.managers ?? []);
        return [...new Set(all)].sort();
    }, [rows]);
    const clientFilterOptions = useMemo((): PpStrFilterOption[] => [{ key: '' }, ...clientNames.map((n) => ({ key: n }))], [clientNames]);
    const managerFilterOptions = useMemo((): PpStrFilterOption[] => [{ key: '' }, ...managers.map((m) => ({ key: m }))], [managers]);
    const baseFiltered = useMemo(() => rows.filter((p) => {
        if (clientFilter && p.client !== clientFilter)
            return false;
        if (managerFilter && !(p.managers ?? []).includes(managerFilter))
            return false;
        return true;
    }), [rows, clientFilter, managerFilter]);
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
          <h1 className="pp__title">Проекты</h1>
          <StatusDropdown statusFilter={statusFilter} filteredCount={filtered.length} totalBeforeStatus={baseFiltered.length} statusCounts={statusCounts} onSelect={setStatusFilter}/>
        </div>
        <div className="pp__topbar-right">
          <SearchableSelect<PpStrFilterOption> className={`tsp-srch--pp${clientFilter ? ' tsp-srch--pp--active' : ''}`} buttonId={clientFilterBtnId} value={clientFilter} items={clientFilterOptions} getOptionValue={(o) => o.key} getOptionLabel={(o) => (o.key ? o.key : 'Все клиенты')} getSearchText={(o) => (o.key || 'все клиенты')} onSelect={(o) => setClientFilter(o.key)} portalDropdown portalZIndex={5000} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" placeholder="По клиенту" emptyListText="Нет клиентов" noMatchText="Нет совпадений" renderButtonContent={(o) => (<span>
                {o.key ? o.key : 'По клиенту'}
              </span>)}/>
          {managers.length > 0 && (<SearchableSelect<PpStrFilterOption> className={`tsp-srch--pp${managerFilter ? ' tsp-srch--pp--active' : ''}`} buttonId={managerFilterBtnId} value={managerFilter} items={managerFilterOptions} getOptionValue={(o) => o.key} getOptionLabel={(o) => (o.key ? o.key : 'Все менеджеры')} getSearchText={(o) => (o.key || 'все менеджер')} onSelect={(o) => setManagerFilter(o.key)} portalDropdown portalZIndex={5000} portalMinWidth={240} portalDropdownClassName="tsp-srch__dropdown--tall" placeholder="По менеджеру" emptyListText="Нет менеджеров" noMatchText="Нет совпадений" renderButtonContent={(o) => (<span>
                {o.key ? o.key : 'По менеджеру'}
              </span>)}/>)}
          <button type="button" className="pp__new-btn" disabled={!canManage} title={!canManage
            ? 'Доступно главному администратору, администратору и партнёру'
            : undefined} onClick={goToNewProject}>
            <IcoPlus /> Новый проект
          </button>
        </div>
      </div>
      <div className="pp__table-wrap">
        <div className="pp__table">
          <div className="pp__thead">
            <span className="pp__th pp__th--check">
              <span className="pp__checkbox"/>
            </span>
            <span className="pp__th pp__th--name">Клиент / Проект</span>
            <span className="pp__th pp__th--budget">Бюджет</span>
            <span className="pp__th pp__th--spent">Потрачено</span>
            <span className="pp__th pp__th--bar"/>
            <span className="pp__th pp__th--remaining">Остаток</span>
            <span className="pp__th pp__th--costs">Затраты</span>
            <span className="pp__th pp__th--actions"/>
          </div>
          {filtered.length === 0 && (<div className="pp__empty">
              <IcoFolder />
              <span>
                {rows.length === 0
                ? 'Нет проектов. Создайте первый через «Новый проект».'
                : 'Нет проектов по выбранным фильтрам'}
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
                      {projects.length === 1 ? 'проект' : projects.length < 5 ? 'проекта' : 'проектов'}
                    </span>
                    {isCollapsed && (<span className="pp__client-total" title="Потрачено по валютам проектов клиента">
                        {fmtGroupSpentByCurrency(projects)}
                      </span>)}
                  </div>
                  {canManage && clientIdForContact != null && (<button type="button" className="pp__client-add-contact" disabled={clientArchivedForContact} title={clientArchivedForContact
                        ? 'Клиент в архиве — сначала разархивируйте в карточке клиента'
                        : 'Добавить контакт к этому клиенту'} onClick={(e) => {
                        e.stopPropagation();
                        setContactModalClient({
                            id: clientIdForContact,
                            name: client,
                            is_archived: clientArchivedForContact,
                        });
                    }}>
                      <IcoPlus />
                      <span>Контакт</span>
                    </button>)}
                </div>
                {!isCollapsed &&
                    projects.map((p) => {
                        const hasBudget = p.budget != null;
                        const over = hasBudget && p.spent > p.budget!;
                        const rem = hasBudget ? p.budget! - p.spent : null;
                        const pct = hasBudget && p.budget! > 0 ? remainingPct(p.budget!, p.spent) : null;
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
                            {p.type}
                          </span>
                        </span>
                        <span className="pp__td pp__td--budget">
                          {hasBudget ? fmtAmt(p.budget!, p.currency) : <span className="pp__dash">—</span>}
                        </span>
                        <span className="pp__td pp__td--spent">
                          {p.spent > 0 || hasBudget ? fmtAmt(p.spent, p.currency) : <span className="pp__dash">—</span>}
                        </span>
                        <span className="pp__td pp__td--bar">
                          {hasBudget && p.spent > 0 && <BudgetBar budget={p.budget!} spent={p.spent}/>}
                        </span>
                        <span className={`pp__td pp__td--remaining${over ? ' pp__td--over' : ''}`}>
                          {rem != null ? (<>
                              <span className="pp__rem-val">
                                {over ? '−' : ''}
                                {fmtAmt(Math.abs(rem), p.currency)}
                              </span>
                              {pct != null && (<span className={`pp__rem-pct${over ? ' pp__rem-pct--over' : ''}`}>
                                  ({over ? '-' : ''}
                                  {Math.abs(pct)}%)
                                </span>)}
                            </>) : (<span className="pp__dash">—</span>)}
                        </span>
                        <span className="pp__td pp__td--costs">
                          {p.costs > 0 ? (<span className="pp__costs-val">{fmtAmt(p.costs, p.currency)}</span>) : (<span className="pp__zero">0,00 {p.currency}</span>)}
                        </span>
                        <span className="pp__td pp__td--actions" onClick={(e) => e.stopPropagation()}>
                          <div className="pp__actions-wrap" ref={isActOpen ? actionRef : undefined}>
                            <button type="button" className={`pp__actions-btn${isActOpen ? ' pp__actions-btn--open' : ''}`} onClick={() => setActionOpen(isActOpen ? null : p.id)}>
                              Действия <IcoChevron cls={`pp__actions-chevron${isActOpen ? ' pp__actions-chevron--open' : ''}`}/>
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
            <button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined} onClick={() => {
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
                            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось загрузить проект' });
                        }
                        finally {
                            setActionBusy(false);
                        }
                    })();
                }}>
              Редактировать
            </button>
            <button type="button" className="pp__actions-item" disabled={actionBusy} onClick={() => {
                    setActionOpen(null);
                    navigate(getProjectDetailUrl(openActionProject.id, openActionProject.clientId));
                }}>
              Открыть
            </button>
            <button type="button" className="pp__actions-item" disabled={!canManage || actionBusy} title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined} onClick={() => {
                    void (async () => {
                        if (!canManage)
                            return;
                        setActionBusy(true);
                        try {
                            if (openActionProject.status === 'archived') {
                                await patchClientProject(openActionProject.clientId, openActionProject.id, { endDate: null });
                            }
                            else {
                                await patchClientProject(openActionProject.clientId, openActionProject.id, {
                                    endDate: todayLocalIsoDate(),
                                });
                            }
                            setActionOpen(null);
                            await reloadProjects();
                        }
                        catch (e) {
                            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось обновить проект' });
                        }
                        finally {
                            setActionBusy(false);
                        }
                    })();
                }}>
              {openActionProject.status === 'archived' ? 'Восстановить' : 'В архив'}
            </button>
            <div className="pp__actions-sep"/>
            <button type="button" className="pp__actions-item pp__actions-item--danger" disabled={!canManage || actionBusy || openActionProject.deletable === false} title={!canManage
                    ? 'Доступно главному администратору, администратору и партнёру'
                    : openActionProject.deletable === false
                        ? 'Удаление недоступно: у проекта есть связанные данные'
                        : undefined} onClick={() => {
                    void (async () => {
                        if (!canManage)
                            return;
                        if (openActionProject.deletable === false) {
                            await showAlert({ message: 'Удаление недоступно: у проекта есть связанные данные.' });
                            return;
                        }
                        const okDelete = await showConfirm({
                            title: 'Удалить проект?',
                            message: `Удалить проект «${openActionProject.name}»? Это действие необратимо.`,
                            variant: 'danger',
                            confirmLabel: 'Удалить',
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
                            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось удалить проект' });
                        }
                        finally {
                            setActionBusy(false);
                        }
                    })();
                }}>
              Удалить
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
