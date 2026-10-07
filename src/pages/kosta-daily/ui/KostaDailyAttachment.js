import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { fetchChatAttachmentBlob } from '@entities/chat';
function formatSize(bytes) {
    if (!bytes || bytes < 0)
        return '';
    if (bytes < 1024)
        return `${bytes} Б`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
function IconFile() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("path", { d: "M14 2v6h6" })] }));
}
function IconDownload() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
}
export function KostaDailyAttachment({ attachment, onPreview }) {
    const [url, setUrl] = useState(null);
    const [error, setError] = useState(false);
    const isImage = attachment.content_type.startsWith('image/');
    useEffect(() => {
        let cancelled = false;
        let objectUrl = null;
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
        return (_jsx("button", { type: "button", className: "kd-tg__attach-image", onClick: () => {
                if (!url)
                    return;
                if (onPreview)
                    onPreview(url, attachment.file_name);
                else
                    window.open(url, '_blank', 'noopener');
            }, title: attachment.file_name, children: url ? (_jsx("img", { src: url, alt: attachment.file_name, loading: "lazy", decoding: "async" })) : (_jsx("span", { className: "kd-tg__attach-image-loading", "aria-hidden": true })) }));
    }
    return (_jsxs("div", { className: "kd-tg__attach-file", children: [_jsx("span", { className: "kd-tg__attach-file-icon", "aria-hidden": true, children: _jsx(IconFile, {}) }), _jsxs("span", { className: "kd-tg__attach-file-info", children: [_jsx("span", { className: "kd-tg__attach-file-name", children: attachment.file_name }), _jsx("span", { className: "kd-tg__attach-file-size", children: error ? 'Не удалось загрузить' : formatSize(attachment.size_bytes) })] }), _jsx("button", { type: "button", className: "kd-tg__attach-file-download", onClick: download, disabled: !url, "aria-label": "\u0421\u043A\u0430\u0447\u0430\u0442\u044C", title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C", children: _jsx(IconDownload, {}) })] }));
}
