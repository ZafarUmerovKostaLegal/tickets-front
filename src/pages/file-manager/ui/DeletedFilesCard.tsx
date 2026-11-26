import { useCallback, useEffect, useMemo, useState } from 'react';
import { filesApi, type TrashItem } from '../api/filesApi';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { ConfirmModal, Icon, useAction, useFm } from './fmShared';

type Row = TrashItem & { archived: boolean };

function sizeOf(row: Row): number {
    return row.storedBytes ?? row.sizeBytes ?? 0;
}

export function DeletedFilesCard({ onChanged, onOpenMatter }: { onChanged: () => void; onOpenMatter: (matterId: string) => void }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const [rows, setRows] = useState<Row[] | null>(null);
    const [error, setError] = useState('');
    const [erase, setErase] = useState<Row[] | null>(null);
    const [showAll, setShowAll] = useState(false);

    const load = useCallback(async () => {
        setError('');
        try {
            const [trash, archived] = await Promise.all([
                filesApi.trash(false),
                filesApi.trash(true).catch(() => ({ items: [] as TrashItem[] })),
            ]);
            const next = [
                ...trash.items.map((item) => ({ ...item, archived: false })),
                ...archived.items.map((item) => ({ ...item, archived: true })),
            ].sort((a, b) => sizeOf(b) - sizeOf(a));
            setRows(next);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setRows([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const erasable = useMemo(() => (rows ?? []).filter((row) => row.canPurge), [rows]);
    const total = useMemo(() => erasable.reduce((sum, row) => sum + sizeOf(row), 0), [erasable]);
    const shown = showAll ? rows ?? [] : (rows ?? []).slice(0, 8);

    const restore = async (row: Row) => {
        const ok = await act(() => filesApi.restoreTrash(row.kind, row.id), tr('deletedX.restored'));
        if (ok) {
            await load();
            onChanged();
        }
    };

    const eraseRows = async (targets: Row[]) => {
        let bytes = 0;
        let failed = 0;
        for (const row of targets) {
            try {
                const result = await filesApi.eraseTrash(row.kind, row.id);
                bytes += result.bytes;
            }
            catch {
                failed += 1;
            }
        }
        await act(async () => {
            if (failed)
                throw new Error(tr('deletedX.partial', { n: failed }));
            return true;
        }, tr('deletedX.done', { size: formatBytes(bytes, locale) }));
        await load();
        onChanged();
    };

    return (
        <section className={`fm-mon-card fm-del${erasable.length ? ' is-warn' : ''}`}>
            <h3>
                <span className="fm-mon-card__ico" aria-hidden><Icon name="trash" /></span>
                {tr('deletedX.title')}
                {erasable.length ? (
                    <button type="button" className="fm-btn fm-btn--danger fm-del__all" onClick={() => setErase(erasable)}>
                        <Icon name="trash" />{tr('deletedX.eraseAll', { size: formatBytes(total, locale) })}
                    </button>
                ) : null}
            </h3>
            <p className="fm-del__hint">{tr('deletedX.hint')}</p>
            {error ? <p className="fm-del__error">{error}</p> : null}
            {rows === null ? (
                <div className="fm-mon-empty"><Icon name="clock" /><p>{tr('common.loading')}</p></div>
            ) : rows.length ? (
                <>
                    <ul className="fm-del__list">
                        {shown.map((row) => (
                            <li key={`${row.kind}-${row.id}`} className={row.archived ? 'is-archived' : undefined}>
                                <span className="fm-del__ico" aria-hidden><Icon name={row.kind === 'folder' ? 'folder' : 'template'} /></span>
                                <span className="fm-del__main">
                                    <strong title={row.name}>{row.name}</strong>
                                    <span>
                                        <button type="button" className="fm-del__matter" onClick={() => onOpenMatter(row.matterId)}>{row.matterName || '—'}</button>
                                        {row.kind === 'folder' ? ` · ${tr('deletedX.files', { n: row.documents ?? 0 })}` : ''}
                                        {` · ${tr('deletedX.by', { name: row.deletedBy || '—', when: formatDateTime(row.deletedAt, locale) })}`}
                                        {row.archived ? <em>{tr('deletedX.archived')}</em> : null}
                                    </span>
                                </span>
                                <b className="fm-del__size">{formatBytes(sizeOf(row), locale)}</b>
                                <span className="fm-del__actions">
                                    <button type="button" className="fm-btn" onClick={() => void restore(row)}>
                                        <Icon name="restore" /><span>{tr('deletedX.restore')}</span>
                                    </button>
                                    {row.canPurge ? (
                                        <button type="button" className="fm-btn fm-btn--danger" onClick={() => setErase([row])}>
                                            <Icon name="trash" /><span>{tr('deletedX.erase')}</span>
                                        </button>
                                    ) : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {rows.length > 8 ? (
                        <button type="button" className="fm-mon-card__link fm-del__more" onClick={() => setShowAll((value) => !value)}>
                            {showAll ? tr('deletedX.less') : tr('deletedX.more', { n: rows.length - 8 })}
                        </button>
                    ) : null}
                </>
            ) : (
                <div className="fm-mon-empty is-ok"><Icon name="check" /><p>{tr('deletedX.empty')}</p></div>
            )}
            {erase ? (
                <ConfirmModal
                    title={erase.length === 1 ? tr('deletedX.eraseTitle') : tr('deletedX.eraseAllTitle', { n: erase.length })}
                    text={erase.length === 1
                        ? tr('deletedX.eraseText', { name: erase[0].name, size: formatBytes(sizeOf(erase[0]), locale) })
                        : tr('deletedX.eraseAllText', { n: erase.length, size: formatBytes(erase.reduce((sum, row) => sum + sizeOf(row), 0), locale) })}
                    confirmLabel={tr('deletedX.erase')}
                    danger
                    onClose={() => setErase(null)}
                    onConfirm={() => eraseRows(erase)}
                />
            ) : null}
        </section>
    );
}
