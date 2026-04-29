import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { routes, getProjectDetailUrl } from '@shared/config';
import { listAllTimeManagerClientsMerged, type TimeManagerClientRow } from '@entities/time-tracking';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { canManageTimeManagerClients } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { AppPageSettings } from '@shared/ui';
import { ClientProjectModal } from './TimeTrackingClientProjectModal';
import './TimeTrackingPage.css';

export function TimeTrackingNewProjectPage() {
    const { user, loading: userLoading } = useCurrentUser();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingClients, setLoadingClients] = useState(true);
    const canManage = canManageTimeManagerClients(user?.role);

    useEffect(() => {
        let cancelled = false;
        setLoadingClients(true);
        setLoadError(null);
        listAllTimeManagerClientsMerged()
            .then((rows) => {
                if (!cancelled)
                    setClients(rows);
            })
            .catch((e) => {
                if (!cancelled) {
                    setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
                    setClients([]);
                }
            })
            .finally(() => {
                if (!cancelled)
                    setLoadingClients(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const clientIdFromUrl = searchParams.get('client');
    const fixedClientId = useMemo(() => {
        if (!clientIdFromUrl?.trim())
            return null;
        const id = clientIdFromUrl.trim();
        return clients.some((c) => c.id === id) ? id : null;
    }, [clientIdFromUrl, clients]);

    if (userLoading || loadingClients) {
        return (<div className="time-page time-page--enter" role="status" aria-live="polite">
      <main className="time-page__main" style={{ minHeight: '40vh', padding: '1.5rem' }}>
        Загрузка…
      </main>
    </div>);
    }
    if (!user || !canAccessTimeTracking(user))
        return <Navigate to={routes.home} replace/>;
    if (!canManage)
        return <Navigate to={{ pathname: routes.timeTracking, search: '?tab=projects' }} replace/>;
    if (loadError) {
        return (<div className="time-page time-page--enter">
      <main className="time-page__main" style={{ padding: '1.5rem' }}>
        <p className="tt-settings__banner-error" role="alert">
          {loadError}
        </p>
        <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={() => navigate({ pathname: routes.timeTracking, search: '?tab=projects' })}>
          К проектам
        </button>
      </main>
    </div>);
    }
    const toProjects = () => {
        void navigate({ pathname: routes.timeTracking, search: '?tab=projects' });
    };
    return (<div className="time-page time-page--enter time-page--new-project-sub">
      <main className="time-page__main">
        <nav className="time-page__navbar" aria-label="Навигация">
          <button type="button" className="time-page__back-btn" onClick={toProjects} aria-label="К проектам">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span className="time-page__back-label">К проектам</span>
          </button>
          <div className="time-page__navbar-sep" aria-hidden="true"/>
          <span className="time-page__navbar-title">Новый проект</span>
          <div className="time-page__navbar-spacer"/>
          <div className="time-page__navbar-settings">
            <AppPageSettings />
          </div>
        </nav>
        <div className="time-page__content time-page__content--enter time-page__content--new-project-form" role="region" aria-label="Форма нового проекта">
          <ClientProjectModal key={fixedClientId ?? 'all'} mode="create" presentation="page" fixedClientId={fixedClientId} clientsForPicker={clients} initial={null} canManage={canManage} onClientCreated={(c) => {
            setClients((prev) => (prev.some((x) => x.id === c.id)
                ? prev
                : [...prev, c].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))));
        }} onClose={toProjects} onSaved={(row) => {
            navigate(getProjectDetailUrl(row.id, row.client_id));
        }}/>
        </div>
      </main>
    </div>);
}
