import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@shared/i18n';
import { chatKostaLegalAi, } from '../api/kostaLegalAiChat';
import { KostaLegalAiSidebar } from './KostaLegalAiSidebar';
import { KostaLegalAiSkeleton } from './KostaLegalAiSkeleton';
import { KlAiIconFileSearch, KlAiIconLayoutTemplate, KlAiIconMegaphone, KlAiIconMessageReply, KlAiIconMore, KlAiIconPenLine, KlAiIconScale, KlAiIconScanText, KlAiIconSeal, KlAiIconSpellCheck, } from './kostaLegalAiIcons';
import './KostaLegalAiPage.css';
const IconAttach = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }) }));
const IconGlobe = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M2 12h20" }), _jsx("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" })] }));
const IconSend = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "m5 12 7-7 7 7" }), _jsx("path", { d: "M12 19V5" })] }));
const IconChevron = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m6 9 6 6 6-6" }) }));
const IconMenu = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("line", { x1: "4", y1: "6", x2: "20", y2: "6" }), _jsx("line", { x1: "4", y1: "12", x2: "20", y2: "12" }), _jsx("line", { x1: "4", y1: "18", x2: "20", y2: "18" })] }));
const COMMANDS = [
    { id: 'spellCheck', icon: KlAiIconSpellCheck, tone: 'oxblood' },
    { id: 'caseLaw', icon: KlAiIconScale, tone: 'slate' },
    { id: 'adCheck', icon: KlAiIconMegaphone, tone: 'brass' },
    { id: 'ocr', icon: KlAiIconScanText, tone: 'green' },
    { id: 'claimResponse', icon: KlAiIconMessageReply, tone: 'oxblood' },
    { id: 'contractAnalysis', icon: KlAiIconFileSearch, tone: 'slate' },
    { id: 'styleChange', icon: KlAiIconPenLine, tone: 'brass' },
    { id: 'legalDesign', icon: KlAiIconLayoutTemplate, tone: 'green' },
];
const LAW_AREAS = ['civil', 'labor', 'tax', 'corporate', 'ip'];
const SOURCE_COUNTS = [3, 5, 7, 10];
const SIDEBAR_COMMAND_IDS = new Set([
    'spellCheck',
    'caseLaw',
    'adCheck',
    'ocr',
    'claimResponse',
]);
function commandKey(id, field) {
    return `kostaLegalAi.commands.${id}.${field}`;
}
function lawAreaKey(id) {
    return `kostaLegalAi.lawAreas.${id}`;
}
export function KostaLegalAiPage() {
    const { t } = useI18n();
    const fileInputRef = useRef(null);
    const heroRef = useRef(null);
    const commandsRef = useRef(null);
    const mainRef = useRef(null);
    const [query, setQuery] = useState('');
    const [lawArea, setLawArea] = useState('civil');
    const [sourceCount, setSourceCount] = useState(5);
    const [webSearch, setWebSearch] = useState(false);
    const [activeCommand, setActiveCommand] = useState(null);
    const [messages, setMessages] = useState([]);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [activeNav, setActiveNav] = useState('home');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const timer = window.setTimeout(() => setLoading(false), 520);
        return () => window.clearTimeout(timer);
    }, []);
    const handleCommandClick = useCallback((id) => {
        setActiveCommand(id);
        setQuery(t(commandKey(id, 'title')));
        setActiveNav(SIDEBAR_COMMAND_IDS.has(id) ? id : 'commands');
        heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [t]);
    const handleSidebarSelect = useCallback((id) => {
        setActiveNav(id);
        setMobileSidebarOpen(false);
        if (id === 'home' || id === 'createChat') {
            setQuery('');
            setActiveCommand(null);
            setMessages([]);
            setError('');
            setActiveNav('home');
            heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (id === 'commands') {
            commandsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (SIDEBAR_COMMAND_IDS.has(id)) {
            setActiveCommand(id);
            setQuery(t(commandKey(id, 'title')));
            heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [t]);
    const handleSubmit = useCallback(async () => {
        const text = query.trim();
        if (!text || pending)
            return;
        setError('');
        setPending(true);
        setQuery('');
        const history = messages;
        setMessages((prev) => [...prev, { role: 'user', content: text }]);
        try {
            const result = await chatKostaLegalAi({
                query: text,
                lawArea,
                sourceCount,
                webSearch,
                commandId: activeCommand,
                messages: history,
            });
            setMessages((prev) => [...prev, { role: 'assistant', content: result.answer }]);
        }
        catch (e) {
            const msg = e instanceof Error && e.message.trim() ? e.message : t('kostaLegalAi.errorGeneric');
            setMessages(history);
            setQuery(text);
            setError(msg);
        }
        finally {
            setPending(false);
        }
    }, [query, pending, messages, lawArea, sourceCount, webSearch, activeCommand, t]);
    const handleComposerKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit();
        }
    }, [handleSubmit]);
    if (loading) {
        return (_jsx("div", { className: `kl-ai kl-ai--loading${sidebarCollapsed ? ' kl-ai--sidebar-collapsed' : ''}`, children: _jsx(KostaLegalAiSkeleton, { collapsed: sidebarCollapsed }) }));
    }
    return (_jsxs("div", { className: `kl-ai kl-ai--ready${sidebarCollapsed ? ' kl-ai--sidebar-collapsed' : ''}${mobileSidebarOpen ? ' kl-ai--mobile-sidebar-open' : ''}`, children: [mobileSidebarOpen ? (_jsx("button", { type: "button", className: "kl-ai__backdrop", "aria-label": t('sidebar.closeMobile'), onClick: () => setMobileSidebarOpen(false) })) : null, _jsxs("div", { className: "kl-ai__layout", children: [_jsx(KostaLegalAiSidebar, { activeId: activeNav, collapsed: sidebarCollapsed, onSelect: handleSidebarSelect, onToggleCollapse: () => setSidebarCollapsed((v) => !v) }), _jsxs("div", { className: "kl-ai__shell", children: [_jsxs("div", { className: "kl-ai__mobile-topbar", children: [_jsx("span", { className: "kl-ai__mobile-seal", "aria-hidden": true, children: _jsx(KlAiIconSeal, {}) }), _jsx("span", { className: "kl-ai__mobile-name", children: t('kostaLegalAi.sidebar.brandName') }), _jsx("button", { type: "button", className: "kl-ai__mobile-menu", "aria-label": t('kostaLegalAi.sidebar.expand'), "aria-expanded": mobileSidebarOpen, onClick: () => setMobileSidebarOpen((v) => !v), children: _jsx(IconMenu, {}) })] }), _jsx("main", { ref: mainRef, className: "kl-ai__main", children: _jsxs("div", { className: "kl-ai__workspace", children: [_jsxs("section", { ref: heroRef, className: "kl-ai__hero", "aria-labelledby": "kl-ai-hero-title", children: [_jsx("h1", { id: "kl-ai-hero-title", className: "kl-ai__hero-title", children: t('kostaLegalAi.heroTitle') }), _jsxs("div", { className: "kl-ai__composer", children: [_jsx("label", { className: "kl-ai__composer-label", htmlFor: "kl-ai-query", children: t('kostaLegalAi.queryLabel') }), _jsxs("div", { className: "kl-ai__composer-box", children: [_jsx("textarea", { id: "kl-ai-query", className: "kl-ai__composer-input", rows: 2, placeholder: t('kostaLegalAi.queryPlaceholder'), value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: handleComposerKeyDown, disabled: pending }), _jsxs("div", { className: "kl-ai__composer-toolbar", children: [_jsxs("div", { className: "kl-ai__composer-tools", children: [_jsx("button", { type: "button", className: "kl-ai__icon-btn", "aria-label": t('kostaLegalAi.attachFile'), onClick: () => fileInputRef.current?.click(), children: _jsx(IconAttach, {}) }), _jsx("input", { ref: fileInputRef, type: "file", className: "kl-ai__file-input", tabIndex: -1, "aria-hidden": true, onChange: () => { } }), _jsx("button", { type: "button", className: `kl-ai__icon-btn${webSearch ? ' kl-ai__icon-btn--active' : ''}`, "aria-label": t('kostaLegalAi.webSearch'), "aria-pressed": webSearch, onClick: () => setWebSearch((v) => !v), children: _jsx(IconGlobe, {}) }), _jsxs("label", { className: "kl-ai__filter", children: [_jsxs("span", { className: "kl-ai__filter-text", children: [t('kostaLegalAi.lawArea'), ' ', _jsx("strong", { children: t(lawAreaKey(lawArea)) })] }), _jsx("select", { className: "kl-ai__filter-select", value: lawArea, onChange: (e) => setLawArea(e.target.value), "aria-label": t('kostaLegalAi.lawArea'), children: LAW_AREAS.map((area) => (_jsx("option", { value: area, children: t(lawAreaKey(area)) }, area))) }), _jsx("span", { className: "kl-ai__filter-chevron", "aria-hidden": true, children: _jsx(IconChevron, {}) })] }), _jsxs("label", { className: "kl-ai__filter", children: [_jsxs("span", { className: "kl-ai__filter-text", children: [t('kostaLegalAi.sources'), ' ', _jsx("strong", { children: sourceCount })] }), _jsx("select", { className: "kl-ai__filter-select", value: sourceCount, onChange: (e) => setSourceCount(Number(e.target.value)), "aria-label": t('kostaLegalAi.sources'), children: SOURCE_COUNTS.map((count) => (_jsx("option", { value: count, children: count }, count))) }), _jsx("span", { className: "kl-ai__filter-chevron", "aria-hidden": true, children: _jsx(IconChevron, {}) })] })] }), _jsx("button", { type: "button", className: "kl-ai__send-btn", "aria-label": t('kostaLegalAi.send'), disabled: !query.trim() || pending, onClick: () => void handleSubmit(), children: _jsx(IconSend, {}) })] })] })] }), messages.length || pending || error ? (_jsxs("div", { className: "kl-ai__thread", "aria-live": "polite", children: [messages.map((msg, index) => (_jsxs("article", { className: `kl-ai__msg${msg.role === 'user' ? ' kl-ai__msg--user' : ''}`, children: [_jsx("span", { className: "kl-ai__msg-role", children: msg.role === 'user' ? t('kostaLegalAi.you') : t('kostaLegalAi.assistant') }), _jsx("p", { className: "kl-ai__msg-body", children: msg.content })] }, `${msg.role}-${index}`))), pending ? (_jsxs("article", { className: "kl-ai__msg", children: [_jsx("span", { className: "kl-ai__msg-role", children: t('kostaLegalAi.assistant') }), _jsx("p", { className: "kl-ai__msg-body", children: t('kostaLegalAi.pending') })] })) : null, error ? (_jsxs("article", { className: "kl-ai__msg kl-ai__msg--error", role: "alert", children: [_jsx("span", { className: "kl-ai__msg-role", children: t('kostaLegalAi.assistant') }), _jsx("p", { className: "kl-ai__msg-body", children: error })] })) : null] })) : null, messages.some((msg) => msg.role === 'assistant') ? (_jsx("p", { className: "kl-ai__disclaimer", children: t('kostaLegalAi.disclaimer') })) : null] }), _jsxs("section", { ref: commandsRef, className: "kl-ai__commands", "aria-labelledby": "kl-ai-commands-title", children: [_jsxs("div", { className: "kl-ai__section-head", children: [_jsx("h2", { id: "kl-ai-commands-title", className: "kl-ai__commands-title", children: t('kostaLegalAi.commandsTitle') }), _jsxs("button", { type: "button", className: "kl-ai__commands-all", children: [t('kostaLegalAi.commandsAll'), " \u203A"] })] }), _jsx("p", { className: "kl-ai__commands-subtitle", children: t('kostaLegalAi.commandsSubtitle') }), _jsx("ul", { className: "kl-ai__commands-grid", children: COMMANDS.map((cmd) => {
                                                        const Icon = cmd.icon;
                                                        return (_jsx("li", { children: _jsxs("button", { type: "button", className: `kl-ai__command-card kl-ai__command-card--${cmd.tone}`, onClick: () => handleCommandClick(cmd.id), children: [_jsxs("span", { className: "kl-ai__command-card-top", children: [_jsx("span", { className: "kl-ai__command-icon", "aria-hidden": true, children: _jsx(Icon, {}) }), _jsx("span", { className: "kl-ai__command-more", "aria-hidden": true, children: _jsx(KlAiIconMore, {}) })] }), _jsxs("span", { className: "kl-ai__command-body", children: [_jsx("span", { className: "kl-ai__command-title", children: t(commandKey(cmd.id, 'title')) }), _jsx("span", { className: "kl-ai__command-desc", children: t(commandKey(cmd.id, 'description')) })] })] }) }, cmd.id));
                                                    }) })] })] }) })] })] })] }));
}
