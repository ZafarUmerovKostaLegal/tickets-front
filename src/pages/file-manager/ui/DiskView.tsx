import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { listTimeTrackingUsers, type TimeTrackingUserRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import { diskApi, type DiskBrowse, type DiskFile, type DiskFolder } from '../api/diskApi';
import type { AclLevel, FileKind } from '../api/filesApi';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { FmSelect } from './fmSelect';
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
    type IconName,
} from './fmShared';

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
type SortKey = 'name' | 'date' | 'size';
type Layout = 'tiles' | 'details';

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

function compareText(a: string, b: string) {
    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

function sortFolders(items: DiskFolder[], sortBy: SortKey) {
    const next = [...items];
    next.sort((a, b) => {
        if (sortBy === 'date')
            return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || compareText(a.name, b.name);
        return compareText(a.name, b.name);
    });
    return next;
}

function sortFiles(items: DiskFile[], sortBy: SortKey) {
    const next = [...items];
    next.sort((a, b) => {
        if (sortBy === 'date')
            return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || compareText(a.name, b.name);
        if (sortBy === 'size')
            return ((b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)) || compareText(a.name, b.name);
        return compareText(a.name, b.name);
    });
    return next;
}

function NameModal({ title, initial, label, onClose, onSubmit }: {
    title: string;
    initial: string;
    label: string;
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
                <button type="button" className="fm-btn fm-btn--primary" disabled={busy || !name.trim()} onClick={() => void submit()}>
                    {tr('common.save')}
                </button>
            </>
        )}>
            <label className="fm-field">
                <span>{label}</span>
                <input
                    autoFocus
                    value={name}
                    maxLength={300}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter')
                            void submit();
                    }}
                />
            </label>
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
                            () => diskApi.setAcl(folderId, {
                                userId: user.id,
                                userName: userLabel(user),
                                level: addLevel,
                                note,
                            }),
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
                                            await diskApi.setAcl(folderId, {
                                                userId: row.userId,
                                                userName: row.userName,
                                                level: level as AclLevel,
                                                note: row.note,
                                            });
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

function CmdButton({
    icon,
    label,
    title,
    disabled,
    active,
    caret,
    onClick,
}: {
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
            disabled={disabled}
            onClick={onClick}
        >
            <Icon name={icon} />
            {label ? <span>{label}</span> : null}
            {caret ? <Icon name="chevron" className="fm-disk-cmd__caret" /> : null}
        </button>
    );
}

export function DiskView() {
    const { tr, locale } = useFm();
    const act = useAction();
    const [folderId, setFolderId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Entry | null>(null);
    const [filter, setFilter] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('name');
    const [layout, setLayout] = useState<Layout>('tiles');
    const [cmdMenu, setCmdMenu] = useState<CmdMenu>(null);
    const [dropping, setDropping] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [accessOpen, setAccessOpen] = useState(false);
    const [purge, setPurge] = useState<Entry | null>(null);
    const [menu, setMenu] = useState<CtxMenu | null>(null);
    const [data, setData] = useState<DiskBrowse | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const cmdRef = useRef<HTMLDivElement>(null);
    const load = useLoad(() => diskApi.browse(folderId), [folderId]);

    useEffect(() => {
        if (load.data)
            setData(load.data);
    }, [load.data]);

    useEffect(() => {
        setSelected(null);
        setAccessOpen(false);
        setMenu(null);
        setCmdMenu(null);
    }, [folderId]);

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

    const folders = data?.folders ?? [];
    const files = data?.files ?? [];
    const canEdit = data?.canEdit ?? false;
    const canManage = data?.canManage ?? false;
    const path = data?.path ?? [];
    const q = filter.trim().toLowerCase();
    const visibleFolders = useMemo(
        () => sortFolders(folders.filter((item) => !q || item.name.toLowerCase().includes(q)), sortBy),
        [folders, q, sortBy],
    );
    const visibleFiles = useMemo(
        () => sortFiles(files.filter((item) => !q || item.name.toLowerCase().includes(q)), sortBy),
        [files, q, sortBy],
    );
    const upId = path.length > 1 ? path[path.length - 2]!.id : null;
    const currentName = path.length ? path[path.length - 1]!.name : tr('disk.root');
    const empty = !load.loading && visibleFolders.length === 0 && visibleFiles.length === 0;
    const hasSelection = selected !== null;
    const canDownload = selected?.kind === 'file';
    const canDelete = canEdit && hasSelection;

    const applyBrowse = (next: DiskBrowse) => {
        setData(next);
        setSelected(null);
        setMenu(null);
        setCmdMenu(null);
    };

    const uploadFiles = async (list: FileList | File[]) => {
        const filesToUpload = [...list];
        if (!filesToUpload.length || !canEdit)
            return;
        const ok = await act(
            () => diskApi.upload(filesToUpload, folderId),
            tr('browser.uploaded', { count: filesToUpload.length }),
        );
        if (ok && typeof ok === 'object')
            applyBrowse(ok as DiskBrowse);
        else
            load.reload();
    };

    const onDrop = async (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDropping(false);
        if (!canEdit)
            return;
        await uploadFiles(event.dataTransfer.files);
    };

    const openCtx = (event: ReactMouseEvent, target: CtxMenu['target']) => {
        event.preventDefault();
        event.stopPropagation();
        setCmdMenu(null);
        const host = contentRef.current;
        if (!host) {
            setMenu({ x: event.clientX, y: event.clientY, target });
            return;
        }
        const rect = host.getBoundingClientRect();
        setMenu({
            x: Math.min(Math.max(8, event.clientX - rect.left), Math.max(8, rect.width - 180)),
            y: Math.min(Math.max(8, event.clientY - rect.top), Math.max(8, rect.height - 120)),
            target,
        });
        if (target.kind === 'folder' || target.kind === 'file')
            setSelected(target);
    };

    const downloadFile = async (item: DiskFile) => {
        await act(async () => {
            const blob = await diskApi.downloadBlob(item.id);
            saveBlob(blob, item.name);
            return true;
        });
    };

    const toggleCmd = (next: Exclude<CmdMenu, null>) => {
        setMenu(null);
        setCmdMenu((current) => (current === next ? null : next));
    };

    const renderTiles = () => (
        <div className="fm-ex__tiles fm-ex__tiles--page fm-disk__tiles">
            {path.length ? (
                <button
                    type="button"
                    className="fm-ex__tile fm-ex__tile--up"
                    onClick={(event) => {
                        event.stopPropagation();
                        setFolderId(upId);
                    }}
                    onDoubleClick={(event) => {
                        event.stopPropagation();
                        setFolderId(upId);
                    }}
                >
                    <span className="fm-ex__tile-ico" aria-hidden>
                        <Icon name="up" />
                    </span>
                    <span className="fm-ex__tile-meta">
                        <strong>..</strong>
                        <small>{tr('browser.up')}</small>
                    </span>
                </button>
            ) : null}
            {visibleFolders.map((item) => {
                const active = selected?.kind === 'folder' && selected.item.id === item.id;
                return (
                    <button
                        key={`folder:${item.id}`}
                        type="button"
                        className={active ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                        onClick={(event) => {
                            event.stopPropagation();
                            setSelected({ kind: 'folder', item });
                            setMenu(null);
                        }}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            setFolderId(item.id);
                        }}
                        onContextMenu={(event) => openCtx(event, { kind: 'folder', item })}
                    >
                        <span className="fm-ex__tile-ico" aria-hidden>
                            <Icon name="folder" className="fm-ico--folder" />
                        </span>
                        <span className="fm-ex__tile-meta">
                            <strong title={item.name}>{item.name}</strong>
                            <small>{tr('browser.folderType')}</small>
                        </span>
                    </button>
                );
            })}
            {visibleFiles.map((item) => {
                const active = selected?.kind === 'file' && selected.item.id === item.id;
                const sizeLabel = item.sizeBytes != null ? formatBytes(item.sizeBytes, locale) : item.size;
                return (
                    <button
                        key={`file:${item.id}`}
                        type="button"
                        className={active ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                        onClick={(event) => {
                            event.stopPropagation();
                            setSelected({ kind: 'file', item });
                            setMenu(null);
                        }}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            void downloadFile(item);
                        }}
                        onContextMenu={(event) => openCtx(event, { kind: 'file', item })}
                    >
                        <span className="fm-ex__tile-ico" aria-hidden>
                            <FileBadge kind={asFileKind(String(item.kind))} />
                        </span>
                        <span className="fm-ex__tile-meta">
                            <strong title={item.name}>{item.name}</strong>
                            <small>
                                {kindLabel(String(item.kind), tr)}
                                {sizeLabel ? ` · ${sizeLabel}` : ''}
                            </small>
                        </span>
                    </button>
                );
            })}
        </div>
    );

    const renderDetails = () => (
        <div className="fm-table-wrap fm-disk__details">
            <table className="fm-table">
                <thead>
                    <tr>
                        <th>{tr('table.name')}</th>
                        <th>{tr('disk.type')}</th>
                        <th>{tr('table.modified')}</th>
                        <th>{tr('table.size')}</th>
                    </tr>
                </thead>
                <tbody>
                    {visibleFolders.map((item) => {
                        const active = selected?.kind === 'folder' && selected.item.id === item.id;
                        return (
                            <tr
                                key={`folder:${item.id}`}
                                className={active ? 'is-selected' : undefined}
                                onClick={() => setSelected({ kind: 'folder', item })}
                                onDoubleClick={() => setFolderId(item.id)}
                                onContextMenu={(event) => openCtx(event, { kind: 'folder', item })}
                            >
                                <td>
                                    <span className="fm-table__name">
                                        <span className="fm-table__ico" aria-hidden><Icon name="folder" className="fm-ico--folder" /></span>
                                        <strong>{item.name}</strong>
                                    </span>
                                </td>
                                <td>{tr('browser.folderType')}</td>
                                <td className="fm-nowrap">{formatDateTime(item.createdAt, locale)}</td>
                                <td>—</td>
                            </tr>
                        );
                    })}
                    {visibleFiles.map((item) => {
                        const active = selected?.kind === 'file' && selected.item.id === item.id;
                        return (
                            <tr
                                key={`file:${item.id}`}
                                className={active ? 'is-selected' : undefined}
                                onClick={() => setSelected({ kind: 'file', item })}
                                onDoubleClick={() => void downloadFile(item)}
                                onContextMenu={(event) => openCtx(event, { kind: 'file', item })}
                            >
                                <td>
                                    <span className="fm-table__name">
                                        <span className="fm-table__ico" aria-hidden><FileBadge kind={asFileKind(String(item.kind))} /></span>
                                        <strong>{item.name}</strong>
                                    </span>
                                </td>
                                <td>{kindLabel(String(item.kind), tr)}</td>
                                <td className="fm-nowrap">{formatDateTime(item.createdAt, locale)}</td>
                                <td>{item.sizeBytes != null ? formatBytes(item.sizeBytes, locale) : item.size}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className={`fm-disk${accessOpen ? ' fm-disk--drawer' : ''}`}>
            <div className="fm-disk__main">
                <div className="fm-disk-cmd" ref={cmdRef}>
                    <div className="fm-disk-cmd__group">
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton
                                icon="plus"
                                label={tr('disk.create')}
                                caret
                                disabled={!canEdit}
                                active={cmdMenu === 'create'}
                                onClick={() => toggleCmd('create')}
                            />
                            {cmdMenu === 'create' ? (
                                <div className="fm-disk-cmd__menu" role="menu">
                                    <button type="button" onClick={() => { setCreateOpen(true); setCmdMenu(null); }}>
                                        <Icon name="folder" className="fm-ico--folder" />{tr('browser.newFolder')}
                                    </button>
                                    <button type="button" onClick={() => { fileRef.current?.click(); setCmdMenu(null); }}>
                                        <Icon name="upload" />{tr('browser.upload')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <span className="fm-disk-cmd__sep" aria-hidden />

                    <div className="fm-disk-cmd__group">
                        <CmdButton icon="cut" title={`${tr('browser.cut')} (${tr('disk.soon')})`} disabled />
                        <CmdButton icon="copy" title={`${tr('browser.copy')} (${tr('disk.soon')})`} disabled />
                        <CmdButton icon="paste" title={`${tr('browser.paste')} (${tr('disk.soon')})`} disabled />
                        <CmdButton icon="rename" title={`${tr('browser.renameFolder')} (${tr('disk.soon')})`} disabled />
                        <CmdButton
                            icon="download"
                            title={tr('pane.download')}
                            disabled={!canDownload}
                            onClick={() => {
                                if (selected?.kind === 'file')
                                    void downloadFile(selected.item);
                            }}
                        />
                        <CmdButton
                            icon="trash"
                            title={tr('common.delete')}
                            disabled={!canDelete}
                            onClick={() => {
                                if (selected)
                                    setPurge(selected);
                            }}
                        />
                    </div>

                    <span className="fm-disk-cmd__sep" aria-hidden />

                    <div className="fm-disk-cmd__group">
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton
                                icon="sort"
                                label={tr('disk.sort')}
                                caret
                                active={cmdMenu === 'sort'}
                                onClick={() => toggleCmd('sort')}
                            />
                            {cmdMenu === 'sort' ? (
                                <div className="fm-disk-cmd__menu" role="menu">
                                    {([
                                        ['name', 'disk.sortName'],
                                        ['date', 'disk.sortDate'],
                                        ['size', 'disk.sortSize'],
                                    ] as const).map(([key, label]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            className={sortBy === key ? 'is-on' : undefined}
                                            onClick={() => { setSortBy(key); setCmdMenu(null); }}
                                        >
                                            {tr(label)}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton
                                icon="more"
                                title={tr('nav.more')}
                                active={cmdMenu === 'more'}
                                onClick={() => toggleCmd('more')}
                            />
                            {cmdMenu === 'more' ? (
                                <div className="fm-disk-cmd__menu" role="menu">
                                    <button type="button" disabled={!path.length} onClick={() => { setFolderId(upId); setCmdMenu(null); }}>
                                        <Icon name="up" />{tr('browser.up')}
                                    </button>
                                    <button type="button" onClick={() => { load.reload(); setCmdMenu(null); }}>
                                        <Icon name="refresh" />{tr('browser.refresh')}
                                    </button>
                                    {canManage ? (
                                        <button type="button" onClick={() => { setAccessOpen(true); setCmdMenu(null); }}>
                                            <Icon name="shield" />{tr('disk.access')}
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {canManage ? (
                        <>
                            <span className="fm-disk-cmd__sep" aria-hidden />
                            <div className="fm-disk-cmd__group">
                                <CmdButton
                                    icon="shield"
                                    label={tr('disk.access')}
                                    active={accessOpen}
                                    onClick={() => setAccessOpen((value) => !value)}
                                />
                            </div>
                        </>
                    ) : null}

                    <div className="fm-disk-cmd__spacer" />

                    <div className="fm-disk-cmd__group">
                        <div className="fm-disk-cmd__menu-wrap">
                            <CmdButton
                                icon="panes"
                                label={tr('disk.view')}
                                caret
                                active={cmdMenu === 'view'}
                                onClick={() => toggleCmd('view')}
                            />
                            {cmdMenu === 'view' ? (
                                <div className="fm-disk-cmd__menu fm-disk-cmd__menu--end" role="menu">
                                    <button type="button" className={layout === 'tiles' ? 'is-on' : undefined} onClick={() => { setLayout('tiles'); setCmdMenu(null); }}>
                                        <Icon name="grid" />{tr('disk.viewTiles')}
                                    </button>
                                    <button type="button" className={layout === 'details' ? 'is-on' : undefined} onClick={() => { setLayout('details'); setCmdMenu(null); }}>
                                        <Icon name="list" />{tr('disk.viewDetails')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <label className="fm-disk__filter">
                        <Icon name="search" />
                        <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={tr('disk.filter')} />
                    </label>

                    <input
                        ref={fileRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(event) => {
                            const list = event.target.files;
                            event.target.value = '';
                            if (list)
                                void uploadFiles(list);
                        }}
                    />
                </div>

                <nav className="fm-crumbs fm-disk__crumbs" aria-label={tr('disk.root')}>
                    <button type="button" className="fm-disk__nav-btn" disabled={!path.length} onClick={() => setFolderId(upId)} title={tr('browser.up')}>
                        <Icon name="up" />
                    </button>
                    <button type="button" className={!folderId ? 'is-on' : undefined} onClick={() => setFolderId(null)}>
                        {tr('disk.root')}
                    </button>
                    {path.map((crumb) => (
                        <button key={crumb.id} type="button" className={folderId === crumb.id ? 'is-on' : undefined} onClick={() => setFolderId(crumb.id)}>
                            {crumb.name}
                        </button>
                    ))}
                </nav>
                {!canEdit && data ? <p className="fm-hint fm-disk__readonly">{tr('disk.readOnly')}</p> : null}
                <section
                    className={`fm-tiles fm-disk__body${dropping ? ' is-dropping' : ''}`}
                    onDragOver={(event) => {
                        if (!canEdit)
                            return;
                        event.preventDefault();
                        setDropping(true);
                    }}
                    onDragLeave={() => setDropping(false)}
                    onDrop={(event) => void onDrop(event)}
                >
                    <div
                        ref={contentRef}
                        className="fm-tiles__content"
                        onClick={() => {
                            setSelected(null);
                            setMenu(null);
                        }}
                        onContextMenu={(event) => openCtx(event, { kind: 'blank' })}
                    >
                        <StateBlock
                            loading={load.loading && !data}
                            error={load.error}
                            onRetry={load.reload}
                            empty={empty ? <div className="fm-ex__empty"><Icon name="folder" /><p>{tr('disk.empty')}</p></div> : undefined}
                        >
                            {!empty ? (layout === 'tiles' ? renderTiles() : renderDetails()) : null}
                        </StateBlock>
                        {menu ? (() => {
                            const target = menu.target;
                            return (
                                <div
                                    className="fm-ex__menu"
                                    style={{ left: menu.x, top: menu.y }}
                                    role="menu"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    {target.kind === 'folder' ? (
                                        <>
                                            <button type="button" onClick={() => { setFolderId(target.item.id); setMenu(null); }}>
                                                {tr('disk.open')}
                                            </button>
                                            {canEdit ? (
                                                <button type="button" className="is-danger" onClick={() => { setPurge(target); setMenu(null); }}>
                                                    {tr('common.delete')}
                                                </button>
                                            ) : null}
                                        </>
                                    ) : null}
                                    {target.kind === 'file' ? (
                                        <>
                                            <button type="button" onClick={() => { void downloadFile(target.item); setMenu(null); }}>
                                                {tr('pane.download')}
                                            </button>
                                            {canEdit ? (
                                                <button type="button" className="is-danger" onClick={() => { setPurge(target); setMenu(null); }}>
                                                    {tr('common.delete')}
                                                </button>
                                            ) : null}
                                        </>
                                    ) : null}
                                    {target.kind === 'blank' ? (
                                        <>
                                            <button type="button" onClick={() => { load.reload(); setMenu(null); }}>
                                                {tr('browser.refresh')}
                                            </button>
                                            {canEdit ? (
                                                <button type="button" onClick={() => { setCreateOpen(true); setMenu(null); }}>
                                                    {tr('browser.newFolder')}
                                                </button>
                                            ) : null}
                                        </>
                                    ) : null}
                                </div>
                            );
                        })() : null}
                    </div>
                    {data?.level ? (
                        <p className="fm-disk__status">
                            <LevelBadge level={data.level as AclLevel} />
                            <span>{tr('disk.items', { count: visibleFolders.length + visibleFiles.length })}</span>
                        </p>
                    ) : null}
                </section>
            </div>
            {accessOpen && canManage ? (
                <AccessDrawer folderId={folderId} folderName={currentName} onClose={() => setAccessOpen(false)} />
            ) : null}
            {createOpen ? (
                <NameModal
                    title={tr('browser.newFolder')}
                    initial={tr('disk.newFolderName')}
                    label={tr('browser.folderName')}
                    onClose={() => setCreateOpen(false)}
                    onSubmit={async (name) => {
                        const next = await act(() => diskApi.createFolder(name, folderId), tr('disk.folderCreated'));
                        if (next && typeof next === 'object')
                            applyBrowse(next as DiskBrowse);
                        return Boolean(next);
                    }}
                />
            ) : null}
            {purge ? (
                <ConfirmModal
                    title={tr('common.delete')}
                    text={purge.kind === 'folder'
                        ? tr('disk.deleteFolderConfirm', { name: purge.item.name })
                        : tr('disk.deleteFileConfirm', { name: purge.item.name })}
                    confirmLabel={tr('common.delete')}
                    danger
                    onClose={() => setPurge(null)}
                    onConfirm={async () => {
                        const next = await act(async () => (
                            purge.kind === 'folder'
                                ? diskApi.deleteFolder(purge.item.id)
                                : diskApi.deleteFile(purge.item.id)
                        ));
                        if (next && typeof next === 'object')
                            applyBrowse(next as DiskBrowse);
                        else
                            load.reload();
                    }}
                />
            ) : null}
        </div>
    );
}
