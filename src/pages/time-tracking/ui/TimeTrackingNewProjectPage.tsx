import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { routes, getProjectDetailUrl } from '@shared/config';
import { listAllTimeManagerClientsMerged, type TimeManagerClientRow } from '@entities/time-tracking';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking, canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { ClientProjectModal } from './TimeTrackingClientProjectModal';
import { TimeTrackingNewProjectFormSkeleton } from './TimeTrackingNewProjectFormSkeleton';
import './TimeTrackingPage.css';

export function TimeTrackingNewProjectPage() {
    const { t } = useI18n();
    const { user, loading: userLoading } = useCurrentUser();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingClients, setLoadingClients] = useState(true);
    const canManage = canManageTimeTrackingClients(user);

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
                    setLoadError(e instanceof Error ? e.message : t('timeTrackingPage.projects.newProjectPage.errLoadClients'));
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
    }, [t]);

    const clientIdFromUrl = searchParams.get('client');
    const fixedClientId = useMemo(() => {
        if (!clientIdFromUrl?.trim())
            return null;
        const id = clientIdFromUrl.trim();
        return clients.some((c) => c.id === id) ? id : null;
    }, [clientIdFromUrl, clients]);

    if (userLoading || loadingClients) {
        const toProjectsLoading = () => {
            void navigate({ pathname: routes.timeTracking, search: '?tab=projects' });
        };
        return (<div className="time-page time-page--enter time-page--new-project-sub" role="status" aria-live="polite" aria-busy="true">
      <span className="tt-clients-skel__sr-only">{t('timeTrackingPage.projects.newProjectPage.loadingSr')}</span>
      <main className="time-page__main">
        <nav className="time-page__navbar" aria-label={t('timeTrackingPage.projects.newProjectPage.navAria')}>
          <AppBackButton
            onClick={toProjectsLoading}
            label={t('timeTrackingPage.projects.newProjectPage.backToProjects')}
            ariaLabel={t('timeTrackingPage.projects.newProjectPage.backToProjects')}
            hideLabelOnMobile
          />
          <AppHomeLogo withSeparator />
          <div className="time-page__navbar-sep" aria-hidden="true"/>
          <span className="time-page__navbar-title">{t('timeTrackingPage.projects.newProject')}</span>
          <div className="time-page__navbar-spacer"/>
          <div className="time-page__navbar-settings">
            <AppPageSettings />
          </div>
        </nav>
        <div className="time-page__content time-page__content--enter time-page__content--new-project-form">
          <TimeTrackingNewProjectFormSkeleton />
        </div>
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
          {t('timeTrackingPage.projects.newProjectPage.backToProjects')}
        </button>
      </main>
    </div>);
    }
    const toProjects = () => {
        void navigate({ pathname: routes.timeTracking, search: '?tab=projects' });
    };
    return (<div className="time-page time-page--enter time-page--new-project-sub">
      <main className="time-page__main">
        <nav className="time-page__navbar" aria-label={t('timeTrackingPage.projects.newProjectPage.navAria')}>
          <AppBackButton
            onClick={toProjects}
            label={t('timeTrackingPage.projects.newProjectPage.backToProjects')}
            ariaLabel={t('timeTrackingPage.projects.newProjectPage.backToProjects')}
            hideLabelOnMobile
          />
          <AppHomeLogo withSeparator />
          <div className="time-page__navbar-sep" aria-hidden="true"/>
          <span className="time-page__navbar-title">{t('timeTrackingPage.projects.newProject')}</span>
          <div className="time-page__navbar-spacer"/>
          <div className="time-page__navbar-settings">
            <AppPageSettings />
          </div>
        </nav>
        <div className="time-page__content time-page__content--enter time-page__content--new-project-form" role="region" aria-label={t('timeTrackingPage.projects.newProjectPage.formRegionAria')}>
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
