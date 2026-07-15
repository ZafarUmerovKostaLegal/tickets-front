import { type UninvoicedRow, type RUBUninvoiced, } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { fmtH, fmtAmt } from '@entities/time-tracking/lib/reportsFormatUtils';
import { IcoExpand } from './reportsDetailWidgets';

function UninvoicedUserRows({ users, currency }: {
  users: RUBUninvoiced[];
  currency: string;
}) {
  return (<>
    {users.map((u) => (<tr key={u.user_id} className="rp-table__sub-row">
      <td className="rp-table__sub-indent" colSpan={3}>
        <span className="rp-table__sub-icon">↳</span>
        <span>{u.user_name}</span>
      </td>
      <td className="rp-table__num">{fmtH(u.uninvoiced_hours)}</td>
      <td className="rp-table__num">{fmtAmt(u.uninvoiced_amount, u.currency ?? currency)}</td>
      <td />
      <td />
    </tr>))}
  </>);
}
export function UninvoicedTable({ rows, expanded, onToggle, }: {
  rows: UninvoicedRow[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  return (<table className="tt-reports__table rp-table">
    <thead>
      <tr>
        <th>{t('timeTrackingPage.reports.uninvoicedTable.project')}</th>
        <th>{t('timeTrackingPage.reports.uninvoicedTable.client')}</th>
        <th>{t('timeTrackingPage.reports.uninvoicedTable.currency')}</th>
        <th className="rp-table__num">{t('timeTrackingPage.reports.uninvoicedTable.billableHours')}</th>
        <th className="rp-table__num">{t('timeTrackingPage.reports.uninvoicedTable.uninvoicedHours')}</th>
        <th className="rp-table__num">{t('timeTrackingPage.reports.uninvoicedTable.uninvoicedAmount')}</th>
        <th className="rp-table__num">{t('timeTrackingPage.reports.uninvoicedTable.uninvoicedExpenses')}</th>
        <th className="rp-table__expand-col" aria-label={t('timeTrackingPage.reports.table.expand')} />
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => {
        const key = r.project_id;
        const isOpen = expanded.has(key);
        return (<>
          <tr key={key} className="rp-table__group-row" onClick={() => r.users?.length && onToggle(key)}>
            <td className="rp-table__name-cell rp-table__name-cell--bold">{r.project_name}</td>
            <td className="rp-table__muted">{r.client_name}</td>
            <td>{r.currency}</td>
            <td className="rp-table__num">{fmtH(r.total_hours)}</td>
            <td className="rp-table__num rp-table__num--accent">{fmtH(r.uninvoiced_hours)}</td>
            <td className="rp-table__num rp-table__num--accent">{fmtAmt(r.uninvoiced_amount, r.currency)}</td>
            <td className="rp-table__num">{fmtAmt(r.uninvoiced_expenses, r.currency)}</td>
            <td className="rp-table__expand-col">
              {r.users?.length ? <button type="button" className="rp-table__expand-btn" aria-expanded={isOpen}><IcoExpand open={isOpen} /></button> : null}
            </td>
          </tr>
          {isOpen && <UninvoicedUserRows users={r.users ?? []} currency={r.currency} />}
        </>);
      })}
    </tbody>
  </table>);
}
