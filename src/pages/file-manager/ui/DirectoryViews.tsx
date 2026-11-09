import { useMemo, useState } from 'react';
import { filesApi, type AccessLevel, type ClientsResponse, type MatterRow } from '../api/filesApi';
import { matchesFilter } from '../lib/filesFormat';
import { Icon, LevelBadge, useAction, useFm } from './fmShared';

type ClientsProps = {
    clients: ClientsResponse;
    onOpenClient: (clientId: string) => void;
    onChanged: () => void;
};

type ClientStatus = 'active' | 'archived' | 'all';
type DocsFilter = 'any' | 'with' | 'without';

export function ClientsView({ clients, onOpenClient, onChanged }: ClientsProps) {
    const { tr } = useFm();
    const act = useAction();
    const [filter, setFilter] = useState('');
    const [status, setStatus] = useState<ClientStatus>('active');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [withOpen, setWithOpen] = useState(false);
    const [docs, setDocs] = useState<DocsFilter>('any');

    const rows = useMemo(() => {
        const archivedCount = clients.stats?.archivedClients
            ?? clients.clients.filter((client) => client.archived).length;
        const list = clients.clients
            .map((client) => ({
                client,
                open: client.matters.filter((matter) => !matter.closed).length,
                mine: client.matters.filter((matter) => matter.mine).length,
                documents: client.matters.reduce((sum, matter) => sum + matter.documents, 0),
            }))
            .filter(({ client, open, documents }) => {
                if (status === 'active' && client.archived)
                    return false;
                if (status === 'archived' && !client.archived)
                    return false;
                if (favoritesOnly && !client.favorite)
                    return false;
                if (withOpen && open === 0)
                    return false;
                if (docs === 'with' && documents === 0)
                    return false;
                if (docs === 'without' && documents > 0)
                    return false;
                return matchesFilter(filter, client.name, ...client.matters.map((m) => m.code));
            })
            .sort((a, b) => Number(b.client.favorite) - Number(a.client.favorite)
                || Number(a.client.archived) - Number(b.client.archived)
                || a.client.name.localeCompare(b.client.name));
        return { list, archivedCount };
    }, [clients, filter, status, favoritesOnly, withOpen, docs]);

    const dirty = Boolean(filter) || status !== 'active' || favoritesOnly || withOpen || docs !== 'any';
    const reset = () => {
        setFilter('');
        setStatus('active');
        setFavoritesOnly(false);
        setWithOpen(false);
        setDocs('any');
    };

    const toggleFavorite = async (clientId: string, favorite: boolean) => {
        const ok = await act(() => (favorite ? filesApi.removeFavorite('client', clientId) : filesApi.addFavorite('client', clientId)));
        if (ok)
            onChanged();
    };

    const stats = clients.stats;

    return (
        <section className="fm-docs fm-docs--padded">
            <div className="fm-filters">
                <div className="fm-filters__row fm-filters__row--main">
                    <label className="fm-search fm-search--wide">
                        <Icon name="search" />
                        <input autoFocus value={filter} placeholder={tr('directory.clientsSearch')} onChange={(event) => setFilter(event.target.value)} />
                    </label>
                    {dirty ? (
                        <button type="button" className="fm-filters__reset" onClick={reset}>{tr('directory.resetFilters')}</button>
                    ) : null}
                </div>
                <div className="fm-filters__row">
                    <div className="fm-filters__group">
                        <span>{tr('directory.status')}</span>
                        <div className="fm-seg" role="radiogroup" aria-label={tr('directory.status')}>
                            {([
                                ['active', 'directory.statusActive'],
                                ['archived', 'directory.statusArchived'],
                                ['all', 'directory.statusAll'],
                            ] as const).map(([id, key]) => (
                                <button key={id} type="button" role="radio" aria-checked={status === id}
                                    className={status === id ? 'is-on' : ''} onClick={() => setStatus(id)}>
                                    {tr(key)}{id === 'archived' && rows.archivedCount ? ` (${rows.archivedCount})` : ''}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="fm-filters__chips" role="group" aria-label={tr('directory.more')}>
                        <button type="button" className={favoritesOnly ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={favoritesOnly}
                            onClick={() => setFavoritesOnly((value) => !value)}>
                            <Icon name="star" />{tr('directory.favoritesOnly')}
                        </button>
                        <button type="button" className={withOpen ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={withOpen}
                            onClick={() => setWithOpen((value) => !value)}>
                            {tr('directory.withOpenMatters')}
                        </button>
                        <button type="button" className={docs === 'with' ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={docs === 'with'}
                            onClick={() => setDocs((value) => (value === 'with' ? 'any' : 'with'))}>
                            {tr('directory.withDocs')}
                        </button>
                        <button type="button" className={docs === 'without' ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={docs === 'without'}
                            onClick={() => setDocs((value) => (value === 'without' ? 'any' : 'without'))}>
                            {tr('directory.withoutDocs')}
                        </button>
                    </div>
                    <div className="fm-filters__stats">
                        {stats ? <span>{tr('directory.directoryStats', { clients: stats.clients, matters: stats.matters })}</span> : null}
                        <small>{tr('directory.filtered', { count: rows.list.length })}</small>
                    </div>
                </div>
            </div>
            {rows.list.length === 0 ? (
                <div className="fm-state">
                    <Icon name="building" />
                    <p>{tr('tree.empty')}</p>
                    <small>{tr('tree.emptyHint')}</small>
                </div>
            ) : (
                <div className="fm-table-wrap">
                    <table className="fm-table fm-table--clickable">
                        <thead>
                            <tr>
                                <th className="fm-table__star" aria-label={tr('pane.favoriteAdd')} />
                                <th>{tr('common.client')}</th>
                                <th className="fm-table__num">{tr('directory.matters')}</th>
                                <th className="fm-table__num">{tr('directory.openMatters')}</th>
                                <th className="fm-table__num">{tr('directory.mine')}</th>
                                <th className="fm-table__num">{tr('directory.documents')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.list.map(({ client, open, mine, documents }) => (
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
                                    <td className="fm-table__num">{client.matters.length}</td>
                                    <td className="fm-table__num">{open}</td>
                                    <td className="fm-table__num">{mine || '—'}</td>
                                    <td className="fm-table__num">{documents || '—'}</td>
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

export function MattersListView({ clients, clientId, mineOnly, onPickClient, onOpenMatter, onOpenClients, onChanged }: MattersProps) {
    const { tr } = useFm();
    const act = useAction();
    const [filter, setFilter] = useState('');
    const [status, setStatus] = useState<MatterStatus>('open');
    const [access, setAccess] = useState<AccessFilter>('all');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [mineFilter, setMineFilter] = useState(false);
    const [provisionedOnly, setProvisionedOnly] = useState(false);
    const [docs, setDocs] = useState<DocsFilter>('any');
    const [clientQuery, setClientQuery] = useState('');
    const client = clientId ? clients.clients.find((row) => row.id === clientId) ?? null : null;

    const clientOptions = useMemo(() => {
        const q = clientQuery.trim();
        return clients.clients
            .filter((row) => !q || matchesFilter(q, row.name) || row.id === clientId)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [clients.clients, clientQuery, clientId]);

    const closedCount = clients.stats?.closedMatters
        ?? clients.clients.reduce((sum, row) => sum + row.matters.filter((matter) => matter.closed).length, 0);

    const rows = useMemo<MatterListRow[]>(() => clients.clients
        .filter((row) => !clientId || row.id === clientId)
        .flatMap((row) => row.matters.map((matter) => ({ ...matter, clientName: row.name })))
        .filter((matter) => {
            if (mineOnly || mineFilter) {
                if (!matter.mine)
                    return false;
            }
            if (status === 'open' && matter.closed)
                return false;
            if (status === 'closed' && !matter.closed)
                return false;
            if (access !== 'all' && matter.level !== access)
                return false;
            if (favoritesOnly && !matter.favorite)
                return false;
            if (provisionedOnly && !matter.provisioned)
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
        clients, clientId, mineOnly, mineFilter, status, access, favoritesOnly, provisionedOnly, docs, filter,
    ]);

    const dirty = Boolean(filter) || Boolean(clientId) || status !== 'open' || access !== 'all'
        || favoritesOnly || (!mineOnly && mineFilter) || provisionedOnly || docs !== 'any' || Boolean(clientQuery);

    const reset = () => {
        setFilter('');
        setStatus('open');
        setAccess('all');
        setFavoritesOnly(false);
        setMineFilter(false);
        setProvisionedOnly(false);
        setDocs('any');
        setClientQuery('');
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
            <div className="fm-filters">
                <div className="fm-filters__row fm-filters__row--main">
                    <label className="fm-search fm-search--wide">
                        <Icon name="search" />
                        <input autoFocus value={filter} placeholder={tr('directory.mattersSearch')} onChange={(event) => setFilter(event.target.value)} />
                    </label>
                    <div className="fm-filters__field">
                        <span>{tr('directory.clientFilter')}</span>
                        <div className="fm-filters__client">
                            <input value={clientQuery} placeholder={tr('directory.filterClient')}
                                aria-label={tr('directory.clientFilter')}
                                onChange={(event) => setClientQuery(event.target.value)} />
                            <select value={clientId ?? ''} onChange={(event) => onPickClient(event.target.value || null)}>
                                <option value="">{tr('search.anyClient')}</option>
                                {clientOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                            </select>
                        </div>
                    </div>
                    {dirty ? (
                        <button type="button" className="fm-filters__reset" onClick={reset}>{tr('directory.resetFilters')}</button>
                    ) : null}
                </div>
                <div className="fm-filters__row">
                    <div className="fm-filters__group">
                        <span>{tr('directory.status')}</span>
                        <div className="fm-seg" role="radiogroup" aria-label={tr('directory.status')}>
                            {([
                                ['open', 'directory.statusOpen', null as number | null],
                                ['closed', 'directory.statusClosed', closedCount],
                                ['all', 'directory.statusAll', null],
                            ] as const).map(([id, key, count]) => (
                                <button key={id} type="button" role="radio" aria-checked={status === id}
                                    className={status === id ? 'is-on' : ''} onClick={() => setStatus(id)}>
                                    {tr(key)}{count ? ` (${count})` : ''}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="fm-filters__group">
                        <span>{tr('directory.access')}</span>
                        <div className="fm-seg" role="radiogroup" aria-label={tr('directory.access')}>
                            {([
                                ['all', 'directory.accessAll'],
                                ['manage', 'levels.manage'],
                                ['edit', 'levels.edit'],
                                ['read', 'levels.read'],
                            ] as const).map(([id, key]) => (
                                <button key={id} type="button" role="radio" aria-checked={access === id}
                                    className={access === id ? 'is-on' : ''} onClick={() => setAccess(id)}>
                                    {tr(key)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="fm-filters__row">
                    <div className="fm-filters__chips" role="group" aria-label={tr('directory.more')}>
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
                        <button type="button" className={docs === 'with' ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={docs === 'with'}
                            onClick={() => setDocs((value) => (value === 'with' ? 'any' : 'with'))}>
                            {tr('directory.withDocs')}
                        </button>
                        <button type="button" className={docs === 'without' ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={docs === 'without'}
                            onClick={() => setDocs((value) => (value === 'without' ? 'any' : 'without'))}>
                            {tr('directory.withoutDocs')}
                        </button>
                        <button type="button" className={provisionedOnly ? 'fm-chip is-on' : 'fm-chip'} aria-pressed={provisionedOnly}
                            onClick={() => setProvisionedOnly((value) => !value)}>
                            {tr('directory.provisioned')}
                        </button>
                    </div>
                    <div className="fm-filters__stats">
                        {clients.stats ? (
                            <span>{tr('directory.directoryStats', { clients: clients.stats.clients, matters: clients.stats.matters })}</span>
                        ) : null}
                        <small>{tr('directory.filtered', { count: rows.length })}</small>
                    </div>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="fm-state">
                    <Icon name="briefcase" />
                    <p>{mineOnly ? tr('lists.myMattersEmpty') : tr('tree.empty')}</p>
                    <small>{tr('tree.emptyHint')}</small>
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
