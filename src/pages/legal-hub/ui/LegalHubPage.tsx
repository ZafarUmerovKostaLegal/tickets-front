import { addTransitionType, startTransition, useCallback, useEffect, useMemo, useRef, useState, ViewTransition, type ComponentType } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppBackButton, NAV_TRANSITION_TYPE, SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { LegalHubMemberTasks } from './LegalHubMemberTasks';
import { LegalHubMyTasks, type MineTask } from './LegalHubMyTasks';
import { LegalHubTeamBoard, LegalHubUtilRail } from './LegalHubTeamBoard';
import { LegalHubMockProvider } from './legalHubMock';
import { HUB_TASKS, MOCK_DONE_IDS, tasksForMember } from './legalHubTasks';
import { dayDelta, HeadActionsContext, legalHubSectionUrl, type LegalHubNavId } from './legalHubShared';
import { LegalHubChromeProvider } from './legalHubChrome';
import { LegalHubViewProvider, useLegalHubView } from './legalHubView';
import { folderSwatchClass, LegalHubProjectSettings } from './LegalHubProjectSettings';
import { fetchLegalHubBoard, saveLegalHubFolders } from './legalHubBoardApi';
import {
    EMPTY_PROJECT_DISPLAY,
    groupProjects,
    loadProjectDisplay,
    type ProjectDisplaySettings,
    type ProjectFolder,
} from './legalHubProjectDisplay';
import './LegalHubPage.css';


const MINE_ITEMS: { id: 'myTasks' | 'reviewQueue'; labelKey: TranslationKey; icon: ComponentType }[] = [
    { id: 'myTasks', labelKey: 'legalHub.myTasks', icon: IconTasks },
    { id: 'reviewQueue', labelKey: 'legalHub.sideReview', icon: IconShield },
];

function IconMark() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 20h16" />
            <path d="M6 20V10" />
            <path d="M10 20V10" />
            <path d="M14 20V10" />
            <path d="M18 20V10" />
            <path d="M3 10h18" />
            <path d="M12 3 3 10h18L12 3z" />
        </svg>
    );
}

function IconTasks() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 6h13" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M3 6h.01" />
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
        </svg>
    );
}

function IconShield() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3 5 6v6c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6l-7-3z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

function IconTeam() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="3" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a3 3 0 0 1 0 5.75" />
        </svg>
    );
}

function IconLock() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
    );
}

function IconSliders() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
            <circle cx="8" cy="7" r="1.6" fill="var(--app-surface)" />
            <circle cx="15" cy="12" r="1.6" fill="var(--app-surface)" />
            <circle cx="11" cy="17" r="1.6" fill="var(--app-surface)" />
        </svg>
    );
}

function IconChevron({ open }: { open: boolean }) {
    return (
        <svg className={open ? 'is-open' : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
        </svg>
    );
}

function IconSearch() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

function IconUtil() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 12 12 4.5" />
            <path d="M12 12 18.2 16" />
        </svg>
    );
}

function IconMenu() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
        </svg>
    );
}

function IconCollapse({ collapsed }: { collapsed: boolean }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {collapsed
                ? <path d="m9 6 6 6-6 6" />
                : <path d="m15 6-6 6 6 6" />}
        </svg>
    );
}

const SIDEBAR_COLLAPSED_KEY = 'lh-sidebar-collapsed';

const SECTION_HINT: Record<LegalHubNavId, TranslationKey> = {
    myTasks: 'legalHub.myTasksHint',
    reviewQueue: 'legalHub.queueHint',
    projects: 'legalHub.projectsHint',
    allTeam: 'legalHub.teamHint',
};

function parseSection(value: unknown): LegalHubNavId | null {
    if (value === 'myTasks' || value === 'reviewQueue' || value === 'projects' || value === 'allTeam')
        return value;
    return null;
}

function sectionFromState(state: unknown): LegalHubNavId | null {
    if (state == null || typeof state !== 'object' || !('section' in state))
        return null;
    return parseSection((state as { section?: unknown }).section);
}

function LegalHubPageBody() {
    const { t } = useI18n();
    const { people, memberIds, projects, userId, viewAs, setViewAsId } = useLegalHubView();
    const actorId = viewAs?.id ?? userId;
    const canOpenProject = useCallback((id: string) => {
        const project = projects.find((row) => row.id === id);
        return project != null && actorId != null && project.accessIds.includes(actorId);
    }, [actorId, projects]);
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { memberId: memberIdParam } = useParams();
    const memberId = memberIdParam != null && /^\d+$/.test(memberIdParam) ? Number(memberIdParam) : null;
    const onMemberPage = memberIdParam != null;
    const section: LegalHubNavId = parseSection(searchParams.get('view')) ?? sectionFromState(location.state) ?? 'myTasks';
    const projectParam = searchParams.get('project');
    const requestedProject = section === 'projects' && projectParam
        ? projects.find((project) => project.id === projectParam) ?? null
        : null;
    const openProject = requestedProject != null && canOpenProject(requestedProject.id) ? requestedProject : null;
    const openProjectId = openProject?.id ?? null;
    const [teamView, setTeamView] = useState<'cards' | 'details'>('cards');
    const [hubTasks, setHubTasks] = useState<MineTask[]>([]);
    const [projectDisplay, setProjectDisplay] = useState<ProjectDisplaySettings>(EMPTY_PROJECT_DISPLAY);
    const [displayOpen, setDisplayOpen] = useState(false);
    const displayPhase = useRef<'boot' | 'ready'>('boot');
    const savedFolders = useRef('');
    const [query, setQuery] = useState('');
    const [projectQuery, setProjectQuery] = useState('');
    const [collapsedClients, setCollapsedClients] = useState<Set<string>>(() => new Set());
    const [menuOpen, setMenuOpen] = useState(false);
    const [utilOpen, setUtilOpen] = useState(false);
    const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
    const [sideCollapsed, setSideCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
        }
        catch {
            return false;
        }
    });
    const changeTeamView = useCallback((next: 'cards' | 'details') => {
        setTeamView(next);
        if (next === 'details')
            setUtilOpen(false);
    }, []);
    const toggleSide = useCallback(() => {
        setSideCollapsed((collapsed) => {
            const next = !collapsed;
            try {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
            }
            catch {
                /* storage can be unavailable */
            }
            return next;
        });
    }, []);
    const navSection: LegalHubNavId = onMemberPage ? 'allTeam' : section;
    const sectionTitle: TranslationKey = navSection === 'reviewQueue'
        ? 'legalHub.reviewQueue'
        : navSection === 'projects'
            ? 'legalHub.projects'
            : navSection === 'allTeam'
                ? 'legalHub.allTeam'
                : 'legalHub.myTasks';
    const viewedTasks = useMemo(
        () => (viewAs == null ? null : tasksForMember(viewAs.id, memberIds)),
        [viewAs, memberIds],
    );
    const boardTasks = viewedTasks ?? HUB_TASKS;
    const openTasks = useMemo(
        () => boardTasks.filter((task) => !MOCK_DONE_IDS.includes(task.id)),
        [boardTasks],
    );
    useEffect(() => {
        let cancelled = false;
        displayPhase.current = 'boot';
        const local = loadProjectDisplay(userId);
        setProjectDisplay(local);
        void (async () => {
            const remote = await fetchLegalHubBoard();
            if (cancelled)
                return;
            if (remote != null && userId != null) {
                const serverEmpty = !remote.folders.hideLocked && remote.folders.folders.length === 0;
                const localHas = local.hideLocked || local.folders.length > 0;
                const localJson = JSON.stringify(local);
                if (serverEmpty && localHas) {
                    savedFolders.current = localJson;
                    void saveLegalHubFolders(userId, local);
                }
                else {
                    savedFolders.current = JSON.stringify(remote.folders);
                    setProjectDisplay((current) => JSON.stringify(current) === localJson ? remote.folders : current);
                }
            }
            displayPhase.current = 'ready';
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);
    useEffect(() => {
        if (displayPhase.current !== 'ready' || userId == null)
            return undefined;
        const json = JSON.stringify(projectDisplay);
        if (json === savedFolders.current)
            return undefined;
        savedFolders.current = json;
        const handle = window.setTimeout(() => {
            void saveLegalHubFolders(userId, projectDisplay);
        }, 400);
        return () => window.clearTimeout(handle);
    }, [projectDisplay, userId]);
    const visibleProjects = useMemo(() => {
        const needle = projectQuery.trim().toLowerCase();
        const rows = projectDisplay.hideLocked ? projects.filter((project) => canOpenProject(project.id)) : projects;
        if (!needle)
            return rows;
        return rows.filter((project) => `${project.name} ${project.client}`.toLowerCase().includes(needle));
    }, [canOpenProject, projectDisplay.hideLocked, projectQuery, projects]);
    const projectGroups = useMemo(
        () => groupProjects(visibleProjects, projectDisplay.folders),
        [projectDisplay.folders, visibleProjects],
    );
    const toggleClient = useCallback((key: string) => {
        setCollapsedClients((current) => {
            const next = new Set(current);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            return next;
        });
    }, []);
    const toggleFolder = useCallback((folder: ProjectFolder) => {
        setProjectDisplay((current) => ({
            ...current,
            folders: current.folders.map((item) => item.id === folder.id ? { ...item, collapsed: !item.collapsed } : item),
        }));
    }, []);
    const lateCount = openTasks.filter((task) => dayDelta(task.clientOn) < 0).length;
    const reviewCount = boardTasks.filter((task) => task.status === 'associate' || task.status === 'partner' || task.status === 'changes').length;
    const memberOptions = useMemo(
        () => [
            { id: '', name: t('legalHub.viewAsMe'), code: '' },
            ...people.map((person) => ({
                id: String(person.id),
                name: person.position ? `${person.name} · ${person.position}` : person.name,
                code: person.code,
            })),
        ],
        [people, t],
    );
    const showUtil = section === 'allTeam' && teamView === 'cards' && !onMemberPage;
    const choosePerson = useCallback((raw: string) => {
        const next = raw === '' ? null : Number(raw);
        setViewAsId(next != null && Number.isFinite(next) ? next : null);
        if (!onMemberPage)
            return;
        navigate(legalHubSectionUrl('myTasks'));
    }, [navigate, onMemberPage, setViewAsId]);

    const closeMenu = useCallback(() => setMenuOpen(false), []);
    const openMenu = useCallback(() => {
        setUtilOpen(false);
        setMenuOpen((open) => !open);
    }, []);
    const openSection = useCallback((id: LegalHubNavId) => {
        setMenuOpen(false);
        if (onMemberPage) {
            navigate(legalHubSectionUrl(id));
            return;
        }
        if (id === section && openProjectId == null)
            return;
        startTransition(() => {
            addTransitionType(NAV_TRANSITION_TYPE);
            navigate(legalHubSectionUrl(id));
        });
    }, [navigate, onMemberPage, openProjectId, section]);
    const openMatter = useCallback((id: string) => {
        if (!canOpenProject(id))
            return;
        setMenuOpen(false);
        const projectId = encodeURIComponent(id);
        if (onMemberPage) {
            navigate(`${legalHubSectionUrl('projects')}&project=${projectId}`);
            return;
        }
        const next = new URLSearchParams(searchParams);
        next.set('view', 'projects');
        next.set('project', id);
        startTransition(() => {
            addTransitionType(NAV_TRANSITION_TYPE);
            setSearchParams(next);
        });
    }, [canOpenProject, navigate, onMemberPage, searchParams, setSearchParams]);
    const closeProject = useCallback(() => {
        const next = new URLSearchParams(searchParams);
        next.set('view', 'projects');
        next.delete('project');
        setSearchParams(next);
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                setUtilOpen(false);
                return;
            }
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey)
                return;
            const target = event.target;
            if (
                target instanceof HTMLElement
                && (target.isContentEditable
                    || target.tagName === 'INPUT'
                    || target.tagName === 'TEXTAREA'
                    || target.tagName === 'SELECT')
            )
                return;
            event.preventDefault();
            document.querySelector<HTMLInputElement>('.lh-top__search-input')?.focus();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div className={`lh-page${menuOpen ? ' lh-page--menu-open' : ''}${sideCollapsed ? ' lh-page--side-collapsed' : ''}`}>
            {menuOpen ? (
                <button
                    type="button"
                    className="lh-page__backdrop"
                    aria-label={t('legalHub.closeMenu')}
                    onClick={closeMenu}
                />
            ) : null}
            <aside className="lh-side" aria-label={t('legalHub.navAria')}>
                <div className="lh-side__head">
                    <AppBackButton iconOnly className="lh-side__back" />
                    <span className="lh-side__mark" aria-hidden>
                        <IconMark />
                    </span>
                    <span className="lh-side__brand">{t('nav.legalHub')}</span>
                </div>
                <nav className="lh-side__nav">
                    <div>
                        <p className="lh-side__section">{t('legalHub.sideMine')}</p>
                        <ul className="lh-side__list">
                            {MINE_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const selected = item.id === navSection && openProjectId == null;
                                const count = item.id === 'myTasks' ? lateCount : reviewCount;
                                const hot = item.id === 'myTasks' && lateCount > 0;
                                const showCount = count > 0;
                                const label = t(item.labelKey);
                                const lateLabel = hot ? t('legalHub.boardLate').replace('{count}', String(lateCount)) : '';
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            className={`lh-side__item${selected ? ' lh-side__item--active' : ''}`}
                                            aria-current={selected ? 'page' : undefined}
                                            aria-label={lateLabel ? `${label}, ${lateLabel}` : undefined}
                                            onClick={() => openSection(item.id)}
                                        >
                                            <span className="lh-side__item-icon" aria-hidden>
                                                <Icon />
                                                {showCount ? <i className={`lh-side__dot${hot ? ' lh-side__dot--hot' : ''}`} /> : null}
                                            </span>
                                            <span className="lh-side__item-label">{label}</span>
                                            {showCount ? (
                                                <span className={`lh-side__badge${hot ? ' lh-side__badge--hot' : ''}${item.id === 'reviewQueue' ? ' lh-side__badge--review' : ''}`} title={lateLabel || undefined} aria-hidden>{count}</span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div>
                        <p className="lh-side__section">{t('legalHub.sideMatters')}</p>
                        <div className="lh-side__tools">
                            <label className="lh-side__find">
                                <span className="lh-side__find-icon" aria-hidden>
                                    <IconSearch />
                                </span>
                                <input
                                    type="search"
                                    className="lh-side__find-input"
                                    value={projectQuery}
                                    placeholder={t('legalHub.projectSearch')}
                                    aria-label={t('legalHub.projectSearch')}
                                    onChange={(event) => setProjectQuery(event.target.value)}
                                />
                            </label>
                            <button
                                type="button"
                                className={`lh-side__settings${displayOpen ? ' is-on' : ''}`}
                                aria-label={t('legalHub.projectDisplay')}
                                aria-expanded={displayOpen}
                                title={t('legalHub.projectDisplay')}
                                onClick={() => setDisplayOpen(true)}
                            >
                                <IconSliders />
                            </button>
                        </div>
                        <ul className="lh-side__list">
                            {visibleProjects.length === 0 && projectQuery.trim() ? (
                                <li className="lh-side__find-empty">{t('legalHub.projectSearchEmpty')}</li>
                            ) : null}
                            {projectGroups.folders.map(({ folder, projects: folderProjects }) => {
                                const searching = projectQuery.trim().length > 0;
                                if (searching && folderProjects.length === 0)
                                    return null;
                                const folded = folder.collapsed && !searching;
                                return (
                                    <li key={folder.id} className="lh-side__folder">
                                        <button
                                            type="button"
                                            className="lh-side__folder-head"
                                            aria-expanded={!folded}
                                            onClick={() => toggleFolder(folder)}
                                        >
                                            <span className={folderSwatchClass(folder.color)} aria-hidden />
                                            <span className="lh-side__folder-name">{folder.name.trim() || t('legalHub.projectFolderNew')}</span>
                                            <em className="lh-side__folder-count">{folderProjects.length}</em>
                                        </button>
                                        {folded ? null : (
                                            <ul className="lh-side__list">
                                                <ClientGroups
                                                    projects={folderProjects}
                                                    groupKey={folder.id}
                                                    searching={searching}
                                                    collapsed={collapsedClients}
                                                    onToggle={toggleClient}
                                                    openProjectId={openProjectId}
                                                    canOpen={canOpenProject}
                                                    lockedLabel={t('legalHub.projectLocked')}
                                                    onOpen={openMatter}
                                                />
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                            <ClientGroups
                                projects={projectGroups.loose}
                                groupKey="loose"
                                searching={projectQuery.trim().length > 0}
                                collapsed={collapsedClients}
                                onToggle={toggleClient}
                                openProjectId={openProjectId}
                                canOpen={canOpenProject}
                                lockedLabel={t('legalHub.projectLocked')}
                                onOpen={openMatter}
                            />
                        </ul>
                    </div>
                    <ul className="lh-side__list lh-side__list--tail">
                        <li>
                            <button
                                type="button"
                                className={`lh-side__item${navSection === 'allTeam' ? ' lh-side__item--active' : ''}`}
                                aria-current={navSection === 'allTeam' ? 'page' : undefined}
                                onClick={() => openSection('allTeam')}
                            >
                                <span className="lh-side__item-icon" aria-hidden>
                                    <IconTeam />
                                </span>
                                <span className="lh-side__item-label">{t('legalHub.allTeam')}</span>
                            </button>
                        </li>
                    </ul>
                </nav>
                <div className="lh-side__foot">
                    <button
                        type="button"
                        className="lh-side__collapse"
                        aria-expanded={!sideCollapsed}
                        aria-label={sideCollapsed ? t('legalHub.expandSidebar') : t('legalHub.collapseSidebar')}
                        title={sideCollapsed ? t('legalHub.expandSidebar') : t('legalHub.collapseSidebar')}
                        onClick={toggleSide}
                    >
                        <IconCollapse collapsed={sideCollapsed} />
                        <span className="lh-side__collapse-label">
                            {sideCollapsed ? t('legalHub.expandSidebar') : t('legalHub.collapseSidebar')}
                        </span>
                    </button>
                </div>
            </aside>
            <div className="lh-page__main">
                <header className="lh-top">
                    <button
                        type="button"
                        className="lh-top__menu"
                        aria-label={menuOpen ? t('legalHub.closeMenu') : t('legalHub.openMenu')}
                        aria-expanded={menuOpen}
                        onClick={openMenu}
                    >
                        <IconMenu />
                    </button>
                    <label className="lh-top__search">
                        <span className="lh-top__search-icon" aria-hidden>
                            <IconSearch />
                        </span>
                        <input
                            type="search"
                            className="lh-top__search-input"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('legalHub.searchPlaceholder')}
                            aria-label={t('legalHub.searchPlaceholder')}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {query ? (
                            <button type="button" className="lh-top__search-clear" aria-label={t('legalHub.taskFilterReset')} onClick={() => setQuery('')}>
                                ×
                            </button>
                        ) : (
                            <kbd className="lh-top__search-kbd" aria-hidden>/</kbd>
                        )}
                    </label>
                    {people.length > 0 || showUtil ? (
                        <div className="lh-top__actions">
                            {people.length > 0 ? (
                                <>
                                    <span id="lh-view-as-label" className="lh-top__member-label">{t('legalHub.viewAsAria')}</span>
                                    <SearchableSelect
                                        className={`lh-top__member${viewAs != null ? ' is-other' : ''}`}
                                        buttonClassName="lh-top__member-btn"
                                        buttonId="lh-view-as"
                                        aria-labelledby="lh-view-as-label"
                                        portalDropdown
                                        portalZIndex={80}
                                        portalMinWidth={240}
                                        placeholder={t('legalHub.viewAsMe')}
                                        emptyListText={t('legalHub.viewAsMe')}
                                        noMatchText={t('legalHub.teamNoMatch')}
                                        value={viewAs == null ? '' : String(viewAs.id)}
                                        items={memberOptions}
                                        getOptionValue={(item) => item.id}
                                        getOptionLabel={(item) => item.name}
                                        getSearchText={(item) => `${item.name} ${item.code}`}
                                        onSelect={(item) => choosePerson(item.id)}
                                        renderOption={(item) => (
                                            <span className="lh-top__member-opt">
                                                {item.code ? <span className="lh-top__member-code" aria-hidden>{item.code}</span> : null}
                                                <span className="lh-top__member-name">{item.name}</span>
                                            </span>
                                        )}
                                    />
                                </>
                            ) : null}
                            {showUtil ? (
                                <button
                                    type="button"
                                    className="lh-top__util"
                                    aria-label={t('legalHub.utilisationTitle')}
                                    aria-expanded={utilOpen}
                                    onClick={() => {
                                        setMenuOpen(false);
                                        setUtilOpen((open) => !open);
                                    }}
                                >
                                    <IconUtil />
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </header>
                {viewAs != null && !onMemberPage ? (
                    <div className="lh-viewas" role="status">
                        <span className="lh-viewas__avatar" aria-hidden>{viewAs.code}</span>
                        <span className="lh-viewas__text">{t('legalHub.viewAsBanner').replace('{name}', viewAs.name)}</span>
                        <button type="button" className="lh-viewas__reset" onClick={() => setViewAsId(null)}>
                            {t('legalHub.viewAsReset')}
                        </button>
                    </div>
                ) : null}
                <ViewTransition default="none" enter="none" exit="none" update="lh-section">
                    <main key={onMemberPage ? `member-${memberIdParam}` : section} className="lh-page__content">
                        {onMemberPage ? (
                            memberId == null
                                ? <p className="lh-team__note">{t('legalHub.memberMissing')}</p>
                                : <LegalHubMemberTasks memberId={memberId} query={query} />
                        ) : (
                            <HeadActionsContext.Provider value={actionsSlot}>
                                {section === 'myTasks' || section === 'reviewQueue' || openProjectId != null ? null : (
                                <header className="lh-page__head">
                                    <div className="lh-page__head-text">
                                        <h1 className="lh-page__title">{t(sectionTitle)}</h1>
                                        <p className="lh-page__hint">{t(SECTION_HINT[section])}</p>
                                    </div>
                                    <div className="lh-page__head-actions" ref={setActionsSlot} />
                                </header>
                                )}
                                {section === 'myTasks' ? (
                                    <LegalHubMyTasks
                                        key={viewAs?.id ?? 'me'}
                                        query={query}
                                        source={viewedTasks}
                                        layout="board"
                                        tasks={hubTasks}
                                        onTasks={setHubTasks}
                                        boardOwnerId={viewAs?.id ?? userId}
                                    />
                                ) : null}
                                {section === 'reviewQueue' ? (
                                    <LegalHubMyTasks
                                        key={`queue-${viewAs?.id ?? 'me'}`}
                                        query={query}
                                        source={viewedTasks}
                                        layout="board"
                                        mode="queue"
                                        tasks={hubTasks}
                                        onTasks={setHubTasks}
                                    />
                                ) : null}
                                {section === 'projects' && openProject ? (
                                    <LegalHubMyTasks
                                        key={openProject.id}
                                        query={query}
                                        layout="board"
                                        heading={openProject.name}
                                        headingNote={openProject.client}
                                        scope={openProject.id}
                                        onBack={closeProject}
                                        tasks={hubTasks}
                                        onTasks={setHubTasks}
                                    />
                                ) : null}
                                {section === 'projects' && !openProject ? (
                                    <div className="lh-project-groups">
                                        {projectGroups.folders.map(({ folder, projects: folderProjects }) => (
                                            folderProjects.length === 0 ? null : (
                                                <section key={folder.id} className="lh-project-folder">
                                                    <h2>
                                                        <span className={folderSwatchClass(folder.color)} aria-hidden />
                                                        {folder.name.trim() || t('legalHub.projectFolderNew')}
                                                    </h2>
                                                    <ProjectList
                                                        projects={folderProjects}
                                                        canOpen={canOpenProject}
                                                        lockedLabel={t('legalHub.projectLocked')}
                                                        onOpen={openMatter}
                                                    />
                                                </section>
                                            )
                                        ))}
                                        {projectGroups.loose.length > 0 && projectGroups.folders.some((group) => group.projects.length > 0) ? (
                                            <h2 className="lh-project-folder__loose">{t('legalHub.projectFolderLoose')}</h2>
                                        ) : null}
                                        <ProjectList
                                            projects={projectGroups.loose}
                                            canOpen={canOpenProject}
                                            lockedLabel={t('legalHub.projectLocked')}
                                            onOpen={openMatter}
                                        />
                                    </div>
                                ) : null}
                                {section === 'allTeam' ? <LegalHubTeamBoard query={query} view={teamView} onViewChange={changeTeamView} /> : null}
                            </HeadActionsContext.Provider>
                        )}
                    </main>
                </ViewTransition>
            </div>
            {showUtil ? <LegalHubUtilRail mobileOpen={utilOpen} onMobileClose={() => setUtilOpen(false)} /> : null}
            <LegalHubProjectSettings
                open={displayOpen}
                settings={projectDisplay}
                projects={projects}
                onClose={() => setDisplayOpen(false)}
                onChange={setProjectDisplay}
            />
        </div>
    );
}

function groupByClient<T extends { client: string }>(projects: readonly T[]): { client: string; projects: T[] }[] {
    const groups: { client: string; projects: T[] }[] = [];
    const index = new Map<string, { client: string; projects: T[] }>();
    for (const project of projects) {
        const client = project.client.trim();
        const key = client.toLowerCase();
        const existing = index.get(key);
        if (existing)
            existing.projects.push(project);
        else {
            const group = { client, projects: [project] };
            index.set(key, group);
            groups.push(group);
        }
    }
    groups.sort((a, b) => a.client.localeCompare(b.client, 'ru'));
    return groups;
}

function ClientGroups({
    projects,
    groupKey,
    searching,
    collapsed,
    onToggle,
    openProjectId,
    canOpen,
    lockedLabel,
    onOpen,
}: {
    projects: { id: string; name: string; client: string }[];
    groupKey: string;
    searching: boolean;
    collapsed: Set<string>;
    onToggle: (key: string) => void;
    openProjectId: string | null;
    canOpen: (id: string) => boolean;
    lockedLabel: string;
    onOpen: (id: string) => void;
}) {
    const { t } = useI18n();
    return (
        <>
            {groupByClient(projects).map((group) => {
                const key = `${groupKey}:${group.client.toLowerCase()}`;
                const folded = collapsed.has(key) && !searching;
                const label = group.client || t('legalHub.projectNoClient');
                return (
                    <li key={key} className="lh-side__client">
                        <button
                            type="button"
                            className="lh-side__client-head"
                            aria-expanded={!folded}
                            onClick={() => onToggle(key)}
                        >
                            <IconChevron open={!folded} />
                            <span className="lh-side__folder-name">{label}</span>
                            <em className="lh-side__folder-count">{group.projects.length}</em>
                        </button>
                        {folded ? null : (
                            <ul className="lh-side__list lh-side__client-list">
                                {group.projects.map((project) => (
                                    <SideProject
                                        key={project.id}
                                        project={project}
                                        selected={openProjectId === project.id}
                                        locked={!canOpen(project.id)}
                                        lockedLabel={lockedLabel}
                                        onOpen={onOpen}
                                    />
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
        </>
    );
}

function projectTitle(project: { name: string; client: string }, locked: boolean, lockedLabel: string): string {
    const label = project.client ? `${project.name} · ${project.client}` : project.name;
    return locked ? `${label}. ${lockedLabel}` : label;
}

function ProjectLabel({ project, list = false }: { project: { name: string; client: string }; list?: boolean }) {
    return (
        <span className={list ? 'lh-project-list__name' : 'lh-side__item-label lh-side__item-label--stack'}>
            <span className={list ? 'lh-project-list__title' : 'lh-side__item-title'}>{project.name}</span>
            {project.client ? <span className={list ? 'lh-project-list__client' : 'lh-side__item-client'}>{project.client}</span> : null}
        </span>
    );
}

function SideProject({
    project,
    selected,
    locked,
    lockedLabel,
    onOpen,
}: {
    project: { id: string; name: string; client: string };
    selected: boolean;
    locked: boolean;
    lockedLabel: string;
    onOpen: (id: string) => void;
}) {
    return (
        <li>
            <button
                type="button"
                className={`lh-side__item${selected ? ' lh-side__item--active' : ''}${locked ? ' lh-side__item--locked' : ''}`}
                aria-current={selected ? 'page' : undefined}
                aria-disabled={locked || undefined}
                disabled={locked}
                title={projectTitle(project, locked, lockedLabel)}
                onClick={() => onOpen(project.id)}
            >
                <span className="lh-side__sw lh-side__sw--project" aria-hidden />
                <span className="lh-side__item-label">{project.name}</span>
                {locked ? (
                    <span className="lh-lock" aria-hidden>
                        <IconLock />
                    </span>
                ) : null}
            </button>
        </li>
    );
}

function ProjectList({
    projects,
    canOpen,
    lockedLabel,
    onOpen,
}: {
    projects: { id: string; name: string; client: string }[];
    canOpen: (id: string) => boolean;
    lockedLabel: string;
    onOpen: (id: string) => void;
}) {
    if (projects.length === 0)
        return null;
    return (
        <ul className="lh-project-list">
            {projects.map((project) => {
                const locked = !canOpen(project.id);
                return (
                    <li key={project.id}>
                        <button
                            type="button"
                            className={`lh-project-list__item${locked ? ' lh-project-list__item--locked' : ''}`}
                            aria-disabled={locked || undefined}
                            disabled={locked}
                            title={projectTitle(project, locked, lockedLabel)}
                            onClick={() => onOpen(project.id)}
                        >
                            <ProjectLabel project={project} list />
                            {locked ? (
                                <span className="lh-lock" aria-hidden>
                                    <IconLock />
                                </span>
                            ) : null}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

export function LegalHubPage() {
    return (
        <LegalHubMockProvider>
            <LegalHubViewProvider>
                <LegalHubChromeProvider>
                    <LegalHubPageBody />
                </LegalHubChromeProvider>
            </LegalHubViewProvider>
        </LegalHubMockProvider>
    );
}
