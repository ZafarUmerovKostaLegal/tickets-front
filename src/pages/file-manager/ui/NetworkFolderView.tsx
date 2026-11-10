import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import { FmSelect } from './fmSelect';
import { ConfirmModal, Icon, Modal, useAction, useFm } from './fmShared';
import {
    connectNetDrive,
    copyNetEntryTo,
    createNetFolder,
    deleteNetEntries,
    grantNetAccess,
    listNetEntries,
    loadNetAcl,
    loadNetDriveConnection,
    moveNetEntries,
    netCrumbs,
    netDriveAvailable,
    renameNetEntry,
    revokeNetAccess,
    uniqueChildName,
    uploadNetFiles,
    type NetAclRule,
    type NetEntry,
} from './networkFolderLogic';

type Clipboard = { mode: 'cut' | 'copy'; entries: NetEntry[] };
type CtxMenu = { x: number; y: number; target: { kind: 'blank' } | { kind: 'entry'; entry: NetEntry } };
type NameModal = { mode: 'create' | 'rename'; initial: string };
type DrawerTab = 'details' | 'access';

const ACL_LEVELS: Array<NetAclRule['level']> = ['read', 'edit', 'manage'];

function NamePrompt({
    title,
    label,
    initial,
    onClose,
    onSubmit,
}: {
    title: string;
    label: string;
    initial: string;
    onClose: () => void;
    onSubmit: (name: string) => Promise<boolean> | boolean;
}) {
    const { tr } = useFm();
    const [name, setName] = useState(initial);
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!name.trim() || busy)
            return;
        setBusy(true);
        try {
            if (await onSubmit(name.trim()))
                onClose();
        }
        finally {
            setBusy(false);
        }
    };
    return (
        <Modal
            title={title}
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="fm-btn" onClick={onClose}>{tr('common.cancel')}</button>
                    <button type="button" className="fm-btn fm-btn--primary" disabled={busy || !name.trim()} onClick={() => void submit()}>
                        {tr('common.save')}
                    </button>
                </>
            )}
        >
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

function DetailsDrawer({
    entry,
    location,
    childCount,
    rules,
    tab,
    loadingAcl,
    onTab,
    onClose,
    onOpen,
    onRename,
    onDelete,
    onGrant,
    onChangeLevel,
    onRemove,
}: {
    entry: NetEntry;
    location: string;
    childCount: number;
    rules: NetAclRule[];
    tab: DrawerTab;
    loadingAcl: boolean;
    onTab: (tab: DrawerTab) => void;
    onClose: () => void;
    onOpen: () => void;
    onRename: () => void;
    onDelete: () => void;
    onGrant: (account: string, level: NetAclRule['level'], note: string) => Promise<void>;
    onChangeLevel: (account: string, level: NetAclRule['level']) => Promise<void>;
    onRemove: (account: string) => Promise<void>;
}) {
    const { tr } = useFm();
    const [account, setAccount] = useState('');
    const [level, setLevel] = useState<NetAclRule['level']>('read');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    return (
        <aside className="fm-pane fm-netfolder__drawer" aria-label={tr('networkFolder.details')}>
            <header className="fm-pane__head">
                <span className="fm-ex__tile-ico" aria-hidden>
                    <Icon
                        name={entry.kind === 'folder' ? 'folder' : 'list'}
                        className={entry.kind === 'folder' ? 'fm-ico--folder' : undefined}
                    />
                </span>
                <div>
                    <h3 title={entry.name}>{entry.name}</h3>
                    <p>{entry.kind === 'folder' ? tr('browser.folderType') : tr('browser.fileType')}</p>
                </div>
                <button type="button" className="fm-icon-btn" aria-label={tr('common.close')} onClick={onClose}>
                    <Icon name="close" />
                </button>
            </header>

            <div className="fm-pane__actions">
                {entry.kind === 'folder' ? (
                    <button type="button" className="fm-btn fm-btn--primary" onClick={onOpen}>{tr('browser.open')}</button>
                ) : null}
                <button type="button" className="fm-btn" onClick={onRename}><Icon name="edit" />{tr('browser.renameFolder')}</button>
                <button type="button" className="fm-btn" onClick={onDelete}><Icon name="trash" />{tr('browser.deleteFolder')}</button>
            </div>

            <div className="fm-tabs" role="tablist">
                <button type="button" className={tab === 'details' ? 'is-on' : undefined} role="tab" onClick={() => onTab('details')}>
                    {tr('networkFolder.details')}
                </button>
                <button type="button" className={tab === 'access' ? 'is-on' : undefined} role="tab" onClick={() => onTab('access')}>
                    {tr('networkFolder.access')}
                    <em>{rules.length}</em>
                </button>
            </div>

            <div className="fm-pane__body">
                {tab === 'details' ? (
                    <dl className="fm-netfolder__props">
                        <div><dt>{tr('common.name')}</dt><dd>{entry.name}</dd></div>
                        <div>
                            <dt>{tr('networkFolder.type')}</dt>
                            <dd>{entry.kind === 'folder' ? tr('browser.folderType') : tr('browser.fileType')}</dd>
                        </div>
                        <div><dt>{tr('networkFolder.location')}</dt><dd>{location}</dd></div>
                        {entry.kind === 'folder' ? (
                            <div><dt>{tr('networkFolder.contains')}</dt><dd>{tr('browser.items', { count: childCount })}</dd></div>
                        ) : null}
                    </dl>
                ) : (
                    <div className="fm-netfolder__access">
                        <p className="fm-hint">{tr('networkFolder.accessHint')}</p>
                        <form
                            className="fm-grant fm-netfolder__grant"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (!account.trim() || busy)
                                    return;
                                setBusy(true);
                                void onGrant(account.trim(), level, note.trim()).finally(() => {
                                    setBusy(false);
                                    setAccount('');
                                    setNote('');
                                    setLevel('read');
                                });
                            }}
                        >
                            <label className="fm-field">
                                <span>{tr('security.addUser')}</span>
                                <input
                                    value={account}
                                    placeholder={tr('networkFolder.accountPh')}
                                    onChange={(event) => setAccount(event.target.value)}
                                />
                            </label>
                            <div className="fm-field">
                                <span>{tr('security.addLevel')}</span>
                                <FmSelect
                                    value={level}
                                    options={ACL_LEVELS.map((item) => ({ value: item, label: tr(`levels.${item}`) }))}
                                    onChange={(next) => setLevel(next as NetAclRule['level'])}
                                    placeholder={tr('security.addLevel')}
                                />
                            </div>
                            <label className="fm-field fm-field--grow">
                                <span>{tr('security.note')}</span>
                                <input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
                            </label>
                            <button type="submit" className="fm-btn fm-btn--primary" disabled={busy || !account.trim()}>
                                <Icon name="plus" />{tr('security.add')}
                            </button>
                        </form>

                        {loadingAcl ? <div className="fm-state">{tr('common.loading')}</div> : null}
                        {!loadingAcl && rules.length === 0 ? <div className="fm-state">{tr('networkFolder.accessEmpty')}</div> : null}
                        {!loadingAcl && rules.length > 0 ? (
                            <ul className="fm-netfolder__acl">
                                {rules.map((rule) => (
                                    <li key={rule.userId} className={rule.level === 'deny' ? 'is-denied' : undefined}>
                                        <div className="fm-netfolder__acl-user">
                                            <strong>{rule.userName}</strong>
                                            <small>
                                                {rule.position === 'inherited' ? tr('security.inherited') : tr('security.explicit')}
                                                {rule.note ? ` · ${rule.note}` : ''}
                                            </small>
                                        </div>
                                        <FmSelect
                                            value={rule.level === 'deny' ? 'read' : rule.level}
                                            className={`fm-filter-select--level fm-level--${rule.level}`}
                                            buttonClassName={`fm-level-select fm-level--${rule.level}`}
                                            options={ACL_LEVELS.map((item) => ({ value: item, label: tr(`levels.${item}`) }))}
                                            onChange={(next) => void onChangeLevel(rule.revokeAccount, next as NetAclRule['level'])}
                                            placeholder={tr('security.addLevel')}
                                        />
                                        <button type="button" className="fm-btn" onClick={() => void onRemove(rule.revokeAccount)}>
                                            {tr('security.remove')}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                )}
            </div>
        </aside>
    );
}

export function NetworkFolderView() {
    const { tr } = useFm();
    const act = useAction();
    const available = netDriveAvailable();
    const [root, setRoot] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [current, setCurrent] = useState<string | null>(null);
    const [entries, setEntries] = useState<NetEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState<DrawerTab>('details');
    const [aclRules, setAclRules] = useState<NetAclRule[]>([]);
    const [aclLoading, setAclLoading] = useState(false);
    const [childCount, setChildCount] = useState(0);
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [menu, setMenu] = useState<CtxMenu | null>(null);
    const [nameModal, setNameModal] = useState<NameModal | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [dropping, setDropping] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(
        () => entries.filter((row) => selectedIds.includes(row.id)),
        [entries, selectedIds],
    );
    const selectedOne = selected.length === 1 ? selected[0] : null;
    const showDrawer = drawerOpen && selectedOne !== null;
    const crumbs = root && current ? netCrumbs(root, current) : [];
    const locationLabel = crumbs.map((item) => item.label).join(' \\ ') || root || '';

    const reload = useCallback(async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            setEntries(await listNetEntries(path));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setEntries([]);
        }
        finally {
            setLoading(false);
        }
    }, []);

    const connect = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const connected = await connectNetDrive();
            setRoot(connected.root);
            setUsername(connected.username);
            setCurrent(connected.root);
            await reload(connected.root);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message === 'needCredentials' ? tr('networkFolder.needCredentials') : message);
        }
        finally {
            setLoading(false);
        }
    }, [reload, tr]);

    useEffect(() => {
        if (!available)
            return;
        if (!loadNetDriveConnection()) {
            setError(tr('networkFolder.needCredentials'));
            return;
        }
        void connect();
    // Auto-connect once when the desktop app opens Network Folder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [available]);

    useEffect(() => {
        if (!showDrawer || !selectedOne)
            return;
        let alive = true;
        setAclLoading(true);
        void loadNetAcl(selectedOne.path)
            .then((rules) => {
                if (alive)
                    setAclRules(rules);
            })
            .catch(() => {
                if (alive)
                    setAclRules([]);
            })
            .finally(() => {
                if (alive)
                    setAclLoading(false);
            });
        if (selectedOne.kind === 'folder') {
            void listNetEntries(selectedOne.path)
                .then((rows) => {
                    if (alive)
                        setChildCount(rows.length);
                })
                .catch(() => {
                    if (alive)
                        setChildCount(0);
                });
        }
        else {
            setChildCount(0);
        }
        return () => {
            alive = false;
        };
    }, [selectedOne, showDrawer]);

    const selectOnly = (id: string | null) => {
        setSelectedIds(id ? [id] : []);
        if (!id)
            setDrawerOpen(false);
    };

    const openDetails = (entry: NetEntry, tab: DrawerTab = 'details') => {
        setSelectedIds([entry.id]);
        setDrawerTab(tab);
        setDrawerOpen(true);
        setMenu(null);
    };

    const openFolder = (entry: NetEntry) => {
        setCurrent(entry.path);
        selectOnly(null);
        setMenu(null);
        void reload(entry.path);
    };

    const goPath = (path: string) => {
        setCurrent(path);
        selectOnly(null);
        void reload(path);
    };

    const goUp = () => {
        if (!root || !current || current.toLowerCase() === root.toLowerCase())
            return;
        const parent = current.slice(0, Math.max(0, current.lastIndexOf('\\')));
        const next = parent.length >= root.length ? parent : root;
        goPath(next);
    };

    const refreshAcl = async (path: string) => {
        setAclLoading(true);
        try {
            setAclRules(await loadNetAcl(path));
        }
        catch {
            setAclRules([]);
        }
        finally {
            setAclLoading(false);
        }
    };

    const createFolder = async (name: string) => {
        if (!current)
            return false;
        const finalName = uniqueChildName(entries.map((row) => row.name), name);
        const ok = await act(async () => {
            await createNetFolder(current, finalName);
            return true;
        }, tr('pane.saved'));
        if (ok)
            await reload(current);
        return Boolean(ok);
    };

    const renameSelected = async (name: string) => {
        if (!selectedOne || !current)
            return false;
        const others = entries.filter((row) => row.id !== selectedOne.id).map((row) => row.name);
        const finalName = uniqueChildName(others, name);
        const ok = await act(async () => {
            await renameNetEntry(selectedOne, finalName);
            return true;
        }, tr('pane.saved'));
        if (ok) {
            await reload(current);
            setDrawerOpen(false);
        }
        return Boolean(ok);
    };

    const deleteSelected = async () => {
        if (!root || !current || selected.length === 0)
            return;
        const ok = await act(async () => {
            await deleteNetEntries(selected, root, username || 'network');
            return true;
        }, tr('networkFolder.movedToTrash'));
        if (ok) {
            selectOnly(null);
            setConfirmDelete(false);
            await reload(current);
        }
    };

    const addFiles = async (files: File[]) => {
        if (!current || files.length === 0)
            return;
        const ok = await act(async () => {
            await uploadNetFiles(current, files);
            return true;
        }, tr('browser.uploaded', { count: files.length }));
        if (ok)
            await reload(current);
    };

    const cutOrCopy = (mode: 'cut' | 'copy') => {
        if (selected.length === 0)
            return;
        setClipboard({ mode, entries: selected.map((row) => ({ ...row })) });
        setMenu(null);
    };

    const pasteClipboard = async () => {
        if (!clipboard || !current)
            return;
        const ok = await act(async () => {
            if (clipboard.mode === 'cut')
                await moveNetEntries(clipboard.entries, current);
            else {
                const existing = (await listNetEntries(current)).map((row) => row.name);
                for (const entry of clipboard.entries) {
                    const name = uniqueChildName(existing, entry.name);
                    existing.push(name);
                    await copyNetEntryTo(entry, current, name);
                }
            }
            return true;
        }, tr('pane.saved'));
        if (ok) {
            if (clipboard.mode === 'cut')
                setClipboard(null);
            await reload(current);
        }
        setMenu(null);
    };

    const openCtx = (event: ReactMouseEvent, target: CtxMenu['target']) => {
        event.preventDefault();
        event.stopPropagation();
        const bound = contentRef.current?.getBoundingClientRect();
        const x = bound ? Math.min(event.clientX - bound.left, bound.width - 200) : event.clientX;
        const y = bound ? Math.min(event.clientY - bound.top, bound.height - 220) : event.clientY;
        if (target.kind === 'entry')
            setSelectedIds((prev) => (prev.includes(target.entry.id) ? prev : [target.entry.id]));
        setMenu({ x: Math.max(8, x), y: Math.max(8, y), target });
    };

    useEffect(() => {
        if (!menu)
            return;
        const close = () => setMenu(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [menu]);

    if (!available) {
        return (
            <section className="fm-docs fm-docs--padded">
                <div className="fm-state">
                    <Icon name="folder" className="fm-ico--folder" />
                    <p>{tr('networkFolder.desktopOnly')}</p>
                </div>
            </section>
        );
    }

    if (!root) {
        return (
            <section className="fm-docs fm-docs--padded">
                <div className="fm-state">
                    <Icon name="link" />
                    <p>{error ?? tr('networkFolder.connectHint')}</p>
                    <button type="button" className="fm-btn fm-btn--primary" disabled={loading} onClick={() => void connect()}>
                        {loading ? tr('networkFolder.connecting') : tr('networkFolder.connect')}
                    </button>
                </div>
            </section>
        );
    }

    const statusText = selected.length > 0
        ? (selectedOne ? selectedOne.name : tr('networkFolder.selectedCount', { count: selected.length }))
        : tr('browser.items', { count: entries.length });

    return (
        <div className="fm-split">
            <section
                className={dropping ? 'fm-tiles fm-netfolder is-dropping' : 'fm-tiles fm-netfolder'}
                onDragOver={(event) => {
                    if (event.dataTransfer.types.includes('Files')) {
                        event.preventDefault();
                        setDropping(true);
                    }
                }}
                onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                        setDropping(false);
                }}
                onDrop={(event: DragEvent) => {
                    event.preventDefault();
                    setDropping(false);
                    void addFiles(Array.from(event.dataTransfer.files ?? []));
                }}
            >
                <div className="fm-netfolder__bar">
                    <button type="button" className="fm-btn" onClick={() => setNameModal({ mode: 'create', initial: tr('networkFolder.newFolderName') })}>
                        <Icon name="folder" className="fm-ico--folder" />{tr('browser.newFolder')}
                    </button>
                    <button type="button" className="fm-btn" onClick={() => fileRef.current?.click()}>
                        <Icon name="upload" />{tr('browser.upload')}
                    </button>
                    <span className="fm-netfolder__sep" aria-hidden />
                    <button type="button" className="fm-btn" disabled={selected.length === 0} onClick={() => cutOrCopy('cut')}>{tr('browser.cut')}</button>
                    <button type="button" className="fm-btn" disabled={selected.length === 0} onClick={() => cutOrCopy('copy')}>{tr('browser.copy')}</button>
                    <button type="button" className="fm-btn" disabled={!clipboard} onClick={() => void pasteClipboard()}>{tr('browser.paste')}</button>
                    <span className="fm-netfolder__sep" aria-hidden />
                    <button type="button" className="fm-btn" disabled={!selectedOne} onClick={() => selectedOne && setNameModal({ mode: 'rename', initial: selectedOne.name })}>
                        <Icon name="edit" />{tr('browser.renameFolder')}
                    </button>
                    <button type="button" className="fm-btn" disabled={selected.length === 0} onClick={() => setConfirmDelete(true)}>
                        <Icon name="trash" />{tr('browser.deleteFolder')}
                    </button>
                    <span className="fm-netfolder__sep" aria-hidden />
                    <button type="button" className={showDrawer ? 'fm-btn is-on' : 'fm-btn'} disabled={!selectedOne} onClick={() => selectedOne && openDetails(selectedOne, 'details')}>
                        <Icon name="eye" />{tr('networkFolder.details')}
                    </button>
                    <button type="button" className="fm-btn" disabled={!selectedOne} onClick={() => selectedOne && openDetails(selectedOne, 'access')}>
                        <Icon name="shield" />{tr('networkFolder.access')}
                    </button>
                    <button type="button" className="fm-btn" disabled={!current || current.toLowerCase() === root.toLowerCase()} onClick={goUp}>
                        <Icon name="up" />{tr('browser.up')}
                    </button>
                    <button type="button" className="fm-btn" disabled={loading || !current} onClick={() => current && void reload(current)}>
                        <Icon name="refresh" />{tr('browser.refresh')}
                    </button>
                </div>

                <nav className="fm-crumbs fm-netfolder__crumbs" aria-label={tr('networkFolder.root')}>
                    {crumbs.map((crumb, index) => (
                        <span key={crumb.path} className="fm-crumbs__part">
                            {index > 0 ? <Icon name="chevron" /> : <Icon name="folder" className="fm-ico--folder" />}
                            <button type="button" onClick={() => goPath(crumb.path)}>{crumb.label}</button>
                        </span>
                    ))}
                </nav>

                <div
                    ref={contentRef}
                    className="fm-tiles__content"
                    onClick={() => {
                        selectOnly(null);
                        setMenu(null);
                    }}
                    onContextMenu={(event) => openCtx(event, { kind: 'blank' })}
                >
                    {loading ? <div className="fm-state">{tr('common.loading')}</div> : null}
                    {!loading && error ? <div className="fm-state"><p>{error}</p></div> : null}
                    {!loading && !error && entries.length === 0 ? (
                        <div className="fm-ex__empty">
                            <Icon name="folderOpen" className="fm-ico--folder" />
                            <p>{tr('browser.emptyFolder')}</p>
                            <p className="fm-muted">{tr('browser.dropHint')}</p>
                        </div>
                    ) : null}
                    {!loading && !error && entries.length > 0 ? (
                        <div className="fm-ex__tiles">
                            {current && root && current.toLowerCase() !== root.toLowerCase() ? (
                                <button type="button" className="fm-ex__tile fm-ex__tile--up" onClick={(event) => { event.stopPropagation(); goUp(); }}>
                                    <span className="fm-ex__tile-ico" aria-hidden><Icon name="up" /></span>
                                    <span className="fm-ex__tile-meta"><strong>..</strong><small>{tr('browser.up')}</small></span>
                                </button>
                            ) : null}
                            {entries.map((entry) => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    className={selectedIds.includes(entry.id) ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (event.ctrlKey || event.metaKey) {
                                            setSelectedIds((prev) => (
                                                prev.includes(entry.id)
                                                    ? prev.filter((id) => id !== entry.id)
                                                    : [...prev, entry.id]
                                            ));
                                        }
                                        else {
                                            selectOnly(entry.id);
                                        }
                                        setMenu(null);
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        if (entry.kind === 'folder')
                                            openFolder(entry);
                                        else
                                            openDetails(entry, 'details');
                                    }}
                                    onContextMenu={(event) => openCtx(event, { kind: 'entry', entry })}
                                >
                                    <span className="fm-ex__tile-ico" aria-hidden>
                                        <Icon
                                            name={entry.kind === 'folder' ? 'folder' : 'list'}
                                            className={entry.kind === 'folder' ? 'fm-ico--folder' : undefined}
                                        />
                                    </span>
                                    <span className="fm-ex__tile-meta">
                                        <strong title={entry.name}>{entry.name}</strong>
                                        <small>{entry.kind === 'folder' ? tr('browser.folderType') : tr('browser.fileType')}</small>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {menu ? (
                        <div className="fm-ex__menu" style={{ left: menu.x, top: menu.y }} role="menu" onClick={(event) => event.stopPropagation()}>
                            {menu.target.kind === 'entry' ? (
                                <>
                                    {menu.target.entry.kind === 'folder' ? (
                                        <button type="button" role="menuitem" onClick={() => openFolder(menu.target.kind === 'entry' ? menu.target.entry : entries[0])}>
                                            {tr('browser.open')}
                                        </button>
                                    ) : null}
                                    <button type="button" role="menuitem" onClick={() => menu.target.kind === 'entry' && openDetails(menu.target.entry, 'details')}>
                                        {tr('networkFolder.details')}
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => menu.target.kind === 'entry' && openDetails(menu.target.entry, 'access')}>
                                        {tr('networkFolder.access')}
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => {
                                        if (menu.target.kind === 'entry')
                                            setNameModal({ mode: 'rename', initial: menu.target.entry.name });
                                        setMenu(null);
                                    }}>{tr('browser.renameFolder')}</button>
                                    <button type="button" role="menuitem" className="is-danger" onClick={() => { setConfirmDelete(true); setMenu(null); }}>
                                        {tr('browser.deleteFolder')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" role="menuitem" onClick={() => { setNameModal({ mode: 'create', initial: tr('networkFolder.newFolderName') }); setMenu(null); }}>
                                        {tr('browser.newFolder')}
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => { fileRef.current?.click(); setMenu(null); }}>
                                        {tr('browser.upload')}
                                    </button>
                                    {clipboard ? (
                                        <button type="button" role="menuitem" onClick={() => void pasteClipboard()}>{tr('browser.paste')}</button>
                                    ) : null}
                                    <button type="button" role="menuitem" onClick={() => { if (current) void reload(current); setMenu(null); }}>
                                        {tr('browser.refresh')}
                                    </button>
                                </>
                            )}
                        </div>
                    ) : null}
                </div>

                <div className="fm-netfolder__status">{statusText}</div>
                {dropping ? <div className="fm-dropzone"><Icon name="upload" />{tr('browser.dropHint')}</div> : null}
                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                        void addFiles(Array.from(event.target.files ?? []));
                        event.target.value = '';
                    }}
                />
            </section>

            {showDrawer && selectedOne ? (
                <DetailsDrawer
                    entry={selectedOne}
                    location={locationLabel}
                    childCount={childCount}
                    rules={aclRules}
                    tab={drawerTab}
                    loadingAcl={aclLoading}
                    onTab={setDrawerTab}
                    onClose={() => setDrawerOpen(false)}
                    onOpen={() => {
                        if (selectedOne.kind === 'folder')
                            openFolder(selectedOne);
                    }}
                    onRename={() => setNameModal({ mode: 'rename', initial: selectedOne.name })}
                    onDelete={() => setConfirmDelete(true)}
                    onGrant={async (account, level) => {
                        const ok = await act(async () => {
                            await grantNetAccess(selectedOne.path, account, level);
                            return true;
                        }, tr('security.changed'));
                        if (ok)
                            await refreshAcl(selectedOne.path);
                    }}
                    onChangeLevel={async (account, level) => {
                        const ok = await act(async () => {
                            await grantNetAccess(selectedOne.path, account, level);
                            return true;
                        }, tr('security.changed'));
                        if (ok)
                            await refreshAcl(selectedOne.path);
                    }}
                    onRemove={async (account) => {
                        const ok = await act(async () => {
                            await revokeNetAccess(selectedOne.path, account);
                            return true;
                        }, tr('security.changed'));
                        if (ok)
                            await refreshAcl(selectedOne.path);
                    }}
                />
            ) : null}

            {nameModal ? (
                <NamePrompt
                    title={nameModal.mode === 'create' ? tr('browser.newFolder') : tr('browser.renameFolder')}
                    label={nameModal.mode === 'create' || selectedOne?.kind === 'folder' ? tr('browser.folderName') : tr('networkFolder.fileName')}
                    initial={nameModal.initial}
                    onClose={() => setNameModal(null)}
                    onSubmit={(name) => (nameModal.mode === 'create' ? createFolder(name) : renameSelected(name))}
                />
            ) : null}

            {confirmDelete && selected.length > 0 ? (
                <ConfirmModal
                    title={tr('browser.deleteFolder')}
                    text={selected.length === 1
                        ? tr('networkFolder.deleteConfirm', { name: selected[0].name })
                        : tr('networkFolder.deleteManyConfirm', { count: selected.length })}
                    confirmLabel={tr('common.delete')}
                    danger
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={() => void deleteSelected()}
                />
            ) : null}
        </div>
    );
}
