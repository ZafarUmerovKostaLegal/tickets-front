import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fmtH, fmtAmtWithIso, formatIsoTimeOnlyRu, formatReportWorkDate, } from '@entities/time-tracking/lib/reportsFormatUtils';
import { entryComment, entryTaskLabel, deriveBillableHoursForEntry, deriveBillableAmountForEntry, billablePaidKind, billablePaidLabel, billableChipClass, } from '@entities/time-tracking/lib/timeReportEntryLogFormat';
import { useI18n } from '@shared/i18n';
export const IcoExpand = ({ open }) => (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6' }) }));
export function TimeEntryLogDetails({ entries, entriesTotal, entriesTruncated, currency: defaultCurrency = '', entryGroupContext, userBillableRollup, groupBy, }) {
    const { t } = useI18n();
    const n = entriesTotal ?? entries?.length ?? 0;
    if (!entries?.length)
        return null;
    const ctx = entryGroupContext ?? undefined;
    const showProject = groupBy !== 'projects' && groupBy !== 'tasks';
    const showClient = groupBy !== 'clients' && groupBy !== 'projects' && groupBy !== 'tasks';
    const showTask = groupBy !== 'tasks';
    const colClass = `rp2-entries__table rp2-entries__table--${[showProject, showClient, showTask].filter(Boolean).length}ctx`;
    return (_jsxs("div", { className: "rp2-entries", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "rp2-entries__caption", "aria-label": t('timeTrackingPage.reports.entryLog.captionAria').replace('{count}', String(n)), children: [_jsx("span", { className: "rp2-entries__caption-label", children: t('timeTrackingPage.reports.entryLog.caption') }), _jsx("span", { className: "rp2-entries__summary-count", children: n })] }), _jsxs("div", { className: colClass, children: [_jsxs("div", { className: "rp2-entries__head", role: "row", children: [_jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.entryLog.date') }), _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.entryLog.time') }), _jsx("div", { className: "rp2-num", role: "columnheader", children: t('timeTrackingPage.reports.entryLog.hours') }), _jsx("div", { className: "rp2-num", role: "columnheader", children: t('timeTrackingPage.reports.entryLog.billableHours') }), _jsx("div", { className: "rp2-num", role: "columnheader", children: t('timeTrackingPage.reports.entryLog.amount') }), _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.entryLog.status') }), showProject && _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.entryLog.project') }), showClient && _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.entryLog.client') }), showTask && _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.entryLog.task') }), _jsx("div", { role: "columnheader", children: t('timeTrackingPage.reports.entryLog.comment') })] }), entries.map((it, idx) => {
                        const cur = (it.billable_currency ?? it.billableCurrency ?? it.currency ?? defaultCurrency ?? '').trim();
                        const billH = deriveBillableHoursForEntry(it, userBillableRollup);
                        const billAmt = deriveBillableAmountForEntry(it, userBillableRollup);
                        const billKind = billablePaidKind(it, billH, it.hours);
                        const billLabel = billablePaidLabel(billKind, t);
                        const key = it.id ?? it.time_entry_id ?? `${it.recorded_at}-${idx}`;
                        const projectCell = (it.project_name ?? ctx?.project_name ?? '').trim() || '—';
                        const clientCell = (it.client_name ?? ctx?.client_name ?? '').trim() || '—';
                        const taskCell = entryTaskLabel(it, ctx);
                        const comment = entryComment(it);
                        const dateText = formatReportWorkDate(it.work_date);
                        const timeText = formatIsoTimeOnlyRu(it.recorded_at);
                        const amountText = billAmt != null ? fmtAmtWithIso(billAmt, cur || defaultCurrency) : '—';
                        return (_jsxs("div", { className: "rp2-entries__row", role: "row", children: [_jsx("div", { className: "rp2-entries__cell rp2-entries__cell--date", title: dateText, children: dateText }), _jsx("div", { className: "rp2-entries__cell rp2-entries__cell--time", title: timeText, children: timeText }), _jsx("div", { className: "rp2-entries__cell rp2-num", children: fmtH(it.hours) }), _jsx("div", { className: "rp2-entries__cell rp2-num", children: billH != null ? fmtH(billH) : '—' }), _jsx("div", { className: "rp2-entries__cell rp2-num rp2-entries__cell--amount", title: amountText, children: amountText }), _jsx("div", { className: "rp2-entries__cell", children: _jsx("span", { className: billableChipClass(billKind), children: billLabel }) }), showProject && (_jsx("div", { className: "rp2-entries__cell rp2-entries__cell--text", title: projectCell, children: projectCell })), showClient && (_jsx("div", { className: "rp2-entries__cell rp2-entries__cell--text", title: clientCell, children: clientCell })), showTask && (_jsx("div", { className: "rp2-entries__cell rp2-entries__cell--text", title: taskCell, children: taskCell })), _jsx("div", { className: "rp2-entries__cell rp2-entries__cell--text rp2-entries__cell--note", title: comment || undefined, children: comment || _jsx("span", { className: "rp2-muted", children: "\u2014" }) })] }, key));
                    })] }), entriesTruncated && entriesTotal != null && entriesTotal > entries.length ? (_jsx("p", { className: "rp2-entries__note", children: t('timeTrackingPage.reports.entryLog.truncated')
                    .replace('{shown}', String(entries.length))
                    .replace('{total}', String(entriesTotal)) })) : null] }));
}
export function PctBar({ a, b, }) {
    const { t } = useI18n();
    const hasValue = a != null && b != null && Number.isFinite(a) && Number.isFinite(b) && b > 0;
    const ratio = hasValue ? Math.max(0, Math.min(1, a / b)) : 0;
    const percent = hasValue ? Math.round(ratio * 100) : null;
    const tone = percent == null ? 'muted' : percent >= 80 ? 'ok' : percent >= 40 ? 'warn' : 'low';
    return (_jsxs("div", { className: `rp2-pct rp2-pct--${tone}`, title: percent != null ? `${percent}%` : t('timeTrackingPage.reports.entryLog.noData'), children: [_jsx("div", { className: "rp2-pct__track", "aria-hidden": true, children: _jsx("div", { className: "rp2-pct__fill", style: { width: hasValue ? `${Math.round(ratio * 100)}%` : '0%' } }) }), _jsx("span", { className: "rp2-pct__value", children: percent != null ? `${percent}%` : '—' })] }));
}
export function TimeUserRows({ users, groupBy, entryGroupContext, }) {
    return (_jsx("div", { className: "rp2__users", role: "rowgroup", children: users.map((u) => (_jsxs("div", { className: "rp2__user", role: "row", children: [_jsxs("div", { className: "rp2__user-head", children: [_jsxs("div", { className: "rp2__user-name", children: [_jsx("span", { className: "rp2__user-avatar", "aria-hidden": true, children: (u.user_name || '?').charAt(0).toUpperCase() }), _jsx("span", { className: "rp2__user-label", children: u.user_name })] }), _jsx("div", { className: "rp2-num rp2__user-metric", children: fmtH(u.total_hours) }), _jsx("div", { className: "rp2-num rp2__user-metric", children: fmtH(u.billable_hours) }), _jsx("div", { className: "rp2__user-metric rp2__user-metric--pct", children: _jsx(PctBar, { a: u.billable_hours, b: u.total_hours }) }), _jsx("div", { className: "rp2-num rp2__user-metric rp2__user-metric--amount", children: fmtAmtWithIso(u.billable_amount, u.currency) })] }), u.entries?.length ? (_jsx("div", { className: "rp2__user-entries", children: _jsx(TimeEntryLogDetails, { entries: u.entries, entriesTotal: u.entries_total, entriesTruncated: u.entries_truncated, currency: u.currency, entryGroupContext: entryGroupContext, userBillableRollup: {
                            total_hours: u.total_hours,
                            billable_hours: u.billable_hours,
                            billable_amount: u.billable_amount,
                        }, groupBy: groupBy }) })) : null] }, `${u.user_id}|${String(u.currency ?? '').trim() || '—'}`))) }));
}
