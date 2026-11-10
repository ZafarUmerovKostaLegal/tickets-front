import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import type { AclLevel } from '../api/filesApi';
import { ConfirmModal, Icon, Modal, useFm } from './fmShared';

type DemoEntry = {
    id: string;
    name: string;
    kind: 'folder' | 'file';
};

type TreeMap = Record<string, DemoEntry[]>;

type DemoUser = {
    id: number;
    name: string;
    position: string;
};

type AclRule = {
    userId: number;
    userName: string;
    position: string;
    level: AclLevel;
    note: string;
};

type AclMap = Record<string, AclRule[]>;

type Clipboard = {
    mode: 'cut' | 'copy';
    entries: DemoEntry[];
    fromKey: string;
};

type CtxMenu = {
    x: number;
    y: number;
    target: { kind: 'blank' } | { kind: 'entry'; entry: DemoEntry };
};

type NameModal = {
    mode: 'create' | 'rename';
    initial: string;
};

type DrawerTab = 'details' | 'access';

const ROOT_KEY = '';
const ACL_LEVELS: AclLevel[] = ['read', 'edit', 'manage', 'deny'];

const DEMO_USERS: DemoUser[] = [
    { id: 1, name: 'Анна Иванова', position: 'Partner' },
    { id: 2, name: 'Борис Петров', position: 'Associate' },
    { id: 3, name: 'Клара Ким', position: 'Paralegal' },
    { id: 4, name: 'David Lee', position: 'Counsel' },
    { id: 5, name: 'Елена Смирнова', position: 'Associate' },
];

const INITIAL_ROOT: DemoEntry[] = [
    { id: 'agreements', name: 'Agreements', kind: 'folder' },
    { id: 'billing', name: 'Billing', kind: 'folder' },
    { id: 'corporate', name: 'Corporate Documents', kind: 'folder' },
    { id: 'correspondence', name: 'Correspondence', kind: 'folder' },
    { id: 'court', name: 'Court Documents', kind: 'folder' },
    { id: 'drafts', name: 'Drafts', kind: 'folder' },
    { id: 'research', name: 'Research & Memos', kind: 'folder' },
];

const INITIAL_NESTED: TreeMap = {
    [ROOT_KEY]: INITIAL_ROOT,
    agreements: [
        { id: 'nda', name: 'NDA Template.docx', kind: 'file' },
        { id: 'msa', name: 'Master Service Agreement.docx', kind: 'file' },
    ],
    billing: [
        { id: 'invoice', name: 'Invoice Q3.pdf', kind: 'file' },
    ],
    drafts: [
        { id: 'memo-draft', name: 'Client Memo Draft.docx', kind: 'file' },
    ],
};

const INITIAL_ACL: AclMap = {
    agreements: [
        { userId: 1, userName: 'Анна Иванова', position: 'Partner', level: 'manage', note: 'Владелец' },
        { userId: 2, userName: 'Борис Петров', position: 'Associate', level: 'edit', note: '' },
        { userId: 3, userName: 'Клара Ким', position: 'Paralegal', level: 'read', note: '' },
    ],
    billing: [
        { userId: 1, userName: 'Анна Иванова', position: 'Partner', level: 'manage', note: '' },
        { userId: 4, userName: 'David Lee', position: 'Counsel', level: 'edit', note: 'Финансы' },
    ],
    research: [
        { userId: 2, userName: 'Борис Петров', position: 'Associate', level: 'edit', note: '' },
        { userId: 5, userName: 'Елена Смирнова', position: 'Associate', level: 'read', note: '' },
    ],
};

function cloneTree(source: TreeMap): TreeMap {
    return Object.fromEntries(
        Object.entries(source).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))]),
    );
}

function cloneAcl(source: AclMap): AclMap {
    return Object.fromEntries(
        Object.entries(source).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))]),
    );
}

function uid(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function uniqueName(existing: DemoEntry[], base: string): string {
    const names = new Set(existing.map((row) => row.name.toLowerCase()));
    if (!names.has(base.toLowerCase()))
        return base;
    let index = 2;
    while (names.has(`${base} (${index})`.toLowerCase()))
        index += 1;
    return `${base} (${index})`;
}

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
    onSubmit: (name: string) => boolean;
}) {
    const { tr } = useFm();
    const [name, setName] = useState(initial);
    const submit = () => {
        if (!name.trim())
            return;
        if (onSubmit(name.trim()))
            onClose();
    };
    return (
        <Modal
            title={title}
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="fm-btn" onClick={onClose}>{tr('common.cancel')}</button>
                    <button type="button" className="fm-btn fm-btn--primary" disabled={!name.trim()} onClick={submit}>
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
                            submit();
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
    onTab,
    onClose,
    onOpen,
    onRename,
    onDelete,
    onGrant,
    onChangeLevel,
    onRemove,
}: {
    entry: DemoEntry;
    location: string;
    childCount: number;
    rules: AclRule[];
    tab: DrawerTab;
    onTab: (tab: DrawerTab) => void;
    onClose: () => void;
    onOpen: () => void;
    onRename: () => void;
    onDelete: () => void;
    onGrant: (user: DemoUser, level: AclLevel, note: string) => void;
    onChangeLevel: (userId: number, level: AclLevel) => void;
    onRemove: (userId: number) => void;
}) {
    const { tr } = useFm();
    const [userId, setUserId] = useState('');
    const [level, setLevel] = useState<AclLevel>('read');
    const [note, setNote] = useState('');
    const grantedIds = new Set(rules.map((row) => row.userId));
    const availableUsers = DEMO_USERS.filter((user) => !grantedIds.has(user.id));

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
                    <p>
                        {entry.kind === 'folder' ? tr('browser.folderType') : tr('browser.fileType')}
                    </p>
                </div>
                <button type="button" className="fm-icon-btn" aria-label={tr('common.close')} onClick={onClose}>
                    <Icon name="close" />
                </button>
            </header>

            <div className="fm-pane__actions">
                {entry.kind === 'folder' ? (
                    <button type="button" className="fm-btn fm-btn--primary" onClick={onOpen}>
                        {tr('browser.open')}
                    </button>
                ) : null}
                <button type="button" className="fm-btn" onClick={onRename}>
                    <Icon name="edit" />
                    {tr('browser.renameFolder')}
                </button>
                <button type="button" className="fm-btn" onClick={onDelete}>
                    <Icon name="trash" />
                    {tr('browser.deleteFolder')}
                </button>
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
                        <div>
                            <dt>{tr('common.name')}</dt>
                            <dd>{entry.name}</dd>
                        </div>
                        <div>
                            <dt>{tr('networkFolder.type')}</dt>
                            <dd>
                                {entry.kind === 'folder' ? tr('browser.folderType') : tr('browser.fileType')}
                            </dd>
                        </div>
                        <div>
                            <dt>{tr('networkFolder.location')}</dt>
                            <dd>{location}</dd>
                        </div>
                        {entry.kind === 'folder' ? (
                            <div>
                                <dt>{tr('networkFolder.contains')}</dt>
                                <dd>{tr('browser.items', { count: childCount })}</dd>
                            </div>
                        ) : null}
                        <div>
                            <dt>{tr('networkFolder.access')}</dt>
                            <dd>{tr('networkFolder.accessCount', { count: rules.length })}</dd>
                        </div>
                    </dl>
                ) : (
                    <div className="fm-netfolder__access">
                        <p className="fm-hint">{tr('networkFolder.accessHint')}</p>

                        <form
                            className="fm-grant fm-netfolder__grant"
                            onSubmit={(event) => {
                                event.preventDefault();
                                const user = DEMO_USERS.find((row) => String(row.id) === userId);
                                if (!user)
                                    return;
                                onGrant(user, level, note.trim());
                                setUserId('');
                                setLevel('read');
                                setNote('');
                            }}
                        >
                            <label className="fm-field">
                                <span>{tr('security.addUser')}</span>
                                <select value={userId} onChange={(event) => setUserId(event.target.value)}>
                                    <option value="">{tr('security.searchUser')}</option>
                                    {availableUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} · {user.position}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="fm-field">
                                <span>{tr('security.addLevel')}</span>
                                <select value={level} onChange={(event) => setLevel(event.target.value as AclLevel)}>
                                    {ACL_LEVELS.map((item) => (
                                        <option key={item} value={item}>{tr(`levels.${item}`)}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="fm-field fm-field--grow">
                                <span>{tr('security.note')}</span>
                                <input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
                            </label>
                            <button type="submit" className="fm-btn fm-btn--primary" disabled={!userId}>
                                <Icon name="plus" />
                                {tr('security.add')}
                            </button>
                        </form>

                        {rules.length === 0 ? (
                            <div className="fm-state">{tr('networkFolder.accessEmpty')}</div>
                        ) : (
                            <ul className="fm-netfolder__acl">
                                {rules.map((rule) => (
                                    <li key={rule.userId} className={rule.level === 'deny' ? 'is-denied' : undefined}>
                                        <div className="fm-netfolder__acl-user">
                                            <strong>{rule.userName}</strong>
                                            <small>{rule.position}{rule.note ? ` · ${rule.note}` : ''}</small>
                                        </div>
                                        <select
                                            className={`fm-level-select fm-level--${rule.level}`}
                                            value={rule.level}
                                            onChange={(event) => onChangeLevel(rule.userId, event.target.value as AclLevel)}
                                            aria-label={tr('security.addLevel')}
                                        >
                                            {ACL_LEVELS.map((item) => (
                                                <option key={item} value={item}>{tr(`levels.${item}`)}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="fm-btn"
                                            onClick={() => onRemove(rule.userId)}
                                        >
                                            {tr('security.remove')}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}

export function NetworkFolderView() {
    const { tr } = useFm();
    const [tree, setTree] = useState<TreeMap>(() => cloneTree(INITIAL_NESTED));
    const [acl, setAcl] = useState<AclMap>(() => cloneAcl(INITIAL_ACL));
    const [path, setPath] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState<DrawerTab>('details');
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [menu, setMenu] = useState<CtxMenu | null>(null);
    const [nameModal, setNameModal] = useState<NameModal | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [dropping, setDropping] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const folderKey = path[path.length - 1] ?? ROOT_KEY;
    const entries = tree[folderKey] ?? [];
    const selected = useMemo(
        () => entries.filter((row) => selectedIds.includes(row.id)),
        [entries, selectedIds],
    );
    const selectedOne = selected.length === 1 ? selected[0] : null;
    const empty = entries.length === 0;
    const showDrawer = drawerOpen && selectedOne !== null;
    const selectedRules = selectedOne ? (acl[selectedOne.id] ?? []) : [];
    const selectedChildCount = selectedOne?.kind === 'folder' ? (tree[selectedOne.id] ?? []).length : 0;

    const crumbLabels = useMemo(() => {
        const labels: { id: string; name: string }[] = [];
        let key = ROOT_KEY;
        for (const segment of path) {
            const row = (tree[key] ?? []).find((item) => item.id === segment);
            labels.push({ id: segment, name: row?.name ?? segment });
            key = segment;
        }
        return labels;
    }, [path, tree]);

    const locationLabel = useMemo(() => {
        const parts = [tr('networkFolder.root'), ...crumbLabels.map((item) => item.name)];
        return parts.join(' \\ ');
    }, [crumbLabels, tr]);

    const closeMenu = () => setMenu(null);

    const selectOnly = (id: string | null, openDrawer = false) => {
        setSelectedIds(id ? [id] : []);
        if (!id)
            setDrawerOpen(false);
        else if (openDrawer)
            setDrawerOpen(true);
    };

    const openDetails = (entry?: DemoEntry, tab: DrawerTab = 'details') => {
        if (entry)
            setSelectedIds([entry.id]);
        setDrawerTab(tab);
        setDrawerOpen(true);
        closeMenu();
    };

    const openFolder = (id: string) => {
        setPath((prev) => [...prev, id]);
        selectOnly(null);
        closeMenu();
    };

    const goUp = () => {
        setPath((prev) => prev.slice(0, -1));
        selectOnly(null);
        closeMenu();
    };

    const goCrumb = (index: number) => {
        if (index < 0) {
            setPath([]);
            selectOnly(null);
            return;
        }
        setPath((prev) => prev.slice(0, index + 1));
        selectOnly(null);
    };

    const updateFolder = (key: string, updater: (rows: DemoEntry[]) => DemoEntry[]) => {
        setTree((prev) => {
            const next = { ...prev };
            next[key] = updater([...(prev[key] ?? [])]);
            return next;
        });
    };

    const removeSubtree = (map: TreeMap, folderId: string) => {
        const children = map[folderId] ?? [];
        delete map[folderId];
        for (const child of children) {
            if (child.kind === 'folder')
                removeSubtree(map, child.id);
        }
    };

    const createFolder = (name: string) => {
        const id = uid('folder');
        updateFolder(folderKey, (rows) => [
            ...rows,
            { id, name: uniqueName(rows, name), kind: 'folder' },
        ]);
        setTree((prev) => ({ ...prev, [id]: prev[id] ?? [] }));
        selectOnly(id, true);
        return true;
    };

    const renameSelected = (name: string) => {
        if (!selectedOne)
            return false;
        updateFolder(folderKey, (rows) => rows.map((row) => {
            if (row.id !== selectedOne.id)
                return row;
            const others = rows.filter((item) => item.id !== row.id);
            return { ...row, name: uniqueName(others, name) };
        }));
        return true;
    };

    const deleteSelected = () => {
        if (selected.length === 0)
            return;
        const ids = new Set(selected.map((row) => row.id));
        setTree((prev) => {
            const next = { ...prev };
            next[folderKey] = (next[folderKey] ?? []).filter((row) => !ids.has(row.id));
            for (const row of selected) {
                if (row.kind === 'folder')
                    removeSubtree(next, row.id);
            }
            return next;
        });
        setAcl((prev) => {
            const next = { ...prev };
            for (const id of ids)
                delete next[id];
            return next;
        });
        selectOnly(null);
        setConfirmDelete(false);
    };

    const addFiles = (files: File[]) => {
        if (files.length === 0)
            return;
        updateFolder(folderKey, (rows) => {
            const next = [...rows];
            for (const file of files) {
                next.push({
                    id: uid('file'),
                    name: uniqueName(next, file.name),
                    kind: 'file',
                });
            }
            return next;
        });
    };

    const cutOrCopy = (mode: 'cut' | 'copy') => {
        if (selected.length === 0)
            return;
        setClipboard({
            mode,
            entries: selected.map((row) => ({ ...row })),
            fromKey: folderKey,
        });
        closeMenu();
    };

    const pasteClipboard = () => {
        if (!clipboard)
            return;
        const sourceKey = clipboard.fromKey;
        setTree((prev) => {
            const next = { ...prev };
            const targetRows = [...(next[folderKey] ?? [])];
            const pasted: DemoEntry[] = [];

            for (const entry of clipboard.entries) {
                if (clipboard.mode === 'cut' && sourceKey === folderKey) {
                    pasted.push(entry);
                    continue;
                }
                if (clipboard.mode === 'copy' || sourceKey !== folderKey) {
                    const copy: DemoEntry = {
                        ...entry,
                        id: clipboard.mode === 'copy' ? uid(entry.kind) : entry.id,
                        name: uniqueName(targetRows.concat(pasted), entry.name),
                    };
                    pasted.push(copy);
                    if (entry.kind === 'folder' && clipboard.mode === 'copy') {
                        next[copy.id] = (next[entry.id] ?? []).map((child) => ({
                            ...child,
                            id: uid(child.kind),
                        }));
                    }
                    else if (entry.kind === 'folder' && clipboard.mode === 'cut' && !next[copy.id]) {
                        next[copy.id] = next[entry.id] ?? [];
                    }
                }
            }

            if (clipboard.mode === 'cut' && sourceKey !== folderKey) {
                const movingIds = new Set(clipboard.entries.map((row) => row.id));
                next[sourceKey] = (next[sourceKey] ?? []).filter((row) => !movingIds.has(row.id));
            }

            if (!(clipboard.mode === 'cut' && sourceKey === folderKey))
                next[folderKey] = [...targetRows, ...pasted];

            return next;
        });
        if (clipboard.mode === 'cut')
            setClipboard(null);
        closeMenu();
    };

    const grantAccess = (user: DemoUser, level: AclLevel, note: string) => {
        if (!selectedOne)
            return;
        const entryId = selectedOne.id;
        setAcl((prev) => {
            const rows = [...(prev[entryId] ?? [])];
            const index = rows.findIndex((row) => row.userId === user.id);
            const rule: AclRule = {
                userId: user.id,
                userName: user.name,
                position: user.position,
                level,
                note,
            };
            if (index >= 0)
                rows[index] = rule;
            else
                rows.push(rule);
            return { ...prev, [entryId]: rows };
        });
    };

    const changeAccessLevel = (userId: number, level: AclLevel) => {
        if (!selectedOne)
            return;
        const entryId = selectedOne.id;
        setAcl((prev) => ({
            ...prev,
            [entryId]: (prev[entryId] ?? []).map((row) => (
                row.userId === userId ? { ...row, level } : row
            )),
        }));
    };

    const removeAccess = (userId: number) => {
        if (!selectedOne)
            return;
        const entryId = selectedOne.id;
        setAcl((prev) => ({
            ...prev,
            [entryId]: (prev[entryId] ?? []).filter((row) => row.userId !== userId),
        }));
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

    const onDropFiles = (event: DragEvent) => {
        event.preventDefault();
        setDropping(false);
        addFiles(Array.from(event.dataTransfer.files ?? []));
    };

    const onKeyDown = useCallback((event: KeyboardEvent) => {
        if (nameModal || confirmDelete)
            return;
        const meta = event.ctrlKey || event.metaKey;
        if (event.key === 'Delete' && selected.length > 0) {
            event.preventDefault();
            setConfirmDelete(true);
        }
        else if (event.key === 'F2' && selectedOne) {
            event.preventDefault();
            setNameModal({ mode: 'rename', initial: selectedOne.name });
        }
        else if (event.key === 'Backspace' && path.length > 0 && !meta) {
            event.preventDefault();
            goUp();
        }
        else if (meta && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            cutOrCopy('copy');
        }
        else if (meta && event.key.toLowerCase() === 'x') {
            event.preventDefault();
            cutOrCopy('cut');
        }
        else if (meta && event.key.toLowerCase() === 'v') {
            event.preventDefault();
            pasteClipboard();
        }
        else if (meta && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            setSelectedIds(entries.map((row) => row.id));
        }
        else if (event.key === 'Enter' && selectedOne?.kind === 'folder') {
            event.preventDefault();
            openFolder(selectedOne.id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmDelete, entries, nameModal, path.length, selected, selectedOne, clipboard, folderKey]);

    useEffect(() => {
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onKeyDown]);

    useEffect(() => {
        if (!menu)
            return;
        const close = () => setMenu(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [menu]);

    const statusText = selected.length > 0
        ? (selectedOne
            ? selectedOne.name
            : tr('networkFolder.selectedCount', { count: selected.length }))
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
                onDrop={onDropFiles}
            >
                <div className="fm-netfolder__bar">
                    <button type="button" className="fm-btn" onClick={() => setNameModal({ mode: 'create', initial: tr('networkFolder.newFolderName') })}>
                        <Icon name="folder" className="fm-ico--folder" />
                        {tr('browser.newFolder')}
                    </button>
                    <button type="button" className="fm-btn" onClick={() => fileRef.current?.click()}>
                        <Icon name="upload" />
                        {tr('browser.upload')}
                    </button>
                    <span className="fm-netfolder__sep" aria-hidden />
                    <button type="button" className="fm-btn" disabled={selected.length === 0} onClick={() => cutOrCopy('cut')}>
                        {tr('browser.cut')}
                    </button>
                    <button type="button" className="fm-btn" disabled={selected.length === 0} onClick={() => cutOrCopy('copy')}>
                        {tr('browser.copy')}
                    </button>
                    <button type="button" className="fm-btn" disabled={!clipboard} onClick={pasteClipboard}>
                        {tr('browser.paste')}
                    </button>
                    <span className="fm-netfolder__sep" aria-hidden />
                    <button
                        type="button"
                        className="fm-btn"
                        disabled={!selectedOne}
                        onClick={() => selectedOne && setNameModal({ mode: 'rename', initial: selectedOne.name })}
                    >
                        <Icon name="edit" />
                        {tr('browser.renameFolder')}
                    </button>
                    <button
                        type="button"
                        className="fm-btn"
                        disabled={selected.length === 0}
                        onClick={() => setConfirmDelete(true)}
                    >
                        <Icon name="trash" />
                        {tr('browser.deleteFolder')}
                    </button>
                    <span className="fm-netfolder__sep" aria-hidden />
                    <button
                        type="button"
                        className={showDrawer ? 'fm-btn is-on' : 'fm-btn'}
                        disabled={!selectedOne}
                        onClick={() => selectedOne && openDetails(selectedOne, 'details')}
                    >
                        <Icon name="eye" />
                        {tr('networkFolder.details')}
                    </button>
                    <button
                        type="button"
                        className="fm-btn"
                        disabled={!selectedOne}
                        onClick={() => selectedOne && openDetails(selectedOne, 'access')}
                    >
                        <Icon name="shield" />
                        {tr('networkFolder.access')}
                    </button>
                    <button type="button" className="fm-btn" disabled={path.length === 0} onClick={goUp}>
                        <Icon name="up" />
                        {tr('browser.up')}
                    </button>
                </div>

                <nav className="fm-crumbs fm-netfolder__crumbs" aria-label={tr('networkFolder.root')}>
                    <button type="button" onClick={() => goCrumb(-1)}>
                        <Icon name="folder" className="fm-ico--folder" />
                        {tr('networkFolder.root')}
                    </button>
                    {crumbLabels.map((crumb, index) => (
                        <span key={crumb.id} className="fm-crumbs__part">
                            <Icon name="chevron" />
                            <button type="button" onClick={() => goCrumb(index)}>{crumb.name}</button>
                        </span>
                    ))}
                </nav>

                <div
                    ref={contentRef}
                    className="fm-tiles__content"
                    onClick={() => {
                        selectOnly(null);
                        closeMenu();
                    }}
                    onContextMenu={(event) => openCtx(event, { kind: 'blank' })}
                >
                    {empty ? (
                        <div className="fm-ex__empty">
                            <Icon name="folderOpen" className="fm-ico--folder" />
                            <p>{tr('browser.emptyFolder')}</p>
                            <p className="fm-muted">{tr('browser.dropHint')}</p>
                        </div>
                    ) : (
                        <div className="fm-ex__tiles">
                            {path.length > 0 ? (
                                <button
                                    type="button"
                                    className="fm-ex__tile fm-ex__tile--up"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        goUp();
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
                            {entries.map((entry) => {
                                const isCut = clipboard?.mode === 'cut'
                                    && clipboard.fromKey === folderKey
                                    && clipboard.entries.some((item) => item.id === entry.id);
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        className={[
                                            'fm-ex__tile',
                                            selectedIds.includes(entry.id) ? 'is-on' : '',
                                            isCut ? 'is-closed' : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (event.ctrlKey || event.metaKey) {
                                                setSelectedIds((prev) => (
                                                    prev.includes(entry.id)
                                                        ? prev.filter((id) => id !== entry.id)
                                                        : [...prev, entry.id]
                                                ));
                                            }
                                            else if (event.shiftKey && selectedIds.length > 0) {
                                                const anchor = entries.findIndex((row) => row.id === selectedIds[0]);
                                                const current = entries.findIndex((row) => row.id === entry.id);
                                                if (anchor >= 0 && current >= 0) {
                                                    const [from, to] = anchor < current ? [anchor, current] : [current, anchor];
                                                    setSelectedIds(entries.slice(from, to + 1).map((row) => row.id));
                                                }
                                                else {
                                                    selectOnly(entry.id, true);
                                                }
                                            }
                                            else {
                                                selectOnly(entry.id, true);
                                                setDrawerTab('details');
                                            }
                                            closeMenu();
                                        }}
                                        onDoubleClick={(event) => {
                                            event.stopPropagation();
                                            if (entry.kind === 'folder')
                                                openFolder(entry.id);
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
                                            <small>
                                                {entry.kind === 'folder'
                                                    ? tr('browser.folderType')
                                                    : tr('browser.fileType')}
                                            </small>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {menu ? (
                        <div
                            className="fm-ex__menu"
                            style={{ left: menu.x, top: menu.y }}
                            role="menu"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {menu.target.kind === 'entry' ? (
                                <>
                                    {menu.target.entry.kind === 'folder' ? (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => openFolder(menu.target.kind === 'entry' ? menu.target.entry.id : '')}
                                        >
                                            {tr('browser.open')}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            if (menu.target.kind === 'entry')
                                                openDetails(menu.target.entry, 'details');
                                        }}
                                    >
                                        {tr('networkFolder.details')}
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            if (menu.target.kind === 'entry')
                                                openDetails(menu.target.entry, 'access');
                                        }}
                                    >
                                        {tr('networkFolder.access')}
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            if (menu.target.kind === 'entry')
                                                setNameModal({ mode: 'rename', initial: menu.target.entry.name });
                                            closeMenu();
                                        }}
                                    >
                                        {tr('browser.renameFolder')}
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="is-danger"
                                        onClick={() => {
                                            setConfirmDelete(true);
                                            closeMenu();
                                        }}
                                    >
                                        {tr('browser.deleteFolder')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {path.length > 0 ? (
                                        <button type="button" role="menuitem" onClick={() => { goUp(); }}>
                                            {tr('browser.up')}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setNameModal({ mode: 'create', initial: tr('networkFolder.newFolderName') });
                                            closeMenu();
                                        }}
                                    >
                                        {tr('browser.newFolder')}
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            fileRef.current?.click();
                                            closeMenu();
                                        }}
                                    >
                                        {tr('browser.upload')}
                                    </button>
                                    {clipboard ? (
                                        <button type="button" role="menuitem" onClick={pasteClipboard}>
                                            {tr('browser.paste')}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setTree(cloneTree(INITIAL_NESTED));
                                            setAcl(cloneAcl(INITIAL_ACL));
                                            setPath([]);
                                            selectOnly(null);
                                            setClipboard(null);
                                            closeMenu();
                                        }}
                                    >
                                        {tr('browser.refresh')}
                                    </button>
                                </>
                            )}
                        </div>
                    ) : null}
                </div>

                <div className="fm-netfolder__status">{statusText}</div>
                {dropping ? (
                    <div className="fm-dropzone">
                        <Icon name="upload" />
                        {tr('browser.dropHint')}
                    </div>
                ) : null}

                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                        addFiles(Array.from(event.target.files ?? []));
                        event.target.value = '';
                    }}
                />
            </section>

            {showDrawer && selectedOne ? (
                <DetailsDrawer
                    entry={selectedOne}
                    location={locationLabel}
                    childCount={selectedChildCount}
                    rules={selectedRules}
                    tab={drawerTab}
                    onTab={setDrawerTab}
                    onClose={() => setDrawerOpen(false)}
                    onOpen={() => {
                        if (selectedOne.kind === 'folder')
                            openFolder(selectedOne.id);
                    }}
                    onRename={() => setNameModal({ mode: 'rename', initial: selectedOne.name })}
                    onDelete={() => setConfirmDelete(true)}
                    onGrant={grantAccess}
                    onChangeLevel={changeAccessLevel}
                    onRemove={removeAccess}
                />
            ) : null}

            {nameModal ? (
                <NamePrompt
                    title={nameModal.mode === 'create' ? tr('browser.newFolder') : tr('browser.renameFolder')}
                    label={nameModal.mode === 'create' || selectedOne?.kind === 'folder'
                        ? tr('browser.folderName')
                        : tr('networkFolder.fileName')}
                    initial={nameModal.initial}
                    onClose={() => setNameModal(null)}
                    onSubmit={(name) => (
                        nameModal.mode === 'create' ? createFolder(name) : renameSelected(name)
                    )}
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
                    onConfirm={deleteSelected}
                />
            ) : null}
        </div>
    );
}
