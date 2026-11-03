import { addTransitionType, startTransition, useCallback, useEffect, useMemo, useState, ViewTransition, type ComponentType } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppBackButton, NAV_TRANSITION_TYPE, SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { LegalHubMemberTasks } from './LegalHubMemberTasks';
import { LegalHubMyTasks } from './LegalHubMyTasks';
import { LegalHubProjects } from './LegalHubProjects';
import { LegalHubReviewQueue } from './LegalHubReviewQueue';
import { LegalHubTeamBoard, LegalHubUtilRail } from './LegalHubTeamBoard';
import { LegalHubMockProvider } from './legalHubMock';
import { HUB_TASKS, isTaskProjectId, PROJECT_TITLE, tasksForMember, type TaskProjectId } from './legalHubTasks';
import { HeadActionsContext, hubBadges, legalHubSectionUrl, type LegalHubNavId } from './legalHubShared';
import { LegalHubViewProvider, useLegalHubView } from './legalHubView';
import './LegalHubPage.css';


const NAV_ITEMS: { id: LegalHubNavId; labelKey: TranslationKey; icon: ComponentType }[] = [
    { id: 'myTasks', labelKey: 'legalHub.myTasks', icon: IconTasks },
    { id: 'reviewQueue', labelKey: 'legalHub.reviewQueue', icon: IconShield },
    { id: 'projects', labelKey: 'legalHub.projects', icon: IconProjects },
    { id: 'allTeam', labelKey: 'legalHub.allTeam', icon: IconTeam },
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

function IconProjects() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H3z" />
            <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2" />
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
    const active = NAV_ITEMS.find((item) => item.id === navSection) ?? NAV_ITEMS[0]!;
    const viewedTasks = useMemo(
        () => (viewAs == null ? null : tasksForMember(viewAs.id, memberIds)),
        [viewAs, memberIds],
    );
    const badges = useMemo(() => hubBadges(viewedTasks ?? HUB_TASKS), [viewedTasks]);
    const badgeFor = (id: LegalHubNavId): { count: number; tone: 'hot' | 'calm'; label: string } | null => {
        if (id === 'myTasks' && badges.attention > 0)
            return { count: badges.attention, tone: 'hot', label: t('legalHub.navBadgeMyTasks').replace('{count}', String(badges.attention)) };
        if (id === 'reviewQueue' && badges.review > 0)
            return { count: badges.review, tone: 'calm', label: t('legalHub.navBadgeQueue').replace('{count}', String(badges.review)) };
        if (id === 'projects' && badges.risk > 0)
            return { count: badges.risk, tone: 'hot', label: t('legalHub.navBadgeProjects').replace('{count}', String(badges.risk)) };
        return null;
    };
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
                    <p className="lh-side__section">{t('legalHub.workspace')}</p>
                    <ul className="lh-side__list">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const selected = item.id === navSection;
                            const badge = badgeFor(item.id);
                            const label = t(item.labelKey);
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className={`lh-side__item${selected ? ' lh-side__item--active' : ''}`}
                                        aria-current={selected ? 'page' : undefined}
                                        aria-label={badge ? `${label} · ${badge.label}` : label}
                                        title={badge ? `${label} · ${badge.label}` : label}
                                        onClick={() => openSection(item.id)}
                                    >
                                        <span className="lh-side__item-icon" aria-hidden>
                                            <Icon />
                                            {badge ? <i className={`lh-side__dot lh-side__dot--${badge.tone}`} /> : null}
                                        </span>
                                        <span className="lh-side__item-label">{label}</span>
                                        {badge ? (
                                            <span className={`lh-side__badge lh-side__badge--${badge.tone}`} aria-hidden>{badge.count}</span>
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })}
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
                                <header className="lh-page__head">
                                    <div className="lh-page__head-text">
                                        {openProjectId != null ? (
                                            <nav className="lh-crumbs" aria-label={t('legalHub.projects')}>
                                                <button type="button" onClick={() => openProject(null)}>{t('legalHub.projectsBack')}</button>
                                                <span aria-hidden>/</span>
                                            </nav>
                                        ) : null}
                                        <h1 className="lh-page__title">{openProjectId != null ? PROJECT_TITLE[openProjectId] : t(active.labelKey)}</h1>
                                        {openProjectId == null && section !== 'myTasks' ? <p className="lh-page__hint">{t(SECTION_HINT[section])}</p> : null}
                                    </div>
                                    <div className="lh-page__head-actions" ref={setActionsSlot} />
                                </header>
                                {section === 'myTasks' ? <LegalHubMyTasks key={viewAs?.id ?? 'me'} query={query} source={viewedTasks} /> : null}
                                {section === 'reviewQueue' ? <LegalHubReviewQueue key={viewAs?.id ?? 'me'} query={query} tasks={viewedTasks} /> : null}
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
