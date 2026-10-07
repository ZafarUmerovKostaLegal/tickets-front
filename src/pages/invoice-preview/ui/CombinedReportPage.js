import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { KOSTA_LEGAL_LETTERHEAD_LINES } from '../lib/invoiceCoverLetterModel';
import { coverLetterheadLogoUrl } from '../lib/invoiceCoverLogoRaster';
import { planCombinedReportPreviewPages } from '../lib/combinedReportPreviewPages';
import './InvoiceTimeReportPage.css';
function money(n) {
    const [whole, frac] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
}
function hours(n) {
    return n.toFixed(2);
}
function shareExpenseText(n) {
    if (n == null || Math.abs(n) < 0.005)
        return '-';
    return money(n);
}
function dateRu(iso) {
    const day = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return iso;
    const [y, m, d] = day.split('-');
    return `${d}.${m}.${y}`;
}
function commitDate(raw) {
    const match = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match)
        return raw;
    return `${match[3]}-${match[2]}-${match[1]}`;
}
function parseNum(raw) {
    const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}
function TextCell({ value, editable, onChange, className, ariaLabel, }) {
    if (!editable)
        return _jsx("td", { className: className, children: value || '\u00a0' });
    return (_jsx("td", { className: className, children: _jsx("input", { type: "text", className: "tt-inv-tr__cell-input", value: value, "aria-label": ariaLabel, onChange: (e) => onChange(e.target.value) }) }));
}
function NumInput({ value, onChange, ariaLabel, format, foot = false, }) {
    const [draft, setDraft] = useState(null);
    return (_jsx("input", { type: "text", className: `tt-inv-tr__cell-input${foot ? ' tt-inv-tr__cell-input--foot' : ''}`, value: draft ?? format(value), "aria-label": ariaLabel, onFocus: () => setDraft(format(value)), onChange: (e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = parseNum(raw);
            if (n != null)
                onChange(n);
        }, onBlur: () => setDraft(null) }));
}
function NumCell({ value, editable, onChange, className, ariaLabel, format, foot = false, }) {
    if (!editable)
        return _jsx("td", { className: className, children: format(value) });
    return (_jsx("td", { className: className, children: _jsx(NumInput, { value: value, onChange: onChange, ariaLabel: ariaLabel, format: format, foot: foot }) }));
}
function detailRefs(report) {
    return report.projects
        .flatMap((project, projectIndex) => project.lines.map((line, lineIndex) => ({
        key: `${projectIndex}-${lineIndex}`,
        line,
        projectIndex,
        lineIndex,
    })))
        .sort((a, b) => a.line.date.localeCompare(b.line.date)
        || (a.line.initials || a.line.user).localeCompare(b.line.initials || b.line.user));
}
export function CombinedReportPage({ report, pageNumber, pageIndex = 0, editable = false, onChange }) {
    const cur = report.currency || 'USD';
    const invoiced = report.totalFees + report.totalExpenses;
    const slices = planCombinedReportPreviewPages(report);
    const slice = slices[Math.max(0, Math.min(pageIndex, slices.length - 1))] ?? slices[0];
    const emit = (next) => onChange?.(next);
    const patchLine = (projectIndex, lineIndex, patch) => {
        emit({
            ...report,
            projects: report.projects.map((project, pi) => pi !== projectIndex
                ? project
                : {
                    ...project,
                    lines: project.lines.map((line, li) => li === lineIndex ? { ...line, ...patch } : line),
                }),
        });
    };
    const showTime = slice.showTimeTotal || slice.timeTo > slice.timeFrom;
    const showPeople = slice.showPeopleTotal || slice.peopleTo > slice.peopleFrom;
    const showExpenses = slice.showExpensesTotal || slice.expensesTo > slice.expensesFrom;
    const showShares = slice.showSharesTotal || slice.sharesTo > slice.sharesFrom;
    const timeRows = detailRefs(report).slice(slice.timeFrom, slice.timeTo);
    return (_jsxs("div", { className: `tt-inv-tr tt-inv-creport${editable ? ' tt-inv-tr--editable' : ''}`, children: [slice.showMasthead ? (_jsxs("header", { className: "tt-inv-creport__head", children: [_jsx("img", { className: "tt-inv-creport__logo", src: coverLetterheadLogoUrl(), alt: "KOSTA LEGAL" }), _jsx("address", { children: KOSTA_LEGAL_LETTERHEAD_LINES.map((line) => _jsx("span", { children: line }, line)) })] })) : null, slice.showMasthead
                ? (editable
                    ? (_jsx("textarea", { className: "tt-inv-creport__lead-input", value: report.feeTitle, "aria-label": "Fees for services", rows: 3, onChange: (e) => emit({ ...report, feeTitle: e.target.value }) }))
                    : _jsx("p", { className: "tt-inv-creport__lead", children: report.feeTitle }))
                : null, showTime ? (_jsx("section", { className: "tt-inv-creport__block", children: _jsxs("table", { className: "tt-inv-creport__time", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Date" }), _jsx("th", { children: "Initials" }), _jsx("th", { children: "Task" }), _jsx("th", { children: "Description" }), _jsx("th", { className: "num", children: "Hours" }), _jsxs("th", { className: "num", children: ["Amount (", cur, ")"] })] }) }), _jsx("tbody", { children: timeRows.map(({ key, line, projectIndex, lineIndex }) => (_jsxs("tr", { children: [_jsx(TextCell, { editable: editable, className: "", ariaLabel: "Date", value: dateRu(line.date), onChange: (v) => patchLine(projectIndex, lineIndex, { date: commitDate(v) }) }), _jsx(TextCell, { editable: editable, ariaLabel: "Initials", value: line.initials || line.user, onChange: (v) => patchLine(projectIndex, lineIndex, { initials: v }) }), _jsx(TextCell, { editable: editable, ariaLabel: "Task", value: line.task || '', onChange: (v) => patchLine(projectIndex, lineIndex, { task: v }) }), _jsx(TextCell, { editable: editable, ariaLabel: "Description", value: line.description, onChange: (v) => patchLine(projectIndex, lineIndex, { description: v }) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "Hours", value: line.hours, format: hours, onChange: (v) => patchLine(projectIndex, lineIndex, { hours: v }) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "Amount", value: line.amount, format: money, onChange: (v) => patchLine(projectIndex, lineIndex, { amount: v }) })] }, key))) }), slice.showTimeTotal ? (_jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 4, children: "Total" }), _jsx(NumCell, { editable: editable, foot: true, className: "num", ariaLabel: "Total hours", value: report.totalHours, format: hours, onChange: (v) => emit({ ...report, totalHours: v }) }), _jsx(NumCell, { editable: editable, foot: true, className: "num", ariaLabel: "Total amount", value: report.totalFees, format: money, onChange: (v) => emit({ ...report, totalFees: v }) })] }) })) : null] }) })) : null, showPeople ? (_jsxs("section", { className: "tt-inv-creport__block", children: [_jsx("h2", { children: "Summary of Services" }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Initials" }), _jsx("th", { children: "Name" }), _jsx("th", { children: "Title" }), _jsx("th", { className: "num", children: "Rate" }), _jsx("th", { className: "num", children: "Hours" }), _jsxs("th", { className: "num", children: ["Rate (", cur, ")"] }), _jsx("th", { className: "num", children: "Amount" })] }) }), _jsx("tbody", { children: report.people.slice(Math.max(0, slice.peopleFrom), Math.max(0, slice.peopleTo)).map((person, offset) => {
                                    const index = Math.max(0, slice.peopleFrom) + offset;
                                    return (_jsxs("tr", { children: [_jsx(TextCell, { editable: editable, ariaLabel: "Initials", value: person.initials, onChange: (v) => emit({
                                                    ...report,
                                                    people: report.people.map((row, i) => i === index ? { ...row, initials: v } : row),
                                                }) }), _jsx(TextCell, { editable: editable, ariaLabel: "Name", value: person.name, onChange: (v) => emit({
                                                    ...report,
                                                    people: report.people.map((row, i) => i === index ? { ...row, name: v } : row),
                                                }) }), _jsx(TextCell, { editable: editable, ariaLabel: "Title", value: person.title, onChange: (v) => emit({
                                                    ...report,
                                                    people: report.people.map((row, i) => i === index ? { ...row, title: v } : row),
                                                }) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "Rate", value: person.rate, format: money, onChange: (v) => emit({
                                                    ...report,
                                                    people: report.people.map((row, i) => i === index ? { ...row, rate: v } : row),
                                                }) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "Hours", value: person.hours, format: hours, onChange: (v) => emit({
                                                    ...report,
                                                    people: report.people.map((row, i) => i === index ? { ...row, hours: v } : row),
                                                }) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "Rate", value: person.rate, format: money, onChange: (v) => emit({
                                                    ...report,
                                                    people: report.people.map((row, i) => i === index ? { ...row, rate: v } : row),
                                                }) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "Amount", value: person.amount, format: money, onChange: (v) => emit({
                                                    ...report,
                                                    people: report.people.map((row, i) => i === index ? { ...row, amount: v } : row),
                                                }) })] }, `person-${index}`));
                                }) }), slice.showPeopleTotal ? (_jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 4, children: "Total" }), _jsx(NumCell, { editable: editable, foot: true, className: "num", ariaLabel: "Summary hours", value: report.totalHours, format: hours, onChange: (v) => emit({ ...report, totalHours: v }) }), _jsx("td", {}), _jsx(NumCell, { editable: editable, foot: true, className: "num", ariaLabel: "Summary amount", value: report.totalFees, format: money, onChange: (v) => emit({ ...report, totalFees: v }) })] }) })) : null] })] })) : null, showExpenses ? (_jsxs("section", { className: "tt-inv-creport__block", children: [_jsx("h2", { children: "Reimbursable Expenses via" }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Description" }), _jsx("th", { children: "Email date" }), _jsxs("th", { className: "num", children: ["Amount (", cur, ")"] })] }) }), _jsx("tbody", { children: report.expenses.slice(Math.max(0, slice.expensesFrom), Math.max(0, slice.expensesTo)).map((line, offset) => {
                                    const index = Math.max(0, slice.expensesFrom) + offset;
                                    return (_jsxs("tr", { children: [_jsx(TextCell, { editable: editable, ariaLabel: "Description", value: line.description, onChange: (v) => emit({
                                                    ...report,
                                                    expenses: report.expenses.map((row, i) => i === index ? { ...row, description: v } : row),
                                                }) }), _jsx(TextCell, { editable: editable, ariaLabel: "Email date", value: dateRu(line.date), onChange: (v) => emit({
                                                    ...report,
                                                    expenses: report.expenses.map((row, i) => i === index ? { ...row, date: commitDate(v) } : row),
                                                }) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "Amount", value: line.amount, format: money, onChange: (v) => emit({
                                                    ...report,
                                                    expenses: report.expenses.map((row, i) => i === index ? { ...row, amount: v } : row),
                                                }) })] }, `expense-${index}`));
                                }) }), slice.showExpensesTotal ? (_jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { colSpan: 2, children: "Subtotal" }), _jsx(NumCell, { editable: editable, foot: true, className: "num", ariaLabel: "Expenses subtotal", value: report.totalExpenses, format: money, onChange: (v) => emit({ ...report, totalExpenses: v }) })] }) })) : null] })] })) : null, showShares ? (_jsxs("section", { className: "tt-inv-creport__block", children: [_jsx("p", { className: "tt-inv-creport__cur", children: cur }), _jsxs("table", { className: "tt-inv-creport__shares", children: [_jsxs("colgroup", { children: [_jsx("col", { className: "name" }), _jsx("col", { className: "pct" }), _jsx("col", { className: "num" }), _jsx("col", { className: "num" })] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { colSpan: 2, children: "Shared amounts" }), _jsx("th", { className: "num", children: "Reimbursable expenses" }), _jsx("th", { className: "num", children: "TO BE INVOICED:" })] }) }), _jsx("tbody", { children: report.shares.slice(Math.max(0, slice.sharesFrom), Math.max(0, slice.sharesTo)).map((share, offset) => {
                                    const index = Math.max(0, slice.sharesFrom) + offset;
                                    return (_jsxs("tr", { children: [_jsx("td", { children: editable
                                                    ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input", value: share.name, "aria-label": "Shared amount name", onChange: (e) => emit({
                                                            ...report,
                                                            shares: report.shares.map((row, i) => i === index ? { ...row, name: e.target.value } : row),
                                                        }) }))
                                                    : share.name }), _jsx("td", { className: "num", children: editable
                                                    ? (_jsx(NumInput, { value: share.percent, ariaLabel: "Percent", format: (n) => n.toFixed(2), onChange: (v) => emit({
                                                            ...report,
                                                            shares: report.shares.map((row, i) => i === index ? { ...row, percent: v } : row),
                                                        }) }))
                                                    : `${share.percent.toFixed(2)}%` }), editable
                                                ? (_jsx(NumCell, { editable: true, className: "num", ariaLabel: "Reimbursable expenses", value: share.expenses ?? 0, format: money, onChange: (v) => emit({
                                                        ...report,
                                                        shares: report.shares.map((row, i) => i === index ? { ...row, expenses: v } : row),
                                                    }) }))
                                                : _jsx("td", { className: "num", children: shareExpenseText(share.expenses) }), _jsx(NumCell, { editable: editable, className: "num", ariaLabel: "To be invoiced", value: share.total, format: money, onChange: (v) => emit({
                                                    ...report,
                                                    shares: report.shares.map((row, i) => i === index ? { ...row, total: v } : row),
                                                }) })] }, `share-${index}`));
                                }) }), slice.showSharesTotal ? (_jsx("tfoot", { children: _jsxs("tr", { children: [_jsx("td", { children: "Total" }), _jsx("td", { className: "num", children: "100%" }), _jsx("td", { className: "num", children: money(invoiced) }), _jsx("td", { className: "num", children: money(invoiced) })] }) })) : null] })] })) : null, _jsxs("footer", { className: "tt-inv-tr__bottom", children: [_jsx("div", { className: "tt-inv-tr__bottom-line", "aria-hidden": true }), _jsx("div", { className: "tt-inv-tr__bottom-meta", children: _jsx("span", { className: "tt-inv-tr__page-box", children: pageNumber }) })] })] }));
}
