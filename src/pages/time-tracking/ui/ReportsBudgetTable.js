import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from '@entities/time-tracking';
import { budgetReportHoursMetrics, budgetReportMoneyMetrics, budgetReportRowProgressPercent } from '@entities/time-tracking/lib/projectBudgetReportMetrics';
import { useI18n } from '@shared/i18n';
import { fmtH, fmtAmt } from '@entities/time-tracking/lib/reportsFormatUtils';
const IcoChevDown = () => (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
function BudgetProgress({ budget, spent, budgetBy, currency, compact = false, }) {
    const b = budget ?? 0;
    const s = spent ?? 0;
    const hasBudget = b > 0;
    const ratio = hasBudget ? s / b : 0;
    const pctVal = hasBudget ? Math.round(ratio * 100) : 0;
    const tone = !hasBudget ? 'none' : pctVal >= 100 ? 'over' : pctVal >= 90 ? 'danger' : pctVal >= 75 ? 'warn' : 'ok';
    const fmtNum = (n) => (budgetBy === 'hours'
        ? fmtH(n)
        : `${Math.round(n).toLocaleString('ru-RU')}${currency ? ` ${currency}` : ''}`);
    const label = hasBudget ? `${fmtNum(s)} / ${fmtNum(b)}` : fmtNum(s);
    const widthMain = hasBudget ? Math.min(100, pctVal) : 0;
    const widthOver = hasBudget && pctVal > 100 ? Math.min(100, pctVal - 100) : 0;
    const pctLabel = hasBudget ? `${pctVal}%` : '—';
    return (_jsxs("div", { className: `rpb-progress rpb-progress--${tone}${compact ? ' rpb-progress--compact' : ''}`, children: [_jsxs("div", { className: "rpb-progress__track", "aria-hidden": true, children: [_jsx("div", { className: "rpb-progress__fill", style: { width: `${widthMain}%` } }), widthOver > 0 && (_jsx("div", { className: "rpb-progress__overfill", style: { width: `${widthOver}%` } }))] }), _jsxs("div", { className: "rpb-progress__meta", children: [_jsx("span", { className: "rpb-progress__label", title: `${label} · ${pctLabel}`, children: label }), _jsx("span", { className: "rpb-progress__pct", children: pctLabel })] })] }));
}
function BudgetUserSubRows({ users, row }) {
    const { t } = useI18n();
    if (!users?.length)
        return null;
    const cur = (row.currency ?? '').trim();
    const hh = budgetReportHoursMetrics(row);
    const mm = budgetReportMoneyMetrics(row);
    const budgetBy = row.budget_by;
    return (_jsx("div", { className: "rpb__users", role: "rowgroup", children: users.map((u) => {
            const uCur = (u.currency ?? cur).trim() || cur;
            const userHours = Number.isFinite(u.hours_logged) ? u.hours_logged : 0;
            const userAmt = Number.isFinite(u.amount_logged) ? u.amount_logged : 0;
            let share = 0;
            if (budgetBy === 'hours_and_money') {
                const sh = hh.spent > 0 ? userHours / hh.spent : 0;
                const sm = mm.spent > 0 ? userAmt / mm.spent : 0;
                share = Math.min(1, Math.max(0, Math.max(sh, sm)));
            }
            else if (budgetBy === 'hours') {
                share = hh.spent > 0 ? Math.min(1, Math.max(0, userHours / hh.spent)) : 0;
            }
            else if (budgetBy === 'money') {
                share = mm.spent > 0 ? Math.min(1, Math.max(0, userAmt / mm.spent)) : 0;
            }
            const sharePct = Math.round(share * 100);
            const initial = (u.user_name || '?').charAt(0).toUpperCase();
            let primary;
            let secondary;
            if (budgetBy === 'hours_and_money') {
                primary = `${fmtH(userHours)} · ${fmtAmt(userAmt, uCur)}`;
                secondary = '';
            }
            else if (budgetBy === 'hours') {
                primary = fmtH(userHours);
                secondary = fmtAmt(userAmt, uCur);
            }
            else {
                primary = fmtAmt(userAmt, uCur);
                secondary = `${fmtH(userHours)}${t('timeTrackingPage.reports.budgetTable.hoursSuffix')}`;
            }
            return (_jsxs("div", { className: "rpb__user", role: "row", children: [_jsxs("div", { className: "rpb__user-name", children: [_jsx("span", { className: "rpb__user-avatar", "aria-hidden": true, children: initial }), _jsx("span", { className: "rpb__user-label", title: u.user_name, children: u.user_name })] }), _jsx("div", { className: "rpb__user-spacer" }), _jsx("div", { className: "rpb__user-spacer" }), _jsx("div", { className: "rpb__user-spacer" }), _jsxs("div", { className: "rpb__user-metric rpb-num", children: [_jsx("span", { className: "rpb__user-metric-value", children: primary }), secondary ? (_jsx("span", { className: "rpb__user-metric-sub", children: secondary })) : null] }), _jsx("div", { className: "rpb__user-spacer" }), _jsxs("div", { className: "rpb__user-share", title: t('timeTrackingPage.reports.budgetTable.shareTitle').replace('{pct}', String(sharePct)), children: [_jsx("div", { className: "rpb__user-share-track", "aria-hidden": true, children: _jsx("div", { className: "rpb__user-share-fill", style: { width: `${sharePct}%` } }) }), _jsxs("span", { className: "rpb__user-share-pct", children: [sharePct, "%"] })] }), _jsx("div", { className: "rpb__user-spacer" })] }, u.user_id));
        }) }));
}
export function BudgetTable({ rows, expanded, onToggle, }) {
    const { t } = useI18n();
    if (!rows.length)
        return null;
    return (_jsxs("div", { className: "rpb", role: "table", "aria-label": t('timeTrackingPage.reports.budgetTable.aria'), children: [_jsxs("div", { className: "rpb__head", role: "row", children: [_jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.budgetTable.project') }), _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.budgetTable.client') }), _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.budgetTable.type') }), _jsx("div", { className: "rpb-num", role: "columnheader", children: t('timeTrackingPage.reports.budgetTable.budget') }), _jsx("div", { className: "rpb-num", role: "columnheader", children: t('timeTrackingPage.reports.budgetTable.spent') }), _jsx("div", { className: "rpb-num", role: "columnheader", children: t('timeTrackingPage.reports.budgetTable.remaining') }), _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.budgetTable.progress') }), _jsx("div", { role: "columnheader", "aria-label": t('timeTrackingPage.reports.table.expand') })] }), rows.map((r) => {
                const key = r.project_id;
                const isOpen = expanded.has(key);
                const hasUsers = (r.users?.length ?? 0) > 0;
                const cur = (r.currency ?? '').trim();
                const hh = budgetReportHoursMetrics(r);
                const mm = budgetReportMoneyMetrics(r);
                const unitLabel = r.budget_by === 'none' || r.has_budget === false
                    ? '—'
                    : r.budget_by === 'hours'
                        ? t('timeTrackingPage.reports.table.hours')
                        : r.budget_by === 'money'
                            ? (cur || '—')
                            : t('timeTrackingPage.reports.table.hoursAndAmount');
                const fmtMoneyCell = (n) => {
                    if (n == null || !Number.isFinite(n))
                        return '—';
                    const c = (cur || '').toUpperCase();
                    const fractionDigits = c === 'USD' ? 2 : c === 'UZS' ? 0 : 2;
                    const formatted = Number(n).toLocaleString('ru-RU', {
                        minimumFractionDigits: fractionDigits,
                        maximumFractionDigits: fractionDigits,
                    });
                    if (c === 'USD')
                        return `$${formatted}`;
                    return c ? `${formatted} ${c}` : formatted;
                };
                const budgetCell = r.budget_by === 'hours_and_money'
                    ? (_jsxs(_Fragment, { children: [_jsx("div", { children: fmtH(hh.budget) }), _jsx("div", { className: "rpb__cell-sub", children: fmtMoneyCell(mm.budget) })] }))
                    : r.budget_by === 'hours'
                        ? fmtH(r.budget)
                        : fmtMoneyCell(r.budget);
                const spentCell = r.budget_by === 'hours_and_money'
                    ? (_jsxs(_Fragment, { children: [_jsx("div", { children: fmtH(hh.spent) }), _jsx("div", { className: "rpb__cell-sub", children: fmtMoneyCell(mm.spent) })] }))
                    : r.budget_by === 'hours'
                        ? fmtH(r.budget_spent)
                        : fmtMoneyCell(r.budget_spent);
                const remCell = r.budget_by === 'hours_and_money'
                    ? (_jsxs(_Fragment, { children: [_jsx("div", { children: fmtH(hh.remaining) }), _jsx("div", { className: "rpb__cell-sub", children: fmtMoneyCell(mm.remaining) })] }))
                    : r.budget_by === 'hours'
                        ? fmtH(r.budget_remaining)
                        : fmtMoneyCell(r.budget_remaining);
                const remainderNegative = r.budget_by === 'hours_and_money'
                    ? (hh.remaining < 0 || mm.remaining < 0)
                    : Number.isFinite(r.budget_remaining) && r.budget_remaining < 0;
                const pctVal = budgetReportRowProgressPercent(r);
                const hasBudget = r.budget_by !== 'none' && r.has_budget !== false && (r.budget_by === 'hours_and_money'
                    ? (hh.budget > 0 || mm.budget > 0)
                    : Number.isFinite(r.budget) && r.budget > 0);
                const isOver = hasBudget && pctVal >= 100;
                const stateClass = !hasBudget
                    ? 'rpb__row--empty'
                    : isOver
                        ? 'rpb__row--over'
                        : pctVal >= 90
                            ? 'rpb__row--danger'
                            : pctVal >= 75
                                ? 'rpb__row--warn'
                                : 'rpb__row--ok';
                return (_jsxs("div", { className: "rpb__group", children: [_jsxs("div", { className: `rpb__row ${stateClass}${hasUsers ? ' rpb__row--clickable' : ''}`, onClick: () => hasUsers && onToggle(key), onKeyDown: (e) => {
                                if (!hasUsers)
                                    return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onToggle(key);
                                }
                            }, role: "row", tabIndex: hasUsers ? 0 : -1, "aria-expanded": hasUsers ? isOpen : undefined, children: [_jsxs("div", { className: "rpb__project", role: "cell", children: [_jsx("span", { className: "rpb__project-name", title: r.project_name, children: r.project_name }), _jsxs("span", { className: "rpb__project-tags", children: [!r.is_active && _jsx("span", { className: "rpb-tag rpb-tag--muted", children: t('timeTrackingPage.reports.budgetTable.archived') }), r.budget_is_monthly && _jsx("span", { className: "rpb-tag rpb-tag--info", children: t('timeTrackingPage.reports.budgetTable.monthly') }), isOver && _jsx("span", { className: "rpb-tag rpb-tag--danger", children: t('timeTrackingPage.reports.budgetTable.overBudget') })] })] }), _jsx("div", { className: "rpb__client", role: "cell", title: r.client_name, children: r.client_name || '—' }), _jsx("div", { className: "rpb__type", role: "cell", children: unitLabel }), _jsx("div", { className: "rpb__metric rpb-num", role: "cell", children: budgetCell }), _jsx("div", { className: "rpb__metric rpb-num", role: "cell", children: spentCell }), _jsx("div", { className: `rpb__metric rpb-num${remainderNegative ? ' rpb__metric--negative' : ''}`, role: "cell", children: remCell }), _jsx("div", { className: "rpb__progress-cell", role: "cell", children: r.budget_by === 'hours_and_money'
                                        ? (_jsxs("div", { className: "rpb__dual-progress", children: [_jsx(BudgetProgress, { compact: true, budget: hh.budget, spent: hh.spent, budgetBy: "hours" }), _jsx(BudgetProgress, { compact: true, budget: mm.budget, spent: mm.spent, budgetBy: "money", currency: cur })] }))
                                        : (_jsx(BudgetProgress, { budget: r.budget, spent: r.budget_spent, budgetBy: r.budget_by === 'hours' ? 'hours' : 'money', currency: cur })) }), _jsx("div", { className: "rpb__chev", role: "cell", "aria-hidden": true, children: hasUsers ? (_jsx("span", { className: `rpb__chev-icon${isOpen ? ' rpb__chev-icon--open' : ''}`, children: _jsx(IcoChevDown, {}) })) : null })] }), isOpen && hasUsers && (_jsx(BudgetUserSubRows, { users: r.users ?? [], row: r }))] }, key));
            })] }));
}
