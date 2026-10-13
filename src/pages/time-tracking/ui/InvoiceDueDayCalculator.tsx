import { useState } from 'react';
import { useI18n } from '@shared/i18n';
import { dueDateFromCalendarDays, invoiceCalendarDayCount, invoiceWorkingDayCount } from '../lib/invoiceDueDays';

type InvoiceDueDayCalculatorProps = {
    issueDate: string;
    dueDate: string;
    onDueDateChange: (iso: string) => void;
};

export function InvoiceDueDayCalculator({ issueDate, dueDate, onDueDateChange }: InvoiceDueDayCalculatorProps) {
    const { t } = useI18n();
    const [includeEnd, setIncludeEnd] = useState(false);
    const [daysDraft, setDaysDraft] = useState<string | null>(null);
    const calendarDays = invoiceCalendarDayCount(issueDate, dueDate, false);
    const workingDays = invoiceWorkingDayCount(issueDate, dueDate, includeEnd);
    const daysValue = daysDraft ?? (calendarDays == null ? '' : String(calendarDays));

    function applyDays(raw: string) {
        const trimmed = raw.trim();
        if (!/^\d+$/.test(trimmed))
            return;
        const nextDue = dueDateFromCalendarDays(issueDate, Number(trimmed), false);
        if (nextDue && nextDue !== dueDate.slice(0, 10))
            onDueDateChange(nextDue);
    }

    return (
        <div className="tt-inv-daycalc">
            <label className="tt-inv-daycalc__row tt-inv-daycalc__row--days">
                <input
                    type="text"
                    inputMode="numeric"
                    className="tt-inv-dialog__control tt-inv-daycalc__input"
                    value={daysValue}
                    aria-label={t('timeTrackingPage.invoices.detail.calendarDays')}
                    onChange={(event) => {
                        const next = event.target.value.replace(/[^\d]/g, '');
                        setDaysDraft(next);
                        applyDays(next);
                    }}
                    onBlur={() => setDaysDraft(null)}
                />
                <span className="tt-inv-daycalc__unit">{t('timeTrackingPage.invoices.detail.calendarDays')}</span>
            </label>
            <div className="tt-inv-daycalc__row tt-inv-daycalc__row--work">
                <input
                    type="text"
                    className="tt-inv-dialog__control tt-inv-daycalc__input"
                    value={workingDays == null ? '' : String(workingDays)}
                    readOnly
                    tabIndex={-1}
                    aria-label={t('timeTrackingPage.invoices.detail.workingDays')}
                />
                <span className="tt-inv-daycalc__unit">{t('timeTrackingPage.invoices.detail.workingDays')}</span>
            </div>
            <label className="tt-inv-daycalc__check">
                <input
                    type="checkbox"
                    checked={includeEnd}
                    onChange={(event) => {
                        setIncludeEnd(event.target.checked);
                        setDaysDraft(null);
                    }}
                />
                {t('timeTrackingPage.invoices.detail.includeEndDate')}
            </label>
        </div>
    );
}
