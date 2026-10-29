import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { AccountingHrPanel } from '@pages/accounting/ui/AccountingHrPanel';
import '@pages/accounting/ui/AccountingPage.css';

export function HrPage() {
    return (
        <div className="acct-page">
            <main className="acct-page__main">
                <header className="acct-page__header">
                    <div className="acct-page__header-inner">
                        <div className="acct-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="acct-page__title">HR</h1>
                                <p className="acct-page__subtitle">Сотрудники, роли и должности</p>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>
                <div className="acct-page__content">
                    <AccountingHrPanel />
                </div>
            </main>
        </div>
    );
}
