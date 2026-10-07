import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CORR_SCAN_ACCEPT, CORR_SCAN_MAX_BYTES } from '../model/constants';
import { isAllowedScanFile } from '@entities/correspondence';
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} Б`;
    if (bytes < 1024 * 1024)
        return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
function detectFileKind(file) {
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
function FileKindIcon({ kind }) {
    if (kind === 'image') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), _jsx("circle", { cx: "8.5", cy: "8.5", r: "1.5" }), _jsx("path", { d: "m21 15-5-5L5 21" })] }));
    }
    if (kind === 'pdf') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("path", { d: "M9 13h6M9 17h4" })] }));
    }
    if (kind === 'doc') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "8", y1: "13", x2: "16", y2: "13" }), _jsx("line", { x1: "8", y1: "17", x2: "14", y2: "17" })] }));
    }
    if (kind === 'sheet') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), _jsx("path", { d: "M3 9h18M3 15h18M9 3v18" })] }));
    }
    if (kind === 'archive') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("path", { d: "M21 8v13H3V8" }), _jsx("path", { d: "M1 3h22v5H1z" }), _jsx("path", { d: "M10 12h4" })] }));
    }
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", "aria-hidden": true, children: [_jsx("path", { d: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" }), _jsx("polyline", { points: "13 2 13 9 20 9" })] }));
}
function buildDriveItems(files) {
    return files.map((file, index) => ({
        file,
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        kind: detectFileKind(file),
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
}
export function CorrespondenceFileDrivePicker({ files, onChange, disabled = false, error, hint, onHint, accept = CORR_SCAN_ACCEPT, maxBytes = CORR_SCAN_MAX_BYTES, label = 'Файлы', required = false, compact = false, }) {
    const inputId = useId();
    const fileInputRef = useRef(null);
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
    const appendFiles = useCallback((incoming) => {
        if (!incoming?.length || disabled)
            return;
        const added = [];
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
    const removeFile = (index) => {
        if (disabled)
            return;
        onChange(files.filter((_, i) => i !== index));
        onHint?.(null);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled)
            return;
        appendFiles(e.dataTransfer.files);
    };
    return (_jsxs("div", { className: `corr-drive${error ? ' corr-drive--err' : ''}${compact ? ' corr-drive--compact' : ''}`, children: [_jsxs("div", { className: "corr-drive__head", children: [_jsxs("span", { className: "corr-drive__label", children: [label, required ? _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: " *" }) : null] }), files.length > 0 ? (_jsxs("span", { className: "corr-drive__count", children: [files.length, " ", files.length === 1 ? 'файл' : files.length < 5 ? 'файла' : 'файлов'] })) : null] }), _jsxs("div", { className: `corr-drive__zone-wrap${dragging ? ' corr-drive__zone-wrap--drag' : ''}`, onDragEnter: (e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    setDragging(true);
                }, onDragOver: (e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    setDragging(true);
                }, onDragLeave: (e) => {
                    if (!e.currentTarget.contains(e.relatedTarget))
                        setDragging(false);
                }, onDrop: handleDrop, children: [files.length === 0 ? (_jsxs("label", { htmlFor: inputId, className: `corr-drive__empty${disabled ? ' corr-drive__empty--disabled' : ''}`, children: [_jsx("span", { className: "corr-drive__empty-icon", "aria-hidden": true, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "17 8 12 3 7 8" }), _jsx("line", { x1: "12", y1: "3", x2: "12", y2: "15" })] }) }), _jsxs("span", { className: "corr-drive__empty-copy", children: [_jsx("span", { className: "corr-drive__empty-title", children: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u044E\u0434\u0430" }), _jsxs("span", { className: "corr-drive__empty-sub", children: ["\u0438\u043B\u0438 ", _jsx("span", { className: "corr-drive__empty-link", children: "\u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0430 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0435" })] })] }), _jsxs("span", { className: "corr-drive__empty-hint", children: ["\u041B\u044E\u0431\u043E\u0439 \u0444\u043E\u0440\u043C\u0430\u0442, \u0434\u043E ", formatBytes(maxBytes), " \u043D\u0430 \u0444\u0430\u0439\u043B"] })] })) : (_jsxs("div", { className: "corr-drive__grid", role: "list", children: [items.map((item, index) => (_jsxs("article", { className: "corr-drive__tile", role: "listitem", children: [_jsx("div", { className: `corr-drive__tile-preview corr-drive__tile-preview--${item.kind}`, children: item.previewUrl
                                            ? _jsx("img", { src: item.previewUrl, alt: "", className: "corr-drive__tile-img" })
                                            : _jsx(FileKindIcon, { kind: item.kind }) }), _jsxs("div", { className: "corr-drive__tile-body", children: [_jsx("span", { className: "corr-drive__tile-name", title: item.file.name, children: item.file.name }), _jsx("span", { className: "corr-drive__tile-size", children: formatBytes(item.file.size) })] }), _jsx("button", { type: "button", className: "corr-drive__tile-remove", onClick: () => removeFile(index), disabled: disabled, "aria-label": `Удалить ${item.file.name}`, children: _jsxs("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }, item.key))), _jsxs("label", { htmlFor: inputId, className: `corr-drive__tile corr-drive__tile--add${disabled ? ' corr-drive__tile--disabled' : ''}`, role: "listitem", children: [_jsx("span", { className: "corr-drive__add-icon", "aria-hidden": true, children: "+" }), _jsx("span", { className: "corr-drive__add-label", children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" })] })] })), dragging ? (_jsx("div", { className: "corr-drive__drop-overlay", "aria-hidden": true, children: _jsx("span", { children: "\u041E\u0442\u043F\u0443\u0441\u0442\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C" }) })) : null] }), _jsx("input", { id: inputId, ref: fileInputRef, type: "file", accept: accept, multiple: true, className: "corr-drive__input", disabled: disabled, onChange: (e) => {
                    appendFiles(e.target.files);
                    e.target.value = '';
                } }), hint ? _jsx("p", { className: "corr-modal__hint corr-modal__hint--warn", children: hint }) : null, error ? _jsx("p", { className: "corr-modal__err", children: error }) : null] }));
}
