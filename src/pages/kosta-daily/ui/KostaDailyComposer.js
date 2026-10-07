import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
import { encodeChatGif, encodeChatSticker } from '@entities/chat';
import { KostaDailyComposerPicker } from './KostaDailyComposerPicker';
function IconPaperclip() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }) }));
}
function IconSmile() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }), _jsx("line", { x1: "9", y1: "9", x2: "9.01", y2: "9" }), _jsx("line", { x1: "15", y1: "9", x2: "15.01", y2: "9" })] }));
}
function IconAttach() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }) }));
}
function IconSend() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M5 12h14" }), _jsx("path", { d: "M13 6l6 6-6 6" })] }));
}
function IconChecklist() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M9 11l2 2 4-4" }), _jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }), _jsx("path", { d: "M8 17h8" })] }));
}
function IconPoll() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, children: _jsx("path", { d: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" }) }));
}
export function KostaDailyComposer({ draft, onDraftChange, onSend, onSendBody, onAttachFile, sending, disabled, sendError, pickerOpen, pickerTab, onPickerOpenChange, onPickerTabChange, replyTo, onCancelReply, onCreatePoll, onCreateChecklist, }) {
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || disabled || sending)
            return;
        onAttachFile(file);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };
    const insertEmoji = (emoji) => {
        onDraftChange(draft + emoji);
        inputRef.current?.focus();
    };
    const sendSticker = (stickerId) => {
        if (disabled || sending)
            return;
        void onSendBody(encodeChatSticker(stickerId));
    };
    const sendGif = (url) => {
        if (disabled || sending)
            return;
        void onSendBody(encodeChatGif(url));
    };
    const togglePicker = (tab) => {
        if (disabled)
            return;
        if (pickerOpen && pickerTab === tab) {
            onPickerOpenChange(false);
            return;
        }
        onPickerTabChange(tab);
        onPickerOpenChange(true);
    };
    const canSend = !disabled && !sending && draft.trim().length > 0;
    return (_jsxs("footer", { className: "kd-tg__composer", children: [_jsx(KostaDailyComposerPicker, { open: pickerOpen, tab: pickerTab, onTabChange: onPickerTabChange, onPickEmoji: insertEmoji, onPickSticker: sendSticker, onPickGif: sendGif, disabled: disabled || sending }), sendError ? (_jsx("p", { className: "kd-tg__composer-error", role: "alert", children: sendError })) : null, replyTo ? (_jsxs("div", { className: "kd-tg__composer-preview", role: "status", children: [_jsx("span", { className: "kd-tg__composer-preview-badge", children: "\u041E\u0442\u0432\u0435\u0442" }), _jsxs("span", { className: "kd-tg__composer-preview-body", children: [_jsx("strong", { className: "kd-tg__composer-preview-author", children: replyTo.authorName }), _jsx("span", { className: "kd-tg__composer-preview-text", children: replyTo.preview })] }), onCancelReply ? (_jsx("button", { type: "button", className: "kd-tg__composer-preview-close", "aria-label": "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u0442\u0432\u0435\u0442", title: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C", onClick: onCancelReply, children: "\u00D7" })) : null] })) : null, _jsxs("div", { className: "kd-tg__composer-bar", children: [_jsx("button", { type: "button", className: `kd-tg__composer-btn${pickerOpen && pickerTab === 'emoji' ? ' kd-tg__composer-btn--active' : ''}`, title: "\u0421\u043C\u0430\u0439\u043B\u0438\u043A\u0438", "aria-label": "\u0421\u043C\u0430\u0439\u043B\u0438\u043A\u0438", "aria-expanded": pickerOpen && pickerTab === 'emoji', disabled: disabled, onClick: () => togglePicker('emoji'), children: _jsx(IconSmile, {}) }), _jsx("input", { ref: fileInputRef, type: "file", className: "kd-tg__composer-file-input", onChange: handleFileChange, disabled: disabled || sending, hidden: true }), _jsx("button", { type: "button", className: "kd-tg__composer-btn", title: "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0444\u0430\u0439\u043B", "aria-label": "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0444\u0430\u0439\u043B", disabled: disabled || sending, onClick: () => fileInputRef.current?.click(), children: _jsx(IconPaperclip, {}) }), onCreatePoll ? (_jsx("button", { type: "button", className: "kd-tg__composer-btn", title: "\u041E\u043F\u0440\u043E\u0441 \u0438\u043B\u0438 \u0432\u0438\u043A\u0442\u043E\u0440\u0438\u043D\u0430", "aria-label": "\u041E\u043F\u0440\u043E\u0441 \u0438\u043B\u0438 \u0432\u0438\u043A\u0442\u043E\u0440\u0438\u043D\u0430", disabled: disabled || sending, onClick: onCreatePoll, children: _jsx(IconPoll, {}) })) : null, onCreateChecklist ? (_jsx("button", { type: "button", className: "kd-tg__composer-btn", title: "\u0427\u0435\u043A\u043B\u0438\u0441\u0442", "aria-label": "\u0427\u0435\u043A\u043B\u0438\u0441\u0442", disabled: disabled || sending, onClick: onCreateChecklist, children: _jsx(IconChecklist, {}) })) : null, _jsxs("label", { className: "kd-tg__composer-input-wrap", children: [_jsx("span", { className: "visually-hidden", children: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435" }), _jsx("textarea", { ref: inputRef, className: "kd-tg__composer-input", rows: 1, placeholder: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435", value: draft, onChange: (e) => onDraftChange(e.target.value), onKeyDown: handleKeyDown, disabled: disabled || sending }), _jsx("button", { type: "button", className: `kd-tg__composer-input-attach${pickerOpen && (pickerTab === 'sticker' || pickerTab === 'gif') ? ' kd-tg__composer-input-attach--active' : ''}`, title: "\u0421\u0442\u0438\u043A\u0435\u0440\u044B", "aria-label": "\u0421\u0442\u0438\u043A\u0435\u0440\u044B", disabled: disabled, onClick: () => togglePicker('sticker'), children: _jsx(IconAttach, {}) })] }), _jsx("button", { type: "button", className: "kd-tg__composer-send", disabled: !canSend, "aria-label": "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C", onClick: onSend, children: _jsx(IconSend, {}) })] })] }));
}
