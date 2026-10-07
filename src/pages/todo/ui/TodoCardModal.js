import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronDown, IconClose, IconComment, IconMore, IconPaperclip, IconPlus, IconTag, IconCalendar, IconChecklist, IconUsers, } from './TodoIcons';
import { createAuthenticatedMediaBlobUrl } from '@shared/api';
import { createTodoBoardLabel, createTodoChecklistItem, deleteTodoCardAttachment, deleteTodoChecklistItem, patchTodoCard, patchTodoChecklistItem, postTodoCardComment, uploadTodoCardAttachment, } from '@entities/todo';
import { apiCardToTodoCard } from '@entities/todo/lib/boardMapper';
import { LABEL_COLORS } from '@entities/todo/lib/todoUtils';
import { todoInitialFromDisplayLabel, todoParticipantLabel, todoUserPickInitial, todoUserPickLabel, } from '@entities/todo/lib/todoUserDisplay';
import { formatTodoAddMember, formatTodoUploading, todoLocaleTag, todoMonthName, todoWeekdayLabels, useI18n } from '@shared/i18n';
export const TodoCardModal = memo(function TodoCardModal({ boardId, card, columnTitle, columnId, columns, boardLabels, todoBoardUsers, cardServerId, applyTodoBoard, onMoveToColumn, onClose, onCardUpdate, onArchive, boardReadOnly = false, }) {
    const { t, locale } = useI18n();
    const dateLocale = todoLocaleTag(locale);
    const titleId = useId();
    const readOnly = !!card.fromCalendar || boardReadOnly;
    const apiOk = !readOnly && Number.isFinite(cardServerId) && cardServerId > 0 && Number.isFinite(boardId) && boardId > 0;
    const [descFocused, setDescFocused] = useState(false);
    const [descDraft, setDescDraft] = useState(card.description ?? '');
    const [titleEditing, setTitleEditing] = useState(false);
    const [titleValue, setTitleValue] = useState(card.title);
    const [commentText, setCommentText] = useState('');
    const [activePanel, setActivePanel] = useState(null);
    const [columnMenuOpen, setColumnMenuOpen] = useState(false);
    const [attachError, setAttachError] = useState(null);
    const [attachBusy, setAttachBusy] = useState(false);
    const [attachBusyHint, setAttachBusyHint] = useState(null);
    const [attachDragging, setAttachDragging] = useState(false);
    const uploadAbortRef = useRef(null);
    const fileInputRef = useRef(null);
    const columnMenuRef = useRef(null);
    const panelRef = useRef(null);
    const toolbarRef = useRef(null);
    const titleInputRef = useRef(null);
    const [panelStyle, setPanelStyle] = useState({});
    useEffect(() => {
        return () => {
            uploadAbortRef.current?.abort();
        };
    }, []);
    useEffect(() => {
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = null;
        setAttachBusy(false);
        setAttachBusyHint(null);
        setAttachDragging(false);
        setTitleEditing(false);
        setColumnMenuOpen(false);
        setAttachError(null);
    }, [card.id]);
    useEffect(() => {
        setTitleValue(card.title);
        setDescDraft(card.description ?? '');
    }, [card.id, card.title, card.description]);
    useEffect(() => {
        if (!columnMenuOpen)
            return;
        const onDoc = (e) => {
            if (columnMenuRef.current && !columnMenuRef.current.contains(e.target)) {
                setColumnMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [columnMenuOpen]);
    const togglePanel = useCallback((p) => {
        setActivePanel((prev) => (prev === p ? null : p));
    }, []);
    const commitTitle = useCallback(() => {
        if (readOnly) {
            setTitleEditing(false);
            return;
        }
        const trimmed = titleValue.trim();
        if (trimmed && trimmed !== card.title)
            onCardUpdate({ title: trimmed });
        else
            setTitleValue(card.title);
        setTitleEditing(false);
    }, [titleValue, card.title, onCardUpdate, readOnly]);
    const commitDescription = useCallback(() => {
        if (readOnly)
            return;
        const next = descDraft;
        if (next !== (card.description ?? ''))
            onCardUpdate({ description: next });
    }, [descDraft, card.description, onCardUpdate, readOnly]);
    const openFilePicker = useCallback(() => {
        if (readOnly || attachBusy || !apiOk)
            return;
        setAttachError(null);
        fileInputRef.current?.click();
    }, [readOnly, attachBusy, apiOk]);
    const syncAttachmentsFromBoard = useCallback((board) => {
        for (const col of board.columns) {
            const apiCard = col.cards.find((c) => c.id === cardServerId);
            if (!apiCard)
                continue;
            const mapped = apiCardToTodoCard(apiCard);
            onCardUpdate({ attachments: mapped.attachments ?? [] });
            return;
        }
    }, [cardServerId, onCardUpdate]);
    const uploadFilesList = useCallback(async (files) => {
        if (!files.length || readOnly || !apiOk)
            return;
        setAttachError(null);
        const ac = new AbortController();
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = ac;
        setAttachBusy(true);
        try {
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                if (ac.signal.aborted)
                    break;
                if (file.size > 15 * 1024 * 1024) {
                    setAttachError(t('todoPage.errors.fileTooLarge'));
                    continue;
                }
                setAttachBusyHint(files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name);
                try {
                    const applied = await applyTodoBoard(uploadTodoCardAttachment(boardId, cardServerId, file, { signal: ac.signal }));
                    if (!applied) {
                        setAttachError(t('todoPage.errors.updateBoard'));
                    }
                    else {
                        setAttachError(null);
                        syncAttachmentsFromBoard(applied);
                    }
                }
                catch (err) {
                    if (ac.signal.aborted)
                        break;
                    setAttachError(err instanceof Error ? err.message : t('todoPage.errors.uploadFile'));
                }
            }
        }
        finally {
            if (uploadAbortRef.current === ac)
                uploadAbortRef.current = null;
            setAttachBusy(false);
            setAttachBusyHint(null);
        }
    }, [readOnly, apiOk, boardId, cardServerId, applyTodoBoard, syncAttachmentsFromBoard, t]);
    const handleFiles = useCallback(async (e) => {
        const list = e.target.files;
        if (!list?.length)
            return;
        const files = Array.from(list);
        e.target.value = '';
        if (readOnly || !apiOk || attachBusy)
            return;
        await uploadFilesList(files);
    }, [readOnly, apiOk, attachBusy, uploadFilesList]);
    const handleAttachDrop = useCallback((e) => {
        e.preventDefault();
        setAttachDragging(false);
        if (readOnly || attachBusy || !apiOk)
            return;
        const dropped = e.dataTransfer.files;
        if (!dropped?.length)
            return;
        void uploadFilesList(Array.from(dropped));
    }, [readOnly, attachBusy, apiOk, uploadFilesList]);
    const removeAttachment = useCallback(async (id) => {
        if (!apiOk)
            return;
        const num = Number(id);
        if (!Number.isFinite(num))
            return;
        setAttachError(null);
        const applied = await applyTodoBoard(deleteTodoCardAttachment(boardId, cardServerId, num));
        if (applied)
            syncAttachmentsFromBoard(applied);
    }, [apiOk, boardId, cardServerId, applyTodoBoard, syncAttachmentsFromBoard]);
    const openAttachment = useCallback(async (mediaUrl) => {
        try {
            const blobUrl = await createAuthenticatedMediaBlobUrl(mediaUrl);
            window.open(blobUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        }
        catch {
            setAttachError(t('todoPage.errors.openFile'));
        }
    }, [t]);
    const sendComment = useCallback(async () => {
        const t = commentText.trim();
        if (!t || !apiOk)
            return;
        const board = await applyTodoBoard(postTodoCardComment(boardId, cardServerId, t));
        if (board)
            setCommentText('');
    }, [commentText, apiOk, boardId, cardServerId, applyTodoBoard]);
    useEffect(() => {
        if (titleEditing && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [titleEditing]);
    useLayoutEffect(() => {
        if (!activePanel || !toolbarRef.current)
            return;
        const rect = toolbarRef.current.getBoundingClientRect();
        const page = toolbarRef.current.closest('.todo-page');
        const vars = {};
        if (page) {
            const cs = getComputedStyle(page);
            const names = ['--todo-accent', '--todo-text', '--todo-muted', '--todo-surface', '--todo-surface2', '--todo-panel-bg', '--todo-border', '--todo-shadow'];
            names.forEach((n) => { vars[n] = cs.getPropertyValue(n).trim(); });
        }
        const applyPosition = () => {
            let top = rect.bottom + 6;
            let left = rect.left;
            const pad = 10;
            const panelEl = panelRef.current;
            if (panelEl) {
                const panelRect = panelEl.getBoundingClientRect();
                const w = panelRect.width;
                const h = panelRect.height;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const maxTop = Math.max(pad, vh - h - pad);
                if (top > maxTop)
                    top = maxTop;
                if (left + w > vw - pad)
                    left = Math.max(pad, vw - w - pad);
            }
            setPanelStyle({ top, left, ...vars });
        };
        applyPosition();
        const id = requestAnimationFrame(applyPosition);
        return () => cancelAnimationFrame(id);
    }, [activePanel]);
    useEffect(() => {
        if (!activePanel)
            return;
        const onClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target) &&
                toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                setActivePanel(null);
            }
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape')
                setActivePanel(null);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [activePanel]);
    return (_jsx("div", { className: "tcm-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, children: _jsxs("div", { className: "tcm", children: [_jsxs("header", { className: "tcm__header", children: [_jsx("div", { className: "tcm__header-left", children: _jsxs("div", { className: "tcm__column-wrap", ref: columnMenuRef, children: [_jsxs("button", { type: "button", className: "tcm__list-btn", "aria-haspopup": "listbox", "aria-expanded": columnMenuOpen, onClick: () => setColumnMenuOpen((v) => !v), children: [_jsx("span", { children: columnTitle }), _jsx(IconChevronDown, {})] }), columnMenuOpen && (_jsx("div", { className: "tcm__column-menu", role: "listbox", children: columns.map((col) => (_jsx("button", { type: "button", role: "option", "aria-selected": col.id === columnId, className: `tcm__column-menu-item${col.id === columnId ? ' tcm__column-menu-item--active' : ''}`, onClick: () => {
                                                setColumnMenuOpen(false);
                                                if (col.id !== columnId)
                                                    onMoveToColumn(col.id);
                                            }, children: col.title }, col.id))) }))] }) }), _jsxs("div", { className: "tcm__header-actions", children: [_jsx("button", { type: "button", className: "tcm__icon-btn", title: t('todoPage.cardModal.attachmentsAria'), "aria-label": t('todoPage.cardModal.attachmentsAria'), disabled: readOnly || !apiOk || attachBusy, onClick: openFilePicker, children: _jsx(IconPaperclip, {}) }), _jsx("button", { type: "button", className: "tcm__icon-btn", "aria-label": t('todoPage.cardModal.moreAria'), children: _jsx(IconMore, {}) }), _jsx("div", { className: "tcm__header-divider" }), _jsx("button", { type: "button", className: "tcm__icon-btn tcm__icon-btn--close", "aria-label": t('todoPage.close'), onClick: onClose, children: _jsx(IconClose, {}) })] })] }), _jsxs("div", { className: "tcm__body", children: [_jsxs("div", { className: "tcm__main", children: [_jsxs("div", { className: "tcm__title-row", children: [_jsx("button", { type: "button", className: `tcm__check${card.completed ? ' tcm__check--done' : ''}`, onClick: () => !readOnly && onCardUpdate({ completed: !card.completed }), "aria-pressed": card.completed, "aria-label": card.completed ? t('todoPage.cardModal.unmarkDone') : t('todoPage.cardModal.markDone'), children: card.completed && _jsx(IconCheck, {}) }), titleEditing ? (_jsx("textarea", { ref: titleInputRef, id: titleId, className: "tcm__title-input", value: titleValue, onChange: (e) => setTitleValue(e.target.value), onBlur: commitTitle, onKeyDown: (e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    commitTitle();
                                                }
                                                if (e.key === 'Escape') {
                                                    setTitleValue(card.title);
                                                    setTitleEditing(false);
                                                }
                                            }, rows: 2 })) : (_jsx("h2", { id: titleId, className: `tcm__title${card.completed ? ' tcm__title--done' : ''}`, onClick: () => !readOnly && setTitleEditing(true), title: readOnly ? undefined : t('todoPage.cardModal.editTitle'), children: card.title }))] }), ((card.labels?.length ?? 0) > 0 ||
                                    card.dueDate ||
                                    card.startDate ||
                                    (card.participantUserIds?.length ?? 0) > 0) && (_jsxs("div", { className: "tcm__meta-row", children: [(card.labels?.length ?? 0) > 0 && card.labels.map((l) => (_jsx("span", { className: "tcm__label-badge", style: { background: l.color }, children: l.text }, l.id))), (card.dueDate || card.startDate) && (_jsxs("span", { className: "tcm__date-chip tcm__date-chip--group", children: [_jsx(IconCalendar, {}), card.startDate && (_jsx("span", { children: new Date(card.startDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) })), card.startDate && card.dueDate && _jsx("span", { className: "tcm__date-sep", children: "\u2192" }), card.dueDate && (_jsx("span", { className: "tcm__date-chip--due-inner", children: new Date(card.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) }))] })), (card.participantUserIds?.length ?? 0) > 0 &&
                                            card.participantUserIds.map((uid) => {
                                                const label = todoParticipantLabel(todoBoardUsers.byId, uid);
                                                return (_jsxs("span", { className: "tcm__member-chip", title: label, children: [_jsx("span", { className: "tcm__member-chip-avatar", children: todoInitialFromDisplayLabel(label) }), _jsx("span", { className: "tcm__member-chip-text", children: label })] }, uid));
                                            })] })), _jsxs("div", { className: "tcm__toolbar", ref: toolbarRef, children: [_jsxs("button", { type: "button", className: `tcm__tool-btn${activePanel === 'labels' ? ' tcm__tool-btn--active' : ''}`, disabled: readOnly || !apiOk, onClick: () => !readOnly && apiOk && togglePanel('labels'), children: [_jsx(IconTag, {}), _jsx("span", { children: t('todoPage.cardModal.tabLabels') })] }), _jsxs("button", { type: "button", className: `tcm__tool-btn${activePanel === 'dates' ? ' tcm__tool-btn--active' : ''}`, disabled: readOnly, onClick: () => !readOnly && togglePanel('dates'), children: [_jsx(IconCalendar, {}), _jsx("span", { children: t('todoPage.cardModal.tabDates') })] }), _jsxs("button", { type: "button", className: `tcm__tool-btn${activePanel === 'checklist' ? ' tcm__tool-btn--active' : ''}`, disabled: readOnly || !apiOk, onClick: () => !readOnly && apiOk && togglePanel('checklist'), children: [_jsx(IconChecklist, {}), _jsx("span", { children: t('todoPage.cardModal.tabChecklist') })] }), _jsxs("button", { type: "button", className: `tcm__tool-btn${activePanel === 'members' ? ' tcm__tool-btn--active' : ''}`, disabled: readOnly || !apiOk, onClick: () => !readOnly && apiOk && togglePanel('members'), children: [_jsx(IconUsers, {}), _jsx("span", { children: t('todoPage.cardModal.tabMembers') })] })] }), readOnly && (_jsx("p", { className: "tcm__readonly-hint", children: card.fromCalendar ? t('todoPage.cardModal.outlookReadonly') : t('todoPage.viewerViewHint') })), !readOnly && attachError && (_jsx("p", { className: "tcm__attach-error tcm__attach-error--banner", children: attachError })), activePanel && createPortal(_jsxs("div", { ref: panelRef, className: `tcm__panel${activePanel === 'dates' ? ' tcm__panel--dates' : ''}`, style: panelStyle, onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", className: "tcm__panel-close", "aria-label": t('todoPage.close'), onClick: () => setActivePanel(null), children: _jsx(IconClose, {}) }), activePanel === 'labels' && (_jsx(LabelsPanel, { boardId: boardId, card: card, boardLabels: boardLabels, cardServerId: cardServerId, applyTodoBoard: applyTodoBoard, apiOk: apiOk })), activePanel === 'dates' && _jsx(DatesPanel, { card: card, onCardUpdate: onCardUpdate }), activePanel === 'checklist' && (_jsx(ChecklistPanel, { boardId: boardId, cardServerId: cardServerId, applyTodoBoard: applyTodoBoard, apiOk: apiOk })), activePanel === 'members' && (_jsx(MembersPanel, { boardId: boardId, card: card, cardServerId: cardServerId, applyTodoBoard: applyTodoBoard, apiOk: apiOk, boardUsers: todoBoardUsers }))] }), document.body), ((!readOnly && apiOk) || (card.attachments?.length ?? 0) > 0 || attachBusy) && (_jsxs("section", { className: "tcm__section", children: [_jsxs("h3", { className: "tcm__section-label", children: [_jsx(IconPaperclip, {}), t('todoPage.cardModal.attachments')] }), attachBusy && attachBusyHint && (_jsx("p", { className: "tcm__attach-uploading", role: "status", "aria-live": "polite", children: formatTodoUploading(attachBusyHint, t) })), !readOnly && apiOk && (_jsx("div", { className: "tcm__attach-dropzone-wrap", onDragEnter: (e) => {
                                                if (attachBusy)
                                                    return;
                                                e.preventDefault();
                                                setAttachDragging(true);
                                            }, onDragOver: (e) => {
                                                if (attachBusy)
                                                    return;
                                                e.preventDefault();
                                                setAttachDragging(true);
                                            }, onDragLeave: (e) => {
                                                if (!e.currentTarget.contains(e.relatedTarget))
                                                    setAttachDragging(false);
                                            }, onDrop: handleAttachDrop, children: _jsxs("label", { className: `tcm__attach-dropzone${attachDragging ? ' tcm__attach-dropzone--drag' : ''}${attachBusy ? ' tcm__attach-dropzone--busy' : ''}`, children: [_jsx("input", { ref: fileInputRef, type: "file", className: "tcm__attach-input", multiple: true, accept: "*/*", tabIndex: -1, onChange: (e) => void handleFiles(e) }), _jsx(IconPaperclip, {}), _jsx("span", { className: "tcm__attach-dropzone-title", children: (card.attachments?.length ?? 0) === 0
                                                            ? t('todoPage.cardModal.attachDropTitle')
                                                            : t('todoPage.cardModal.addAttachment') }), _jsx("span", { className: "tcm__attach-dropzone-hint", children: t('todoPage.cardModal.attachDropHint') })] }) })), (card.attachments?.length ?? 0) > 0 && (_jsx("ul", { className: "tcm__attachments", children: card.attachments.map((a) => (_jsxs("li", { className: "tcm__attach-row", children: [a.mediaUrl ? (_jsx("button", { type: "button", className: "tcm__attach-link", onClick: () => void openAttachment(a.mediaUrl), children: a.name })) : (_jsx("span", { className: "tcm__attach-name", children: a.name })), apiOk && (_jsx("button", { type: "button", className: "tcm__attach-remove", onClick: () => void removeAttachment(a.id), "aria-label": t('todoPage.cardModal.removeAttachment'), children: "\u00D7" }))] }, a.id))) }))] })), (card.checklist?.length ?? 0) > 0 && (_jsx(ChecklistSection, { boardId: boardId, checklist: card.checklist, cardServerId: cardServerId, applyTodoBoard: applyTodoBoard, apiOk: apiOk })), _jsxs("section", { className: "tcm__section", children: [_jsxs("h3", { className: "tcm__section-label", children: [_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "3", y1: "6", x2: "21", y2: "6" }), _jsx("line", { x1: "3", y1: "12", x2: "21", y2: "12" }), _jsx("line", { x1: "3", y1: "18", x2: "15", y2: "18" })] }), t('todoPage.cardModal.description')] }), _jsx("div", { className: `tcm__desc-wrap${descFocused ? ' tcm__desc-wrap--focus' : ''}`, children: _jsx("textarea", { className: "tcm__desc", placeholder: t('todoPage.cardModal.descriptionPlaceholder'), value: descDraft, readOnly: readOnly, onChange: (e) => setDescDraft(e.target.value), onFocus: () => setDescFocused(true), onBlur: () => {
                                                    setDescFocused(false);
                                                    commitDescription();
                                                }, rows: 4 }) })] })] }), _jsxs("aside", { className: "tcm__aside", children: [_jsxs("div", { className: "tcm__aside-section", children: [_jsxs("h3", { className: "tcm__aside-heading", children: [_jsx(IconComment, {}), t('todoPage.cardModal.activity')] }), _jsxs("div", { className: "tcm__comment-compose", children: [_jsx("div", { className: "tcm__comment-avatar tcm__comment-avatar--me", children: t('todoPage.me') }), _jsxs("div", { className: "tcm__comment-compose-wrap", children: [_jsx("textarea", { className: "tcm__comment-input", placeholder: apiOk ? t('todoPage.cardModal.commentPlaceholder') : t('todoPage.cardModal.commentDisabled'), value: commentText, onChange: (e) => setCommentText(e.target.value), rows: 1, disabled: !apiOk, onKeyDown: (e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    void sendComment();
                                                                }
                                                            }, "aria-label": t('todoPage.cardModal.commentAria') }), commentText.trim() && apiOk && (_jsx("button", { type: "button", className: "tcm__comment-send", onClick: () => void sendComment(), children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] }) }))] })] }), _jsxs("div", { className: "tcm__activity-feed", children: [[...(card.comments ?? [])]
                                                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                                                    .map((cm) => {
                                                    const authorLabel = todoParticipantLabel(todoBoardUsers.byId, cm.userId);
                                                    return (_jsxs("div", { className: "tcm__activity-item", children: [_jsx("div", { className: "tcm__activity-avatar", title: authorLabel, children: todoInitialFromDisplayLabel(authorLabel) }), _jsxs("div", { className: "tcm__activity-body", children: [_jsx("p", { className: "tcm__activity-text", children: cm.body }), _jsxs("span", { className: "tcm__activity-time", children: [authorLabel, ' · ', new Date(cm.createdAt).toLocaleString(dateLocale, {
                                                                                day: '2-digit',
                                                                                month: 'short',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit',
                                                                            })] })] })] }, cm.id));
                                                }), (card.comments?.length ?? 0) === 0 && (_jsx("div", { className: "tcm__activity-item tcm__activity-item--muted", children: _jsx("div", { className: "tcm__activity-body", children: _jsx("p", { className: "tcm__activity-text", children: t('todoPage.cardModal.noComments') }) }) }))] })] }), onArchive && (_jsx("div", { className: "tcm__aside-footer", children: _jsxs("button", { type: "button", className: "tcm__archive-btn", onClick: onArchive, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8" }), _jsx("path", { d: "M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5" }), _jsx("rect", { x: "2", y: "8", width: "20", height: "13", rx: "2" })] }), t('todoPage.cardModal.archiveCard')] }) }))] })] })] }) }));
});
function LabelsPanel({ boardId, card, boardLabels, cardServerId, applyTodoBoard, apiOk, }) {
    const { t } = useI18n();
    const [text, setText] = useState('');
    const [color, setColor] = useState(LABEL_COLORS[5]);
    const currentIds = new Set((card.labels ?? []).map((l) => Number(l.id)).filter((n) => !Number.isNaN(n)));
    const toggleBoardLabel = async (boardLabelId) => {
        if (!apiOk)
            return;
        const next = new Set(currentIds);
        if (next.has(boardLabelId))
            next.delete(boardLabelId);
        else
            next.add(boardLabelId);
        await applyTodoBoard(patchTodoCard(boardId, cardServerId, { labelIds: [...next] }));
    };
    const createAndAttach = async () => {
        if (!text.trim() || !apiOk)
            return;
        const title = text.trim();
        const board = await applyTodoBoard(createTodoBoardLabel(boardId, { title, color }));
        setText('');
        if (!board)
            return;
        const candidates = board.board_labels.filter((l) => l.title === title && l.color === color);
        const created = candidates.sort((a, b) => b.id - a.id)[0];
        if (!created)
            return;
        const next = new Set([...currentIds, created.id]);
        await applyTodoBoard(patchTodoCard(boardId, cardServerId, { labelIds: [...next] }));
    };
    return (_jsxs("div", { className: "tcm__panel-inner", children: [_jsx("h4", { className: "tcm__panel-title", children: t('todoPage.cardModal.labelsTitle') }), _jsx("p", { className: "tcm__panel-hint", children: t('todoPage.cardModal.labelsHint') }), _jsx("div", { className: "tcm__board-labels-grid", children: boardLabels.map((bl) => {
                    const on = currentIds.has(bl.id);
                    return (_jsxs("button", { type: "button", className: `tcm__board-label-pill${on ? ' tcm__board-label-pill--on' : ''}`, style: { ['--pill']: bl.color }, onClick: () => void toggleBoardLabel(bl.id), children: [_jsx("span", { className: "tcm__board-label-pill-dot", style: { background: bl.color } }), bl.title] }, bl.id));
                }) }), _jsx("div", { className: "tcm__panel-colors", children: LABEL_COLORS.map((c) => (_jsx("button", { type: "button", className: `tcm__panel-color${c === color ? ' tcm__panel-color--active' : ''}`, style: { background: c }, onClick: () => setColor(c), "aria-label": c }, c))) }), _jsxs("div", { className: "tcm__panel-row", children: [_jsx("input", { className: "tcm__panel-input", value: text, onChange: (e) => setText(e.target.value), placeholder: t('todoPage.cardModal.newLabelPlaceholder'), onKeyDown: (e) => e.key === 'Enter' && void createAndAttach() }), _jsx("button", { type: "button", className: "tcm__panel-add", onClick: () => void createAndAttach(), "aria-label": t('todoPage.cardModal.createLabel'), children: _jsx(IconPlus, {}) })] })] }));
}
function pad2(n) { return n.toString().padStart(2, '0'); }
function dateToStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function buildCalendar(year, month) {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++)
        cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
        cells.push(new Date(year, month, d));
    return cells;
}
function DatesPanel({ card, onCardUpdate }) {
    const { t } = useI18n();
    const weekdays = todoWeekdayLabels(t);
    const [activeField, setActiveField] = useState('start');
    const [startDate, setStartDate] = useState(card.startDate ?? '');
    const [dueDate, setDueDate] = useState(card.dueDate ?? '');
    const [dueTimeLocal, setDueTimeLocal] = useState(card.dueTime ?? '');
    const todayStr = dateToStr(new Date());
    useEffect(() => {
        setStartDate(card.startDate ?? '');
        setDueDate(card.dueDate ?? '');
        setDueTimeLocal(card.dueTime ?? '');
    }, [card.id, card.startDate, card.dueDate, card.dueTime]);
    const selectedStr = activeField === 'start' ? startDate : dueDate;
    const parsed = selectedStr ? new Date(selectedStr) : new Date();
    const [viewYear, setViewYear] = useState(parsed.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed.getMonth());
    const cells = buildCalendar(viewYear, viewMonth);
    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewYear((y) => y - 1);
            setViewMonth(11);
        }
        else
            setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewYear((y) => y + 1);
            setViewMonth(0);
        }
        else
            setViewMonth((m) => m + 1);
    };
    const pickDate = (d) => {
        const str = dateToStr(d);
        if (activeField === 'start')
            setStartDate(str);
        else
            setDueDate(str);
    };
    const apply = () => {
        onCardUpdate({
            startDate: startDate || undefined,
            startTime: undefined,
            dueDate: dueDate || undefined,
            dueTime: dueTimeLocal || undefined,
        });
    };
    const clear = () => {
        onCardUpdate({ dueDate: undefined, dueTime: undefined });
        setDueDate('');
        setDueTimeLocal('');
    };
    const formatDisplay = (date) => {
        if (!date)
            return '—';
        const d = new Date(date);
        return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    };
    return (_jsxs("div", { className: "tcm__panel-inner tcm__panel-inner--dates", children: [_jsx("h4", { className: "tcm__panel-title", children: t('todoPage.cardModal.datesTitle') }), _jsxs("div", { className: "tcm__dp-tabs", children: [_jsx("button", { type: "button", className: `tcm__dp-tab${activeField === 'start' ? ' tcm__dp-tab--active' : ''}`, onClick: () => {
                            setActiveField('start');
                            if (startDate) {
                                const d = new Date(startDate);
                                setViewYear(d.getFullYear());
                                setViewMonth(d.getMonth());
                            }
                        }, children: t('todoPage.cardModal.start') }), _jsx("button", { type: "button", className: `tcm__dp-tab${activeField === 'due' ? ' tcm__dp-tab--active' : ''}`, onClick: () => {
                            setActiveField('due');
                            if (dueDate) {
                                const d = new Date(dueDate);
                                setViewYear(d.getFullYear());
                                setViewMonth(d.getMonth());
                            }
                        }, children: t('todoPage.cardModal.due') })] }), _jsxs("div", { className: "tcm__dp-cal", children: [_jsxs("div", { className: "tcm__dp-nav", children: [_jsx("button", { type: "button", className: "tcm__dp-nav-btn", onClick: prevMonth, "aria-label": t('todoPage.prevMonth'), children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "15 18 9 12 15 6" }) }) }), _jsxs("span", { className: "tcm__dp-month", children: [todoMonthName(viewMonth, t), " ", viewYear] }), _jsx("button", { type: "button", className: "tcm__dp-nav-btn", onClick: nextMonth, "aria-label": t('todoPage.nextMonth'), children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "9 18 15 12 9 6" }) }) })] }), _jsx("div", { className: "tcm__dp-weekdays", children: weekdays.map((w) => _jsx("span", { className: "tcm__dp-wd", children: w }, w)) }), _jsx("div", { className: "tcm__dp-grid", children: cells.map((cell, i) => {
                            if (!cell)
                                return _jsx("span", { className: "tcm__dp-cell tcm__dp-cell--empty" }, `e${i}`);
                            const str = dateToStr(cell);
                            const isSelected = str === selectedStr;
                            const isToday = str === todayStr;
                            return (_jsx("button", { type: "button", className: [
                                    'tcm__dp-cell',
                                    isSelected && 'tcm__dp-cell--selected',
                                    isToday && !isSelected && 'tcm__dp-cell--today',
                                ].filter(Boolean).join(' '), onClick: () => pickDate(cell), children: cell.getDate() }, str));
                        }) })] }), _jsxs("div", { className: "tcm__dp-fields", children: [_jsxs("div", { className: "tcm__dp-field-group", children: [_jsx("span", { className: "tcm__dp-field-label", children: t('todoPage.cardModal.start') }), _jsx("div", { className: "tcm__dp-field-row tcm__dp-field-row--date-only", children: _jsx("span", { className: "tcm__dp-field-val", children: formatDisplay(startDate) }) })] }), _jsxs("div", { className: "tcm__dp-field-group", children: [_jsx("span", { className: "tcm__dp-field-label", children: t('todoPage.cardModal.due') }), _jsx("div", { className: "tcm__dp-field-row tcm__dp-field-row--date-only", children: _jsx("span", { className: "tcm__dp-field-val", children: formatDisplay(dueDate) }) }), _jsxs("label", { className: "tcm__dp-time-label", children: [t('todoPage.cardModal.timeForServer'), _jsx("input", { className: "tcm__panel-input tcm__dp-time-input", type: "time", value: dueTimeLocal, onChange: (e) => setDueTimeLocal(e.target.value) })] })] })] }), _jsx("p", { className: "tcm__panel-hint", children: t('todoPage.cardModal.datesHint') }), _jsxs("div", { className: "tcm__panel-actions", children: [_jsx("button", { type: "button", className: "tcm__panel-btn tcm__panel-btn--primary", onClick: apply, children: t('todoPage.save') }), _jsx("button", { type: "button", className: "tcm__panel-btn", onClick: clear, children: t('todoPage.cardModal.resetDue') })] })] }));
}
function ChecklistPanel({ boardId, cardServerId, applyTodoBoard, apiOk, }) {
    const { t } = useI18n();
    const [text, setText] = useState('');
    const addItem = async () => {
        if (!text.trim() || !apiOk)
            return;
        const title = text.trim();
        setText('');
        await applyTodoBoard(createTodoChecklistItem(boardId, cardServerId, { title }));
    };
    return (_jsxs("div", { className: "tcm__panel-inner", children: [_jsx("h4", { className: "tcm__panel-title", children: t('todoPage.cardModal.checklistAdd') }), _jsxs("div", { className: "tcm__panel-row", children: [_jsx("input", { className: "tcm__panel-input", value: text, onChange: (e) => setText(e.target.value), placeholder: t('todoPage.cardModal.newChecklistItem'), onKeyDown: (e) => e.key === 'Enter' && void addItem() }), _jsx("button", { type: "button", className: "tcm__panel-add", onClick: () => void addItem(), "aria-label": t('todoPage.cardModal.add'), children: _jsx(IconPlus, {}) })] })] }));
}
function ChecklistSection({ boardId, checklist, cardServerId, applyTodoBoard, apiOk, }) {
    const { t } = useI18n();
    const sorted = [...checklist].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const done = sorted.filter((i) => i.done).length;
    const pct = sorted.length > 0 ? Math.round((done / sorted.length) * 100) : 0;
    const toggle = (item) => {
        if (!apiOk)
            return;
        const num = Number(item.id);
        if (!Number.isFinite(num))
            return;
        void applyTodoBoard(patchTodoChecklistItem(boardId, cardServerId, num, { isDone: !item.done }));
    };
    const remove = (id) => {
        if (!apiOk)
            return;
        const num = Number(id);
        if (!Number.isFinite(num))
            return;
        void applyTodoBoard(deleteTodoChecklistItem(boardId, cardServerId, num));
    };
    return (_jsxs("section", { className: "tcm__section", children: [_jsxs("h3", { className: "tcm__section-label", children: [_jsx(IconChecklist, {}), t('todoPage.cardModal.checklist'), _jsxs("span", { className: "tcm__checklist-pct", children: [pct, "%"] })] }), _jsx("div", { className: "tcm__checklist-bar", children: _jsx("div", { className: "tcm__checklist-bar-fill", style: { width: `${pct}%` } }) }), _jsx("div", { className: "tcm__checklist-items", children: sorted.map((item) => (_jsxs("div", { className: `tcm__checklist-item${item.done ? ' tcm__checklist-item--done' : ''}`, children: [_jsx("button", { type: "button", className: `tcm__checklist-check${item.done ? ' tcm__checklist-check--done' : ''}`, onClick: () => toggle(item), children: item.done && _jsx(IconCheck, {}) }), _jsx("span", { className: "tcm__checklist-text", children: item.text }), apiOk && (_jsx("button", { type: "button", className: "tcm__checklist-del", onClick: () => remove(item.id), "aria-label": t('todoPage.cardModal.deleteItem'), children: _jsx(IconClose, {}) }))] }, item.id))) })] }));
}
function MembersPanel({ boardId, card, cardServerId, applyTodoBoard, apiOk, boardUsers, }) {
    const { t, locale } = useI18n();
    const [userIdRaw, setUserIdRaw] = useState('');
    const [pickSearch, setPickSearch] = useState('');
    const ids = useMemo(() => card.participantUserIds ?? [], [card.participantUserIds]);
    const byId = boardUsers.byId;
    const pickList = useMemo(() => {
        if (boardUsers.error !== null)
            return [];
        const q = pickSearch.trim().toLowerCase();
        return boardUsers.list
            .filter((u) => !ids.includes(u.id) && !u.is_blocked)
            .filter((u) => !q ||
            u.email.toLowerCase().includes(q) ||
            (u.display_name?.toLowerCase().includes(q) ?? false) ||
            String(u.id).includes(q))
            .sort((a, b) => todoUserPickLabel(a).localeCompare(todoUserPickLabel(b), locale === 'ru' ? 'ru' : 'en'));
    }, [boardUsers.list, boardUsers.error, ids, locale, pickSearch]);
    const addMemberById = async (n) => {
        if (!apiOk)
            return;
        if (!Number.isFinite(n) || n <= 0)
            return;
        if (ids.includes(n))
            return;
        await applyTodoBoard(patchTodoCard(boardId, cardServerId, { participantUserIds: [...ids, n] }));
    };
    const addMemberManual = async () => {
        const n = Number.parseInt(userIdRaw.trim(), 10);
        if (!Number.isFinite(n) || n <= 0)
            return;
        setUserIdRaw('');
        await addMemberById(n);
    };
    const removeMember = async (uid) => {
        if (!apiOk)
            return;
        await applyTodoBoard(patchTodoCard(boardId, cardServerId, { participantUserIds: ids.filter((x) => x !== uid) }));
    };
    const directoryReady = !boardUsers.loading && boardUsers.error === null;
    return (_jsxs("div", { className: "tcm__panel-inner", children: [_jsx("h4", { className: "tcm__panel-title", children: t('todoPage.cardModal.membersTitle') }), _jsx("p", { className: "tcm__panel-hint", children: directoryReady
                    ? t('todoPage.cardModal.membersPickHint')
                    : t('todoPage.cardModal.membersManualHint') }), (ids.length ?? 0) > 0 && (_jsx("div", { className: "tcm__panel-members", children: ids.map((m) => {
                    const u = byId.get(m);
                    const label = todoParticipantLabel(byId, m);
                    const initial = u ? todoUserPickInitial(u) : todoInitialFromDisplayLabel(label);
                    return (_jsxs("span", { className: "tcm__panel-member", children: [_jsx("span", { className: "tcm__panel-member-avatar", children: initial }), _jsxs("span", { className: "tcm__panel-member-text", children: [_jsx("span", { children: label }), u && _jsx("span", { className: "tcm__panel-member-sub", children: u.email })] }), _jsx("button", { type: "button", onClick: () => void removeMember(m), "aria-label": t('todoPage.cardModal.deleteItem'), children: "\u00D7" })] }, m));
                }) })), boardUsers.loading && _jsx("p", { className: "tcm__members-pick-status", children: t('todoPage.cardModal.membersLoading') }), boardUsers.error && (_jsx("p", { className: "tcm__members-pick-status tcm__members-pick-status--error", children: boardUsers.error })), directoryReady && (_jsxs(_Fragment, { children: [_jsx("input", { className: "tcm__panel-input tcm__members-pick-search", type: "search", value: pickSearch, onChange: (e) => setPickSearch(e.target.value), placeholder: t('todoPage.cardModal.membersSearch'), autoComplete: "off" }), _jsx("div", { className: "tcm__members-pick-list", role: "listbox", "aria-label": t('todoPage.cardModal.membersListAria'), children: pickList.length === 0 ? (_jsx("p", { className: "tcm__members-pick-empty", children: t('todoPage.cardModal.membersEmpty') })) : (pickList.map((u) => (_jsxs("button", { type: "button", className: "tcm__members-pick-row", disabled: !apiOk, "aria-label": formatTodoAddMember(todoUserPickLabel(u), t), onClick: () => void addMemberById(u.id), children: [_jsx("span", { className: "tcm__members-pick-avatar", children: todoUserPickInitial(u) }), _jsxs("span", { className: "tcm__members-pick-main", children: [_jsx("span", { className: "tcm__members-pick-name", children: todoUserPickLabel(u) }), _jsx("span", { className: "tcm__members-pick-email", children: u.email })] })] }, u.id)))) })] })), !directoryReady && !boardUsers.loading && (_jsxs("div", { className: "tcm__panel-row", children: [_jsx("input", { className: "tcm__panel-input", type: "number", min: 1, step: 1, value: userIdRaw, onChange: (e) => setUserIdRaw(e.target.value), placeholder: "User id\u2026", onKeyDown: (e) => e.key === 'Enter' && void addMemberManual() }), _jsx("button", { type: "button", className: "tcm__panel-add", onClick: () => void addMemberManual(), "aria-label": t('todoPage.cardModal.add'), children: _jsx(IconPlus, {}) })] }))] }));
}
