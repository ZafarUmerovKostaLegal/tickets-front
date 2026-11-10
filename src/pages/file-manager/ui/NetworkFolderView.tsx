import { useMemo, useState } from 'react';
import { Icon, useFm } from './fmShared';

type DemoEntry = {
    id: string;
    name: string;
    kind: 'folder' | 'file';
};

const DEMO_ROOT: DemoEntry[] = [
    { id: 'agreements', name: 'Agreements', kind: 'folder' },
    { id: 'billing', name: 'Billing', kind: 'folder' },
    { id: 'corporate', name: 'Corporate Documents', kind: 'folder' },
    { id: 'correspondence', name: 'Correspondence', kind: 'folder' },
    { id: 'court', name: 'Court Documents', kind: 'folder' },
    { id: 'drafts', name: 'Drafts', kind: 'folder' },
    { id: 'research', name: 'Research & Memos', kind: 'folder' },
];

const DEMO_NESTED: Record<string, DemoEntry[]> = {
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

export function NetworkFolderView() {
    const { tr } = useFm();
    const [path, setPath] = useState<string[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const entries = useMemo(() => {
        const key = path[path.length - 1];
        return key ? (DEMO_NESTED[key] ?? []) : DEMO_ROOT;
    }, [path]);

    const openFolder = (id: string) => {
        setPath((prev) => [...prev, id]);
        setSelectedId(null);
    };

    const goUp = () => {
        setPath((prev) => prev.slice(0, -1));
        setSelectedId(null);
    };

    const empty = entries.length === 0;

    return (
        <section className="fm-tiles fm-netfolder">
            <div className="fm-tiles__content" onClick={() => setSelectedId(null)}>
                {empty ? (
                    <div className="fm-ex__empty">
                        <Icon name="folderOpen" className="fm-ico--folder" />
                        <p>{tr('networkFolder.empty')}</p>
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
                        {entries.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                className={selectedId === entry.id ? 'fm-ex__tile is-on' : 'fm-ex__tile'}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedId(entry.id);
                                }}
                                onDoubleClick={(event) => {
                                    event.stopPropagation();
                                    if (entry.kind === 'folder')
                                        openFolder(entry.id);
                                }}
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
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
