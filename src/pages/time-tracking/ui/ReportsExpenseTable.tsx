import { Fragment } from 'react';
import { displayReportClientLabel, displayReportProjectLabel, formatExpenseReportStatus, formatExpenseReportStatusHint, type ExpRowClients, type ExpRowProjects, type ExpRowCategories, type ExpRowTeam, type RUBExpense, } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { fmtAmt, pct } from '@entities/time-tracking/lib/reportsFormatUtils';
import type { ExpenseGroup } from '@entities/time-tracking/model/reportsPanelConfig';
import { IcoExpand } from './reportsDetailWidgets';

function ExpenseUserRows({ users, currency }: {
  users: RUBExpense[];
  currency: string;
}) {
  const { t } = useI18n();
  return (<>
    {users.map((u, i) => (<tr key={`${u.user_id}-${i}`} className="rp-table__sub-row">
      <td className="rp-table__sub-indent">
        <span className="rp-table__sub-icon">↳</span>
        <span>{u.user_name?.trim() ? u.user_name : t('timeTrackingPage.reports.expenseTable.employeeFallback').replace('{id}', String(u.user_id))}</span>
      </td>
      <td className="rp-table__num">{fmtAmt(u.total_amount, currency)}</td>
      <td className="rp-table__num">{fmtAmt(u.billable_amount, currency)}</td>
      <td className="rp-table__num">{pct(u.billable_amount, u.total_amount)}</td>
      <td className="rp-table__status" title={formatExpenseReportStatusHint(u.status ?? u.expense_status)}>
        {formatExpenseReportStatus(u.status ?? u.expense_status)}
      </td>
      <td />
    </tr>))}
  </>);
}
function expenseClientsRowKey(r: ExpRowClients, index: number): string {
    const gid = r.report_group_id?.trim();
    if (gid)
        return gid;
    const cid = String(r.client_id ?? '').trim();
    const cur = String(r.group_currency ?? r.currency ?? '').trim() || '—';
    if (cid)
        return `${cid}|${cur}`;
    return `exp-cli-${index}|${cur}`;
}
function expenseProjectsRowKey(r: ExpRowProjects, index: number): string {
    const gid = r.report_group_id?.trim();
    if (gid)
        return gid;
    const pid = String(r.project_id ?? '').trim();
    const cur = String(r.group_currency ?? r.currency ?? '').trim() || '—';
    if (pid)
        return `${pid}|${cur}`;
    return `exp-prj-${index}|${cur}`;
}
export function ExpenseTable({ groupBy, rows, expanded, onToggle, }: {
  groupBy: ExpenseGroup;
  rows: (ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam)[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  if (groupBy === 'team') {
    const teamRows = rows as ExpRowTeam[];
    return (<table className="tt-reports__table rp-table">
      <thead>
        <tr>
          <th>{t('timeTrackingPage.reports.expenseTable.employee')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.totalExpenses')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursable')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursablePct')}</th>
        </tr>
      </thead>
      <tbody>
        {teamRows.map((r) => (<tr key={r.user_id}>
          <td>
            {r.user_name}
            {r.is_contractor && <span className="rp-badge rp-badge--muted">{t('timeTrackingPage.reports.expenseTable.contractor')}</span>}
          </td>
          <td className="rp-table__num">{fmtAmt(r.total_amount, r.currency)}</td>
          <td className="rp-table__num">{fmtAmt(r.billable_amount, r.currency)}</td>
          <td className="rp-table__num">{pct(r.billable_amount, r.total_amount)}</td>
        </tr>))}
      </tbody>
    </table>);
  }
  if (groupBy === 'clients') {
    const clientRows = rows as ExpRowClients[];
    return (<table className="tt-reports__table rp-table">
      <thead>
        <tr>
          <th>{t('timeTrackingPage.reports.expenseTable.client')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.totalExpenses')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursable')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursablePct')}</th>
          <th>{t('timeTrackingPage.reports.expenseTable.status')}</th>
          <th className="rp-table__expand-col" aria-label={t('timeTrackingPage.reports.table.expand')} />
        </tr>
      </thead>
      <tbody>
        {clientRows.map((r, idx) => {
          const key = expenseClientsRowKey(r, idx);
          const isOpen = expanded.has(key);
          return (<Fragment key={key}>
            <tr className="rp-table__group-row" onClick={() => r.users?.length && onToggle(key)}>
              <td className="rp-table__name-cell">{displayReportClientLabel(r.client_name, r.client_id)}</td>
              <td className="rp-table__num">{fmtAmt(r.total_amount, r.currency)}</td>
              <td className="rp-table__num">{fmtAmt(r.billable_amount, r.currency)}</td>
              <td className="rp-table__num">{pct(r.billable_amount, r.total_amount)}</td>
              <td className="rp-table__muted">{t('timeTrackingPage.reports.expenseTable.statusByEmployee')}</td>
              <td className="rp-table__expand-col">
                {r.users?.length ? <button type="button" className="rp-table__expand-btn" aria-expanded={isOpen}><IcoExpand open={isOpen} /></button> : null}
              </td>
            </tr>
            {isOpen && <ExpenseUserRows users={r.users ?? []} currency={r.currency} />}
          </Fragment>);
        })}
      </tbody>
    </table>);
  }
  if (groupBy === 'categories') {
    const catRows = rows as ExpRowCategories[];
    return (<table className="tt-reports__table rp-table">
      <thead>
        <tr>
          <th>{t('timeTrackingPage.reports.expenseTable.category')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.totalExpenses')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursable')}</th>
          <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursablePct')}</th>
          <th>{t('timeTrackingPage.reports.expenseTable.status')}</th>
          <th className="rp-table__expand-col" aria-label={t('timeTrackingPage.reports.table.expand')} />
        </tr>
      </thead>
      <tbody>
        {catRows.map((r, i) => {
          const key = r.expense_category_id ?? `cat-${i}`;
          const isOpen = expanded.has(key);
          return (<Fragment key={key}>
            <tr className="rp-table__group-row" onClick={() => r.users?.length && onToggle(key)}>
              <td className="rp-table__name-cell">{r.expense_category_name || '—'}</td>
              <td className="rp-table__num">{fmtAmt(r.total_amount, r.currency)}</td>
              <td className="rp-table__num">{fmtAmt(r.billable_amount, r.currency)}</td>
              <td className="rp-table__num">{pct(r.billable_amount, r.total_amount)}</td>
              <td className="rp-table__muted">{t('timeTrackingPage.reports.expenseTable.statusByEmployee')}</td>
              <td className="rp-table__expand-col">
                {r.users?.length ? <button type="button" className="rp-table__expand-btn" aria-expanded={isOpen}><IcoExpand open={isOpen} /></button> : null}
              </td>
            </tr>
            {isOpen && <ExpenseUserRows users={r.users ?? []} currency={r.currency} />}
          </Fragment>);
        })}
      </tbody>
    </table>);
  }
  const projectRows = rows as ExpRowProjects[];
  return (<table className="tt-reports__table rp-table">
    <thead>
      <tr>
        <th>{t('timeTrackingPage.reports.expenseTable.project')}</th>
        <th>{t('timeTrackingPage.reports.expenseTable.client')}</th>
        <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.totalExpenses')}</th>
        <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursable')}</th>
        <th className="rp-table__num">{t('timeTrackingPage.reports.expenseTable.reimbursablePct')}</th>
        <th>{t('timeTrackingPage.reports.expenseTable.status')}</th>
        <th className="rp-table__expand-col" aria-label={t('timeTrackingPage.reports.table.expand')} />
      </tr>
    </thead>
    <tbody>
      {projectRows.map((r, idx) => {
        const key = expenseProjectsRowKey(r, idx);
        const isOpen = expanded.has(key);
        return (<Fragment key={key}>
          <tr className="rp-table__group-row" onClick={() => r.users?.length && onToggle(key)}>
            <td className="rp-table__name-cell rp-table__name-cell--bold">{displayReportProjectLabel(r.project_name, r.project_id)}</td>
            <td className="rp-table__muted">{displayReportClientLabel(r.client_name, r.client_id)}</td>
            <td className="rp-table__num">{fmtAmt(r.total_amount, r.currency)}</td>
            <td className="rp-table__num">{fmtAmt(r.billable_amount, r.currency)}</td>
            <td className="rp-table__num">{pct(r.billable_amount, r.total_amount)}</td>
            <td className="rp-table__muted">{t('timeTrackingPage.reports.expenseTable.statusByEmployee')}</td>
            <td className="rp-table__expand-col">
              {r.users?.length ? <button type="button" className="rp-table__expand-btn" aria-expanded={isOpen}><IcoExpand open={isOpen} /></button> : null}
            </td>
          </tr>
          {isOpen && <ExpenseUserRows users={r.users ?? []} currency={r.currency} />}
        </Fragment>);
      })}
    </tbody>
  </table>);
}
