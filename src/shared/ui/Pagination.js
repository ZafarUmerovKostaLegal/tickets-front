import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './Pagination.css';
const DEFAULT_LIST_PAGE_SIZE = 24;
export function Pagination({ page, totalCount, pageSize = DEFAULT_LIST_PAGE_SIZE, onPageChange, loading, className = '', }) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (totalCount <= pageSize)
        return null;
    return (_jsxs("nav", { className: `tt-list-pagination${className ? ` ${className}` : ''}`, "aria-label": "\u041F\u043E\u0441\u0442\u0440\u0430\u043D\u0438\u0447\u043D\u0430\u044F \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F", children: [_jsx("button", { type: "button", className: "tt-list-pagination__btn", disabled: loading || page <= 1, onClick: () => onPageChange(page - 1), children: "\u041D\u0430\u0437\u0430\u0434" }), _jsxs("span", { className: "tt-list-pagination__meta", children: ["\u0421\u0442\u0440. ", page, " \u0438\u0437 ", totalPages, _jsxs("span", { className: "tt-list-pagination__count", children: [" \u00B7 ", totalCount, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439"] })] }), _jsx("button", { type: "button", className: "tt-list-pagination__btn", disabled: loading || page >= totalPages, onClick: () => onPageChange(page + 1), children: "\u0412\u043F\u0435\u0440\u0451\u0434" })] }));
}
