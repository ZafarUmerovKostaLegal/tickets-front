import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { KOSTA_LEGAL_LETTERHEAD_LINES } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { coverLetterheadLogoUrl } from '@pages/invoice-preview/lib/invoiceCoverLogoRaster';
import { combinedTimeTaskAndNotes } from '../lib/combinedInvoice';
function money(n) {
    const [whole, frac] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
}
function fmtHours(n) {
    return n.toFixed(2);
}
function initialsOf(name, stored) {
    const saved = stored?.trim();
    if (saved)
        return saved;
    const letters = name.split(/\s+/).filter(Boolean).map((part) => part[0] ?? '').join('');
    return letters.toUpperCase().slice(0, 4) || '—';
}
function dateRu(iso) {
    const day = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return iso;
    const [y, m, d] = day.split('-');
    return `${d}.${m}.${y}`;
}
export function CombinedInvoiceDocument({ feeTitle, payerName, from, to, currency, time, expenses, shares, users, totalHours, totalFees, totalExp, onClose, }) {
    const userById = new Map(users.map((user) => [user.id, user]));
    const summary = new Map();
    for (const line of time) {
        const prev = summary.get(line.authUserId) ?? { hours: 0, amount: 0 };
        prev.hours += line.billableHours ?? line.hours;
        prev.amount += line.billableAmount;
        summary.set(line.authUserId, prev);
    }
    const people = [...summary.entries()].map(([id, totals]) => {
        const user = userById.get(id);
        const rate = totals.hours > 0 ? totals.amount / totals.hours : 0;
        return {
            id,
            initials: initialsOf(user?.display_name?.trim() || user?.email?.trim() || String(id), user?.initials),
            name: user?.display_name?.trim() || user?.email?.trim() || String(id),
            title: user?.position?.trim() || '—',
            hours: totals.hours,
            rate,
            amount: totals.amount,
        };
    });
    const lead = feeTitle.trim()
        || `Fees for services ${dateRu(from)} — ${dateRu(to)} for ${payerName}`;
    return (_jsxs("div", { className: "tt-inv-cdoc-overlay", role: "dialog", "aria-modal": "true", "aria-label": "\u0421\u0432\u043E\u0434\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442", children: [_jsxs("div", { className: "tt-inv-cdoc-toolbar", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => window.print(), children: "\u041F\u0435\u0447\u0430\u0442\u044C / PDF" }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })] }), _jsxs("article", { className: "tt-inv-cdoc", children: [_jsxs("header", { className: "tt-inv-cdoc__head", children: [_jsx("img", { className: "tt-inv-cdoc__logo", src: coverLetterheadLogoUrl(), alt: "KOSTA LEGAL" }), _jsx("address", { children: KOSTA_LEGAL_LETTERHEAD_LINES.map((line) => _jsx("span", { children: line }, line)) })] }), _jsx("p", { className: "tt-inv-cdoc__lead", children: lead }), _jsx("section", { className: "tt-inv-cdoc__block", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Date" }), _jsx("th", { children: "Initials" }), _jsx("th", { children: "Task" }), _jsx("th", { children: "Description" }), _jsx("th", { className: "num", children: "Hours" }), _jsxs("th", { className: "num", children: ["Amount (", currency, ")"] })] }) }), _jsx("tbody", { children: [...time].sort((a, b) => a.workDate.localeCompare(b.workDate)).map((line) => {
                                        const user = userById.get(line.authUserId);
                                        const name = user?.display_name?.trim() || user?.email?.trim() || String(line.authUserId);
                                        const split = combinedTimeTaskAndNotes(line.description);
                                        return (_jsxs("tr", { children: [_jsx("td", { children: dateRu(line.workDate) }), _jsx("td", { children: initialsOf(name, user?.initials) }), _jsx("td", { children: split.task }), _jsx("td", { children: split.description }), _jsx("td", { className: "num", children: fmtHours(line.billableHours ?? line.hours) }), _jsx("td", { className: "num", children: money(line.billableAmount) })] }, line.id));
                                    }) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 4, children: "Total" }), _jsx("td", { className: "num", children: fmtHours(totalHours) }), _jsx("td", { className: "num", children: money(totalFees) })] }) })] }) }), _jsxs("section", { className: "tt-inv-cdoc__block", children: [_jsx("h2", { children: "Summary of Services" }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Initials" }), _jsx("th", { children: "Name" }), _jsx("th", { children: "Title" }), _jsx("th", { className: "num", children: "Rate" }), _jsx("th", { className: "num", children: "Hours" }), _jsxs("th", { className: "num", children: ["Rate (", currency, ")"] }), _jsx("th", { className: "num", children: "Amount" })] }) }), _jsx("tbody", { children: people.map((person) => (_jsxs("tr", { children: [_jsx("td", { children: person.initials }), _jsx("td", { children: person.name }), _jsx("td", { children: person.title }), _jsx("td", { className: "num", children: money(person.rate) }), _jsx("td", { className: "num", children: fmtHours(person.hours) }), _jsx("td", { className: "num", children: money(person.rate) }), _jsx("td", { className: "num", children: money(person.amount) })] }, person.id))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 4, children: "Total" }), _jsx("td", { className: "num", children: fmtHours(totalHours) }), _jsx("td", {}), _jsx("td", { className: "num", children: money(totalFees) })] }) })] })] }), _jsxs("section", { className: "tt-inv-cdoc__block", children: [_jsx("h2", { children: "Reimbursable Expenses via" }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Description" }), _jsx("th", { children: "Email date" }), _jsxs("th", { className: "num", children: ["Amount (", currency, ")"] })] }) }), _jsx("tbody", { children: expenses.map((line) => (_jsxs("tr", { children: [_jsx("td", { children: line.description || '—' }), _jsx("td", { children: dateRu(line.expenseDate) }), _jsx("td", { className: "num", children: money(line.equivalentAmount) })] }, line.id))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 2, children: "Subtotal" }), _jsx("td", { className: "num", children: money(totalExp) })] }) })] })] }), _jsxs("section", { className: "tt-inv-cdoc__block", children: [_jsx("p", { className: "tt-inv-cdoc__cur", children: currency }), _jsxs("table", { className: "tt-inv-cdoc__shares", children: [_jsxs("colgroup", { children: [_jsx("col", { className: "name" }), _jsx("col", { className: "pct" }), _jsx("col", { className: "num" }), _jsx("col", { className: "num" })] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { colSpan: 2, children: "Shared amounts" }), _jsx("th", { className: "num", children: "Reimbursable expenses" }), _jsx("th", { className: "num", children: "TO BE INVOICED:" })] }) }), _jsx("tbody", { children: shares.map((share) => (_jsxs("tr", { children: [_jsx("td", { children: share.projectName }), _jsxs("td", { className: "num", children: [share.percent.toFixed(2), "%"] }), _jsx("td", { className: "num", children: Math.abs(share.expenses) < 0.005 ? '-' : money(share.expenses) }), _jsx("td", { className: "num", children: money(share.total) })] }, share.projectId))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { children: "Total" }), _jsx("td", { className: "num", children: "100%" }), _jsx("td", { className: "num", children: money(totalFees + totalExp) }), _jsx("td", { className: "num", children: money(totalFees + totalExp) })] }) })] })] })] })] }));
}
