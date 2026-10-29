import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { getInvoiceRegistrySheet } from '@entities/time-tracking/api/domains/invoiceRegistry';
import { LazyInvoicesPanel } from '@features/invoices';
import { InvoicesSkeleton } from '@pages/time-tracking/ui/InvoicesSkeleton';
import { getHubSectionDef } from '@pages/home/model/hubSections';
import { AccountingCorporateCardPanel } from './AccountingCorporateCardPanel';
import '@pages/home/ui/HomeNavTiles.css';
import './AccountingPage.css';

type AccountingTab = 'overview' | 'invoices' | 'corporate-card' | 'coming-soon';

const FINANCE_SECTION = getHubSectionDef('finance');

const HUB_TILES = [
    {
        key: 'invoices' as const,
        tab: 'invoices' as const,
        label: 'Инвойсы',
        badgeKey: 'invoices' as const,
    },
    {
        key: 'expenses' as const,
        to: routes.expenses,
        label: 'Расходы',
        badgeKey: null,
    },
    {
        key: 'reporting' as const,
        to: routes.expensesReport,
        label: 'Отчётность',
        badgeKey: null,
    },
    {
        key: 'corporate-card' as const,
        tab: 'corporate-card' as const,
        label: 'Корпоративная карта',
        badgeKey: null,
    },
    {
        key: 'coming-soon' as const,
        tab: 'coming-soon' as const,
        label: 'Скоро в системе',
        badgeKey: null,
    },
];

function TileIcon({ name }: { name: (typeof HUB_TILES)[number]['key'] }) {
    const common = {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.75,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true as const,
    };
    if (name === 'invoices') {
        return (
            <svg {...common}>
                <path d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
                <path d="M14 3.5V8h5M8.5 12h7M8.5 15.5h5" />
            </svg>
        );
    }
    if (name === 'expenses') {
        return (
            <svg {...common}>
                <rect x="3.5" y="6" width="17" height="12.5" rx="2" />
                <path d="M3.5 10h17M7 14.5h3" />
            </svg>
        );
    }
    if (name === 'corporate-card') {
        return (
            <svg {...common}>
                <rect x="3" y="5.5" width="18" height="13" rx="2" />
                <path d="M3 10h18M7 15h4" />
            </svg>
        );
    }
    if (name === 'coming-soon') {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4.5l3 2" />
            </svg>
        );
    }
    return (
        <svg {...common}>
            <path d="M5 19V10M10 19V5M15 19v-6M20 19V8" />
        </svg>
    );
}

function formatBadge(n: number | null): string | null {
    if (n == null || !Number.isFinite(n) || n <= 0)
        return null;
    if (n > 99)
        return '99+';
    return String(n);
}

function OverviewSkeleton() {
    return (
        <div className="home-nav-tiles home-nav-tiles--hub acct-page__hub" aria-busy="true" aria-label="Загрузка обзора">
            <div className="home-nav-tiles__section-block">
                <div className="home-nav-tiles__section-head">
                    <div className="acct-skel acct-skel--head" />
                </div>
                <ul className="home-nav-tiles__grid" role="list">
                    {Array.from({ length: 5 }, (_, i) => (
                        <li key={i} className="home-nav-tiles__item">
                            <div className="acct-skel acct-skel--tile" />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

const ACCOUNTING_TAB_KEY = 'acct-tab';

function readAccountingTab(): AccountingTab {
    try {
        const saved = window.sessionStorage.getItem(ACCOUNTING_TAB_KEY);
        if (saved === 'overview' || saved === 'invoices' || saved === 'corporate-card' || saved === 'coming-soon')
            return saved;
    }
    catch {
        /* private mode */
    }
    return 'overview';
}

export function AccountingPage() {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<AccountingTab>(readAccountingTab);
    const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(true);

    const selectTab = (tab: AccountingTab) => {
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
        const invoices = getInvoiceRegistrySheet('2026-system')
            .then((sheet) => {
                if (!cancelled)
                    setInvoiceCount(Array.isArray(sheet.rows) ? sheet.rows.length : 0);
            })
            .catch(() => {
                if (!cancelled)
                    setInvoiceCount(null);
            });
        void Promise.allSettled([invoices]).then(() => {
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
    } as CSSProperties;

    const goToKicker = `${t('common.goTo')} →`;

    return (
        <div className="acct-page">
            <main className="acct-page__main">
                <header className="acct-page__header">
                    <div className="acct-page__header-inner">
                        <div className="acct-page__header-start">
                            <AppBackButton
                                className="app-back-btn"
                                onClick={activeTab === 'overview' ? undefined : () => selectTab('overview')}
                            />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="acct-page__title">
                                    {activeTab === 'invoices'
                                        ? 'Инвойсы'
                                        : activeTab === 'corporate-card'
                                            ? 'Корпоративная карта'
                                            : activeTab === 'coming-soon'
                                                ? 'Скоро в системе'
                                                : 'Бухгалтерия'}
                                </h1>
                                <p className="acct-page__subtitle">
                                    {activeTab === 'invoices'
                                        ? 'Реестр инвойсов'
                                        : activeTab === 'corporate-card'
                                            ? 'Расходы, оплаченные корпоративной картой офиса'
                                            : activeTab === 'coming-soon'
                                                ? 'Разделы, которые появятся в следующих обновлениях'
                                                : 'Обзор и счета. Доступно администраторам и партнёрам'}
                                </p>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>

                <div
                    className={`acct-page__content${activeTab === 'invoices' ? ' acct-page__content--invoices' : ''}${activeTab === 'corporate-card' ? ' acct-page__content--card' : ''}`}
                >
                    {activeTab === 'overview' && (overviewLoading ? <OverviewSkeleton /> : (
                        <div className="home-nav-tiles home-nav-tiles--hub acct-page__hub" aria-label="Разделы бухгалтерии">
                            <div className="home-nav-tiles__section-block" style={sectionStyle}>
                                <div className="home-nav-tiles__section-head">
                                    <h2 className="home-nav-tiles__section-title">
                                        <span className="home-nav-tiles__section-dot" aria-hidden />
                                        Документы и финансы
                                    </h2>
                                    <span className="home-nav-tiles__section-count" aria-hidden>
                                        {String(HUB_TILES.length).padStart(2, '0')}
                                    </span>
                                </div>
                                <ul className="home-nav-tiles__grid" role="list">
                                    {HUB_TILES.map((tile, index) => {
                                        const badge = tile.badgeKey === 'invoices'
                                            ? formatBadge(invoiceCount)
                                            : null;
                                        const badgeAria = tile.badgeKey === 'invoices'
                                            ? `${invoiceCount ?? 0} счетов из системы`
                                            : undefined;
                                        const body = (
                                            <>
                                                <span className="home-nav-tiles__icon" aria-hidden>
                                                    <TileIcon name={tile.key} />
                                                </span>
                                                {badge ? (
                                                    <span className="home-nav-tiles__badges">
                                                        <span className="home-nav-tiles__badge home-nav-tiles__badge--info" aria-label={badgeAria}>
                                                            {badge}
                                                        </span>
                                                    </span>
                                                ) : null}
                                                <span className="home-nav-tiles__body">
                                                    <span className="home-nav-tiles__label">{tile.label}</span>
                                                    <span className="home-nav-tiles__kicker" aria-hidden>{goToKicker}</span>
                                                </span>
                                            </>
                                        );
                                        const itemStyle = { '--hn-tile-i': index } as CSSProperties;
                                        if ('tab' in tile && tile.tab) {
                                            return (
                                                <li key={tile.key} className="home-nav-tiles__item" style={itemStyle}>
                                                    <button
                                                        type="button"
                                                        className="home-nav-tiles__link"
                                                        onClick={() => selectTab(tile.tab!)}
                                                    >
                                                        {body}
                                                    </button>
                                                </li>
                                            );
                                        }
                                        return (
                                            <li key={tile.key} className="home-nav-tiles__item" style={itemStyle}>
                                                <NavLink to={tile.to} className="home-nav-tiles__link">
                                                    {body}
                                                </NavLink>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'corporate-card' && <AccountingCorporateCardPanel />}

                    {activeTab === 'coming-soon' && (
                        <section className="acct-soon" aria-label="Скоро в системе">
                            <h2 className="acct-soon__title">Скоро в системе</h2>
                            <p className="acct-soon__text">Этот раздел ещё готовится и появится в одном из следующих обновлений.</p>
                        </section>
                    )}

                    {activeTab === 'invoices' && (
                        <div className="acct-page__invoices-wrap">
                            <Suspense fallback={<InvoicesSkeleton />}>
                                <LazyInvoicesPanel variant="accounting" />
                            </Suspense>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
