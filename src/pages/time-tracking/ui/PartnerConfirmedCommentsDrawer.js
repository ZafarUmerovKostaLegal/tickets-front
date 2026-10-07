import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { localeTag } from '@shared/i18n/ticketUi';
function fmtCommentWhen(iso, locale) {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()))
            return iso;
        return d.toLocaleString(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' });
    }
    catch {
        return iso;
    }
}
function userLabel(map, id) {
    return map.get(id) ?? `ID ${id}`;
}
export function partnerConfirmedCommentsCountLabel(count, locale, labels) {
    if (count <= 0)
        return labels.zero;
    if (locale === 'ru') {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11)
            return labels.one.replace('{count}', String(count));
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            return labels.few.replace('{count}', String(count));
        return labels.many.replace('{count}', String(count));
    }
    return count === 1
        ? labels.one.replace('{count}', String(count))
        : labels.many.replace('{count}', String(count));
}
const IcoComment = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }));
export function PartnerConfirmedCommentsCell({ count, preview, countLabel, openLabel, emptyLabel, onOpen, compact, }) {
    const hasComments = count > 0;
    const tip = hasComments && preview
        ? `${countLabel}: ${preview}`
        : openLabel;
    if (compact) {
        return (_jsxs("button", { type: "button", className: `tt-partner-confirmed__comments-btn tt-partner-confirmed__comments-btn--compact${hasComments ? ' tt-partner-confirmed__comments-btn--has' : ''}`, onClick: onOpen, "aria-label": openLabel, title: tip, children: [_jsx("span", { className: "tt-partner-confirmed__comments-btn-icon", "aria-hidden": true, children: _jsx(IcoComment, {}) }), _jsx("span", { className: "tt-partner-confirmed__comments-btn-count", children: hasComments ? countLabel : emptyLabel })] }));
    }
    return (_jsxs("button", { type: "button", className: "tt-partner-confirmed__comments-btn", onClick: onOpen, "aria-label": openLabel, title: openLabel, children: [_jsx("span", { className: "tt-partner-confirmed__comments-btn-icon", "aria-hidden": true, children: _jsx(IcoComment, {}) }), _jsxs("span", { className: "tt-partner-confirmed__comments-btn-body", children: [_jsx("span", { className: "tt-partner-confirmed__comments-btn-count", children: hasComments ? countLabel : emptyLabel }), preview ? _jsx("span", { className: "tt-partner-confirmed__comments-btn-preview", children: preview }) : null] })] }));
}
export function PartnerConfirmedCommentsDrawer({ open, row, projectLabel, clientLabel, periodLabel, comments, usersById, locale, draft, onDraftChange, onAdd, onEdit, onClose, labels, currentUserId, loading, submitting, error, allowCompose: allowComposeProp, canModerateComments, }) {
    const uid = useId();
    const isSubmitting = Boolean(submitting);
    const isLoading = Boolean(loading);
    const status = String(row?.status || '').trim().toLowerCase();
    const canComposeByStatus = status === 'fully_confirmed' || status === 'pending_partners';
    const allowCompose = allowComposeProp ?? canComposeByStatus;
    const [editingId, setEditingId] = useState(null);
    const [editDraft, setEditDraft] = useState('');
    useEffect(() => {
        if (!open) {
            setEditingId(null);
            setEditDraft('');
        }
    }, [open, row?.id]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key !== 'Escape')
                return;
            if (editingId) {
                e.preventDefault();
                setEditingId(null);
                setEditDraft('');
                return;
            }
            onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose, editingId]);
    const canSubmit = draft.trim().length > 0
        && currentUserId != null
        && !isSubmitting
        && !isLoading
        && allowCompose
        && !editingId;
    if (!open || !row || typeof document === 'undefined')
        return null;
    const disabledPartial = !allowCompose ? labels.composeDisabledPartial : undefined;
    const submitIfAllowed = () => {
        if (!canSubmit)
            return;
        void onAdd();
    };
    const startEdit = (comment) => {
        setEditingId(comment.id);
        setEditDraft(comment.text);
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditDraft('');
    };
    const saveEdit = () => {
        const text = editDraft.trim();
        if (!editingId || !text || !onEdit || isSubmitting)
            return;
        void Promise.resolve(onEdit(editingId, text)).then((ok) => {
            if (ok === false)
                return;
            setEditingId(null);
            setEditDraft('');
        }).catch(() => undefined);
    };
    const content = (_jsx("div", { className: "tt-partner-confirmed__comments-drawer-ov", role: "presentation", onClick: onClose, children: _jsxs("aside", { className: "tt-partner-confirmed__comments-drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, onClick: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "tt-partner-confirmed__comments-drawer-head", children: [_jsxs("div", { className: "tt-partner-confirmed__comments-drawer-head-text", children: [_jsx("h3", { id: `${uid}-title`, className: "tt-partner-confirmed__comments-drawer-title", children: labels.title }), _jsx("p", { className: "tt-partner-confirmed__comments-drawer-sub", children: projectLabel }), _jsxs("p", { className: "tt-partner-confirmed__comments-drawer-meta", children: [_jsx("span", { children: clientLabel }), _jsx("span", { className: "tt-partner-confirmed__comments-drawer-meta-sep", "aria-hidden": true, children: "\u00B7" }), _jsx("span", { children: periodLabel })] })] }), _jsx("button", { type: "button", className: "tt-partner-confirmed__comments-drawer-close", onClick: onClose, "aria-label": labels.close, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "tt-partner-confirmed__comments-drawer-body", children: [error ? (_jsx("p", { className: "tt-reports__table-err tt-partner-confirmed__err", role: "alert", children: error })) : null, isLoading ? (_jsx("p", { className: "tt-partner-confirmed__comments-drawer-empty", children: labels.loading ?? labels.empty })) : null, !isLoading && comments.length === 0 ? (_jsx("p", { className: "tt-partner-confirmed__comments-drawer-empty", children: labels.empty })) : null, !isLoading && comments.length > 0 ? (_jsx("ul", { className: "tt-partner-confirmed__comments-thread", children: comments.map((comment) => {
                                const isYou = currentUserId != null && comment.authUserId === currentUserId;
                                const canEdit = Boolean(onEdit)
                                    && allowCompose
                                    && (isYou || Boolean(canModerateComments));
                                const isEditing = editingId === comment.id;
                                const editedAt = comment.updatedAt?.trim();
                                return (_jsxs("li", { className: "tt-partner-confirmed__comments-item", children: [_jsxs("div", { className: "tt-partner-confirmed__comments-item-head", children: [_jsxs("span", { className: "tt-partner-confirmed__comments-item-author", children: [userLabel(usersById, comment.authUserId), isYou ? _jsx("span", { className: "tt-partner-confirmed__comments-item-you", children: labels.you }) : null] }), _jsxs("span", { className: "tt-partner-confirmed__comments-item-meta", children: [_jsx("time", { className: "tt-partner-confirmed__comments-item-when", dateTime: editedAt || comment.createdAt, children: fmtCommentWhen(editedAt || comment.createdAt, locale) }), editedAt && labels.edited ? _jsx("span", { className: "tt-partner-confirmed__comments-item-edited", children: labels.edited }) : null] })] }), isEditing ? (_jsxs("div", { className: "tt-partner-confirmed__comments-item-edit", children: [_jsx("textarea", { className: "tt-partner-confirmed__comments-compose tt-partner-confirmed__comments-compose--inline", rows: 3, value: editDraft, onChange: (e) => setEditDraft(e.target.value), onKeyDown: (e) => {
                                                        if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            cancelEdit();
                                                            return;
                                                        }
                                                        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing)
                                                            return;
                                                        e.preventDefault();
                                                        saveEdit();
                                                    }, disabled: isSubmitting, autoFocus: true }), _jsxs("div", { className: "tt-partner-confirmed__comments-item-edit-actions", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: cancelEdit, disabled: isSubmitting, children: labels.cancel ?? labels.close }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", onClick: saveEdit, disabled: isSubmitting || !editDraft.trim(), children: labels.save ?? labels.add })] })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "tt-partner-confirmed__comments-item-text", children: comment.text }), canEdit ? (_jsx("button", { type: "button", className: "tt-partner-confirmed__comments-item-edit-btn", onClick: () => startEdit(comment), disabled: isSubmitting || Boolean(editingId), children: labels.edit ?? 'Edit' })) : null] }))] }, comment.id));
                            }) })) : null] }), _jsxs("footer", { className: "tt-partner-confirmed__comments-drawer-foot", children: [disabledPartial ? (_jsx("p", { className: "tt-partner-confirmed__comments-drawer-hint", children: disabledPartial })) : null, _jsx("label", { className: "tt-partner-confirmed__comments-compose-label", htmlFor: `${uid}-compose`, children: labels.composePlaceholder }), _jsx("textarea", { id: `${uid}-compose`, className: "tt-partner-confirmed__comments-compose", rows: 3, value: draft, onChange: (e) => onDraftChange(e.target.value), onKeyDown: (e) => {
                                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing)
                                    return;
                                e.preventDefault();
                                submitIfAllowed();
                            }, placeholder: labels.composePlaceholder, spellCheck: true, disabled: currentUserId == null || isSubmitting || !allowCompose || Boolean(editingId) }), _jsxs("div", { className: "tt-partner-confirmed__comments-drawer-actions", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: onClose, children: labels.close }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", disabled: !canSubmit, onClick: submitIfAllowed, children: labels.add })] })] })] }) }));
    return createPortal(content, document.body);
}
