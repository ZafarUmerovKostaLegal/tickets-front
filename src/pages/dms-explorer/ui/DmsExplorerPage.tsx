import { useEffect, useMemo, useState } from 'react';
import { filesApi, type ClientsResponse, type DocumentRow, type FolderRow } from '@pages/file-manager/api/filesApi';
import { formatBytes, formatDateTime } from '@pages/file-manager/lib/filesFormat';
import { SecurityView } from '@pages/file-manager/ui/AccessViews';
import {
    ConfirmModal,
    FileBadge,
    Icon,
    Modal,
    StateBlock,
    ToastHost,
    useAction,
    useFm,
    useLoad,
    useNotify,
} from '@pages/file-manager/ui/fmShared';
import {
    clipboardFromSelection,
    copyText,
    documentDeepLink,
    downloadDocument,
    openDocument,
    pasteClipboard,
    printDocument,
    sendDocumentAttachment,
    sendDocumentLink,
} from '../model/dmsActions';
import { getDmsClipboard, subscribeDmsClipboard } from '../model/dmsClipboard';
import { DmsRibbon, type DmsMode } from './DmsRibbon';
import { DmsTree, type TreeSelection } from './DmsTree';
import './DmsExplorer.css';

type Selection =
    | { kind: 'document'; doc: DocumentRow }
    | { kind: 'folder'; folder: FolderRow }
    | null;

function DmsExplorerWorkspace() {
    const { tr, locale } = useFm();
    const act = useAction();
    const notify = useNotify();
    const clients = useLoad(() => filesApi.clients(), []);
    const [mode, setMode] = useState<DmsMode>('browse');
    const [tree, setTree] = useState<TreeSelection>({ kind: 'root' });
    const [folderCache, setFolderCache] = useState<Record<string, FolderRow[]>>({});
    const [selected, setSelected] = useState<Selection>(null);
    const [previewOn, setPreviewOn] = useState(true);
    const [filter, setFilter] = useState('');
    const [status, setStatus] = useState('');
    const [statusKind, setStatusKind] = useState<'' | 'ok' | 'error'>('');
    const [clipVersion, setClipVersion] = useState(0);
    const [securityOpen, setSecurityOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [searchQ, setSearchQ] = useState('');

    const matterId = tree.kind === 'matter' || tree.kind === 'folder' ? tree.matterId : null;
    const folderId = tree.kind === 'folder' ? tree.folderId : null;

    const browse = useLoad(
        matterId && mode === 'browse' ? () => filesApi.browse(matterId, folderId) : null,
        [matterId, folderId, mode],
    );
    const favorites = useLoad(mode === 'favorites' ? () => filesApi.favorites() : null, [mode]);
    const recent = useLoad(mode === 'recent' ? () => filesApi.recent() : null, [mode]);
    const search = useLoad(
        mode === 'search' && searchQ.trim()
            ? () => filesApi.search({ q: searchQ.trim() })
            : null,
        [mode, searchQ],
    );

    useEffect(() => subscribeDmsClipboard(() => setClipVersion((n) => n + 1)), []);

    useEffect(() => {
        if (browse.data?.folders && matterId) {
            setFolderCache((prev) => ({ ...prev, [matterId]: browse.data!.folders }));
        }
    }, [browse.data, matterId]);

    useEffect(() => {
        setSelected(null);
    }, [matterId, folderId, mode]);

    useEffect(() => {
        let revoked: string | null = null;
        const run = async () => {
            if (!previewOn || selected?.kind !== 'document') {
                setPreviewUrl(null);
                return;
            }
            try {
                const blob = await filesApi.contentBlob(selected.doc.id, { inline: true });
                const url = URL.createObjectURL(blob);
                revoked = url;
                setPreviewUrl(url);
            } catch {
                setPreviewUrl(null);
            }
        };
        void run();
        return () => {
            if (revoked)
                URL.revokeObjectURL(revoked);
        };
    }, [selected, previewOn]);

    const setFlash = (text: string, kind: '' | 'ok' | 'error' = 'ok') => {
        setStatus(text);
        setStatusKind(kind);
    };

    const foldersHere = useMemo(() => {
        if (!browse.data || mode !== 'browse')
            return [];
        return browse.data.folders
            .filter((folder) => folder.parentId === (folderId ?? null))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [browse.data, folderId, mode]);

    const documentsHere = useMemo(() => {
        if (mode === 'favorites')
            return favorites.data?.documents ?? [];
        if (mode === 'recent')
            return recent.data?.documents ?? [];
        if (mode === 'search')
            return search.data?.documents ?? [];
        return [...(browse.data?.documents ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    }, [mode, favorites.data, recent.data, search.data, browse.data]);

    const q = filter.trim().toLowerCase();
    const visibleFolders = foldersHere.filter((folder) => !q || folder.name.toLowerCase().includes(q));
    const visibleDocs = documentsHere.filter((doc) => !q || doc.name.toLowerCase().includes(q));

    const selectedDocs = selected?.kind === 'document' ? [selected.doc] : [];
    const selectedFolders = selected?.kind === 'folder' ? [selected.folder] : [];
    const hasDoc = selected?.kind === 'document';
    const hasFolder = selected?.kind === 'folder';
    const hasTarget = Boolean(matterId);
    const clip = getDmsClipboard();
    void clipVersion;

    const reloadBrowse = () => {
        browse.reload();
        favorites.reload();
        recent.reload();
        search.reload();
        clients.reload();
    };

    const needFolders = async (id: string) => {
        if (folderCache[id])
            return;
        try {
            const data = await filesApi.browse(id, null);
            setFolderCache((prev) => ({ ...prev, [id]: data.folders }));
        } catch (error) {
            notify(error instanceof Error ? error.message : String(error), 'error');
        }
    };

    const crumbs = useMemo(() => {
        if (!browse.data || mode !== 'browse')
            return [] as Array<{ id: string | null; label: string }>;
        return [
            { id: null, label: browse.data.client.name },
            { id: 'matter', label: browse.data.matter.name },
            ...browse.data.path.map((crumb) => ({ id: crumb.id, label: crumb.name })),
        ];
    }, [browse.data, mode]);

    const run = async (label: string, task: () => Promise<void>) => {
        const ok = await act(async () => {
            await task();
            return true;
        }, label);
        if (ok) {
            setFlash(label, 'ok');
            reloadBrowse();
        }
    };

    const ribbonGroups = [
        {
            title: 'Clipboard',
            actions: [
                {
                    id: 'paste',
                    label: 'Paste',
                    icon: 'download' as const,
                    disabled: !hasTarget || !clip?.items.length,
                    onClick: () => void run('Pasted', async () => {
                        const count = await pasteClipboard(matterId!, folderId);
                        if (!count)
                            throw new Error('Нечего вставлять');
                    }),
                },
                {
                    id: 'copy',
                    label: 'Copy',
                    icon: 'link' as const,
                    disabled: !hasDoc && !hasFolder,
                    onClick: () => {
                        if (!matterId)
                            return;
                        clipboardFromSelection({
                            mode: 'copy',
                            matterId,
                            folderId,
                            documents: selectedDocs,
                            folders: selectedFolders,
                        });
                        setFlash('Copied', 'ok');
                    },
                },
                {
                    id: 'cut',
                    label: 'Cut',
                    icon: 'edit' as const,
                    disabled: !hasDoc && !hasFolder,
                    onClick: () => {
                        if (!matterId)
                            return;
                        clipboardFromSelection({
                            mode: 'cut',
                            matterId,
                            folderId,
                            documents: selectedDocs,
                            folders: selectedFolders,
                        });
                        setFlash('Cut', 'ok');
                    },
                },
                {
                    id: 'copyLink',
                    label: 'Copy as Link',
                    icon: 'link' as const,
                    disabled: !hasDoc || !matterId,
                    onClick: () => void run('Link copied', async () => {
                        await copyText(documentDeepLink(matterId!, folderId, selectedDocs[0].id));
                    }),
                },
            ],
        },
        {
            title: 'Favorites',
            actions: [
                {
                    id: 'fav',
                    label: 'Add to Favorites',
                    icon: 'star' as const,
                    disabled: !hasDoc && !hasFolder && tree.kind !== 'matter',
                    onClick: () => void run('Favorite saved', async () => {
                        if (hasDoc)
                            await filesApi.addFavorite('document', selectedDocs[0].id, matterId ?? '');
                        else if (hasFolder)
                            await filesApi.addFavorite('folder', selectedFolders[0].id, matterId ?? '');
                        else if (tree.kind === 'matter')
                            await filesApi.addFavorite('matter', tree.matterId);
                    }),
                },
            ],
        },
        {
            title: 'Open',
            actions: [
                {
                    id: 'open',
                    label: 'Open',
                    icon: 'folderOpen' as const,
                    disabled: !hasDoc,
                    onClick: () => void run('Opened', async () => {
                        await openDocument(selectedDocs[0]);
                    }),
                },
                {
                    id: 'versions',
                    label: 'Version History',
                    icon: 'clock' as const,
                    disabled: !hasDoc,
                    active: previewOn && hasDoc,
                    onClick: () => {
                        setPreviewOn(true);
                        setFlash('Preview / versions on the right', 'ok');
                    },
                },
            ],
        },
        {
            title: 'Check Out',
            actions: [
                {
                    id: 'checkout',
                    label: 'Check Out',
                    icon: 'lock' as const,
                    disabled: !hasDoc,
                    onClick: () => void run('Checked out', async () => {
                        await filesApi.checkout(selectedDocs[0].id);
                    }),
                },
                {
                    id: 'checkin',
                    label: 'Check In',
                    icon: 'upload' as const,
                    disabled: !hasDoc,
                    onClick: () => void run('Checked in', async () => {
                        await filesApi.checkin(selectedDocs[0].id, null, 'DMS check-in');
                    }),
                },
                {
                    id: 'discard',
                    label: 'Discard Check Out',
                    icon: 'x' as const,
                    disabled: !hasDoc,
                    onClick: () => void run('Checkout discarded', async () => {
                        await filesApi.discardCheckout(selectedDocs[0].id);
                    }),
                },
            ],
        },
        {
            title: 'Manage',
            actions: [
                {
                    id: 'props',
                    label: 'Properties',
                    icon: 'list' as const,
                    disabled: !hasDoc && !hasFolder,
                    onClick: () => {
                        setPreviewOn(true);
                        setFlash(hasDoc ? selectedDocs[0].name : selectedFolders[0].name, 'ok');
                    },
                },
                {
                    id: 'acl',
                    label: 'Manage Permissions',
                    icon: 'shield' as const,
                    disabled: !matterId,
                    onClick: () => setSecurityOpen(true),
                },
                {
                    id: 'rename',
                    label: 'Rename',
                    icon: 'edit' as const,
                    disabled: !hasDoc && !hasFolder,
                    onClick: () => {
                        setRenameValue(hasDoc ? selectedDocs[0].name : selectedFolders[0].name);
                        setRenameOpen(true);
                    },
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    icon: 'trash' as const,
                    disabled: !hasDoc && !hasFolder,
                    onClick: () => setConfirmDelete(true),
                },
            ],
        },
        {
            title: 'Share',
            actions: [
                {
                    id: 'download',
                    label: 'Download',
                    icon: 'download' as const,
                    disabled: !hasDoc,
                    onClick: () => void run('Downloaded', async () => {
                        await downloadDocument(selectedDocs[0]);
                    }),
                },
                {
                    id: 'sendAtt',
                    label: 'Send Attachment',
                    icon: 'upload' as const,
                    disabled: !hasDoc,
                    onClick: () => void run('Outlook compose', async () => {
                        await sendDocumentAttachment(selectedDocs[0]);
                    }),
                },
                {
                    id: 'sendLink',
                    label: 'Send Link',
                    icon: 'link' as const,
                    disabled: !hasDoc || !matterId,
                    onClick: () => void run('Mail draft', async () => {
                        await sendDocumentLink(selectedDocs[0], matterId!, folderId);
                    }),
                },
                {
                    id: 'print',
                    label: 'Print',
                    icon: 'eye' as const,
                    disabled: !hasDoc,
                    onClick: () => void run('Print', async () => {
                        await printDocument(selectedDocs[0]);
                    }),
                },
            ],
        },
    ];

    const data = clients.data;
    const treeFolders = matterId ? (folderCache[matterId] ?? browse.data?.folders ?? []) : [];

    return (
        <div className="dms">
            <DmsRibbon mode={mode} onMode={setMode} groups={ribbonGroups} />
            <div className={previewOn ? 'dms-body' : 'dms-body is-preview-off'}>
                {data ? (
                    <DmsTree
                        clients={data}
                        folders={treeFolders}
                        selection={tree}
                        onSelect={(next) => {
                            setMode('browse');
                            setTree(next);
                        }}
                        onNeedFolders={(id) => {
                            void needFolders(id);
                        }}
                    />
                ) : (
                    <aside className="dms-tree">
                        <StateBlock loading={clients.loading} error={clients.error} onRetry={clients.reload} />
                    </aside>
                )}

                <section className="dms-main">
                    {mode === 'browse' && crumbs.length ? (
                        <div className="dms-crumbs">
                            {crumbs.map((crumb, index) => (
                                <span key={`${crumb.id}-${index}`}>
                                    {index > 0 ? ' › ' : null}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!matterId || !tree || tree.kind === 'root' || tree.kind === 'client')
                                                return;
                                            if (crumb.id === null) {
                                                setTree({ kind: 'client', clientId: tree.clientId });
                                                return;
                                            }
                                            if (crumb.id === 'matter') {
                                                setTree({ kind: 'matter', clientId: tree.clientId, matterId });
                                                return;
                                            }
                                            setTree({
                                                kind: 'folder',
                                                clientId: tree.clientId,
                                                matterId,
                                                folderId: crumb.id,
                                            });
                                        }}
                                    >
                                        {crumb.label}
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="dms-crumbs">{mode.toUpperCase()}</div>
                    )}

                    <div className="dms-toolbar">
                        {mode === 'search' ? (
                            <input
                                value={searchQ}
                                onChange={(event) => setSearchQ(event.target.value)}
                                placeholder="Search documents…"
                                style={{ minWidth: '14rem' }}
                            />
                        ) : (
                            <input
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                                placeholder="Filter…"
                            />
                        )}
                        <button type="button" className="dms-toolbar__btn" onClick={() => setFilter('')}>Clear</button>
                        <button
                            type="button"
                            className={previewOn ? 'dms-toolbar__btn is-on' : 'dms-toolbar__btn'}
                            onClick={() => setPreviewOn((value) => !value)}
                        >
                            Preview
                        </button>
                        <button type="button" className="dms-toolbar__btn" onClick={reloadBrowse}>Refresh</button>
                    </div>

                    <div className="dms-table-wrap">
                        <StateBlock
                            loading={(mode === 'browse' && browse.loading && !browse.data)
                                || (mode === 'favorites' && favorites.loading)
                                || (mode === 'recent' && recent.loading)
                                || (mode === 'search' && search.loading)}
                            error={mode === 'browse' ? browse.error : mode === 'favorites' ? favorites.error : mode === 'recent' ? recent.error : search.error}
                            onRetry={reloadBrowse}
                            empty={!visibleFolders.length && !visibleDocs.length ? <p className="dms-empty">{tr('table.noResults')}</p> : undefined}
                        >
                            <table className="dms-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Modified</th>
                                        <th>Modified By</th>
                                        <th>Size</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mode === 'browse' ? visibleFolders.map((folder) => (
                                        <tr
                                            key={`f:${folder.id}`}
                                            className={selected?.kind === 'folder' && selected.folder.id === folder.id ? 'is-on' : undefined}
                                            onClick={() => setSelected({ kind: 'folder', folder })}
                                            onDoubleClick={() => {
                                                if (tree.kind === 'matter' || tree.kind === 'folder') {
                                                    setTree({
                                                        kind: 'folder',
                                                        clientId: tree.clientId,
                                                        matterId: tree.matterId,
                                                        folderId: folder.id,
                                                    });
                                                }
                                            }}
                                        >
                                            <td>
                                                <span className="dms-name">
                                                    <Icon name="folder" className="fm-ico--folder" />
                                                    <strong>{folder.name}</strong>
                                                </span>
                                            </td>
                                            <td>{formatDateTime(folder.createdAt, locale)}</td>
                                            <td>—</td>
                                            <td className="fm-muted">{folder.documents}</td>
                                        </tr>
                                    )) : null}
                                    {visibleDocs.map((doc) => (
                                        <tr
                                            key={doc.id}
                                            className={selected?.kind === 'document' && selected.doc.id === doc.id ? 'is-on' : undefined}
                                            onClick={() => setSelected({ kind: 'document', doc })}
                                            onDoubleClick={() => void openDocument(doc)}
                                        >
                                            <td>
                                                <span className="dms-name">
                                                    <FileBadge kind={doc.kind} />
                                                    <strong>{doc.name}</strong>
                                                </span>
                                            </td>
                                            <td>{formatDateTime(doc.lastActivityAt ?? doc.updatedAt, locale)}</td>
                                            <td>{doc.updatedBy || doc.createdBy}</td>
                                            <td>{formatBytes(doc.sizeBytes, locale)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </StateBlock>
                    </div>
                </section>

                {previewOn ? (
                    <aside className="dms-preview">
                        {selected?.kind === 'document' ? (
                            <>
                                <div className="dms-preview__head">
                                    <strong>{selected.doc.name}</strong>
                                    <div className="dms-preview__meta">
                                        v{selected.doc.version} · {formatBytes(selected.doc.sizeBytes, locale)} · {selected.doc.docNumber}
                                    </div>
                                </div>
                                {previewUrl ? (
                                    <iframe className="dms-preview__frame" title={selected.doc.name} src={previewUrl} />
                                ) : (
                                    <p className="dms-preview__empty">Preview unavailable for this file type.</p>
                                )}
                            </>
                        ) : selected?.kind === 'folder' ? (
                            <div className="dms-preview__head">
                                <strong>{selected.folder.name}</strong>
                                <div className="dms-preview__meta">Folder · {selected.folder.documents} docs</div>
                            </div>
                        ) : (
                            <p className="dms-preview__empty">Select a document to preview.</p>
                        )}
                    </aside>
                ) : null}
            </div>
            <div className={statusKind ? `dms-status is-${statusKind}` : 'dms-status'}>
                {status || 'Kosta DMS Explorer'}
                {clip?.items.length ? ` · Clipboard: ${clip.mode} (${clip.items.length})` : ''}
            </div>

            {renameOpen ? (
                <Modal title="Rename" onClose={() => setRenameOpen(false)} footer={(
                    <>
                        <button type="button" className="fm-btn" onClick={() => setRenameOpen(false)}>Cancel</button>
                        <button
                            type="button"
                            className="fm-btn fm-btn--primary"
                            onClick={() => void run('Renamed', async () => {
                                if (hasDoc)
                                    await filesApi.updateDocument(selectedDocs[0].id, { name: renameValue.trim() });
                                else if (hasFolder)
                                    await filesApi.updateFolder(selectedFolders[0].id, { name: renameValue.trim() });
                                setRenameOpen(false);
                            })}
                        >
                            Save
                        </button>
                    </>
                )}
                >
                    <label className="fm-field">
                        <span>Name</span>
                        <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                    </label>
                </Modal>
            ) : null}

            {confirmDelete ? (
                <ConfirmModal
                    title="Delete"
                    text={`Delete «${hasDoc ? selectedDocs[0].name : selectedFolders[0].name}»?`}
                    confirmLabel="Delete"
                    danger
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={async () => {
                        await run('Deleted', async () => {
                            if (hasDoc)
                                await filesApi.deleteDocument(selectedDocs[0].id);
                            else if (hasFolder)
                                await filesApi.deleteFolder(selectedFolders[0].id);
                            setSelected(null);
                            setConfirmDelete(false);
                        });
                    }}
                />
            ) : null}

            {securityOpen && data && matterId ? (
                <Modal title="Manage Permissions" onClose={() => setSecurityOpen(false)} wide>
                    <div className="dms-modal-security">
                        <SecurityView
                            clients={data}
                            matterId={matterId}
                            onPickMatter={() => undefined}
                        />
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}

export function DmsExplorerPage() {
    useEffect(() => {
        document.body.classList.add('dms-shell');
        document.documentElement.dataset.theme = 'dark';
        return () => {
            document.body.classList.remove('dms-shell');
        };
    }, []);

    return (
        <ToastHost>
            <DmsExplorerWorkspace />
        </ToastHost>
    );
}

export type { ClientsResponse };
