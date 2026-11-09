import { useMemo, useState } from 'react';
import { filesApi, type ClientsResponse, type MatterRow } from '../api/filesApi';
import { matchesFilter } from '../lib/filesFormat';
import { Icon, LevelBadge, useAction, useFm } from './fmShared';

type ClientsProps = {
    clients: ClientsResponse;
    onOpenClient: (clientId: string) => void;
    onChanged: () => void;
};

export function ClientsView({ clients, onOpenClient, onChanged }: ClientsProps) {
    const { tr } = useFm();
    const act = useAction();
    const [filter, setFilter] = useState('');
    const [showArchived, setShowArchived] = useState(false);

    const rows = useMemo(() => clients.clients
        .filter((client) => (showArchived || !client.archived) && matchesFilter(filter, client.name, ...client.matters.map((m) => m.code)))
        .map((client) => ({
            client,
            open: client.matters.filter((matter) => !matter.closed).length,
            mine: client.matters.filter((matter) => matter.mine).length,
            documents: client.matters.reduce((sum, matter) => sum + matter.documents, 0),
        }))
        .sort((a, b) => Number(b.client.favorite) - Number(a.client.favorite) || a.client.name.localeCompare(b.client.name)), [clients, filter, showArchived]);

    const toggleFavorite = async (clientId: string, favorite: boolean) => {
        const ok = await act(() => (favorite ? filesApi.removeFavorite('client', clientId) : filesApi.addFavorite('client', clientId)));
        if (ok)
            onChanged();
    };

    return (
        <section className="fm-docs fm-docs--padded">
            <div className="fm-toolbar">
                <label className="fm-search fm-search--wide">
                    <Icon name="search" />
                    <input autoFocus value={filter} placeholder={tr('directory.clientsSearch')} onChange={(event) => setFilter(event.target.value)} />
                </label>
                <label className="fm-check">
                    <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                    <span>{tr('directory.showArchived')}</span>
                </label>
                <span className="fm-muted">{tr('directory.total', { count: rows.length })}</span>
            </div>
            {rows.length === 0 ? (
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
                            {rows.map(({ client, open, mine, documents }) => (
                                <tr key={client.id} tabIndex={0} onClick={() => onOpenClient(client.id)}
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
                                            {client.archived ? <span className="fm-level fm-level--none">{tr('common.closed')}</span> : null}
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

export function MattersListView({ clients, clientId, mineOnly, onPickClient, onOpenMatter, onOpenClients, onChanged }: MattersProps) {
    const { tr } = useFm();
    const act = useAction();
    const [filter, setFilter] = useState('');
    const [showClosed, setShowClosed] = useState(false);
    const client = clientId ? clients.clients.find((row) => row.id === clientId) ?? null : null;

    const rows = useMemo<MatterListRow[]>(() => clients.clients
        .filter((row) => !clientId || row.id === clientId)
        .flatMap((row) => row.matters.map((matter) => ({ ...matter, clientName: row.name })))
        .filter((matter) => (!mineOnly || matter.mine)
            && (showClosed || !matter.closed)
            && matchesFilter(filter, matter.name, matter.code, matter.clientName))
        .sort((a, b) => Number(b.favorite) - Number(a.favorite)
            || Number(a.closed) - Number(b.closed)
            || a.clientName.localeCompare(b.clientName)
            || a.name.localeCompare(b.name)), [clients, clientId, mineOnly, showClosed, filter]);

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
            <div className="fm-toolbar">
                <label className="fm-search fm-search--wide">
                    <Icon name="search" />
                    <input autoFocus value={filter} placeholder={tr('directory.mattersSearch')} onChange={(event) => setFilter(event.target.value)} />
                </label>
                <select value={clientId ?? ''} onChange={(event) => onPickClient(event.target.value || null)}>
                    <option value="">{tr('search.anyClient')}</option>
                    {clients.clients.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <label className="fm-check">
                    <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
                    <span>{tr('tree.showClosed')}</span>
                </label>
                <span className="fm-muted">{tr('directory.total', { count: rows.length })}</span>
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
