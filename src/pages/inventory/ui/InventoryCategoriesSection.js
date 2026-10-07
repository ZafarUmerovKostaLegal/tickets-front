import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useInventory } from '../model';
export function InventoryCategoriesSection() {
    const { canManageCats, loadingCat, sortedCategories, countByCategory, filterCategoryId, setFilterCategoryId, setCategoryModal, setCategoryForm, setFormError, setDeleteTarget, } = useInventory();
    if (!canManageCats)
        return null;
    return (_jsxs("section", { className: "inv__card", children: [_jsxs("div", { className: "inv__card-head", children: [_jsxs("h2", { className: "inv__card-title", children: [_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }) }), "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438"] }), _jsx("button", { type: "button", className: "inv__btn inv__btn--primary", onClick: () => {
                            setCategoryModal('add');
                            setCategoryForm({ name: '', description: '' });
                            setFormError(null);
                        }, children: "+ \u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" })] }), loadingCat ? (_jsx("div", { className: "inv__cats inv__cats--skeleton", children: Array.from({ length: 4 }).map((_, i) => (_jsxs("div", { className: "inv__cat inv__cat--skeleton", children: [_jsxs("div", { className: "inv__cat-top", children: [_jsx("span", { className: "inv__skel inv__skel--lg" }), _jsx("span", { className: "inv__skel inv__skel--sm" })] }), _jsx("span", { className: "inv__skel inv__skel--md", style: { width: '80%', marginTop: '0.5rem' } }), _jsxs("div", { className: "inv__cat-actions", style: { marginTop: '0.75rem' }, children: [_jsx("span", { className: "inv__skel inv__skel--sm", style: { width: 70 } }), _jsx("span", { className: "inv__skel inv__skel--sm", style: { width: 70 } })] })] }, i))) })) : sortedCategories.length === 0 ? (_jsx("div", { className: "inv__empty", children: _jsx("p", { children: "\u041D\u0435\u0442 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439" }) })) : (_jsx("div", { className: "inv__cats", children: sortedCategories.map((c) => {
                    const count = countByCategory[c.id] ?? 0;
                    const isActive = filterCategoryId === c.id;
                    return (_jsxs("div", { className: `inv__cat${isActive ? ' inv__cat--active' : ''}`, children: [_jsxs("div", { className: "inv__cat-top", children: [_jsx("button", { type: "button", className: "inv__cat-name", onClick: () => setFilterCategoryId(isActive ? '' : c.id), children: c.name }), _jsx("span", { className: "inv__cat-badge", children: count })] }), _jsx("p", { className: "inv__cat-desc", children: c.description || '—' }), _jsxs("div", { className: "inv__cat-actions", children: [_jsx("button", { type: "button", className: "inv__mini-btn", onClick: () => {
                                            setCategoryModal({ id: c.id });
                                            setCategoryForm({ name: c.name, description: c.description || '' });
                                            setFormError(null);
                                        }, children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "inv__mini-btn inv__mini-btn--danger", onClick: () => setDeleteTarget({ type: 'category', id: c.id }), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }, c.id));
                }) }))] }));
}
