import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { getUsers } from '@entities/user';
import { getInvoiceRegistrySheet } from '@entities/time-tracking/api/domains/invoiceRegistry';
import { LazyInvoicesPanel } from '@features/invoices';
import { InvoicesSkeleton } from '@pages/time-tracking/ui/InvoicesSkeleton';
import { getHubSectionDef } from '@pages/home/model/hubSections';
import { AccountingHrPanel } from './AccountingHrPanel';
import '@pages/home/ui/HomeNavTiles.css';
import './AccountingPage.css';
const FINANCE_SECTION = getHubSectionDef('finance');
const HUB_TILES = [
    {
        key: 'invoices',
        tab: 'invoices',
        label: 'Инвойсы',
        badgeKey: 'invoices',
    },
    {
        key: 'hr',
        tab: 'hr',
        label: 'HR',
        badgeKey: 'hr',
    },
    {
        key: 'expenses',
        to: routes.expenses,
        label: 'Расходы',
    },
    {
        key: 'reporting',
        to: routes.expensesReport,
        label: 'Отчётность',
    },
];
function TileIcon({ name }) {
    const common = {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.75,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
    };
    if (name === 'hr') {
        return (_jsxs("svg", { ...common, children: [_jsx("circle", { cx: "9", cy: "8", r: "2.4" }), _jsx("circle", { cx: "16", cy: "9", r: "2" }), _jsx("path", { d: "M4.5 18.5c.6-2.4 2.5-3.8 4.5-3.8s3.9 1.4 4.5 3.8M14 14.8c1.3-.5 2.6-.4 3.6.3 1 .7 1.6 1.8 1.9 3.4" })] }));
    }
    if (name === 'invoices') {
        return (_jsxs("svg", { ...common, children: [_jsx("path", { d: "M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" }), _jsx("path", { d: "M14 3.5V8h5M8.5 12h7M8.5 15.5h5" })] }));
    }
    if (name === 'expenses') {
        return (_jsxs("svg", { ...common, children: [_jsx("rect", { x: "3.5", y: "6", width: "17", height: "12.5", rx: "2" }), _jsx("path", { d: "M3.5 10h17M7 14.5h3" })] }));
    }
    return (_jsx("svg", { ...common, children: _jsx("path", { d: "M5 19V10M10 19V5M15 19v-6M20 19V8" }) }));
}
function formatBadge(n) {
    if (n == null || !Number.isFinite(n) || n <= 0)
        return null;
    if (n > 99)
        return '99+';
    return String(n);
}
function OverviewSkeleton() {
    return (_jsx("div", { className: "home-nav-tiles home-nav-tiles--hub acct-page__hub", "aria-busy": "true", "aria-label": "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u0431\u0437\u043E\u0440\u0430", children: _jsxs("div", { className: "home-nav-tiles__section-block", children: [_jsx("div", { className: "home-nav-tiles__section-head", children: _jsx("div", { className: "acct-skel acct-skel--head" }) }), _jsx("ul", { className: "home-nav-tiles__grid", role: "list", children: Array.from({ length: 4 }, (_, i) => (_jsx("li", { className: "home-nav-tiles__item", children: _jsx("div", { className: "acct-skel acct-skel--tile" }) }, i))) })] }) }));
}
const ACCOUNTING_TAB_KEY = 'acct-tab';
function readAccountingTab() {
    try {
        const saved = window.sessionStorage.getItem(ACCOUNTING_TAB_KEY);
        if (saved === 'overview' || saved === 'invoices' || saved === 'hr')
            return saved;
    }
    catch {
        /* private mode */
    }
    return 'overview';
}
export function AccountingPage() {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState(readAccountingTab);
    const [staffCount, setStaffCount] = useState(null);
    const [invoiceCount, setInvoiceCount] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const selectTab = (tab) => {
        setActiveTab(tab);
        try {
            window.sessionStorage.setItem(ACCOUNTING_TAB_KEY, tab);
        }
        catch {
            /* private mode */
        }
    };
    useEffect(() => {
        let cancelled = false;
        const staff = getUsers(false)
            .then((rows) => {
            if (!cancelled)
                setStaffCount(rows.filter((user) => !user.is_archived && !user.is_blocked).length);
        })
            .catch(() => {
            if (!cancelled)
                setStaffCount(null);
        });
        const invoices = getInvoiceRegistrySheet('2026-system')
            .then((sheet) => {
            if (!cancelled)
                setInvoiceCount(Array.isArray(sheet.rows) ? sheet.rows.length : 0);
        })
            .catch(() => {
            if (!cancelled)
                setInvoiceCount(null);
        });
        void Promise.allSettled([staff, invoices]).then(() => {
            if (!cancelled)
                setOverviewLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const sectionStyle = {
        '--hub-section-accent': FINANCE_SECTION.accent,
        '--hub-section-soft': FINANCE_SECTION.accentSoft,
        '--hub-section-border': FINANCE_SECTION.accentBorder,
    };
    const goToKicker = `${t('common.goTo')} →`;
    return (_jsx("div", { className: "acct-page", children: _jsxs("main", { className: "acct-page__main", children: [_jsx("header", { className: "acct-page__header", children: _jsxs("div", { className: "acct-page__header-inner", children: [_jsxs("div", { className: "acct-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn", onClick: activeTab === 'overview' ? undefined : () => selectTab('overview') }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { children: [_jsx("h1", { className: "acct-page__title", children: activeTab === 'invoices' ? 'Инвойсы' : activeTab === 'hr' ? 'HR' : 'Бухгалтерия' }), _jsx("p", { className: "acct-page__subtitle", children: activeTab === 'invoices'
                                                    ? 'Счета, выставленные клиентам'
                                                    : activeTab === 'hr'
                                                        ? 'Сотрудники, роли и должности'
                                                        : 'Обзор, счета и сотрудники. Доступно администраторам и партнёрам' })] })] }), _jsx(AppPageSettings, {})] }) }), _jsxs("div", { className: `acct-page__content${activeTab === 'invoices' ? ' acct-page__content--invoices' : ''}`, children: [activeTab === 'overview' && (overviewLoading ? _jsx(OverviewSkeleton, {}) : (_jsx("div", { className: "home-nav-tiles home-nav-tiles--hub acct-page__hub", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u0431\u0443\u0445\u0433\u0430\u043B\u0442\u0435\u0440\u0438\u0438", children: _jsxs("div", { className: "home-nav-tiles__section-block", style: sectionStyle, children: [_jsxs("div", { className: "home-nav-tiles__section-head", children: [_jsxs("h2", { className: "home-nav-tiles__section-title", children: [_jsx("span", { className: "home-nav-tiles__section-dot", "aria-hidden": true }), "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0438 \u0444\u0438\u043D\u0430\u043D\u0441\u044B"] }), _jsx("span", { className: "home-nav-tiles__section-count", "aria-hidden": true, children: String(HUB_TILES.length).padStart(2, '0') })] }), _jsx("ul", { className: "home-nav-tiles__grid", role: "list", children: HUB_TILES.map((tile, index) => {
                                            const badge = tile.badgeKey === 'hr'
                                                ? formatBadge(staffCount)
                                                : tile.badgeKey === 'invoices'
                                                    ? formatBadge(invoiceCount)
                                                    : null;
                                            const badgeAria = tile.badgeKey === 'hr'
                                                ? `${staffCount ?? 0} сотрудников`
                                                : tile.badgeKey === 'invoices'
                                                    ? `${invoiceCount ?? 0} счетов из системы`
                                                    : undefined;
                                            const body = (_jsxs(_Fragment, { children: [_jsx("span", { className: "home-nav-tiles__icon", "aria-hidden": true, children: _jsx(TileIcon, { name: tile.key }) }), badge ? (_jsx("span", { className: "home-nav-tiles__badges", children: _jsx("span", { className: "home-nav-tiles__badge home-nav-tiles__badge--info", "aria-label": badgeAria, children: badge }) })) : null, _jsxs("span", { className: "home-nav-tiles__body", children: [_jsx("span", { className: "home-nav-tiles__label", children: tile.label }), _jsx("span", { className: "home-nav-tiles__kicker", "aria-hidden": true, children: goToKicker })] })] }));
                                            const itemStyle = { '--hn-tile-i': index };
                                            if ('tab' in tile && tile.tab) {
                                                return (_jsx("li", { className: "home-nav-tiles__item", style: itemStyle, children: _jsx("button", { type: "button", className: "home-nav-tiles__link", onClick: () => selectTab(tile.tab), children: body }) }, tile.key));
                                            }
                                            return (_jsx("li", { className: "home-nav-tiles__item", style: itemStyle, children: _jsx(NavLink, { to: tile.to, className: "home-nav-tiles__link", children: body }) }, tile.key));
                                        }) })] }) }))), activeTab === 'hr' && _jsx(AccountingHrPanel, {}), activeTab === 'invoices' && (_jsx("div", { className: "acct-page__invoices-wrap", children: _jsx(Suspense, { fallback: _jsx(InvoicesSkeleton, {}), children: _jsx(LazyInvoicesPanel, { variant: "accounting" }) }) }))] })] }) }));
}
