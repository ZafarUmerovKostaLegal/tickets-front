import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { useInventory } from '../model';
export function DeleteConfirmModal() {
    const { deleteTarget, setDeleteTarget, formError, submitting, handleDeleteCategory, handleDeleteItem, } = useInventory();
    if (!deleteTarget)
        return null;
    const content = (_jsx("div", { className: "inv__overlay", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "inv__modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "inv__modal-head", children: [_jsx("h3", { className: "inv__modal-title", children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C?" }), _jsx("button", { type: "button", className: "inv__modal-close", onClick: () => setDeleteTarget(null), children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), formError && _jsx("p", { className: "inv__form-err", children: formError }), _jsxs("p", { className: "inv__modal-desc", children: [deleteTarget.type === 'category'
                            ? `Категорию с id ${deleteTarget.id}`
                            : 'Эту позицию', ' ', "\u043D\u0435\u043B\u044C\u0437\u044F \u0431\u0443\u0434\u0435\u0442 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C."] }), _jsxs("div", { className: "inv__modal-foot", children: [_jsx("button", { type: "button", className: "inv__btn inv__btn--ghost", onClick: () => setDeleteTarget(null), disabled: submitting, children: "\u041D\u0435\u0442" }), _jsx("button", { type: "button", className: "inv__btn inv__btn--danger", disabled: submitting, onClick: () => deleteTarget.type === 'category'
                                ? handleDeleteCategory(deleteTarget.id)
                                : handleDeleteItem(deleteTarget.uuid), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }) }));
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
