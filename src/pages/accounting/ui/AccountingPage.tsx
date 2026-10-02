import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { routes } from '@shared/config';
import { getUsers } from '@entities/user';
import { getInvoiceRegistrySheet } from '@entities/time-tracking/api/domains/invoiceRegistry';
import { LazyInvoicesPanel } from '@features/invoices';
import { TimeTrackingPanelSuspense } from '@pages/time-tracking/ui/timeTrackingLazyPanels';
import { AccountingHrPanel } from './AccountingHrPanel';
import './AccountingPage.css';

type AccountingTab = 'overview' | 'invoices' | 'hr';

const HUB_TILES = [
    {
        key: 'invoices',
        tab: 'invoices' as const,
        label: 'Инвойсы',
        hint: 'Счета, выставленные клиентам',
        variant: 'blue' as const,
    },
    {
        key: 'hr',
        tab: 'hr' as const,
        label: 'HR',
        hint: 'Сотрудники, роли и должности',
        variant: 'green' as const,
    },
    {
        key: 'expenses',
        to: routes.expenses,
        label: 'Расходы',
        hint: 'Заявки и согласование',
        variant: 'green' as const,
    },
    {
        key: 'reporting',
        to: routes.expensesReport,
        label: 'Отчётность',
        hint: 'Сводные отчёты по расходам',
        variant: 'blue' as const,
    },
] as const;

function HubIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
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
        void getUsers(false)
            .then((rows) => {
                if (!cancelled)
                    setStaffCount(rows.filter((user) => !user.is_archived && !user.is_blocked).length);
            })
            .catch(() => {
                if (!cancelled)
                    setStaffCount(null);
            });
        void getInvoiceRegistrySheet('2026-system')
            .then((sheet) => {
                if (!cancelled)
                    setInvoiceCount(Array.isArray(sheet.rows) ? sheet.rows.length : 0);
            })
            .catch(() => {
                if (!cancelled)
                    setInvoiceCount(null);
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
                    {activeTab === 'overview' && (
                        <section className="acct-page__hub" aria-label="Разделы бухгалтерии">
                            <div className="acct-page__stats">
                                <button type="button" className="acct-page__stat" onClick={() => selectTab('hr')}>
                                    <span className="acct-page__stat-value">{staffCount ?? '—'}</span>
                                    <span className="acct-page__stat-label">сотрудников</span>
                                </button>
                                <button type="button" className="acct-page__stat" onClick={() => selectTab('invoices')}>
                                    <span className="acct-page__stat-value">{invoiceCount ?? '—'}</span>
                                    <span className="acct-page__stat-label">счетов 2026 из системы</span>
                                </button>
                            </div>
                            {HUB_TILES.map((tile) => {
                                const body = (
                                    <>
                                        <div className={`acct-page__hub-tile-icon acct-page__hub-tile-icon--${tile.variant}`}>
                                            <HubIcon />
                                        </div>
                                        <div className="acct-page__hub-tile-body">
                                            <span className="acct-page__hub-tile-label">{tile.label}</span>
                                            <span className="acct-page__hub-tile-hint">{tile.hint}</span>
                                        </div>
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
                    )}

                    {activeTab === 'hr' && <AccountingHrPanel />}

                    {activeTab === 'invoices' && (
                        <div className="acct-page__invoices-wrap">
                            <TimeTrackingPanelSuspense>
                                <LazyInvoicesPanel variant="accounting" />
                            </TimeTrackingPanelSuspense>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
