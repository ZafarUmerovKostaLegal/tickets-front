import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
export function FileGuardFilePreview({ preview, downloadError, onClose, onDownload }) {
    useEffect(() => {
        if (!preview)
            return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [preview, onClose]);
    if (!preview)
        return null;
    const { fileName, loading, error, model } = preview;
    return createPortal(_jsx("div", { className: "its-preview", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "its-preview__dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "its-preview-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "its-preview__head", children: [_jsx("h2", { id: "its-preview-title", className: "its-preview__title", children: fileName }), _jsx("button", { type: "button", className: "its-preview__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440", children: "\u00D7" })] }), _jsxs("div", { className: "its-preview__body", children: [loading ? _jsx("p", { className: "its-preview__note", children: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u043C \u0444\u0430\u0439\u043B\u2026" }) : null, !loading && error ? _jsx("p", { className: "its-j__bad", role: "alert", children: error }) : null, !loading && !error && model?.type === 'image' ? (_jsx("img", { src: model.objectUrl, alt: "", className: "its-preview__image" })) : null, !loading && !error && model?.type === 'pdf' ? (_jsx("iframe", { title: fileName, src: model.objectUrl, className: "its-preview__frame" })) : null, !loading && !error && model?.type === 'video' ? (_jsx("video", { src: model.objectUrl, className: "its-preview__media", controls: true })) : null, !loading && !error && model?.type === 'audio' ? (_jsx("audio", { src: model.objectUrl, className: "its-preview__audio", controls: true })) : null, !loading && !error && model?.type === 'text' ? (_jsx("pre", { className: "its-preview__text", children: model.text })) : null, !loading && !error && model?.type === 'sheets' ? (_jsxs("div", { className: "its-preview__sheets", children: [model.truncatedNote ? _jsx("p", { className: "its-preview__note", children: model.truncatedNote }) : null, model.sheets.map((sheet) => (_jsxs("div", { children: [_jsx("p", { className: "its-preview__sheet", children: sheet.name }), _jsx("div", { className: "its-preview__table-wrap", children: _jsx("table", { children: _jsx("tbody", { children: sheet.rows.map((row, rowIndex) => (_jsx("tr", { children: row.map((cell, cellIndex) => _jsx("td", { children: cell }, cellIndex)) }, rowIndex))) }) }) })] }, sheet.name)))] })) : null, !loading && !error && model?.type === 'unsupported' ? (_jsx("p", { className: "its-preview__note", children: model.hint })) : null] }), _jsxs("div", { className: "its-preview__foot", children: [downloadError ? _jsx("span", { className: "its-j__bad", children: downloadError }) : null, _jsx("button", { type: "button", className: "its-j__btn", onClick: onDownload, disabled: loading, children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u0430\u0439\u043B" }), _jsx("button", { type: "button", className: "its-j__btn its-j__btn--accent", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })] })] }) }), document.body);
}
