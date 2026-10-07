import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchVacationManualEntryDocumentBlob } from '@entities/vacation';
import './VacationDocLightbox.css';
function extOf(name) {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}
function previewKind(filename, contentType) {
    const ext = extOf(filename);
    const ct = (contentType ?? '').toLowerCase();
    if (ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'].includes(ext))
        return 'image';
    if (ct === 'application/pdf' || ext === 'pdf')
        return 'pdf';
    if (ct.startsWith('text/') || ext === 'txt')
        return 'text';
    return 'none';
}
export function VacationDocLightbox({ entryId, docId, filename, contentType, onClose }) {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const blobRef = useRef(null);
    const kind = useMemo(() => previewKind(filename, contentType), [filename, contentType]);
    useEffect(() => {
        let cancelled = false;
        let objectUrl = null;
        setLoading(true);
        setError(null);
        setUrl(null);
        void fetchVacationManualEntryDocumentBlob(entryId, docId)
            .then((blob) => {
            if (cancelled)
                return;
            blobRef.current = blob;
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
        })
            .catch((e) => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : 'Не удалось загрузить документ');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [entryId, docId]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [onClose]);
    const handleDownload = () => {
        if (!url)
            return;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    return createPortal(_jsx("div", { className: "vac-doc-lb", role: "dialog", "aria-modal": "true", "aria-label": `Документ ${filename}`, onClick: (e) => { e.stopPropagation(); onClose(); }, children: _jsxs("div", { className: "vac-doc-lb__frame", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "vac-doc-lb__head", children: [_jsx("span", { className: "vac-doc-lb__title", title: filename, children: filename }), _jsxs("div", { className: "vac-doc-lb__actions", children: [_jsxs("button", { type: "button", className: "vac-doc-lb__btn", onClick: handleDownload, disabled: !url, title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }), "\u0421\u043A\u0430\u0447\u0430\u0442\u044C"] }), _jsx("button", { type: "button", className: "vac-doc-lb__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] })] }), _jsxs("div", { className: "vac-doc-lb__body", children: [loading && _jsx("div", { className: "vac-doc-lb__msg", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }), error && _jsx("div", { className: "vac-doc-lb__msg vac-doc-lb__msg--err", children: error }), !loading && !error && url && (kind === 'image' ? (_jsx("img", { className: "vac-doc-lb__img", src: url, alt: filename })) : kind === 'pdf' || kind === 'text' ? (_jsx("iframe", { className: "vac-doc-lb__iframe", src: url, title: filename })) : (_jsxs("div", { className: "vac-doc-lb__msg", children: ["\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0442\u0438\u043F\u0430 \u0444\u0430\u0439\u043B\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.", _jsx("br", {}), "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043A\u043D\u043E\u043F\u043A\u0443 \u00AB\u0421\u043A\u0430\u0447\u0430\u0442\u044C\u00BB, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442."] })))] })] }) }), document.body);
}
