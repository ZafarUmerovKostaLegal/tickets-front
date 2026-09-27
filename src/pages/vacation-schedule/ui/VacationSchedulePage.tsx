import { AppBackButton, AppHomeLogo } from '@shared/ui';
import './VacationSchedulePage.css';

export function VacationSchedulePage() {
    return (
        <div className="vacation-schedule-page">
            <main className="vacation-schedule-page__main">
                <header className="vacation-schedule-page__header">
                    <div className="vacation-schedule-page__header-start">
                        <AppBackButton className="app-back-btn" />
                        <AppHomeLogo withSeparator />
                        <h1 className="vacation-schedule-page__title">График отпусков</h1>
                    </div>
                </header>
            </main>
        </div>
    );
}
