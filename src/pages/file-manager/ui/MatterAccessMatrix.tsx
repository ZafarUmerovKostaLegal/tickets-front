import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchableSelect } from '@shared/ui';
import {
    filesApi,
    type ClientsResponse,
    type FolderAccessLevel,
    type MatterAccessMatrix as MatrixData,
    type MatrixRule,
} from '../api/filesApi';
import { endOfDay, isFuture, todayPlus } from '../lib/accessDates';
import { usePeopleNames } from '../lib/usePeopleNames';
import { FileBadge, Icon, StateBlock, useAction, useFm, useLoad, type IconName } from './fmShared';
import './MatrixWorkspace.css';
import './MatterAccessMatrix.css';

type Cell = 'own' | 'read' | 'edit' | 'deny' | 'none' | 'partner';
type Target = { kind: 'folder' | 'file'; id: string; name: string };
type Pop = { userId: number; userName: string; target: Target; level: Cell; rule: MatrixRule | null; x: number; y: number };
type Row =
    | { kind: 'folder'; id: string; name: string; depth: number; hasChildren: boolean; files: number; inherit: boolean }
    | { kind: 'file'; id: string; name: string; depth: number; fileKind: MatrixData['documents'][number]['kind']; restricted: boolean; createdById: number }
    | { kind: 'root'; id: string; name: string; depth: number; files: number };

const MATTER_KEY = 'fm.matrix.matter';
const ROOT = '__root__';
const FOLDER_LEVELS = ['own', 'read', 'edit', 'deny'] as const;
const FILE_LEVELS = ['read', 'edit', 'deny'] as const;
const CELL_ICON: Record<Cell, IconName> = { own: 'user', read: 'eye', edit: 'edit', deny: 'lock', none: 'x', partner: 'key' };

function readKey(key: string): string {
    try {
        return localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
}

function writeKey(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* storage is optional */
    }
}

export function MatterAccessMatrix({ clients, onOpenSecurity }: { clients: ClientsResponse; onOpenSecurity: (matterId: string) => void }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const matters = useMemo(
        () => clients.clients.flatMap((client) => client.matters.map((matter) => ({ ...matter, clientName: client.name }))),
        [clients],
    );
    const [matterId, setMatterId] = useState(() => {
        const saved = readKey(MATTER_KEY);
        return matters.some((matter) => matter.id === saved) ? saved : matters.find((matter) => !matter.closed)?.id ?? matters[0]?.id ?? '';
    });
    const load = useLoad(matterId ? () => filesApi.matterAccessMatrix(matterId) : null, [matterId]);
    const people = usePeopleNames(tr('security.userFallback', { id: '{id}' }));
    const [query, setQuery] = useState('');
    const [fileQuery, setFileQuery] = useState('');
    const [onlyRules, setOnlyRules] = useState(false);
    const [open, setOpen] = useState<Set<string>>(new Set([ROOT]));
    const [hover, setHover] = useState<{ row: string | null; col: number | null }>({ row: null, col: null });
    const [pop, setPop] = useState<Pop | null>(null);
    const [popUntil, setPopUntil] = useState('');
    const popRef = useRef<HTMLDivElement>(null);
    const data = load.data && load.data.matter.id === matterId ? load.data : null;

    useEffect(() => writeKey(MATTER_KEY, matterId), [matterId]);

    const cols = useMemo(() => {
        if (!data)
            return [];
        const text = query.trim().toLowerCase();
        const ruleUsers = new Set(
            [...Object.keys(data.folderRules), ...Object.keys(data.fileRules)].map((key) => Number(key.split(':')[0])),
        );
        return data.people
            .map((person) => ({
                ...person,
                name: people.nameOf(person.userId, person.name),
                position: people.positionOf(person.userId, person.position),
            }))
            .filter((person) => !text || `${person.name} ${person.position}`.toLowerCase().includes(text))
            .filter((person) => !onlyRules || ruleUsers.has(person.userId));
    }, [data, query, onlyRules, people]);

    const tree = useMemo(() => {
        if (!data)
            return { rows: [] as Row[], folderIds: [] as string[] };
        const children = new Map<string | null, MatrixData['folders']>();
        for (const folder of data.folders) {
            const list = children.get(folder.parentId) ?? [];
            list.push(folder);
            children.set(folder.parentId, list);
        }
        const filesOf = new Map<string | null, MatrixData['documents']>();
        for (const doc of data.documents) {
            const list = filesOf.get(doc.folderId) ?? [];
            list.push(doc);
            filesOf.set(doc.folderId, list);
        }
        const needle = fileQuery.trim().toLowerCase();
        const matches = (name: string) => !needle || name.toLowerCase().includes(needle);
        const keep = new Set<string>();
        if (needle) {
            const parentOf = new Map(data.folders.map((folder) => [folder.id, folder.parentId]));
            const mark = (id: string | null) => {
                let current = id;
                while (current && !keep.has(current)) {
                    keep.add(current);
                    current = parentOf.get(current) ?? null;
                }
            };
            for (const folder of data.folders) {
                if (matches(folder.name))
                    mark(folder.id);
            }
            for (const doc of data.documents) {
                if (matches(doc.name))
                    mark(doc.folderId);
            }
        }
        const rows: Row[] = [];
        const walk = (parent: string | null, depth: number) => {
            const list = [...(children.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name, locale));
            for (const folder of list) {
                if (needle && !keep.has(folder.id))
                    continue;
                const files = filesOf.get(folder.id) ?? [];
                rows.push({
                    kind: 'folder', id: folder.id, name: folder.name, depth, files: files.length, inherit: folder.inherit,
                    hasChildren: Boolean(children.get(folder.id)?.length || files.length),
                });
                if (needle || open.has(folder.id)) {
                    walk(folder.id, depth + 1);
                    for (const doc of files) {
                        if (!needle || matches(doc.name) || matches(folder.name))
                            rows.push({ kind: 'file', id: doc.id, name: doc.name, depth: depth + 1, fileKind: doc.kind, restricted: doc.restricted, createdById: doc.createdById });
                    }
                }
            }
        };
        walk(null, 0);
        const rootFiles = (filesOf.get(null) ?? []).filter((doc) => matches(doc.name));
        if (rootFiles.length) {
            rows.push({ kind: 'root', id: ROOT, name: tr('matrixF.rootFiles'), depth: 0, files: rootFiles.length });
            if (needle || open.has(ROOT)) {
                for (const doc of rootFiles)
                    rows.push({ kind: 'file', id: doc.id, name: doc.name, depth: 1, fileKind: doc.kind, restricted: doc.restricted, createdById: doc.createdById });
            }
        }
        return { rows, folderIds: data.folders.map((folder) => folder.id) };
    }, [data, open, fileQuery, locale, tr]);

    const folderCell = (person: MatrixData['people'][number], folderId: string): Cell => {
        if (person.partner)
            return 'partner';
        const level = data?.folderCells[`${person.userId}:${folderId}`];
        if (level)
            return level;
        return person.matterLevel === 'none' || person.matterLevel === 'deny' ? 'none' : 'own';
    };

    const fileCell = (person: MatrixData['people'][number], doc: { id: string; folderId: string | null; createdById: number; restricted: boolean }): Cell => {
        if (person.partner)
            return 'partner';
        const folderLevel = doc.folderId ? data?.folderCells[`${person.userId}:${doc.folderId}`] : undefined;
        if (folderLevel === 'deny')
            return 'deny';
        if (doc.createdById === person.userId)
            return 'edit';
        const rule = data?.fileRules[`${person.userId}:${doc.id}`]?.effective;
        if (rule)
            return rule === 'deny' ? 'deny' : rule;
        if ((folderLevel === 'read' || folderLevel === 'edit') && !doc.restricted)
            return folderLevel;
        return 'none';
    };

    const docById = useMemo(() => new Map((data?.documents ?? []).map((doc) => [doc.id, doc])), [data]);

    useLayoutEffect(() => {
        const node = popRef.current;
        if (!node || !pop)
            return;
        const rect = node.getBoundingClientRect();
        const limit = window.innerHeight - 8;
        if (rect.bottom > limit) {
            const y = Math.max(8, limit - rect.height);
            if (Math.abs(y - pop.y) > 1)
                setPop((prev) => (prev ? { ...prev, y } : prev));
        }
    }, [pop]);

    useEffect(() => {
        if (!pop)
            return;
        const close = (event: MouseEvent) => {
            if (popRef.current && !popRef.current.contains(event.target as Node))
                setPop(null);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setPop(null);
        };
        const onResize = () => setPop(null);
        window.addEventListener('mousedown', close);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('mousedown', close);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onResize);
        };
    }, [pop]);

    const openPop = (node: HTMLElement, person: { userId: number; name: string }, target: Target, level: Cell, rule: MatrixRule | null) => {
        const rect = node.getBoundingClientRect();
        const width = Math.min(300, window.innerWidth - 16);
        const x = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
        setPopUntil(rule?.until ? rule.until.slice(0, 10) : '');
        setPop({ userId: person.userId, userName: person.name, target, level, rule, x, y: rect.bottom + 8 });
    };

    const apply = async (current: Pop, level: FolderAccessLevel) => {
        setPop(null);
        const body = { userId: current.userId, userName: current.userName, level, note: '', until: endOfDay(popUntil) };
        const ok = await act(
            () => (current.target.kind === 'folder'
                ? filesApi.setFolderAccess(current.target.id, body)
                : filesApi.setDocumentAccess(current.target.id, body)),
            tr('folderAccess.saved'),
        );
        if (ok)
            load.reload();
    };

    const reset = async (current: Pop) => {
        setPop(null);
        const ok = await act(
            () => (current.target.kind === 'folder'
                ? filesApi.removeFolderAccess(current.target.id, current.userId)
                : filesApi.removeDocumentAccess(current.target.id, current.userId)),
            tr('folderAccess.saved'),
        );
        if (ok)
            load.reload();
    };

    const toggle = (id: string) => setOpen((prev) => {
        const next = new Set(prev);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        return next;
    });

    const cellTitle = (level: Cell) => tr(`matrixF.cell.${level}`);
    const allOpen = tree.folderIds.length > 0 && tree.folderIds.every((id) => open.has(id));
    const currentMatter = matters.find((matter) => matter.id === matterId);

    return (
        <>
            <div className="fm-mx__bar">
                <div className="fm-mx__client fm-mxf__matter">
                    <SearchableSelect
                        value={matterId}
                        items={matters}
                        getOptionValue={(matter) => matter.id}
                        getOptionLabel={(matter) => `${matter.code ? `${matter.code} · ` : ''}${matter.name}`}
                        getSearchText={(matter) => `${matter.code} ${matter.name} ${matter.clientName}`}
                        onSelect={(matter) => {
                            setMatterId(matter.id);
                            setPop(null);
                            setOpen(new Set([ROOT]));
                        }}
                        placeholder={tr('matrixF.pickMatter')}
                    />
                </div>
                <label className="fm-sx-search fm-mx__search">
                    <Icon name="search" />
                    <input value={fileQuery} onChange={(event) => setFileQuery(event.target.value)}
                        placeholder={tr('matrixF.searchFile')} aria-label={tr('matrixF.searchFile')} />
                </label>
                <label className="fm-sx-search fm-mx__search">
                    <Icon name="user" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)}
                        placeholder={tr('matrix.searchUser')} aria-label={tr('matrix.searchUser')} />
                </label>
                <div className="fm-mx__toggles">
                    <button type="button" className={onlyRules ? 'fm-sx-chip is-on' : 'fm-sx-chip'} aria-pressed={onlyRules}
                        onClick={() => setOnlyRules((on) => !on)}>
                        {tr('matrixF.onlyRules')}
                    </button>
                    <button type="button" className="fm-sx-chip" disabled={!tree.folderIds.length}
                        onClick={() => setOpen(allOpen ? new Set() : new Set([...tree.folderIds, ROOT]))}>
                        {allOpen ? tr('matrixF.collapseAll') : tr('matrixF.expandAll')}
                    </button>
                </div>
                {currentMatter ? (
                    <button type="button" className="fm-btn fm-mx__grant" onClick={() => onOpenSecurity(currentMatter.id)}>
                        <Icon name="shield" />{tr('matrixX.openMatter')}
                    </button>
                ) : null}
            </div>

            <div className="fm-mx__legend">
                {(['own', 'read', 'edit', 'deny', 'none'] as const).map((level) => (
                    <span key={level}><i className={`fm-mx-cell is-${level}`} aria-hidden><Icon name={CELL_ICON[level]} /></i>{cellTitle(level)}</span>
                ))}
                <span><i className="fm-mx-cell is-explicit is-edit" aria-hidden><Icon name="edit" /></i>{tr('matrixF.explicit')}</span>
                <span className="fm-mx__legend-hint">{tr('matrixF.hint')}</span>
            </div>

            <StateBlock loading={load.loading && !data} error={load.error} onRetry={load.reload}
                empty={data && data.people.length === 0 ? tr('matrix.empty') : undefined}>
                {data ? (
                    !cols.length || !tree.rows.length ? (
                        <div className="fm-sx-empty"><Icon name="search" /><p>{tr('matrix.noFilterMatches')}</p></div>
                    ) : (
                        <div className="fm-mx__wrap fm-mxf" onScroll={() => setPop(null)} onMouseLeave={() => setHover({ row: null, col: null })}>
                            <table className="fm-mx__table">
                                <thead>
                                    <tr>
                                        <th className="fm-mx__corner">
                                            {tr('matrixF.corner', { folders: data.folders.length, files: data.documents.length })}
                                            <small>{tr('matrixX.people', { n: cols.length })}</small>
                                        </th>
                                        {cols.map((person) => (
                                            <th key={person.userId} className={`fm-mx__col fm-mxf__person${hover.col === person.userId ? ' is-hover' : ''}`}
                                                title={`${person.name}${person.position ? ` · ${person.position}` : ''}`}>
                                                <div>
                                                    <span>{person.name}</span>
                                                    <em>{person.partner ? tr('matrixF.partner') : person.position || tr('security.noPosition')}</em>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tree.rows.map((row) => {
                                        const rowKey = `${row.kind}:${row.id}`;
                                        return (
                                            <tr key={rowKey} className={`fm-mxf__row is-${row.kind}${hover.row === rowKey ? ' is-hover' : ''}`}>
                                                <th className="fm-mx__who fm-mxf__item" style={{ paddingLeft: `${0.6 + row.depth * 1.1}rem` }}>
                                                    {row.kind === 'file' ? (
                                                        <span className="fm-mxf__name">
                                                            <FileBadge kind={row.fileKind} />
                                                            <span title={row.name}>{row.name}</span>
                                                            {row.restricted ? <Icon name="lock" className="fm-mxf__lock" /> : null}
                                                        </span>
                                                    ) : (
                                                        <button type="button" className="fm-mxf__name fm-mxf__toggle" aria-expanded={open.has(row.id) || Boolean(fileQuery.trim())}
                                                            disabled={row.kind === 'folder' && !row.hasChildren} onClick={() => toggle(row.id)}>
                                                            <Icon name="chevron" className={`fm-mxf__caret${open.has(row.id) || fileQuery.trim() ? ' is-open' : ''}`} />
                                                            <Icon name={row.kind === 'root' ? 'briefcase' : open.has(row.id) ? 'folderOpen' : 'folder'} className="fm-mxf__folder" />
                                                            <span title={row.name}>{row.name}</span>
                                                            <small>{row.files}</small>
                                                            {row.kind === 'folder' && !row.inherit ? <em className="fm-mxf__break" title={tr('matrixF.noInherit')}>⊘</em> : null}
                                                        </button>
                                                    )}
                                                </th>
                                                {cols.map((person) => {
                                                    if (row.kind === 'root')
                                                        return <td key={person.userId} className={hover.col === person.userId ? 'is-hover' : undefined} />;
                                                    const key = `${person.userId}:${row.id}`;
                                                    const isFolder = row.kind === 'folder';
                                                    const rule = (isFolder ? data.folderRules[key] : data.fileRules[key]) ?? null;
                                                    const doc = isFolder ? null : docById.get(row.id);
                                                    const level = isFolder ? folderCell(person, row.id) : doc ? fileCell(person, doc) : 'none';
                                                    const paused = Boolean(rule && isFuture(rule.suspendedUntil));
                                                    const author = !isFolder && doc?.createdById === person.userId;
                                                    const active = pop?.userId === person.userId && pop.target.id === row.id;
                                                    return (
                                                        <td key={person.userId} className={hover.col === person.userId ? 'is-hover' : undefined}
                                                            onMouseEnter={() => setHover({ row: rowKey, col: person.userId })}>
                                                            <button type="button"
                                                                className={['fm-mx-cell', `is-${level}`, rule ? 'is-explicit' : '', paused ? 'is-paused' : '', active ? 'is-active' : '']
                                                                    .filter(Boolean).join(' ')}
                                                                disabled={person.partner || author}
                                                                title={`${person.name} · ${row.name}: ${cellTitle(level)}${author ? ` · ${tr('folderAccess.fileAuthor')}` : ''}${rule ? ` · ${tr('matrixF.explicit')}` : ''}`}
                                                                aria-label={`${person.name}, ${row.name}: ${cellTitle(level)}`}
                                                                onClick={(event) => openPop(event.currentTarget, person, { kind: isFolder ? 'folder' : 'file', id: row.id, name: row.name }, level, rule)}>
                                                                <Icon name={author ? 'user' : CELL_ICON[level]} />
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : null}
            </StateBlock>
            {data?.truncated ? <p className="fm-mx__legend-hint">{tr('matrixF.truncated', { n: data.documents.length })}</p> : null}

            {pop ? (
                <div ref={popRef} className="fm-mx-pop fm-mxf-pop" style={{ left: pop.x, top: pop.y }} role="dialog" aria-label={pop.userName}>
                    <header className="fm-mx-pop__head">
                        <span className="fm-mx-pop__avatar" aria-hidden><Icon name={pop.target.kind === 'folder' ? 'folder' : 'template'} /></span>
                        <span className="fm-mx-pop__who">
                            <strong>{pop.userName}</strong>
                            <small title={pop.target.name}>{pop.target.name}</small>
                        </span>
                        <button type="button" className="fm-mx-pop__close" aria-label={tr('common.close')} onClick={() => setPop(null)}>
                            <Icon name="close" />
                        </button>
                    </header>
                    <p className={`fm-mx-pop__now is-${pop.level}`}>
                        <span>{tr('matrix.current')}</span>
                        <strong>{cellTitle(pop.level)}</strong>
                        <em>{pop.rule ? tr('matrixF.explicit') : pop.target.kind === 'folder' ? tr('matrixF.fromParent') : tr('matrixF.fromFolder')}</em>
                    </p>
                    <div className="fm-mx-pop__levels" role="radiogroup" aria-label={tr('folderAccess.levelLabel')}>
                        {(pop.target.kind === 'folder' ? FOLDER_LEVELS : FILE_LEVELS).map((level) => {
                            const on = pop.rule?.level === level;
                            return (
                                <button key={level} type="button" role="radio" aria-checked={on}
                                    className={`fm-mx-pop__level is-${level}${on ? ' is-on' : ''}`}
                                    onClick={() => void apply(pop, level)}>
                                    <span className="fm-mx-pop__ico"><Icon name={CELL_ICON[level]} /></span>
                                    <span className="fm-mx-pop__text">
                                        <strong>{tr(`matrixF.cell.${level}`)}</strong>
                                        <small>{tr(`matrixF.${pop.target.kind}Hint.${level}`)}</small>
                                    </span>
                                    {on ? <Icon name="check" className="fm-mx-pop__check" /> : null}
                                </button>
                            );
                        })}
                    </div>
                    <div className="fm-mx-pop__extra">
                        <label>
                            <span>{tr('securityX.untilOptional')}</span>
                            <input type="date" value={popUntil} min={todayPlus(0)} onChange={(event) => setPopUntil(event.target.value)} />
                        </label>
                    </div>
                    <footer>
                        {pop.rule ? (
                            <button type="button" className="fm-mx-pop__link is-danger" onClick={() => void reset(pop)}>
                                {pop.target.kind === 'folder' ? tr('matrixF.resetFolder') : tr('matrixF.resetFile')}
                            </button>
                        ) : <span className="fm-mx-pop__hint">{tr('matrixF.noRule')}</span>}
                    </footer>
                </div>
            ) : null}
        </>
    );
}
