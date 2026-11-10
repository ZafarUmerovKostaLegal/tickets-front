import { useMemo, useState } from 'react';
import { Icon, useFm } from './fmShared';

type DemoEntry = {
    id: string;
    name: string;
    kind: 'folder' | 'file';
    modified: string;
    size: string;
};

const DEMO_ROOT: DemoEntry[] = [
    { id: 'clients', name: 'Clients', kind: 'folder', modified: '—', size: '—' },
    { id: 'templates', name: 'Templates', kind: 'folder', modified: '—', size: '—' },
    { id: 'shared', name: 'Shared', kind: 'folder', modified: '—', size: '—' },
    { id: 'readme', name: 'README.txt', kind: 'file', modified: '01.11.2026, 10:00', size: '12 KB' },
];

const DEMO_NESTED: Record<string, DemoEntry[]> = {
    clients: [
        { id: 'acme', name: 'ACME', kind: 'folder', modified: '—', size: '—' },
        { id: 'floor24', name: '24 FLOOR', kind: 'folder', modified: '—', size: '—' },
    ],
    templates: [
        { id: 'nda', name: 'NDA.docx', kind: 'file', modified: '03.11.2026, 14:20', size: '48 KB' },
        { id: 'eng', name: 'Engagement.docx', kind: 'file', modified: '04.11.2026, 09:12', size: '61 KB' },
    ],
    shared: [
        { id: 'policy', name: 'Policy.pdf', kind: 'file', modified: '08.11.2026, 16:40', size: '220 KB' },
    ],
};

export function NetworkFolderView() {
    const { tr } = useFm();
    const [path, setPath] = useState<string[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState('');

    const entries = useMemo(() => {
        const key = path[path.length - 1];
        const rows = key ? (DEMO_NESTED[key] ?? []) : DEMO_ROOT;
        const q = filter.trim().toLowerCase();
        if (!q)
            return rows;
        return rows.filter((row) => row.name.toLowerCase().includes(q));
    }, [path, filter]);

    const openFolder = (id: string, name: string) => {
        setPath((prev) => [...prev, id]);
        setSelectedId(null);
        void name;
    };

    const goCrumb = (index: number) => {
        if (index < 0) {
            setPath([]);
            setSelectedId(null);
            return;
        }
        setPath((prev) => prev.slice(0, index + 1));
        setSelectedId(null);
    };

    return (
        <section className="fm-docs fm-docs--padded fm-netfolder">
            <div className="fm-netfolder__toolbar">
                <button
                    type="button"
                    className="fm-btn"
                    disabled={path.length === 0}
                    onClick={() => goCrumb(path.length - 2)}
                    title={tr('networkFolder.up')}
                >
                    <Icon name="up" />
                    {tr('networkFolder.up')}
                </button>
                <button type="button" className="fm-btn" disabled title={tr('networkFolder.connect')}>
                    <Icon name="link" />
                    {tr('networkFolder.connect')}
                </button>
                <button type="button" className="fm-btn" disabled>
                    <Icon name="refresh" />
                    {tr('common.retry')}
                </button>
                <label className="fm-search">
                    <Icon name="search" />
                    <input
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        placeholder={tr('networkFolder.filter')}
                    />
                </label>
            </div>

            <nav className="fm-netfolder__crumbs" aria-label={tr('networkFolder.root')}>
                <button type="button" className="fm-link" onClick={() => goCrumb(-1)}>
                    {tr('networkFolder.root')}
                </button>
                {path.map((segment, index) => {
                    const label = DEMO_ROOT.find((row) => row.id === segment)?.name
                        ?? DEMO_NESTED.clients?.find((row) => row.id === segment)?.name
                        ?? segment;
                    return (
                        <span key={`${segment}-${index}`} className="fm-netfolder__crumb">
                            <span className="fm-muted">/</span>
                            <button type="button" className="fm-link" onClick={() => goCrumb(index)}>
                                {label}
                            </button>
                        </span>
                    );
                })}
            </nav>

            <p className="fm-hint">{tr('networkFolder.uiOnly')}</p>

            <div className="fm-table-wrap fm-netfolder__table">
                <table className="fm-table">
                    <thead>
                        <tr>
                            <th>{tr('common.name')}</th>
                            <th>{tr('networkFolder.type')}</th>
                            <th>{tr('table.modified')}</th>
                            <th className="fm-table__num">{tr('table.size')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="fm-muted">{tr('networkFolder.empty')}</td>
                            </tr>
                        ) : entries.map((entry) => (
                            <tr
                                key={entry.id}
                                className={[
                                    entry.kind === 'folder' ? 'fm-table__folder' : '',
                                    selectedId === entry.id ? 'is-selected' : '',
                                ].filter(Boolean).join(' ') || undefined}
                                onClick={() => setSelectedId(entry.id)}
                                onDoubleClick={() => {
                                    if (entry.kind === 'folder')
                                        openFolder(entry.id, entry.name);
                                }}
                            >
                                <td>
                                    <span className="fm-table__name">
                                        <span className="fm-table__ico" aria-hidden>
                                            <Icon
                                                name={entry.kind === 'folder' ? 'folder' : 'list'}
                                                className={entry.kind === 'folder' ? 'fm-ico--folder' : undefined}
                                            />
                                        </span>
                                        <span>
                                            <strong>{entry.name}</strong>
                                        </span>
                                    </span>
                                </td>
                                <td className="fm-muted">
                                    {entry.kind === 'folder' ? tr('networkFolder.folder') : tr('networkFolder.file')}
                                </td>
                                <td>{entry.modified}</td>
                                <td className="fm-table__num">{entry.size}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
