import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { filesApi, type DocumentRow } from '../api/filesApi';
import { canEdit, canManage } from '../lib/filesFormat';
import { DOC_DRAG_TYPE, DocumentTable } from './DocumentTable';
import { DocumentPane } from './DocumentPane';
import { ConfirmModal, Icon, LevelBadge, Modal, StateBlock, useAction, useFm, useLoad, useNotify } from './fmShared';

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
    const { tr } = useFm();
    const act = useAction();
    const notify = useNotify();
    const [dropping, setDropping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [folderModal, setFolderModal] = useState<'create' | 'rename' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const browse = useLoad(() => filesApi.browse(matterId, folderId), [matterId, folderId]);
    const data = browse.data && browse.data.matter.id === matterId ? browse.data : null;
    const folders = useMemo(() => data?.folders ?? [], [data]);
    const level = data?.matter.level ?? 'none';
    const editable = canEdit(level);
    const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) ?? null : null;
    const subfolders = folders.filter((folder) => folder.parentId === (folderId ?? null));

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
        if (!editable || event.dataTransfer.getData(DOC_DRAG_TYPE))
            return;
        void upload(Array.from(event.dataTransfer.files));
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

    return (
        <div className="fm-split">
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
                <StateBlock loading={browse.loading && !data} error={browse.error} onRetry={browse.reload}>
                    {data ? (
                        <>
                            <header className="fm-docs__head">
                                <div className="fm-crumbs">
                                    <button type="button" onClick={onOpenClients}>{tr('nav.clients')}</button>
                                    <Icon name="chevron" />
                                    <button type="button" onClick={() => onOpenClient(data.client.id)}>{data.client.name}</button>
                                    <Icon name="chevron" />
                                    <button type="button" {...crumbDrop(null)} onClick={() => onNavigate({ matterId, folderId: null, docId: null })}>
                                        {data.matter.code ? `${data.matter.code} · ` : ''}{data.matter.name}
                                    </button>
                                    {data.path.map((crumb) => (
                                        <span key={crumb.id} className="fm-crumbs__part">
                                            <Icon name="chevron" />
                                            <button type="button" {...crumbDrop(crumb.id)} onClick={() => onNavigate({ matterId, folderId: crumb.id, docId: null })}>
                                                {crumb.name}
                                            </button>
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
                                        <button type="button" className="fm-btn" onClick={() => onOpenSecurity(matterId)}>
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
                                onOpenFolder={(folder) => onNavigate({ matterId, folderId: folder.id, docId: null })}
                                onDropOnFolder={editable ? (folder, id) => void moveDoc(folder.id, id) : undefined}
                                onToggleFavorite={toggleFavorite}
                            />
                            {editable && data.documents.length + subfolders.length > 0 ? <p className="fm-docs__hint">{tr('browser.dropHint')}</p> : null}
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
            {confirmDelete && currentFolder ? (
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
