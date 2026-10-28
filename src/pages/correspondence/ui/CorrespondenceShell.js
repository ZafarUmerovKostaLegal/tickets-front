import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppBackButton, AppPageSettings } from '@shared/ui';
import './CorrespondenceShell.css';
import '@shared/ui/AttentionBanner.css';
export function CorrespondenceShell({ activeTab, tabs, onBack, actions, children, contentClassName, fullHeight = false, }) {
    const navTabs = tabs ?? [{ id: activeTab, label: activeTab, active: true }];
    return (_jsxs("div", { className: `corr-shell${fullHeight ? ' corr-shell--full' : ''}`, children: [_jsx("header", { className: "corr-shell__header", children: _jsxs("div", { className: "corr-shell__header-inner", children: [_jsx(AppBackButton, { className: "corr-shell__back", onClick: onBack, hideLabelOnMobile: true }), _jsx("h1", { className: "corr-shell__title", children: "\u041A\u043E\u0440\u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0446\u0438\u044F" }), _jsx("nav", { className: "corr-shell__tabs", role: "tablist", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B \u043A\u043E\u0440\u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0446\u0438\u0438", children: navTabs.map((tab) => {
                                const isActive = tab.active ?? tab.label === activeTab;
                                if (tab.onClick) {
                                    return (_jsx("button", { type: "button", role: "tab", "aria-selected": isActive, className: `corr-shell__tab${isActive ? ' corr-shell__tab--active' : ''}`, onClick: tab.onClick, children: _jsxs("span", { className: "corr-shell__tab-inner", children: [tab.label, tab.badge ? (_jsx("span", { className: "app-count-badge", "aria-hidden": true, children: tab.badge })) : null] }) }, tab.id));
                                }
                                return (_jsx("span", { className: `corr-shell__tab${isActive ? ' corr-shell__tab--active' : ''}`, role: "tab", "aria-selected": isActive, tabIndex: -1, children: tab.label }, tab.id));
                            }) }), _jsx("div", { className: "corr-shell__header-spacer", "aria-hidden": true }), actions ? (_jsx("div", { className: "corr-shell__actions", role: "group", "aria-label": "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F", children: actions })) : null, _jsx("div", { className: "corr-shell__settings", children: _jsx(AppPageSettings, {}) })] }) }), _jsx("main", { className: "corr-shell__main", children: _jsx("div", { className: [
                        'corr-shell__content',
                        children ? null : 'corr-shell__content--empty',
                        contentClassName?.trim() || null,
                    ].filter(Boolean).join(' '), children: children }) })] }));
}
