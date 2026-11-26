import { useEffect, useMemo, useState } from 'react';
import type { AttachmentFolder } from '../lib/previewKinds';
import { Icon, useFm } from './fmShared';

type Row = AttachmentFolder & { depth: number; path: string };

function flatten(folders: AttachmentFolder[]): Row[] {
    const children = new Map<string | null, AttachmentFolder[]>();
    for (const folder of folders) {
        const list = children.get(folder.parentId) ?? [];
        list.push(folder);
        children.set(folder.parentId, list);
    }
    const ids = new Set(folders.map((folder) => folder.id));
    const out: Row[] = [];
    const walk = (parent: string | null, depth: number, prefix: string, seen: Set<string>) => {
        const list = [...(children.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        for (const folder of list) {
            if (seen.has(folder.id))
                continue;
            seen.add(folder.id);
            const path = prefix ? `${prefix} / ${folder.name}` : folder.name;
            out.push({ ...folder, depth, path });
            walk(folder.id, depth + 1, path, seen);
        }
    };
    const seen = new Set<string>();
    walk(null, 0, '', seen);
    for (const folder of folders) {
        if (!seen.has(folder.id) && (!folder.parentId || !ids.has(folder.parentId)))
            walk(folder.parentId, 0, '', seen);
    }
    return out;
}

export function AttachmentFolderPicker({ load, initialFolderId, busy, onSave, onCancel }: {
    load: () => Promise<AttachmentFolder[]>;
    initialFolderId: string | null;
    busy: boolean;
    onSave: (folderId: string | null) => void;
    onCancel: () => void;
}) {
    const { tr } = useFm();
    const [folders, setFolders] = useState<AttachmentFolder[] | null>(null);
    const [error, setError] = useState('');
    const [picked, setPicked] = useState<string | null>(initialFolderId);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let alive = true;
        load().then((rows) => {
            if (alive)
                setFolders(rows);
        }).catch((err: unknown) => {
            if (alive)
                setError(err instanceof Error ? err.message : String(err));
        });
        return () => {
            alive = false;
        };
    }, [load]);

    const rows = useMemo(() => flatten(folders ?? []), [folders]);
    const needle = query.trim().toLowerCase();
    const shown = needle ? rows.filter((row) => row.path.toLowerCase().includes(needle)) : rows;
    const pickedPath = picked ? rows.find((row) => row.id === picked)?.path ?? '' : tr('preview.matterRoot');

    return (
        <div className="fm-attpick" role="group" aria-label={tr('preview.pickFolder')}>
            <p className="fm-attpick__title">{tr('preview.pickFolder')}</p>
            {rows.length > 8 ? (
                <label className="fm-attpick__search">
                    <Icon name="search" />
                    <input type="search" value={query} placeholder={tr('preview.findFolder')} aria-label={tr('preview.findFolder')}
                        onChange={(event) => setQuery(event.target.value)} />
                </label>
            ) : null}
            {error ? <p className="fm-pv__save-error">{error}</p> : null}
            {folders === null && !error ? <p className="fm-attpick__muted">{tr('common.loading')}</p> : null}
            {folders ? (
                <ul className="fm-attpick__list" role="listbox" aria-label={tr('preview.pickFolder')}>
                    {!needle ? (
                        <li>
                            <button type="button" role="option" aria-selected={picked === null}
                                className={`fm-attpick__row${picked === null ? ' is-on' : ''}`} onClick={() => setPicked(null)}>
                                <Icon name="briefcase" /><span>{tr('preview.matterRoot')}</span>
                            </button>
                        </li>
                    ) : null}
                    {shown.map((row) => (
                        <li key={row.id}>
                            <button type="button" role="option" aria-selected={picked === row.id}
                                className={`fm-attpick__row${picked === row.id ? ' is-on' : ''}`}
                                style={{ paddingLeft: `${0.5 + (needle ? 0 : row.depth) * 0.9}rem` }}
                                title={row.path}
                                onClick={() => setPicked(row.id)}>
                                <Icon name={picked === row.id ? 'folderOpen' : 'folder'} />
                                <span>{needle ? row.path : row.name}</span>
                            </button>
                        </li>
                    ))}
                    {needle && !shown.length ? <li className="fm-attpick__muted">{tr('preview.noFolders')}</li> : null}
                </ul>
            ) : null}
            <div className="fm-attpick__foot">
                <span className="fm-attpick__target" title={pickedPath}><Icon name="folder" />{pickedPath}</span>
                <div className="fm-attpick__buttons">
                    <button type="button" className="fm-btn" disabled={busy} onClick={onCancel}>{tr('common.cancel')}</button>
                    <button type="button" className="fm-btn fm-btn--primary" disabled={busy || folders === null} onClick={() => onSave(picked)}>
                        {busy ? tr('preview.attachmentSaving') : tr('preview.saveHere')}
                    </button>
                </div>
            </div>
        </div>
    );
}
