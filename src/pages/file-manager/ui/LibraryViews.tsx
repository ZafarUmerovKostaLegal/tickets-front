import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { filesApi, type ClientsResponse, type DocumentRow, type FileKind, type TrashItem } from '../api/filesApi';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { DocumentTable } from './DocumentTable';
import { DocumentPane } from './DocumentPane';
import { FmSelect } from './fmSelect';
import { ConfirmModal, FileBadge, Icon, LevelBadge, StateBlock, useAction, useFm, useLoad, type Loadable } from './fmShared';
import type { Location } from './MatterWorkspace';
import { ViewToggle, readLayout, writeLayout, type DirectoryLayout } from './DirectoryViews';

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

const KINDS: FileKind[] = ['pdf', 'doc', 'sheet', 'slides', 'email', 'image', 'archive', 'text', 'file'];

export function SearchView({ clients, ...props }: ListProps & { clients: ClientsResponse }) {
    const { tr } = useFm();
    const [form, setForm] = useState({ q: '', clientId: '', matterId: '', kind: '' });
    const [query, setQuery] = useState(form);
    const [submitted, setSubmitted] = useState(false);
    const load = useLoad(submitted ? () => filesApi.search(query) : null, [submitted, query]);
    const matters = clients.clients
        .filter((client) => !form.clientId || client.id === form.clientId)
        .flatMap((client) => client.matters);
    const clientOptions = useMemo(() => [
        { value: '', label: tr('search.anyClient') },
        ...clients.clients.map((client) => ({ value: client.id, label: client.name })),
    ], [clients.clients, tr]);
    const matterOptions = useMemo(() => [
        { value: '', label: tr('search.anyMatter') },
        ...matters.map((matter) => ({
            value: matter.id,
            label: `${matter.code ? `${matter.code} · ` : ''}${matter.name}`,
        })),
    ], [matters, tr]);
    const kindOptions = useMemo(() => [
        { value: '', label: tr('kinds.all') },
        ...KINDS.map((kind) => ({ value: kind, label: tr(`kinds.${kind}`) })),
    ], [tr]);
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
            <FmSelect
                value={form.clientId}
                options={clientOptions}
                placeholder={tr('common.client')}
                onChange={(clientId) => setForm({ ...form, clientId, matterId: '' })}
            />
            <FmSelect
                value={form.matterId}
                options={matterOptions}
                placeholder={tr('common.matter')}
                onChange={(matterId) => setForm({ ...form, matterId })}
            />
            <FmSelect
                value={form.kind}
                options={kindOptions}
                placeholder={tr('kinds.all')}
                onChange={(kind) => setForm({ ...form, kind })}
            />
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

const FAVORITES_LAYOUT_KEY = 'fm.favoritesLayout';

export function FavoritesView({ viewerId, onLocate }: ListProps) {
    const { tr } = useFm();
    const act = useAction();
    const load = useLoad(() => filesApi.favorites(), []);
    const [selected, setSelected] = useState<string | null>(null);
    const [layout, setLayout] = useState<DirectoryLayout>(() => readLayout(FAVORITES_LAYOUT_KEY, 'tiles'));
    const data = load.data;
    const empty = data && data.matters.length + data.folders.length + data.documents.length === 0;
    const unstar = async (kind: 'matter' | 'folder' | 'document', id: string) => {
        const ok = await act(() => filesApi.removeFavorite(kind, id));
        if (ok)
            load.reload();
    };
    const changeLayout = (next: DirectoryLayout) => {
        setLayout(next);
        writeLayout(FAVORITES_LAYOUT_KEY, next);
    };
    const openMatter = (id: string) => onLocate({ matterId: id, folderId: null, docId: null });
    const openFolder = (folder: { id: string; matterId: string }) => onLocate({ matterId: folder.matterId, folderId: folder.id, docId: null });
    const starButton = (kind: 'matter' | 'folder', id: string, className = 'fm-icon-btn fm-star is-on') => (
        <button type="button" className={className} aria-label={tr('pane.favoriteRemove')}
            onClick={(event) => {
                event.stopPropagation();
                void unstar(kind, id);
            }}><Icon name="star" /></button>
    );
    const rowKeys = (open: () => void) => (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter')
            open();
    };
    return (
        <div className="fm-split">
            <section className="fm-docs fm-docs--padded">
                {data && !empty ? (
                    <div className="fm-fav__bar">
                        <ViewToggle layout={layout} onChange={changeLayout} />
                    </div>
                ) : null}
                <StateBlock loading={load.loading && !data} error={load.error} onRetry={load.reload}
                    empty={empty ? <><Icon name="star" /><p>{tr('lists.favoritesEmpty')}</p></> : undefined}>
                    {data ? (
                        <>
                            {data.matters.length ? (
                                <>
                                    <h3 className="fm-section-title">{tr('lists.favoritesMatters')}</h3>
                                    {layout === 'tiles' ? (
                                        <div className="fm-cards">
                                            {data.matters.map((matter) => (
                                                <div key={matter.id} className="fm-card" role="button" tabIndex={0}
                                                    onClick={() => openMatter(matter.id)} onKeyDown={rowKeys(() => openMatter(matter.id))}>
                                                    <Icon name="briefcase" />
                                                    <div>
                                                        <small>{matter.clientName}</small>
                                                        <strong>{matter.code ? `${matter.code} · ` : ''}{matter.name}</strong>
                                                        <LevelBadge level={matter.level} />
                                                    </div>
                                                    {starButton('matter', matter.id)}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="fm-table-wrap">
                                            <table className="fm-table fm-table--clickable">
                                                <thead>
                                                    <tr>
                                                        <th className="fm-table__star" aria-label={tr('pane.favoriteRemove')} />
                                                        <th>{tr('common.matter')}</th>
                                                        <th>{tr('common.client')}</th>
                                                        <th>{tr('directory.access')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.matters.map((matter) => (
                                                        <tr key={matter.id} tabIndex={0} onClick={() => openMatter(matter.id)} onKeyDown={rowKeys(() => openMatter(matter.id))}>
                                                            <td className="fm-table__star">{starButton('matter', matter.id, 'fm-star is-on')}</td>
                                                            <td>
                                                                <span className="fm-table__name">
                                                                    <span className="fm-table__ico" aria-hidden><Icon name="briefcase" className="fm-ico--client" /></span>
                                                                    <span>
                                                                        <strong>{matter.name}</strong>
                                                                        {matter.code ? <small>{matter.code}</small> : null}
                                                                    </span>
                                                                </span>
                                                            </td>
                                                            <td>{matter.clientName}</td>
                                                            <td><LevelBadge level={matter.level} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            ) : null}
                            {data.folders.length ? (
                                <>
                                    <h3 className="fm-section-title">{tr('lists.favoritesFolders')}</h3>
                                    {layout === 'tiles' ? (
                                        <div className="fm-cards">
                                            {data.folders.map((folder) => (
                                                <div key={folder.id} className="fm-card" role="button" tabIndex={0}
                                                    onClick={() => openFolder(folder)} onKeyDown={rowKeys(() => openFolder(folder))}>
                                                    <Icon name="folder" className="fm-ico--folder" />
                                                    <div>
                                                        <small>{folder.matterName}</small>
                                                        <strong>{folder.name}</strong>
                                                    </div>
                                                    {starButton('folder', folder.id)}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="fm-table-wrap">
                                            <table className="fm-table fm-table--clickable">
                                                <thead>
                                                    <tr>
                                                        <th className="fm-table__star" aria-label={tr('pane.favoriteRemove')} />
                                                        <th>{tr('table.name')}</th>
                                                        <th>{tr('common.matter')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.folders.map((folder) => (
                                                        <tr key={folder.id} tabIndex={0} onClick={() => openFolder(folder)} onKeyDown={rowKeys(() => openFolder(folder))}>
                                                            <td className="fm-table__star">{starButton('folder', folder.id, 'fm-star is-on')}</td>
                                                            <td>
                                                                <span className="fm-table__name">
                                                                    <span className="fm-table__ico" aria-hidden><Icon name="folder" className="fm-ico--folder" /></span>
                                                                    <strong>{folder.name}</strong>
                                                                </span>
                                                            </td>
                                                            <td>{folder.matterName}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
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

export function TrashView({ onChanged, superAdmin = false }: { onChanged: () => void; superAdmin?: boolean }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const [archived, setArchived] = useState(false);
    const load = useLoad(() => filesApi.trash(archived), [archived]);
    const [purge, setPurge] = useState<TrashItem | null>(null);
    const items = load.data?.items ?? [];

    return (
        <section className="fm-docs fm-docs--padded">
            {superAdmin ? (
                <div className="fm-trash__modes" role="tablist">
                    <button type="button" role="tab" aria-selected={!archived} className={`fm-trash__mode${archived ? '' : ' is-on'}`} onClick={() => setArchived(false)}>{tr('trash.modeTrash')}</button>
                    <button type="button" role="tab" aria-selected={archived} className={`fm-trash__mode${archived ? ' is-on' : ''}`} onClick={() => setArchived(true)}>{tr('trash.modeArchive')}</button>
                </div>
            ) : null}
            <p className="fm-hint">{tr(archived ? 'trash.archiveHint' : 'trash.hint')}</p>
            <StateBlock loading={load.loading && !load.data} error={load.error} onRetry={load.reload}
                empty={!load.loading && items.length === 0 ? <><Icon name="trash" /><p>{tr(archived ? 'trash.archiveEmpty' : 'trash.empty')}</p></> : undefined}>
                <div className="fm-table-wrap">
                    <table className="fm-table fm-table--trash">
                        <thead>
                            <tr>
                                <th>{tr('table.name')}</th>
                                <th>{tr('trash.source')}</th>
                                <th>{tr('common.clientMatter')}</th>
                                <th>{tr('trash.deleted')}</th>
                                <th>{tr('trash.deletedBy')}</th>
                                <th className="fm-table__actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={`matter:${item.kind}:${item.id}`}>
                                    <td>
                                        <span className="fm-table__name">
                                            <span className="fm-table__ico" aria-hidden>
                                                {item.kind === 'folder'
                                                    ? <Icon name="folder" className="fm-ico--folder" />
                                                    : <FileBadge kind={item.fileKind ?? 'file'} />}
                                            </span>
                                            <span>
                                                <strong>{item.name}</strong>
                                                <small>{item.kind === 'folder' ? tr('trash.folderDocs', { count: item.documents ?? 0 }) : formatBytes(item.sizeBytes ?? 0, locale)}</small>
                                            </span>
                                        </span>
                                    </td>
                                    <td>{tr('trash.sourceMatter')}</td>
                                    <td>
                                        <span className="fm-table__matter">
                                            <small>{item.clientName}</small>
                                            <span>{item.matterName}</span>
                                        </span>
                                    </td>
                                    <td className="fm-nowrap">{formatDateTime(item.deletedAt, locale)}</td>
                                    <td>{item.deletedBy}</td>
                                    <td className="fm-table__actions">
                                        <span className="fm-table__actions-row">
                                            <button type="button" className="fm-btn" onClick={async () => {
                                                const ok = await act(() => filesApi.restoreTrash(item.kind, item.id), tr('pane.saved'));
                                                if (ok) {
                                                    load.reload();
                                                    onChanged();
                                                }
                                            }}><Icon name="restore" />{tr('trash.restore')}</button>
                                            {item.canPurge && !archived ? (
                                                <button type="button" className="fm-btn fm-btn--danger" onClick={() => setPurge(item)}>
                                                    {tr('trash.purge')}
                                                </button>
                                            ) : null}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </StateBlock>
            {purge ? (
                <ConfirmModal
                    title={tr('trash.purge')}
                    text={tr('trash.purgeConfirm', { name: purge.name })}
                    confirmLabel={tr('trash.purge')}
                    danger
                    onClose={() => setPurge(null)}
                    onConfirm={async () => {
                        const ok = await act(() => filesApi.purgeTrash(purge.kind, purge.id));
                        if (ok)
                            load.reload();
                    }}
                />
            ) : null}
        </section>
    );
}
