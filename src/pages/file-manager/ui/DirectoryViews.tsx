import { useMemo, useState } from 'react';
import { filesApi, type AccessLevel, type ClientsResponse, type MatterRow } from '../api/filesApi';
import { matchesFilter } from '../lib/filesFormat';
import { Icon, LevelBadge, useAction, useFm } from './fmShared';

type DirectoryLayout = 'list' | 'tiles';
const MATTERS_LAYOUT_KEY = 'fm.mattersLayout';
const CLIENTS_LAYOUT_KEY = 'fm.clientsLayout';

function readLayout(key: string): DirectoryLayout {
    try {
        return localStorage.getItem(key) === 'tiles' ? 'tiles' : 'list';
    } catch {
        return 'list';
    }
}

function writeLayout(key: string, layout: DirectoryLayout) {
    try {
        localStorage.setItem(key, layout);
    } catch {
        /* ignore */
    }
}

function ViewToggle({ layout, onChange }: { layout: DirectoryLayout; onChange: (layout: DirectoryLayout) => void }) {
    const { tr } = useFm();
    return (
        <div className="fm-view-toggle" role="group" aria-label={tr('directory.viewList')}>
            <button type="button" className={layout === 'list' ? 'is-on' : ''} aria-pressed={layout === 'list'}
                title={tr('directory.viewList')} onClick={() => onChange('list')}>
                <Icon name="list" />
            </button>
            <button type="button" className={layout === 'tiles' ? 'is-on' : ''} aria-pressed={layout === 'tiles'}
                title={tr('directory.viewTiles')} onClick={() => onChange('tiles')}>
                <Icon name="grid" />
            </button>
        </div>
    );
}

type ClientsProps = {
    clients: ClientsResponse;
    onOpenClient: (clientId: string) => void;
    onChanged: () => void;
};

type ClientStatus = 'active' | 'archived' | 'all';

export function ClientsView({ clients, onOpenClient, onChanged }: ClientsProps) {
    const { tr } = useFm();
    const act = useAction();
    const [filter, setFilter] = useState('');
    const [status, setStatus] = useState<ClientStatus>('active');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [withProjects, setWithProjects] = useState(false);
    const [layout, setLayout] = useState<DirectoryLayout>(() => readLayout(CLIENTS_LAYOUT_KEY));

    const archivedCount = clients.stats?.archivedClients
        ?? clients.clients.filter((client) => client.archived).length;

    const rows = useMemo(() => clients.clients
        .map((client) => ({
            client,
            openMatters: client.matters.filter((matter) => !matter.closed).length,
            totalMatters: client.matters.length,
        }))
        .filter(({ client, openMatters }) => {
            if (status === 'active' && client.archived)
                return false;
            if (status === 'archived' && !client.archived)
                return false;
            if (favoritesOnly && !client.favorite)
                return false;
            if (withProjects && openMatters === 0)
                return false;
            return matchesFilter(filter, client.name);
        })
        .sort((a, b) => Number(b.client.favorite) - Number(a.client.favorite)
            || Number(a.client.archived) - Number(b.client.archived)
            || a.client.name.localeCompare(b.client.name)), [clients.clients, filter, status, favoritesOnly, withProjects]);

    const dirty = Boolean(filter) || status !== 'active' || favoritesOnly || withProjects;
    const reset = () => {
        setFilter('');
        setStatus('active');
        setFavoritesOnly(false);
        setWithProjects(false);
    };

    const setClientsLayout = (next: DirectoryLayout) => {
        setLayout(next);
        writeLayout(CLIENTS_LAYOUT_KEY, next);
    };

    const toggleFavorite = async (clientId: string, favorite: boolean) => {
        const ok = await act(() => (favorite ? filesApi.removeFavorite('client', clientId) : filesApi.addFavorite('client', clientId)));
        if (ok)
            onChanged();
    };

    return (
        <section className="fm-docs fm-docs--padded">
            <div className="fm-toolbar fm-toolbar--filters">
                <label className="fm-search fm-search--wide">
                    <Icon name="search" />
                    <input autoFocus value={filter} placeholder={tr('directory.clientsSearch')} onChange={(event) => setFilter(event.target.value)} />
                </label>
                <select value={status} aria-label={tr('directory.status')} onChange={(event) => setStatus(event.target.value as ClientStatus)}>
                    <option value="active">{tr('directory.statusActive')}</option>
                    <option value="archived">{tr('directory.statusArchived')}{archivedCount ? ` (${archivedCount})` : ''}</option>
                    <option value="all">{tr('directory.statusAll')}</option>
                </select>
                <button type="button" className={favoritesOnly ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={favoritesOnly}
                    onClick={() => setFavoritesOnly((value) => !value)}>
                    <Icon name="star" />{tr('directory.favoritesOnly')}
                </button>
                <button type="button" className={withProjects ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={withProjects}
                    onClick={() => setWithProjects((value) => !value)}>
                    <Icon name="briefcase" />{tr('directory.withProjects')}
                </button>
                {dirty ? (
                    <button type="button" className="fm-filters__reset" onClick={reset}>{tr('directory.resetFilters')}</button>
                ) : null}
                <ViewToggle layout={layout} onChange={setClientsLayout} />
                <span className="fm-toolbar__stats">
                    {clients.stats ? tr('directory.clientsTotal', { count: clients.stats.clients }) : null}
                    <small>{tr('directory.filtered', { count: rows.length })}</small>
                </span>
            </div>
            {rows.length === 0 ? (
                <div className="fm-state">
                    <Icon name="building" />
                    <p>{tr('directory.clientsEmpty')}</p>
                    <small>{tr('directory.clientsEmptyHint')}</small>
                </div>
            ) : layout === 'tiles' ? (
                <div className="fm-matter-grid">
                    {rows.map(({ client, openMatters, totalMatters }) => (
                        <article
                            key={client.id}
                            className={client.archived ? 'fm-matter-card is-closed' : 'fm-matter-card'}
                            tabIndex={0}
                            role="button"
                            onClick={() => onOpenClient(client.id)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onOpenClient(client.id);
                                }
                            }}
                        >
                            <div className="fm-matter-card__head">
                                <span className="fm-matter-card__ico" aria-hidden>
                                    <Icon name="building" />
                                </span>
                                <button
                                    type="button"
                                    className={client.favorite ? 'fm-star is-on' : 'fm-star'}
                                    aria-pressed={client.favorite}
                                    aria-label={tr(client.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void toggleFavorite(client.id, client.favorite);
                                    }}
                                >
                                    <Icon name="star" />
                                </button>
                            </div>
                            <h3 className="fm-matter-card__title" title={client.name}>{client.name}</h3>
                            <div className="fm-matter-card__foot">
                                <span className={client.archived ? 'fm-matter-card__status is-closed' : 'fm-matter-card__status'}>
                                    {client.archived ? tr('directory.archived') : tr('directory.statusActive')}
                                </span>
                                <span aria-hidden>·</span>
                                <span className="fm-matter-card__docs">
                                    {tr('directory.clientProjects', { open: openMatters, total: totalMatters })}
                                </span>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="fm-table-wrap">
                    <table className="fm-table fm-table--clickable">
                        <thead>
                            <tr>
                                <th className="fm-table__star" aria-label={tr('pane.favoriteAdd')} />
                                <th>{tr('common.client')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ client }) => (
                                <tr key={client.id} tabIndex={0} className={client.archived ? 'is-archived' : undefined}
                                    onClick={() => onOpenClient(client.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter')
                                            onOpenClient(client.id);
                                    }}>
                                    <td className="fm-table__star">
                                        <button type="button" className={client.favorite ? 'fm-star is-on' : 'fm-star'} aria-pressed={client.favorite}
                                            aria-label={tr(client.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void toggleFavorite(client.id, client.favorite);
                                            }}>
                                            <Icon name="star" />
                                        </button>
                                    </td>
                                    <td>
                                        <span className="fm-table__name">
                                            <Icon name="building" className="fm-ico--client" />
                                            <strong>{client.name}</strong>
                                            {client.archived ? <span className="fm-level fm-level--none">{tr('directory.archived')}</span> : null}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

type MattersProps = {
    clients: ClientsResponse;
    clientId: string | null;
    mineOnly: boolean;
    onPickClient: (clientId: string | null) => void;
    onOpenMatter: (matterId: string) => void;
    onOpenClients: () => void;
    onChanged: () => void;
};

type MatterListRow = MatterRow & { clientName: string };
type MatterStatus = 'open' | 'closed' | 'all';
type AccessFilter = 'all' | AccessLevel;
type DocsFilter = 'any' | 'with' | 'without';

export function MattersListView({ clients, clientId, mineOnly, onPickClient, onOpenMatter, onOpenClients, onChanged }: MattersProps) {
    const { tr } = useFm();
    const act = useAction();
    const [filter, setFilter] = useState('');
    const [status, setStatus] = useState<MatterStatus>('open');
    const [access, setAccess] = useState<AccessFilter>('all');
    const [docs, setDocs] = useState<DocsFilter>('any');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [mineFilter, setMineFilter] = useState(false);
    const [layout, setLayout] = useState<DirectoryLayout>(() => readLayout(MATTERS_LAYOUT_KEY));
    const client = clientId ? clients.clients.find((row) => row.id === clientId) ?? null : null;

    const setMattersLayout = (next: DirectoryLayout) => {
        setLayout(next);
        writeLayout(MATTERS_LAYOUT_KEY, next);
    };

    const clientOptions = useMemo(() => clients.clients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)), [clients.clients]);

    const closedCount = clients.stats?.closedMatters
        ?? clients.clients.reduce((sum, row) => sum + row.matters.filter((matter) => matter.closed).length, 0);

    const rows = useMemo<MatterListRow[]>(() => clients.clients
        .filter((row) => !clientId || row.id === clientId)
        .flatMap((row) => row.matters.map((matter) => ({ ...matter, clientName: row.name })))
        .filter((matter) => {
            if ((mineOnly || mineFilter) && !matter.mine)
                return false;
            if (status === 'open' && matter.closed)
                return false;
            if (status === 'closed' && !matter.closed)
                return false;
            if (access !== 'all' && matter.level !== access)
                return false;
            if (favoritesOnly && !matter.favorite)
                return false;
            if (docs === 'with' && matter.documents === 0)
                return false;
            if (docs === 'without' && matter.documents > 0)
                return false;
            return matchesFilter(filter, matter.name, matter.code, matter.clientName);
        })
        .sort((a, b) => Number(b.favorite) - Number(a.favorite)
            || Number(a.closed) - Number(b.closed)
            || a.clientName.localeCompare(b.clientName)
            || a.name.localeCompare(b.name)), [
        clients, clientId, mineOnly, mineFilter, status, access, favoritesOnly, docs, filter,
    ]);

    const dirty = Boolean(filter) || Boolean(clientId) || status !== 'open' || access !== 'all'
        || favoritesOnly || (!mineOnly && mineFilter) || docs !== 'any';

    const reset = () => {
        setFilter('');
        setStatus('open');
        setAccess('all');
        setFavoritesOnly(false);
        setMineFilter(false);
        setDocs('any');
        if (clientId)
            onPickClient(null);
    };

    const toggleFavorite = async (matter: MatterListRow) => {
        const ok = await act(() => (matter.favorite ? filesApi.removeFavorite('matter', matter.id) : filesApi.addFavorite('matter', matter.id, matter.id)));
        if (ok)
            onChanged();
    };

    return (
        <section className="fm-docs fm-docs--padded">
            {client ? (
                <div className="fm-crumbs fm-crumbs--page">
                    <button type="button" onClick={onOpenClients}>{tr('nav.clients')}</button>
                    <Icon name="chevron" />
                    <span className="fm-crumbs__current">{client.name}</span>
                </div>
            ) : null}
            <div className="fm-toolbar fm-toolbar--filters">
                <label className="fm-search fm-search--wide">
                    <Icon name="search" />
                    <input autoFocus value={filter} placeholder={tr('directory.mattersSearch')} onChange={(event) => setFilter(event.target.value)} />
                </label>
                <select value={clientId ?? ''} aria-label={tr('common.client')} onChange={(event) => onPickClient(event.target.value || null)}>
                    <option value="">{tr('search.anyClient')}</option>
                    {clientOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <select value={status} aria-label={tr('directory.status')} onChange={(event) => setStatus(event.target.value as MatterStatus)}>
                    <option value="open">{tr('directory.statusOpen')}</option>
                    <option value="closed">{tr('directory.statusClosed')}{closedCount ? ` (${closedCount})` : ''}</option>
                    <option value="all">{tr('directory.statusAll')}</option>
                </select>
                <select value={access} aria-label={tr('directory.access')} onChange={(event) => setAccess(event.target.value as AccessFilter)}>
                    <option value="all">{tr('directory.accessAll')}</option>
                    <option value="manage">{tr('levels.manage')}</option>
                    <option value="edit">{tr('levels.edit')}</option>
                    <option value="read">{tr('levels.read')}</option>
                </select>
                <select value={docs} aria-label={tr('directory.documents')} onChange={(event) => setDocs(event.target.value as DocsFilter)}>
                    <option value="any">{tr('directory.docsAny')}</option>
                    <option value="with">{tr('directory.withDocs')}</option>
                    <option value="without">{tr('directory.withoutDocs')}</option>
                </select>
                <button type="button" className={favoritesOnly ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={favoritesOnly}
                    onClick={() => setFavoritesOnly((value) => !value)}>
                    <Icon name="star" />{tr('directory.favoritesOnly')}
                </button>
                {!mineOnly ? (
                    <button type="button" className={mineFilter ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={mineFilter}
                        onClick={() => setMineFilter((value) => !value)}>
                        <Icon name="user" />{tr('directory.mineOnly')}
                    </button>
                ) : null}
                {dirty ? (
                    <button type="button" className="fm-filters__reset" onClick={reset}>{tr('directory.resetFilters')}</button>
                ) : null}
                <ViewToggle layout={layout} onChange={setMattersLayout} />
                <span className="fm-toolbar__stats">
                    {clients.stats ? tr('directory.directoryStats', { clients: clients.stats.clients, matters: clients.stats.matters }) : null}
                    <small>{tr('directory.filtered', { count: rows.length })}</small>
                </span>
            </div>
            {rows.length === 0 ? (
                <div className="fm-state">
                    <Icon name="briefcase" />
                    <p>{mineOnly ? tr('lists.myMattersEmpty') : tr('tree.empty')}</p>
                    <small>{tr('tree.emptyHint')}</small>
                </div>
            ) : layout === 'tiles' ? (
                <div className="fm-matter-grid">
                    {rows.map((matter) => (
                        <article
                            key={matter.id}
                            className={matter.closed ? 'fm-matter-card is-closed' : 'fm-matter-card'}
                            tabIndex={0}
                            role="button"
                            onClick={() => onOpenMatter(matter.id)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onOpenMatter(matter.id);
                                }
                            }}
                        >
                            <div className="fm-matter-card__head">
                                <span className="fm-matter-card__ico" aria-hidden>
                                    <Icon name={matter.closed || matter.level === 'read' ? 'lock' : 'briefcase'} />
                                </span>
                                <button
                                    type="button"
                                    className={matter.favorite ? 'fm-star is-on' : 'fm-star'}
                                    aria-pressed={matter.favorite}
                                    aria-label={tr(matter.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void toggleFavorite(matter);
                                    }}
                                >
                                    <Icon name="star" />
                                </button>
                            </div>
                            <h3 className="fm-matter-card__title" title={matter.name}>{matter.name}</h3>
                            {matter.code ? <p className="fm-matter-card__code">{matter.code}</p> : null}
                            <p className="fm-matter-card__client" title={matter.clientName}>
                                <Icon name="building" />
                                <span>{matter.clientName}</span>
                            </p>
                            <div className="fm-matter-card__foot">
                                <span className={matter.closed ? 'fm-matter-card__status is-closed' : 'fm-matter-card__status'}>
                                    {matter.closed ? tr('common.closed') : tr('directory.open')}
                                </span>
                                <span aria-hidden>·</span>
                                <LevelBadge level={matter.level} />
                                <span className="fm-matter-card__docs">
                                    {matter.documents
                                        ? tr('directory.docsCount', { count: matter.documents })
                                        : tr('directory.noDocs')}
                                </span>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="fm-table-wrap">
                    <table className="fm-table fm-table--clickable">
                        <thead>
                            <tr>
                                <th className="fm-table__star" aria-label={tr('pane.favoriteAdd')} />
                                <th>{tr('common.matter')}</th>
                                {!clientId ? <th>{tr('common.client')}</th> : null}
                                <th>{tr('directory.access')}</th>
                                <th>{tr('directory.status')}</th>
                                <th className="fm-table__num">{tr('directory.documents')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((matter) => (
                                <tr key={matter.id} tabIndex={0} className={matter.closed ? 'is-closed' : undefined} onClick={() => onOpenMatter(matter.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter')
                                            onOpenMatter(matter.id);
                                    }}>
                                    <td className="fm-table__star">
                                        <button type="button" className={matter.favorite ? 'fm-star is-on' : 'fm-star'} aria-pressed={matter.favorite}
                                            aria-label={tr(matter.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void toggleFavorite(matter);
                                            }}>
                                            <Icon name="star" />
                                        </button>
                                    </td>
                                    <td>
                                        <span className="fm-table__name">
                                            <Icon name={matter.closed || matter.level === 'read' ? 'lock' : 'briefcase'} className="fm-ico--client" />
                                            <span>
                                                <strong>{matter.name}</strong>
                                                {matter.code ? <small>{matter.code}</small> : null}
                                            </span>
                                        </span>
                                    </td>
                                    {!clientId ? <td>{matter.clientName}</td> : null}
                                    <td><LevelBadge level={matter.level} /></td>
                                    <td>{matter.closed ? tr('common.closed') : tr('directory.open')}</td>
                                    <td className="fm-table__num">{matter.documents || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
