import { AppBackButton, AppPageSettings } from '@shared/ui';
import { useAdmin } from '../model/AdminContext';
import { AdminKPISection } from './AdminKPISection';
import { AdminUsersSection } from './AdminUsersSection';
import { LateSection } from './LateSection';
import './AdminPage.css';
export function AdminPageView() {
    const { users, loading, error, loadUsers, lateLoading, lateError, lateMetrics, loadAttendance, metrics, } = useAdmin();
    return (<div className="ap">
      <main className="ap__main">
        <header className="ap__header">
          <div className="ap__header-inner">
            <div className="ap__header-start">
              <AppBackButton className="app-back-btn app-back-btn--ap" />
              <div className="ap__header-left">
                <h1 className="ap__title">Админ‑панель</h1>
                <p className="ap__subtitle">Управление пользователями, тикетами и посещаемостью</p>
              </div>
            </div>
            <div className="ap__header-right">
              <AppPageSettings />
              <button type="button" className="ap__refresh-btn" onClick={loadUsers} disabled={loading} title="Обновить данные">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              </button>
            </div>
          </div>
        </header>

        <div className="ap__content">
          {error && (<div className="ap__alert ap__alert--error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Не удалось загрузить пользователей: {error}</span>
              <button type="button" className="ap__alert-btn" onClick={loadUsers} disabled={loading}>Повторить</button>
            </div>)}

          <AdminKPISection metrics={metrics} loading={loading} usersCount={users.length}/>

          <div className="ap__grid">
            <AdminUsersSection />
          </div>

          <div className="ap__bottom-grid">
            <LateSection lateLoading={lateLoading} lateError={lateError} lateMetrics={lateMetrics} loadAttendance={loadAttendance}/>
          </div>
        </div>
      </main>

    </div>);
}
