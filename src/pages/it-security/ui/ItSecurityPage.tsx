import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { ItSecurityJournal } from './ItSecurityJournal';
import './ItSecurityPage.css';

export function ItSecurityPage() {
    const { t } = useI18n();
    return (
        <div className="its-page">
            <main className="its-page__main">
                <header className="its-page__header">
                    <div className="its-page__header-inner">
                        <div className="its-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="its-page__title">{t('nav.itSecurity')}</h1>
                                <p className="its-page__subtitle">{t('itSecurityPage.subtitle')}</p>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>
                <div className="its-page__content">
                    <ItSecurityJournal />
                </div>
            </main>
        </div>
    );
}
