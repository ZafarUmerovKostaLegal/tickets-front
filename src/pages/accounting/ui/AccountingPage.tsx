import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { routes } from '@shared/config';
import { LazyInvoicesPanel } from '@features/invoices';
import { TimeTrackingPanelSuspense } from '@pages/time-tracking/ui/timeTrackingLazyPanels';
import './AccountingPage.css';

type AccountingTab = 'overview' | 'invoices';

const HUB_TILES = [
    {
        key: 'expenses',
        to: routes.expenses,
        label: 'Расходы',
        hint: 'Учёт, заявки и согласование расходов',
        variant: 'green' as const,
        icon: 'wallet' as const,
    },
    {
        key: 'reporting',
        to: routes.expensesReport,
        label: 'Отчётность',
        hint: 'Сводные отчёты и аналитика',
        variant: 'blue' as const,
        icon: 'chart' as const,
    },
] as const;

function HubIcon({ name }: { name: 'wallet' | 'chart' }) {
    if (name === 'wallet') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
    );
}

export function AccountingPage() {
    const [activeTab, setActiveTab] = useState<AccountingTab>('overview');

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
                                <p className="acct-page__subtitle">Учёт, отчётность и финансовые документы</p>
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
                        onClick={() => setActiveTab('overview')}
                    >
                        Обзор
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'invoices'}
                        className={`acct-tabs__tab${activeTab === 'invoices' ? ' acct-tabs__tab--on' : ''}`}
                        onClick={() => setActiveTab('invoices')}
                    >
                        Инвойсы
                    </button>
                </nav>

                <div
                    className={`acct-page__content${activeTab === 'invoices' ? ' acct-page__content--invoices' : ''}`}
                    role="tabpanel"
                >
                    {activeTab === 'overview' && (
                        <section className="acct-page__hub" aria-label="Разделы бухгалтерии">
                            {HUB_TILES.map((tile) => (
                                <NavLink
                                    key={tile.key}
                                    to={tile.to}
                                    className={({ isActive }) =>
                                        `acct-page__hub-tile acct-page__hub-tile--${tile.variant}${isActive ? ' acct-page__hub-tile--active' : ''}`
                                    }
                                >
                                    <div className={`acct-page__hub-tile-icon acct-page__hub-tile-icon--${tile.variant}`}>
                                        <HubIcon name={tile.icon} />
                                    </div>
                                    <div className="acct-page__hub-tile-body">
                                        <span className="acct-page__hub-tile-label">{tile.label}</span>
                                        <span className="acct-page__hub-tile-hint">{tile.hint}</span>
                                    </div>
                                    <span className="acct-page__hub-tile-chevron" aria-hidden>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </span>
                                </NavLink>
                            ))}
                        </section>
                    )}

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
