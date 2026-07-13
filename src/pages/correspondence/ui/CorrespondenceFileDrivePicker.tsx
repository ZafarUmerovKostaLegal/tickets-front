import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CORR_SCAN_ACCEPT, CORR_SCAN_MAX_BYTES } from '../model/constants';
import { isAllowedScanFile } from '@entities/correspondence';

type FileKind = 'image' | 'pdf' | 'doc' | 'sheet' | 'archive' | 'other';

function formatBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} Б`;
    if (bytes < 1024 * 1024)
        return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function detectFileKind(file: File): FileKind {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (type.startsWith('image/'))
        return 'image';
    if (type === 'application/pdf' || name.endsWith('.pdf'))
        return 'pdf';
    if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx'))
        return 'doc';
    if (type.includes('sheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx'))
        return 'sheet';
    if (type.includes('zip') || type.includes('rar') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z'))
        return 'archive';
    return 'other';
}

function FileKindIcon({ kind }: { kind: FileKind }) {
    if (kind === 'image') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
            </svg>
        );
    }
    if (kind === 'pdf') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 13h6M9 17h4" />
            </svg>
        );
    }
    if (kind === 'doc') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="14" y2="17" />
            </svg>
        );
    }
    if (kind === 'sheet') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18" />
            </svg>
        );
    }
    if (kind === 'archive') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M21 8v13H3V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M10 12h4" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
        </svg>
    );
}

type DriveFileItem = {
    file: File;
    key: string;
    kind: FileKind;
    previewUrl: string | null;
};

function buildDriveItems(files: File[]): DriveFileItem[] {
    return files.map((file, index) => ({
        file,
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        kind: detectFileKind(file),
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
}

export type CorrespondenceFileDrivePickerProps = {
    files: File[];
    onChange: (files: File[]) => void;
    disabled?: boolean;
    error?: string;
    hint?: string | null;
    onHint?: (hint: string | null) => void;
    accept?: string;
    maxBytes?: number;
    label?: string;
    required?: boolean;
};

export function CorrespondenceFileDrivePicker({
    files,
    onChange,
    disabled = false,
    error,
    hint,
    onHint,
    accept = CORR_SCAN_ACCEPT,
    maxBytes = CORR_SCAN_MAX_BYTES,
    label = 'Файлы',
    required = false,
}: CorrespondenceFileDrivePickerProps) {
    const inputId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const items = useMemo(() => buildDriveItems(files), [files]);

    useEffect(() => {
        return () => {
            for (const item of items) {
                if (item.previewUrl)
                    URL.revokeObjectURL(item.previewUrl);
            }
        };
    }, [items]);

    const appendFiles = useCallback((incoming: FileList | null) => {
        if (!incoming?.length || disabled)
            return;

        const added: File[] = [];
        for (const file of Array.from(incoming)) {
            if (file.size > maxBytes) {
                onHint?.(`${file.name}: файл больше ${formatBytes(maxBytes)}`);
                continue;
            }
            if (!isAllowedScanFile(file)) {
                onHint?.(`${file.name}: файл больше ${formatBytes(maxBytes)}`);
                continue;
            }
            added.push(file);
        }

        if (!added.length)
            return;

        onHint?.(null);
        onChange([...files, ...added]);
    }, [disabled, files, maxBytes, onChange, onHint]);

    const removeFile = (index: number) => {
        if (disabled)
            return;
        onChange(files.filter((_, i) => i !== index));
        onHint?.(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (disabled)
            return;
        appendFiles(e.dataTransfer.files);
    };

    return (
        <div className={`corr-drive${error ? ' corr-drive--err' : ''}`}>
            <div className="corr-drive__head">
                <span className="corr-drive__label">
                    {label}
                    {required ? <span className="corr-modal__req" aria-hidden> *</span> : null}
                </span>
                {files.length > 0 ? (
                    <span className="corr-drive__count">{files.length} {files.length === 1 ? 'файл' : files.length < 5 ? 'файла' : 'файлов'}</span>
                ) : null}
            </div>

            <div
                className={`corr-drive__zone-wrap${dragging ? ' corr-drive__zone-wrap--drag' : ''}`}
                onDragEnter={(e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragOver={(e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                        setDragging(false);
                }}
                onDrop={handleDrop}
            >
                {files.length === 0 ? (
                    <label
                        htmlFor={inputId}
                        className={`corr-drive__empty${disabled ? ' corr-drive__empty--disabled' : ''}`}
                    >
                        <span className="corr-drive__empty-icon" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </span>
                        <span className="corr-drive__empty-title">Перетащите файлы сюда</span>
                        <span className="corr-drive__empty-sub">
                            или <span className="corr-drive__empty-link">выберите на компьютере</span>
                        </span>
                        <span className="corr-drive__empty-hint">Любой формат, до {formatBytes(maxBytes)} на файл</span>
                    </label>
                ) : (
                    <div className="corr-drive__grid" role="list">
                        {items.map((item, index) => (
                            <article key={item.key} className="corr-drive__tile" role="listitem">
                                <div className={`corr-drive__tile-preview corr-drive__tile-preview--${item.kind}`}>
                                    {item.previewUrl
                                        ? <img src={item.previewUrl} alt="" className="corr-drive__tile-img" />
                                        : <FileKindIcon kind={item.kind} />}
                                </div>
                                <div className="corr-drive__tile-body">
                                    <span className="corr-drive__tile-name" title={item.file.name}>{item.file.name}</span>
                                    <span className="corr-drive__tile-size">{formatBytes(item.file.size)}</span>
                                </div>
                                <button
                                    type="button"
                                    className="corr-drive__tile-remove"
                                    onClick={() => removeFile(index)}
                                    disabled={disabled}
                                    aria-label={`Удалить ${item.file.name}`}
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </article>
                        ))}
                        <label
                            htmlFor={inputId}
                            className={`corr-drive__tile corr-drive__tile--add${disabled ? ' corr-drive__tile--disabled' : ''}`}
                            role="listitem"
                        >
                            <span className="corr-drive__add-icon" aria-hidden>+</span>
                            <span className="corr-drive__add-label">Добавить</span>
                        </label>
                    </div>
                )}

                {dragging ? (
                    <div className="corr-drive__drop-overlay" aria-hidden>
                        <span>Отпустите, чтобы загрузить</span>
                    </div>
                ) : null}
            </div>

            <input
                id={inputId}
                ref={fileInputRef}
                type="file"
                accept={accept}
                multiple
                className="corr-drive__input"
                disabled={disabled}
                onChange={(e) => {
                    appendFiles(e.target.files);
                    e.target.value = '';
                }}
            />

            {hint ? <p className="corr-modal__hint corr-modal__hint--warn">{hint}</p> : null}
            {error ? <p className="corr-modal__err">{error}</p> : null}
        </div>
    );
}
