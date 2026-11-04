import { addTransitionType, startTransition, useCallback, useEffect, useMemo, useState, ViewTransition, type ComponentType } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppBackButton, NAV_TRANSITION_TYPE, SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { LegalHubMemberTasks } from './LegalHubMemberTasks';
import { LegalHubMyTasks } from './LegalHubMyTasks';
import { LegalHubProjects } from './LegalHubProjects';
import { LegalHubTeamBoard, LegalHubUtilRail } from './LegalHubTeamBoard';
import { LegalHubMockProvider } from './legalHubMock';
import { HUB_TASKS, isTaskProjectId, MOCK_DONE_IDS, PROJECT_TITLE, tasksForMember, type TaskProjectId } from './legalHubTasks';
import { dayDelta, HeadActionsContext, legalHubSectionUrl, type LegalHubNavId } from './legalHubShared';
import { LegalHubViewProvider, useLegalHubView } from './legalHubView';
import './LegalHubPage.css';


const MINE_ITEMS: { id: 'myTasks' | 'reviewQueue'; labelKey: TranslationKey; icon: ComponentType }[] = [
    { id: 'myTasks', labelKey: 'legalHub.myTasks', icon: IconTasks },
    { id: 'reviewQueue', labelKey: 'legalHub.sideReview', icon: IconShield },
];

const MATTERS: TaskProjectId[] = ['solar', 'wind', 'infrastructure', 'bess', 'healthcare'];

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
    const { people, memberIds, viewAs, setViewAsId } = useLegalHubView();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { memberId: memberIdParam } = useParams();
    const memberId = memberIdParam != null && /^\d+$/.test(memberIdParam) ? Number(memberIdParam) : null;
    const onMemberPage = memberIdParam != null;
    const section: LegalHubNavId = parseSection(searchParams.get('view')) ?? sectionFromState(location.state) ?? 'myTasks';
    const projectParam = searchParams.get('project');
    const openProjectId = section === 'projects' && isTaskProjectId(projectParam) ? projectParam : null;
    const [teamView, setTeamView] = useState<'cards' | 'details'>('cards');
    const [query, setQuery] = useState('');
    const [createTick, setCreateTick] = useState(0);
    const [projectQuery, setProjectQuery] = useState('');
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
    const matterStats = useMemo(() => MATTERS.map((id) => {
        const rows = openTasks.filter((task) => task.project === id);
        return {
            id,
            count: rows.length,
            hot: rows.some((task) => dayDelta(task.clientOn) < 0),
        };
    }), [openTasks]);
    const visibleMatters = useMemo(() => {
        const needle = projectQuery.trim().toLowerCase();
        if (!needle)
            return matterStats;
        return matterStats.filter((matter) => PROJECT_TITLE[matter.id].toLowerCase().includes(needle));
    }, [matterStats, projectQuery]);
    const myHot = openTasks.some((task) => dayDelta(task.clientOn) < 0);
    const reviewCount = boardTasks.filter((task) => task.status === 'associate' || task.status === 'partner' || task.status === 'changes').length;
    const memberOptions = useMemo(
        () => [
            { id: '', name: t('legalHub.viewAsMe'), code: '' },
            ...people.map((person) => ({ id: String(person.id), name: person.name, code: person.code })),
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
    const openMatter = useCallback((id: TaskProjectId) => {
        setMenuOpen(false);
        if (onMemberPage) {
            navigate(`${legalHubSectionUrl('projects')}&project=${id}`);
            return;
        }
        const next = new URLSearchParams(searchParams);
        next.set('view', 'projects');
        next.set('project', id);
        startTransition(() => {
            addTransitionType(NAV_TRANSITION_TYPE);
            setSearchParams(next);
        });
    }, [navigate, onMemberPage, searchParams, setSearchParams]);
    const openProject = useCallback((id: TaskProjectId | null) => {
        const next = new URLSearchParams(searchParams);
        next.set('view', 'projects');
        if (id == null)
            next.delete('project');
        else
            next.set('project', id);
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
                                const count = item.id === 'myTasks' ? openTasks.length : reviewCount;
                                const hot = item.id === 'myTasks' && myHot;
                                const showCount = count > 0;
                                const label = t(item.labelKey);
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            className={`lh-side__item${selected ? ' lh-side__item--active' : ''}`}
                                            aria-current={selected ? 'page' : undefined}
                                            onClick={() => openSection(item.id)}
                                        >
                                            <span className="lh-side__item-icon" aria-hidden>
                                                <Icon />
                                                {showCount ? <i className={`lh-side__dot${hot ? ' lh-side__dot--hot' : ''}`} /> : null}
                                            </span>
                                            <span className="lh-side__item-label">{label}</span>
                                            {showCount ? (
                                                <span className={`lh-side__badge${hot ? ' lh-side__badge--hot' : ''}${item.id === 'reviewQueue' ? ' lh-side__badge--review' : ''}`} aria-hidden>{count}</span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div>
                        <p className="lh-side__section">{t('legalHub.sideMatters')}</p>
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
                        <ul className="lh-side__list">
                            {visibleMatters.length === 0 ? (
                                <li className="lh-side__find-empty">{t('legalHub.projectSearchEmpty')}</li>
                            ) : null}
                            {visibleMatters.map((matter) => {
                                const selected = openProjectId === matter.id;
                                const label = PROJECT_TITLE[matter.id];
                                return (
                                    <li key={matter.id}>
                                        <button
                                            type="button"
                                            className={`lh-side__item${selected ? ' lh-side__item--active' : ''}`}
                                            aria-current={selected ? 'page' : undefined}
                                            title={label}
                                            onClick={() => openMatter(matter.id)}
                                        >
                                            <span className={`lh-side__sw lh-side__sw--${matter.id}`} aria-hidden />
                                            <span className="lh-side__item-label">{label}</span>
                                            {matter.count > 0 ? (
                                                <span className={`lh-side__badge${matter.hot ? ' lh-side__badge--hot' : ''}`} aria-hidden>{matter.count}</span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
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
                    {people.length > 0 || showUtil || (section === 'myTasks' && !onMemberPage) ? (
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
                            {section === 'myTasks' && !onMemberPage ? (
                                <button
                                    type="button"
                                    className="lh-top__add"
                                    aria-label={t('legalHub.myTasksNew')}
                                    title={t('legalHub.myTasksNew')}
                                    onClick={() => setCreateTick((tick) => tick + 1)}
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden>
                                        <path d="M12 5v14M5 12h14" />
                                    </svg>
                                </button>
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
                                {section === 'myTasks' || section === 'reviewQueue' ? null : (
                                <header className="lh-page__head">
                                    <div className="lh-page__head-text">
                                        {openProjectId != null ? (
                                            <nav className="lh-crumbs" aria-label={t('legalHub.projects')}>
                                                <button type="button" onClick={() => openProject(null)}>{t('legalHub.projectsBack')}</button>
                                                <span aria-hidden>/</span>
                                            </nav>
                                        ) : null}
                                        <h1 className="lh-page__title">{openProjectId != null ? PROJECT_TITLE[openProjectId] : t(sectionTitle)}</h1>
                                        {openProjectId == null ? <p className="lh-page__hint">{t(SECTION_HINT[section])}</p> : null}
                                    </div>
                                    <div className="lh-page__head-actions" ref={setActionsSlot} />
                                </header>
                                )}
                                {section === 'myTasks' ? <LegalHubMyTasks key={viewAs?.id ?? 'me'} query={query} source={viewedTasks} layout="board" createSignal={createTick} /> : null}
                                {section === 'reviewQueue' ? <LegalHubMyTasks key={`queue-${viewAs?.id ?? 'me'}`} query={query} source={viewedTasks} layout="board" mode="queue" /> : null}
                                {section === 'projects' ? (
                                    <LegalHubProjects
                                        key={viewAs?.id ?? 'me'}
                                        query={query}
                                        source={viewedTasks}
                                        selected={openProjectId}
                                        onSelect={openProject}
                                    />
                                ) : null}
                                {section === 'allTeam' ? <LegalHubTeamBoard query={query} view={teamView} onViewChange={changeTeamView} /> : null}
                            </HeadActionsContext.Provider>
                        )}
                    </main>
                </ViewTransition>
            </div>
            {showUtil ? <LegalHubUtilRail mobileOpen={utilOpen} onMobileClose={() => setUtilOpen(false)} /> : null}
        </div>
    );
}

export function LegalHubPage() {
    return (
        <LegalHubMockProvider>
            <LegalHubViewProvider>
                <LegalHubPageBody />
            </LegalHubViewProvider>
        </LegalHubMockProvider>
    );
}
