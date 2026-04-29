import { AppBackButton, AppPageSettings } from '@shared/ui';
import { VacationScheduleGrid } from './VacationScheduleGrid';
import './VacationSchedulePage.css';
export function VacationSchedulePage() {
    return (<div className="vacation-schedule-page">
      <main className="vacation-schedule-page__main">
        <header className="vacation-schedule-page__header">
          <div className="vacation-schedule-page__header-start">
            <AppBackButton className="app-back-btn" />
            <h1 className="vacation-schedule-page__title">График отпусков</h1>
          </div>
          <AppPageSettings />
        </header>

        <div className="vacation-schedule-page__content">
          <div className="vacation-schedule-page__inner">
            <VacationScheduleGrid />
          </div>
        </div>
      </main>
    </div>);
}
