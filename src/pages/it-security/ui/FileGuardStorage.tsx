import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteFileGuardStorage, type FileGuardStoredFile } from '../model/fileGuardApi';
import {
    filterStorageFiles,
    formatFileSize,
    formatStorageWhen,
    groupStorageByMonth,
    storagePersonLabel,
} from '../model/fileGuardStorage';

type PendingDelete = {
    ids: string[];
    title: string;
    text: string;
};

type FileGuardStorageProps = {
    items: FileGuardStoredFile[];
    totalBytes: number;
    query: string;
    userId: string;
    loadError: string;
    onPreview: (eventId: string, fileName: string) => void;
    onDownload: (eventId: string, fileName: string) => void;
    onChanged: () => void;
};

export function FileGuardStorage({
    items,
    totalBytes,
    query,
    userId,
    loadError,
    onPreview,
    onDownload,
    onChanged,
}: FileGuardStorageProps) {
    const [monthsOpen, setMonthsOpen] = useState<Record<string, boolean>>({});
    const [pending, setPending] = useState<PendingDelete | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const visible = useMemo(() => filterStorageFiles(items, query, userId), [items, query, userId]);
    const months = useMemo(() => groupStorageByMonth(visible), [visible]);
    const visibleBytes = visible.reduce((sum, file) => sum + file.fileSize, 0);

    useEffect(() => {
        if (!pending)
            return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy)
                setPending(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pending, busy]);

    const ask = (next: PendingDelete) => {
        setError('');
        setPending(next);
    };

    const confirm = () => {
        if (!pending || busy)
            return;
        setBusy(true);
        setError('');
        void deleteFileGuardStorage(pending.ids)
            .then(() => {
                setPending(null);
                onChanged();
            })
            .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : 'Файл не удалось удалить');
            })
            .finally(() => setBusy(false));
    };

    return (
        <div className="its-j__storage">
            <div className="its-j__storage-note">
                <span>Копии файлов, которые программа сохранила. Удаление освобождает диск, запись в журнале остаётся.</span>
                <span className="its-j__mono">{formatFileSize(query || userId !== 'all' ? visibleBytes : totalBytes)} · {visible.length}</span>
            </div>
            {loadError ? <p className="its-j__bad" role="alert">{loadError}</p> : null}
            {months.length === 0 ? (
                <div className="its-j__empty">{loadError ? 'Хранилище не загрузилось' : 'В хранилище пока нет файлов'}</div>
            ) : months.map((month) => {
                const open = Object.prototype.hasOwnProperty.call(monthsOpen, month.key) ? monthsOpen[month.key] : month.openByDefault;
                return (
                    <section key={month.key} className="its-j__storage-month">
                        <button
                            type="button"
                            className={`its-j__day its-j__month${open ? ' is-open' : ''}`}
                            aria-expanded={open}
                            onClick={() => setMonthsOpen((current) => ({ ...current, [month.key]: !open }))}
                        >
                            <span className="its-j__day-title">
                                <span className="its-j__day-mark" aria-hidden />
                                {month.label}
                            </span>
                            <span>{month.files.length} · {formatFileSize(month.bytes)}</span>
                        </button>
                        {open ? (
                            <div className="its-j__storage-body">
                                <div className="its-j__storage-tools">
                                    <button
                                        type="button"
                                        className="its-j__btn its-j__btn--danger"
                                        onClick={() => ask({
                                            ids: month.files.map((file) => file.id),
                                            title: `Удалить файлы за ${month.label}?`,
                                            text: `С диска будут удалены ${month.files.length} файлов, освободится ${formatFileSize(month.bytes)}. Записи журнала останутся, но открыть эти файлы будет нельзя.`,
                                        })}
                                    >
                                        Удалить файлы месяца
                                    </button>
                                </div>
                                <div className="its-j__table its-j__store">
                                    <div className="its-j__thead">
                                        <span>Файл</span>
                                        <span>Сотрудник</span>
                                        <span>Когда сохранён</span>
                                        <span>Размер</span>
                                        <span>Действия</span>
                                    </div>
                                    {month.files.map((file) => {
                                        const person = storagePersonLabel(file.windowsUser, file.host);
                                        const extra = file.users.length > 1 ? ` · ещё ${file.users.length - 1}` : '';
                                        return (
                                            <div key={file.id} className="its-j__trow its-j__store-row">
                                                <span className="its-j__stack">
                                                    <span className="its-j__strong">{file.fileName}</span>
                                                    {file.copies > 1 ? (
                                                        <span className="its-j__mono its-j__meta">В журнале {file.copies} раз, на диске одна копия</span>
                                                    ) : null}
                                                </span>
                                                <span>{person}{extra}</span>
                                                <span className="its-j__mono its-j__meta">{formatStorageWhen(file.occurredAt)}</span>
                                                <span className="its-j__mono">{formatFileSize(file.fileSize)}</span>
                                                <span className="its-j__store-actions">
                                                    <button type="button" className="its-j__btn its-j__btn--accent" onClick={() => onPreview(file.id, file.fileName)}>
                                                        Просмотр
                                                    </button>
                                                    <button type="button" className="its-j__btn" onClick={() => onDownload(file.id, file.fileName)}>
                                                        Скачать
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="its-j__btn its-j__btn--danger"
                                                        onClick={() => ask({
                                                            ids: [file.id],
                                                            title: 'Удалить файл с диска?',
                                                            text: file.copies > 1
                                                                ? `«${file.fileName}» хранится одной копией и встречается в журнале ${file.copies} раз. Копия будет удалена, освободится ${formatFileSize(file.fileSize)}. Записи журнала останутся.`
                                                                : `«${file.fileName}» будет удалён из хранилища. Освободится ${formatFileSize(file.fileSize)}. Запись в журнале останется.`,
                                                        })}
                                                    >
                                                        Удалить
                                                    </button>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </section>
                );
            })}
            {pending ? createPortal(
                <div className="its-preview" role="presentation" onClick={() => { if (!busy) setPending(null); }}>
                    <div
                        className="its-preview__dialog its-store-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="its-store-confirm-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="its-store-confirm-title" className="its-preview__title">{pending.title}</h2>
                        <p className="its-store-confirm__text">{pending.text}</p>
                        {error ? <p className="its-j__bad" role="alert">{error}</p> : null}
                        <div className="its-store-confirm__actions">
                            <button type="button" className="its-j__btn" disabled={busy} onClick={() => setPending(null)}>Отмена</button>
                            <button type="button" className="its-j__btn its-j__btn--danger-solid" disabled={busy} onClick={confirm}>
                                {busy ? 'Удаляем…' : 'Удалить'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            ) : null}
        </div>
    );
}
