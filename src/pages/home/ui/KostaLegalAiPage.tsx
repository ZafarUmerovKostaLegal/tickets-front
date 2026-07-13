import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { KostaLegalAiSidebar, type KlAiSidebarNavId } from './KostaLegalAiSidebar';
import { KostaLegalAiSkeleton } from './KostaLegalAiSkeleton';
import {
    KlAiIconFileSearch,
    KlAiIconLayoutTemplate,
    KlAiIconMegaphone,
    KlAiIconMessageReply,
    KlAiIconMore,
    KlAiIconPenLine,
    KlAiIconScale,
    KlAiIconScanText,
    KlAiIconSeal,
    KlAiIconSpellCheck,
} from './kostaLegalAiIcons';
import './KostaLegalAiPage.css';

type CommandId =
    | 'spellCheck'
    | 'caseLaw'
    | 'adCheck'
    | 'ocr'
    | 'claimResponse'
    | 'contractAnalysis'
    | 'styleChange'
    | 'legalDesign';

type CommandMeta = {
    id: CommandId;
    icon: ComponentType;
    tone: 'oxblood' | 'slate' | 'brass' | 'green';
};

const IconAttach = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);

const IconGlobe = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const IconSend = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m5 12 7-7 7 7" />
        <path d="M12 19V5" />
    </svg>
);

const IconChevron = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
    </svg>
);

const IconMenu = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
);

const COMMANDS: CommandMeta[] = [
    { id: 'spellCheck', icon: KlAiIconSpellCheck, tone: 'oxblood' },
    { id: 'caseLaw', icon: KlAiIconScale, tone: 'slate' },
    { id: 'adCheck', icon: KlAiIconMegaphone, tone: 'brass' },
    { id: 'ocr', icon: KlAiIconScanText, tone: 'green' },
    { id: 'claimResponse', icon: KlAiIconMessageReply, tone: 'oxblood' },
    { id: 'contractAnalysis', icon: KlAiIconFileSearch, tone: 'slate' },
    { id: 'styleChange', icon: KlAiIconPenLine, tone: 'brass' },
    { id: 'legalDesign', icon: KlAiIconLayoutTemplate, tone: 'green' },
];

const LAW_AREAS = ['civil', 'labor', 'tax', 'corporate', 'ip'] as const;
const SOURCE_COUNTS = [3, 5, 7, 10] as const;

const SIDEBAR_COMMAND_IDS = new Set<KlAiSidebarNavId>([
    'spellCheck',
    'caseLaw',
    'adCheck',
    'ocr',
    'claimResponse',
]);

function commandKey(id: CommandId, field: 'title' | 'description'): TranslationKey {
    return `kostaLegalAi.commands.${id}.${field}` as TranslationKey;
}

function lawAreaKey(id: typeof LAW_AREAS[number]): TranslationKey {
    return `kostaLegalAi.lawAreas.${id}` as TranslationKey;
}

export function KostaLegalAiPage() {
    const { t } = useI18n();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const heroRef = useRef<HTMLElement>(null);
    const commandsRef = useRef<HTMLElement>(null);
    const mainRef = useRef<HTMLElement>(null);

    const [query, setQuery] = useState('');
    const [lawArea, setLawArea] = useState<typeof LAW_AREAS[number]>('civil');
    const [sourceCount, setSourceCount] = useState<number>(5);
    const [webSearch, setWebSearch] = useState(false);
    const [activeNav, setActiveNav] = useState<KlAiSidebarNavId>('home');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setLoading(false), 520);
        return () => window.clearTimeout(timer);
    }, []);

    const handleCommandClick = useCallback((id: CommandId) => {
        setQuery(t(commandKey(id, 'title')));
        setActiveNav(SIDEBAR_COMMAND_IDS.has(id as KlAiSidebarNavId) ? id as KlAiSidebarNavId : 'commands');
        heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [t]);

    const handleSidebarSelect = useCallback((id: KlAiSidebarNavId) => {
        setActiveNav(id);
        setMobileSidebarOpen(false);

        if (id === 'home') {
            setQuery('');
            heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        if (id === 'commands') {
            commandsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        if (SIDEBAR_COMMAND_IDS.has(id)) {
            setQuery(t(commandKey(id as CommandId, 'title')));
            heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [t]);

    const handleSubmit = useCallback(() => {
        if (!query.trim())
            return;
    }, [query]);

    if (loading) {
        return (
            <div className={`kl-ai kl-ai--loading${sidebarCollapsed ? ' kl-ai--sidebar-collapsed' : ''}`}>
                <KostaLegalAiSkeleton collapsed={sidebarCollapsed} />
            </div>
        );
    }

    return (
        <div className={`kl-ai kl-ai--ready${sidebarCollapsed ? ' kl-ai--sidebar-collapsed' : ''}${mobileSidebarOpen ? ' kl-ai--mobile-sidebar-open' : ''}`}>
            {mobileSidebarOpen ? (
                <button
                    type="button"
                    className="kl-ai__backdrop"
                    aria-label={t('sidebar.closeMobile')}
                    onClick={() => setMobileSidebarOpen(false)}
                />
            ) : null}

            <div className="kl-ai__layout">
                <KostaLegalAiSidebar
                    activeId={activeNav}
                    collapsed={sidebarCollapsed}
                    onSelect={handleSidebarSelect}
                    onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
                />

                <div className="kl-ai__shell">
                    <div className="kl-ai__mobile-topbar">
                        <span className="kl-ai__mobile-seal" aria-hidden>
                            <KlAiIconSeal />
                        </span>
                        <span className="kl-ai__mobile-name">{t('kostaLegalAi.sidebar.brandName')}</span>
                        <button
                            type="button"
                            className="kl-ai__mobile-menu"
                            aria-label={t('kostaLegalAi.sidebar.expand')}
                            aria-expanded={mobileSidebarOpen}
                            onClick={() => setMobileSidebarOpen((v) => !v)}
                        >
                            <IconMenu />
                        </button>
                    </div>

                    <main ref={mainRef} className="kl-ai__main">
                        <div className="kl-ai__workspace">
                            <section ref={heroRef} className="kl-ai__hero" aria-labelledby="kl-ai-hero-title">
                                <h1 id="kl-ai-hero-title" className="kl-ai__hero-title">
                                    {t('kostaLegalAi.heroTitle')}
                                </h1>

                                <div className="kl-ai__composer">
                                    <label className="kl-ai__composer-label" htmlFor="kl-ai-query">
                                        {t('kostaLegalAi.queryLabel')}
                                    </label>
                                    <div className="kl-ai__composer-box">
                                        <textarea
                                            id="kl-ai-query"
                                            className="kl-ai__composer-input"
                                            rows={2}
                                            placeholder={t('kostaLegalAi.queryPlaceholder')}
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                        />
                                        <div className="kl-ai__composer-toolbar">
                                            <div className="kl-ai__composer-tools">
                                                <button
                                                    type="button"
                                                    className="kl-ai__icon-btn"
                                                    aria-label={t('kostaLegalAi.attachFile')}
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <IconAttach />
                                                </button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    className="kl-ai__file-input"
                                                    tabIndex={-1}
                                                    aria-hidden
                                                    onChange={() => {}}
                                                />
                                                <button
                                                    type="button"
                                                    className={`kl-ai__icon-btn${webSearch ? ' kl-ai__icon-btn--active' : ''}`}
                                                    aria-label={t('kostaLegalAi.webSearch')}
                                                    aria-pressed={webSearch}
                                                    onClick={() => setWebSearch((v) => !v)}
                                                >
                                                    <IconGlobe />
                                                </button>
                                                <label className="kl-ai__filter">
                                                    <span className="kl-ai__filter-text">
                                                        {t('kostaLegalAi.lawArea')}{' '}
                                                        <strong>{t(lawAreaKey(lawArea))}</strong>
                                                    </span>
                                                    <select
                                                        className="kl-ai__filter-select"
                                                        value={lawArea}
                                                        onChange={(e) => setLawArea(e.target.value as typeof LAW_AREAS[number])}
                                                        aria-label={t('kostaLegalAi.lawArea')}
                                                    >
                                                        {LAW_AREAS.map((area) => (
                                                            <option key={area} value={area}>
                                                                {t(lawAreaKey(area))}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <span className="kl-ai__filter-chevron" aria-hidden><IconChevron /></span>
                                                </label>
                                                <label className="kl-ai__filter">
                                                    <span className="kl-ai__filter-text">
                                                        {t('kostaLegalAi.sources')}{' '}
                                                        <strong>{sourceCount}</strong>
                                                    </span>
                                                    <select
                                                        className="kl-ai__filter-select"
                                                        value={sourceCount}
                                                        onChange={(e) => setSourceCount(Number(e.target.value))}
                                                        aria-label={t('kostaLegalAi.sources')}
                                                    >
                                                        {SOURCE_COUNTS.map((count) => (
                                                            <option key={count} value={count}>
                                                                {count}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <span className="kl-ai__filter-chevron" aria-hidden><IconChevron /></span>
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                className="kl-ai__send-btn"
                                                aria-label={t('kostaLegalAi.send')}
                                                disabled={!query.trim()}
                                                onClick={handleSubmit}
                                            >
                                                <IconSend />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section ref={commandsRef} className="kl-ai__commands" aria-labelledby="kl-ai-commands-title">
                                <div className="kl-ai__section-head">
                                    <h2 id="kl-ai-commands-title" className="kl-ai__commands-title">
                                        {t('kostaLegalAi.commandsTitle')}
                                    </h2>
                                    <button type="button" className="kl-ai__commands-all">
                                        {t('kostaLegalAi.commandsAll')} ›
                                    </button>
                                </div>
                                <p className="kl-ai__commands-subtitle">{t('kostaLegalAi.commandsSubtitle')}</p>

                                <ul className="kl-ai__commands-grid">
                                    {COMMANDS.map((cmd) => {
                                        const Icon = cmd.icon;
                                        return (
                                            <li key={cmd.id}>
                                                <button
                                                    type="button"
                                                    className={`kl-ai__command-card kl-ai__command-card--${cmd.tone}`}
                                                    onClick={() => handleCommandClick(cmd.id)}
                                                >
                                                    <span className="kl-ai__command-card-top">
                                                        <span className="kl-ai__command-icon" aria-hidden>
                                                            <Icon />
                                                        </span>
                                                        <span className="kl-ai__command-more" aria-hidden><KlAiIconMore /></span>
                                                    </span>
                                                    <span className="kl-ai__command-body">
                                                        <span className="kl-ai__command-title">{t(commandKey(cmd.id, 'title'))}</span>
                                                        <span className="kl-ai__command-desc">{t(commandKey(cmd.id, 'description'))}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
