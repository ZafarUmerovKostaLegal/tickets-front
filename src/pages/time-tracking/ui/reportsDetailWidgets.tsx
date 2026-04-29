import type { RUBTime, TimeReportEntryLogItem, } from '@entities/time-tracking';
import {
    fmtH,
    fmtAmtWithIso,
    formatIsoTimeOnlyRu,
    formatReportWorkDate,
} from '@entities/time-tracking/lib/reportsFormatUtils';
import {
    type TimeEntryLogGroupContext,
    type UserBillableRollup,
    type TimeEntryLogGroupBy,
    entryComment,
    entryTaskLabel,
    deriveBillableHoursForEntry,
    deriveBillableAmountForEntry,
    billablePaidLabel,
    billableChipClass,
} from '@entities/time-tracking/lib/timeReportEntryLogFormat';

export const IcoExpand = ({ open }: {
    open: boolean;
}) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
  <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
</svg>);

export function TimeEntryLogDetails({ entries, entriesTotal, entriesTruncated, currency: defaultCurrency = '', entryGroupContext, userBillableRollup, groupBy, }: {
    entries?: TimeReportEntryLogItem[];
    entriesTotal?: number;
    entriesTruncated?: boolean;
    currency?: string;
    entryGroupContext?: TimeEntryLogGroupContext | null;
    userBillableRollup?: UserBillableRollup | null;
    groupBy?: TimeEntryLogGroupBy;
}) {
    const n = entriesTotal ?? entries?.length ?? 0;
    if (!entries?.length)
        return null;
    const ctx = entryGroupContext ?? undefined;
    const showProject = groupBy !== 'projects';
    const showClient = groupBy !== 'clients' && groupBy !== 'projects';
    const showTask = true;
    const colClass = `rp2-entries__table rp2-entries__table--${[showProject, showClient, showTask].filter(Boolean).length}ctx`;
    return (<div className="rp2-entries" onClick={(e) => e.stopPropagation()}>
    <div className="rp2-entries__caption" aria-label={`Записей времени: ${n}`}>
      <span className="rp2-entries__caption-label">Записи времени</span>
      <span className="rp2-entries__summary-count">{n}</span>
    </div>
    <div className={colClass}>
      <div className="rp2-entries__head" role="row">
        <div role="columnheader">Дата</div>
        <div role="columnheader">Время</div>
        <div className="rp2-num" role="columnheader">Часы</div>
        <div className="rp2-num" role="columnheader">Оплач.</div>
        <div className="rp2-num" role="columnheader">Сумма</div>
        <div role="columnheader">Статус</div>
        {showProject && <div role="columnheader">Проект</div>}
        {showClient && <div role="columnheader">Клиент</div>}
        {showTask && <div role="columnheader">Задача</div>}
        <div role="columnheader">Комментарий</div>
      </div>
      {entries.map((it, idx) => {
            const cur = (it.billable_currency ?? it.billableCurrency ?? it.currency ?? defaultCurrency ?? '').trim();
            const billH = deriveBillableHoursForEntry(it, userBillableRollup);
            const billAmt = deriveBillableAmountForEntry(it, userBillableRollup);
            const billLabel = billablePaidLabel(it, billH, it.hours);
            const key = it.id ?? it.time_entry_id ?? `${it.recorded_at}-${idx}`;
            const projectCell = (it.project_name ?? ctx?.project_name ?? '').trim() || '—';
            const clientCell = (it.client_name ?? ctx?.client_name ?? '').trim() || '—';
            const taskCell = entryTaskLabel(it, ctx);
            const comment = entryComment(it);
            const dateText = formatReportWorkDate(it.work_date);
            const timeText = formatIsoTimeOnlyRu(it.recorded_at);
            const amountText = billAmt != null ? fmtAmtWithIso(billAmt, cur || defaultCurrency) : '—';
            return (<div className="rp2-entries__row" role="row" key={key}>
          <div className="rp2-entries__cell rp2-entries__cell--date" title={dateText}>
            {dateText}
          </div>
          <div className="rp2-entries__cell rp2-entries__cell--time" title={timeText}>
            {timeText}
          </div>
          <div className="rp2-entries__cell rp2-num">{fmtH(it.hours)}</div>
          <div className="rp2-entries__cell rp2-num">{billH != null ? fmtH(billH) : '—'}</div>
          <div className="rp2-entries__cell rp2-num rp2-entries__cell--amount" title={amountText}>
            {amountText}
          </div>
          <div className="rp2-entries__cell">
            <span className={billableChipClass(billLabel)}>{billLabel}</span>
          </div>
          {showProject && (<div className="rp2-entries__cell rp2-entries__cell--text" title={projectCell}>
            {projectCell}
          </div>)}
          {showClient && (<div className="rp2-entries__cell rp2-entries__cell--text" title={clientCell}>
            {clientCell}
          </div>)}
          {showTask && (<div className="rp2-entries__cell rp2-entries__cell--text" title={taskCell}>
            {taskCell}
          </div>)}
          <div className="rp2-entries__cell rp2-entries__cell--text rp2-entries__cell--note" title={comment || undefined}>
            {comment || <span className="rp2-muted">—</span>}
          </div>
        </div>);
        })}
    </div>
    {entriesTruncated && entriesTotal != null && entriesTotal > entries.length ? (<p className="rp2-entries__note">
      Показаны последние {entries.length} из {entriesTotal}
    </p>) : null}
  </div>);
}

export function PctBar({ a, b, }: {
    a: number | undefined | null;
    b: number | undefined | null;
}) {
    const hasValue = a != null && b != null && Number.isFinite(a) && Number.isFinite(b) && b > 0;
    const ratio = hasValue ? Math.max(0, Math.min(1, (a as number) / (b as number))) : 0;
    const percent = hasValue ? Math.round(ratio * 100) : null;
    const tone = percent == null ? 'muted' : percent >= 80 ? 'ok' : percent >= 40 ? 'warn' : 'low';
    return (<div className={`rp2-pct rp2-pct--${tone}`} title={percent != null ? `${percent}%` : 'нет данных'}>
    <div className="rp2-pct__track" aria-hidden>
      <div className="rp2-pct__fill" style={{ width: hasValue ? `${Math.round(ratio * 100)}%` : '0%' }} />
    </div>
    <span className="rp2-pct__value">{percent != null ? `${percent}%` : '—'}</span>
  </div>);
}

export function TimeUserRows({ users, groupBy, entryGroupContext, }: {
    users: RUBTime[];
    groupBy: TimeEntryLogGroupBy;
    entryGroupContext?: TimeEntryLogGroupContext | null;
}) {
    return (<div className="rp2__users" role="rowgroup">
    {users.map((u) => (<div key={`${u.user_id}|${String(u.currency ?? '').trim() || '—'}`} className="rp2__user" role="row">
      <div className="rp2__user-head">
        <div className="rp2__user-name">
          <span className="rp2__user-avatar" aria-hidden>
            {(u.user_name || '?').charAt(0).toUpperCase()}
          </span>
          <span className="rp2__user-label">{u.user_name}</span>
        </div>
        <div className="rp2-num rp2__user-metric">{fmtH(u.total_hours)}</div>
        <div className="rp2-num rp2__user-metric">{fmtH(u.billable_hours)}</div>
        <div className="rp2__user-metric rp2__user-metric--pct">
          <PctBar a={u.billable_hours} b={u.total_hours} />
        </div>
        <div className="rp2-num rp2__user-metric rp2__user-metric--amount">
          {fmtAmtWithIso(u.billable_amount, u.currency)}
        </div>
      </div>
      {u.entries?.length ? (<div className="rp2__user-entries">
        <TimeEntryLogDetails entries={u.entries} entriesTotal={u.entries_total} entriesTruncated={u.entries_truncated} currency={u.currency} entryGroupContext={entryGroupContext} userBillableRollup={{
                total_hours: u.total_hours,
                billable_hours: u.billable_hours,
                billable_amount: u.billable_amount,
            }} groupBy={groupBy} />
      </div>) : null}
    </div>))}
  </div>);
}
