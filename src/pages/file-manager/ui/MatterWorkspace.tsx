import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { filesApi, type DocumentRow, type FolderRow } from '../api/filesApi';
import { canEdit, canManage, dateRange, documentDay, formatBytes, inDateRange, isMailName, summarizeUpload, type DateFilter, type DatePreset } from '../lib/filesFormat';
import { CHUNKED_THRESHOLD } from '../lib/chunkedUpload';
import { enqueueUploads, onUploadDone } from '../lib/uploadQueue';
import { DuplicatesModal } from './DuplicatesModal';
import { DOC_DRAG_TYPE } from './DocumentTable';
import { DocumentAccessDrawer } from './DocumentAccessDrawer';
import { DocumentPane } from './DocumentPane';
import { FolderAccessDrawer } from './FolderAccessDrawer';
import './MatterWorkspace.css';
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

const DATE_FILTER_KEY = 'fm.matter.dateFilter';
const LAYOUT_KEY = 'fm.matter.layout';

type Layout = 'tiles' | 'list';

function readLayout(): Layout {
    try {
        return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'tiles';
    } catch {
        return 'tiles';
    }
}
const DATE_PRESETS: DatePreset[] = ['all', 'today', 'week', 'month', 'thisMonth', 'custom'];
const PRESET_LABEL: Record<DatePreset, string> = {
    all: 'browser.dateAll',
    today: 'browser.dateToday',
    week: 'browser.dateWeek',
    month: 'browser.dateMonth',
    thisMonth: 'browser.dateThisMonth',
    custom: 'browser.dateCustom',
};

function readDateFilter(): DateFilter {
    try {
        const raw = JSON.parse(localStorage.getItem(DATE_FILTER_KEY) || '{}') as Partial<DateFilter>;
        const preset = DATE_PRESETS.includes(raw.preset as DatePreset) ? raw.preset as DatePreset : 'all';
        const day = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');
        return { preset, from: day(raw.from), to: day(raw.to) };
    } catch {
        return { preset: 'all', from: '', to: '' };
    }
}

function formatDay(day: string, locale: string): string {
    if (!day)
        return '';
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function isEmailsFolder(folder: FolderRow | null, folders: readonly FolderRow[]): boolean {
    if (!folder || folder.name.trim().toLowerCase() !== 'emails')
        return false;
    const parent = folders.find((row) => row.id === folder.parentId);
    return parent?.name.trim().toLowerCase() === 'correspondence';
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
    const [dateFilter, setDateFilter] = useState<DateFilter>(readDateFilter);
    const [organizing, setOrganizing] = useState(false);
    const [duplicatesOpen, setDuplicatesOpen] = useState(false);
    const [copyPrompt, setCopyPrompt] = useState<{ files: File[]; text: string } | null>(null);
    const [layout, setLayout] = useState<Layout>(readLayout);
    const [accessFolderId, setAccessFolderId] = useState<string | null>(null);
    const [accessDocId, setAccessDocId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            localStorage.setItem(DATE_FILTER_KEY, JSON.stringify(dateFilter));
        } catch {
        }
    }, [dateFilter]);

    useEffect(() => {
        try {
            localStorage.setItem(LAYOUT_KEY, layout);
        } catch {
        }
    }, [layout]);

    const browse = useLoad(() => filesApi.browse(matterId, folderId), [matterId, folderId]);
    const data = browse.data && browse.data.matter.id === matterId ? browse.data : null;
    const folders = useMemo(() => data?.folders ?? [], [data]);
    const level = data?.matter.level ?? 'none';
    const editable = canEdit(level);
    const manager = canManage(level);
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

    const range = useMemo(() => dateRange(dateFilter), [dateFilter]);
    const dateActive = Boolean(range.from || range.to);
    const shownDocuments = useMemo(
        () => (dateActive ? documents.filter((doc) => inDateRange(documentDay(doc), range)) : documents),
        [documents, range, dateActive],
    );
    const looseLetters = useMemo(() => documents.filter((doc) => isMailName(doc.name)).length, [documents]);
    const canOrganize = editable && looseLetters > 0 && isEmailsFolder(currentFolder, folders);

    const organize = async () => {
        if (!folderId)
            return;
        setOrganizing(true);
        const result = await act(() => filesApi.organizeMail(matterId, folderId));
        setOrganizing(false);
        if (!result)
            return;
        notify(result.moved
            ? tr('browser.organizeDone', { moved: result.moved, folders: result.folders.join(', ') })
            : tr('browser.organizeNothing'));
        browse.reload();
    };

    useEffect(() => {
        setSelectedFolderId(null);
        setMenu(null);
    }, [matterId, folderId, docId]);

    useEffect(() => {
        setAccessFolderId(null);
        setAccessDocId(null);
    }, [matterId]);

    useEffect(() => {
        if (docId)
            setAccessFolderId(null);
    }, [docId]);

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

    const reloadBrowse = browse.reload;
    useEffect(() => onUploadDone((item) => {
        if (item.api !== 'files' || item.target.matterId !== matterId)
            return;
        if (item.result && (item.result.status === 'created' || item.result.status === 'version')) {
            reloadBrowse();
            onClientsStale();
        }
    }), [matterId, reloadBrowse, onClientsStale]);

    const goFolder = (next: string | null) => onNavigate({ matterId, folderId: next, docId: null });

    const upload = async (files: File[], allowDuplicate = false) => {
        const nonEmpty = files.filter((file) => file.size > 0);
        const large = nonEmpty.filter((file) => file.size > CHUNKED_THRESHOLD);
        if (large.length) {
            enqueueUploads(large, { matterId, folderId, allowDuplicate });
        }
        const sent = nonEmpty.filter((file) => file.size <= CHUNKED_THRESHOLD);
        if (sent.length === 0)
            return;
        const result = await act(() => filesApi.upload(matterId, folderId, sent, '', { allowDuplicate }));
        if (!result)
            return;
        const summary = summarizeUpload(result);
        const parts = [
            summary.created ? tr('browser.uploaded', { count: summary.created }) : '',
            summary.version ? tr('browser.uploadVersions', { count: summary.version }) : '',
            summary.unchanged ? tr('browser.uploadUnchanged', { count: summary.unchanged }) : '',
            summary.exists ? tr('browser.uploadExists', { count: summary.exists }) : '',
        ].filter(Boolean);
        if (parts.length)
            notify(parts.join(' · '));
        const duplicates = (result.results ?? [])
            .map((row, index) => ({ row, file: sent[index] }))
            .filter((pair): pair is { row: typeof pair.row; file: File } => pair.row.status === 'duplicate' && Boolean(pair.file));
        if (duplicates.length) {
            setCopyPrompt({
                files: duplicates.map((pair) => pair.file),
                text: tr('browser.uploadDuplicateAsk', {
                    list: duplicates.map((pair) => `«${pair.file.name}» = «${pair.row.document.name}»`).join(', '),
                }),
            });
        }
        if (summary.created || summary.version) {
            browse.reload();
            onClientsStale();
        }
        const changed = (result.results ?? []).filter((row) => row.status === 'created' || row.status === 'version');
        if (sent.length === 1 && (changed.length === 1 || !result.results) && result.documents[0])
            onNavigate({ matterId, folderId, docId: result.documents[0].id });
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

    const rowClass = (on: boolean) => (on ? 'fm-ex__row is-on' : 'fm-ex__row');

    const folderHandlers = (folder: FolderRow) => ({
        onClick: (event: ReactMouseEvent<HTMLElement>) => {
            event.stopPropagation();
            setSelectedFolderId(folder.id);
            if (manager) {
                setAccessDocId(null);
                setAccessFolderId(folder.id);
                if (docId)
                    onNavigate({ matterId, folderId, docId: null });
            }
        },
        onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
            event.stopPropagation();
            goFolder(folder.id);
        },
        onContextMenu: (event: ReactMouseEvent<HTMLElement>) => openCtx(event, { kind: 'folder', folder }),
        onDragOver: editable ? (event: DragEvent<HTMLElement>) => {
            if (event.dataTransfer.types.includes(DOC_DRAG_TYPE))
                event.preventDefault();
        } : undefined,
        onDrop: editable ? (event: DragEvent<HTMLElement>) => {
            const id = event.dataTransfer.getData(DOC_DRAG_TYPE);
            if (id) {
                event.preventDefault();
                event.stopPropagation();
                void moveDoc(folder.id, id);
            }
        } : undefined,
    });

    const docHandlers = (doc: DocumentRow) => ({
        draggable: editable,
        onDragStart: editable ? (event: DragEvent<HTMLElement>) => {
            event.dataTransfer.setData(DOC_DRAG_TYPE, doc.id);
            event.dataTransfer.effectAllowed = 'move';
        } : undefined,
        onClick: (event: ReactMouseEvent<HTMLElement>) => {
            event.stopPropagation();
            setSelectedFolderId(null);
            setAccessFolderId(null);
            setAccessDocId(null);
            onNavigate({ matterId, folderId, docId: doc.id });
        },
        onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
            event.stopPropagation();
            onNavigate({ matterId, folderId, docId: doc.id });
        },
        onContextMenu: (event: ReactMouseEvent<HTMLElement>) => openCtx(event, { kind: 'document', doc }),
    });

    const canShareDoc = (doc: DocumentRow) => manager || Boolean(doc.access?.mine);

    const openDocAccess = (doc: DocumentRow) => {
        setAccessFolderId(null);
        setAccessDocId(doc.id);
    };

    const docBadge = (doc: DocumentRow) => {
        const info = doc.access;
        if (!info)
            return null;
        if (info.restricted) {
            return (
                <span className="fm-ex__access is-restricted" title={tr('docAccess.restrictedHint')}>
                    <Icon name="lock" /><span>{tr('docAccess.badgeRestricted')}</span>
                </span>
            );
        }
        if (info.entries > 0) {
            return (
                <span className="fm-ex__access is-custom" title={tr('docAccess.customHint')}>
                    <Icon name="key" /><span>{tr('docAccess.badgeCustom', { n: info.entries })}</span>
                </span>
            );
        }
        if (!info.mine && !manager && info.level === 'read') {
            return (
                <span className="fm-ex__access is-shared" title={tr('folderAccess.sharedHint')}>
                    <Icon name="eye" /><span>{tr('docAccess.badgeRead')}</span>
                </span>
            );
        }
        return null;
    };

    const folderBadge = (folder: FolderRow) => {
        const info = folder.access;
        if (!info)
            return null;
        if (manager && (info.entries > 0 || !info.inherit)) {
            return (
                <span className="fm-ex__access is-custom" title={tr('folderAccess.customHint')}>
                    <Icon name="lock" />
                    <span>{tr('folderAccess.custom')}</span>
                </span>
            );
        }
        if (!manager && (info.level === 'read' || info.level === 'edit')) {
            return (
                <span className="fm-ex__access is-shared" title={tr('folderAccess.sharedHint')}>
                    <Icon name="eye" />
                    <span>{info.level === 'edit' ? tr('folderAccess.sharedEdit') : tr('folderAccess.sharedRead')}</span>
                </span>
            );
        }
        return null;
    };

    const empty = subfolders.length === 0 && documents.length === 0;
    const filteredOut = !empty && dateActive && documents.length > 0 && shownDocuments.length === 0;

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
                {data ? (
                    <div className="fm-datebar" role="toolbar" aria-label={tr('browser.dateFilter')}>
                        <div className="fm-datebar__presets" role="group" title={tr('browser.dateHint')}>
                            {DATE_PRESETS.map((preset) => (
                                <button key={preset} type="button"
                                    className={dateFilter.preset === preset ? 'fm-datebar__chip is-on' : 'fm-datebar__chip'}
                                    aria-pressed={dateFilter.preset === preset}
                                    onClick={() => setDateFilter((prev) => ({ ...prev, preset }))}>
                                    {tr(PRESET_LABEL[preset])}
                                </button>
                            ))}
                        </div>
                        {dateFilter.preset === 'custom' ? (
                            <div className="fm-datebar__range">
                                <label>
                                    <span>{tr('browser.dateFrom')}</span>
                                    <input type="date" value={dateFilter.from} max={dateFilter.to || undefined}
                                        onChange={(event) => setDateFilter((prev) => ({ ...prev, from: event.target.value }))} />
                                </label>
                                <label>
                                    <span>{tr('browser.dateTo')}</span>
                                    <input type="date" value={dateFilter.to} min={dateFilter.from || undefined}
                                        onChange={(event) => setDateFilter((prev) => ({ ...prev, to: event.target.value }))} />
                                </label>
                            </div>
                        ) : null}
                        {dateActive ? (
                            <span className="fm-datebar__count">
                                {tr('browser.dateShown', { shown: shownDocuments.length, total: documents.length })}
                            </span>
                        ) : null}
                        <button type="button" className="fm-btn fm-datebar__dups" onClick={() => setDuplicatesOpen(true)}
                            title={tr('browser.duplicatesHint')}>
                            {tr('browser.duplicates')}
                        </button>
                        {manager && folderId ? (
                            <button type="button" className="fm-btn fm-datebar__access"
                                onClick={() => {
                                    setAccessFolderId(folderId);
                                    if (docId)
                                        onNavigate({ matterId, folderId, docId: null });
                                }}>
                                <Icon name="shield" />
                                {tr('folderAccess.button')}
                            </button>
                        ) : null}
                        <div className="fm-datebar__layout" role="group" aria-label={tr('browser.layout')}>
                            <button type="button" className={layout === 'tiles' ? 'is-on' : undefined} aria-pressed={layout === 'tiles'}
                                title={tr('browser.layoutTiles')} aria-label={tr('browser.layoutTiles')} onClick={() => setLayout('tiles')}>
                                <Icon name="grid" />
                            </button>
                            <button type="button" className={layout === 'list' ? 'is-on' : undefined} aria-pressed={layout === 'list'}
                                title={tr('browser.layoutList')} aria-label={tr('browser.layoutList')} onClick={() => setLayout('list')}>
                                <Icon name="list" />
                            </button>
                        </div>
                        {canOrganize ? (
                            <button type="button" className="fm-btn fm-datebar__organize" disabled={organizing}
                                title={tr('browser.organizeMailHint')} onClick={() => void organize()}>
                                <Icon name="folder" />
                                {tr('browser.organizeMail')}
                            </button>
                        ) : null}
                    </div>
                ) : null}
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
                                layout === 'list' ? (
                                    <div className="fm-ex__list-wrap">
                                        <table className="fm-ex__list">
                                            <thead>
                                                <tr>
                                                    <th>{tr('browser.colName')}</th>
                                                    <th className="fm-ex__col-type">{tr('browser.colType')}</th>
                                                    <th className="fm-ex__col-date">{tr('browser.colModified')}</th>
                                                    <th className="fm-ex__col-author">{tr('browser.colAuthor')}</th>
                                                    <th className="fm-ex__col-size">{tr('browser.colSize')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {folderId ? (
                                                    <tr className="fm-ex__row fm-ex__row--up" tabIndex={0}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            goFolder(parentId);
                                                        }}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter')
                                                                goFolder(parentId);
                                                        }}>
                                                        <td colSpan={5}>
                                                            <span className="fm-ex__row-name"><Icon name="up" /><strong>..</strong></span>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                {subfolders.map((folder) => (
                                                    <tr key={folder.id} tabIndex={0}
                                                        className={rowClass(selectedFolderId === folder.id || accessFolderId === folder.id)}
                                                        {...folderHandlers(folder)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter')
                                                                goFolder(folder.id);
                                                        }}>
                                                        <td>
                                                            <span className="fm-ex__row-name">
                                                                <Icon name="folder" className="fm-ico--folder" />
                                                                <span className="fm-ex__row-text"><strong title={folder.name}>{folder.name}</strong></span>
                                                                {folderBadge(folder)}
                                                            </span>
                                                        </td>
                                                        <td className="fm-ex__col-type">{tr('browser.folderType')}</td>
                                                        <td className="fm-ex__col-date">—</td>
                                                        <td className="fm-ex__col-author">—</td>
                                                        <td className="fm-ex__col-size">{tr('browser.filesCount', { n: folder.documents })}</td>
                                                    </tr>
                                                ))}
                                                {shownDocuments.map((doc) => {
                                                    const day = documentDay(doc);
                                                    const subject = isMailName(doc.name) ? doc.description.trim() : '';
                                                    return (
                                                        <tr key={doc.id} tabIndex={0} className={rowClass(docId === doc.id)}
                                                            {...docHandlers(doc)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter')
                                                                    onNavigate({ matterId, folderId, docId: doc.id });
                                                            }}>
                                                            <td>
                                                                <span className="fm-ex__row-name" title={[doc.name, subject].filter(Boolean).join('\n')}>
                                                                    <FileBadge kind={doc.kind} />
                                                                    <span className="fm-ex__row-text">
                                                                        <strong>{doc.name}</strong>
                                                                        {subject ? <small>{subject}</small> : null}
                                                                    </span>
                                                                    {docBadge(doc)}
                                                                    {doc.checkedOutById ? <Icon name="lock" className="fm-ex__row-lock" /> : null}
                                                                </span>
                                                            </td>
                                                            <td className="fm-ex__col-type">{kindLabel(doc.kind, tr)}{doc.version > 1 ? ` · v${doc.version}` : ''}</td>
                                                            <td className="fm-ex__col-date">{day ? formatDay(day, locale) : '—'}</td>
                                                            <td className="fm-ex__col-author">{doc.createdBy || '—'}</td>
                                                            <td className="fm-ex__col-size">{formatBytes(doc.sizeBytes, locale)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
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
                                            className={selectedFolderId === folder.id || accessFolderId === folder.id ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                            {...folderHandlers(folder)}>
                                            <span className="fm-ex__tile-ico" aria-hidden>
                                                <Icon name="folder" className="fm-ico--folder" />
                                            </span>
                                            <span className="fm-ex__tile-meta">
                                                <strong title={folder.name}>{folder.name}</strong>
                                                <small>{tr('browser.folderType')}</small>
                                                {folderBadge(folder)}
                                            </span>
                                        </button>
                                    ))}
                                    {shownDocuments.map((doc) => {
                                        const day = documentDay(doc);
                                        const subject = isMailName(doc.name) ? doc.description.trim() : '';
                                        const lockedByOther = doc.checkedOutById !== null && doc.checkedOutById !== viewerId;
                                        return (
                                            <button key={doc.id} type="button"
                                                className={docId === doc.id ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                                {...docHandlers(doc)}>
                                                <span className="fm-ex__tile-ico" aria-hidden>
                                                    <FileBadge kind={doc.kind} />
                                                </span>
                                                <span className="fm-ex__tile-meta" title={[doc.name, subject].filter(Boolean).join('\n')}>
                                                    <strong>{doc.name}</strong>
                                                    {subject ? <span className="fm-ex__tile-subject">{subject}</span> : null}
                                                    <small>
                                                        {kindLabel(doc.kind, tr)} · {formatBytes(doc.sizeBytes, locale)}
                                                        {day ? ` · ${formatDay(day, locale)}` : ''}
                                                        {doc.version > 1 ? ` · v${doc.version}` : ''}
                                                        {doc.checkedOutById ? ` · ${lockedByOther ? tr('table.checkedOutBy', { name: doc.checkedOutBy ?? '' }) : tr('table.checkedOutMe')}` : ''}
                                                    </small>
                                                    {docBadge(doc)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                )
                            )}
                            {filteredOut ? (
                                <div className="fm-datebar__empty">
                                    <p>{tr('browser.dateEmpty')}</p>
                                    <button type="button" className="fm-btn" onClick={(event) => {
                                        event.stopPropagation();
                                        setDateFilter({ preset: 'all', from: '', to: '' });
                                    }}>{tr('browser.dateReset')}</button>
                                </div>
                            ) : null}

                            {menu ? (
                                <div className="fm-ex__menu" style={{ left: menu.x, top: menu.y }} role="menu" onClick={(event) => event.stopPropagation()}>
                                    {menu.target.kind === 'folder' ? (
                                        <>
                                            <button type="button" role="menuitem" onClick={() => {
                                                goFolder(menu.target.kind === 'folder' ? menu.target.folder.id : null);
                                                setMenu(null);
                                            }}>{tr('browser.open')}</button>
                                            {manager ? (
                                                <button type="button" role="menuitem" onClick={() => {
                                                    if (menu.target.kind === 'folder')
                                                        setAccessFolderId(menu.target.folder.id);
                                                    if (docId)
                                                        onNavigate({ matterId, folderId, docId: null });
                                                    setMenu(null);
                                                }}>{tr('folderAccess.menu')}</button>
                                            ) : null}
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
                                            {menu.target.kind === 'document' && canShareDoc(menu.target.doc) ? (
                                                <button type="button" role="menuitem" onClick={() => {
                                                    if (menu.target.kind === 'document')
                                                        openDocAccess(menu.target.doc);
                                                    setMenu(null);
                                                }}>{tr('docAccess.menu')}</button>
                                            ) : null}
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

            {accessDocId ? (
                <DocumentAccessDrawer
                    documentId={accessDocId}
                    onClose={() => setAccessDocId(null)}
                    onChanged={browse.reload}
                />
            ) : null}
            {accessFolderId && manager && !docId && !accessDocId ? (
                <FolderAccessDrawer
                    folderId={accessFolderId}
                    onClose={() => setAccessFolderId(null)}
                    onChanged={browse.reload}
                    onOpenFolder={(id) => goFolder(id)}
                    onShowFolder={(id) => {
                        setAccessFolderId(id);
                        goFolder(folders.find((row) => row.id === id)?.parentId ?? null);
                    }}
                />
            ) : null}
            {docId && !accessDocId ? (
                <DocumentPane
                    documentId={docId}
                    onOpenAccess={(id) => setAccessDocId(id)}
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

            {duplicatesOpen ? (
                <DuplicatesModal
                    matterId={matterId}
                    editable={editable}
                    onClose={() => setDuplicatesOpen(false)}
                    onOpen={(doc) => {
                        setDuplicatesOpen(false);
                        onNavigate({ matterId, folderId: doc.folderId, docId: doc.id });
                    }}
                    onChanged={() => {
                        browse.reload();
                        onClientsStale();
                    }}
                />
            ) : null}
            {copyPrompt ? (
                <ConfirmModal
                    title={tr('browser.uploadDuplicateTitle')}
                    text={copyPrompt.text}
                    confirmLabel={tr('browser.uploadDuplicateConfirm')}
                    onClose={() => setCopyPrompt(null)}
                    onConfirm={async () => {
                        const files = copyPrompt.files;
                        setCopyPrompt(null);
                        await upload(files, true);
                    }}
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
