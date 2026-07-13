import { type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import {
    KlAiIconGrid,
    KlAiIconHelp,
    KlAiIconMegaphone,
    KlAiIconMessageReply,
    KlAiIconScale,
    KlAiIconScanText,
    KlAiIconSeal,
    KlAiIconSpellCheck,
} from './kostaLegalAiIcons';

export type KlAiSidebarNavId =
    | 'home'
    | 'spellCheck'
    | 'caseLaw'
    | 'adCheck'
    | 'ocr'
    | 'claimResponse'
    | 'commands'
    | 'createFolder'
    | 'howToUse'
    | 'allFolders'
    | 'createChat';

type SidebarItem = {
    id: KlAiSidebarNavId;
    icon: ComponentType;
    labelKey: TranslationKey;
};

const IconHome = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 11 12 4l9 7" />
        <path d="M5 10v9h14v-9" />
    </svg>
);

const IconFolderPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M12 11v4M10 13h4" />
    </svg>
);

const IconFolders = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
);

const IconCompose = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
);

const IconPanel = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
    </svg>
);

const TOOL_ITEMS: SidebarItem[] = [
    { id: 'home', icon: IconHome, labelKey: 'nav.home' },
    { id: 'spellCheck', icon: KlAiIconSpellCheck, labelKey: 'kostaLegalAi.commands.spellCheck.title' },
    { id: 'caseLaw', icon: KlAiIconScale, labelKey: 'kostaLegalAi.commands.caseLaw.title' },
    { id: 'adCheck', icon: KlAiIconMegaphone, labelKey: 'kostaLegalAi.commands.adCheck.title' },
    { id: 'ocr', icon: KlAiIconScanText, labelKey: 'kostaLegalAi.commands.ocr.title' },
    { id: 'claimResponse', icon: KlAiIconMessageReply, labelKey: 'kostaLegalAi.commands.claimResponse.title' },
    { id: 'commands', icon: KlAiIconGrid, labelKey: 'kostaLegalAi.commandsTitle' },
];

const FOLDER_ITEMS: SidebarItem[] = [
    { id: 'createFolder', icon: IconFolderPlus, labelKey: 'kostaLegalAi.sidebar.createSmartFolder' },
    { id: 'howToUse', icon: KlAiIconHelp, labelKey: 'kostaLegalAi.sidebar.howToUse' },
    { id: 'allFolders', icon: IconFolders, labelKey: 'kostaLegalAi.sidebar.allSmartFolders' },
];

type KostaLegalAiSidebarProps = {
    activeId: KlAiSidebarNavId;
    collapsed: boolean;
    onSelect: (id: KlAiSidebarNavId) => void;
    onToggleCollapse: () => void;
};

function NavButton({
    item,
    active,
    collapsed,
    onSelect,
}: {
    item: SidebarItem;
    active: boolean;
    collapsed: boolean;
    onSelect: (id: KlAiSidebarNavId) => void;
}) {
    const { t } = useI18n();
    const Icon = item.icon;
    const label = t(item.labelKey);

    return (
        <li>
            <button
                type="button"
                className={`kl-ai-sidebar__item${active ? ' kl-ai-sidebar__item--active' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? label : undefined}
                onClick={() => onSelect(item.id)}
            >
                <span className="kl-ai-sidebar__item-icon" aria-hidden>
                    <Icon />
                </span>
                {!collapsed ? <span className="kl-ai-sidebar__item-label">{label}</span> : null}
            </button>
        </li>
    );
}

export function KostaLegalAiSidebar({
    activeId,
    collapsed,
    onSelect,
    onToggleCollapse,
}: KostaLegalAiSidebarProps) {
    const { t } = useI18n();

    return (
        <aside
            className={`kl-ai-sidebar${collapsed ? ' kl-ai-sidebar--collapsed' : ''}`}
            aria-label={t('kostaLegalAi.sidebar.navAria')}
        >
            <div className="kl-ai-sidebar__head">
                <Link
                    to={routes.home}
                    className="kl-ai-sidebar__brand"
                    aria-label={t('brand.homeAria')}
                    title={t('nav.kostaLegalAi')}
                >
                    <span className="kl-ai-sidebar__seal" aria-hidden>
                        <KlAiIconSeal />
                    </span>
                    {!collapsed ? (
                        <span className="kl-ai-sidebar__brand-text">
                            <span className="kl-ai-sidebar__brand-name">{t('kostaLegalAi.sidebar.brandName')}</span>
                            <span className="kl-ai-sidebar__brand-tag">{t('kostaLegalAi.sidebar.aiTag')}</span>
                        </span>
                    ) : null}
                </Link>
                <button
                    type="button"
                    className="kl-ai-sidebar__collapse-btn"
                    onClick={onToggleCollapse}
                    aria-label={collapsed ? t('kostaLegalAi.sidebar.expand') : t('kostaLegalAi.sidebar.collapse')}
                    aria-expanded={!collapsed}
                >
                    <IconPanel />
                </button>
            </div>

            <nav className="kl-ai-sidebar__nav">
                <ul className="kl-ai-sidebar__list">
                    {TOOL_ITEMS.map((item) => (
                        <NavButton
                            key={item.id}
                            item={item}
                            active={activeId === item.id}
                            collapsed={collapsed}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>

                <div className="kl-ai-sidebar__divider" role="separator" />

                <ul className="kl-ai-sidebar__list">
                    {FOLDER_ITEMS.map((item) => (
                        <NavButton
                            key={item.id}
                            item={item}
                            active={activeId === item.id}
                            collapsed={collapsed}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            </nav>

            <div className="kl-ai-sidebar__foot">
                <button
                    type="button"
                    className="kl-ai-sidebar__new-chat"
                    onClick={() => onSelect('createChat')}
                >
                    <IconCompose />
                    {!collapsed ? <span>{t('kostaLegalAi.sidebar.createChat')}</span> : null}
                </button>
            </div>
        </aside>
    );
}
