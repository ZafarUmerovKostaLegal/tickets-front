import { startTransition, useCallback, useMemo, useState, ViewTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { filesApi } from '../api/filesApi';
import { AccessRequestsBadge, CheckedOutBadge } from './fmBadges';
import { AuditView, MonitoringView, TemplateView } from './AdminViews';
import { MatrixView, RequestAccessModal, RequestsView, SecurityView } from './AccessViews';
import { CheckedOutView, FavoritesView, RecentView, SearchView, TrashView } from './LibraryViews';
import { MattersBrowser, type Location } from './MattersBrowser';
import { Icon, StateBlock, ToastHost, useFm, useLoad, useNotify, type IconName } from './fmShared';
import './FileManagerPage.css';

type View =
    | 'matters' | 'myMatters' | 'favorites' | 'recent' | 'checkedOut' | 'search' | 'trash' | 'requests'
    | 'security' | 'matrix' | 'audit' | 'monitoring' | 'templates';

type NavItem = { id: View; label: string; icon: IconName; badge?: 'requests' | 'checkedOut' };

const WORKSPACE: NavItem[] = [
    { id: 'matters', label: 'nav.matters', icon: 'building' },
    { id: 'myMatters', label: 'nav.myMatters', icon: 'briefcase' },
    { id: 'favorites', label: 'nav.favorites', icon: 'star' },
    { id: 'recent', label: 'nav.recent', icon: 'clock' },
    { id: 'checkedOut', label: 'nav.checkedOut', icon: 'lock', badge: 'checkedOut' },
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
const ALL_VIEWS = new Set<View>([...WORKSPACE, ...ADMIN].map((item) => item.id));

function readView(value: string | null): View {
    return value && ALL_VIEWS.has(value as View) ? value as View : 'matters';
}

function FileManagerWorkspace() {
    const { tr } = useFm();
    const notify = useNotify();
    const [params, setParams] = useSearchParams();
    const [uploadSignal, setUploadSignal] = useState(0);
    const [requesting, setRequesting] = useState(false);
    const [badgeTick, setBadgeTick] = useState(0);
    const clients = useLoad(() => filesApi.clients(), []);

    const canManage = clients.data?.viewer.canManage ?? false;
    const requested = readView(params.get('view'));
    const view: View = !canManage && ADMIN_VIEWS.has(requested) ? 'matters' : requested;
    const location: Location = {
        matterId: params.get('matter'),
        folderId: params.get('folder'),
        docId: params.get('doc'),
    };

    const go = useCallback((next: View, loc: Partial<Location> = {}, replace = false) => {
        const search = new URLSearchParams();
        if (next !== 'matters')
            search.set('view', next);
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

    const browserView = view === 'myMatters' ? 'myMatters' : 'matters';
    const navigateBrowser = useCallback((loc: Location) => {
        const sameFolder = loc.matterId === location.matterId && loc.folderId === location.folderId;
        go(view === 'myMatters' ? 'myMatters' : 'matters', loc, sameFolder);
    }, [go, view, location.matterId, location.folderId]);

    const reloadClients = clients.reload;
    const refreshAll = useCallback(() => {
        reloadClients();
        setBadgeTick((n) => n + 1);
    }, [reloadClients]);

    const workspace = useMemo(() => (canManage ? WORKSPACE : [...WORKSPACE, ...EMPLOYEE_EXTRA]), [canManage]);
    const active = [...workspace, ...ADMIN].find((item) => item.id === view) ?? WORKSPACE[0];
    const serviceDown = clients.error !== null && clients.data === null;

    const onUpload = () => {
        if ((view === 'matters' || view === 'myMatters') && location.matterId) {
            setUploadSignal((n) => n + 1);
            return;
        }
        notify(tr('browser.pickMatterFirst'), 'error');
        if (view !== 'matters' && view !== 'myMatters')
            go('matters');
    };

    const renderItem = (item: NavItem) => (
        <button key={item.id} type="button" className={view === item.id ? 'is-on' : ''} aria-current={view === item.id ? 'page' : undefined}
            onClick={() => {
                if (item.id !== view)
                    go(item.id, item.id === 'matters' || item.id === 'myMatters' ? { matterId: location.matterId, folderId: location.folderId } : {});
            }}>
            <Icon name={item.icon} />
            <span>{tr(item.label)}</span>
            {item.badge === 'requests' ? <AccessRequestsBadge tick={badgeTick} /> : null}
            {item.badge === 'checkedOut' ? <CheckedOutBadge tick={badgeTick} /> : null}
        </button>
    );

    const renderView = () => {
        const data = clients.data;
        if (!data)
            return null;
        const viewerId = data.viewer.userId;
        const locate = (loc: Location) => go('matters', loc);
        switch (view) {
            case 'matters':
            case 'myMatters':
                return (
                    <MattersBrowser
                        clients={data}
                        location={location}
                        mineOnly={browserView === 'myMatters'}
                        uploadSignal={uploadSignal}
                        onNavigate={navigateBrowser}
                        onClientsStale={refreshAll}
                        onOpenSecurity={(matterId) => go('security', { matterId })}
                    />
                );
            case 'favorites':
                return <FavoritesView viewerId={viewerId} onLocate={locate} />;
            case 'recent':
                return <RecentView viewerId={viewerId} onLocate={locate} />;
            case 'checkedOut':
                return <CheckedOutView viewerId={viewerId} onLocate={locate} canManage={canManage} />;
            case 'search':
                return <SearchView clients={data} viewerId={viewerId} onLocate={locate} />;
            case 'trash':
                return <TrashView onChanged={refreshAll} />;
            case 'requests':
                return <RequestsView canManage={canManage} onChanged={refreshAll} />;
            case 'security':
                return <SecurityView clients={data} matterId={location.matterId} onPickMatter={(matterId) => go('security', { matterId })} />;
            case 'matrix':
                return <MatrixView clients={data} />;
            case 'audit':
                return <AuditView clients={data} initialMatterId={location.matterId} />;
            case 'monitoring':
                return <MonitoringView onOpenAudit={() => go('audit')} />;
            case 'templates':
                return <TemplateView />;
        }
    };

    const browser = view === 'matters' || view === 'myMatters';

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
                <main key={browser ? 'browser' : view} className={browser ? 'fm__main fm__main--browser' : 'fm__main'}>
                    {!browser ? (
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
