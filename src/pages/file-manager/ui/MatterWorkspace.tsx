import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { filesApi, type DocumentRow, type FolderRow } from '../api/filesApi';
import { canEdit, canManage, formatBytes } from '../lib/filesFormat';
import { DOC_DRAG_TYPE } from './DocumentTable';
import { DocumentPane } from './DocumentPane';
import { ConfirmModal, FileBadge, Icon, Modal, StateBlock, useAction, useFm, useLoad, useNotify } from './fmShared';

export type Location = { matterId: string | null; folderId: string | null; docId: string | null };

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
    const [folderModal, setFolderModal] = useState<'create' | 'rename' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<{ documentId: string; fromFolderId: string | null } | null>(null);
    const [menu, setMenu] = useState<CtxMenu | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const browse = useLoad(() => filesApi.browse(matterId, folderId), [matterId, folderId]);
    const data = browse.data && browse.data.matter.id === matterId ? browse.data : null;
    const folders = useMemo(() => data?.folders ?? [], [data]);
    const level = data?.matter.level ?? 'none';
    const editable = canEdit(level);
    const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) ?? null : null;
    const selectedFolder = selectedFolderId ? folders.find((folder) => folder.id === selectedFolderId) ?? null : null;
    const parentId = currentFolder?.parentId ?? null;
    const subfolders = useMemo(
        () => folders.filter((folder) => folder.parentId === (folderId ?? null)).sort((a, b) => a.name.localeCompare(b.name)),
        [folders, folderId],
    );
    const documents = useMemo(
        () => [...(data?.documents ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
        [data],
    );

    useEffect(() => {
        setSelectedFolderId(null);
        setMenu(null);
    }, [matterId, folderId, docId]);

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

    const goFolder = (next: string | null) => onNavigate({ matterId, folderId: next, docId: null });

    const upload = async (files: File[]) => {
        if (files.length === 0)
            return;
        const result = await act(() => filesApi.upload(matterId, folderId, files));
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
            const nextDocs = inPlace
                ? prev.documents.map((row) => (row.id === doc.id ? { ...row, ...doc } : row))
                : prev.documents.filter((row) => row.id !== doc.id);
            return { ...prev, documents: nextDocs };
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

    const onDrop = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDropping(false);
        if (!editable || event.dataTransfer.getData(DOC_DRAG_TYPE))
            return;
        void upload(Array.from(event.dataTransfer.files));
    };

    const openCtx = (event: ReactMouseEvent, target: CtxMenu['target']) => {
        event.preventDefault();
        event.stopPropagation();
        const bound = contentRef.current?.getBoundingClientRect();
        const x = bound ? Math.min(event.clientX - bound.left, bound.width - 180) : event.clientX;
        const y = bound ? Math.min(event.clientY - bound.top, bound.height - 180) : event.clientY;
        setMenu({ x: Math.max(8, x), y: Math.max(8, y), target });
        setSelectedFolderId(target.kind === 'folder' ? target.folder.id : null);
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

    const empty = subfolders.length === 0 && documents.length === 0;

    return (
        <div className="fm-split">
            <section
                className={dropping ? 'fm-tiles is-dropping' : 'fm-tiles'}
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
                        <div
                            ref={contentRef}
                            className="fm-tiles__content"
                            onClick={() => {
                                setSelectedFolderId(null);
                                if (docId)
                                    onNavigate({ matterId, folderId, docId: null });
                            }}
                            onContextMenu={(event) => openCtx(event, { kind: 'blank' })}
                        >
                            {empty ? (
                                <div className="fm-ex__empty">
                                    <Icon name="folderOpen" className="fm-ico--folder" />
                                    <p>{editable ? tr('browser.dropHint') : tr('browser.emptyFolder')}</p>
                                </div>
                            ) : (
                                <div className="fm-ex__tiles">
                                    {folderId ? (
                                        <button type="button" className="fm-ex__tile fm-ex__tile--up"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                goFolder(parentId);
                                            }}
                                            onDoubleClick={(event) => {
                                                event.stopPropagation();
                                                goFolder(parentId);
                                            }}>
                                            <span className="fm-ex__tile-ico" aria-hidden>
                                                <Icon name="up" />
                                            </span>
                                            <span className="fm-ex__tile-meta">
                                                <strong>..</strong>
                                                <small>{tr('browser.up')}</small>
                                            </span>
                                        </button>
                                    ) : null}
                                    {subfolders.map((folder) => (
                                        <button key={folder.id} type="button"
                                            className={selectedFolderId === folder.id ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedFolderId(folder.id);
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
                                    {documents.map((doc) => {
                                        const lockedByOther = doc.checkedOutById !== null && doc.checkedOutById !== viewerId;
                                        return (
                                            <button key={doc.id} type="button"
                                                className={docId === doc.id ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                                draggable={editable}
                                                onDragStart={editable ? (event) => {
                                                    event.dataTransfer.setData(DOC_DRAG_TYPE, doc.id);
                                                    event.dataTransfer.effectAllowed = 'move';
                                                } : undefined}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedFolderId(null);
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
                                                    <small>
                                                        {kindLabel(doc.kind, tr)} · {formatBytes(doc.sizeBytes, locale)}
                                                        {doc.checkedOutById ? ` · ${lockedByOther ? tr('table.checkedOutBy', { name: doc.checkedOutBy ?? '' }) : tr('table.checkedOutMe')}` : ''}
                                                    </small>
                                                </span>
                                            </button>
                                        );
                                    })}
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
                                            {folderId ? (
                                                <button type="button" role="menuitem" onClick={() => {
                                                    goFolder(parentId);
                                                    setMenu(null);
                                                }}>{tr('browser.up')}</button>
                                            ) : (
                                                <button type="button" role="menuitem" onClick={() => {
                                                    onOpenClient(data.client.id);
                                                    setMenu(null);
                                                }}>{tr('nav.allMatters')}</button>
                                            )}
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
                                            {canManage(level) ? (
                                                <button type="button" role="menuitem" onClick={() => {
                                                    onOpenSecurity(matterId);
                                                    setMenu(null);
                                                }}>{tr('browser.security')}</button>
                                            ) : null}
                                            <button type="button" role="menuitem" onClick={() => {
                                                onOpenClients();
                                                setMenu(null);
                                            }}>{tr('nav.clients')}</button>
                                            <button type="button" role="menuitem" onClick={() => {
                                                browse.reload();
                                                setMenu(null);
                                            }}>{tr('browser.refresh')}</button>
                                        </>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
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
