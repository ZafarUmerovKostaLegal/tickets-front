import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { filesApi, type DocumentRow, type FolderRow } from '../api/filesApi';
import { buildFolderTree, canEdit, canManage, folderAncestors, formatBytes, formatDateTime, type FolderNode } from '../lib/filesFormat';
import { DOC_DRAG_TYPE } from './DocumentTable';
import { DocumentPane } from './DocumentPane';
import { ConfirmModal, FileBadge, Icon, LevelBadge, Modal, StateBlock, useAction, useFm, useLoad, useNotify } from './fmShared';

export type Location = { matterId: string | null; folderId: string | null; docId: string | null };

type ViewMode = 'details' | 'icons';
type SortKey = 'name' | 'modified' | 'type' | 'size';
type Selection =
    | { kind: 'folder'; id: string }
    | { kind: 'document'; id: string }
    | null;

type Props = {
    matterId: string;
    folderId: string | null;
    docId: string | null;
    viewerId: number;
    uploadSignal: number;
    onNavigate: (location: Location) => void;
    onOpenClients: () => void;
    onOpenClient: (clientId: string) => void;
    onClientsStale: () => void;
    onOpenSecurity: (matterId: string) => void;
};

type CtxMenu = {
    x: number;
    y: number;
    target: { kind: 'folder'; folder: FolderRow } | { kind: 'document'; doc: DocumentRow } | { kind: 'blank' };
};

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

function NavBranch({ node, depth, activeId, open, onToggle, onOpen, onDropDoc }: {
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
    return (
        <li>
            <div
                className={['fm-ex__nav-row', node.id === activeId ? 'is-on' : '', over ? 'is-drop' : ''].filter(Boolean).join(' ')}
                style={{ paddingLeft: `${0.55 + depth * 0.85}rem` }}
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
                        onDropDoc(node.id, docId);
                    }
                }}
            >
                <button type="button" className={expanded ? 'fm-ex__caret is-open' : 'fm-ex__caret'}
                    style={{ visibility: node.children.length ? 'visible' : 'hidden' }}
                    aria-label="toggle" onClick={() => onToggle(node.id)}>
                    <Icon name="chevron" />
                </button>
                <button type="button" className="fm-ex__nav-label" onClick={() => onOpen(node.id)}>
                    <Icon name={node.id === activeId ? 'folderOpen' : 'folder'} className="fm-ico--folder" />
                    <span>{node.name}</span>
                </button>
            </div>
            {expanded && node.children.length ? (
                <ul>
                    {node.children.map((child) => (
                        <NavBranch key={child.id} node={child} depth={depth + 1} activeId={activeId} open={open}
                            onToggle={onToggle} onOpen={onOpen} onDropDoc={onDropDoc} />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

function kindLabel(kind: DocumentRow['kind'], tr: (key: string) => string): string {
    const key = `kinds.${kind}`;
    const label = tr(key);
    return label === key ? tr('browser.fileType') : label;
}

export function MatterWorkspace({
    matterId,
    folderId,
    docId,
    viewerId,
    uploadSignal,
    onNavigate,
    onOpenClients,
    onOpenClient,
    onClientsStale,
    onOpenSecurity,
}: Props) {
    const { tr, locale } = useFm();
    const act = useAction();
    const notify = useNotify();
    const [dropping, setDropping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [folderModal, setFolderModal] = useState<'create' | 'rename' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('icons');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [filter, setFilter] = useState('');
    const [selection, setSelection] = useState<Selection>(null);
    const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());
    const [clipboard, setClipboard] = useState<{ documentId: string; fromFolderId: string | null } | null>(null);
    const [menu, setMenu] = useState<CtxMenu | null>(null);
    const [trail, setTrail] = useState<{ stack: Array<string | null>; index: number }>({ stack: [null], index: 0 });
    const fileRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const browse = useLoad(() => filesApi.browse(matterId, folderId), [matterId, folderId]);
    const data = browse.data && browse.data.matter.id === matterId ? browse.data : null;
    const folders = useMemo(() => data?.folders ?? [], [data]);
    const level = data?.matter.level ?? 'none';
    const editable = canEdit(level);
    const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) ?? null : null;
    const parentId = currentFolder?.parentId ?? null;
    const tree = useMemo(() => buildFolderTree(folders), [folders]);
    const subfolders = useMemo(() => folders.filter((folder) => folder.parentId === (folderId ?? null)), [folders, folderId]);

    useEffect(() => {
        setSelection(docId ? { kind: 'document', id: docId } : null);
        setMenu(null);
        setFilter('');
    }, [matterId, folderId, docId]);

    useEffect(() => {
        if (!folderId || folders.length === 0)
            return;
        const ancestors = folderAncestors(folders, folderId);
        if (ancestors.length || folderId)
            setOpenFolders((prev) => new Set([...prev, ...ancestors, folderId]));
    }, [folderId, folders]);

    useEffect(() => {
        setTrail({ stack: [null], index: 0 });
    }, [matterId]);

    const goFolder = (next: string | null) => {
        setTrail((prev) => {
            const trimmed = prev.stack.slice(0, prev.index + 1);
            if (trimmed[trimmed.length - 1] === next)
                return prev;
            return { stack: [...trimmed, next], index: trimmed.length };
        });
        onNavigate({ matterId, folderId: next, docId: null });
    };

    const goBack = () => {
        if (trail.index <= 0)
            return;
        const nextIndex = trail.index - 1;
        const target = trail.stack[nextIndex] ?? null;
        setTrail((prev) => ({ ...prev, index: nextIndex }));
        onNavigate({ matterId, folderId: target, docId: null });
    };

    const goUp = () => {
        if (!folderId)
            return;
        goFolder(parentId);
    };

    const lastUploadSignal = useRef(uploadSignal);
    useEffect(() => {
        if (uploadSignal === lastUploadSignal.current)
            return;
        lastUploadSignal.current = uploadSignal;
        if (editable)
            fileRef.current?.click();
        else
            notify(tr('browser.readBanner'), 'error');
    }, [uploadSignal, editable, notify, tr]);

    useEffect(() => {
        if (!menu)
            return;
        const close = () => setMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [menu]);

    const upload = async (files: File[]) => {
        if (files.length === 0)
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
        if (result) {
            browse.reload();
            if (id === docId)
                onNavigate({ matterId, folderId, docId: null });
        }
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
        if (!editable || event.dataTransfer.getData(DOC_DRAG_TYPE))
            return;
        void upload(Array.from(event.dataTransfer.files));
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key)
            setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        else {
            setSortKey(key);
            setSortDir(key === 'modified' || key === 'size' ? 'desc' : 'asc');
        }
    };

    const filteredFolders = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        const list = needle ? subfolders.filter((folder) => folder.name.toLowerCase().includes(needle)) : [...subfolders];
        list.sort((a, b) => {
            const mul = sortDir === 'asc' ? 1 : -1;
            if (sortKey === 'modified')
                return mul * ((a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.name.localeCompare(b.name));
            if (sortKey === 'size')
                return mul * (a.documents - b.documents || a.name.localeCompare(b.name));
            if (sortKey === 'type')
                return mul * a.name.localeCompare(b.name);
            return mul * a.name.localeCompare(b.name);
        });
        return list;
    }, [subfolders, filter, sortKey, sortDir]);

    const filteredDocs = useMemo(() => {
        const docs = data?.documents ?? [];
        const needle = filter.trim().toLowerCase();
        const list = needle
            ? docs.filter((doc) => doc.name.toLowerCase().includes(needle) || doc.docNumber.toLowerCase().includes(needle))
            : [...docs];
        list.sort((a, b) => {
            const mul = sortDir === 'asc' ? 1 : -1;
            if (sortKey === 'modified')
                return mul * ((a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') || a.name.localeCompare(b.name));
            if (sortKey === 'size')
                return mul * (a.sizeBytes - b.sizeBytes || a.name.localeCompare(b.name));
            if (sortKey === 'type')
                return mul * (a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
            return mul * a.name.localeCompare(b.name);
        });
        return list;
    }, [data, filter, sortKey, sortDir]);

    const itemCount = filteredFolders.length + filteredDocs.length;
    const selectedFolder = selection?.kind === 'folder' ? folders.find((folder) => folder.id === selection.id) ?? null : null;
    const selectedDoc = selection?.kind === 'document' ? (data?.documents.find((doc) => doc.id === selection.id) ?? null) : null;

    const openCtx = (event: ReactMouseEvent, target: CtxMenu['target']) => {
        event.preventDefault();
        event.stopPropagation();
        const bound = contentRef.current?.getBoundingClientRect();
        const x = bound ? Math.min(event.clientX - bound.left, bound.width - 180) : event.clientX;
        const y = bound ? Math.min(event.clientY - bound.top, bound.height - 180) : event.clientY;
        setMenu({ x: Math.max(8, x), y: Math.max(8, y), target });
        if (target.kind === 'folder')
            setSelection({ kind: 'folder', id: target.folder.id });
        else if (target.kind === 'document')
            setSelection({ kind: 'document', id: target.doc.id });
    };

    const pasteClipboard = async () => {
        if (!clipboard || !editable)
            return;
        if ((clipboard.fromFolderId ?? null) === (folderId ?? null)) {
            setClipboard(null);
            return;
        }
        await moveDoc(folderId, clipboard.documentId);
        setClipboard(null);
    };

    const crumbDrop = (target: string | null) => ({
        onDragOver: (event: DragEvent<HTMLButtonElement>) => {
            if (editable && event.dataTransfer.types.includes(DOC_DRAG_TYPE))
                event.preventDefault();
        },
        onDrop: (event: DragEvent<HTMLButtonElement>) => {
            const id = event.dataTransfer.getData(DOC_DRAG_TYPE);
            if (id) {
                event.preventDefault();
                event.stopPropagation();
                if (target !== (folderId ?? null))
                    void moveDoc(target, id);
            }
        },
    });

    const canGoBack = trail.index > 0;
    const canGoUp = Boolean(folderId);

    return (
        <div className="fm-split">
            <section
                className={dropping ? 'fm-ex is-dropping' : 'fm-ex'}
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
                <StateBlock loading={browse.loading && !data} error={browse.error} onRetry={browse.reload}>
                    {data ? (
                        <>
                            <div className="fm-ex__chrome">
                                <div className="fm-ex__toolbar">
                                    <div className="fm-ex__nav-btns">
                                        <button type="button" className="fm-ex__tool" disabled={!canGoBack} title={tr('browser.back')} aria-label={tr('browser.back')} onClick={goBack}>
                                            <Icon name="back" />
                                        </button>
                                        <button type="button" className="fm-ex__tool" disabled={!canGoUp} title={tr('browser.up')} aria-label={tr('browser.up')} onClick={goUp}>
                                            <Icon name="up" />
                                        </button>
                                        <button type="button" className="fm-ex__tool" title={tr('browser.refresh')} aria-label={tr('browser.refresh')} onClick={browse.reload}>
                                            <Icon name="refresh" />
                                        </button>
                                    </div>
                                    <div className="fm-ex__address" role="navigation" aria-label="path">
                                        <button type="button" className="fm-ex__addr-root" title={tr('nav.clients')} onClick={onOpenClients}>
                                            <Icon name="home" />
                                        </button>
                                        <button type="button" className="fm-ex__addr-seg" onClick={() => onOpenClient(data.client.id)}>{data.client.name}</button>
                                        <span className="fm-ex__addr-sep">›</span>
                                        <button type="button" className="fm-ex__addr-seg" {...crumbDrop(null)} onClick={() => goFolder(null)}>
                                            <Icon name="briefcase" />
                                            {data.matter.code ? `${data.matter.code} · ` : ''}{data.matter.name}
                                        </button>
                                        {data.path.map((crumb) => (
                                            <span key={crumb.id} className="fm-ex__addr-part">
                                                <span className="fm-ex__addr-sep">›</span>
                                                <button type="button" className="fm-ex__addr-seg" {...crumbDrop(crumb.id)} onClick={() => goFolder(crumb.id)}>
                                                    <Icon name="folder" className="fm-ico--folder" />
                                                    {crumb.name}
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <label className="fm-ex__filter">
                                        <Icon name="search" />
                                        <input value={filter} placeholder={tr('browser.filterHere')} onChange={(event) => setFilter(event.target.value)} />
                                    </label>
                                </div>

                                <div className="fm-ex__ribbon">
                                    <div className="fm-ex__ribbon-group">
                                        {editable ? (
                                            <>
                                                <button type="button" className="fm-ex__cmd" onClick={() => setFolderModal('create')}>
                                                    <Icon name="plus" /><span>{tr('browser.newFolder')}</span>
                                                </button>
                                                <button type="button" className="fm-ex__cmd is-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                                                    <Icon name="upload" /><span>{uploading ? tr('browser.uploading') : tr('browser.upload')}</span>
                                                </button>
                                            </>
                                        ) : null}
                                        {currentFolder && editable ? (
                                            <>
                                                <button type="button" className="fm-ex__cmd" onClick={() => setFolderModal('rename')}>
                                                    <Icon name="edit" /><span>{tr('browser.renameFolder')}</span>
                                                </button>
                                                <button type="button" className="fm-ex__cmd is-danger" onClick={() => setConfirmDelete(true)}>
                                                    <Icon name="trash" /><span>{tr('browser.deleteFolder')}</span>
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                    <div className="fm-ex__ribbon-group">
                                        {canManage(level) ? (
                                            <button type="button" className="fm-ex__cmd" onClick={() => onOpenSecurity(matterId)}>
                                                <Icon name="shield" /><span>{tr('browser.security')}</span>
                                            </button>
                                        ) : null}
                                        <button type="button" className={data.matter.favorite ? 'fm-ex__cmd is-on' : 'fm-ex__cmd'} onClick={toggleMatterFavorite}>
                                            <Icon name="star" /><span>{tr(data.matter.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}</span>
                                        </button>
                                        <LevelBadge level={level} />
                                    </div>
                                    <div className="fm-ex__view-toggle" role="radiogroup" aria-label="view">
                                        <button type="button" role="radio" aria-checked={viewMode === 'icons'} className={viewMode === 'icons' ? 'is-on' : ''}
                                            title={tr('browser.viewIcons')} aria-label={tr('browser.viewIcons')} onClick={() => setViewMode('icons')}>
                                            <Icon name="grid" />
                                        </button>
                                        <button type="button" role="radio" aria-checked={viewMode === 'details'} className={viewMode === 'details' ? 'is-on' : ''}
                                            title={tr('browser.viewDetails')} aria-label={tr('browser.viewDetails')} onClick={() => setViewMode('details')}>
                                            <Icon name="list" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {data.matter.closed ? <div className="fm-banner fm-banner--muted"><Icon name="lock" />{tr('browser.closedBanner')}</div> : null}
                            {!data.matter.closed && level === 'read' ? <div className="fm-banner fm-banner--muted"><Icon name="eye" />{tr('browser.readBanner')}</div> : null}

                            <div className="fm-ex__body">
                                <nav className="fm-ex__nav" aria-label={tr('browser.navigation')}>
                                    <p>{tr('browser.thisMatter')}</p>
                                    <button type="button" className={!folderId ? 'fm-ex__nav-row is-on' : 'fm-ex__nav-row'}
                                        onClick={() => goFolder(null)}
                                        onDragOver={(event) => {
                                            if (editable && event.dataTransfer.types.includes(DOC_DRAG_TYPE))
                                                event.preventDefault();
                                        }}
                                        onDrop={(event) => {
                                            const id = event.dataTransfer.getData(DOC_DRAG_TYPE);
                                            if (id)
                                                void moveDoc(null, id);
                                        }}>
                                        <Icon name="briefcase" />
                                        <span>{data.matter.name}</span>
                                    </button>
                                    <ul>
                                        {tree.map((node) => (
                                            <NavBranch key={node.id} node={node} depth={1} activeId={folderId} open={openFolders}
                                                onToggle={(id) => setOpenFolders((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(id))
                                                        next.delete(id);
                                                    else
                                                        next.add(id);
                                                    return next;
                                                })}
                                                onOpen={(id) => goFolder(id)}
                                                onDropDoc={(target, id) => void moveDoc(target, id)} />
                                        ))}
                                    </ul>
                                </nav>

                                <div
                                    ref={contentRef}
                                    className="fm-ex__content"
                                    onClick={() => {
                                        setSelection(null);
                                        if (docId)
                                            onNavigate({ matterId, folderId, docId: null });
                                    }}
                                    onContextMenu={(event) => openCtx(event, { kind: 'blank' })}
                                >
                                    {itemCount === 0 ? (
                                        <div className="fm-ex__empty">
                                            <Icon name="folderOpen" className="fm-ico--folder" />
                                            <p>{editable ? tr('browser.dropHint') : tr('browser.emptyFolder')}</p>
                                        </div>
                                    ) : viewMode === 'icons' ? (
                                        <div className="fm-ex__tiles">
                                            {filteredFolders.map((folder) => (
                                                <button key={folder.id} type="button"
                                                    className={selection?.kind === 'folder' && selection.id === folder.id ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelection({ kind: 'folder', id: folder.id });
                                                    }}
                                                    onDoubleClick={(event) => {
                                                        event.stopPropagation();
                                                        goFolder(folder.id);
                                                    }}
                                                    onContextMenu={(event) => openCtx(event, { kind: 'folder', folder })}
                                                    onDragOver={editable ? (event) => {
                                                        if (event.dataTransfer.types.includes(DOC_DRAG_TYPE))
                                                            event.preventDefault();
                                                    } : undefined}
                                                    onDrop={editable ? (event) => {
                                                        const id = event.dataTransfer.getData(DOC_DRAG_TYPE);
                                                        if (id) {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            void moveDoc(folder.id, id);
                                                        }
                                                    } : undefined}>
                                                    <span className="fm-ex__tile-ico" aria-hidden>
                                                        <Icon name="folder" className="fm-ico--folder" />
                                                    </span>
                                                    <span className="fm-ex__tile-meta">
                                                        <strong title={folder.name}>{folder.name}</strong>
                                                        <small>{tr('browser.folderType')}</small>
                                                    </span>
                                                </button>
                                            ))}
                                            {filteredDocs.map((doc) => (
                                                <button key={doc.id} type="button"
                                                    className={selection?.kind === 'document' && selection.id === doc.id ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                                    draggable={editable}
                                                    onDragStart={editable ? (event) => {
                                                        event.dataTransfer.setData(DOC_DRAG_TYPE, doc.id);
                                                        event.dataTransfer.effectAllowed = 'move';
                                                    } : undefined}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelection({ kind: 'document', id: doc.id });
                                                        onNavigate({ matterId, folderId, docId: doc.id });
                                                    }}
                                                    onDoubleClick={(event) => {
                                                        event.stopPropagation();
                                                        onNavigate({ matterId, folderId, docId: doc.id });
                                                    }}
                                                    onContextMenu={(event) => openCtx(event, { kind: 'document', doc })}>
                                                    <span className="fm-ex__tile-ico" aria-hidden>
                                                        <FileBadge kind={doc.kind} />
                                                    </span>
                                                    <span className="fm-ex__tile-meta">
                                                        <strong title={doc.name}>{doc.name}</strong>
                                                        <small>{kindLabel(doc.kind, tr)} · {formatBytes(doc.sizeBytes, locale)}</small>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="fm-ex__details">
                                            <div className="fm-ex__cols" role="row">
                                                <button type="button" className={sortKey === 'name' ? 'is-sorted' : ''} onClick={() => toggleSort('name')}>
                                                    {tr('table.name')}{sortKey === 'name' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                                                </button>
                                                <button type="button" className={sortKey === 'modified' ? 'is-sorted' : ''} onClick={() => toggleSort('modified')}>
                                                    {tr('table.modified')}{sortKey === 'modified' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                                                </button>
                                                <button type="button" className={sortKey === 'type' ? 'is-sorted' : ''} onClick={() => toggleSort('type')}>
                                                    {tr('table.type')}{sortKey === 'type' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                                                </button>
                                                <button type="button" className={sortKey === 'size' ? 'is-sorted' : ''} onClick={() => toggleSort('size')}>
                                                    {tr('table.size')}{sortKey === 'size' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                                                </button>
                                            </div>
                                            <ul className="fm-ex__rows">
                                                {filteredFolders.map((folder) => (
                                                    <li key={folder.id}
                                                        className={selection?.kind === 'folder' && selection.id === folder.id ? 'is-on' : undefined}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setSelection({ kind: 'folder', id: folder.id });
                                                        }}
                                                        onDoubleClick={() => goFolder(folder.id)}
                                                        onContextMenu={(event) => openCtx(event, { kind: 'folder', folder })}
                                                        onDragOver={editable ? (event) => {
                                                            if (event.dataTransfer.types.includes(DOC_DRAG_TYPE))
                                                                event.preventDefault();
                                                        } : undefined}
                                                        onDrop={editable ? (event) => {
                                                            const id = event.dataTransfer.getData(DOC_DRAG_TYPE);
                                                            if (id) {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                void moveDoc(folder.id, id);
                                                            }
                                                        } : undefined}>
                                                        <span className="fm-ex__name">
                                                            <Icon name="folder" className="fm-ico--folder" />
                                                            <strong>{folder.name}</strong>
                                                        </span>
                                                        <span>{formatDateTime(folder.createdAt, locale)}</span>
                                                        <span>{tr('browser.folderType')}</span>
                                                        <span />
                                                    </li>
                                                ))}
                                                {filteredDocs.map((doc) => {
                                                    const lockedByOther = doc.checkedOutById !== null && doc.checkedOutById !== viewerId;
                                                    return (
                                                        <li key={doc.id}
                                                            className={selection?.kind === 'document' && selection.id === doc.id ? 'is-on' : undefined}
                                                            draggable={editable}
                                                            onDragStart={editable ? (event) => {
                                                                event.dataTransfer.setData(DOC_DRAG_TYPE, doc.id);
                                                                event.dataTransfer.effectAllowed = 'move';
                                                            } : undefined}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setSelection({ kind: 'document', id: doc.id });
                                                                onNavigate({ matterId, folderId, docId: doc.id });
                                                            }}
                                                            onDoubleClick={() => onNavigate({ matterId, folderId, docId: doc.id })}
                                                            onContextMenu={(event) => openCtx(event, { kind: 'document', doc })}>
                                                            <span className="fm-ex__name">
                                                                <FileBadge kind={doc.kind} />
                                                                <strong title={doc.name}>{doc.name}</strong>
                                                                {doc.checkedOutById ? (
                                                                    <em className={lockedByOther ? 'fm-lock is-other' : 'fm-lock'} title={lockedByOther ? tr('table.checkedOutBy', { name: doc.checkedOutBy ?? '' }) : tr('table.checkedOutMe')}>
                                                                        <Icon name="lock" />
                                                                    </em>
                                                                ) : null}
                                                            </span>
                                                            <span>{formatDateTime(doc.updatedAt, locale)}</span>
                                                            <span>{kindLabel(doc.kind, tr)}</span>
                                                            <span>{formatBytes(doc.sizeBytes, locale)}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}

                                    {menu ? (
                                        <div className="fm-ex__menu" style={{ left: menu.x, top: menu.y }} role="menu" onClick={(event) => event.stopPropagation()}>
                                            {menu.target.kind === 'folder' ? (
                                                <>
                                                    <button type="button" role="menuitem" onClick={() => {
                                                        goFolder(menu.target.kind === 'folder' ? menu.target.folder.id : null);
                                                        setMenu(null);
                                                    }}>{tr('browser.open')}</button>
                                                    {editable ? (
                                                        <>
                                                            <button type="button" role="menuitem" onClick={() => {
                                                                setFolderModal('rename');
                                                                setMenu(null);
                                                            }}>{tr('browser.renameFolder')}</button>
                                                            <button type="button" role="menuitem" className="is-danger" onClick={() => {
                                                                setConfirmDelete(true);
                                                                setMenu(null);
                                                            }}>{tr('browser.deleteFolder')}</button>
                                                        </>
                                                    ) : null}
                                                </>
                                            ) : null}
                                            {menu.target.kind === 'document' ? (
                                                <>
                                                    <button type="button" role="menuitem" onClick={() => {
                                                        if (menu.target.kind === 'document')
                                                            onNavigate({ matterId, folderId, docId: menu.target.doc.id });
                                                        setMenu(null);
                                                    }}>{tr('browser.open')}</button>
                                                    {editable ? (
                                                        <button type="button" role="menuitem" onClick={() => {
                                                            if (menu.target.kind === 'document')
                                                                setClipboard({ documentId: menu.target.doc.id, fromFolderId: folderId });
                                                            setMenu(null);
                                                        }}>{tr('browser.cut')}</button>
                                                    ) : null}
                                                    <button type="button" role="menuitem" onClick={() => {
                                                        if (menu.target.kind === 'document')
                                                            onNavigate({ matterId, folderId, docId: menu.target.doc.id });
                                                        setMenu(null);
                                                    }}>{tr('browser.properties')}</button>
                                                </>
                                            ) : null}
                                            {menu.target.kind === 'blank' ? (
                                                <>
                                                    {editable ? (
                                                        <>
                                                            <button type="button" role="menuitem" onClick={() => {
                                                                setFolderModal('create');
                                                                setMenu(null);
                                                            }}>{tr('browser.newFolder')}</button>
                                                            <button type="button" role="menuitem" onClick={() => {
                                                                fileRef.current?.click();
                                                                setMenu(null);
                                                            }}>{tr('browser.upload')}</button>
                                                            {clipboard ? (
                                                                <button type="button" role="menuitem" onClick={() => {
                                                                    void pasteClipboard();
                                                                    setMenu(null);
                                                                }}>{tr('browser.paste')}</button>
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                    <button type="button" role="menuitem" onClick={() => {
                                                        browse.reload();
                                                        setMenu(null);
                                                    }}>{tr('browser.refresh')}</button>
                                                </>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <footer className="fm-ex__status">
                                <span>{tr('browser.items', { count: itemCount })}</span>
                                <span>
                                    {selectedFolder
                                        ? selectedFolder.name
                                        : selectedDoc
                                            ? `${selectedDoc.name} · ${formatBytes(selectedDoc.sizeBytes, locale)}`
                                            : tr('browser.selectHint')}
                                </span>
                            </footer>
                        </>
                    ) : null}
                </StateBlock>
                {dropping ? <div className="fm-dropzone"><Icon name="upload" />{tr('browser.dropHint')}</div> : null}
                <input ref={fileRef} type="file" multiple hidden onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = '';
                    void upload(files);
                }} />
            </section>

            {docId ? (
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

            {folderModal ? (
                <FolderNameModal
                    title={folderModal === 'create' ? tr('browser.newFolder') : tr('browser.renameFolder')}
                    initial={folderModal === 'rename' ? (selectedFolder ?? currentFolder)?.name ?? '' : ''}
                    onClose={() => setFolderModal(null)}
                    onSubmit={async (name) => {
                        if (folderModal === 'create') {
                            const result = await act(() => filesApi.createFolder(matterId, name, folderId));
                            if (!result)
                                return false;
                            browse.reload();
                            return true;
                        }
                        const target = selectedFolder ?? currentFolder;
                        if (!target)
                            return false;
                        const result = await act(() => filesApi.updateFolder(target.id, { name }));
                        if (!result)
                            return false;
                        browse.reload();
                        return true;
                    }}
                />
            ) : null}
            {confirmDelete && (selectedFolder ?? currentFolder) ? (
                <ConfirmModal
                    title={tr('browser.deleteFolder')}
                    text={tr('browser.deleteFolderConfirm', { name: (selectedFolder ?? currentFolder)!.name })}
                    confirmLabel={tr('common.delete')}
                    danger
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={async () => {
                        const target = selectedFolder ?? currentFolder!;
                        const ok = await act(() => filesApi.deleteFolder(target.id));
                        if (ok) {
                            onClientsStale();
                            if (folderId === target.id || selectedFolder)
                                onNavigate({ matterId, folderId: target.parentId, docId: null });
                            else
                                browse.reload();
                        }
                    }}
                />
            ) : null}
        </div>
    );
}
