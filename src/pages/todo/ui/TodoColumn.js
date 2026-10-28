import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconCollapseColumn, IconMore, IconPlus, IconStack } from './TodoIcons';
import { todoInitialFromDisplayLabel, todoParticipantLabel } from '@entities/todo/lib/todoUserDisplay';
import { useI18n, todoLocaleTag } from '@shared/i18n';
export const TodoColumn = memo(function TodoColumn({ config, todoBoardUsers, isCollapsed, cards, columnProgressDone, columnProgressTotal, listSortMode, hideCompletedFilter, isDragging, isDropTarget, onColumnMouseDown, onColumnKeyDown, onToggleCollapse, onExpand, onAddCardClick, onCardClick, onCardToggleComplete, onSortCards, onToggleHideCompleted, onRenameColumn, onArchiveAllCards, onArchiveColumn, onDeleteColumn, onArchiveCard, onMoveCard, moveColumns, onCardDragStart, isCardDropTarget, draggingCard, touchPressCard, columnRef, structureReadOnly = false, cardsReadOnly = false, }) {
    const { t } = useI18n();
    const { id, dotColor } = config;
    const sortItemClass = (mode) => ['todo-col-menu__item', listSortMode === mode && 'todo-col-menu__item--active'].filter(Boolean).join(' ');
    const [openMenu, setOpenMenu] = useState(null);
    const [renaming, setRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState(config.title);
    const menuRef = useRef(null);
    const actionsRef = useRef(null);
    const [menuStyle, setMenuStyle] = useState({});
    const toggleMenu = useCallback((m) => {
        setOpenMenu((prev) => (prev === m ? null : m));
    }, []);
    useLayoutEffect(() => {
        if (!openMenu || !actionsRef.current)
            return;
        const rect = actionsRef.current.getBoundingClientRect();
        const page = actionsRef.current.closest('.todo-page');
        const vars = {};
        if (page) {
            const cs = getComputedStyle(page);
            ['--todo-accent', '--todo-text', '--todo-muted', '--todo-surface', '--todo-panel-bg', '--todo-border'].forEach((n) => {
                vars[n] = cs.getPropertyValue(n).trim();
            });
        }
        setMenuStyle({ top: rect.bottom + 4, left: Math.max(8, rect.right - 200), ...vars });
    }, [openMenu]);
    useEffect(() => {
        if (!openMenu)
            return;
        const onDocClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target) &&
                actionsRef.current && !actionsRef.current.contains(e.target)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [openMenu]);
    const submitRename = () => {
        if (renameVal.trim() && renameVal.trim() !== config.title) {
            onRenameColumn(id, renameVal.trim());
        }
        setRenaming(false);
        setOpenMenu(null);
    };
    return (_jsxs("div", { ref: columnRef, "data-todo-column-id": id, className: [
            'todo-column',
            `todo-column--${id}`,
            isCollapsed && 'todo-column--collapsed',
            isDragging && 'todo-column--dragging',
            isDropTarget && 'todo-column--drop-target',
            isCardDropTarget && 'todo-column--card-drop-target',
        ].filter(Boolean).join(' '), style: dotColor ? { '--todo-column-dot': dotColor } : undefined, children: [_jsxs("div", { className: "todo-column__head", onPointerDown: (e) => {
                    if (!openMenu && !structureReadOnly)
                        onColumnMouseDown(e, id);
                }, style: { touchAction: 'none' }, role: structureReadOnly ? undefined : 'button', tabIndex: structureReadOnly ? undefined : 0, onKeyDown: (e) => !structureReadOnly && e.key === 'Enter' && onColumnKeyDown(id), "aria-label": structureReadOnly ? undefined : t('todoPage.column.dragAria'), children: [_jsxs("div", { className: "todo-column__head-left", children: [_jsx("span", { className: "todo-column__dot" }), _jsx("h2", { className: "todo-column__title", children: config.title }), _jsx("span", { className: "todo-column__count", children: cards.length })] }), _jsxs("div", { className: "todo-column__actions", ref: actionsRef, children: [_jsx("button", { type: "button", className: `todo-column__action${openMenu === 'stack' ? ' todo-column__action--active' : ''}`, "aria-label": t('todoPage.column.sortAria'), onClick: (e) => { e.stopPropagation(); toggleMenu('stack'); }, children: _jsx(IconStack, {}) }), !structureReadOnly && (_jsx("button", { type: "button", className: `todo-column__action${openMenu === 'more' ? ' todo-column__action--active' : ''}`, "aria-label": t('todoPage.column.moreAria'), onClick: (e) => { e.stopPropagation(); toggleMenu('more'); }, children: _jsx(IconMore, {}) })), _jsx("button", { type: "button", className: "todo-column__action", "aria-label": isCollapsed ? t('todoPage.column.expand') : t('todoPage.column.collapse'), onClick: (e) => { e.stopPropagation(); onToggleCollapse(id); }, children: _jsx(IconCollapseColumn, {}) })] }), openMenu === 'stack' && createPortal(_jsxs("div", { ref: menuRef, className: "todo-col-menu", style: menuStyle, onMouseDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "todo-col-menu__title", children: t('todoPage.column.sortTitle') }), _jsxs("button", { type: "button", className: sortItemClass('server'), onClick: () => { onSortCards(id, 'server'); setOpenMenu(null); }, children: [_jsx(IconStack, {}), t('todoPage.column.sortServer')] }), _jsxs("button", { type: "button", className: sortItemClass('az'), onClick: () => { onSortCards(id, 'az'); setOpenMenu(null); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 6h13M3 12h9M3 18h5" }), _jsx("path", { d: "m16 6 4 6h-8l4-6Z" })] }), t('todoPage.column.sortAz')] }), _jsxs("button", { type: "button", className: sortItemClass('za'), onClick: () => { onSortCards(id, 'za'); setOpenMenu(null); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 6h5M3 12h9M3 18h13" }), _jsx("path", { d: "m16 18 4-6h-8l4 6Z" })] }), t('todoPage.column.sortZa')] }), _jsxs("button", { type: "button", className: sortItemClass('newest'), onClick: () => { onSortCards(id, 'newest'); setOpenMenu(null); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }), t('todoPage.column.sortNewest')] }), _jsxs("button", { type: "button", className: sortItemClass('oldest'), onClick: () => { onSortCards(id, 'oldest'); setOpenMenu(null); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 8 14" })] }), t('todoPage.column.sortOldest')] }), _jsxs("button", { type: "button", className: sortItemClass('done'), onClick: () => { onSortCards(id, 'done'); setOpenMenu(null); }, children: [_jsx(IconCheck, {}), t('todoPage.column.sortDone')] }), _jsx("div", { className: "todo-col-menu__sep" }), _jsx("div", { className: "todo-col-menu__title", children: t('todoPage.column.filterTitle') }), _jsxs("button", { type: "button", className: ['todo-col-menu__item', hideCompletedFilter && 'todo-col-menu__item--active'].filter(Boolean).join(' '), "aria-pressed": hideCompletedFilter, onClick: () => onToggleHideCompleted(id), children: [_jsx(IconCheck, {}), t('todoPage.column.hideCompleted')] })] }), document.body), openMenu === 'more' && !structureReadOnly && createPortal(_jsx("div", { ref: menuRef, className: "todo-col-menu", style: menuStyle, onMouseDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(), children: !renaming ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "todo-col-menu__item", onClick: () => { setRenaming(true); setRenameVal(config.title); }, children: [_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }) }), t('todoPage.column.rename')] }), _jsxs("button", { type: "button", className: "todo-col-menu__item", onClick: () => { onAddCardClick(id); setOpenMenu(null); }, children: [_jsx(IconPlus, {}), t('todoPage.column.addCard')] }), _jsx("div", { className: "todo-col-menu__sep" }), _jsxs("button", { type: "button", className: "todo-col-menu__item", onClick: () => { onArchiveAllCards(id); setOpenMenu(null); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 8v13H3V8" }), _jsx("path", { d: "M1 3h22v5H1z" }), _jsx("path", { d: "M10 12h4" })] }), t('todoPage.column.archiveCards')] }), _jsxs("button", { type: "button", className: "todo-col-menu__item", onClick: () => { onArchiveColumn(id); setOpenMenu(null); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 8v13H3V8" }), _jsx("path", { d: "M1 3h22v5H1z" }), _jsx("path", { d: "M10 12h4" })] }), t('todoPage.column.archiveList')] }), _jsxs("button", { type: "button", className: "todo-col-menu__item todo-col-menu__item--danger", onClick: () => { onDeleteColumn(id); setOpenMenu(null); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }), t('todoPage.column.delete')] })] })) : (_jsxs("div", { className: "todo-col-menu__rename", children: [_jsx("input", { className: "todo-col-menu__input", value: renameVal, onChange: (e) => setRenameVal(e.target.value), onKeyDown: (e) => {
                                        if (e.key === 'Enter')
                                            submitRename();
                                        if (e.key === 'Escape') {
                                            setRenaming(false);
                                            setOpenMenu(null);
                                        }
                                    }, autoFocus: true }), _jsxs("div", { className: "todo-col-menu__rename-actions", children: [_jsx("button", { type: "button", className: "todo-col-menu__rename-btn todo-col-menu__rename-btn--save", onClick: submitRename, children: t('todoPage.save') }), _jsx("button", { type: "button", className: "todo-col-menu__rename-btn", onClick: () => { setRenaming(false); setOpenMenu(null); }, children: t('todoPage.cancel') })] })] })) }), document.body)] }), columnProgressDone > 0 && columnProgressTotal > 0 && (_jsx("div", { className: "todo-column__progress", children: _jsx("div", { className: "todo-column__progress-bar", style: { width: `${Math.round((columnProgressDone / columnProgressTotal) * 100)}%` } }) })), _jsx("div", { className: "todo-column__cards", children: cards.map((card) => (_jsx(CardItem, { card: card, columnId: id, participantUserById: todoBoardUsers.byId, cardsReadOnly: cardsReadOnly, onCardClick: onCardClick, onCardToggleComplete: onCardToggleComplete, onArchiveCard: onArchiveCard, onMoveCard: onMoveCard, moveColumns: moveColumns, onCardDragStart: onCardDragStart, isDragging: draggingCard?.columnId === id && draggingCard?.cardId === card.id, isTouchPressPending: touchPressCard?.columnId === id && touchPressCard?.cardId === card.id }, card.id))) }), !structureReadOnly && (_jsxs("button", { type: "button", className: "todo-column__add", onClick: (e) => { e.stopPropagation(); onAddCardClick(id); }, children: [_jsx(IconPlus, {}), _jsx("span", { children: t('todoPage.column.addCard') })] })), _jsxs("div", { className: "todo-column__collapsed-label", onClick: () => onExpand(id), role: "button", tabIndex: 0, onKeyDown: (e) => e.key === 'Enter' && onExpand(id), "aria-label": t('todoPage.column.expandNamed').replace('{title}', config.title), children: [_jsx("span", { className: "todo-column__collapsed-icon", children: _jsx(IconCollapseColumn, {}) }), _jsx("span", { className: "todo-column__collapsed-text", children: config.collapsedLabel })] })] }));
});
const CardItem = memo(function CardItem({ card, columnId, participantUserById, cardsReadOnly = false, onCardClick, onCardToggleComplete, onArchiveCard, onMoveCard, moveColumns, onCardDragStart, isDragging, isTouchPressPending, }) {
    const { t, locale } = useI18n();
    const dateLocale = todoLocaleTag(locale);
    const hasLabels = (card.labels?.length ?? 0) > 0;
    const hasDesc = !!card.description;
    const hasDue = !!card.dueDate;
    const hasChecklist = (card.checklist?.length ?? 0) > 0;
    const participantIds = card.participantUserIds ?? [];
    const hasMembers = participantIds.length > 0;
    const hasMeta = hasDesc || hasDue || hasChecklist;
    const checkDone = hasChecklist ? card.checklist.filter((i) => i.done).length : 0;
    const checkTotal = hasChecklist ? card.checklist.length : 0;
    const isCalendar = !!card.fromCalendar;
    const [ctxMenu, setCtxMenu] = useState(null);
    const ctxMenuRef = useRef(null);
    const [ctxMenuStyle, setCtxMenuStyle] = useState({});
    const otherColumns = moveColumns.filter((c) => c.id !== columnId);
    const handleCardPointerDown = useCallback((e) => {
        if (cardsReadOnly)
            return;
        if (e.pointerType !== 'mouse')
            return;
        if (e.button !== 0)
            return;
        if (e.target.closest('button'))
            return;
        const rect = e.currentTarget.getBoundingClientRect();
        onCardDragStart?.(e, columnId, card.id, rect, false);
    }, [cardsReadOnly, columnId, card.id, onCardDragStart]);
    const handleDragHandlePointerDown = useCallback((e) => {
        if (cardsReadOnly)
            return;
        e.stopPropagation();
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        if (e.pointerType === 'touch')
            e.preventDefault();
        const cardEl = e.currentTarget.closest('[data-todo-card-id]');
        if (!cardEl)
            return;
        const rect = cardEl.getBoundingClientRect();
        onCardDragStart?.(e, columnId, card.id, rect, true);
    }, [cardsReadOnly, columnId, card.id, onCardDragStart]);
    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        const page = e.currentTarget.closest('.todo-page');
        const vars = {};
        if (page) {
            const cs = getComputedStyle(page);
            ['--todo-accent', '--todo-text', '--todo-muted', '--todo-surface', '--todo-panel-bg', '--todo-border'].forEach((n) => {
                vars[n] = cs.getPropertyValue(n).trim();
            });
        }
        setCtxMenuStyle({ ...vars });
        setCtxMenu({ x: e.clientX, y: e.clientY });
    }, []);
    useLayoutEffect(() => {
        if (!ctxMenu || !ctxMenuRef.current)
            return;
        const el = ctxMenuRef.current;
        const rect = el.getBoundingClientRect();
        const pad = 8;
        let left = ctxMenu.x;
        let top = ctxMenu.y;
        if (left + rect.width > window.innerWidth - pad)
            left = Math.max(pad, window.innerWidth - rect.width - pad);
        if (top + rect.height > window.innerHeight - pad)
            top = Math.max(pad, window.innerHeight - rect.height - pad);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    }, [ctxMenu]);
    useEffect(() => {
        if (!ctxMenu)
            return;
        const close = () => setCtxMenu(null);
        const onKey = (e) => {
            if (e.key === 'Escape')
                close();
        };
        const onDoc = (e) => {
            if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target))
                close();
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        document.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('scroll', close, true);
        };
    }, [ctxMenu]);
    const closeCtx = () => setCtxMenu(null);
    return (_jsxs("div", { role: "button", tabIndex: 0, "data-todo-card-id": card.id, className: [
            'todo-card',
            card.completed && 'todo-card--completed',
            isCalendar && 'todo-card--calendar',
            isDragging && 'todo-card--dragging',
            isTouchPressPending && 'todo-card--touch-press',
            ctxMenu && 'todo-card--ctx-open',
        ].filter(Boolean).join(' '), onClick: () => onCardClick(columnId, card.id), onKeyDown: (e) => e.key === 'Enter' && onCardClick(columnId, card.id), onPointerDown: handleCardPointerDown, onContextMenu: handleContextMenu, children: [isCalendar && (_jsxs("div", { className: "todo-card__cal-badge", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }), _jsx("span", { children: t('todoPage.column.outlook') })] })), hasLabels && (_jsx("div", { className: "todo-card__labels", children: card.labels.map((l) => (_jsx("span", { className: "todo-card__label", style: { background: l.color }, children: l.text }, l.id))) })), _jsxs("div", { className: "todo-card__row", children: [!isCalendar && !cardsReadOnly && (_jsx("button", { type: "button", className: "todo-card__drag-handle", onPointerDown: handleDragHandlePointerDown, onClick: (e) => e.stopPropagation(), "aria-label": t('todoPage.column.dragCardAria'), children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [_jsx("circle", { cx: "9", cy: "7", r: "1.5" }), _jsx("circle", { cx: "15", cy: "7", r: "1.5" }), _jsx("circle", { cx: "9", cy: "12", r: "1.5" }), _jsx("circle", { cx: "15", cy: "12", r: "1.5" }), _jsx("circle", { cx: "9", cy: "17", r: "1.5" }), _jsx("circle", { cx: "15", cy: "17", r: "1.5" })] }) })), !isCalendar && !cardsReadOnly && (_jsx("button", { type: "button", className: "todo-card__checkbox", onClick: (e) => { e.stopPropagation(); onCardToggleComplete(columnId, card.id); }, "aria-label": card.completed ? t('todoPage.column.unmarkDone') : t('todoPage.column.markDone'), "aria-pressed": card.completed, children: card.completed && _jsx(IconCheck, {}) })), _jsx("span", { className: "todo-card__title", children: card.title })] }), isCalendar && card.calendarTime && (_jsxs("div", { className: "todo-card__cal-time", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }), _jsx("span", { children: card.calendarTime })] })), !isCalendar && hasMeta && (_jsxs("div", { className: "todo-card__meta", children: [hasDue && (_jsxs("span", { className: "todo-card__meta-chip todo-card__meta-chip--due", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }), new Date(card.dueDate).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' })] })), hasDesc && (_jsx("span", { className: "todo-card__meta-chip", title: t('todoPage.column.hasDescription'), children: _jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "3", y1: "6", x2: "21", y2: "6" }), _jsx("line", { x1: "3", y1: "12", x2: "21", y2: "12" }), _jsx("line", { x1: "3", y1: "18", x2: "15", y2: "18" })] }) })), hasChecklist && (_jsxs("span", { className: `todo-card__meta-chip${checkDone === checkTotal ? ' todo-card__meta-chip--done' : ''}`, children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M9 11l3 3L22 4" }), _jsx("path", { d: "M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" })] }), checkDone, "/", checkTotal] }))] })), isCalendar && hasDue && (_jsx("div", { className: "todo-card__meta", children: _jsxs("span", { className: "todo-card__meta-chip todo-card__meta-chip--due", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }), new Date(card.dueDate).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })] }) })), hasMembers && (_jsxs("div", { className: "todo-card__members", children: [participantIds.slice(0, 4).map((m) => {
                        const label = todoParticipantLabel(participantUserById, m);
                        return (_jsx("span", { className: "todo-card__avatar", title: label, children: todoInitialFromDisplayLabel(label) }, m));
                    }), participantIds.length > 4 && (_jsxs("span", { className: "todo-card__avatar todo-card__avatar--more", children: ["+", participantIds.length - 4] }))] })), ctxMenu && createPortal(_jsxs("div", { ref: ctxMenuRef, className: "todo-col-menu todo-card-ctx", role: "menu", style: { left: ctxMenu.x, top: ctxMenu.y, ...ctxMenuStyle }, onMouseDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(), children: [_jsxs("button", { type: "button", className: "todo-col-menu__item", role: "menuitem", onClick: () => { closeCtx(); onCardClick(columnId, card.id); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }), t('todoPage.column.cardOpen')] }), !isCalendar && !cardsReadOnly && (_jsxs("button", { type: "button", className: "todo-col-menu__item", role: "menuitem", onClick: () => { closeCtx(); onCardToggleComplete(columnId, card.id); }, children: [_jsx(IconCheck, {}), card.completed ? t('todoPage.column.unmarkDone') : t('todoPage.column.markDone')] })), _jsxs("button", { type: "button", className: "todo-col-menu__item", role: "menuitem", onClick: () => {
                            closeCtx();
                            void navigator.clipboard?.writeText(card.title);
                        }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }), _jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })] }), t('todoPage.column.cardCopyTitle')] }), !isCalendar && !cardsReadOnly && otherColumns.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "todo-col-menu__sep" }), _jsx("div", { className: "todo-col-menu__title", children: t('todoPage.column.cardMove') }), otherColumns.map((col) => (_jsxs("button", { type: "button", className: "todo-col-menu__item", role: "menuitem", onClick: () => { closeCtx(); onMoveCard(columnId, card.id, col.id); }, children: [_jsx("span", { className: "todo-card-ctx__dot", style: { background: 'var(--todo-accent)' } }), col.title] }, col.id)))] })), !isCalendar && !cardsReadOnly && (_jsxs(_Fragment, { children: [_jsx("div", { className: "todo-col-menu__sep" }), _jsxs("button", { type: "button", className: "todo-col-menu__item todo-col-menu__item--danger", role: "menuitem", onClick: () => { closeCtx(); onArchiveCard(columnId, card.id); }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 8v13H3V8" }), _jsx("path", { d: "M1 3h22v5H1z" }), _jsx("path", { d: "M10 12h4" })] }), t('todoPage.column.cardArchive')] })] }))] }), document.body)] }));
});
