import { useState, type ReactNode } from 'react';
import { filesApi, type ClientsResponse, type DocumentRow, type FileKind } from '../api/filesApi';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { DocumentTable } from './DocumentTable';
import { DocumentPane } from './DocumentPane';
import { ConfirmModal, FileBadge, Icon, LevelBadge, StateBlock, useAction, useFm, useLoad, type Loadable } from './fmShared';
import type { Location } from './MatterWorkspace';

type ListProps = {
    viewerId: number;
    onLocate: (location: Location) => void;
};

function locate(doc: DocumentRow): Location {
    return { matterId: doc.matterId, folderId: doc.folderId, docId: doc.id };
}

function DocumentsWithPane<T extends { documents: DocumentRow[] }>({ load, viewerId, onLocate, empty, toolbar }: ListProps & {
    load: Loadable<T>;
    empty: ReactNode;
    toolbar?: ReactNode;
}) {
    const act = useAction();
    const [selected, setSelected] = useState<string | null>(null);
    const documents = load.data?.documents ?? [];
    const patch = (doc: DocumentRow) => load.setData((prev) => (prev
        ? { ...prev, documents: prev.documents.map((row) => (row.id === doc.id ? { ...row, ...doc } : row)) }
        : prev));
    const toggleFavorite = async (doc: DocumentRow) => {
        const ok = await act(() => (doc.favorite ? filesApi.removeFavorite('document', doc.id) : filesApi.addFavorite('document', doc.id, doc.matterId)));
        if (ok)
            patch({ ...doc, favorite: !doc.favorite });
    };
    return (
        <div className="fm-split">
            <section className="fm-docs">
                {toolbar}
                <StateBlock loading={load.loading && !load.data} error={load.error} onRetry={load.reload}>
                    <DocumentTable documents={documents} selectedId={selected} viewerId={viewerId} showMatter empty={empty}
                        onSelect={(doc) => setSelected(doc.id)} onOpen={(doc) => onLocate(locate(doc))} onToggleFavorite={toggleFavorite} />
                </StateBlock>
            </section>
            {selected ? (
                <DocumentPane documentId={selected} viewerId={viewerId}
                    onChanged={patch}
                    onDeleted={() => {
                        setSelected(null);
                        load.reload();
                    }}
                    onClose={() => setSelected(null)}
                    onLocate={(doc) => onLocate(locate(doc))} />
            ) : null}
        </div>
    );
}

export function RecentView(props: ListProps) {
    const { tr } = useFm();
    const load = useLoad(() => filesApi.recent(), []);
    return <DocumentsWithPane {...props} load={load} empty={tr('lists.recentEmpty')} />;
}

export function CheckedOutView({ canManage, ...props }: ListProps & { canManage: boolean }) {
    const { tr } = useFm();
    const [scope, setScope] = useState<'mine' | 'all'>('mine');
    const load = useLoad(() => filesApi.checkedOut(scope), [scope]);
    const toolbar = canManage ? (
        <div className="fm-toolbar">
            <div className="fm-seg" role="radiogroup">
                {(['mine', 'all'] as const).map((id) => (
                    <button key={id} type="button" role="radio" aria-checked={scope === id} className={scope === id ? 'is-on' : ''} onClick={() => setScope(id)}>
                        {tr(id === 'mine' ? 'lists.checkedOutMine' : 'lists.checkedOutAll')}
                    </button>
                ))}
            </div>
        </div>
    ) : null;
    return <DocumentsWithPane {...props} load={load} toolbar={toolbar} empty={tr('lists.checkedOutEmpty')} />;
}

const KINDS: FileKind[] = ['pdf', 'doc', 'sheet', 'slides', 'email', 'image', 'archive', 'text', 'file'];

export function SearchView({ clients, ...props }: ListProps & { clients: ClientsResponse }) {
    const { tr } = useFm();
    const [form, setForm] = useState({ q: '', clientId: '', matterId: '', kind: '', checkedOut: false });
    const [query, setQuery] = useState(form);
    const [submitted, setSubmitted] = useState(false);
    const load = useLoad(submitted ? () => filesApi.search(query) : null, [submitted, query]);
    const matters = clients.clients
        .filter((client) => !form.clientId || client.id === form.clientId)
        .flatMap((client) => client.matters);
    const submit = () => {
        setQuery({ ...form });
        setSubmitted(true);
    };
    const toolbar = (
        <form className="fm-toolbar fm-toolbar--search" onSubmit={(event) => {
            event.preventDefault();
            submit();
        }}>
            <label className="fm-search fm-search--wide">
                <Icon name="search" />
                <input autoFocus value={form.q} placeholder={tr('search.placeholder')} onChange={(event) => setForm({ ...form, q: event.target.value })} />
            </label>
            <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value, matterId: '' })}>
                <option value="">{tr('search.anyClient')}</option>
                {clients.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            <select value={form.matterId} onChange={(event) => setForm({ ...form, matterId: event.target.value })}>
                <option value="">{tr('search.anyMatter')}</option>
                {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.code ? `${matter.code} · ` : ''}{matter.name}</option>)}
            </select>
            <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                <option value="">{tr('kinds.all')}</option>
                {KINDS.map((kind) => <option key={kind} value={kind}>{tr(`kinds.${kind}`)}</option>)}
            </select>
            <label className="fm-check">
                <input type="checkbox" checked={form.checkedOut} onChange={(event) => setForm({ ...form, checkedOut: event.target.checked })} />
                <span>{tr('search.onlyCheckedOut')}</span>
            </label>
            <button type="submit" className="fm-btn fm-btn--primary">{tr('search.submit')}</button>
            {load.data ? <span className="fm-muted">{tr('search.found', { count: load.data.total })}</span> : null}
        </form>
    );
    if (!submitted) {
        return (
            <div className="fm-split">
                <section className="fm-docs">
                    {toolbar}
                    <div className="fm-empty"><Icon name="search" /><p>{tr('search.hint')}</p></div>
                </section>
            </div>
        );
    }
    return <DocumentsWithPane {...props} load={load} toolbar={toolbar} empty={tr('table.noResults')} />;
}

export function FavoritesView({ viewerId, onLocate }: ListProps) {
    const { tr } = useFm();
    const act = useAction();
    const load = useLoad(() => filesApi.favorites(), []);
    const [selected, setSelected] = useState<string | null>(null);
    const data = load.data;
    const empty = data && data.matters.length + data.folders.length + data.documents.length === 0;
    const unstar = async (kind: 'matter' | 'folder' | 'document', id: string) => {
        const ok = await act(() => filesApi.removeFavorite(kind, id));
        if (ok)
            load.reload();
    };
    return (
        <div className="fm-split">
            <section className="fm-docs fm-docs--padded">
                <StateBlock loading={load.loading && !data} error={load.error} onRetry={load.reload}
                    empty={empty ? <><Icon name="star" /><p>{tr('lists.favoritesEmpty')}</p></> : undefined}>
                    {data ? (
                        <>
                            {data.matters.length ? (
                                <>
                                    <h3 className="fm-section-title">{tr('lists.favoritesMatters')}</h3>
                                    <div className="fm-cards">
                                        {data.matters.map((matter) => (
                                            <div key={matter.id} className="fm-card" role="button" tabIndex={0}
                                                onClick={() => onLocate({ matterId: matter.id, folderId: null, docId: null })}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter')
                                                        onLocate({ matterId: matter.id, folderId: null, docId: null });
                                                }}>
                                                <Icon name="briefcase" />
                                                <div>
                                                    <small>{matter.clientName}</small>
                                                    <strong>{matter.code ? `${matter.code} · ` : ''}{matter.name}</strong>
                                                    <LevelBadge level={matter.level} />
                                                </div>
                                                <button type="button" className="fm-icon-btn fm-star is-on" aria-label={tr('pane.favoriteRemove')}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void unstar('matter', matter.id);
                                                    }}><Icon name="star" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : null}
                            {data.folders.length ? (
                                <>
                                    <h3 className="fm-section-title">{tr('lists.favoritesFolders')}</h3>
                                    <div className="fm-cards">
                                        {data.folders.map((folder) => (
                                            <div key={folder.id} className="fm-card" role="button" tabIndex={0}
                                                onClick={() => onLocate({ matterId: folder.matterId, folderId: folder.id, docId: null })}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter')
                                                        onLocate({ matterId: folder.matterId, folderId: folder.id, docId: null });
                                                }}>
                                                <Icon name="folder" className="fm-ico--folder" />
                                                <div>
                                                    <small>{folder.matterName}</small>
                                                    <strong>{folder.name}</strong>
                                                </div>
                                                <button type="button" className="fm-icon-btn fm-star is-on" aria-label={tr('pane.favoriteRemove')}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void unstar('folder', folder.id);
                                                    }}><Icon name="star" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : null}
                            {data.documents.length ? (
                                <>
                                    <h3 className="fm-section-title">{tr('lists.favoritesDocuments')}</h3>
                                    <DocumentTable documents={data.documents} selectedId={selected} viewerId={viewerId} showMatter
                                        onSelect={(doc) => setSelected(doc.id)} onOpen={(doc) => onLocate(locate(doc))}
                                        onToggleFavorite={(doc) => void unstar('document', doc.id)} />
                                </>
                            ) : null}
                        </>
                    ) : null}
                </StateBlock>
            </section>
            {selected ? (
                <DocumentPane documentId={selected} viewerId={viewerId} onChanged={() => load.reload()}
                    onDeleted={() => {
                        setSelected(null);
                        load.reload();
                    }}
                    onClose={() => setSelected(null)} onLocate={(doc) => onLocate(locate(doc))} />
            ) : null}
        </div>
    );
}

export function TrashView({ onChanged }: { onChanged: () => void }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const load = useLoad(() => filesApi.trash(), []);
    const [purge, setPurge] = useState<{ kind: string; id: string; name: string } | null>(null);
    const items = load.data?.items ?? [];
    return (
        <section className="fm-docs fm-docs--padded">
            <p className="fm-hint">{tr('trash.hint')}</p>
            <StateBlock loading={load.loading && !load.data} error={load.error} onRetry={load.reload}
                empty={load.data && items.length === 0 ? <><Icon name="trash" /><p>{tr('trash.empty')}</p></> : undefined}>
                <div className="fm-table-wrap">
                    <table className="fm-table">
                        <thead>
                            <tr>
                                <th>{tr('table.name')}</th>
                                <th>{tr('common.clientMatter')}</th>
                                <th>{tr('trash.deleted')}</th>
                                <th>{tr('trash.deletedBy')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={`${item.kind}:${item.id}`}>
                                    <td>
                                        <span className="fm-table__name">
                                            {item.kind === 'folder' ? <Icon name="folder" className="fm-ico--folder" /> : <FileBadge kind={item.fileKind ?? 'file'} />}
                                            <span>
                                                <strong>{item.name}</strong>
                                                <small>{item.kind === 'folder' ? tr('trash.folderDocs', { count: item.documents ?? 0 }) : formatBytes(item.sizeBytes ?? 0, locale)}</small>
                                            </span>
                                        </span>
                                    </td>
                                    <td>
                                        <span className="fm-table__matter"><small>{item.clientName}</small><span>{item.matterName}</span></span>
                                    </td>
                                    <td>{formatDateTime(item.deletedAt, locale)}</td>
                                    <td>{item.deletedBy}</td>
                                    <td className="fm-table__actions">
                                        <button type="button" className="fm-btn" onClick={async () => {
                                            const ok = await act(() => filesApi.restoreTrash(item.kind, item.id), tr('pane.saved'));
                                            if (ok) {
                                                load.reload();
                                                onChanged();
                                            }
                                        }}><Icon name="restore" />{tr('trash.restore')}</button>
                                        {item.canPurge ? (
                                            <button type="button" className="fm-btn fm-btn--danger" onClick={() => setPurge({ kind: item.kind, id: item.id, name: item.name })}>
                                                {tr('trash.purge')}
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </StateBlock>
            {purge ? (
                <ConfirmModal title={tr('trash.purge')} text={tr('trash.purgeConfirm', { name: purge.name })} confirmLabel={tr('trash.purge')} danger
                    onClose={() => setPurge(null)}
                    onConfirm={async () => {
                        const ok = await act(() => filesApi.purgeTrash(purge.kind, purge.id));
                        if (ok)
                            load.reload();
                    }} />
            ) : null}
        </section>
    );
}
