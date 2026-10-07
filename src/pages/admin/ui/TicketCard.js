import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatDateOnly } from '@shared/lib/formatDate';
function getStatusKey(status) {
    const lower = status.toLowerCase();
    if (lower.includes('закрыт') || lower.includes('решен'))
        return 'done';
    if (lower.includes('невозможно') || lower.includes('отклон') || lower.includes('отмен'))
        return 'cancel';
    return 'open';
}
export function TicketCard({ ticket, onOpenDetails }) {
    const sKey = getStatusKey(ticket.status);
    return (_jsxs("article", { className: `ap__ticket-card ap__ticket-card--${sKey}`, children: [_jsxs("div", { className: "ap__ticket-card-header", children: [_jsx("button", { type: "button", className: "ap__ticket-card-theme", onClick: () => onOpenDetails(ticket), children: ticket.theme }), _jsx("span", { className: `ap__pill ap__pill--${sKey}`, children: ticket.status })] }), _jsxs("div", { className: "ap__ticket-card-body", children: [_jsxs("div", { className: "ap__ticket-card-row", children: [_jsx("span", { className: "ap__ticket-card-lbl", children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx("span", { children: ticket.category })] }), _jsxs("div", { className: "ap__ticket-card-row", children: [_jsx("span", { className: "ap__ticket-card-lbl", children: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442" }), _jsx("span", { children: ticket.priority })] })] }), _jsx("div", { className: "ap__ticket-card-meta", children: formatDateOnly(ticket.created_at) })] }));
}
