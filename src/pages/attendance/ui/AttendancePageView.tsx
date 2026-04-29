import { useCurrentUser } from '@shared/hooks';
import { AppBackButton, AppPageSettings } from '@shared/ui';
import { useAttendance } from '../model/AttendanceContext';
import { AttendanceKPISection } from './AttendanceKPISection';
import { AttendanceReportSection } from './AttendanceReportSection';
import { WorkdaySettingsModal } from './WorkdaySettingsModal';
import './AttendancePage.css';
export function AttendancePageView() {
    const { dateFrom, setDateFrom, dateTo, setDateTo, search, setSearch, typeFilter, setTypeFilter, settings, settingsLoading, settingsError, saveWorkdaySettings, isSettingsOpen, setIsSettingsOpen, groupedRecords, loading, error, load, filteredGroupedRecords, summary, showTable, handleReset, handleExportExcel, typeFilterOptions, isDailyMode, } = useAttendance();
    const { user, loading: userLoading } = useCurrentUser();
    const hideWorkdaySettingsForIt = !userLoading && user?.role?.trim() === 'IT отдел';
    const settingsBtnTitle = settingsLoading ? 'Загрузка настроек…' : 'Настройки';
    return (<div className="att">
      <main className="att__main">
        <header className="att__header">
          <div className="att__header-inner">
            <div className="att__header-start">
              <AppBackButton className="app-back-btn" />
              <div>
                <h1 className="att__title">Посещаемость</h1>
                <p className="att__subtitle">Время прихода и ухода сотрудников, отработанные часы</p>
              </div>
            </div>
            <div className="att__header-actions">
              <AppPageSettings />
              {!hideWorkdaySettingsForIt && (<button type="button" className="att__icon-btn" onClick={() => setIsSettingsOpen(true)} title={settingsBtnTitle} disabled={settingsLoading}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </button>)}
              <button type="button" className="att__icon-btn" onClick={load} disabled={loading} title="Обновить">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"/>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                  <path d="M3 22v-6h6"/>
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="att__content">
          {settingsError && (<div className="att__alert att__alert--muted" role="status">
              <span>{settingsError}</span>
            </div>)}

          {error && (<div className="att__alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
              <button type="button" className="att__alert-btn" onClick={load}>Повторить</button>
            </div>)}

          <AttendanceKPISection summary={summary} settings={settings} loading={loading}/>

          <AttendanceReportSection dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} search={search} setSearch={setSearch} typeFilter={typeFilter} setTypeFilter={setTypeFilter} groupedRecords={groupedRecords} filteredGroupedRecords={filteredGroupedRecords} loading={loading} error={!!error} recordsCount={groupedRecords.length} showTable={showTable} load={load} onReset={handleReset} onExportExcel={handleExportExcel} settings={settings} typeFilterOptions={typeFilterOptions} isDailyMode={isDailyMode}/>
        </div>
      </main>

      {isSettingsOpen && !hideWorkdaySettingsForIt && (<WorkdaySettingsModal initial={settings} onClose={() => setIsSettingsOpen(false)} onSave={saveWorkdaySettings}/>)}
    </div>);
}
