import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import { ConfirmModal, Icon, Modal, useFm } from './fmShared';

type DemoEntry = {
    id: string;
    name: string;
    kind: 'folder' | 'file';
};

type TreeMap = Record<string, DemoEntry[]>;

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

const ROOT_KEY = '';

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

function cloneTree(source: TreeMap): TreeMap {
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
                    <button
                        type="button"
                        className="fm-btn fm-btn--primary"
                        disabled={!name.trim()}
                        onClick={submit}
                    >
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

export function NetworkFolderView() {
    const { tr } = useFm();
    const [tree, setTree] = useState<TreeMap>(() => cloneTree(INITIAL_NESTED));
    const [path, setPath] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [menu, setMenu] = useState<CtxMenu | null>(null);
    const [nameModal, setNameModal] = useState<NameModal | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [propertiesOpen, setPropertiesOpen] = useState(false);
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

    const closeMenu = () => setMenu(null);

    const selectOnly = (id: string | null) => {
        setSelectedIds(id ? [id] : []);
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
        selectOnly(id);
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

    const openCtx = (event: ReactMouseEvent, target: CtxMenu['target']) => {
        event.preventDefault();
        event.stopPropagation();
        const bound = contentRef.current?.getBoundingClientRect();
        const x = bound ? Math.min(event.clientX - bound.left, bound.width - 200) : event.clientX;
        const y = bound ? Math.min(event.clientY - bound.top, bound.height - 220) : event.clientY;
        if (target.kind === 'entry') {
            setSelectedIds((prev) => (prev.includes(target.entry.id) ? prev : [target.entry.id]));
        }
        setMenu({ x: Math.max(8, x), y: Math.max(8, y), target });
    };

    const onDropFiles = (event: DragEvent) => {
        event.preventDefault();
        setDropping(false);
        addFiles(Array.from(event.dataTransfer.files ?? []));
    };

    const onKeyDown = useCallback((event: KeyboardEvent) => {
        if (nameModal || confirmDelete || propertiesOpen)
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
    }, [confirmDelete, entries, nameModal, path.length, propertiesOpen, selected, selectedOne, clipboard, folderKey]);

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
                                                selectOnly(entry.id);
                                            }
                                        }
                                        else {
                                            selectOnly(entry.id);
                                        }
                                        closeMenu();
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        if (entry.kind === 'folder')
                                            openFolder(entry.id);
                                        else
                                            setPropertiesOpen(true);
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
                                <button type="button" role="menuitem" onClick={() => cutOrCopy('cut')}>
                                    {tr('browser.cut')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => cutOrCopy('copy')}>
                                    {tr('browser.copy')}
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
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setPropertiesOpen(true);
                                        closeMenu();
                                    }}
                                >
                                    {tr('browser.properties')}
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

            {propertiesOpen && selectedOne ? (
                <Modal
                    title={tr('browser.properties')}
                    onClose={() => setPropertiesOpen(false)}
                    footer={(
                        <button type="button" className="fm-btn fm-btn--primary" onClick={() => setPropertiesOpen(false)}>
                            {tr('common.close')}
                        </button>
                    )}
                >
                    <dl className="fm-netfolder__props">
                        <div>
                            <dt>{tr('common.name')}</dt>
                            <dd>{selectedOne.name}</dd>
                        </div>
                        <div>
                            <dt>{tr('networkFolder.type')}</dt>
                            <dd>
                                {selectedOne.kind === 'folder'
                                    ? tr('browser.folderType')
                                    : tr('browser.fileType')}
                            </dd>
                        </div>
                        <div>
                            <dt>{tr('networkFolder.location')}</dt>
                            <dd>
                                {tr('networkFolder.root')}
                                {crumbLabels.length ? ` \\ ${crumbLabels.map((item) => item.name).join(' \\ ')}` : ''}
                            </dd>
                        </div>
                    </dl>
                </Modal>
            ) : null}
        </section>
    );
}
