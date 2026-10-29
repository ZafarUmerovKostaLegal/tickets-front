import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import './LegalHubPage.css';

export function LegalHubPage() {
    const { t } = useI18n();
    return (
        <div className="lh-page">
            <main className="lh-page__main">
                <header className="lh-page__header">
                    <div className="lh-page__header-inner">
                        <div className="lh-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="lh-page__title">{t('nav.legalHub')}</h1>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>
                <div className="lh-page__content" />
            </main>
        </div>
    );
}
