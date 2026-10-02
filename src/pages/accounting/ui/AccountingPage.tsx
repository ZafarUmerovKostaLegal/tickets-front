import { Suspense, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { routes } from '@shared/config';
import { getUsers } from '@entities/user';
import { getInvoiceRegistrySheet } from '@entities/time-tracking/api/domains/invoiceRegistry';
import { LazyInvoicesPanel } from '@features/invoices';
import { InvoicesSkeleton } from '@pages/time-tracking/ui/InvoicesSkeleton';
import { AccountingHrPanel } from './AccountingHrPanel';
import './AccountingPage.css';

type AccountingTab = 'overview' | 'invoices' | 'hr';

const HUB_TILES = [
    {
        key: 'invoices' as const,
        tab: 'invoices' as const,
        label: 'Инвойсы',
        hint: 'Счета, выставленные клиентам',
        variant: 'blue' as const,
    },
    {
        key: 'hr' as const,
        tab: 'hr' as const,
        label: 'HR',
        hint: 'Сотрудники, роли и должности',
        variant: 'teal' as const,
    },
    {
        key: 'expenses' as const,
        to: routes.expenses,
        label: 'Расходы',
        hint: 'Заявки и согласование',
        variant: 'amber' as const,
    },
    {
        key: 'reporting' as const,
        to: routes.expensesReport,
        label: 'Отчётность',
        hint: 'Сводные отчёты по расходам',
        variant: 'violet' as const,
    },
];

function TileIcon({ name }: { name: 'invoices' | 'hr' | 'expenses' | 'reporting' }) {
    const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true as const };
    if (name === 'invoices') {
        return (
            <svg {...common}>
                <path d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
                <path d="M14 3.5V8h5M8.5 12h7M8.5 15.5h5" />
            </svg>
        );
    }
    if (name === 'hr') {
        return (
            <svg {...common}>
                <circle cx="9" cy="8" r="2.4" />
                <circle cx="16" cy="9" r="2" />
                <path d="M4.5 18.5c.6-2.4 2.5-3.8 4.5-3.8s3.9 1.4 4.5 3.8M14 14.8c1.3-.5 2.6-.4 3.6.3 1 .7 1.6 1.8 1.9 3.4" />
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
    return (
        <svg {...common}>
            <path d="M5 19V10M10 19V5M15 19v-6M20 19V8" />
        </svg>
    );
}

function HubChevron() {
    return (
        <svg className="acct-page__hub-tile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 6l6 6-6 6" />
        </svg>
    );
}

function OverviewSkeleton() {
    return (
        <section className="acct-page__hub" aria-busy="true" aria-label="Загрузка обзора">
            <div className="acct-page__stats">
                <div className="acct-skel acct-skel--stat" />
                <div className="acct-skel acct-skel--stat" />
            </div>
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="acct-skel acct-skel--tile" />)}
        </section>
    );
}

const ACCOUNTING_TAB_KEY = 'acct-tab';

function readAccountingTab(): AccountingTab {
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
    const [activeTab, setActiveTab] = useState<AccountingTab>(readAccountingTab);
    const [staffCount, setStaffCount] = useState<number | null>(null);
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

    return (
        <div className="acct-page">
            <main className="acct-page__main">
                <header className="acct-page__header">
                    <div className="acct-page__header-inner">
                        <div className="acct-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="acct-page__title">Бухгалтерия</h1>
                                <p className="acct-page__subtitle">Обзор, счета и сотрудники. Доступно администраторам и партнёрам</p>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>

                <nav className="acct-tabs" role="tablist" aria-label="Разделы бухгалтерии">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'overview'}
                        className={`acct-tabs__tab${activeTab === 'overview' ? ' acct-tabs__tab--on' : ''}`}
                        onClick={() => selectTab('overview')}
                    >
                        Обзор
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'invoices'}
                        className={`acct-tabs__tab${activeTab === 'invoices' ? ' acct-tabs__tab--on' : ''}`}
                        onClick={() => selectTab('invoices')}
                    >
                        Инвойсы
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'hr'}
                        className={`acct-tabs__tab${activeTab === 'hr' ? ' acct-tabs__tab--on' : ''}`}
                        onClick={() => selectTab('hr')}
                    >
                        HR
                    </button>
                </nav>

                <div
                    className={`acct-page__content${activeTab === 'invoices' ? ' acct-page__content--invoices' : ''}`}
                    role="tabpanel"
                >
                    {activeTab === 'overview' && (overviewLoading ? <OverviewSkeleton /> : (
                        <section className="acct-page__hub" aria-label="Разделы бухгалтерии">
                            <div className="acct-page__stats">
                                <button type="button" className="acct-page__stat acct-page__stat--hr" onClick={() => selectTab('hr')}>
                                    <span className="acct-page__stat-kicker">Команда</span>
                                    <span className="acct-page__stat-value">{staffCount ?? '—'}</span>
                                    <span className="acct-page__stat-label">сотрудников</span>
                                </button>
                                <button type="button" className="acct-page__stat acct-page__stat--invoices" onClick={() => selectTab('invoices')}>
                                    <span className="acct-page__stat-kicker">2026</span>
                                    <span className="acct-page__stat-value">{invoiceCount ?? '—'}</span>
                                    <span className="acct-page__stat-label">счетов из системы</span>
                                </button>
                            </div>
                            {HUB_TILES.map((tile) => {
                                const body = (
                                    <>
                                        <div className={`acct-page__hub-tile-icon acct-page__hub-tile-icon--${tile.variant}`}>
                                            <TileIcon name={tile.key} />
                                        </div>
                                        <div className="acct-page__hub-tile-body">
                                            <span className="acct-page__hub-tile-label">{tile.label}</span>
                                            <span className="acct-page__hub-tile-hint">{tile.hint}</span>
                                        </div>
                                        <HubChevron />
                                    </>
                                );
                                if ('tab' in tile) {
                                    return (
                                        <button
                                            key={tile.key}
                                            type="button"
                                            className={`acct-page__hub-tile acct-page__hub-tile--${tile.variant}`}
                                            onClick={() => selectTab(tile.tab)}
                                        >
                                            {body}
                                        </button>
                                    );
                                }
                                return (
                                    <NavLink
                                        key={tile.key}
                                        to={tile.to}
                                        className={`acct-page__hub-tile acct-page__hub-tile--${tile.variant}`}
                                    >
                                        {body}
                                    </NavLink>
                                );
                            })}
                        </section>
                    ))}

                    {activeTab === 'hr' && <AccountingHrPanel />}

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
