import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadInventoryItemCard, resolveEquipmentScore, laptopRamUpgrade, isMonitorCategory, parseMonitorDescription, monitorSpecsSummary, hasMonitorSpecs, } from '@entities/inventory';
import { useInventory } from '../model';
import { AuthImg } from '@shared/ui';
import { EquipmentScoreBadge } from './EquipmentScoreBadge';
import { formatDateOnly } from '@shared/lib/formatDate';
const EXPORT_FORMAT_OPTIONS = [
    { format: 'pdf', label: 'PDF', hint: 'С фото' },
    { format: 'docx', label: 'Word', hint: 'С фото' },
    { format: 'txt', label: 'TXT', hint: 'Только текст' },
];
export function ItemDetailDrawer({ item, onClose }) {
    const { canEdit, users, categoryById, statusLabel, openEditItem, handleUnassign, handleArchive, setDeleteTarget, setAssignModal, setAssignUserId, setFormError, } = useInventory();
    const cat = categoryById(item.category_id);
    const assigned = users.find((u) => u.id === item.assigned_to_user_id);
    const itemScore = resolveEquipmentScore(item);
    const ramUpgrade = laptopRamUpgrade({ ...item, categoryName: cat?.name });
    const monitorParsed = isMonitorCategory(cat?.name) ? parseMonitorDescription(item.description) : null;
    const monitorSummary = monitorParsed && hasMonitorSpecs(monitorParsed.specs)
        ? monitorSpecsSummary(monitorParsed.specs)
        : [];
    const freeNotes = monitorParsed ? monitorParsed.notes : (item.description?.trim() || '');
    const [downloadBusy, setDownloadBusy] = useState(false);
    const [downloadErr, setDownloadErr] = useState(null);
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const downloadWrapRef = useRef(null);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape')
                return;
            if (downloadMenuOpen) {
                setDownloadMenuOpen(false);
                return;
            }
            onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, downloadMenuOpen]);
    useEffect(() => {
        if (!downloadMenuOpen)
            return;
        const handleClick = (e) => {
            if (downloadWrapRef.current && !downloadWrapRef.current.contains(e.target))
                setDownloadMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [downloadMenuOpen]);
    const handleDownload = useCallback(async (format) => {
        if (downloadBusy)
            return;
        setDownloadMenuOpen(false);
        setDownloadBusy(true);
        setDownloadErr(null);
        try {
            await downloadInventoryItemCard({
                item,
                categoryName: cat?.name ?? null,
                assignedLabel: assigned
                    ? (assigned.display_name || assigned.email)
                    : null,
                statusLabel: statusLabel(item.status),
            }, format);
        }
        catch (err) {
            setDownloadErr(err instanceof Error ? err.message : 'Не удалось скачать карточку');
        }
        finally {
            setDownloadBusy(false);
        }
    }, [downloadBusy, item, cat?.name, assigned, statusLabel]);
    const content = (_jsx("div", { className: "inv-drawer__overlay", role: "dialog", "aria-modal": "true", children: _jsxs("aside", { className: "inv-drawer", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "inv-drawer__header", children: [_jsxs("div", { className: "inv-drawer__header-left", children: [_jsx("h3", { className: "inv-drawer__title", children: item.name }), item.is_archived && _jsx("span", { className: "inv-drawer__archived-badge", children: "\u0412 \u0430\u0440\u0445\u0438\u0432\u0435" })] }), _jsx("button", { className: "inv-drawer__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "inv-drawer__body", children: [item.photo_path && (_jsx("div", { className: "inv-drawer__photo-wrap", children: _jsx(AuthImg, { mediaPath: item.photo_path, alt: item.name, className: "inv-drawer__photo", fallback: _jsx("span", { className: "inv-drawer__photo-loading", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0444\u043E\u0442\u043E\u2026" }) }) })), _jsxs("div", { className: "inv-drawer__status-row", children: [_jsx("span", { className: `inv__status inv__status--${item.status}`, children: statusLabel(item.status) }), ramUpgrade?.canAddRam ? (_jsx("span", { className: "inv__ram-badge", title: ramUpgrade.hint, children: "\u041C\u043E\u0436\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u041E\u0417\u0423" })) : null] }), _jsxs("div", { className: "inv-drawer__grid", children: [_jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx("span", { className: "inv-drawer__field-value", children: cat?.name ?? '—' })] }), _jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u041E\u0446\u0435\u043D\u043A\u0430 \u0442\u0435\u0445\u043D\u0438\u043A\u0438" }), _jsxs("span", { className: "inv-drawer__field-value inv-drawer__field-value--score", children: [_jsx(EquipmentScoreBadge, { item: item }), itemScore ? (_jsxs("span", { className: "inv-drawer__score-hint", children: [itemScore.tier.summary, itemScore.source === 'purchase_date'
                                                            ? ' · по дате покупки'
                                                            : ' · приблизительно, дата покупки не указана'] })) : null] })] }), _jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0418\u043D\u0432. \u043D\u043E\u043C\u0435\u0440" }), _jsx("span", { className: "inv-drawer__field-value inv-drawer__field-value--mono", children: item.inventory_number })] }), _jsxs("div", { className: "inv-drawer__field inv-drawer__field--full", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440" }), _jsx("span", { className: "inv-drawer__field-value inv-drawer__field-value--mono", children: item.serial_number?.trim() || '—' })] }), _jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E \u0437\u0430" }), _jsx("span", { className: "inv-drawer__field-value", children: assigned ? (assigned.display_name || assigned.email) : '—' })] }), item.assigned_at && (_jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F" }), _jsx("span", { className: "inv-drawer__field-value", children: formatDateOnly(item.assigned_at) })] })), _jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0414\u0430\u0442\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0438" }), _jsx("span", { className: "inv-drawer__field-value", children: formatDateOnly(item.purchase_date) || '—' })] }), _jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0413\u0430\u0440\u0430\u043D\u0442\u0438\u044F \u0434\u043E" }), _jsx("span", { className: "inv-drawer__field-value", children: formatDateOnly(item.warranty_until) || '—' })] }), _jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430" }), _jsx("span", { className: "inv-drawer__field-value", children: formatDateOnly(item.created_at) })] }), _jsxs("div", { className: "inv-drawer__field", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430" }), _jsx("span", { className: "inv-drawer__field-value", children: formatDateOnly(item.updated_at) })] })] }), monitorSummary.length > 0 && (_jsxs("div", { className: "inv-drawer__desc-section", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0430" }), _jsx("div", { className: "inv-drawer__monitor-chips", children: monitorSummary.map((chip) => (_jsx("span", { className: "inv-drawer__monitor-chip", children: chip }, chip))) }), monitorParsed?.specs.vesa === 'no' ? (_jsx("p", { className: "inv-drawer__score-hint", children: "\u0411\u0435\u0437 \u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F VESA" })) : null] })), freeNotes ? (_jsxs("div", { className: "inv-drawer__desc-section", children: [_jsx("span", { className: "inv-drawer__field-label", children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 / \u0417\u0430\u043C\u0435\u0442\u043A\u0438" }), _jsx("p", { className: "inv-drawer__desc", children: freeNotes })] })) : null] }), _jsxs("div", { className: "inv-drawer__footer", children: [_jsxs("div", { className: "inv-drawer__download", ref: downloadWrapRef, children: [_jsxs("button", { type: "button", className: "inv__btn inv__btn--ghost inv-drawer__action", onClick: () => {
                                        if (!downloadBusy)
                                            setDownloadMenuOpen((open) => !open);
                                    }, disabled: downloadBusy, "aria-busy": downloadBusy, "aria-expanded": downloadMenuOpen, "aria-haspopup": "menu", title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0442\u0435\u0445\u043D\u0438\u043A\u0438", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }), downloadBusy ? 'Скачивание…' : 'Скачать', _jsx("svg", { className: "inv-drawer__download-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("polyline", { points: "6 9 12 15 18 9" }) })] }), downloadMenuOpen && !downloadBusy ? (_jsx("div", { className: "inv-drawer__download-menu", role: "menu", children: EXPORT_FORMAT_OPTIONS.map((opt) => (_jsxs("button", { type: "button", role: "menuitem", className: "inv-drawer__download-option", onClick: () => { void handleDownload(opt.format); }, children: [_jsx("span", { className: "inv-drawer__download-option-label", children: opt.label }), _jsx("span", { className: "inv-drawer__download-option-hint", children: opt.hint })] }, opt.format))) })) : null] }), downloadErr ? _jsx("p", { className: "inv-drawer__download-err", role: "alert", children: downloadErr }) : null, canEdit ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "inv__btn inv__btn--ghost inv-drawer__action", onClick: () => { openEditItem(item); onClose(); }, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }), "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C"] }), item.assigned_to_user_id ? (_jsxs("button", { type: "button", className: "inv__btn inv__btn--ghost inv-drawer__action", onClick: () => handleUnassign(item), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "12", cy: "7", r: "4" }), _jsx("line", { x1: "18", y1: "11", x2: "23", y2: "11" })] }), "\u041E\u0442\u043A\u0440\u0435\u043F\u0438\u0442\u044C"] })) : (_jsxs("button", { type: "button", className: "inv__btn inv__btn--ghost inv-drawer__action", onClick: () => {
                                        setAssignModal(item);
                                        setAssignUserId('');
                                        setFormError(null);
                                    }, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "12", cy: "7", r: "4" }), _jsx("line", { x1: "19", y1: "8", x2: "19", y2: "14" }), _jsx("line", { x1: "22", y1: "11", x2: "16", y2: "11" })] }), "\u0417\u0430\u043A\u0440\u0435\u043F\u0438\u0442\u044C"] })), _jsxs("button", { type: "button", className: "inv__btn inv__btn--ghost inv-drawer__action", onClick: () => handleArchive(item, !item.is_archived), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "21 8 21 21 3 21 3 8" }), _jsx("rect", { x: "1", y: "3", width: "22", height: "5" }), _jsx("line", { x1: "10", y1: "12", x2: "14", y2: "12" })] }), item.is_archived ? 'Восстановить' : 'В архив'] }), _jsxs("button", { type: "button", className: "inv__btn inv__btn--danger inv-drawer__action", onClick: () => {
                                        setDeleteTarget({ type: 'item', uuid: item.uuid });
                                        onClose();
                                    }, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6l-1 14H6L5 6" }), _jsx("path", { d: "M10 11v6M14 11v6" }), _jsx("path", { d: "M9 6V4h6v2" })] }), "\u0423\u0434\u0430\u043B\u0438\u0442\u044C"] })] })) : null] })] }) }));
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
