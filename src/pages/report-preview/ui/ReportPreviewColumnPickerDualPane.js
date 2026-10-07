import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useRef, useState } from 'react';
const DND_MIME = 'application/x-tt-rp-col';
function parsePayload(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.id !== 'string')
            return null;
        if (parsed.from !== 'inactive' && parsed.from !== 'active')
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
function GripIcon() {
    return (_jsxs("svg", { className: "tt-rp-brief-columns__grip-ico", width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true, children: [_jsx("circle", { cx: "5", cy: "3.5", r: "1.2" }), _jsx("circle", { cx: "11", cy: "3.5", r: "1.2" }), _jsx("circle", { cx: "5", cy: "8", r: "1.2" }), _jsx("circle", { cx: "11", cy: "8", r: "1.2" }), _jsx("circle", { cx: "5", cy: "12.5", r: "1.2" }), _jsx("circle", { cx: "11", cy: "12.5", r: "1.2" })] }));
}
export function ReportPreviewColumnPickerDualPane(p) {
    const inactive = p.pool.filter((id) => !p.activeOrderedIds.includes(id));
    const [draggingId, setDraggingId] = useState(null);
    const [overTarget, setOverTarget] = useState(null);
    const dragRef = useRef(null);
    const uid = useId();
    const activateAt = (id, index) => {
        if (p.activeOrderedIds.includes(id))
            return;
        const next = [...p.activeOrderedIds];
        const clamped = Math.max(0, Math.min(index, next.length));
        next.splice(clamped, 0, id);
        p.onChange(next);
    };
    const deactivate = (id) => {
        if (p.activeOrderedIds.length <= 1)
            return;
        p.onChange(p.activeOrderedIds.filter((x) => x !== id));
    };
    const reorderActive = (id, toIndex) => {
        const from = p.activeOrderedIds.indexOf(id);
        if (from < 0)
            return;
        const next = [...p.activeOrderedIds];
        next.splice(from, 1);
        const clamped = Math.max(0, Math.min(toIndex > from ? toIndex - 1 : toIndex, next.length));
        next.splice(clamped, 0, id);
        p.onChange(next);
    };
    const onDragStart = (e, id, from) => {
        const payload = { id, from };
        dragRef.current = payload;
        setDraggingId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', id);
    };
    const onDragEnd = () => {
        dragRef.current = null;
        setDraggingId(null);
        setOverTarget(null);
    };
    const resolvePayload = (e) => {
        const raw = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain');
        if (raw) {
            const parsed = parsePayload(raw);
            if (parsed)
                return parsed;
            if (p.pool.includes(raw)) {
                const from = p.activeOrderedIds.includes(raw) ? 'active' : 'inactive';
                return { id: raw, from };
            }
        }
        return dragRef.current;
    };
    const onDragOverPane = (e, pane, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverTarget({ pane, index });
    };
    const onDropAt = (e, pane, index) => {
        e.preventDefault();
        const payload = resolvePayload(e);
        onDragEnd();
        if (!payload || !p.pool.includes(payload.id))
            return;
        if (pane === 'active') {
            if (payload.from === 'inactive')
                activateAt(payload.id, index);
            else
                reorderActive(payload.id, index);
            return;
        }
        if (payload.from === 'active')
            deactivate(payload.id);
    };
    const renderItem = (id, pane, index) => {
        const isActive = pane === 'active';
        const canRemove = !isActive || p.activeOrderedIds.length > 1;
        const isDragging = draggingId === id;
        const isOver = overTarget?.pane === pane && overTarget.index === index;
        return (_jsx("li", { className: `tt-rp-brief-columns__li${isDragging ? ' tt-rp-brief-columns__li--dragging' : ''}${isOver ? ' tt-rp-brief-columns__li--over' : ''}`, onDragOver: (e) => onDragOverPane(e, pane, index), onDrop: (e) => onDropAt(e, pane, index), children: _jsxs("div", { className: `tt-rp-brief-columns__item${isActive ? ' tt-rp-brief-columns__item--active' : ''}`, draggable: true, onDragStart: (e) => onDragStart(e, id, pane), onDragEnd: onDragEnd, children: [_jsx("span", { className: "tt-rp-brief-columns__grip", title: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435", "aria-hidden": true, children: _jsx(GripIcon, {}) }), _jsx("button", { type: "button", className: "tt-rp-brief-columns__item-main", onClick: () => {
                            if (isActive)
                                deactivate(id);
                            else
                                activateAt(id, p.activeOrderedIds.length);
                        }, disabled: isActive && !canRemove, title: isActive
                            ? (canRemove ? 'Убрать колонку из таблицы' : 'Должна остаться хотя бы одна колонка')
                            : 'Добавить колонку в таблицу', children: _jsx("span", { className: "tt-rp-brief-columns__item-label", children: p.labels[id] }) }), _jsx("button", { type: "button", className: "tt-rp-brief-columns__item-hint-btn", onClick: () => {
                            if (isActive)
                                deactivate(id);
                            else
                                activateAt(id, p.activeOrderedIds.length);
                        }, disabled: isActive && !canRemove, "aria-label": isActive ? `Убрать «${p.labels[id]}»` : `Добавить «${p.labels[id]}»`, children: _jsx("span", { className: "tt-rp-brief-columns__item-hint", "aria-hidden": true, children: isActive ? '×' : '→' }) })] }) }, id));
    };
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "tt-rp-brief-columns__hint", id: `${uid}-hint`, children: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438 \u043C\u0435\u0436\u0434\u0443 \u0441\u043F\u0438\u0441\u043A\u0430\u043C\u0438 \u0438\u043B\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u00AB\u0412 \u0442\u0430\u0431\u043B\u0438\u0446\u0435\u00BB, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u043E\u0440\u044F\u0434\u043E\u043A. \u041C\u043E\u0436\u043D\u043E \u0442\u0430\u043A\u0436\u0435 \u043D\u0430\u0436\u0430\u0442\u044C \u043F\u0443\u043D\u043A\u0442." }), _jsxs("div", { className: "tt-rp-brief-columns__panes", "aria-describedby": `${uid}-hint`, children: [_jsxs("div", { className: `tt-rp-brief-columns__pane${overTarget?.pane === 'inactive' ? ' tt-rp-brief-columns__pane--drop' : ''}`, onDragOver: (e) => onDragOverPane(e, 'inactive', 0), onDrop: (e) => onDropAt(e, 'inactive', 0), children: [_jsx("span", { className: "tt-rp-brief-columns__pane-label", children: "\u041D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442\u0441\u044F" }), _jsxs("ul", { className: "tt-rp-brief-columns__list", role: "listbox", "aria-label": "\u0421\u043A\u0440\u044B\u0442\u044B\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438", children: [inactive.length === 0 ? (_jsx("li", { className: "tt-rp-brief-columns__empty", children: "\u0412\u0441\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u044B" })) : (inactive.map((id, index) => renderItem(id, 'inactive', index))), _jsx("li", { className: `tt-rp-brief-columns__dropzone${overTarget?.pane === 'inactive' && overTarget.index >= inactive.length ? ' tt-rp-brief-columns__dropzone--over' : ''}`, "aria-hidden": true, onDragOver: (e) => onDragOverPane(e, 'inactive', inactive.length), onDrop: (e) => onDropAt(e, 'inactive', inactive.length) })] })] }), _jsx("div", { className: "tt-rp-brief-columns__divider", "aria-hidden": true }), _jsxs("div", { className: `tt-rp-brief-columns__pane tt-rp-brief-columns__pane--active${overTarget?.pane === 'active' ? ' tt-rp-brief-columns__pane--drop' : ''}`, onDragOver: (e) => onDragOverPane(e, 'active', p.activeOrderedIds.length), onDrop: (e) => onDropAt(e, 'active', p.activeOrderedIds.length), children: [_jsx("span", { className: "tt-rp-brief-columns__pane-label", children: "\u0412 \u0442\u0430\u0431\u043B\u0438\u0446\u0435" }), _jsxs("ul", { className: "tt-rp-brief-columns__list", role: "listbox", "aria-label": "\u0412\u0438\u0434\u0438\u043C\u044B\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438", children: [p.activeOrderedIds.map((id, index) => renderItem(id, 'active', index)), _jsx("li", { className: `tt-rp-brief-columns__dropzone${overTarget?.pane === 'active' && overTarget.index >= p.activeOrderedIds.length ? ' tt-rp-brief-columns__dropzone--over' : ''}`, "aria-hidden": true, onDragOver: (e) => onDragOverPane(e, 'active', p.activeOrderedIds.length), onDrop: (e) => onDropAt(e, 'active', p.activeOrderedIds.length) })] })] })] })] }));
}
