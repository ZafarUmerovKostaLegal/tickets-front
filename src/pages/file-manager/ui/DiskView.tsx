import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
} from 'react';
import { listTimeTrackingUsers, type TimeTrackingUserRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import {
    diskApi,
    type DiskBrowse,
    type DiskCrumb,
    type DiskFile,
    type DiskFolder,
    type DiskSearch,
    type DiskSelection,
} from '../api/diskApi';
import type { AclLevel, FileKind } from '../api/filesApi';
import { readDroppedItems, pickedFolderFiles, type DroppedFile } from '../lib/diskDropUpload';
import {
    DRAG_MIME,
    ancestorIds,
    buildFolderTree,
    canDrop,
    clickSelect,
    compareItems,
    invalidNameReason,
    itemKey,
    parentMap,
    selectionSize,
    stepSelect,
    toSelection,
    type FolderNode,
    type ItemKey,
    type SortDir,
    type SortKey,
} from '../lib/diskExplorer';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { CHUNKED_THRESHOLD } from '../lib/chunkedUpload';
import { enqueueUploadItems, onUploadDone } from '../lib/uploadQueue';

const DIRECT_DOWNLOAD_LIMIT = 50 * 1024 * 1024;
import { FilePreview } from './FilePreview';
import { FmSelect } from './fmSelect';
import { diskSource } from './previewSources';
import {
    ConfirmModal,
    FileBadge,
    Icon,
    LevelBadge,
    Modal,
    StateBlock,
    saveBlob,
    useAction,
    useFm,
    useLoad,
    useNotify,
    type IconName,
} from './fmShared';
import './DiskExplorer.css';

const ACL_LEVELS: AclLevel[] = ['read', 'edit', 'manage', 'deny'];

type Entry =
    | { kind: 'folder'; item: DiskFolder }
    | { kind: 'file'; item: DiskFile };

type CtxMenu = {
    x: number;
    y: number;
    target: Entry | { kind: 'blank' };
};

type CmdMenu = 'create' | 'sort' | 'more' | 'view' | null;
type Layout = 'tiles' | 'details';
type Clipboard = { mode: 'cut' | 'copy'; selection: DiskSelection; keys: Set<ItemKey> };
type Drag = { selection: DiskSelection; source: string | null | undefined };

const ROOT_DROP = 'root';

function entryKey(entry: Entry): ItemKey {
    return itemKey(entry.kind, entry.item.id);
}

function readPref<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : fallback;
    }
    catch {
        return fallback;
    }
}

function usePref<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
    const [value, setValue] = useState<T>(() => readPref(key, fallback));
    const update = useCallback((next: T | ((prev: T) => T)) => {
        setValue((prev) => {
            const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
            try {
                window.localStorage.setItem(key, JSON.stringify(resolved));
            }
            catch {
            }
            return resolved;
        });
    }, [key]);
    return [value, update];
}

function userLabel(user: TimeTrackingUserRow): string {
    return (user.display_name ?? '').trim() || user.email;
}

function asFileKind(kind: string): FileKind {
    const allowed: FileKind[] = ['pdf', 'doc', 'sheet', 'slides', 'email', 'image', 'archive', 'text', 'file'];
    return (allowed.includes(kind as FileKind) ? kind : 'file') as FileKind;
}

function kindLabel(kind: string, tr: (key: string) => string): string {
    const key = `kinds.${asFileKind(kind)}`;
    const label = tr(key);
    return label === key ? tr('browser.fileType') : label;
}

function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el)
        return false;
    return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function NameModal({ title, initial, label, hint, allowPath, selectStem, onClose, onSubmit }: {
    title: string;
    initial: string;
    label: string;
    hint?: string;
    allowPath?: boolean;
    selectStem?: boolean;
    onClose: () => void;
    onSubmit: (name: string) => Promise<boolean>;
}) {
    const { tr } = useFm();
    const [name, setName] = useState(initial);
    const [busy, setBusy] = useState(false);
    const reason = invalidNameReason(name, { allowPath });
    const error = reason === 'chars' ? tr(allowPath ? 'disk.nameCharsPath' : 'disk.nameChars') : null;
    const submit = async () => {
        if (reason || busy)
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
                <button type="button" className="fm-btn fm-btn--primary" disabled={busy || reason !== null} onClick={() => void submit()}>
                    {tr('common.save')}
                </button>
            </>
        )}>
            <label className="fm-field">
                <span>{label}</span>
                <input
                    autoFocus
                    value={name}
                    maxLength={allowPath ? 1000 : 300}
                    aria-invalid={error ? true : undefined}
                    onFocus={(event) => {
                        const dot = selectStem ? initial.lastIndexOf('.') : -1;
                        event.currentTarget.setSelectionRange(0, dot > 0 ? dot : initial.length);
                    }}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter')
                            void submit();
                    }}
                />
            </label>
            {error ? <p className="fm-disk-x__error" role="alert">{error}</p> : null}
            {hint ? <p className="fm-hint">{hint}</p> : null}
        </Modal>
    );
}

function DeletedFilesModal({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const load = useLoad(() => diskApi.deleted(), []);
    const [filter, setFilter] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const needle = filter.trim().toLowerCase();
    const rows = (load.data?.items ?? []).filter((row) => !needle || `${row.name} ${row.path} ${row.deletedBy}`.toLowerCase().includes(needle));
    return (
        <Modal title={tr('disk.deletedTitle')} onClose={onClose} wide>
            <p className="fm-hint">{tr('disk.deletedHint')}</p>
            <label className="fm-search fm-search--wide fm-deleted__search">
                <Icon name="search" />
                <input value={filter} placeholder={tr('disk.deletedSearch')} onChange={(event) => setFilter(event.target.value)} />
            </label>
            <StateBlock loading={load.loading && !load.data} error={load.error} onRetry={load.reload}
                empty={load.data && rows.length === 0 ? tr('disk.deletedEmpty') : undefined}>
                <ul className="fm-deleted">
                    {rows.map((row) => (
                        <li key={row.id}>
                            <div className="fm-deleted__info">
                                <strong title={row.name}>{row.name}</strong>
                                <small>
                                    {row.source === 'task' ? tr('disk.deletedFromTask') : (row.path || tr('disk.root'))}
                                    {` · ${formatBytes(row.sizeBytes, locale)} · ${row.deletedBy || '—'} · ${formatDateTime(row.deletedAt, locale)}`}
                                </small>
                            </div>
                            {row.source === 'drive' ? (
                                <button type="button" className="fm-btn" disabled={busy !== null} onClick={async () => {
                                    setBusy(row.id);
                                    const ok = await act(() => diskApi.restoreDeleted(row.id), tr('disk.deletedRestored'));
                                    setBusy(null);
                                    if (ok) {
                                        load.reload();
                                        onRestored();
                                    }
                                }}>
                                    <Icon name="restore" />{busy === row.id ? tr('common.loading') : tr('trash.restore')}
                                </button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </StateBlock>
        </Modal>
    );
}

function AccessDrawer({
    folderId,
    folderName,
    onClose,
}: {
    folderId: string | null;
    folderName: string;
    onClose: () => void;
}) {
    const { tr, locale } = useFm();
    const act = useAction();
    const security = useLoad(() => diskApi.security(folderId), [folderId]);
    const users = useLoad(() => listTimeTrackingUsers(), []);
    const [addUser, setAddUser] = useState('');
    const [addLevel, setAddLevel] = useState<AclLevel>('read');
    const [note, setNote] = useState('');
    const activeUsers = useMemo(
        () => (users.data ?? []).filter((user) => !user.is_blocked && !user.is_archived),
        [users.data],
    );
    const rows = security.data?.acl ?? [];

    return (
        <aside className="fm-pane fm-disk__drawer" aria-label={tr('disk.access')}>
            <header className="fm-pane__head">
                <div>
                    <h3>{tr('disk.access')}</h3>
                    <p className="fm-muted">{folderName}</p>
                </div>
                <button type="button" className="fm-btn" onClick={onClose} aria-label={tr('common.close')}>
                    <Icon name="close" />
                </button>
            </header>
            <div className="fm-pane__body">
                <p className="fm-hint">{tr('disk.accessHint')}</p>
                <form
                    className="fm-grant"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        const user = activeUsers.find((row) => String(row.id) === addUser);
                        if (!user)
                            return;
                        const ok = await act(
                            () => diskApi.setAcl(folderId, { userId: user.id, userName: userLabel(user), level: addLevel, note }),
                            tr('disk.accessSaved'),
                        );
                        if (ok) {
                            setAddUser('');
                            setNote('');
                            security.reload();
                        }
                    }}
                >
                    <div className="fm-field">
                        <span>{tr('security.addUser')}</span>
                        <SearchableSelect<TimeTrackingUserRow>
                            value={addUser}
                            items={activeUsers}
                            getOptionValue={(user) => String(user.id)}
                            getOptionLabel={userLabel}
                            getSearchText={(user) => `${userLabel(user)} ${user.email} ${user.position ?? ''}`}
                            onSelect={(user) => setAddUser(String(user.id))}
                            placeholder={tr('security.searchUser')}
                        />
                    </div>
                    <div className="fm-field">
                        <span>{tr('security.addLevel')}</span>
                        <FmSelect
                            value={addLevel}
                            options={ACL_LEVELS.map((level) => ({ value: level, label: tr(`levels.${level}`) }))}
                            onChange={(level) => setAddLevel(level as AclLevel)}
                            placeholder={tr('security.addLevel')}
                        />
                    </div>
                    <label className="fm-field fm-field--grow">
                        <span>{tr('security.note')}</span>
                        <input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                    </label>
                    <button type="submit" className="fm-btn fm-btn--primary" disabled={!addUser}>
                        <Icon name="plus" />{tr('security.add')}
                    </button>
                </form>
                <StateBlock loading={security.loading && !security.data} error={security.error} onRetry={security.reload}
                    empty={!security.loading && rows.length === 0 ? <div className="fm-state">{tr('disk.accessEmpty')}</div> : undefined}>
                    {rows.length > 0 ? (
                        <ul className="fm-disk__acl">
                            {rows.map((row) => (
                                <li key={row.userId} className={row.level === 'deny' ? 'is-denied' : undefined}>
                                    <div className="fm-disk__acl-user">
                                        <strong>{row.userName}</strong>
                                        <small>
                                            {row.note ? `${row.note} · ` : ''}
                                            {row.grantedBy}
                                            {row.grantedAt ? ` · ${formatDateTime(row.grantedAt, locale)}` : ''}
                                        </small>
                                    </div>
                                    <FmSelect
                                        value={row.level}
                                        className={`fm-filter-select--level fm-level--${row.level}`}
                                        buttonClassName={`fm-level-select fm-level--${row.level}`}
                                        options={ACL_LEVELS.map((level) => ({ value: level, label: tr(`levels.${level}`) }))}
                                        onChange={(level) => void act(async () => {
                                            await diskApi.setAcl(folderId, { userId: row.userId, userName: row.userName, level: level as AclLevel, note: row.note });
                                            security.reload();
                                            return true;
                                        }, tr('disk.accessSaved'))}
                                        placeholder={tr('security.addLevel')}
                                    />
                                    <button
                                        type="button"
                                        className="fm-btn"
                                        onClick={() => void act(async () => {
                                            await diskApi.removeAcl(folderId, row.userId);
                                            security.reload();
                                            return true;
                                        }, tr('disk.accessSaved'))}
                                    >
                                        {tr('security.remove')}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </StateBlock>
            </div>
        </aside>
    );
}

function CmdButton({ icon, label, title, disabled, active, caret, onClick }: {
    icon: IconName;
    label?: string;
    title?: string;
    disabled?: boolean;
    active?: boolean;
    caret?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            className={`fm-disk-cmd__btn${label ? ' fm-disk-cmd__btn--text' : ''}${active ? ' is-on' : ''}`}
            title={title ?? label}
            aria-label={title ?? label}
            aria-pressed={active ? true : undefined}
            disabled={disabled}
            onClick={onClick}
        >
            <Icon name={icon} />
            {label ? <span>{label}</span> : null}
            {caret ? <Icon name="chevron" className="fm-disk-cmd__caret" /> : null}
        </button>
    );
}

type DropProps = (target: string | null, key: string) => {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
};

function TreeBranch({ nodes, depth, currentId, expanded, dropKey, onToggle, onOpen, dropProps }: {
    nodes: FolderNode[];
    depth: number;
    currentId: string | null;
    expanded: ReadonlySet<string>;
    dropKey: string | null;
    onToggle: (id: string) => void;
    onOpen: (id: string) => void;
    dropProps: DropProps;
}) {
    return (
        <ul role="group" className="fm-disk-x__tree-group">
            {nodes.map((node) => {
                const open = expanded.has(node.id);
                const key = `tree:${node.id}`;
                return (
                    <li key={node.id} role="treeitem" aria-expanded={node.children.length ? open : undefined} aria-selected={currentId === node.id}>
                        <div
                            className={`fm-disk-x__tree-row${currentId === node.id ? ' is-current' : ''}${dropKey === key ? ' is-drop' : ''}${node.hidden ? ' is-hidden' : ''}`}
                            style={{ paddingLeft: `${0.35 + depth * 0.85}rem` }}
                            {...dropProps(node.id, key)}
                        >
                            <button
                                type="button"
                                className="fm-disk-x__tree-twisty"
                                tabIndex={-1}
                                aria-hidden={!node.children.length}
                                disabled={!node.children.length}
                                onClick={() => onToggle(node.id)}
                            >
                                {node.children.length ? <Icon name="chevron" className={open ? 'is-open' : undefined} /> : null}
                            </button>
                            <button type="button" className="fm-disk-x__tree-label" title={node.name} onClick={() => onOpen(node.id)}>
                                <Icon name={currentId === node.id ? 'folderOpen' : 'folder'} className="fm-ico--folder" />
                                <span>{node.name}</span>
                            </button>
                        </div>
                        {open && node.children.length ? (
                            <TreeBranch
                                nodes={node.children}
                                depth={depth + 1}
                                currentId={currentId}
                                expanded={expanded}
                                dropKey={dropKey}
                                onToggle={onToggle}
                                onOpen={onOpen}
                                dropProps={dropProps}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}

function MenuItem({ icon, label, hint, danger, disabled, onClick }: {
    icon?: IconName;
    label: string;
    hint?: string;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button type="button" role="menuitem" className={danger ? 'is-danger' : undefined} disabled={disabled} onClick={onClick}>
            {icon ? <Icon name={icon} /> : <span className="fm-disk-x__menu-pad" />}
            <span>{label}</span>
            {hint ? <kbd>{hint}</kbd> : null}
        </button>
    );
}

function pathLabel(path: DiskCrumb[] | undefined, root: string): string {
    return [root, ...(path ?? []).map((crumb) => crumb.name)].join(' › ');
}

function startBrowserDownload(url: string) {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export function DiskView() {
    const { tr, locale } = useFm();
    const act = useAction();
    const notify = useNotify();
    const [folderId, setFolderId] = useState<string | null>(null);
    const [history, setHistory] = useState<{ back: Array<string | null>; forward: Array<string | null> }>({ back: [], forward: [] });
    const [showHidden, setShowHidden] = usePref('fm-disk-hidden', false);
    const [layout, setLayout] = usePref<Layout>('fm-disk-layout', 'tiles');
    const [sort, setSort] = usePref<{ key: SortKey; dir: SortDir }>('fm-disk-sort', { key: 'name', dir: 'asc' });
    const [treeOpen, setTreeOpen] = usePref('fm-disk-tree', true);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
    const [selection, setSelection] = useState<Set<ItemKey>>(() => new Set());
    const [anchor, setAnchor] = useState<ItemKey | null>(null);
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [previewing, setPreviewing] = useState<DiskFile | null>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DiskSearch | null>(null);
    const [searching, setSearching] = useState(false);
    const [searchTick, setSearchTick] = useState(0);
    const [cmdMenu, setCmdMenu] = useState<CmdMenu>(null);
    const [dropKey, setDropKey] = useState<string | null>(null);
    const [uploading, setUploading] = useState(0);
    const [createOpen, setCreateOpen] = useState(false);
    const [renaming, setRenaming] = useState<Entry | null>(null);
    const [purge, setPurge] = useState<Entry[] | null>(null);
    const [accessOpen, setAccessOpen] = useState(false);
    const [deletedOpen, setDeletedOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [menu, setMenu] = useState<CtxMenu | null>(null);
    const [data, setData] = useState<DiskBrowse | null>(null);
    const [pendingSelect, setPendingSelect] = useState<ItemKey | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const dirRef = useRef<HTMLInputElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const cmdRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<Drag | null>(null);
    const pointerRef = useRef<string>('mouse');
    const load = useLoad(() => diskApi.browse(folderId, showHidden), [folderId, showHidden]);
    const treeLoad = useLoad(() => diskApi.tree(showHidden), [showHidden]);

    useEffect(() => {
        if (load.data)
            setData(load.data);
    }, [load.data]);

    useEffect(() => {
        dirRef.current?.setAttribute('webkitdirectory', '');
        dirRef.current?.setAttribute('directory', '');
    }, []);

    useEffect(() => {
        setSelection(new Set());
        setAnchor(null);
        setAccessOpen(false);
        setMenu(null);
        setCmdMenu(null);
        setQuery('');
    }, [folderId]);

    const treeRows = useMemo(() => treeLoad.data?.folders ?? [], [treeLoad.data]);
    const tree = useMemo(() => buildFolderTree(treeRows), [treeRows]);
    const parents = useMemo(() => parentMap(treeRows), [treeRows]);

    useEffect(() => {
        if (!folderId)
            return;
        setExpanded((prev) => {
            const chain = ancestorIds(parents, folderId).slice(0, -1);
            if (chain.every((id) => prev.has(id)))
                return prev;
            const next = new Set(prev);
            chain.forEach((id) => next.add(id));
            return next;
        });
    }, [folderId, parents]);

    useEffect(() => {
        if (!menu && !cmdMenu)
            return;
        const close = (event: Event) => {
            if (event.type === 'click' && cmdRef.current?.contains(event.target as Node))
                return;
            setMenu(null);
            setCmdMenu(null);
        };
        window.addEventListener('click', close);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [menu, cmdMenu]);

    const q = query.trim();
    const searchMode = q.length >= 2;

    useEffect(() => {
        if (!searchMode) {
            setResults(null);
            setSearching(false);
            return;
        }
        let alive = true;
        setSearching(true);
        const timer = window.setTimeout(() => {
            diskApi.search(q, folderId, showHidden).then((found) => {
                if (alive)
                    setResults(found);
            }, () => {
                if (alive)
                    setResults({ query: q, folders: [], files: [], truncated: false });
            }).finally(() => {
                if (alive)
                    setSearching(false);
            });
        }, 280);
        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, [q, searchMode, folderId, showHidden, searchTick]);

    const canEdit = data?.canEdit ?? false;
    const canManage = data?.canManage ?? false;
    const path = useMemo(() => data?.path ?? [], [data]);
    const upId = path.length > 1 ? path[path.length - 2]!.id : null;
    const currentName = path.length ? path[path.length - 1]!.name : tr('disk.root');

    const entries = useMemo<Entry[]>(() => {
        const source = searchMode ? results : data;
        const folders = [...(source?.folders ?? [])].sort((a, b) => compareItems(a, b, sort.key === 'type' ? 'name' : sort.key, sort.dir));
        const files = [...(source?.files ?? [])].sort((a, b) => compareItems(
            { ...a, kind: String(a.kind) },
            { ...b, kind: String(b.kind) },
            sort.key,
            sort.dir,
        ));
        return [
            ...folders.map((item) => ({ kind: 'folder' as const, item })),
            ...files.map((item) => ({ kind: 'file' as const, item })),
        ];
    }, [searchMode, results, data, sort]);
    const order = useMemo(() => entries.map(entryKey), [entries]);
    const selectedEntries = useMemo(() => entries.filter((entry) => selection.has(entryKey(entry))), [entries, selection]);
    const selectedBytes = selectedEntries.reduce((sum, entry) => sum + (entry.kind === 'file' ? entry.item.sizeBytes ?? 0 : 0), 0);

    useEffect(() => {
        if (!pendingSelect || !order.includes(pendingSelect))
            return;
        setSelection(new Set([pendingSelect]));
        setAnchor(pendingSelect);
        setPendingSelect(null);
        window.requestAnimationFrame(() => {
            contentRef.current?.querySelector(`[data-key="${CSS.escape(pendingSelect)}"]`)?.scrollIntoView({ block: 'nearest' });
        });
    }, [order, pendingSelect]);

    const refresh = useCallback(() => {
        load.reload();
        treeLoad.reload();
        setSearchTick((n) => n + 1);
    }, [load, treeLoad]);
    useEffect(() => onUploadDone((item) => {
        if (item.api === 'drive')
            refresh();
    }), [refresh]);

    const navigate = useCallback((next: string | null, mode: 'push' | 'back' | 'forward' = 'push') => {
        if (next === folderId)
            return;
        setHistory((prev) => {
            if (mode === 'back')
                return { back: prev.back.slice(0, -1), forward: [folderId, ...prev.forward] };
            if (mode === 'forward')
                return { back: [...prev.back, folderId], forward: prev.forward.slice(1) };
            return { back: [...prev.back, folderId].slice(-50), forward: [] };
        });
        setFolderId(next);
    }, [folderId]);

    const goBack = () => {
        if (history.back.length)
            navigate(history.back[history.back.length - 1]!, 'back');
    };
    const goForward = () => {
        if (history.forward.length)
            navigate(history.forward[0]!, 'forward');
    };
    const goUp = () => {
        if (path.length)
            navigate(upId);
    };

    const downloadFile = async (item: DiskFile) => {
        if ((item.sizeBytes ?? 0) > DIRECT_DOWNLOAD_LIMIT) {
            const url = await act(() => diskApi.link(item.id));
            if (url)
                startBrowserDownload(url);
            return;
        }
        await act(async () => {
            const blob = await diskApi.downloadBlob(item.id);
            await saveBlob(blob, item.name);
            return true;
        });
    };

    const open = (entry: Entry) => {
        if (entry.kind === 'folder')
            navigate(entry.item.id);
        else
            setPreviewing(entry.item);
    };

    const openLocation = (entry: Entry) => {
        const parent = entry.kind === 'folder' ? entry.item.parentId ?? null : entry.item.folderId ?? null;
        setPendingSelect(entryKey(entry));
        if (parent === folderId)
            setQuery('');
        else
            navigate(parent);
    };

    const uploadTo = async (all: DroppedFile[], target: string | null) => {
        const nestedAll = all.some((row) => row.path.includes('/'));
        const large = all.filter((row) => row.file.size > CHUNKED_THRESHOLD);
        if (large.length) {
            enqueueUploadItems(large.map((row) => ({
                file: row.file,
                target: { matterId: '', folderId: target, startPath: '/uploads', extra: { parentId: target, path: nestedAll ? row.path : '' } },
            })), 'drive');
        }
        const items = all.filter((row) => row.file.size <= CHUNKED_THRESHOLD);
        if (!items.length)
            return;
        const nested = items.some((row) => row.path.includes('/'));
        setUploading(items.length);
        await act(
            () => diskApi.upload(items.map((row) => row.file), target, { paths: nested ? items.map((row) => row.path) : undefined }),
            tr('browser.uploaded', { count: items.length }),
        );
        setUploading(0);
        refresh();
    };

    const transfer = async (sel: DiskSelection, target: string | null, mode: 'move' | 'copy') => {
        if (!selectionSize(sel))
            return false;
        const count = await act(async () => (mode === 'move'
            ? (await diskApi.move(sel, target)).moved
            : (await diskApi.copy(sel, target)).copied));
        if (count !== undefined)
            notify(tr(mode === 'move' ? 'disk.moveDone' : 'disk.copyDone', { count }));
        refresh();
        return count !== undefined;
    };

    const paste = async (target: string | null = folderId) => {
        if (!clipboard)
            return;
        const ok = await transfer(clipboard.selection, target, clipboard.mode === 'cut' ? 'move' : 'copy');
        if (ok && clipboard.mode === 'cut')
            setClipboard(null);
    };

    const toClipboard = (mode: Clipboard['mode'], keys: ItemKey[]) => {
        if (!keys.length)
            return;
        setClipboard({ mode, selection: toSelection(keys), keys: new Set(keys) });
        notify(tr(mode === 'cut' ? 'disk.clipboardCut' : 'disk.clipboardCopy', { count: keys.length }));
    };

    const setHidden = async (list: Entry[], hidden: boolean) => {
        const sel = toSelection(list.map(entryKey));
        if (!selectionSize(sel))
            return;
        await act(() => diskApi.hide(sel, hidden), tr(hidden ? 'disk.hiddenDone' : 'disk.unhiddenDone', { count: list.length }));
        refresh();
    };

    const downloadMany = async (list: Entry[]) => {
        if (list.length === 1 && list[0]!.kind === 'file') {
            await downloadFile(list[0]!.item);
            return;
        }
        const sel = toSelection(list.map(entryKey));
        if (!selectionSize(sel))
            return;
        const name = list.length === 1 ? list[0]!.item.name : currentName;
        const link = await act(() => diskApi.zipLink(sel, name));
        if (link)
            startBrowserDownload(link.url);
    };

    const selectEntry = (event: ReactMouseEvent, entry: Entry) => {
        event.stopPropagation();
        setMenu(null);
        const key = entryKey(entry);
        if (pointerRef.current === 'touch' && !event.ctrlKey && !event.shiftKey && selection.size <= 1) {
            open(entry);
            return;
        }
        const next = clickSelect(selection, order, key, anchor, { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey });
        setSelection(next.selection);
        setAnchor(next.anchor);
    };

    const openCtx = (event: ReactMouseEvent, target: CtxMenu['target']) => {
        event.preventDefault();
        event.stopPropagation();
        setCmdMenu(null);
        if (target.kind !== 'blank') {
            const key = entryKey(target);
            if (!selection.has(key)) {
                setSelection(new Set([key]));
                setAnchor(key);
            }
        }
        else if (selection.size) {
            setSelection(new Set());
        }
        const host = contentRef.current;
        const rect = host?.getBoundingClientRect();
        const x = rect ? event.clientX - rect.left + host!.scrollLeft : event.clientX;
        const y = rect ? event.clientY - rect.top + host!.scrollTop : event.clientY;
        const maxX = rect ? host!.scrollLeft + rect.width - 232 : x;
        const maxY = rect ? host!.scrollTop + rect.height - 340 : y;
        setMenu({ x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, Math.min(y, Math.max(8, maxY))), target });
    };

    const startDrag = (event: DragEvent<HTMLElement>, entry: Entry) => {
        const key = entryKey(entry);
        const keys = selection.has(key) ? [...selection] : [key];
        if (!selection.has(key)) {
            setSelection(new Set([key]));
            setAnchor(key);
        }
        const sel = toSelection(keys);
        dragRef.current = { selection: sel, source: searchMode ? undefined : folderId };
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData(DRAG_MIME, JSON.stringify(keys));
        event.dataTransfer.setData('text/plain', keys.length === 1 ? entry.item.name : tr('disk.dragCount', { count: keys.length }));
        if (keys.length > 1) {
            const ghost = document.createElement('div');
            ghost.className = 'fm-disk-x__ghost';
            ghost.textContent = tr('disk.dragCount', { count: keys.length });
            document.body.appendChild(ghost);
            event.dataTransfer.setDragImage(ghost, 12, 12);
            window.setTimeout(() => ghost.remove(), 0);
        }
    };

    const endDrag = () => {
        dragRef.current = null;
        setDropKey(null);
    };

    const dropProps: DropProps = (target, key) => ({
        onDragOver: (event) => {
            const internal = event.dataTransfer.types.includes(DRAG_MIME) && dragRef.current;
            const external = !internal && event.dataTransfer.types.includes('Files');
            if (internal) {
                if (!canDrop(dragRef.current!.selection, target, parents, dragRef.current!.source))
                    return;
                event.dataTransfer.dropEffect = event.ctrlKey || event.altKey ? 'copy' : 'move';
            }
            else if (external) {
                event.dataTransfer.dropEffect = 'copy';
            }
            else {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (dropKey !== key)
                setDropKey(key);
        },
        onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setDropKey((current) => (current === key ? null : current));
        },
        onDrop: (event) => {
            event.preventDefault();
            event.stopPropagation();
            setDropKey(null);
            const drag = dragRef.current;
            if (drag && event.dataTransfer.types.includes(DRAG_MIME)) {
                dragRef.current = null;
                if (canDrop(drag.selection, target, parents, drag.source))
                    void transfer(drag.selection, target, event.ctrlKey || event.altKey ? 'copy' : 'move');
                return;
            }
            const pending = readDroppedItems(event.dataTransfer);
            void pending.then(({ files }) => uploadTo(files, target));
        },
    });

    const modalOpen = createOpen || renaming !== null || purge !== null || helpOpen || previewing !== null;
    const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
    keyRef.current = (event: KeyboardEvent) => {
        if (modalOpen)
            return;
        const mod = event.ctrlKey || event.metaKey;
        if (mod && (event.key === 'f' || event.key === 'F' || event.key === 'e')) {
            event.preventDefault();
            searchRef.current?.focus();
            searchRef.current?.select();
            return;
        }
        if (isTyping(event.target))
            return;
        const keys = [...selection];
        if (mod && event.shiftKey && (event.key === 'N' || event.key === 'n')) {
            event.preventDefault();
            if (canEdit && !searchMode)
                setCreateOpen(true);
            return;
        }
        if (mod && (event.key === 'a' || event.key === 'A')) {
            event.preventDefault();
            setSelection(new Set(order));
            return;
        }
        if (mod && (event.key === 'c' || event.key === 'C')) {
            toClipboard('copy', keys);
            return;
        }
        if (mod && (event.key === 'x' || event.key === 'X')) {
            if (canEdit)
                toClipboard('cut', keys);
            return;
        }
        if (mod && (event.key === 'v' || event.key === 'V')) {
            if (clipboard && canEdit && !searchMode)
                void paste();
            return;
        }
        if (event.key === 'Delete' && selectedEntries.length && canEdit) {
            setPurge(selectedEntries);
            return;
        }
        if (event.key === 'F2' && selectedEntries.length === 1 && canEdit) {
            event.preventDefault();
            setRenaming(selectedEntries[0]!);
            return;
        }
        if (event.key === 'F5') {
            event.preventDefault();
            refresh();
            return;
        }
        if (event.key === 'Enter' && selectedEntries.length === 1) {
            open(selectedEntries[0]!);
            return;
        }
        if (event.key === 'Backspace' || (event.altKey && event.key === 'ArrowUp')) {
            event.preventDefault();
            goUp();
            return;
        }
        if (event.altKey && event.key === 'ArrowLeft') {
            event.preventDefault();
            goBack();
            return;
        }
        if (event.altKey && event.key === 'ArrowRight') {
            event.preventDefault();
            goForward();
            return;
        }
        if (event.key === 'Escape') {
            if (query)
                setQuery('');
            else if (clipboard?.mode === 'cut')
                setClipboard(null);
            else
                setSelection(new Set());
            return;
        }
        const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
        if (step && !event.altKey) {
            event.preventDefault();
            const focus = anchor && selection.has(anchor) ? anchor : null;
            const next = stepSelect(order, focus, step);
            if (next) {
                const result = event.shiftKey ? clickSelect(selection, order, next, anchor, { ctrl: false, shift: true }) : { selection: new Set([next]), anchor: next };
                setSelection(result.selection);
                setAnchor(event.shiftKey ? anchor ?? next : next);
                contentRef.current?.querySelector(`[data-key="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
            }
        }
    };

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => keyRef.current(event);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleCmd = (next: Exclude<CmdMenu, null>) => {
        setMenu(null);
        setCmdMenu((current) => (current === next ? null : next));
    };

    const setSortKey = (key: SortKey) => setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' || key === 'size' ? 'desc' : 'asc' }));

    const itemClass = (entry: Entry, base: string) => {
        const key = entryKey(entry);
        return [
            base,
            selection.has(key) ? 'is-on' : '',
            entry.item.hidden ? 'is-hidden' : '',
            clipboard?.mode === 'cut' && clipboard.keys.has(key) ? 'is-cut' : '',
            entry.kind === 'folder' && dropKey === key ? 'is-drop' : '',
        ].filter(Boolean).join(' ');
    };

    const itemProps = (entry: Entry) => {
        const key = entryKey(entry);
        return {
            'data-key': key,
            draggable: true,
            onPointerDown: (event: { pointerType: string }) => {
                pointerRef.current = event.pointerType;
            },
            onClick: (event: ReactMouseEvent) => selectEntry(event, entry),
            onDoubleClick: (event: ReactMouseEvent) => {
                event.stopPropagation();
                open(entry);
            },
            onContextMenu: (event: ReactMouseEvent) => openCtx(event, entry),
            onDragStart: (event: DragEvent<HTMLElement>) => startDrag(event, entry),
            onDragEnd: endDrag,
            ...(entry.kind === 'folder' ? dropProps(entry.item.id, key) : {}),
        };
    };

    const subtitle = (entry: Entry) => {
        if (entry.kind === 'folder') {
            if (entry.item.itemCount == null)
                return tr('browser.folderType');
            return entry.item.itemCount ? tr('disk.folderItems', { count: entry.item.itemCount }) : tr('disk.emptyShort');
        }
        const sizeLabel = entry.item.sizeBytes != null ? formatBytes(entry.item.sizeBytes, locale) : entry.item.size;
        return `${kindLabel(String(entry.item.kind), tr)}${sizeLabel ? ` · ${sizeLabel}` : ''}`;
    };

    const icon = (entry: Entry) => (entry.kind === 'folder'
        ? <Icon name="folder" className="fm-ico--folder" />
        : <FileBadge kind={asFileKind(String(entry.item.kind))} />);

    const renderTiles = () => (
        <div className="fm-ex__tiles fm-ex__tiles--page fm-disk__tiles" role="listbox" aria-multiselectable="true">
            {entries.map((entry) => (
                <button
                    key={entryKey(entry)}
                    type="button"
                    role="option"
                    aria-selected={selection.has(entryKey(entry))}
                    className={itemClass(entry, 'fm-ex__tile')}
                    {...itemProps(entry)}
                >
                    <span className="fm-ex__tile-ico" aria-hidden>{icon(entry)}</span>
                    <span className="fm-ex__tile-meta">
                        <strong title={entry.item.name}>{entry.item.name}</strong>
                        <small>{searchMode ? pathLabel(entry.item.path, tr('disk.root')) : subtitle(entry)}</small>
                    </span>
                </button>
            ))}
        </div>
    );

    const sortHead = (key: SortKey, label: string) => (
        <th aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button type="button" className="fm-disk-x__th" onClick={() => setSortKey(key)}>
                {label}
                {sort.key === key ? <Icon name="chevron" className={sort.dir === 'asc' ? 'is-asc' : 'is-desc'} /> : null}
            </button>
        </th>
    );

    const renderDetails = () => (
        <div className="fm-table-wrap fm-disk__details">
            <table className="fm-table fm-disk-x__table">
                <thead>
                    <tr>
                        {sortHead('name', tr('table.name'))}
                        {searchMode ? <th>{tr('disk.location')}</th> : null}
                        {sortHead('date', tr('disk.modified'))}
                        {sortHead('type', tr('disk.type'))}
                        {sortHead('size', tr('disk.size'))}
                    </tr>
                </thead>
                <tbody>
                    {entries.map((entry) => (
                        <tr
                            key={entryKey(entry)}
                            aria-selected={selection.has(entryKey(entry))}
                            className={itemClass(entry, 'fm-disk-x__row').replace('is-on', 'is-selected')}
                            {...itemProps(entry)}
                        >
                            <td>
                                <span className="fm-table__name">
                                    <span className="fm-table__ico" aria-hidden>{icon(entry)}</span>
                                    <strong title={entry.item.name}>{entry.item.name}</strong>
                                    {entry.item.hidden ? <span className="fm-disk-x__tag">{tr('disk.hiddenBadge')}</span> : null}
                                </span>
                            </td>
                            {searchMode ? (
                                <td className="fm-disk-x__loc">
                                    <button type="button" onClick={(event) => { event.stopPropagation(); openLocation(entry); }}>
                                        {pathLabel(entry.item.path, tr('disk.root'))}
                                    </button>
                                </td>
                            ) : null}
                            <td className="fm-nowrap">{formatDateTime(entry.item.updatedAt ?? entry.item.createdAt, locale)}</td>
                            <td>{entry.kind === 'folder' ? tr('browser.folderType') : kindLabel(String(entry.item.kind), tr)}</td>
                            <td className="fm-nowrap">
                                {entry.kind === 'folder'
                                    ? (entry.item.itemCount != null ? tr('disk.folderItems', { count: entry.item.itemCount }) : '—')
                                    : (entry.item.sizeBytes != null ? formatBytes(entry.item.sizeBytes, locale) : entry.item.size)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderMenu = (): ReactNode => {
        if (!menu)
            return null;
        const target = menu.target;
        const close = (run: () => void) => () => {
            setMenu(null);
            run();
        };
        const list = target.kind === 'blank' ? [] : (selection.has(entryKey(target)) ? selectedEntries : [target]);
        const keys = list.map(entryKey);
        const single = list.length === 1 ? list[0]! : null;
        const allHidden = list.length > 0 && list.every((entry) => entry.item.hidden);
        return (
            <div
                className="fm-ex__menu fm-disk-x__menu"
                style={{ left: menu.x, top: menu.y }}
                role="menu"
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
            >
                {target.kind === 'blank' ? (
                    <>
                        <MenuItem icon="refresh" label={tr('browser.refresh')} hint="F5" onClick={close(refresh)} />
                        {canEdit && !searchMode ? (
                            <>
                                <MenuItem icon="folder" label={tr('browser.newFolder')} hint="Ctrl+Shift+N" onClick={close(() => setCreateOpen(true))} />
                                <MenuItem icon="upload" label={tr('disk.uploadFiles')} onClick={close(() => fileRef.current?.click())} />
                                <MenuItem icon="folderOpen" label={tr('disk.uploadFolder')} onClick={close(() => dirRef.current?.click())} />
                                <MenuItem icon="paste" label={tr('browser.paste')} hint="Ctrl+V" disabled={!clipboard} onClick={close(() => void paste())} />
                            </>
                        ) : null}
                        <MenuItem icon="check" label={tr('disk.selectAll')} hint="Ctrl+A" disabled={!order.length} onClick={close(() => setSelection(new Set(order)))} />
                        <MenuItem icon="eye" label={tr('disk.showHidden')} hint={showHidden ? '✓' : undefined} onClick={close(() => setShowHidden((v) => !v))} />
                    </>
                ) : (
                    <>
                        {single ? (
                            <MenuItem
                                icon={single.kind === 'folder' ? 'folderOpen' : 'download'}
                                label={single.kind === 'folder' ? tr('disk.open') : tr('pane.download')}
                                hint="Enter"
                                onClick={close(() => open(single))}
                            />
                        ) : null}
                        {single && searchMode ? (
                            <MenuItem icon="folder" label={tr('disk.openLocation')} onClick={close(() => openLocation(single))} />
                        ) : null}
                        {list.some((entry) => entry.kind === 'folder') || list.length > 1 ? (
                            <MenuItem icon="download" label={tr('disk.downloadZip')} onClick={close(() => void downloadMany(list))} />
                        ) : null}
                        <span className="fm-disk-x__menu-sep" />
                        {canEdit ? <MenuItem icon="cut" label={tr('browser.cut')} hint="Ctrl+X" onClick={close(() => toClipboard('cut', keys))} /> : null}
                        <MenuItem icon="copy" label={tr('browser.copy')} hint="Ctrl+C" onClick={close(() => toClipboard('copy', keys))} />
                        {single?.kind === 'folder' && clipboard && canEdit ? (
                            <MenuItem icon="paste" label={tr('browser.paste')} onClick={close(() => void paste(single.item.id))} />
                        ) : null}
                        {canEdit ? (
                            <>
                                <span className="fm-disk-x__menu-sep" />
                                {single ? <MenuItem icon="rename" label={tr('disk.rename')} hint="F2" onClick={close(() => setRenaming(single))} /> : null}
                                <MenuItem
                                    icon="eye"
                                    label={allHidden ? tr('disk.unhide') : tr('disk.hide')}
                                    onClick={close(() => void setHidden(list, !allHidden))}
                                />
                                <MenuItem icon="trash" label={tr('common.delete')} hint="Del" danger onClick={close(() => setPurge(list))} />
                            </>
                        ) : null}
                        {single?.kind === 'folder' && canManage && !searchMode ? (
                            <>
                                <span className="fm-disk-x__menu-sep" />
                                <MenuItem icon="shield" label={tr('disk.access')} onClick={close(() => { navigate(single.item.id); window.setTimeout(() => setAccessOpen(true), 0); })} />
                            </>
                        ) : null}
                    </>
                )}
            </div>
        );
    };

    const busy = load.loading && !data;
    const emptyFolder = !busy && !searchMode && entries.length === 0;
    const total = entries.length;

    return (
        <div className={`fm-disk fm-disk-x${accessOpen ? ' fm-disk--drawer' : ''}`}>
            <div className="fm-disk__main">
                <div className="fm-disk-cmd" ref={cmdRef}>
                    <div className="fm-disk-cmd__group">
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton icon="plus" label={tr('disk.create')} caret disabled={!canEdit} active={cmdMenu === 'create'} onClick={() => toggleCmd('create')} />
                            {cmdMenu === 'create' ? (
                                <div className="fm-disk-cmd__menu" role="menu">
                                    <button type="button" onClick={() => { setCreateOpen(true); setCmdMenu(null); }}>
                                        <Icon name="folder" className="fm-ico--folder" />{tr('browser.newFolder')}
                                    </button>
                                    <button type="button" onClick={() => { fileRef.current?.click(); setCmdMenu(null); }}>
                                        <Icon name="upload" />{tr('disk.uploadFiles')}
                                    </button>
                                    <button type="button" onClick={() => { dirRef.current?.click(); setCmdMenu(null); }}>
                                        <Icon name="folderOpen" />{tr('disk.uploadFolder')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <span className="fm-disk-cmd__sep" aria-hidden />

                    <div className="fm-disk-cmd__group">
                        <CmdButton icon="cut" title={`${tr('browser.cut')} (Ctrl+X)`} disabled={!canEdit || !selection.size} onClick={() => toClipboard('cut', [...selection])} />
                        <CmdButton icon="copy" title={`${tr('browser.copy')} (Ctrl+C)`} disabled={!selection.size} onClick={() => toClipboard('copy', [...selection])} />
                        <CmdButton icon="paste" title={`${tr('browser.paste')} (Ctrl+V)`} disabled={!canEdit || !clipboard || searchMode} onClick={() => void paste()} />
                        <CmdButton icon="rename" title={`${tr('disk.rename')} (F2)`} disabled={!canEdit || selectedEntries.length !== 1} onClick={() => setRenaming(selectedEntries[0] ?? null)} />
                        <CmdButton icon="download" title={tr('pane.download')} disabled={!selectedEntries.length} onClick={() => void downloadMany(selectedEntries)} />
                        <CmdButton icon="trash" title={`${tr('common.delete')} (Del)`} disabled={!canEdit || !selectedEntries.length} onClick={() => setPurge(selectedEntries)} />
                    </div>

                    <span className="fm-disk-cmd__sep" aria-hidden />

                    <div className="fm-disk-cmd__group">
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton icon="sort" label={tr('disk.sort')} caret active={cmdMenu === 'sort'} onClick={() => toggleCmd('sort')} />
                            {cmdMenu === 'sort' ? (
                                <div className="fm-disk-cmd__menu" role="menu">
                                    {([
                                        ['name', 'disk.sortName'],
                                        ['date', 'disk.sortDate'],
                                        ['type', 'disk.sortType'],
                                        ['size', 'disk.sortSize'],
                                    ] as const).map(([key, label]) => (
                                        <button key={key} type="button" className={sort.key === key ? 'is-on' : undefined} onClick={() => { setSort((prev) => ({ ...prev, key })); setCmdMenu(null); }}>
                                            {tr(label)}
                                        </button>
                                    ))}
                                    <span className="fm-disk-x__menu-sep" />
                                    {(['asc', 'desc'] as const).map((dir) => (
                                        <button key={dir} type="button" className={sort.dir === dir ? 'is-on' : undefined} onClick={() => { setSort((prev) => ({ ...prev, dir })); setCmdMenu(null); }}>
                                            {tr(dir === 'asc' ? 'disk.sortAsc' : 'disk.sortDesc')}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton icon="more" title={tr('nav.more')} active={cmdMenu === 'more'} onClick={() => toggleCmd('more')} />
                            {cmdMenu === 'more' ? (
                                <div className="fm-disk-cmd__menu" role="menu">
                                    <button type="button" disabled={!order.length} onClick={() => { setSelection(new Set(order)); setCmdMenu(null); }}>
                                        <Icon name="check" />{tr('disk.selectAll')}
                                    </button>
                                    <button type="button" disabled={!canEdit || !selectedEntries.length} onClick={() => { void setHidden(selectedEntries, !selectedEntries.every((e) => e.item.hidden)); setCmdMenu(null); }}>
                                        <Icon name="eye" />{selectedEntries.length && selectedEntries.every((e) => e.item.hidden) ? tr('disk.unhide') : tr('disk.hide')}
                                    </button>
                                    <button type="button" onClick={() => { refresh(); setCmdMenu(null); }}>
                                        <Icon name="refresh" />{tr('browser.refresh')}
                                    </button>
                                    <button type="button" onClick={() => { setHelpOpen(true); setCmdMenu(null); }}>
                                        <Icon name="key" />{tr('disk.shortcuts')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {canManage ? (
                        <>
                            <span className="fm-disk-cmd__sep" aria-hidden />
                            <div className="fm-disk-cmd__group">
                                <CmdButton icon="shield" label={tr('disk.access')} active={accessOpen} onClick={() => setAccessOpen((value) => !value)} />
                                <CmdButton icon="trash" label={tr('disk.deletedFiles')} active={deletedOpen} onClick={() => setDeletedOpen(true)} />
                            </div>
                        </>
                    ) : null}

                    <div className="fm-disk-cmd__spacer" />

                    <div className="fm-disk-cmd__group">
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton icon="panes" label={tr('disk.view')} caret active={cmdMenu === 'view'} onClick={() => toggleCmd('view')} />
                            {cmdMenu === 'view' ? (
                                <div className="fm-disk-cmd__menu fm-disk-cmd__menu--end" role="menu">
                                    <button type="button" className={layout === 'tiles' ? 'is-on' : undefined} onClick={() => { setLayout('tiles'); setCmdMenu(null); }}>
                                        <Icon name="grid" />{tr('disk.viewTiles')}
                                    </button>
                                    <button type="button" className={layout === 'details' ? 'is-on' : undefined} onClick={() => { setLayout('details'); setCmdMenu(null); }}>
                                        <Icon name="list" />{tr('disk.viewDetails')}
                                    </button>
                                    <span className="fm-disk-x__menu-sep" />
                                    <button type="button" className={`fm-disk-x__only-wide${treeOpen ? ' is-on' : ''}`} onClick={() => { setTreeOpen((v) => !v); setCmdMenu(null); }}>
                                        <Icon name="panes" />{tr('disk.navPane')}
                                    </button>
                                    <button type="button" className={showHidden ? 'is-on' : undefined} onClick={() => { setShowHidden((v) => !v); setCmdMenu(null); }}>
                                        <Icon name="eye" />{tr('disk.showHidden')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <label className="fm-disk__filter fm-disk-x__search">
                        <Icon name="search" />
                        <input
                            ref={searchRef}
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setQuery('');
                                    event.currentTarget.blur();
                                }
                            }}
                            placeholder={tr('disk.searchPlaceholder', { name: currentName })}
                            aria-label={tr('disk.searchPlaceholder', { name: currentName })}
                        />
                        {query ? (
                            <button type="button" className="fm-disk-x__clear" aria-label={tr('common.close')} onClick={() => setQuery('')}>
                                <Icon name="close" />
                            </button>
                        ) : null}
                    </label>

                    <input
                        ref={fileRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(event) => {
                            const list = event.target.files;
                            const picked = list ? Array.from(list).map((file) => ({ file, path: file.name })) : [];
                            event.target.value = '';
                            void uploadTo(picked, folderId);
                        }}
                    />
                    <input
                        ref={dirRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(event) => {
                            const list = event.target.files;
                            const picked = list ? pickedFolderFiles(list) : [];
                            event.target.value = '';
                            void uploadTo(picked, folderId);
                        }}
                    />
                </div>

                <nav className="fm-crumbs fm-disk__crumbs" aria-label={tr('disk.root')}>
                    <button type="button" className="fm-disk__nav-btn" disabled={!history.back.length} onClick={goBack} title={`${tr('disk.back')} (Alt+←)`} aria-label={tr('disk.back')}>
                        <Icon name="back" />
                    </button>
                    <button type="button" className="fm-disk__nav-btn fm-disk-x__fwd" disabled={!history.forward.length} onClick={goForward} title={`${tr('disk.forward')} (Alt+→)`} aria-label={tr('disk.forward')}>
                        <Icon name="back" />
                    </button>
                    <button type="button" className="fm-disk__nav-btn" disabled={!path.length} onClick={goUp} title={`${tr('disk.up')} (Backspace)`} aria-label={tr('disk.up')}>
                        <Icon name="up" />
                    </button>
                    <span className="fm-disk-x__crumbs">
                        <button
                            type="button"
                            className={`${!folderId ? 'is-on' : ''}${dropKey === `crumb:${ROOT_DROP}` ? ' is-drop' : ''}`}
                            onClick={() => navigate(null)}
                            {...dropProps(null, `crumb:${ROOT_DROP}`)}
                        >
                            <Icon name="home" />{tr('disk.root')}
                        </button>
                        {path.map((crumb) => (
                            <span key={crumb.id} className="fm-disk-x__crumb">
                                <Icon name="chevron" className="fm-disk-x__crumb-sep" />
                                <button
                                    type="button"
                                    className={`${folderId === crumb.id ? 'is-on' : ''}${dropKey === `crumb:${crumb.id}` ? ' is-drop' : ''}`}
                                    onClick={() => navigate(crumb.id)}
                                    {...dropProps(crumb.id, `crumb:${crumb.id}`)}
                                >
                                    {crumb.name}
                                </button>
                            </span>
                        ))}
                    </span>
                </nav>

                <div className={`fm-disk-x__split${treeOpen ? ' has-tree' : ''}`}>
                    {treeOpen ? (
                        <nav className="fm-disk-x__tree" aria-label={tr('disk.navPane')}>
                            <div role="tree">
                                <div
                                    className={`fm-disk-x__tree-row fm-disk-x__tree-root${!folderId ? ' is-current' : ''}${dropKey === `tree:${ROOT_DROP}` ? ' is-drop' : ''}`}
                                    {...dropProps(null, `tree:${ROOT_DROP}`)}
                                >
                                    <button type="button" className="fm-disk-x__tree-label" onClick={() => navigate(null)}>
                                        <Icon name="home" />
                                        <span>{tr('disk.treeRoot')}</span>
                                    </button>
                                </div>
                                <TreeBranch
                                    nodes={tree}
                                    depth={1}
                                    currentId={folderId}
                                    expanded={expanded}
                                    dropKey={dropKey}
                                    onToggle={(id) => setExpanded((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(id))
                                            next.delete(id);
                                        else
                                            next.add(id);
                                        return next;
                                    })}
                                    onOpen={(id) => navigate(id)}
                                    dropProps={dropProps}
                                />
                            </div>
                        </nav>
                    ) : null}

                    <section
                        className={`fm-tiles fm-disk__body${dropKey === 'body' ? ' is-dropping' : ''}`}
                        onDragOver={(event) => {
                            if (!canEdit || searchMode || !event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes(DRAG_MIME))
                                return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                            if (dropKey !== 'body')
                                setDropKey('body');
                        }}
                        onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                                setDropKey((current) => (current === 'body' ? null : current));
                        }}
                        onDrop={(event) => {
                            if (!event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes(DRAG_MIME))
                                return;
                            event.preventDefault();
                            setDropKey(null);
                            if (!canEdit || searchMode)
                                return;
                            void readDroppedItems(event.dataTransfer).then(({ files }) => uploadTo(files, folderId));
                        }}
                    >
                        {!canEdit && data ? <p className="fm-hint fm-disk__readonly">{tr('disk.readOnly')}</p> : null}
                        {searchMode ? (
                            <p className="fm-disk-x__banner" role="status">
                                {searching && !results
                                    ? tr('disk.searching')
                                    : tr('disk.searchResults', { name: currentName, count: total })}
                                {results?.truncated ? ` · ${tr('disk.searchTruncated', { count: total })}` : ''}
                            </p>
                        ) : null}
                        <div
                            ref={contentRef}
                            className="fm-tiles__content"
                            onClick={() => {
                                setSelection(new Set());
                                setMenu(null);
                            }}
                            onContextMenu={(event) => openCtx(event, { kind: 'blank' })}
                        >
                            <StateBlock
                                loading={busy || (searchMode && searching && !results)}
                                error={load.error}
                                onRetry={load.reload}
                                empty={emptyFolder
                                    ? <div className="fm-ex__empty"><Icon name="folder" /><p>{tr('disk.empty')}</p>{canEdit ? <small>{tr('disk.emptyHint')}</small> : null}</div>
                                    : searchMode && results && !total
                                        ? <div className="fm-ex__empty"><Icon name="search" /><p>{tr('disk.searchEmpty')}</p></div>
                                        : undefined}
                            >
                                {layout === 'tiles' ? renderTiles() : renderDetails()}
                            </StateBlock>
                            {renderMenu()}
                            {dropKey === 'body' ? (
                                <div className="fm-disk-x__dropzone" aria-hidden>
                                    <Icon name="upload" />
                                    <span>{tr('disk.dropUpload', { name: currentName })}</span>
                                </div>
                            ) : null}
                        </div>
                        <p className="fm-disk__status">
                            {data?.level ? <LevelBadge level={data.level as AclLevel} /> : null}
                            <span>{tr('disk.items', { count: total })}</span>
                            {selection.size ? (
                                <span>
                                    {tr('disk.selected', { count: selection.size })}
                                    {selectedBytes ? ` · ${formatBytes(selectedBytes, locale)}` : ''}
                                </span>
                            ) : null}
                            {uploading ? <span className="fm-disk-x__busy">{tr('disk.uploadingCount', { count: uploading })}</span> : null}
                            {clipboard ? (
                                <span className="fm-disk-x__clip">
                                    <Icon name={clipboard.mode === 'cut' ? 'cut' : 'copy'} />
                                    {clipboard.keys.size}
                                    <button type="button" aria-label={tr('common.close')} onClick={() => setClipboard(null)}><Icon name="close" /></button>
                                </span>
                            ) : null}
                            {showHidden ? <span className="fm-disk-x__tag">{tr('disk.showHidden')}</span> : null}
                        </p>
                    </section>
                </div>
            </div>
            {accessOpen && canManage ? (
                <AccessDrawer folderId={folderId} folderName={currentName} onClose={() => setAccessOpen(false)} />
            ) : null}
            {deletedOpen && canManage ? (
                <DeletedFilesModal onClose={() => setDeletedOpen(false)} onRestored={refresh} />
            ) : null}
            {createOpen ? (
                <NameModal
                    title={tr('browser.newFolder')}
                    initial={tr('disk.newFolderName')}
                    label={tr('browser.folderName')}
                    hint={tr('disk.newFolderHint')}
                    allowPath
                    onClose={() => setCreateOpen(false)}
                    onSubmit={async (name) => {
                        const next = await act(() => diskApi.createFolder(name, folderId, showHidden), tr('disk.folderCreated'));
                        if (next) {
                            setData(next);
                            treeLoad.reload();
                            const firstLevel = next.folders.find((folder) => folder.name.toLowerCase() === name.split(/[\\/]/)[0]!.trim().toLowerCase());
                            const created = next.createdId && next.folders.some((folder) => folder.id === next.createdId) ? next.createdId : firstLevel?.id;
                            if (created) {
                                setSelection(new Set([itemKey('folder', created)]));
                                setAnchor(itemKey('folder', created));
                            }
                        }
                        return Boolean(next);
                    }}
                />
            ) : null}
            {renaming ? (
                <NameModal
                    title={tr('disk.rename')}
                    initial={renaming.item.name}
                    label={tr('common.name')}
                    selectStem={renaming.kind === 'file'}
                    onClose={() => setRenaming(null)}
                    onSubmit={async (name) => {
                        if (name === renaming.item.name)
                            return true;
                        const next = await act(
                            () => (renaming.kind === 'folder'
                                ? diskApi.renameFolder(renaming.item.id, name, showHidden)
                                : diskApi.renameFile(renaming.item.id, name, showHidden)),
                            tr('disk.renamed'),
                        );
                        if (next)
                            refresh();
                        return Boolean(next);
                    }}
                />
            ) : null}
            {purge ? (
                <ConfirmModal
                    title={tr('common.delete')}
                    text={purge.length > 1
                        ? tr('disk.deleteManyConfirm', { count: purge.length })
                        : purge[0]!.kind === 'folder'
                            ? tr('disk.deleteFolderConfirm', { name: purge[0]!.item.name })
                            : tr('disk.deleteFileConfirm', { name: purge[0]!.item.name })}
                    confirmLabel={tr('common.delete')}
                    danger
                    onClose={() => setPurge(null)}
                    onConfirm={async () => {
                        const sel = toSelection(purge.map(entryKey));
                        await act(() => diskApi.remove(sel), tr('disk.deleted', { count: purge.length }));
                        setSelection(new Set());
                        refresh();
                    }}
                />
            ) : null}
            {previewing ? (
                <Modal
                    title={previewing.name}
                    wide
                    onClose={() => setPreviewing(null)}
                    footer={(
                        <>
                            <button type="button" className="fm-btn" onClick={() => setPreviewing(null)}>{tr('common.close')}</button>
                            <button type="button" className="fm-btn fm-btn--primary" onClick={() => void downloadFile(previewing)}><Icon name="download" />{tr('preview.download')}</button>
                        </>
                    )}
                >
                    <div className="fm-pv-modal">
                        <FilePreview source={diskSource(previewing)} onDownload={() => void downloadFile(previewing)} />
                    </div>
                </Modal>
            ) : null}
            {helpOpen ? (
                <Modal title={tr('disk.shortcuts')} onClose={() => setHelpOpen(false)}>
                    <ul className="fm-disk-x__keys">
                        {tr('disk.shortcutsText').split(' · ').map((line) => {
                            const [keys, ...rest] = line.split(' — ');
                            return (
                                <li key={line}>
                                    <kbd>{keys}</kbd>
                                    <span>{rest.join(' — ')}</span>
                                </li>
                            );
                        })}
                    </ul>
                </Modal>
            ) : null}
        </div>
    );
}
