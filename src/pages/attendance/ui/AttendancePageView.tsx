import { useI18n } from '@shared/i18n';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { AttendanceOverviewCard } from './AttendanceOverviewCard';
import './AttendancePage.css';

export function AttendancePageView() {
    const { t } = useI18n();
    return (
        <div className="att">
            <main className="att__main">
                <header className="att__header">
                    <div className="att__header-inner">
                        <div className="att__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="att__title">{t('attendancePage.title')}</h1>
                                <p className="att__subtitle">{t('attendancePage.subtitle')}</p>
                            </div>
                        </div>
                        <div className="att__header-actions">
                            <AppPageSettings />
                        </div>
                    </div>
                </header>

                <div className="att__content">
                    <AttendanceOverviewCard />
                </div>
            </main>
        </div>
    );
}
