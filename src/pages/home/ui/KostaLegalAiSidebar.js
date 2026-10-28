import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { KlAiIconGrid, KlAiIconHelp, KlAiIconMegaphone, KlAiIconMessageReply, KlAiIconScale, KlAiIconScanText, KlAiIconSeal, KlAiIconSpellCheck, } from './kostaLegalAiIcons';
const IconHome = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M3 11 12 4l9 7" }), _jsx("path", { d: "M5 10v9h14v-9" })] }));
const IconFolderPlus = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }), _jsx("path", { d: "M12 11v4M10 13h4" })] }));
const IconFolders = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }) }));
const IconCompose = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M12 20h9" }), _jsx("path", { d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" })] }));
const IconPanel = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }), _jsx("path", { d: "M9 4v16" })] }));
const TOOL_ITEMS = [
    { id: 'home', icon: IconHome, labelKey: 'nav.home' },
    { id: 'spellCheck', icon: KlAiIconSpellCheck, labelKey: 'kostaLegalAi.commands.spellCheck.title' },
    { id: 'caseLaw', icon: KlAiIconScale, labelKey: 'kostaLegalAi.commands.caseLaw.title' },
    { id: 'adCheck', icon: KlAiIconMegaphone, labelKey: 'kostaLegalAi.commands.adCheck.title' },
    { id: 'ocr', icon: KlAiIconScanText, labelKey: 'kostaLegalAi.commands.ocr.title' },
    { id: 'claimResponse', icon: KlAiIconMessageReply, labelKey: 'kostaLegalAi.commands.claimResponse.title' },
    { id: 'commands', icon: KlAiIconGrid, labelKey: 'kostaLegalAi.commandsTitle' },
];
const FOLDER_ITEMS = [
    { id: 'createFolder', icon: IconFolderPlus, labelKey: 'kostaLegalAi.sidebar.createSmartFolder' },
    { id: 'howToUse', icon: KlAiIconHelp, labelKey: 'kostaLegalAi.sidebar.howToUse' },
    { id: 'allFolders', icon: IconFolders, labelKey: 'kostaLegalAi.sidebar.allSmartFolders' },
];
function NavButton({ item, active, collapsed, onSelect, }) {
    const { t } = useI18n();
    const Icon = item.icon;
    const label = t(item.labelKey);
    return (_jsx("li", { children: _jsxs("button", { type: "button", className: `kl-ai-sidebar__item${active ? ' kl-ai-sidebar__item--active' : ''}`, "aria-current": active ? 'page' : undefined, title: collapsed ? label : undefined, onClick: () => onSelect(item.id), children: [_jsx("span", { className: "kl-ai-sidebar__item-icon", "aria-hidden": true, children: _jsx(Icon, {}) }), !collapsed ? _jsx("span", { className: "kl-ai-sidebar__item-label", children: label }) : null] }) }));
}
export function KostaLegalAiSidebar({ activeId, collapsed, onSelect, onToggleCollapse, }) {
    const { t } = useI18n();
    return (_jsxs("aside", { className: `kl-ai-sidebar${collapsed ? ' kl-ai-sidebar--collapsed' : ''}`, "aria-label": t('kostaLegalAi.sidebar.navAria'), children: [_jsxs("div", { className: "kl-ai-sidebar__head", children: [_jsxs(Link, { to: routes.home, className: "kl-ai-sidebar__brand", "aria-label": t('brand.homeAria'), title: t('nav.kostaLegalAi'), children: [_jsx("span", { className: "kl-ai-sidebar__seal", "aria-hidden": true, children: _jsx(KlAiIconSeal, {}) }), !collapsed ? (_jsxs("span", { className: "kl-ai-sidebar__brand-text", children: [_jsx("span", { className: "kl-ai-sidebar__brand-name", children: t('kostaLegalAi.sidebar.brandName') }), _jsx("span", { className: "kl-ai-sidebar__brand-tag", children: t('kostaLegalAi.sidebar.aiTag') })] })) : null] }), _jsx("button", { type: "button", className: "kl-ai-sidebar__collapse-btn", onClick: onToggleCollapse, "aria-label": collapsed ? t('kostaLegalAi.sidebar.expand') : t('kostaLegalAi.sidebar.collapse'), "aria-expanded": !collapsed, children: _jsx(IconPanel, {}) })] }), _jsxs("nav", { className: "kl-ai-sidebar__nav", children: [_jsx("ul", { className: "kl-ai-sidebar__list", children: TOOL_ITEMS.map((item) => (_jsx(NavButton, { item: item, active: activeId === item.id, collapsed: collapsed, onSelect: onSelect }, item.id))) }), _jsx("div", { className: "kl-ai-sidebar__divider", role: "separator" }), _jsx("ul", { className: "kl-ai-sidebar__list", children: FOLDER_ITEMS.map((item) => (_jsx(NavButton, { item: item, active: activeId === item.id, collapsed: collapsed, onSelect: onSelect }, item.id))) })] }), _jsx("div", { className: "kl-ai-sidebar__foot", children: _jsxs("button", { type: "button", className: "kl-ai-sidebar__new-chat", onClick: () => onSelect('createChat'), children: [_jsx(IconCompose, {}), !collapsed ? _jsx("span", { children: t('kostaLegalAi.sidebar.createChat') }) : null] }) })] }));
}
