import { useEffect, useState } from 'react';
import { fetchChatAttachmentBlob, type ChatAttachment } from '@entities/chat';

function formatSize(bytes: number): string {
    if (!bytes || bytes < 0)
        return '';
    if (bytes < 1024)
        return `${bytes} Б`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function IconFile() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
        </svg>
    );
}

function IconDownload() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

export function KostaDailyAttachment({ attachment, onPreview }: {
    attachment: ChatAttachment;
    onPreview?: (url: string, name: string) => void;
}) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const isImage = attachment.content_type.startsWith('image/');

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setError(false);
        setUrl(null);
        fetchChatAttachmentBlob(attachment.id)
            .then((blob) => {
                if (cancelled)
                    return;
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            })
            .catch(() => {
                if (!cancelled)
                    setError(true);
            });
        return () => {
            cancelled = true;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [attachment.id]);

    const download = () => {
        if (!url)
            return;
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.file_name || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    if (isImage && !error) {
        return (
            <button
                type="button"
                className="kd-tg__attach-image"
                onClick={() => {
                    if (!url)
                        return;
                    if (onPreview)
                        onPreview(url, attachment.file_name);
                    else
                        window.open(url, '_blank', 'noopener');
                }}
                title={attachment.file_name}
            >
                {url ? (
                    <img src={url} alt={attachment.file_name} loading="lazy" decoding="async" />
                ) : (
                    <span className="kd-tg__attach-image-loading" aria-hidden />
                )}
            </button>
        );
    }

    return (
        <div className="kd-tg__attach-file">
            <span className="kd-tg__attach-file-icon" aria-hidden><IconFile /></span>
            <span className="kd-tg__attach-file-info">
                <span className="kd-tg__attach-file-name">{attachment.file_name}</span>
                <span className="kd-tg__attach-file-size">
                    {error ? 'Не удалось загрузить' : formatSize(attachment.size_bytes)}
                </span>
            </span>
            <button
                type="button"
                className="kd-tg__attach-file-download"
                onClick={download}
                disabled={!url}
                aria-label="Скачать"
                title="Скачать"
            >
                <IconDownload />
            </button>
        </div>
    );
}
