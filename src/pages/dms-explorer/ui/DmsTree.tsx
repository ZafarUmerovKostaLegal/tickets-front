import { useMemo, useState } from 'react';
import type { ClientsResponse, FolderRow } from '@pages/file-manager/api/filesApi';
import { Icon } from '@pages/file-manager/ui/fmShared';

export type TreeSelection =
    | { kind: 'root' }
    | { kind: 'client'; clientId: string }
    | { kind: 'matter'; clientId: string; matterId: string }
    | { kind: 'folder'; clientId: string; matterId: string; folderId: string };

type Props = {
    clients: ClientsResponse;
    folders: FolderRow[];
    selection: TreeSelection;
    onSelect: (selection: TreeSelection) => void;
    onNeedFolders: (matterId: string) => void;
};

export function DmsTree({ clients, folders, selection, onSelect, onNeedFolders }: Props) {
    const [query, setQuery] = useState('');
    const [openClients, setOpenClients] = useState<Record<string, boolean>>({});
    const [openMatters, setOpenMatters] = useState<Record<string, boolean>>({});

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return clients.clients;
        return clients.clients
            .map((client) => ({
                ...client,
                matters: client.matters.filter((matter) =>
                    `${client.name} ${matter.name} ${matter.code}`.toLowerCase().includes(q)),
            }))
            .filter((client) => client.matters.length > 0 || client.name.toLowerCase().includes(q));
    }, [clients.clients, query]);

    const foldersByParent = useMemo(() => {
        const map = new Map<string | null, FolderRow[]>();
        for (const folder of folders) {
            const key = folder.parentId;
            const list = map.get(key) ?? [];
            list.push(folder);
            map.set(key, list);
        }
        for (const list of map.values())
            list.sort((a, b) => a.name.localeCompare(b.name));
        return map;
    }, [folders]);

    const renderFolders = (clientId: string, matterId: string, parentId: string | null, depth: number) => {
        const rows = foldersByParent.get(parentId) ?? [];
        return rows.map((folder) => {
            const selected = selection.kind === 'folder' && selection.folderId === folder.id;
            const kids = foldersByParent.get(folder.id) ?? [];
            return (
                <li key={folder.id}>
                    <button
                        type="button"
                        className={selected ? 'dms-tree__item is-on' : 'dms-tree__item'}
                        style={{ paddingLeft: `${0.4 + depth * 0.75}rem` }}
                        onClick={() => onSelect({ kind: 'folder', clientId, matterId, folderId: folder.id })}
                    >
                        <span className="dms-tree__twist">{kids.length ? '▾' : '·'}</span>
                        <Icon name="folder" className="fm-ico--folder" />
                        <span>{folder.name}</span>
                    </button>
                    {kids.length ? <ul className="dms-tree__children">{renderFolders(clientId, matterId, folder.id, depth + 1)}</ul> : null}
                </li>
            );
        });
    };

    return (
        <aside className="dms-tree">
            <label className="dms-tree__search">
                <Icon name="search" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients…" />
            </label>
            <ul className="dms-tree__list">
                <li>
                    <button
                        type="button"
                        className={selection.kind === 'root' ? 'dms-tree__item is-on' : 'dms-tree__item'}
                        onClick={() => onSelect({ kind: 'root' })}
                    >
                        <Icon name="building" />
                        <span>Kosta Legal Clients</span>
                    </button>
                </li>
                {filtered.map((client) => {
                    const clientOpen = openClients[client.id] ?? Boolean(query);
                    const clientOn = selection.kind === 'client' && selection.clientId === client.id;
                    return (
                        <li key={client.id}>
                            <button
                                type="button"
                                className={clientOn ? 'dms-tree__item is-on' : 'dms-tree__item'}
                                onClick={() => {
                                    setOpenClients((prev) => ({ ...prev, [client.id]: !clientOpen }));
                                    onSelect({ kind: 'client', clientId: client.id });
                                }}
                            >
                                <span className="dms-tree__twist">{clientOpen ? '▾' : '▸'}</span>
                                <Icon name="building" />
                                <span>{client.name}</span>
                            </button>
                            {clientOpen ? (
                                <ul className="dms-tree__children">
                                    {client.matters.map((matter) => {
                                        const matterOpen = openMatters[matter.id] ?? false;
                                        const matterOn = (selection.kind === 'matter' || selection.kind === 'folder')
                                            && selection.matterId === matter.id;
                                        return (
                                            <li key={matter.id}>
                                                <button
                                                    type="button"
                                                    className={matterOn && selection.kind === 'matter' ? 'dms-tree__item is-on' : 'dms-tree__item'}
                                                    style={{ paddingLeft: '1.15rem' }}
                                                    onClick={() => {
                                                        setOpenMatters((prev) => ({ ...prev, [matter.id]: !matterOpen }));
                                                        onNeedFolders(matter.id);
                                                        onSelect({ kind: 'matter', clientId: client.id, matterId: matter.id });
                                                    }}
                                                >
                                                    <span className="dms-tree__twist">{matterOpen ? '▾' : '▸'}</span>
                                                    <Icon name="briefcase" />
                                                    <span>{matter.code ? `${matter.code} · ` : ''}{matter.name}</span>
                                                </button>
                                                {matterOpen ? (
                                                    <ul className="dms-tree__children">
                                                        {renderFolders(client.id, matter.id, null, 2)}
                                                    </ul>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}
