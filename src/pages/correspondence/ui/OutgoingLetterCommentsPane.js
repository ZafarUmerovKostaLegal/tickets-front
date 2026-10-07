import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
function formatCommentWhen(iso) {
    try {
        return new Date(iso).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return iso;
    }
}
function authorInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
export function OutgoingLetterCommentsPane({ open, comments, disabled, activeId, draftQuote, onClose, onNewComment, onSelect, onChangeBody, onToggleResolved, onDelete, onCommitNew, onCancelNew, composing, }) {
    const titleId = useId();
    const composeRef = useRef(null);
    const [composeBody, setComposeBody] = useState('');
    const openCount = comments.filter((c) => !c.resolved).length;
    useEffect(() => {
        if (!composing)
            return;
        setComposeBody('');
        const t = window.setTimeout(() => composeRef.current?.focus(), 40);
        return () => window.clearTimeout(t);
    }, [composing, draftQuote]);
    if (!open)
        return null;
    return (_jsxs("aside", { className: "corr-word-comments", "aria-labelledby": titleId, "data-word-comments": true, children: [_jsxs("header", { className: "corr-word-comments__header", children: [_jsxs("div", { className: "corr-word-comments__title-row", children: [_jsx("h2", { id: titleId, className: "corr-word-comments__title", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438" }), openCount > 0 ? (_jsx("span", { className: "corr-word-comments__badge", "aria-label": `Открытых: ${openCount}`, children: openCount })) : null] }), _jsxs("div", { className: "corr-word-comments__header-actions", children: [_jsx("button", { type: "button", className: "corr-word-comments__icon-btn", onClick: onNewComment, disabled: disabled || composing, title: "\u041D\u043E\u0432\u044B\u0439 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 (Ctrl+Alt+M)", "aria-label": "\u041D\u043E\u0432\u044B\u0439 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "14" }), _jsx("line", { x1: "9", y1: "11", x2: "15", y2: "11" })] }) }), _jsx("button", { type: "button", className: "corr-word-comments__icon-btn", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432", title: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] })] }), _jsx("p", { className: "corr-word-comments__hint", children: "\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u0432 \u043F\u0438\u0441\u044C\u043C\u0435 \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB+\u00BB, \u043B\u0438\u0431\u043E Ctrl+Alt+M \u2014 \u043A\u0430\u043A \u0432 Word." }), _jsxs("div", { className: "corr-word-comments__list", children: [composing ? (_jsxs("article", { className: "corr-word-comments__card corr-word-comments__card--compose", children: [draftQuote ? (_jsx("blockquote", { className: "corr-word-comments__quote", children: draftQuote })) : (_jsx("p", { className: "corr-word-comments__quote-empty", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0443" })), _jsx("textarea", { ref: composeRef, className: "corr-word-comments__input", rows: 3, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439\u2026", value: composeBody, disabled: disabled, onChange: (e) => setComposeBody(e.target.value), onKeyDown: (e) => {
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        onCancelNew();
                                        return;
                                    }
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        const body = composeBody.trim();
                                        if (body)
                                            onCommitNew(body);
                                    }
                                } }), _jsxs("div", { className: "corr-word-comments__compose-actions", children: [_jsx("button", { type: "button", className: "corr__btn corr__btn--outline", disabled: disabled, onClick: onCancelNew, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "corr__btn corr__btn--primary", disabled: disabled || !composeBody.trim(), onClick: () => onCommitNew(composeBody.trim()), children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" })] })] })) : null, comments.length === 0 && !composing ? (_jsx("div", { className: "corr-word-comments__empty", role: "status", children: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432." })) : null, comments.map((c) => {
                        const active = c.id === activeId;
                        return (_jsxs("article", { className: [
                                'corr-word-comments__card',
                                active ? 'corr-word-comments__card--active' : '',
                                c.resolved ? 'corr-word-comments__card--resolved' : '',
                            ].filter(Boolean).join(' '), onClick: () => onSelect(c.id), children: [_jsxs("div", { className: "corr-word-comments__meta", children: [_jsx("span", { className: "corr-word-comments__avatar", "aria-hidden": true, children: authorInitials(c.authorName) }), _jsxs("div", { className: "corr-word-comments__meta-text", children: [_jsx("span", { className: "corr-word-comments__author", children: c.authorName }), _jsx("time", { className: "corr-word-comments__when", dateTime: c.createdAt, children: formatCommentWhen(c.createdAt) })] })] }), c.quote ? (_jsx("blockquote", { className: "corr-word-comments__quote", children: c.quote })) : null, _jsx("textarea", { className: "corr-word-comments__input", rows: 2, value: c.body, disabled: disabled || c.resolved, onClick: (e) => e.stopPropagation(), onChange: (e) => onChangeBody(c.id, e.target.value), "aria-label": `Комментарий от ${c.authorName}` }), _jsxs("div", { className: "corr-word-comments__card-actions", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", className: "corr-word-comments__link-btn", disabled: disabled, onClick: () => onToggleResolved(c.id), children: c.resolved ? 'Открыть снова' : 'Пометить решённым' }), _jsx("button", { type: "button", className: "corr-word-comments__link-btn corr-word-comments__link-btn--danger", disabled: disabled, onClick: () => onDelete(c.id), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }, c.id));
                    })] })] }));
}
