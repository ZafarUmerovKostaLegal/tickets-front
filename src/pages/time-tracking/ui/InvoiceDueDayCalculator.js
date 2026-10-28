import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useI18n } from '@shared/i18n';
import { dueDateFromCalendarDays, invoiceCalendarDayCount, invoiceWorkingDayCount } from '../lib/invoiceDueDays';
export function InvoiceDueDayCalculator({ issueDate, dueDate, onDueDateChange }) {
    const { t } = useI18n();
    const [includeEnd, setIncludeEnd] = useState(false);
    const [daysDraft, setDaysDraft] = useState(null);
    const calendarDays = invoiceCalendarDayCount(issueDate, dueDate, false);
    const workingDays = invoiceWorkingDayCount(issueDate, dueDate, includeEnd);
    const daysValue = daysDraft ?? (calendarDays == null ? '' : String(calendarDays));
    function applyDays(raw) {
        const trimmed = raw.trim();
        if (!/^\d+$/.test(trimmed))
            return;
        const nextDue = dueDateFromCalendarDays(issueDate, Number(trimmed), false);
        if (nextDue && nextDue !== dueDate.slice(0, 10))
            onDueDateChange(nextDue);
    }
    return (_jsxs("div", { className: "tt-inv-daycalc", children: [_jsxs("label", { className: "tt-inv-daycalc__row tt-inv-daycalc__row--days", children: [_jsx("input", { type: "text", inputMode: "numeric", className: "tt-inv-dialog__control tt-inv-daycalc__input", value: daysValue, "aria-label": t('timeTrackingPage.invoices.detail.calendarDays'), onChange: (event) => {
                            const next = event.target.value.replace(/[^\d]/g, '');
                            setDaysDraft(next);
                            applyDays(next);
                        }, onBlur: () => setDaysDraft(null) }), _jsx("span", { className: "tt-inv-daycalc__unit", children: t('timeTrackingPage.invoices.detail.calendarDays') })] }), _jsxs("div", { className: "tt-inv-daycalc__row tt-inv-daycalc__row--work", children: [_jsx("input", { type: "text", className: "tt-inv-dialog__control tt-inv-daycalc__input", value: workingDays == null ? '' : String(workingDays), readOnly: true, tabIndex: -1, "aria-label": t('timeTrackingPage.invoices.detail.workingDays') }), _jsx("span", { className: "tt-inv-daycalc__unit", children: t('timeTrackingPage.invoices.detail.workingDays') })] }), _jsxs("label", { className: "tt-inv-daycalc__check", children: [_jsx("input", { type: "checkbox", checked: includeEnd, onChange: (event) => {
                            setIncludeEnd(event.target.checked);
                            setDaysDraft(null);
                        } }), t('timeTrackingPage.invoices.detail.includeEndDate')] })] }));
}
