import { type BudgetRow, type RUBBudget, } from '@entities/time-tracking';
import { budgetReportHoursMetrics, budgetReportMoneyMetrics, budgetReportRowProgressPercent } from '@entities/time-tracking/lib/projectBudgetReportMetrics';
import { useI18n } from '@shared/i18n';
import { fmtH, fmtAmt } from '@entities/time-tracking/lib/reportsFormatUtils';

const IcoChevDown = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M6 9l6 6 6-6" />
</svg>);
function BudgetProgress({ budget, spent, budgetBy, currency, compact = false, }: {
  budget: number | null | undefined;
  spent: number | null | undefined;
  budgetBy: 'hours' | 'money';
  currency?: string;
  compact?: boolean;
}) {
  const b = budget ?? 0;
  const s = spent ?? 0;
  const hasBudget = b > 0;
  const ratio = hasBudget ? s / b : 0;
  const pctVal = hasBudget ? Math.round(ratio * 100) : 0;
  const tone: 'none' | 'ok' | 'warn' | 'danger' | 'over' = !hasBudget ? 'none' : pctVal >= 100 ? 'over' : pctVal >= 90 ? 'danger' : pctVal >= 75 ? 'warn' : 'ok';
  const fmtNum = (n: number) => (budgetBy === 'hours'
    ? fmtH(n)
    : `${Math.round(n).toLocaleString('ru-RU')}${currency ? ` ${currency}` : ''}`);
  const label = hasBudget ? `${fmtNum(s)} / ${fmtNum(b)}` : fmtNum(s);
  const widthMain = hasBudget ? Math.min(100, pctVal) : 0;
  const widthOver = hasBudget && pctVal > 100 ? Math.min(100, pctVal - 100) : 0;
  const pctLabel = hasBudget ? `${pctVal}%` : '—';
  return (<div className={`rpb-progress rpb-progress--${tone}${compact ? ' rpb-progress--compact' : ''}`}>
    <div className="rpb-progress__track" aria-hidden>
      <div className="rpb-progress__fill" style={{ width: `${widthMain}%` }} />
      {widthOver > 0 && (<div className="rpb-progress__overfill" style={{ width: `${widthOver}%` }} />)}
    </div>
    <div className="rpb-progress__meta">
      <span className="rpb-progress__label" title={`${label} · ${pctLabel}`}>{label}</span>
      <span className="rpb-progress__pct">{pctLabel}</span>
    </div>
  </div>);
}
function BudgetUserSubRows({ users, row }: {
  users: RUBBudget[];
  row: BudgetRow;
}) {
  const { t } = useI18n();
  if (!users?.length)
    return null;
  const cur = (row.currency ?? '').trim();
  const hh = budgetReportHoursMetrics(row);
  const mm = budgetReportMoneyMetrics(row);
  const budgetBy = row.budget_by;
  return (<div className="rpb__users" role="rowgroup">
    {users.map((u) => {
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
      let primary: string;
      let secondary: string;
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
      return (<div key={u.user_id} className="rpb__user" role="row">
        <div className="rpb__user-name">
          <span className="rpb__user-avatar" aria-hidden>{initial}</span>
          <span className="rpb__user-label" title={u.user_name}>{u.user_name}</span>
        </div>
        <div className="rpb__user-spacer" />
        <div className="rpb__user-spacer" />
        <div className="rpb__user-spacer" />
        <div className="rpb__user-metric rpb-num">
          <span className="rpb__user-metric-value">{primary}</span>
          {secondary ? (<span className="rpb__user-metric-sub">{secondary}</span>) : null}
        </div>
        <div className="rpb__user-spacer" />
        <div className="rpb__user-share" title={t('timeTrackingPage.reports.budgetTable.shareTitle').replace('{pct}', String(sharePct))}>
          <div className="rpb__user-share-track" aria-hidden>
            <div className="rpb__user-share-fill" style={{ width: `${sharePct}%` }} />
          </div>
          <span className="rpb__user-share-pct">{sharePct}%</span>
        </div>
        <div className="rpb__user-spacer" />
      </div>);
    })}
  </div>);
}
export function BudgetTable({ rows, expanded, onToggle, }: {
  rows: BudgetRow[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  if (!rows.length)
    return null;
  return (<div className="rpb" role="table" aria-label={t('timeTrackingPage.reports.budgetTable.aria')}>
    <div className="rpb__head" role="row">
      <div role="columnheader">{t('timeTrackingPage.reports.budgetTable.project')}</div>
      <div role="columnheader">{t('timeTrackingPage.reports.budgetTable.client')}</div>
      <div role="columnheader">{t('timeTrackingPage.reports.budgetTable.type')}</div>
      <div className="rpb-num" role="columnheader">{t('timeTrackingPage.reports.budgetTable.budget')}</div>
      <div className="rpb-num" role="columnheader">{t('timeTrackingPage.reports.budgetTable.spent')}</div>
      <div className="rpb-num" role="columnheader">{t('timeTrackingPage.reports.budgetTable.remaining')}</div>
      <div role="columnheader">{t('timeTrackingPage.reports.budgetTable.progress')}</div>
      <div role="columnheader" aria-label={t('timeTrackingPage.reports.table.expand')} />
    </div>
    {rows.map((r) => {
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
      const fmtMoneyCell = (n: number | null | undefined) => {
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
        ? (<>
            <div>{fmtH(hh.budget)}</div>
            <div className="rpb__cell-sub">{fmtMoneyCell(mm.budget)}</div>
          </>)
        : r.budget_by === 'hours'
          ? fmtH(r.budget)
          : fmtMoneyCell(r.budget);
      const spentCell = r.budget_by === 'hours_and_money'
        ? (<>
            <div>{fmtH(hh.spent)}</div>
            <div className="rpb__cell-sub">{fmtMoneyCell(mm.spent)}</div>
          </>)
        : r.budget_by === 'hours'
          ? fmtH(r.budget_spent)
          : fmtMoneyCell(r.budget_spent);
      const remCell = r.budget_by === 'hours_and_money'
        ? (<>
            <div>{fmtH(hh.remaining)}</div>
            <div className="rpb__cell-sub">{fmtMoneyCell(mm.remaining)}</div>
          </>)
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
      return (<div key={key} className="rpb__group">
        <div className={`rpb__row ${stateClass}${hasUsers ? ' rpb__row--clickable' : ''}`} onClick={() => hasUsers && onToggle(key)} onKeyDown={(e) => {
          if (!hasUsers)
            return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(key);
          }
        }} role="row" tabIndex={hasUsers ? 0 : -1} aria-expanded={hasUsers ? isOpen : undefined}>
          <div className="rpb__project" role="cell">
            <span className="rpb__project-name" title={r.project_name}>{r.project_name}</span>
            <span className="rpb__project-tags">
              {!r.is_active && <span className="rpb-tag rpb-tag--muted">{t('timeTrackingPage.reports.budgetTable.archived')}</span>}
              {r.budget_is_monthly && <span className="rpb-tag rpb-tag--info">{t('timeTrackingPage.reports.budgetTable.monthly')}</span>}
              {isOver && <span className="rpb-tag rpb-tag--danger">{t('timeTrackingPage.reports.budgetTable.overBudget')}</span>}
            </span>
          </div>
          <div className="rpb__client" role="cell" title={r.client_name}>{r.client_name || '—'}</div>
          <div className="rpb__type" role="cell">{unitLabel}</div>
          <div className="rpb__metric rpb-num" role="cell">{budgetCell}</div>
          <div className="rpb__metric rpb-num" role="cell">{spentCell}</div>
          <div className={`rpb__metric rpb-num${remainderNegative ? ' rpb__metric--negative' : ''}`} role="cell">
            {remCell}
          </div>
          <div className="rpb__progress-cell" role="cell">
            {r.budget_by === 'hours_and_money'
              ? (<div className="rpb__dual-progress">
                  <BudgetProgress compact budget={hh.budget} spent={hh.spent} budgetBy="hours" />
                  <BudgetProgress compact budget={mm.budget} spent={mm.spent} budgetBy="money" currency={cur} />
                </div>)
              : (<BudgetProgress budget={r.budget} spent={r.budget_spent} budgetBy={r.budget_by === 'hours' ? 'hours' : 'money'} currency={cur} />)}
          </div>
          <div className="rpb__chev" role="cell" aria-hidden>
            {hasUsers ? (<span className={`rpb__chev-icon${isOpen ? ' rpb__chev-icon--open' : ''}`}>
              <IcoChevDown />
            </span>) : null}
          </div>
        </div>
        {isOpen && hasUsers && (<BudgetUserSubRows users={r.users ?? []} row={r} />)}
      </div>);
    })}
  </div>);
}
