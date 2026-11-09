import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { filesApi, type ClientsResponse, type DocumentRow, type FolderRow, type MatterRow } from '../api/filesApi';
import { buildFolderTree, canEdit, canManage, folderAncestors, folderSubtreeCount, matchesFilter, type FolderNode } from '../lib/filesFormat';
import { DOC_DRAG_TYPE, DocumentTable } from './DocumentTable';
import { DocumentPane } from './DocumentPane';
import { ConfirmModal, Icon, LevelBadge, Modal, StateBlock, useAction, useFm, useLoad, useNotify } from './fmShared';

export type Location = { matterId: string | null; folderId: string | null; docId: string | null };

type Props = {
    clients: ClientsResponse;
    location: Location;
    mineOnly: boolean;
    uploadSignal: number;
    onNavigate: (location: Location) => void;
    onClientsStale: () => void;
    onOpenSecurity: (matterId: string) => void;
};

function FolderBranch({ node, depth, activeId, open, onToggle, onOpen, onDropDoc }: {
    node: FolderNode;
    depth: number;
    activeId: string | null;
    open: ReadonlySet<string>;
    onToggle: (id: string) => void;
    onOpen: (id: string) => void;
    onDropDoc: (folderId: string, docId: string) => void;
}) {
    const [over, setOver] = useState(false);
    const expanded = open.has(node.id);
    const count = folderSubtreeCount(node);
    return (
        <li>
            <div
                className={['fm-tree__row', 'fm-tree__row--folder', node.id === activeId ? 'is-on' : '', over ? 'is-drop' : ''].filter(Boolean).join(' ')}
                style={{ paddingLeft: `${1.1 + depth * 0.85}rem` }}
                onDragOver={(event) => {
                    if (event.dataTransfer.types.includes(DOC_DRAG_TYPE)) {
                        event.preventDefault();
                        setOver(true);
                    }
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(event) => {
                    setOver(false);
                    const docId = event.dataTransfer.getData(DOC_DRAG_TYPE);
                    if (docId) {
                        event.preventDefault();
                        event.stopPropagation();
                        onDropDoc(node.id, docId);
                    }
                }}
            >
                <button type="button" className={expanded ? 'fm-tree__caret is-open' : 'fm-tree__caret'} aria-label="toggle"
                    style={{ visibility: node.children.length ? 'visible' : 'hidden' }} onClick={() => onToggle(node.id)}>
                    <Icon name="chevron" />
                </button>
                <button type="button" className="fm-tree__label" onClick={() => onOpen(node.id)}>
                    <Icon name={node.id === activeId ? 'folderOpen' : 'folder'} className="fm-ico--folder" />
                    <span>{node.name}</span>
                    {count ? <em>{count}</em> : null}
                </button>
            </div>
            {expanded && node.children.length ? (
                <ul>
                    {node.children.map((child) => (
                        <FolderBranch key={child.id} node={child} depth={depth + 1} activeId={activeId} open={open}
                            onToggle={onToggle} onOpen={onOpen} onDropDoc={onDropDoc} />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

function FolderNameModal({ title, initial, onClose, onSubmit }: {
    title: string;
    initial: string;
    onClose: () => void;
    onSubmit: (name: string) => Promise<boolean>;
}) {
    const { tr } = useFm();
    const [name, setName] = useState(initial);
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!name.trim())
            return;
        setBusy(true);
        const ok = await onSubmit(name.trim());
        setBusy(false);
        if (ok)
            onClose();
    };
    return (
        <Modal title={title} onClose={onClose} footer={(
            <>
                <button type="button" className="fm-btn" onClick={onClose}>{tr('common.cancel')}</button>
                <button type="button" className="fm-btn fm-btn--primary" disabled={busy || !name.trim()} onClick={submit}>{tr('common.save')}</button>
            </>
        )}>
            <label className="fm-field">
                <span>{tr('browser.folderName')}</span>
                <input autoFocus value={name} maxLength={300} onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter')
                            void submit();
                    }} />
            </label>
        </Modal>
    );
}

export function MattersBrowser({ clients, location, mineOnly, uploadSignal, onNavigate, onClientsStale, onOpenSecurity }: Props) {
    const { tr } = useFm();
    const act = useAction();
    const notify = useNotify();
    const viewerId = clients.viewer.userId;
    const [filter, setFilter] = useState('');
    const [showClosed, setShowClosed] = useState(false);
    const [openClients, setOpenClients] = useState<Set<string>>(() => new Set());
    const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());
    const [dropping, setDropping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [folderModal, setFolderModal] = useState<'create' | 'rename' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const { matterId, folderId, docId } = location;

    const browse = useLoad(matterId ? () => filesApi.browse(matterId, folderId) : null, [matterId, folderId]);
    const data = browse.data && browse.data.matter.id === matterId ? browse.data : null;
    const folders = useMemo(() => data?.folders ?? [], [data]);
    const tree = useMemo(() => buildFolderTree(folders), [folders]);
    const level = data?.matter.level ?? 'none';
    const editable = canEdit(level);
    const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) ?? null : null;
    const subfolders = folders.filter((folder) => folder.parentId === (folderId ?? null));

    const matterById = useMemo(() => {
        const map = new Map<string, MatterRow>();
        for (const client of clients.clients) {
            for (const matter of client.matters)
                map.set(matter.id, matter);
        }
        return map;
    }, [clients]);

    useEffect(() => {
        if (!matterId)
            return;
        const matter = matterById.get(matterId);
        if (matter)
            setOpenClients((prev) => (prev.has(matter.clientId) ? prev : new Set(prev).add(matter.clientId)));
    }, [matterId, matterById]);

    useEffect(() => {
        if (!folderId || folders.length === 0)
            return;
        const ancestors = folderAncestors(folders, folderId);
        if (ancestors.length)
            setOpenFolders((prev) => new Set([...prev, ...ancestors]));
    }, [folderId, folders]);

    const lastUploadSignal = useRef(uploadSignal);
    useEffect(() => {
        if (uploadSignal === lastUploadSignal.current)
            return;
        lastUploadSignal.current = uploadSignal;
        if (matterId && editable)
            fileRef.current?.click();
        else
            notify(tr('browser.pickMatterFirst'), 'error');
    }, [uploadSignal, matterId, editable, notify, tr]);

    const visibleClients = useMemo(() => clients.clients
        .map((client) => {
            const clientHit = matchesFilter(filter, client.name);
            const matters = client.matters.filter((matter) => (!mineOnly || matter.mine)
                && (showClosed || !matter.closed || matter.id === matterId)
                && (clientHit || matchesFilter(filter, matter.name, matter.code)));
            return { client, matters };
        })
        .filter((row) => row.matters.length > 0), [clients, filter, mineOnly, showClosed, matterId]);

    const filtering = filter.trim().length > 0;

    const toggle = (set: Set<string>, id: string) => {
        const next = new Set(set);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        return next;
    };

    const upload = async (files: File[]) => {
        if (!matterId || files.length === 0)
            return;
        setUploading(true);
        const result = await act(() => filesApi.upload(matterId, folderId, files));
        setUploading(false);
        if (result) {
            notify(tr('browser.uploaded', { count: result.documents.length }));
            browse.reload();
            onClientsStale();
            if (result.documents.length === 1)
                onNavigate({ matterId, folderId, docId: result.documents[0].id });
        }
    };

    const patchDoc = (doc: DocumentRow) => {
        browse.setData((prev) => {
            if (!prev)
                return prev;
            const inPlace = (doc.folderId ?? null) === (prev.folderId ?? null);
            const documents = inPlace
                ? prev.documents.map((row) => (row.id === doc.id ? { ...row, ...doc } : row))
                : prev.documents.filter((row) => row.id !== doc.id);
            return { ...prev, documents };
        });
        if ((doc.folderId ?? null) !== (folderId ?? null))
            browse.reload();
    };

    const moveDoc = async (target: string | null, id: string) => {
        const result = await act(() => filesApi.updateDocument(id, target ? { folderId: target } : { moveToRoot: true }), tr('pane.saved'));
        if (result)
            browse.reload();
    };

    const toggleFavorite = async (doc: DocumentRow) => {
        const ok = await act(() => (doc.favorite ? filesApi.removeFavorite('document', doc.id) : filesApi.addFavorite('document', doc.id, doc.matterId)));
        if (ok)
            patchDoc({ ...doc, favorite: !doc.favorite });
    };

    const toggleMatterFavorite = async () => {
        if (!data)
            return;
        const fav = data.matter.favorite;
        const ok = await act(() => (fav ? filesApi.removeFavorite('matter', data.matter.id) : filesApi.addFavorite('matter', data.matter.id, data.matter.id)));
        if (ok) {
            browse.setData((prev) => (prev ? { ...prev, matter: { ...prev.matter, favorite: !fav } } : prev));
            onClientsStale();
        }
    };

    const onDrop = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDropping(false);
        if (!editable)
            return;
        const docDrag = event.dataTransfer.getData(DOC_DRAG_TYPE);
        if (docDrag)
            return;
        void upload(Array.from(event.dataTransfer.files));
    };

    const rootDrop = {
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
            if (event.dataTransfer.types.includes(DOC_DRAG_TYPE))
                event.preventDefault();
        },
        onDrop: (event: DragEvent<HTMLDivElement>) => {
            const id = event.dataTransfer.getData(DOC_DRAG_TYPE);
            if (id) {
                event.preventDefault();
                void moveDoc(null, id);
            }
        },
    };

    return (
        <div className="fm-browser">
            <nav className="fm-tree" aria-label={tr('nav.matters')}>
                <div className="fm-tree__tools">
                    <label className="fm-search">
                        <Icon name="search" />
                        <input value={filter} placeholder={tr('tree.filter')} onChange={(event) => setFilter(event.target.value)} />
                    </label>
                    <label className="fm-check">
                        <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
                        <span>{tr('tree.showClosed')}</span>
                    </label>
                </div>
                {visibleClients.length === 0 ? (
                    <div className="fm-state">
                        <p>{mineOnly ? tr('lists.myMattersEmpty') : tr('tree.empty')}</p>
                        <small>{tr('tree.emptyHint')}</small>
                    </div>
                ) : (
                    <ul className="fm-tree__list">
                        {visibleClients.map(({ client, matters }) => {
                            const expanded = filtering || openClients.has(client.id);
                            return (
                                <li key={client.id}>
                                    <button type="button" className="fm-tree__row fm-tree__row--client" aria-expanded={expanded}
                                        onClick={() => setOpenClients((prev) => toggle(prev, client.id))}>
                                        <Icon name="chevron" className={expanded ? 'fm-tree__chev is-open' : 'fm-tree__chev'} />
                                        <Icon name="building" />
                                        <span>{client.name}</span>
                                        <em>{matters.length}</em>
                                    </button>
                                    {expanded ? (
                                        <ul>
                                            {matters.map((matter) => {
                                                const active = matter.id === matterId;
                                                return (
                                                    <li key={matter.id}>
                                                        <div className={['fm-tree__row', 'fm-tree__row--matter', active && !folderId ? 'is-on' : '', active ? 'is-open' : '', matter.closed ? 'is-closed' : ''].filter(Boolean).join(' ')}
                                                            {...(active ? rootDrop : {})}>
                                                            <button type="button" className="fm-tree__label"
                                                                onClick={() => onNavigate({ matterId: matter.id, folderId: null, docId: null })}>
                                                                <Icon name={matter.level === 'read' || matter.closed ? 'lock' : 'briefcase'} />
                                                                <span>
                                                                    {matter.code ? <small>{matter.code}</small> : null}
                                                                    {matter.name}
                                                                </span>
                                                                {matter.documents ? <em>{matter.documents}</em> : null}
                                                            </button>
                                                        </div>
                                                        {active && tree.length ? (
                                                            <ul className="fm-tree__folders">
                                                                {tree.map((node) => (
                                                                    <FolderBranch key={node.id} node={node} depth={1} activeId={folderId} open={openFolders}
                                                                        onToggle={(id) => setOpenFolders((prev) => toggle(prev, id))}
                                                                        onOpen={(id) => {
                                                                            setOpenFolders((prev) => new Set(prev).add(id));
                                                                            onNavigate({ matterId: matter.id, folderId: id, docId: null });
                                                                        }}
                                                                        onDropDoc={(target, id) => void moveDoc(target, id)} />
                                                                ))}
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
                )}
            </nav>

            <section
                className={dropping ? 'fm-docs is-dropping' : 'fm-docs'}
                onDragOver={(event) => {
                    if (editable && event.dataTransfer.types.includes('Files')) {
                        event.preventDefault();
                        setDropping(true);
                    }
                }}
                onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                        setDropping(false);
                }}
                onDrop={onDrop}
            >
                {!matterId ? (
                    <div className="fm-empty">
                        <Icon name="briefcase" />
                        <h3>{tr('browser.pickMatter')}</h3>
                        <p>{tr('browser.pickMatterHint')}</p>
                    </div>
                ) : (
                    <StateBlock loading={browse.loading && !data} error={browse.error} onRetry={browse.reload}>
                        {data ? (
                            <>
                                <header className="fm-docs__head">
                                    <div className="fm-crumbs">
                                        <span>{data.client.name}</span>
                                        <Icon name="chevron" />
                                        <button type="button" onClick={() => onNavigate({ matterId: data.matter.id, folderId: null, docId: null })}>
                                            {data.matter.code ? `${data.matter.code} · ` : ''}{data.matter.name}
                                        </button>
                                        {data.path.map((crumb) => (
                                            <span key={crumb.id} className="fm-crumbs__part">
                                                <Icon name="chevron" />
                                                <button type="button" onClick={() => onNavigate({ matterId: data.matter.id, folderId: crumb.id, docId: null })}>{crumb.name}</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="fm-docs__tools">
                                        <LevelBadge level={level} />
                                        <button type="button" className={data.matter.favorite ? 'fm-icon-btn fm-star is-on' : 'fm-icon-btn fm-star'}
                                            aria-pressed={data.matter.favorite} title={tr(data.matter.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}
                                            aria-label={tr(data.matter.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')} onClick={toggleMatterFavorite}>
                                            <Icon name="star" />
                                        </button>
                                        {currentFolder && editable ? (
                                            <>
                                                <button type="button" className="fm-icon-btn" title={tr('browser.renameFolder')} aria-label={tr('browser.renameFolder')}
                                                    onClick={() => setFolderModal('rename')}><Icon name="edit" /></button>
                                                <button type="button" className="fm-icon-btn fm-icon-btn--danger" title={tr('browser.deleteFolder')} aria-label={tr('browser.deleteFolder')}
                                                    onClick={() => setConfirmDelete(true)}><Icon name="trash" /></button>
                                            </>
                                        ) : null}
                                        {canManage(level) ? (
                                            <button type="button" className="fm-btn" onClick={() => onOpenSecurity(data.matter.id)}>
                                                <Icon name="shield" />{tr('browser.security')}
                                            </button>
                                        ) : null}
                                        {editable ? (
                                            <>
                                                <button type="button" className="fm-btn" onClick={() => setFolderModal('create')}>
                                                    <Icon name="plus" />{tr('browser.newFolder')}
                                                </button>
                                                <button type="button" className="fm-btn fm-btn--primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                                                    <Icon name="upload" />{uploading ? tr('browser.uploading') : tr('browser.upload')}
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </header>
                                {data.matter.closed ? <div className="fm-banner fm-banner--muted"><Icon name="lock" />{tr('browser.closedBanner')}</div> : null}
                                {!data.matter.closed && level === 'read' ? <div className="fm-banner fm-banner--muted"><Icon name="eye" />{tr('browser.readBanner')}</div> : null}
                                <DocumentTable
                                    documents={data.documents}
                                    folders={subfolders}
                                    selectedId={docId}
                                    viewerId={viewerId}
                                    draggable={editable}
                                    empty={editable ? tr('browser.dropHint') : tr('browser.emptyFolder')}
                                    onSelect={(doc) => onNavigate({ matterId, folderId, docId: doc.id })}
                                    onOpenFolder={(folder: FolderRow) => onNavigate({ matterId, folderId: folder.id, docId: null })}
                                    onToggleFavorite={toggleFavorite}
                                />
                                {editable && data.documents.length + subfolders.length > 0 ? <p className="fm-docs__hint">{tr('browser.dropHint')}</p> : null}
                            </>
                        ) : null}
                    </StateBlock>
                )}
                {dropping ? <div className="fm-dropzone"><Icon name="upload" />{tr('browser.dropHint')}</div> : null}
                <input ref={fileRef} type="file" multiple hidden onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = '';
                    void upload(files);
                }} />
            </section>

            {docId && matterId ? (
                <DocumentPane
                    documentId={docId}
                    viewerId={viewerId}
                    folders={folders}
                    onChanged={patchDoc}
                    onDeleted={() => {
                        browse.reload();
                        onClientsStale();
                        onNavigate({ matterId, folderId, docId: null });
                    }}
                    onClose={() => onNavigate({ matterId, folderId, docId: null })}
                />
            ) : null}

            {folderModal && matterId ? (
                <FolderNameModal
                    title={folderModal === 'create' ? tr('browser.newFolder') : tr('browser.renameFolder')}
                    initial={folderModal === 'rename' ? currentFolder?.name ?? '' : ''}
                    onClose={() => setFolderModal(null)}
                    onSubmit={async (name) => {
                        if (folderModal === 'create') {
                            const result = await act(() => filesApi.createFolder(matterId, name, folderId));
                            if (!result)
                                return false;
                            browse.reload();
                            return true;
                        }
                        if (!currentFolder)
                            return false;
                        const result = await act(() => filesApi.updateFolder(currentFolder.id, { name }));
                        if (!result)
                            return false;
                        browse.reload();
                        return true;
                    }}
                />
            ) : null}
            {confirmDelete && currentFolder && matterId ? (
                <ConfirmModal
                    title={tr('browser.deleteFolder')}
                    text={tr('browser.deleteFolderConfirm', { name: currentFolder.name })}
                    confirmLabel={tr('common.delete')}
                    danger
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={async () => {
                        const ok = await act(() => filesApi.deleteFolder(currentFolder.id));
                        if (ok) {
                            onClientsStale();
                            onNavigate({ matterId, folderId: currentFolder.parentId, docId: null });
                        }
                    }}
                />
            ) : null}
        </div>
    );
}
