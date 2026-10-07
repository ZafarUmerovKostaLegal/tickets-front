import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment } from 'react';
import { displayReportClientLabel, displayReportProjectLabel, formatExpenseReportStatus, formatExpenseReportStatusHint, } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { fmtAmt, pct } from '@entities/time-tracking/lib/reportsFormatUtils';
import { IcoExpand } from './reportsDetailWidgets';
function ExpenseUserRows({ users, currency }) {
    const { t } = useI18n();
    return (_jsx(_Fragment, { children: users.map((u, i) => (_jsxs("tr", { className: "rp-table__sub-row", children: [_jsxs("td", { className: "rp-table__sub-indent", children: [_jsx("span", { className: "rp-table__sub-icon", children: "\u21B3" }), _jsx("span", { children: u.user_name?.trim() ? u.user_name : t('timeTrackingPage.reports.expenseTable.employeeFallback').replace('{id}', String(u.user_id)) })] }), _jsx("td", { className: "rp-table__num", children: fmtAmt(u.total_amount, currency) }), _jsx("td", { className: "rp-table__num", children: fmtAmt(u.billable_amount, currency) }), _jsx("td", { className: "rp-table__num", children: pct(u.billable_amount, u.total_amount) }), _jsx("td", { className: "rp-table__status", title: formatExpenseReportStatusHint(u.status ?? u.expense_status), children: formatExpenseReportStatus(u.status ?? u.expense_status) }), _jsx("td", {})] }, `${u.user_id}-${i}`))) }));
}
function expenseClientsRowKey(r, index) {
    const gid = r.report_group_id?.trim();
    if (gid)
        return gid;
    const cid = String(r.client_id ?? '').trim();
    const cur = String(r.group_currency ?? r.currency ?? '').trim() || '—';
    if (cid)
        return `${cid}|${cur}`;
    return `exp-cli-${index}|${cur}`;
}
function expenseProjectsRowKey(r, index) {
    const gid = r.report_group_id?.trim();
    if (gid)
        return gid;
    const pid = String(r.project_id ?? '').trim();
    const cur = String(r.group_currency ?? r.currency ?? '').trim() || '—';
    if (pid)
        return `${pid}|${cur}`;
    return `exp-prj-${index}|${cur}`;
}
export function ExpenseTable({ groupBy, rows, expanded, onToggle, }) {
    const { t } = useI18n();
    if (groupBy === 'team') {
        const teamRows = rows;
        return (_jsxs("table", { className: "tt-reports__table rp-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('timeTrackingPage.reports.expenseTable.employee') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.totalExpenses') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursable') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursablePct') })] }) }), _jsx("tbody", { children: teamRows.map((r) => (_jsxs("tr", { children: [_jsxs("td", { children: [r.user_name, r.is_contractor && _jsx("span", { className: "rp-badge rp-badge--muted", children: t('timeTrackingPage.reports.expenseTable.contractor') })] }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.total_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.billable_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: pct(r.billable_amount, r.total_amount) })] }, r.user_id))) })] }));
    }
    if (groupBy === 'clients') {
        const clientRows = rows;
        return (_jsxs("table", { className: "tt-reports__table rp-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('timeTrackingPage.reports.expenseTable.client') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.totalExpenses') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursable') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursablePct') }), _jsx("th", { children: t('timeTrackingPage.reports.expenseTable.status') }), _jsx("th", { className: "rp-table__expand-col", "aria-label": t('timeTrackingPage.reports.table.expand') })] }) }), _jsx("tbody", { children: clientRows.map((r, idx) => {
                        const key = expenseClientsRowKey(r, idx);
                        const isOpen = expanded.has(key);
                        return (_jsxs(Fragment, { children: [_jsxs("tr", { className: "rp-table__group-row", onClick: () => r.users?.length && onToggle(key), children: [_jsx("td", { className: "rp-table__name-cell", children: displayReportClientLabel(r.client_name, r.client_id) }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.total_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.billable_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: pct(r.billable_amount, r.total_amount) }), _jsx("td", { className: "rp-table__muted", children: t('timeTrackingPage.reports.expenseTable.statusByEmployee') }), _jsx("td", { className: "rp-table__expand-col", children: r.users?.length ? _jsx("button", { type: "button", className: "rp-table__expand-btn", "aria-expanded": isOpen, children: _jsx(IcoExpand, { open: isOpen }) }) : null })] }), isOpen && _jsx(ExpenseUserRows, { users: r.users ?? [], currency: r.currency })] }, key));
                    }) })] }));
    }
    if (groupBy === 'categories') {
        const catRows = rows;
        return (_jsxs("table", { className: "tt-reports__table rp-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('timeTrackingPage.reports.expenseTable.category') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.totalExpenses') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursable') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursablePct') }), _jsx("th", { children: t('timeTrackingPage.reports.expenseTable.status') }), _jsx("th", { className: "rp-table__expand-col", "aria-label": t('timeTrackingPage.reports.table.expand') })] }) }), _jsx("tbody", { children: catRows.map((r, i) => {
                        const key = r.expense_category_id ?? `cat-${i}`;
                        const isOpen = expanded.has(key);
                        return (_jsxs(Fragment, { children: [_jsxs("tr", { className: "rp-table__group-row", onClick: () => r.users?.length && onToggle(key), children: [_jsx("td", { className: "rp-table__name-cell", children: r.expense_category_name || '—' }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.total_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.billable_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: pct(r.billable_amount, r.total_amount) }), _jsx("td", { className: "rp-table__muted", children: t('timeTrackingPage.reports.expenseTable.statusByEmployee') }), _jsx("td", { className: "rp-table__expand-col", children: r.users?.length ? _jsx("button", { type: "button", className: "rp-table__expand-btn", "aria-expanded": isOpen, children: _jsx(IcoExpand, { open: isOpen }) }) : null })] }), isOpen && _jsx(ExpenseUserRows, { users: r.users ?? [], currency: r.currency })] }, key));
                    }) })] }));
    }
    const projectRows = rows;
    return (_jsxs("table", { className: "tt-reports__table rp-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('timeTrackingPage.reports.expenseTable.project') }), _jsx("th", { children: t('timeTrackingPage.reports.expenseTable.client') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.totalExpenses') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursable') }), _jsx("th", { className: "rp-table__num", children: t('timeTrackingPage.reports.expenseTable.reimbursablePct') }), _jsx("th", { children: t('timeTrackingPage.reports.expenseTable.status') }), _jsx("th", { className: "rp-table__expand-col", "aria-label": t('timeTrackingPage.reports.table.expand') })] }) }), _jsx("tbody", { children: projectRows.map((r, idx) => {
                    const key = expenseProjectsRowKey(r, idx);
                    const isOpen = expanded.has(key);
                    return (_jsxs(Fragment, { children: [_jsxs("tr", { className: "rp-table__group-row", onClick: () => r.users?.length && onToggle(key), children: [_jsx("td", { className: "rp-table__name-cell rp-table__name-cell--bold", children: displayReportProjectLabel(r.project_name, r.project_id) }), _jsx("td", { className: "rp-table__muted", children: displayReportClientLabel(r.client_name, r.client_id) }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.total_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: fmtAmt(r.billable_amount, r.currency) }), _jsx("td", { className: "rp-table__num", children: pct(r.billable_amount, r.total_amount) }), _jsx("td", { className: "rp-table__muted", children: t('timeTrackingPage.reports.expenseTable.statusByEmployee') }), _jsx("td", { className: "rp-table__expand-col", children: r.users?.length ? _jsx("button", { type: "button", className: "rp-table__expand-btn", "aria-expanded": isOpen, children: _jsx(IcoExpand, { open: isOpen }) }) : null })] }), isOpen && _jsx(ExpenseUserRows, { users: r.users ?? [], currency: r.currency })] }, key));
                }) })] }));
}
