import { useEffect, useRef, useState } from 'react';
import { filesApi, type DocumentDetail, type DocumentRow, type FolderRow } from '../api/filesApi';
import { canEdit, formatBytes, formatDateTime, previewMode } from '../lib/filesFormat';
import { ConfirmModal, FileBadge, Icon, LevelBadge, Modal, StateBlock, saveBlob, useAction, useFm, useLoad } from './fmShared';

export const DOC_TYPES = ['agreement', 'correspondence', 'pleading', 'memo', 'corporate', 'poa', 'evidence', 'invoice', 'other'] as const;

type Tab = 'preview' | 'properties' | 'versions' | 'activity';

type Props = {
    documentId: string;
    viewerId: number;
    folders?: readonly FolderRow[];
    onChanged: (doc: DocumentRow) => void;
    onDeleted: (documentId: string) => void;
    onClose: () => void;
    onLocate?: (doc: DocumentRow) => void;
};

function Preview({ detail }: { detail: DocumentDetail }) {
    const { tr } = useFm();
    const doc = detail.document;
    const mode = previewMode(doc.kind, doc.contentType);
    const [url, setUrl] = useState<string | null>(null);
    const [text, setText] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (mode === null)
            return;
        let alive = true;
        let objectUrl: string | null = null;
        setUrl(null);
        setText(null);
        setError(false);
        filesApi.contentBlob(doc.id, { inline: true }).then(async (blob) => {
            if (!alive)
                return;
            if (mode === 'text') {
                setText((await blob.slice(0, 200_000).text()));
                return;
            }
            objectUrl = URL.createObjectURL(mode === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob);
            setUrl(objectUrl);
        }, () => {
            if (alive)
                setError(true);
        });
        return () => {
            alive = false;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [doc.id, doc.version, mode]);

    if (mode === null || error) {
        return (
            <div className="fm-preview fm-preview--empty">
                <FileBadge kind={doc.kind} />
                <p>{tr('pane.noPreview')}</p>
            </div>
        );
    }
    if (mode === 'text')
        return text === null ? <StateBlock loading error={null} /> : <pre className="fm-preview fm-preview--text">{text}</pre>;
    if (url === null)
        return <StateBlock loading error={null} />;
    if (mode === 'image')
        return <div className="fm-preview fm-preview--image"><img src={url} alt={doc.name} /></div>;
    return <iframe className="fm-preview fm-preview--pdf" src={url} title={doc.name} />;
}

function Properties({ detail, folders, editable, onSaved }: {
    detail: DocumentDetail;
    folders: readonly FolderRow[];
    editable: boolean;
    onSaved: (doc: DocumentRow) => void;
}) {
    const { tr, locale } = useFm();
    const act = useAction();
    const doc = detail.document;
    const [name, setName] = useState(doc.name);
    const [docType, setDocType] = useState(doc.docType);
    const [description, setDescription] = useState(doc.description);
    const [folderId, setFolderId] = useState(doc.folderId ?? '');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setName(doc.name);
        setDocType(doc.docType);
        setDescription(doc.description);
        setFolderId(doc.folderId ?? '');
    }, [doc.id, doc.name, doc.docType, doc.description, doc.folderId]);

    const dirty = name.trim() !== doc.name || docType !== doc.docType || description !== doc.description
        || folderId !== (doc.folderId ?? '');

    const save = async () => {
        setBusy(true);
        const patch: Parameters<typeof filesApi.updateDocument>[1] = {};
        if (name.trim() !== doc.name)
            patch.name = name.trim();
        if (docType !== doc.docType)
            patch.docType = docType;
        if (description !== doc.description)
            patch.description = description;
        if (folderId !== (doc.folderId ?? '')) {
            if (folderId)
                patch.folderId = folderId;
            else
                patch.moveToRoot = true;
        }
        const result = await act(() => filesApi.updateDocument(doc.id, patch), tr('pane.saved'));
        setBusy(false);
        if (result)
            onSaved(result.document);
    };

    const location = [doc.clientName, doc.matterName, ...detail.path.map((crumb) => crumb.name)].filter(Boolean).join(' › ');
    const folderOptions = folders.map((folder) => {
        const depth = folderDepth(folders, folder);
        return { id: folder.id, label: `${'\u00a0\u00a0'.repeat(depth)}${folder.name}` };
    });

    return (
        <div className="fm-props">
            <dl className="fm-props__facts">
                <dt>{tr('pane.docNumber')}</dt><dd>{doc.docNumber}</dd>
                <dt>{tr('pane.location')}</dt><dd>{location}</dd>
                <dt>{tr('pane.created')}</dt><dd>{formatDateTime(doc.createdAt, locale)} · {doc.createdBy}</dd>
                <dt>{tr('pane.modified')}</dt><dd>{formatDateTime(doc.updatedAt, locale)} · {doc.updatedBy}</dd>
                <dt>{tr('pane.size')}</dt><dd>{formatBytes(doc.sizeBytes, locale)} · v{doc.version}</dd>
                {doc.checkedOutBy ? <><dt>{tr('pane.checkedOut')}</dt><dd>{doc.checkedOutBy} · {formatDateTime(doc.checkedOutAt, locale)}</dd></> : null}
            </dl>
            <label className="fm-field">
                <span>{tr('common.name')}</span>
                <input value={name} disabled={!editable} maxLength={300} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="fm-field">
                <span>{tr('pane.docType')}</span>
                <select value={docType} disabled={!editable} onChange={(event) => setDocType(event.target.value)}>
                    <option value="">{tr('docTypes.none')}</option>
                    {DOC_TYPES.map((type) => <option key={type} value={type}>{tr(`docTypes.${type}`)}</option>)}
                </select>
            </label>
            {folders.length > 0 ? (
                <label className="fm-field">
                    <span>{tr('pane.move')}</span>
                    <select value={folderId} disabled={!editable} onChange={(event) => setFolderId(event.target.value)}>
                        <option value="">{tr('tree.root')}</option>
                        {folderOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                </label>
            ) : null}
            <label className="fm-field">
                <span>{tr('pane.description')}</span>
                <textarea rows={4} value={description} disabled={!editable} maxLength={4000}
                    onChange={(event) => setDescription(event.target.value)} />
            </label>
            {editable ? (
                <button type="button" className="fm-btn fm-btn--primary" disabled={!dirty || busy || !name.trim()} onClick={save}>
                    {tr('common.save')}
                </button>
            ) : null}
        </div>
    );
}

function folderDepth(folders: readonly FolderRow[], folder: FolderRow): number {
    const byId = new Map(folders.map((row) => [row.id, row]));
    let depth = 0;
    let current = folder.parentId;
    while (current && depth < 20) {
        depth += 1;
        current = byId.get(current)?.parentId ?? null;
    }
    return depth;
}

function CheckinModal({ doc, onClose, onDone }: { doc: DocumentRow; onClose: () => void; onDone: (doc: DocumentRow) => void }) {
    const { tr } = useFm();
    const act = useAction();
    const [file, setFile] = useState<File | null>(null);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <Modal title={tr('pane.checkin')} onClose={onClose} footer={(
            <>
                <button type="button" className="fm-btn" onClick={onClose}>{tr('common.cancel')}</button>
                <button type="button" className="fm-btn fm-btn--primary" disabled={busy} onClick={async () => {
                    setBusy(true);
                    const result = await act(() => filesApi.checkin(doc.id, file, comment), tr('pane.saved'));
                    setBusy(false);
                    if (result) {
                        onDone(result.document);
                        onClose();
                    }
                }}>{file ? tr('pane.checkinWithFile') : tr('pane.checkin')}</button>
            </>
        )}>
            <p className="fm-modal__text"><strong>{doc.name}</strong> · v{doc.version}</p>
            <label className="fm-field">
                <span>{tr('pane.checkinWithFile')}</span>
                <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <label className="fm-field">
                <span>{tr('pane.comment')}</span>
                <textarea rows={3} value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} />
            </label>
        </Modal>
    );
}

export function DocumentPane({ documentId, viewerId, folders = [], onChanged, onDeleted, onClose, onLocate }: Props) {
    const { tr, locale } = useFm();
    const act = useAction();
    const [tab, setTab] = useState<Tab>('preview');
    const [checkin, setCheckin] = useState(false);
    const [confirm, setConfirm] = useState<'delete' | { version: number } | null>(null);
    const detail = useLoad(() => filesApi.document(documentId), [documentId]);
    const paneRef = useRef<HTMLElement>(null);

    useEffect(() => {
        paneRef.current?.scrollTo({ top: 0 });
    }, [documentId]);

    const apply = (doc: DocumentRow) => {
        onChanged(doc);
        detail.reload();
    };

    const data = detail.data;
    const doc = data?.document;
    const editable = Boolean(data && canEdit(data.level));
    const mine = doc?.checkedOutById === viewerId;
    const lockedByOther = Boolean(doc && doc.checkedOutById !== null && !mine);
    const canOverride = data?.level === 'manage';

    const download = async (version?: number) => {
        if (!doc)
            return;
        const blob = await act(() => filesApi.contentBlob(doc.id, { version }));
        if (blob)
            await saveBlob(blob, version && version !== doc.version ? `v${version} ${doc.name}` : doc.name);
    };

    const openInTab = async () => {
        if (!doc)
            return;
        const popup = window.open('', '_blank');
        const blob = await act(() => filesApi.contentBlob(doc.id, { inline: true }));
        if (!blob || !popup) {
            popup?.close();
            return;
        }
        popup.location.href = URL.createObjectURL(blob);
    };

    const copyLink = async () => {
        if (!doc)
            return;
        const url = new URL(window.location.href);
        url.search = new URLSearchParams({ view: 'matter', matter: doc.matterId, ...(doc.folderId ? { folder: doc.folderId } : {}), doc: doc.id }).toString();
        await act(() => navigator.clipboard.writeText(url.toString()), tr('pane.linkCopied'));
    };

    const toggleFavorite = async () => {
        if (!doc)
            return;
        const ok = await act(() => (doc.favorite ? filesApi.removeFavorite('document', doc.id) : filesApi.addFavorite('document', doc.id, doc.matterId)));
        if (ok)
            apply({ ...doc, favorite: !doc.favorite });
    };

    return (
        <aside className="fm-pane" ref={paneRef} aria-label={tr('pane.properties')}>
            <StateBlock loading={detail.loading && !data} error={detail.error} onRetry={detail.reload}>
                {doc && data ? (
                    <>
                        <header className="fm-pane__head">
                            <FileBadge kind={doc.kind} />
                            <div>
                                <h3 title={doc.name}>{doc.name}</h3>
                                <p>{doc.docNumber} · v{doc.version} · {formatBytes(doc.sizeBytes, locale)} · <LevelBadge level={data.level} /></p>
                            </div>
                            <button type="button" className="fm-icon-btn" aria-label={tr('common.close')} onClick={onClose}><Icon name="close" /></button>
                        </header>
                        {doc.checkedOutBy ? (
                            <div className={lockedByOther ? 'fm-banner fm-banner--warn' : 'fm-banner'}>
                                <Icon name="lock" />
                                {lockedByOther ? tr('pane.lockedNotice', { name: doc.checkedOutBy }) : tr('table.checkedOutMe')}
                            </div>
                        ) : null}
                        <div className="fm-pane__actions">
                            <button type="button" className="fm-btn fm-btn--primary" onClick={() => download()}><Icon name="download" />{tr('pane.download')}</button>
                            <button type="button" className="fm-btn" onClick={openInTab}><Icon name="eye" />{tr('pane.open')}</button>
                            {editable && doc.checkedOutById === null ? (
                                <button type="button" className="fm-btn" onClick={async () => {
                                    const result = await act(() => filesApi.checkout(doc.id));
                                    if (result)
                                        apply(result.document);
                                }}><Icon name="lock" />{tr('pane.checkout')}</button>
                            ) : null}
                            {editable && doc.checkedOutById !== null && (mine || canOverride) ? (
                                <>
                                    <button type="button" className="fm-btn" onClick={() => setCheckin(true)}><Icon name="upload" />{tr('pane.checkin')}</button>
                                    <button type="button" className="fm-btn" onClick={async () => {
                                        const result = await act(() => filesApi.discardCheckout(doc.id));
                                        if (result)
                                            apply(result.document);
                                    }}>{tr('pane.discard')}</button>
                                </>
                            ) : null}
                            <button type="button" className={doc.favorite ? 'fm-icon-btn fm-star is-on' : 'fm-icon-btn fm-star'}
                                aria-pressed={doc.favorite} title={tr(doc.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')}
                                aria-label={tr(doc.favorite ? 'pane.favoriteRemove' : 'pane.favoriteAdd')} onClick={toggleFavorite}>
                                <Icon name="star" />
                            </button>
                            <button type="button" className="fm-icon-btn" title={tr('pane.copyLink')} aria-label={tr('pane.copyLink')} onClick={copyLink}>
                                <Icon name="link" />
                            </button>
                            {onLocate ? (
                                <button type="button" className="fm-icon-btn" title={tr('lists.openMatter')} aria-label={tr('lists.openMatter')} onClick={() => onLocate(doc)}>
                                    <Icon name="folderOpen" />
                                </button>
                            ) : null}
                            {editable && (!lockedByOther || canOverride) ? (
                                <button type="button" className="fm-icon-btn fm-icon-btn--danger" title={tr('pane.delete')} aria-label={tr('pane.delete')}
                                    onClick={() => setConfirm('delete')}>
                                    <Icon name="trash" />
                                </button>
                            ) : null}
                        </div>
                        <nav className="fm-tabs" role="tablist">
                            {(['preview', 'properties', 'versions', 'activity'] as const).map((id) => (
                                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
                                    {tr(`pane.${id}`)}
                                    {id === 'versions' ? <em>{data.versions.length}</em> : null}
                                </button>
                            ))}
                        </nav>
                        <div className="fm-pane__body">
                            {tab === 'preview' ? <Preview detail={data} /> : null}
                            {tab === 'properties' ? (
                                <Properties detail={data} folders={folders} editable={editable && (!lockedByOther || canOverride)} onSaved={apply} />
                            ) : null}
                            {tab === 'versions' ? (
                                <ol className="fm-versions">
                                    {data.versions.map((version) => (
                                        <li key={version.version} className={version.version === doc.version ? 'is-current' : undefined}>
                                            <div>
                                                <strong>v{version.version}</strong>
                                                {version.version === doc.version ? <em>{tr('pane.current')}</em> : null}
                                                <span>{formatBytes(version.sizeBytes, locale)}</span>
                                            </div>
                                            <p>{formatDateTime(version.createdAt, locale)} · {version.createdBy}</p>
                                            {version.comment ? <blockquote>{version.comment}</blockquote> : null}
                                            <div className="fm-versions__actions">
                                                <button type="button" className="fm-link" onClick={() => download(version.version)}>{tr('pane.download')}</button>
                                                {editable && version.version !== doc.version && !lockedByOther ? (
                                                    <button type="button" className="fm-link" onClick={() => setConfirm({ version: version.version })}>{tr('pane.restore')}</button>
                                                ) : null}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            ) : null}
                            {tab === 'activity' ? (
                                <ul className="fm-activity">
                                    {data.activity.map((row) => (
                                        <li key={row.id}>
                                            <span className={`fm-dot fm-dot--${row.action}`} aria-hidden />
                                            <div>
                                                <strong>{tr(`audit.actions.${row.action}`)}</strong>
                                                {row.detail ? <span> · {row.detail}</span> : null}
                                                <p>{row.userName} · {formatDateTime(row.at, locale)}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </>
                ) : null}
            </StateBlock>
            {checkin && doc ? <CheckinModal doc={doc} onClose={() => setCheckin(false)} onDone={apply} /> : null}
            {confirm === 'delete' && doc ? (
                <ConfirmModal title={tr('pane.delete')} text={tr('pane.deleteConfirm', { name: doc.name })} confirmLabel={tr('pane.delete')} danger
                    onClose={() => setConfirm(null)}
                    onConfirm={async () => {
                        const ok = await act(() => filesApi.deleteDocument(doc.id));
                        if (ok)
                            onDeleted(doc.id);
                    }} />
            ) : null}
            {confirm !== null && confirm !== 'delete' && doc ? (
                <ConfirmModal title={tr('pane.restore')} text={tr('pane.restoreConfirm', { version: confirm.version })} confirmLabel={tr('pane.restore')}
                    onClose={() => setConfirm(null)}
                    onConfirm={async () => {
                        const result = await act(() => filesApi.restoreVersion(doc.id, confirm.version));
                        if (result)
                            apply(result.document);
                    }} />
            ) : null}
        </aside>
    );
}
