import { startTransition, useCallback, useMemo, useState, ViewTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { filesApi } from '../api/filesApi';
import { AccessRequestsBadge } from './fmBadges';
import { AuditView, MonitoringView, TemplateView } from './AdminViews';
import { MatrixView, RequestAccessModal, RequestsView, SecurityView } from './AccessViews';
import { ClientsView, MattersListView } from './DirectoryViews';
import { FavoritesView, RecentView, SearchView, TrashView } from './LibraryViews';
import { MatterWorkspace, type Location } from './MatterWorkspace';
import { Icon, StateBlock, ToastHost, useFm, useLoad, useNotify, type IconName } from './fmShared';
import './FileManagerPage.css';

type View =
    | 'clients' | 'matters' | 'myMatters' | 'matter' | 'favorites' | 'recent' | 'search' | 'trash' | 'requests'
    | 'security' | 'matrix' | 'audit' | 'monitoring' | 'templates';

type NavItem = { id: View; label: string; icon: IconName; badge?: 'requests' };

const WORKSPACE: NavItem[] = [
    { id: 'clients', label: 'nav.clients', icon: 'building' },
    { id: 'matters', label: 'nav.allMatters', icon: 'briefcase' },
    { id: 'myMatters', label: 'nav.myMatters', icon: 'user' },
    { id: 'favorites', label: 'nav.favorites', icon: 'star' },
    { id: 'recent', label: 'nav.recent', icon: 'clock' },
    { id: 'search', label: 'nav.search', icon: 'search' },
    { id: 'trash', label: 'nav.trash', icon: 'trash' },
];

const EMPLOYEE_EXTRA: NavItem[] = [{ id: 'requests', label: 'nav.myRequests', icon: 'inbox' }];

const ADMIN: NavItem[] = [
    { id: 'security', label: 'nav.security', icon: 'shield' },
    { id: 'requests', label: 'nav.requests', icon: 'inbox', badge: 'requests' },
    { id: 'matrix', label: 'nav.matrix', icon: 'grid' },
    { id: 'audit', label: 'nav.audit', icon: 'list' },
    { id: 'monitoring', label: 'nav.monitoring', icon: 'pulse' },
    { id: 'templates', label: 'nav.templates', icon: 'template' },
];

const ADMIN_VIEWS = new Set<View>(['matrix', 'audit', 'monitoring']);
const ALL_VIEWS = new Set<View>([...WORKSPACE, ...ADMIN, { id: 'matter' as View }].map((item) => item.id));

function readView(value: string | null, matterId: string | null): View {
    if (value && ALL_VIEWS.has(value as View))
        return value === 'matter' && !matterId ? 'matters' : value as View;
    return matterId ? 'matter' : 'clients';
}

type GoParams = Partial<Location> & { clientId?: string | null };

function FileManagerWorkspace() {
    const { tr } = useFm();
    const notify = useNotify();
    const [params, setParams] = useSearchParams();
    const [uploadSignal, setUploadSignal] = useState(0);
    const [requesting, setRequesting] = useState(false);
    const [badgeTick, setBadgeTick] = useState(0);
    const clients = useLoad(() => filesApi.clients(), []);

    const canManage = clients.data?.viewer.canManage ?? false;
    const matterId = params.get('matter');
    const folderId = params.get('folder');
    const docId = params.get('doc');
    const clientId = params.get('client');
    const requested = readView(params.get('view'), matterId);
    const view: View = !canManage && ADMIN_VIEWS.has(requested) ? 'clients' : requested;

    const go = useCallback((next: View, loc: GoParams = {}, replace = false) => {
        const search = new URLSearchParams();
        if (next !== 'clients')
            search.set('view', next);
        if (loc.clientId)
            search.set('client', loc.clientId);
        if (loc.matterId)
            search.set('matter', loc.matterId);
        if (loc.folderId)
            search.set('folder', loc.folderId);
        if (loc.docId)
            search.set('doc', loc.docId);
        startTransition(() => {
            setParams(search, { replace });
        });
    }, [setParams]);

    const openMatter = useCallback((loc: Location) => {
        const sameFolder = view === 'matter' && loc.matterId === matterId && loc.folderId === folderId;
        go('matter', loc, sameFolder);
    }, [go, view, matterId, folderId]);

    const reloadClients = clients.reload;
    const refreshAll = useCallback(() => {
        reloadClients();
        setBadgeTick((n) => n + 1);
    }, [reloadClients]);

    const workspace = useMemo(() => (canManage ? WORKSPACE : [...WORKSPACE, ...EMPLOYEE_EXTRA]), [canManage]);
    const navView: View = view === 'matter' ? 'matters' : view;
    const active = [...workspace, ...ADMIN].find((item) => item.id === navView) ?? WORKSPACE[0];
    const serviceDown = clients.error !== null && clients.data === null;

    const onUpload = () => {
        if (view === 'matter' && matterId) {
            setUploadSignal((n) => n + 1);
            return;
        }
        notify(tr('browser.pickMatterFirst'), 'error');
        if (view !== 'matters' && view !== 'myMatters')
            go('matters');
    };

    const renderItem = (item: NavItem) => (
        <button key={item.id} type="button" className={navView === item.id ? 'is-on' : ''} aria-current={navView === item.id ? 'page' : undefined}
            onClick={() => {
                if (item.id !== view)
                    go(item.id);
            }}>
            <Icon name={item.icon} />
            <span>{tr(item.label)}</span>
            {item.badge === 'requests' ? <AccessRequestsBadge tick={badgeTick} /> : null}
        </button>
    );

    const renderView = () => {
        const data = clients.data;
        if (!data)
            return null;
        const viewerId = data.viewer.userId;
        const openClient = (id: string | null) => go('matters', { clientId: id });
        switch (view) {
            case 'clients':
                return <ClientsView clients={data} onOpenClient={openClient} onChanged={refreshAll} />;
            case 'matters':
            case 'myMatters':
                return (
                    <MattersListView
                        clients={data}
                        clientId={clientId}
                        mineOnly={view === 'myMatters'}
                        onPickClient={(id) => go(view, { clientId: id }, true)}
                        onOpenMatter={(id) => go('matter', { matterId: id })}
                        onOpenClients={() => go('clients')}
                        onChanged={refreshAll}
                    />
                );
            case 'matter':
                return matterId ? (
                    <MatterWorkspace
                        key={matterId}
                        matterId={matterId}
                        folderId={folderId}
                        docId={docId}
                        viewerId={viewerId}
                        uploadSignal={uploadSignal}
                        onNavigate={openMatter}
                        onOpenClients={() => go('clients')}
                        onOpenClient={openClient}
                        onClientsStale={refreshAll}
                        onOpenSecurity={(id) => go('security', { matterId: id })}
                    />
                ) : null;
            case 'favorites':
                return <FavoritesView viewerId={viewerId} onLocate={openMatter} />;
            case 'recent':
                return <RecentView viewerId={viewerId} onLocate={openMatter} />;
            case 'search':
                return <SearchView clients={data} viewerId={viewerId} onLocate={openMatter} />;
            case 'trash':
                return <TrashView onChanged={refreshAll} />;
            case 'requests':
                return <RequestsView canManage={canManage} onChanged={refreshAll} />;
            case 'security':
                return <SecurityView clients={data} matterId={matterId} onPickMatter={(id) => go('security', { matterId: id })} />;
            case 'matrix':
                return <MatrixView clients={data} />;
            case 'audit':
                return <AuditView clients={data} initialMatterId={matterId} />;
            case 'monitoring':
                return <MonitoringView onOpenAudit={() => go('audit')} />;
            case 'templates':
                return <TemplateView />;
        }
    };

    const workspaceView = view === 'matter';

    return (
        <div className="fm__body">
            <aside className="fm-side">
                <button type="button" className="fm-side__create" onClick={onUpload}>
                    <Icon name="upload" />{tr('nav.upload')}
                </button>
                <button type="button" className="fm-side__secondary" onClick={() => setRequesting(true)} disabled={!clients.data}>
                    <Icon name="key" />{tr('nav.requestAccess')}
                </button>
                <p>{tr('nav.workspace')}</p>
                <nav aria-label={tr('nav.workspace')}>{workspace.map(renderItem)}</nav>
                {canManage ? (
                    <>
                        <p>{tr('nav.admin')}</p>
                        <nav aria-label={tr('nav.admin')}>{ADMIN.map(renderItem)}</nav>
                    </>
                ) : null}
            </aside>
            <ViewTransition default="none" enter="none" exit="none" update="fm-section">
                <main key={workspaceView ? `matter:${matterId}` : `${view}:${clientId ?? ''}`} className={workspaceView ? 'fm__main fm__main--browser' : 'fm__main'}>
                    {!workspaceView ? (
                        <header className="fm__view-head">
                            <Icon name={active.icon} />
                            <h2>{tr(active.label)}</h2>
                        </header>
                    ) : null}
                    {serviceDown ? (
                        <StateBlock loading={false} error={clients.error === tr('common.error') ? tr('common.serviceDown') : clients.error} onRetry={clients.reload} />
                    ) : (
                        <StateBlock loading={clients.loading && !clients.data} error={null}>
                            {renderView()}
                        </StateBlock>
                    )}
                </main>
            </ViewTransition>
            {requesting && clients.data ? (
                <RequestAccessModal requestable={clients.data.requestable} onClose={() => setRequesting(false)} onSent={refreshAll} />
            ) : null}
        </div>
    );
}

export function FileManagerPage() {
    const { t } = useI18n();
    return (
        <div className="fm">
            <header className="fm__header">
                <div className="fm__header-inner">
                    <div className="fm__header-start">
                        <AppBackButton className="app-back-btn" />
                        <AppHomeLogo withSeparator />
                        <h1 className="fm__title">{t('nav.fileManager')}</h1>
                    </div>
                    <AppPageSettings />
                </div>
            </header>
            <ToastHost>
                <FileManagerWorkspace />
            </ToastHost>
        </div>
    );
}
