import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
} from './fmShared';

const ACL_LEVELS: AclLevel[] = ['read', 'edit', 'manage', 'deny'];

type Entry =
    | { kind: 'folder'; item: DiskFolder }
    | { kind: 'file'; item: DiskFile };

function userLabel(user: TimeTrackingUserRow): string {
    return (user.display_name ?? '').trim() || user.email;
}

function asFileKind(kind: string): FileKind {
    const allowed: FileKind[] = ['pdf', 'doc', 'sheet', 'slides', 'email', 'image', 'archive', 'text', 'file'];
    return (allowed.includes(kind as FileKind) ? kind : 'file') as FileKind;
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

export function DiskView() {
    const { tr, locale } = useFm();
    const act = useAction();
    const [folderId, setFolderId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Entry | null>(null);
    const [filter, setFilter] = useState('');
    const [dropping, setDropping] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [accessOpen, setAccessOpen] = useState(false);
    const [purge, setPurge] = useState<Entry | null>(null);
    const [data, setData] = useState<DiskBrowse | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const load = useLoad(() => diskApi.browse(folderId), [folderId]);

    useEffect(() => {
        if (load.data)
            setData(load.data);
    }, [load.data]);

    useEffect(() => {
        setSelected(null);
        setAccessOpen(false);
    }, [folderId]);

    const folders = data?.folders ?? [];
    const files = data?.files ?? [];
    const canEdit = data?.canEdit ?? false;
    const canManage = data?.canManage ?? false;
    const path = data?.path ?? [];
    const q = filter.trim().toLowerCase();
    const visibleFolders = useMemo(
        () => folders.filter((item) => !q || item.name.toLowerCase().includes(q)),
        [folders, q],
    );
    const visibleFiles = useMemo(
        () => files.filter((item) => !q || item.name.toLowerCase().includes(q)),
        [files, q],
    );
    const upId = path.length > 1 ? path[path.length - 2]!.id : null;
    const currentName = path.length ? path[path.length - 1]!.name : tr('disk.root');

    const applyBrowse = (next: DiskBrowse) => {
        setData(next);
        setSelected(null);
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

    return (
        <div className={`fm-disk${accessOpen ? ' fm-disk--drawer' : ''}`}>
            <div className="fm-disk__main">
                <div className="fm-disk__bar">
                    <button type="button" className="fm-btn" disabled={!path.length} onClick={() => setFolderId(upId)} title={tr('browser.up')}>
                        <Icon name="up" />{tr('browser.up')}
                    </button>
                    <button type="button" className="fm-btn" onClick={() => load.reload()} title={tr('browser.refresh')}>
                        <Icon name="refresh" />{tr('browser.refresh')}
                    </button>
                    <span className="fm-disk__sep" aria-hidden />
                    {canEdit ? (
                        <>
                            <button type="button" className="fm-btn" onClick={() => setCreateOpen(true)}>
                                <Icon name="plus" />{tr('browser.newFolder')}
                            </button>
                            <button type="button" className="fm-btn fm-btn--primary" onClick={() => fileRef.current?.click()}>
                                <Icon name="upload" />{tr('browser.upload')}
                            </button>
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
                        </>
                    ) : null}
                    {canManage ? (
                        <button type="button" className={`fm-btn${accessOpen ? ' is-on' : ''}`} onClick={() => setAccessOpen((v) => !v)}>
                            <Icon name="shield" />{tr('disk.access')}
                        </button>
                    ) : null}
                    <label className="fm-disk__filter">
                        <Icon name="search" />
                        <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={tr('disk.filter')} />
                    </label>
                </div>
                <nav className="fm-crumbs fm-disk__crumbs" aria-label={tr('disk.root')}>
                    <button type="button" className={!folderId ? 'is-on' : undefined} onClick={() => setFolderId(null)}>
                        {tr('disk.root')}
                    </button>
                    {path.map((crumb) => (
                        <button key={crumb.id} type="button" className={folderId === crumb.id ? 'is-on' : undefined} onClick={() => setFolderId(crumb.id)}>
                            {crumb.name}
                        </button>
                    ))}
                </nav>
                <p className="fm-hint">{tr('disk.hint')}</p>
                {!canEdit && data ? <p className="fm-hint">{tr('disk.readOnly')}</p> : null}
                <section
                    className={`fm-docs fm-docs--padded fm-disk__body${dropping ? ' is-dropping' : ''}`}
                    onDragOver={(event) => {
                        if (!canEdit)
                            return;
                        event.preventDefault();
                        setDropping(true);
                    }}
                    onDragLeave={() => setDropping(false)}
                    onDrop={(event) => void onDrop(event)}
                >
                    <StateBlock
                        loading={load.loading && !data}
                        error={load.error}
                        onRetry={load.reload}
                        empty={!load.loading && visibleFolders.length === 0 && visibleFiles.length === 0
                            ? <><Icon name="folder" /><p>{tr('disk.empty')}</p></>
                            : undefined}
                    >
                        <div className="fm-table-wrap">
                            <table className="fm-table">
                                <thead>
                                    <tr>
                                        <th>{tr('table.name')}</th>
                                        <th>{tr('disk.type')}</th>
                                        <th>{tr('table.modified')}</th>
                                        <th>{tr('table.size')}</th>
                                        <th className="fm-table__actions" />
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
                                                <td className="fm-table__actions">
                                                    <span className="fm-table__actions-row">
                                                        <button type="button" className="fm-btn" onClick={(event) => { event.stopPropagation(); setFolderId(item.id); }}>
                                                            <Icon name="folderOpen" />{tr('disk.open')}
                                                        </button>
                                                        {canEdit ? (
                                                            <button type="button" className="fm-btn fm-btn--danger" onClick={(event) => { event.stopPropagation(); setPurge({ kind: 'folder', item }); }}>
                                                                <Icon name="trash" />{tr('common.delete')}
                                                            </button>
                                                        ) : null}
                                                    </span>
                                                </td>
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
                                            >
                                                <td>
                                                    <span className="fm-table__name">
                                                        <span className="fm-table__ico" aria-hidden><FileBadge kind={asFileKind(String(item.kind))} /></span>
                                                        <strong>{item.name}</strong>
                                                    </span>
                                                </td>
                                                <td>{tr('browser.fileType')}</td>
                                                <td className="fm-nowrap">{formatDateTime(item.createdAt, locale)}</td>
                                                <td>{item.sizeBytes != null ? formatBytes(item.sizeBytes, locale) : item.size}</td>
                                                <td className="fm-table__actions">
                                                    <span className="fm-table__actions-row">
                                                        <button
                                                            type="button"
                                                            className="fm-btn"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void act(async () => {
                                                                    const blob = await diskApi.downloadBlob(item.id);
                                                                    saveBlob(blob, item.name);
                                                                    return true;
                                                                });
                                                            }}
                                                        >
                                                            <Icon name="download" />{tr('pane.download')}
                                                        </button>
                                                        {canEdit ? (
                                                            <button type="button" className="fm-btn fm-btn--danger" onClick={(event) => { event.stopPropagation(); setPurge({ kind: 'file', item }); }}>
                                                                <Icon name="trash" />{tr('common.delete')}
                                                            </button>
                                                        ) : null}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </StateBlock>
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
