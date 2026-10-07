import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from 'react';
import { useInventory } from '../model';
import { InvSelect } from './InvSelect';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import { EquipmentScoreBadge } from './EquipmentScoreBadge';
import { LIMIT } from '../model/constants';
import { AuthImg, Pagination } from '@shared/ui';
import { EQUIPMENT_SCORE_MAX, EQUIPMENT_SCORE_POINTS, exportInventoryCategoryToExcel, laptopRamUpgrade } from '@entities/inventory';
export function InventoryItemsSection() {
    const { canEdit, canCreateItems, categories, statuses, users, items, loadingItems, filterCategoryId, setFilterCategoryId, filterStatus, setFilterStatus, filterScore, setFilterScore, scoreSort, setScoreSort, filterAssignedTo, setFilterAssignedTo, includeArchived, setIncludeArchived, skip, setSkip, itemsTotal, setItemModal, resetItemForm, setFormError, categoryById, statusLabel, } = useInventory();
    const [viewItem, setViewItem] = useState(null);
    const [excelBusy, setExcelBusy] = useState(false);
    const [excelErr, setExcelErr] = useState(null);
    const page = Math.floor(skip / LIMIT) + 1;
    const selectedCategory = typeof filterCategoryId === 'number'
        ? categories.find((c) => c.id === filterCategoryId) ?? null
        : null;
    const handleExportExcel = useCallback(async () => {
        if (!selectedCategory || excelBusy)
            return;
        setExcelBusy(true);
        setExcelErr(null);
        try {
            await exportInventoryCategoryToExcel({
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
                status: filterStatus || undefined,
                includeArchived,
                assignedToUserId: filterAssignedTo === '' ? null : filterAssignedTo,
                statusLabel,
                userLabel: (userId) => {
                    if (userId == null)
                        return '';
                    const u = users.find((x) => x.id === userId);
                    return u ? (u.display_name || u.email || String(userId)) : String(userId);
                },
            });
        }
        catch (err) {
            setExcelErr(err instanceof Error ? err.message : 'Не удалось выгрузить Excel');
        }
        finally {
            setExcelBusy(false);
        }
    }, [selectedCategory, excelBusy, filterStatus, includeArchived, filterAssignedTo, statusLabel, users]);
    return (_jsxs("section", { className: "inv__card", children: [_jsxs("div", { className: "inv__card-head", children: [_jsxs("h2", { className: "inv__card-title", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "7", width: "20", height: "14", rx: "2" }), _jsx("path", { d: "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" })] }), "\u041F\u043E\u0437\u0438\u0446\u0438\u0438"] }), _jsxs("div", { className: "inv__card-head-right", children: [_jsx("span", { className: "inv__card-count", children: itemsTotal }), _jsxs("button", { type: "button", className: "inv__btn inv__btn--ghost", disabled: !selectedCategory || excelBusy, "aria-busy": excelBusy, title: selectedCategory
                                    ? `Выгрузить Excel: ${selectedCategory.name}`
                                    : 'Сначала выберите категорию в фильтре', onClick: () => { void handleExportExcel(); }, children: [_jsxs("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "8", y1: "13", x2: "16", y2: "13" }), _jsx("line", { x1: "8", y1: "17", x2: "16", y2: "17" })] }), excelBusy ? 'Excel…' : 'Excel'] }), canCreateItems && (_jsx("button", { type: "button", className: "inv__btn inv__btn--primary", onClick: () => {
                                    setItemModal('add');
                                    resetItemForm();
                                    setFormError(null);
                                }, children: "+ \u041F\u043E\u0437\u0438\u0446\u0438\u044F" }))] })] }), excelErr ? _jsx("p", { className: "inv__export-err", role: "alert", children: excelErr }) : null, _jsxs("div", { className: "inv__toolbar", children: [_jsxs("div", { className: "inv__toolbar-group", children: [_jsxs("label", { className: "inv__field", children: [_jsx("span", { className: "inv__field-label", children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx(InvSelect, { value: filterCategoryId === '' ? '' : filterCategoryId, placeholder: "\u0412\u0441\u0435", options: categories.map((c) => ({ value: c.id, label: c.name })), onChange: (v) => {
                                            setFilterCategoryId(v === '' ? '' : Number(v));
                                            setSkip(0);
                                            setExcelErr(null);
                                        } })] }), _jsxs("label", { className: "inv__field", children: [_jsx("span", { className: "inv__field-label", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx(InvSelect, { value: filterStatus, placeholder: "\u0412\u0441\u0435", options: statuses.map((s) => ({ value: s.value, label: s.label })), onChange: (v) => {
                                            setFilterStatus(String(v));
                                            setSkip(0);
                                        } })] }), _jsxs("label", { className: "inv__field", children: [_jsx("span", { className: "inv__field-label", children: "\u041E\u0446\u0435\u043D\u043A\u0430 (\u0431\u0430\u043B\u043B\u044B)" }), _jsx(InvSelect, { value: filterScore === '' ? '' : filterScore, placeholder: "\u0412\u0441\u0435", options: EQUIPMENT_SCORE_POINTS.map((score) => ({
                                            value: score,
                                            label: `${score}/${EQUIPMENT_SCORE_MAX}`,
                                        })), onChange: (v) => {
                                            setFilterScore(v === '' ? '' : Number(v));
                                            setSkip(0);
                                        } })] }), _jsxs("label", { className: "inv__field", children: [_jsx("span", { className: "inv__field-label", children: "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430" }), _jsx(InvSelect, { value: scoreSort, placeholder: "\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E", options: [
                                            { value: 'desc', label: 'Баллы ↓ по убыванию' },
                                            { value: 'asc', label: 'Баллы ↑ по возрастанию' },
                                        ], onChange: (v) => {
                                            const next = v === 'asc' || v === 'desc' ? v : '';
                                            setScoreSort(next);
                                            setSkip(0);
                                        } })] }), canEdit && users.length > 0 && (_jsxs("label", { className: "inv__field", children: [_jsx("span", { className: "inv__field-label", children: "\u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E \u0437\u0430" }), _jsx(InvSelect, { value: filterAssignedTo === '' ? '' : filterAssignedTo, placeholder: "\u0412\u0441\u0435", options: users.map((u) => ({ value: u.id, label: u.display_name || u.email })), onChange: (v) => {
                                            setFilterAssignedTo(v === '' ? '' : Number(v));
                                            setSkip(0);
                                        } })] }))] }), _jsxs("label", { className: "inv__switch-label", children: [_jsxs("span", { className: "switch", children: [_jsx("input", { type: "checkbox", className: "switch__input", checked: includeArchived, onChange: (e) => {
                                            setIncludeArchived(e.target.checked);
                                            setSkip(0);
                                        } }), _jsx("span", { className: "switch__track", children: _jsx("span", { className: "switch__thumb" }) })] }), _jsx("span", { children: "\u0421 \u0430\u0440\u0445\u0438\u0432\u043E\u043C" })] })] }), loadingItems ? (_jsx("div", { className: "inv__table-wrap inv__table-wrap--skeleton", children: _jsxs("table", { className: "inv__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "inv__col inv__col--name", children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { className: "inv__col inv__col--cat", children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx("th", { className: "inv__col inv__col--score", children: "\u041E\u0446\u0435\u043D\u043A\u0430" }), _jsx("th", { className: "inv__col inv__col--invno", children: "\u0418\u043D\u0432. \u043D\u043E\u043C\u0435\u0440" }), _jsx("th", { className: "inv__col inv__col--status", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { className: "inv__col inv__col--assigned", children: "\u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E \u0437\u0430" }), _jsx("th", { className: "inv__col inv__col--open" })] }) }), _jsx("tbody", { children: Array.from({ length: 4 }).map((_, i) => (_jsxs("tr", { children: [_jsx("td", { className: "inv__col inv__col--name", "data-label": "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", children: _jsx("span", { className: "inv__skel inv__skel--lg" }) }), _jsx("td", { className: "inv__col inv__col--cat", "data-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", children: _jsx("span", { className: "inv__skel" }) }), _jsx("td", { className: "inv__col inv__col--score", "data-label": "\u041E\u0446\u0435\u043D\u043A\u0430", children: _jsx("span", { className: "inv__skel-pill" }) }), _jsx("td", { className: "inv__col inv__col--invno", "data-label": "\u0418\u043D\u0432. \u043D\u043E\u043C\u0435\u0440", children: _jsx("span", { className: "inv__skel" }) }), _jsx("td", { className: "inv__col inv__col--status", "data-label": "\u0421\u0442\u0430\u0442\u0443\u0441", children: _jsx("span", { className: "inv__skel-pill" }) }), _jsx("td", { className: "inv__col inv__col--assigned", "data-label": "\u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E \u0437\u0430", children: _jsx("span", { className: "inv__skel inv__skel--md" }) }), _jsx("td", { className: "inv__col inv__col--open", "data-label": "" })] }, i))) })] }) })) : items.length === 0 && skip === 0 ? (_jsxs("div", { className: "inv__empty", children: [_jsx("p", { children: "\u041D\u0435\u0442 \u043F\u043E\u0437\u0438\u0446\u0438\u0439" }), canCreateItems && (_jsx("button", { type: "button", className: "inv__btn inv__btn--ghost", onClick: () => {
                            setItemModal('add');
                            resetItemForm();
                        }, children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0435\u0440\u0432\u0443\u044E" }))] })) : items.length === 0 && skip > 0 ? (_jsx("div", { className: "inv__empty", children: _jsx("p", { children: "\u0414\u0430\u043B\u044C\u0448\u0435 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u043D\u0435\u0442 \u2014 \u0432\u0435\u0440\u043D\u0438\u0442\u0435\u0441\u044C \u043D\u0430\u0437\u0430\u0434." }) })) : (_jsx("div", { className: "inv__table-wrap", children: _jsxs("table", { className: "inv__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "inv__col inv__col--name", children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { className: "inv__col inv__col--cat", children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx("th", { className: "inv__col inv__col--score", children: "\u041E\u0446\u0435\u043D\u043A\u0430" }), _jsx("th", { className: "inv__col inv__col--invno", children: "\u0418\u043D\u0432. \u043D\u043E\u043C\u0435\u0440" }), _jsx("th", { className: "inv__col inv__col--status", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { className: "inv__col inv__col--assigned", children: "\u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E \u0437\u0430" }), _jsx("th", { className: "inv__col inv__col--open" })] }) }), _jsx("tbody", { children: items.map((item) => {
                                const cat = categoryById(item.category_id);
                                const assigned = users.find((u) => u.id === item.assigned_to_user_id);
                                const ramUpgrade = laptopRamUpgrade({ ...item, categoryName: cat?.name });
                                return (_jsxs("tr", { className: `inv__row--clickable${item.is_archived ? ' inv__row--dim' : ''}`, onClick: () => setViewItem(item), children: [_jsx("td", { className: "inv__col inv__col--name", "data-label": "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", children: _jsxs("div", { className: "inv__name-cell", children: [item.photo_path ? (_jsx("span", { className: "inv__thumb", children: _jsx(AuthImg, { mediaPath: item.photo_path, alt: "" }) })) : (_jsx("span", { className: "inv__thumb inv__thumb--placeholder", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "7", width: "20", height: "14", rx: "2" }), _jsx("path", { d: "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" })] }) })), _jsxs("div", { className: "inv__name-body", children: [_jsx("div", { className: "inv__name-title", children: item.name }), (ramUpgrade?.canAddRam || item.description) ? (_jsxs("div", { className: "inv__name-meta", children: [ramUpgrade?.canAddRam ? (_jsx("span", { className: "inv__ram-badge", title: ramUpgrade.hint, children: "\u0421\u043B\u043E\u0442 \u041E\u0417\u0423" })) : null, item.description ? (_jsxs("span", { className: "inv__name-hint", title: item.description, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), _jsx("line", { x1: "16", y1: "17", x2: "8", y2: "17" })] }), "\u0417\u0430\u043C\u0435\u0442\u043A\u0438"] })) : null] })) : null] })] }) }), _jsx("td", { className: "inv__col inv__col--cat", "data-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", children: _jsx("span", { className: "inv__cat-tag", children: cat?.name ?? '—' }) }), _jsx("td", { className: "inv__col inv__col--score", "data-label": "\u041E\u0446\u0435\u043D\u043A\u0430", children: _jsx(EquipmentScoreBadge, { item: item, compact: true }) }), _jsx("td", { className: "inv__col inv__col--invno", "data-label": "\u0418\u043D\u0432. \u043D\u043E\u043C\u0435\u0440", children: _jsx("span", { className: "inv__invno", title: item.inventory_number, children: item.inventory_number }) }), _jsx("td", { className: "inv__col inv__col--status", "data-label": "\u0421\u0442\u0430\u0442\u0443\u0441", children: _jsx("span", { className: `inv__status inv__status--${item.status}`, children: statusLabel(item.status) }) }), _jsx("td", { className: "inv__col inv__col--assigned", "data-label": "\u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E \u0437\u0430", children: assigned ? (_jsxs("span", { className: "inv__assignee", title: assigned.display_name || assigned.email, children: [_jsx("span", { className: "inv__assignee-av", "aria-hidden": true, children: (assigned.display_name || assigned.email || '?').trim().charAt(0).toUpperCase() }), _jsx("span", { className: "inv__assignee-name", children: assigned.display_name || assigned.email })] })) : _jsx("span", { className: "inv__assignee inv__assignee--empty", children: "\u041D\u0435 \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E" }) }), _jsx("td", { className: "inv__col inv__col--open", "data-label": "", onClick: (e) => e.stopPropagation(), children: _jsx("button", { type: "button", className: "inv__open-btn", onClick: () => setViewItem(item), "aria-label": "\u041F\u043E\u0434\u0440\u043E\u0431\u043D\u0435\u0435", title: "\u041F\u043E\u0434\u0440\u043E\u0431\u043D\u0435\u0435", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }) }) })] }, item.uuid));
                            }) })] }) })), _jsx(Pagination, { page: page, totalCount: itemsTotal, pageSize: LIMIT, loading: loadingItems, onPageChange: (next) => setSkip((next - 1) * LIMIT), className: "inv__pager" }), viewItem && (_jsx(ItemDetailDrawer, { item: viewItem, onClose: () => setViewItem(null) }))] }));
}
