import { Fragment, useState, useEffect, useRef, useMemo, useCallback, useId, memo, } from 'react';
import './ReportsPanel.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { displayReportClientLabel, displayReportProjectLabel, formatExpenseReportStatus, formatExpenseReportStatusHint, fetchReportsMeta, fetchReportsUsersForFilter, fetchTimeReport, fetchExpenseReport, fetchUninvoicedReport, fetchBudgetReport, fetchAllTimeReportClientRows, fetchAllTimeReportProjectRows, fetchAllTimeReportTaskRows, fetchAllTimeReportTeamRows, fetchAllExpenseReportRows, fetchAllUninvoicedReportRows, fetchAllBudgetReportRows, exportReportV2, isTimeTrackingHttpError, listPartnerReportConfirmationsConfirmed, listPartnerReportConfirmationsPending, fetchAllInvoices, listAllClientProjectsMerged, getUserProjectAccess, submitPartnerReportConfirmationFromPreview, notifyPartnerConfirmedReportsListInvalidate, type ReportsFilterUser, type ReportPagination, type ReportTotals, type TimeRowClients, type TimeRowProjects, type TimeRowTasks, type TimeRowTeam, type TimeReportRow, type ExpRowClients, type ExpRowProjects, type ExpRowCategories, type ExpRowTeam, type UninvoicedRow, type BudgetRow, type ReportFiltersV2, type RUBExpense, type RUBUninvoiced, type RUBBudget, type PartnerReportConfirmationRequest, type InvoiceDto, } from '@entities/time-tracking';
import { budgetReportHoursMetrics, budgetReportMoneyMetrics, budgetReportRowProgressPercent } from '@entities/time-tracking/lib/projectBudgetReportMetrics';
import { ReportsSkeleton } from './ReportsSkeleton';
import { ConfirmedPartnerReportsPanel } from './ConfirmedPartnerReportsPanel';
import { ForReviewReportsPanel } from './ForReviewReportsPanel';
import { DatePicker } from '@shared/ui/DatePicker';
import { useAppDialog } from '@shared/ui';
import { useI18n, ttReportGroupLabel, ttReportPeriodLabel, ttReportTypeLabel } from '@shared/i18n';
import { writeReportPreviewTransfer, type ReportPreviewTransferV2, type ReportPreviewTimeGroup, type ReportPreviewPeriodState, } from '@entities/time-tracking/model/reportPreviewTransfer';
import {
  type ReportTypeV2,
  type TimeGroup,
  type ExpenseGroup,
  type GroupByV2,
  type PeriodGranularity,
  type ReportsSection,
  type PartnerConfirmedSubview,
  REPORT_TYPES,
  GROUPS_FOR_TYPE,
  DEFAULT_GROUP,
  PERIOD_OPTIONS,
  PER_PAGE,
  migrateStoredReportType,
  isExpenseLikeReportType,
  coerceGroupByForType,
  isReportsSection,
  isPartnerConfirmedSubview,
  normalizeReportsSection,
} from '@entities/time-tracking/model/reportsPanelConfig';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from '@entities/time-tracking/model/partnerConfirmedReports';
import { hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { readReportsPrefsFromStorage, writeReportsPrefsToStorage, readInitialReportsRangeState } from '@entities/time-tracking/lib/reportsPrefsStorage';
import { isoDateLocal, parseIsoDateLocal, periodToDates, formatPeriodLabel, formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import {
  fmtH,
  fmtAmt,
  fmtAmtWithIso,
  sortCurrencyBuckets,
  pct,
} from '@entities/time-tracking/lib/reportsFormatUtils';
import { sortTimeReportRowsForDisplay, timeReportPhysicalRowKey, } from '@entities/time-tracking/lib/timeReportRows';
import {
  collectMyParticipatingProjectIds,
  partnerProjectClientIds,
  filterReportRowsByPartnerProjects,
} from '@entities/time-tracking/lib/partnerReportProjectScope';
import { badgeForProjectInReportWindow, buildClientPartnerBadgeMap, type TimeReportPartnerRowBadge, type TimeReportPartnerConfSlice, } from '@entities/time-tracking/lib/timeReportPartnerBadges';
import { usePartnerForReviewBadge } from '@entities/time-tracking/lib/usePartnerForReviewBadge';
import { ReportsUserFilterDropdown } from './ReportsUserFilterDropdown';
import { IcoExpand, PctBar, TimeUserRows } from './reportsDetailWidgets';
const IcoChevLeft = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M15 18l-6-6 6-6" />
</svg>);
const IcoChevRight = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M9 18l6-6-6-6" />
</svg>);
const IcoChevDown = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M6 9l6 6 6-6" />
</svg>);
const IcoDownload = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
</svg>);
const IcoBudget = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
</svg>);
function buildReportRowHaystack(row: unknown): string {
  if (!row || typeof row !== 'object')
    return '';
  const o = row as Record<string, unknown>;
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (v == null)
      return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      const s = String(v).trim();
      if (s)
        parts.push(s);
    }
  };
  for (const k of [
    'client_name',
    'project_name',
    'task_name',
    'user_name',
    'name',
    'code',
    'currency',
    'client_id',
    'task_id',
    'project_id',
    'invoiceNumber',
    'invoice_number',
    'expense_category_name',
    'project_code',
  ]) {
    push(o[k]);
  }
  push(o.user_id);
  const users = o.users;
      if (Array.isArray(users)) {
    for (const u of users) {
      if (u && typeof u === 'object') {
        const ur = u as Record<string, unknown>;
        push(ur.user_name);
        push(ur.display_name);
        push(ur.email);
        push(ur.status);
        push(ur.expense_status);
        push(ur.workflow_status);
      }
    }
  }
  return parts.join(' ').toLowerCase();
}
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
function partnerRowBadgeClasses(badge: TimeReportPartnerRowBadge): {
  row: string;
  dot: string;
} {
    if (badge === 'invoiced')
        return { row: ' rp2__group-row--partner-invoiced', dot: ' rp2__group-dot--partner-invoiced' };
    if (badge === 'confirmed')
        return { row: ' rp2__group-row--partner-confirmed', dot: ' rp2__group-dot--partner-confirmed' };
    return { row: '', dot: '' };
}
const TimeTable = memo(function TimeTable({ groupBy, rows, expanded, onToggle, onProjectRowPreview, projectRowPreviewDisabled, onClientRowPreview, clientRowPreviewDisabled, partnerProjectBadge, partnerClientBadge, }: {
  groupBy: TimeGroup;
  rows: TimeReportRow[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onProjectRowPreview?: (projectId: string) => void;
  projectRowPreviewDisabled?: boolean;
  onClientRowPreview?: (clientId: string) => void;
  clientRowPreviewDisabled?: boolean;
  partnerProjectBadge?: (projectId: string) => TimeReportPartnerRowBadge;
  partnerClientBadge?: (clientId: string) => TimeReportPartnerRowBadge;
}) {
  const { t } = useI18n();
  if (groupBy === 'clients') {
    const clientRows = rows as TimeRowClients[];
    const goClientPreview = onClientRowPreview;
    return (<div className="rp2 rp2--clients" role="table" aria-label={t('timeTrackingPage.reports.table.clientsAria')}>
      <div className="rp2__head" role="row">
        <div role="columnheader">{t('timeTrackingPage.reports.timeTable.client')}</div>
        <div className="rp2-num" role="columnheader">{t('timeTrackingPage.reports.timeTable.allHours')}</div>
        <div className="rp2-num" role="columnheader">{t('timeTrackingPage.reports.timeTable.billableHours')}</div>
        <div role="columnheader">{t('timeTrackingPage.reports.timeTable.billablePct')}</div>
        <div className="rp2-num" role="columnheader" title={t('timeTrackingPage.reports.table.amountTitle')}>{t('timeTrackingPage.reports.table.amount')}</div>
        <div className="rp2__head-chev" aria-hidden />
      </div>
      <div className="rp2__body" role="rowgroup">
        {clientRows.map((r) => {
          const key = timeReportPhysicalRowKey('clients', r);
          const isOpen = expanded.has(key);
          const canToggle = !!r.users?.length;
          const prevTitle = goClientPreview
            ? t('timeTrackingPage.reports.timeTable.clientPreviewTitle').replace('{name}', r.client_name)
            : undefined;
          const clientPreviewOff = !goClientPreview || Boolean(clientRowPreviewDisabled);
          const cliBadge = partnerClientBadge?.(r.client_id) ?? 'none';
          const cliClasses = partnerRowBadgeClasses(cliBadge);
          const cliPartnerNote = cliBadge === 'invoiced'
            ? t('timeTrackingPage.reports.partnerChip.overlapInvoiced')
            : cliBadge === 'confirmed'
              ? t('timeTrackingPage.reports.partnerChip.overlapConfirmed')
              : '';
          const clientAria = goClientPreview ? `${prevTitle ?? ''}${cliPartnerNote}`.trim() : undefined;
          return (<div key={key} className={`rp2__group${isOpen ? ' rp2__group--open' : ''}${canToggle ? '' : ' rp2__group--leaf'}`}>
            {canToggle ? (<>
              <div className="rp2__group-row rp2__group-row--split" role="row">
                <button type="button" className={`rp2__client-preview-btn${cliClasses.row}`} onClick={() => goClientPreview?.(r.client_id)} disabled={clientPreviewOff} title={goClientPreview ? clientAria : undefined} aria-label={goClientPreview ? clientAria : undefined}>
                  <span className={`rp2__group-name${cliBadge !== 'none' ? ' rp2__group-name--with-partner' : ''}`}>
                    <span className={`rp2__group-dot${cliClasses.dot}`} data-hash={key} aria-hidden />
                    <span className="rp2__group-title">{r.client_name}</span>
                    {cliBadge !== 'none' ? (<span className={cliBadge === 'invoiced' ? 'rp-partner-chip rp-partner-chip--invoiced' : 'rp-partner-chip rp-partner-chip--confirmed'}>{cliBadge === 'invoiced' ? t('timeTrackingPage.reports.partnerChip.invoiced') : t('timeTrackingPage.reports.partnerChip.confirmed')}</span>) : null}
                    {r.users?.length ? (<span className="rp2-tag rp2-tag--count">{r.users.length}</span>) : null}
                  </span>
                  <span className="rp2-num rp2__group-metric">{fmtH(r.total_hours)}</span>
                  <span className="rp2-num rp2__group-metric">{fmtH(r.billable_hours)}</span>
                  <span className="rp2__group-metric">
                    <PctBar a={r.billable_hours} b={r.total_hours} />
                  </span>
                  <span className="rp2-num rp2__group-metric rp2__group-metric--amount">
                    {fmtAmtWithIso(r.billable_amount, r.currency)}
                  </span>
                </button>
                <button type="button" className="rp2__client-expand-btn" onClick={() => onToggle(key)} aria-expanded={isOpen} aria-label={isOpen ? t('timeTrackingPage.reports.table.collapseEmployees') : t('timeTrackingPage.reports.table.expandEmployees')}>
                  <span className="rp2__group-chev" aria-hidden>
                    <IcoExpand open={isOpen} />
                  </span>
                </button>
              </div>
            </>) : (<button type="button" className={`rp2__group-row rp2__group-row--button${cliClasses.row}`} onClick={() => goClientPreview?.(r.client_id)} disabled={clientPreviewOff} title={goClientPreview ? clientAria : undefined} aria-label={goClientPreview ? clientAria : undefined}>
              <span className={`rp2__group-name${cliBadge !== 'none' ? ' rp2__group-name--with-partner' : ''}`}>
                <span className={`rp2__group-dot${cliClasses.dot}`} data-hash={key} aria-hidden />
                <span className="rp2__group-title">{r.client_name}</span>
                {cliBadge !== 'none' ? (<span className={cliBadge === 'invoiced' ? 'rp-partner-chip rp-partner-chip--invoiced' : 'rp-partner-chip rp-partner-chip--confirmed'}>{cliBadge === 'invoiced' ? t('timeTrackingPage.reports.partnerChip.invoiced') : t('timeTrackingPage.reports.partnerChip.confirmed')}</span>) : null}
                {r.users?.length ? (<span className="rp2-tag rp2-tag--count">{r.users.length}</span>) : null}
              </span>
              <span className="rp2-num rp2__group-metric">{fmtH(r.total_hours)}</span>
              <span className="rp2-num rp2__group-metric">{fmtH(r.billable_hours)}</span>
              <span className="rp2__group-metric">
                <PctBar a={r.billable_hours} b={r.total_hours} />
              </span>
              <span className="rp2-num rp2__group-metric rp2__group-metric--amount">
                {fmtAmtWithIso(r.billable_amount, r.currency)}
              </span>
              <span className="rp2__group-chev" aria-hidden />
            </button>)}
            {isOpen && canToggle && (<TimeUserRows users={r.users ?? []} groupBy="clients" entryGroupContext={{ client_name: r.client_name }} />)}
          </div>);
        })}
      </div>
    </div>);
  }
  if (groupBy === 'tasks') {
    const taskRows = rows as TimeRowTasks[];
    return (<div className="rp2 rp2--tasks" role="table" aria-label={t('timeTrackingPage.reports.table.tasksAria')}>
      <div className="rp2__head" role="row">
        <div role="columnheader" className="rp2__head-name-stack">
          <span className="rp2__head-name-stack-primary">{t('timeTrackingPage.reports.timeTable.task')}</span>
          <span className="rp2__head-name-stack-secondary">{t('timeTrackingPage.reports.timeTable.project')}</span>
        </div>
        <div className="rp2-num" role="columnheader">{t('timeTrackingPage.reports.timeTable.allHours')}</div>
        <div className="rp2-num" role="columnheader">{t('timeTrackingPage.reports.timeTable.billableHours')}</div>
        <div role="columnheader">{t('timeTrackingPage.reports.timeTable.billablePct')}</div>
        <div className="rp2-num" role="columnheader" title={t('timeTrackingPage.reports.table.amountTitle')}>{t('timeTrackingPage.reports.table.amount')}</div>
        <div className="rp2__head-chev" aria-hidden />
      </div>
      <div className="rp2__body" role="rowgroup">
        {taskRows.map((r) => {
          const key = timeReportPhysicalRowKey('tasks', r);
          const isOpen = expanded.has(key);
          const canToggle = !!r.users?.length;
          const projectLabel = displayReportProjectLabel(r.project_name ?? '', r.project_id);
          return (<div key={key} className={`rp2__group${isOpen ? ' rp2__group--open' : ''}${canToggle ? '' : ' rp2__group--leaf'}`}>
            <button type="button" className="rp2__group-row rp2__group-row--button" onClick={() => canToggle && onToggle(key)} disabled={!canToggle} aria-expanded={canToggle ? isOpen : undefined}>
              <span className="rp2__cell-name-stack">
                <span className="rp2__group-name rp2__group-name--bold">
                  <span className="rp2__group-dot" data-hash={key} aria-hidden />
                  <span className="rp2__group-title">{r.task_name}</span>
                  {r.users?.length ? (<span className="rp2-tag rp2-tag--count">{r.users.length}</span>) : null}
                </span>
                <span className="rp2__group-sub">{projectLabel}</span>
              </span>
              <span className="rp2-num rp2__group-metric">{fmtH(r.total_hours)}</span>
              <span className="rp2-num rp2__group-metric">{fmtH(r.billable_hours)}</span>
              <span className="rp2__group-metric">
                <PctBar a={r.billable_hours} b={r.total_hours} />
              </span>
              <span className="rp2-num rp2__group-metric rp2__group-metric--amount">
                {fmtAmtWithIso(r.billable_amount, r.currency)}
              </span>
              <span className="rp2__group-chev" aria-hidden>
                {canToggle ? <IcoExpand open={isOpen} /> : null}
              </span>
            </button>
            {isOpen && canToggle && (<TimeUserRows users={r.users ?? []} groupBy="tasks" entryGroupContext={{ project_name: r.project_name, client_name: r.client_name, task_name: r.task_name }} />)}
          </div>);
        })}
      </div>
    </div>);
  }
  if (groupBy === 'team') {
    const teamRows = rows as TimeRowTeam[];
    return (<div className="rp2 rp2--team" role="table" aria-label={t('timeTrackingPage.reports.table.teamAria')}>
      <div className="rp2__head" role="row">
        <div role="columnheader">{t('timeTrackingPage.reports.timeTable.employee')}</div>
        <div className="rp2-num" role="columnheader">{t('timeTrackingPage.reports.timeTable.allHours')}</div>
        <div className="rp2-num" role="columnheader">{t('timeTrackingPage.reports.timeTable.billableHours')}</div>
        <div role="columnheader">{t('timeTrackingPage.reports.timeTable.billablePct')}</div>
        <div className="rp2-num" role="columnheader" title={t('timeTrackingPage.reports.table.amountTitle')}>{t('timeTrackingPage.reports.table.amount')}</div>
        <div className="rp2__head-chev" aria-hidden />
      </div>
      <div className="rp2__body" role="rowgroup">
        {teamRows.map((r) => {
          const key = timeReportPhysicalRowKey('team', r);
          return (<div key={key} className="rp2__group rp2__group--leaf">
            <div className="rp2__group-row" role="row">
              <span className="rp2__group-name">
                <span className="rp2__group-dot" data-hash={key} aria-hidden />
                <span className="rp2__group-title">{r.user_name}</span>
                {r.is_contractor ? (<span className="rp-badge rp-badge--muted">{t('timeTrackingPage.reports.timeTable.contractor')}</span>) : null}
              </span>
              <span className="rp2-num rp2__group-metric">{fmtH(r.total_hours)}</span>
              <span className="rp2-num rp2__group-metric">{fmtH(r.billable_hours)}</span>
              <span className="rp2__group-metric">
                <PctBar a={r.billable_hours} b={r.total_hours} />
              </span>
              <span className="rp2-num rp2__group-metric rp2__group-metric--amount">
                {fmtAmtWithIso(r.billable_amount, r.currency)}
              </span>
              <span className="rp2__group-chev" aria-hidden />
            </div>
          </div>);
        })}
      </div>
    </div>);
  }
  const projectRows = rows as TimeRowProjects[];
  const goProjectPreview = onProjectRowPreview;
  return (<div className="rp2 rp2--projects" role="table" aria-label={t('timeTrackingPage.reports.table.projectsAria')}>
    <div className="rp2__head rp2__head--projects" role="row">
      <div role="columnheader">{t('timeTrackingPage.reports.timeTable.project')}</div>
      <div role="columnheader">{t('timeTrackingPage.reports.timeTable.client')}</div>
      <div className="rp2__head-spacer" aria-hidden />
      <div className="rp2-num rp2__head-metric" role="columnheader">{t('timeTrackingPage.reports.timeTable.allHours')}</div>
      <div className="rp2-num rp2__head-metric" role="columnheader">{t('timeTrackingPage.reports.timeTable.billableHours')}</div>
      <div className="rp2__head-metric rp2__head-metric--pct" role="columnheader">{t('timeTrackingPage.reports.timeTable.billablePct')}</div>
      <div className="rp2-num rp2__head-metric" role="columnheader" title={t('timeTrackingPage.reports.table.amountTitleProject')}>{t('timeTrackingPage.reports.table.amount')}</div>
    </div>
    <div className="rp2__body" role="rowgroup">
      {projectRows.map((r) => {
        const key = r.project_id;
        const title = t('timeTrackingPage.reports.timeTable.projectPreviewTitle').replace('{name}', r.project_name);
        const pjBadge = partnerProjectBadge?.(r.project_id) ?? 'none';
        const pjClasses = partnerRowBadgeClasses(pjBadge);
        const pjPartnerNote = pjBadge === 'invoiced'
          ? t('timeTrackingPage.reports.partnerChip.overlapInvoiced')
          : pjBadge === 'confirmed'
            ? t('timeTrackingPage.reports.partnerChip.overlapConfirmed')
            : '';
        const pjAria = goProjectPreview ? `${title}${pjPartnerNote}`.trim() : undefined;
        return (<div key={key} className="rp2__group rp2__group--leaf">
          <button type="button" className={`rp2__group-row rp2__group-row--button${pjClasses.row}`} onClick={() => goProjectPreview?.(r.project_id)} disabled={!goProjectPreview || Boolean(projectRowPreviewDisabled)} title={goProjectPreview ? pjAria : undefined} aria-label={goProjectPreview ? pjAria : undefined}>
            <span className={`rp2__group-name rp2__group-name--bold${pjBadge !== 'none' ? ' rp2__group-name--with-partner' : ''}`}>
              <span className={`rp2__group-dot${pjClasses.dot}`} data-hash={key} aria-hidden />
              <span className="rp2__group-title">{r.project_name}</span>
              {pjBadge !== 'none' ? (<span className={pjBadge === 'invoiced' ? 'rp-partner-chip rp-partner-chip--invoiced' : 'rp-partner-chip rp-partner-chip--confirmed'}>{pjBadge === 'invoiced' ? t('timeTrackingPage.reports.partnerChip.invoiced') : t('timeTrackingPage.reports.partnerChip.confirmed')}</span>) : null}
            </span>
            <span className="rp2__group-client">{r.client_name}</span>
            <span className="rp2__group-spacer" aria-hidden />
            <span className="rp2-num rp2__group-metric">{fmtH(r.total_hours)}</span>
            <span className="rp2-num rp2__group-metric">{fmtH(r.billable_hours)}</span>
            <span className="rp2__group-metric">
              <PctBar a={r.billable_hours} b={r.total_hours} />
            </span>
            <span className="rp2-num rp2__group-metric rp2__group-metric--amount">
              {fmtAmtWithIso(r.billable_amount, r.currency)}
            </span>
          </button>
        </div>);
      })}
    </div>
  </div>);
});
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
type PartnerReportScope = 'all' | 'confirmed';

function parseReportsSectionParam(value: string | null): ReportsSection | null {
  return isReportsSection(value) ? value : null;
}

export function ReportsPanel() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const reportsDateRangeId = useId();
  const { user } = useCurrentUser();
  const { showAlert, showConfirm } = useAppDialog();
  const { badge: forReviewBadge } = usePartnerForReviewBadge(Boolean(user));
  const savedPrefs = useMemo(() => readReportsPrefsFromStorage(), []);
  const initRange = useMemo(() => readInitialReportsRangeState(), []);
  const [reportsSection, setReportsSection] = useState<ReportsSection>(() => {
    const fromUrl = parseReportsSectionParam(searchParams.get('reportsSection'));
    const fromPrefs = savedPrefs?.reportsSection;
    const raw = fromUrl ?? (isReportsSection(fromPrefs) ? fromPrefs : 'build');
    return normalizeReportsSection(raw);
  });
  const [partnerConfirmedSubview, setPartnerConfirmedSubview] = useState<PartnerConfirmedSubview>(() => {
    const section = parseReportsSectionParam(searchParams.get('reportsSection'));
    if (section === 'monthly-archive' || searchParams.get('partnerView') === 'archive')
      return 'archive';
    if (savedPrefs?.reportsSection === 'monthly-archive')
      return 'archive';
    if (isPartnerConfirmedSubview(savedPrefs?.partnerConfirmedSubview))
      return savedPrefs.partnerConfirmedSubview;
    return 'list';
  });
  const [partnerReportScope, setPartnerReportScope] = useState<PartnerReportScope>('all');
  useEffect(() => {
    const section = parseReportsSectionParam(searchParams.get('reportsSection'));
    const partnerView = searchParams.get('partnerView');
    if (!section && partnerView !== 'archive')
      return;
    if (section === 'monthly-archive' || section === 'partner-confirmed' || partnerView === 'archive') {
      setReportsSection('partner-confirmed');
      if (section === 'monthly-archive' || partnerView === 'archive')
        setPartnerConfirmedSubview('archive');
    }
    else if (section) {
      setReportsSection(normalizeReportsSection(section));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('reportsSection');
    next.delete('partnerView');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const partnerScopeSectionActive = reportsSection === 'weekly' || reportsSection === 'monthly';
  const partnerConfirmedOnlyFilter = partnerScopeSectionActive && partnerReportScope === 'confirmed';
  const [onlyMyProjects, setOnlyMyProjects] = useState(() => savedPrefs?.onlyMyProjects === true);
  const partnerProjectsScopeActive = onlyMyProjects && user != null && reportsSection !== 'partner-confirmed' && reportsSection !== 'for-review';
  const [partnerAllowedProjectIds, setPartnerAllowedProjectIds] = useState<Set<string> | null>(null);
  const [partnerAllowedClientIds, setPartnerAllowedClientIds] = useState<Set<string> | null>(null);
  const withPartnerReportScope = useCallback(<T extends Omit<ReportFiltersV2, 'page' | 'per_page'>>(base: T): T => ({
    ...base,
    ...(partnerConfirmedOnlyFilter ? { partner_confirmed_only: true } : {}),
    ...(partnerProjectsScopeActive && user ? { partner_auth_user_id: user.id } : {}),
  }), [partnerConfirmedOnlyFilter, partnerProjectsScopeActive, user]);
  const [periodDate, setPeriodDate] = useState(() => initRange.periodDate);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>(() => initRange.periodGranularity);
  const [customRangeActive, setCustomRangeActive] = useState(() => initRange.customRangeActive);
  const activePeriodGranularity = useMemo((): PeriodGranularity => {
    if (reportsSection === 'weekly')
      return 'week';
    if (reportsSection === 'monthly')
      return 'month';
    return periodGranularity;
  }, [reportsSection, periodGranularity]);
  const periodGranularityLocked = reportsSection === 'weekly' || reportsSection === 'monthly';
  const selectPartnerConfirmedSubview = useCallback((next: PartnerConfirmedSubview) => {
    setPartnerConfirmedSubview(next);
  }, []);
  const selectReportsSection = useCallback((section: ReportsSection) => {
    setReportsSection(normalizeReportsSection(section));
    if (section === 'weekly') {
      setPartnerReportScope('all');
      setPeriodGranularity('week');
      setPeriodDate(new Date());
      setCustomRangeActive(false);
    }
    else if (section === 'monthly') {
      setPartnerReportScope('all');
      setPeriodGranularity('month');
      setPeriodDate(new Date());
      setCustomRangeActive(false);
    }
  }, []);
  const [dateFrom, setDateFrom] = useState(() => initRange.dateFrom);
  const [dateTo, setDateTo] = useState(() => initRange.dateTo);
  const [periodDropdown, setPeriodDropdown] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const presetRange = useMemo(() => periodToDates(periodDate, activePeriodGranularity), [periodDate, activePeriodGranularity]);
  useEffect(() => {
    if (customRangeActive)
      return;
    setDateFrom(presetRange.dateFrom);
    setDateTo(presetRange.dateTo);
  }, [presetRange.dateFrom, presetRange.dateTo, customRangeActive]);
  const periodTitle = useMemo(() => {
    if (customRangeActive)
      return formatIsoRangeTitle(dateFrom, dateTo);
    if (activePeriodGranularity === 'all')
      return t('timeTrackingPage.reports.periods.all');
    return formatPeriodLabel(periodDate, activePeriodGranularity);
  }, [customRangeActive, dateFrom, dateTo, periodDate, activePeriodGranularity, t]);
  function goPrev() {
    if (activePeriodGranularity === 'all')
      return;
    setCustomRangeActive(false);
    setPeriodDate((d) => {
      const next = new Date(d);
      if (activePeriodGranularity === 'week')
        next.setDate(next.getDate() - 7);
      else if (activePeriodGranularity === 'month')
        next.setMonth(next.getMonth() - 1);
      else if (activePeriodGranularity === 'quarter')
        next.setMonth(next.getMonth() - 3);
      else
        next.setFullYear(next.getFullYear() - 1);
      return next;
    });
  }
  function goNext() {
    if (activePeriodGranularity === 'all')
      return;
    setCustomRangeActive(false);
    setPeriodDate((d) => {
      const next = new Date(d);
      if (activePeriodGranularity === 'week')
        next.setDate(next.getDate() + 7);
      else if (activePeriodGranularity === 'month')
        next.setMonth(next.getMonth() + 1);
      else if (activePeriodGranularity === 'quarter')
        next.setMonth(next.getMonth() + 3);
      else
        next.setFullYear(next.getFullYear() + 1);
      return next;
    });
  }
  useEffect(() => {
    if (!periodDropdown)
      return;
    const h = (e: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node))
        setPeriodDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [periodDropdown]);
  const [reportType, setReportType] = useState<ReportTypeV2>(() => migrateStoredReportType(savedPrefs?.reportType));
  const [groupBy, setGroupBy] = useState<GroupByV2>(() => coerceGroupByForType(migrateStoredReportType(savedPrefs?.reportType), savedPrefs?.groupBy));
  const groups = GROUPS_FOR_TYPE[reportType];
  function changeReportType(t: ReportTypeV2) {
    setReportType(t);
    const def = DEFAULT_GROUP[t];
    if (def)
      setGroupBy(def);
    setPage(1);
    setExpandedRows(new Set());
    setTableSearch('');
    setDebouncedTableSearch('');
    setSearchFullRows(null);
  }
  function changeGroupBy(g: GroupByV2) {
    setGroupBy(g);
    setPage(1);
    setExpandedRows(new Set());
    setTableSearch('');
    setDebouncedTableSearch('');
    setSearchFullRows(null);
  }
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(() => {
    if (!Array.isArray(savedPrefs?.selectedUserIds))
      return [];
    return (savedPrefs.selectedUserIds as unknown[])
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
  });
  const [includeFixed, setIncludeFixed] = useState(() => typeof savedPrefs?.includeFixed === 'boolean' ? savedPrefs.includeFixed : true);
  const [usersForFilter, setUsersForFilter] = useState<ReportsFilterUser[]>([]);
  const [usersForFilterError, setUsersForFilterError] = useState<string | null>(null);
  type AnyRow = TimeReportRow | ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam | UninvoicedRow | BudgetRow;
  const [results, setResults] = useState<AnyRow[]>([]);
  const [serverTotals, setServerTotals] = useState<ReportTotals | null>(null);
  const [pagination, setPagination] = useState<ReportPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [partnerConfirmedList, setPartnerConfirmedList] = useState<PartnerReportConfirmationRequest[]>([]);
  const [partnerPendingList, setPartnerPendingList] = useState<PartnerReportConfirmationRequest[]>([]);
  const [invoicesForPartnerHints, setInvoicesForPartnerHints] = useState<InvoiceDto[]>([]);
  const [hintProjectMirror, setHintProjectMirror] = useState<TimeRowProjects[]>([]);
  const [partnerHintsLoadFailed, setPartnerHintsLoadFailed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [submitForReviewBusy, setSubmitForReviewBusy] = useState(false);
  const [reportPageSizeMax, setReportPageSizeMax] = useState<number | null>(null);
  const effectivePerPage = useMemo(() => {
    const cap = reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : 5000;
    return Math.max(PER_PAGE, Math.min(2000, cap));
  }, [reportPageSizeMax]);
  const [tableSearch, setTableSearch] = useState('');
  const [debouncedTableSearch, setDebouncedTableSearch] = useState('');
  const [searchFullRows, setSearchFullRows] = useState<AnyRow[] | null>(null);
  const [searchFullLoading, setSearchFullLoading] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTableSearch(tableSearch.trim()), 450);
    return () => window.clearTimeout(t);
  }, [tableSearch]);
  useEffect(() => {
    const q = debouncedTableSearch.trim();
    if (!q || q.length < 2 || !dateFrom || !dateTo || dateFrom > dateTo) {
      setSearchFullRows(null);
      setSearchFullLoading(false);
      return;
    }
    let cancelled = false;
    setSearchFullLoading(true);
    setSearchFullRows(null);
    const filtersBase = withPartnerReportScope({
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
    });
        const searchFetchOpts = { maxPages: 6 } as const;
    void (async () => {
      try {
        let out: AnyRow[] = [];
        if (reportType === 'time') {
          if (groupBy === 'clients')
            out = await fetchAllTimeReportClientRows(filtersBase, searchFetchOpts);
          else if (groupBy === 'projects')
            out = await fetchAllTimeReportProjectRows(filtersBase, searchFetchOpts);
          else if (groupBy === 'tasks')
            out = await fetchAllTimeReportTaskRows(filtersBase, searchFetchOpts);
          else if (groupBy === 'team')
            out = await fetchAllTimeReportTeamRows(filtersBase, searchFetchOpts);
        }
        else if (isExpenseLikeReportType(reportType)) {
          out = await fetchAllExpenseReportRows(groupBy as ExpenseGroup, filtersBase, searchFetchOpts);
        }
        else if (reportType === 'uninvoiced') {
          out = await fetchAllUninvoicedReportRows(filtersBase, searchFetchOpts);
        }
        else if (reportType === 'project-budget') {
          out = await fetchAllBudgetReportRows(filtersBase, searchFetchOpts);
        }
        if (!cancelled)
          setSearchFullRows(out);
      }
      catch {
        if (!cancelled)
          setSearchFullRows([]);
      }
      finally {
        if (!cancelled)
          setSearchFullLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedTableSearch, reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, reportPageSizeMax, withPartnerReportScope]);
  useEffect(() => {
    setUsersForFilterError(null);
    fetchReportsUsersForFilter()
      .then((list) => {
        const filtered = list.filter((u) => !isHiddenSystemUser({ email: u.email, display_name: u.displayName }));
        setUsersForFilter(filtered);
        setUsersForFilterError(null);
        if (filtered.length === 1 && user && filtered[0].id === user.id) {
          setSelectedUserIds((prev) => (prev.length === 0 ? [user.id] : prev));
        }
      })
      .catch((e: unknown) => {
        setUsersForFilter([]);
        if (isTimeTrackingHttpError(e, 401) || isTimeTrackingHttpError(e, 403))
          setUsersForFilterError(t('timeTrackingPage.reports.header.usersFilterError'));
      });
  }, [user, t]);
  useEffect(() => {
    if (!partnerProjectsScopeActive || !user) {
      setPartnerAllowedProjectIds(null);
      setPartnerAllowedClientIds(null);
      return;
    }
    let cancelled = false;
    void Promise.all([listAllClientProjectsMerged(true), getUserProjectAccess(user.id)])
      .then(([projects, access]) => {
        if (cancelled)
          return;
        const pids = collectMyParticipatingProjectIds(projects, user.id, access.projectIds);
        setPartnerAllowedProjectIds(pids);
        setPartnerAllowedClientIds(partnerProjectClientIds(projects, pids));
      })
      .catch(() => {
        if (!cancelled) {
          setPartnerAllowedProjectIds(new Set());
          setPartnerAllowedClientIds(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [partnerProjectsScopeActive, user]);
  useEffect(() => {
    void fetchReportsMeta()
      .then((m) => {
        setReportPageSizeMax(m.pageSizeMax);
      })
      .catch(() => {
        setReportPageSizeMax(null);
      });
  }, []);

  const reloadPartnerReportHints = useCallback(() => {
    void (async () => {
      try {
        const [conf, pending] = await Promise.all([
          listPartnerReportConfirmationsConfirmed(),
          listPartnerReportConfirmationsPending(),
        ]);
        const confList = Array.isArray(conf) ? conf : [];
        const pendingList = Array.isArray(pending) ? pending : [];
        setPartnerConfirmedList(confList);
        setPartnerPendingList(pendingList);
        if (confList.length > 0) {
          try {
            const invoices = await fetchAllInvoices();
            setInvoicesForPartnerHints(invoices);
            setPartnerHintsLoadFailed(false);
          }
          catch {
            setInvoicesForPartnerHints([]);
            setPartnerHintsLoadFailed(true);
          }
        } else {
          setInvoicesForPartnerHints([]);
          setPartnerHintsLoadFailed(false);
        }
      }
      catch {
        setPartnerConfirmedList([]);
        setPartnerPendingList([]);
        setInvoicesForPartnerHints([]);
        setPartnerHintsLoadFailed(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (reportType !== 'time') {
      setHintProjectMirror([]);
      return;
    }
    reloadPartnerReportHints();
  }, [reportType, reloadPartnerReportHints]);

  useEffect(() => {
    const handler = (): void => {
      reloadPartnerReportHints();
    };
    window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, handler);
    return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, handler);
  }, [reloadPartnerReportHints]);

  useEffect(() => {
    let cancelled = false;
    if (reportType !== 'time' || groupBy !== 'clients') {
      setHintProjectMirror([]);
      return;
    }
    if (!dateFrom || !dateTo || dateFrom > dateTo || partnerConfirmedList.length === 0) {
      setHintProjectMirror([]);
      return;
    }
    const filtersBase = withPartnerReportScope({
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: includeFixed,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
    });
    void fetchAllTimeReportProjectRows(filtersBase)
      .then((rows) => {
        if (!cancelled)
          setHintProjectMirror(rows as TimeRowProjects[]);
      })
      .catch(() => {
        if (!cancelled)
          setHintProjectMirror([]);
      });
    return (): void => {
      cancelled = true;
    };
  }, [reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, reportPageSizeMax, partnerConfirmedList.length, withPartnerReportScope]);

  useEffect(() => {
    writeReportsPrefsToStorage({
      v: 1,
      reportType,
      groupBy,
      periodGranularity,
      periodAnchorIso: isoDateLocal(periodDate),
      selectedUserIds,
      includeFixed,
      onlyMyProjects,
      customRange: customRangeActive,
      rangeDateFrom: customRangeActive ? dateFrom : undefined,
      rangeDateTo: customRangeActive ? dateTo : undefined,
      reportsSection: normalizeReportsSection(reportsSection),
      partnerConfirmedSubview,
    });
  }, [
    reportType,
    groupBy,
    periodGranularity,
    periodDate,
    selectedUserIds,
    includeFixed,
    onlyMyProjects,
    customRangeActive,
    dateFrom,
    dateTo,
    reportsSection,
    partnerConfirmedSubview,
  ]);
  useEffect(() => {
    const aborted = { current: false };
    setLoading(true);
    setError(null);
    if (!dateFrom || !dateTo) {
      setError(t('timeTrackingPage.reports.errors.datesRequired'));
      setResults([]);
      setServerTotals(null);
      setPagination(null);
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    if (dateFrom > dateTo) {
      setError(t('timeTrackingPage.reports.errors.dateFromAfterTo'));
      setResults([]);
      setServerTotals(null);
      setPagination(null);
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    const filters: ReportFiltersV2 = withPartnerReportScope({
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page,
      per_page: effectivePerPage,
    });
    let promise: Promise<{
      results: unknown[];
      pagination: ReportPagination;
    }>;
    if (reportType === 'time') {
      promise = fetchTimeReport(groupBy as TimeGroup, filters);
    }
    else if (isExpenseLikeReportType(reportType)) {
      promise = fetchExpenseReport(groupBy as ExpenseGroup, filters);
    }
    else if (reportType === 'uninvoiced') {
      promise = fetchUninvoicedReport(filters);
    }
    else {
      promise = fetchBudgetReport(filters);
    }
    promise
      .then((data) => {
        if (aborted.current)
          return;
        setResults(data.results as AnyRow[]);
        setPagination(data.pagination);
        setExpandedRows(new Set());
        const respAny = data as { meta?: { totals_all_groups?: ReportTotals | null }; summary?: ReportTotals | null; totals?: ReportTotals | null };
        const st = respAny.meta?.totals_all_groups ?? respAny.summary ?? respAny.totals ?? null;
        setServerTotals(st && typeof st === 'object' ? st : null);
      })
      .catch((e: unknown) => {
        if (aborted.current)
          return;
        setError(e instanceof Error ? e.message : t('timeTrackingPage.reports.errors.loadFailed'));
        setResults([]);
        setServerTotals(null);
        setPagination(null);
      })
      .finally(() => {
        if (aborted.current)
          return;
        setLoading(false);
        setInitialLoading(false);
      });
    return () => { aborted.current = true; };
  }, [reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, page, reportPageSizeMax, effectivePerPage, t, withPartnerReportScope]);
  const scopedResults = useMemo((): AnyRow[] => {
    if (!partnerProjectsScopeActive)
      return results;
    if (partnerAllowedProjectIds === null)
      return [];
    return filterReportRowsByPartnerProjects(
      results,
      partnerAllowedProjectIds,
      partnerAllowedClientIds,
      reportType,
      groupBy,
    );
  }, [results, partnerProjectsScopeActive, partnerAllowedProjectIds, partnerAllowedClientIds, reportType, groupBy]);
  const tableSearchQ = debouncedTableSearch.trim().toLowerCase();
  const filteredTableRows = useMemo(() => {
    if (!tableSearchQ)
      return scopedResults;
    let src = searchFullRows ?? [];
    if (partnerProjectsScopeActive && partnerAllowedProjectIds != null) {
      src = filterReportRowsByPartnerProjects(
        src,
        partnerAllowedProjectIds,
        partnerAllowedClientIds,
        reportType,
        groupBy,
      );
    }
    if (!src.length)
      return [];
    return src.filter((r) => buildReportRowHaystack(r).includes(tableSearchQ));
  }, [tableSearchQ, scopedResults, searchFullRows, partnerProjectsScopeActive, partnerAllowedProjectIds, partnerAllowedClientIds, reportType, groupBy]);
  const sortedTimeTableRows = useMemo((): TimeReportRow[] | null => {
    if (reportType !== 'time')
      return null;
    return sortTimeReportRowsForDisplay(groupBy as TimeGroup, filteredTableRows as TimeReportRow[]);
  }, [reportType, groupBy, filteredTableRows]);
  const partnerConfSlices = useMemo((): TimeReportPartnerConfSlice[] => partnerConfirmedList.map((c) => ({
    projectId: c.projectId,
    dateFrom: c.dateFrom,
    dateTo: c.dateTo,
    snapshotId: c.snapshotId,
    ...(c.invoiceId ? { invoiceId: c.invoiceId } : {}),
  })), [partnerConfirmedList]);

  const partnerProjectBadgeMap = useMemo(() => {
    if (reportType !== 'time' || groupBy !== 'projects' || !dateFrom || !dateTo || dateFrom > dateTo)
      return null;
    const rows = sortedTimeTableRows;
    if (!rows?.length)
      return null;
    const out = new Map<string, TimeReportPartnerRowBadge>();
    for (const row of rows as TimeRowProjects[]) {
      const pid = String(row.project_id ?? '').trim();
      if (!pid)
        continue;
      const b = badgeForProjectInReportWindow({
        projectId: pid,
        windowFrom: dateFrom,
        windowTo: dateTo,
        confirmations: partnerConfSlices,
        invoices: invoicesForPartnerHints,
      });
      if (b !== 'none')
        out.set(pid, b);
    }
    return out.size ? out : null;
  }, [reportType, groupBy, sortedTimeTableRows, dateFrom, dateTo, partnerConfSlices, invoicesForPartnerHints]);

  const partnerClientBadgeMap = useMemo(() => {
    if (reportType !== 'time' || groupBy !== 'clients' || !dateFrom || !dateTo || dateFrom > dateTo)
      return null;
    if (!hintProjectMirror.length)
      return null;
    const m = buildClientPartnerBadgeMap({
      projectRows: hintProjectMirror,
      windowFrom: dateFrom,
      windowTo: dateTo,
      confirmations: partnerConfSlices,
      invoices: invoicesForPartnerHints,
    });
    return m.size > 0 ? m : null;
  }, [reportType, groupBy, hintProjectMirror, dateFrom, dateTo, partnerConfSlices, invoicesForPartnerHints]);

  const partnerProjectBadgeFn = useCallback((projectId: string) => partnerProjectBadgeMap?.get(String(projectId ?? '').trim()) ?? 'none', [partnerProjectBadgeMap]);
  const partnerClientBadgeFn = useCallback((clientId: string) => partnerClientBadgeMap?.get(String(clientId ?? '').trim()) ?? 'none', [partnerClientBadgeMap]);
  const tableDataLoading = loading || (Boolean(tableSearchQ) && searchFullLoading);
  const tableSearchPlaceholder = useMemo(() => {
    if (reportType === 'time') {
      if (groupBy === 'projects')
        return t('timeTrackingPage.reports.searchPlaceholders.projectClientCode');
      if (groupBy === 'clients')
        return t('timeTrackingPage.reports.searchPlaceholders.clientCurrency');
      if (groupBy === 'tasks')
        return t('timeTrackingPage.reports.searchPlaceholders.taskProject');
      if (groupBy === 'team')
        return t('timeTrackingPage.reports.searchPlaceholders.employee');
    }
    if (isExpenseLikeReportType(reportType)) {
      if (groupBy === 'projects')
        return t('timeTrackingPage.reports.searchPlaceholders.projectClient');
      if (groupBy === 'clients')
        return t('timeTrackingPage.reports.searchPlaceholders.client');
      if (groupBy === 'categories')
        return t('timeTrackingPage.reports.searchPlaceholders.category');
      if (groupBy === 'team')
        return t('timeTrackingPage.reports.searchPlaceholders.employee');
    }
    if (reportType === 'uninvoiced')
      return t('timeTrackingPage.reports.searchPlaceholders.default');
    return t('timeTrackingPage.reports.searchPlaceholders.default');
  }, [reportType, groupBy, t]);
  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const kpi = useMemo(() => {
    const useServerTotals = !tableSearchQ && serverTotals != null && !partnerProjectsScopeActive;

    if (reportType === 'time') {
      if (useServerTotals) {
        const st = serverTotals!;
        const totalHours = st.total_hours ?? 0;
        const billableHours = st.billable_hours ?? 0;
        let billableByCurrency: { currency: string; amount: number }[];
        if (Array.isArray(st.by_currency) && st.by_currency.length > 0) {
          billableByCurrency = sortCurrencyBuckets(
            st.by_currency.map((b) => ({
              currency: String(b.currency ?? 'USD').trim().toUpperCase() || 'USD',
              amount: Number(b.billable_amount ?? b.amount ?? 0),
            }))
          );
        } else {
          const amt = st.billable_amount ?? 0;
          billableByCurrency = amt !== 0
            ? [{ currency: (String(st.currency ?? '').trim().toUpperCase() || 'USD'), amount: amt }]
            : [];
        }
        return { kind: 'time' as const, totalHours, billableHours, billableByCurrency };
      }
      const rows = (tableSearchQ ? filteredTableRows : scopedResults) as TimeReportRow[];
      const totalHours = rows.reduce((s, r) => s + (r.total_hours ?? 0), 0);
      const billableHours = rows.reduce((s, r) => s + (r.billable_hours ?? 0), 0);
      const billMap = new Map<string, number>();
      for (const r of rows) {
        const cur = (String(r.currency ?? '').trim().toUpperCase() || 'USD');
        billMap.set(cur, (billMap.get(cur) ?? 0) + (r.billable_amount ?? 0));
      }
      const billableByCurrency = sortCurrencyBuckets([...billMap.entries()].map(([currency, amount]) => ({ currency, amount })));
      return { kind: 'time' as const, totalHours, billableHours, billableByCurrency };
    }

    if (isExpenseLikeReportType(reportType)) {
      if (useServerTotals) {
        const st = serverTotals!;
        let expensesByCurrency: { currency: string; totalAmount: number; billableAmount: number }[];
        if (Array.isArray(st.by_currency) && st.by_currency.length > 0) {
          expensesByCurrency = sortCurrencyBuckets(
            st.by_currency.map((b) => ({
              currency: String(b.currency ?? 'USD').trim().toUpperCase() || 'USD',
              totalAmount: Number(b.total_amount ?? b.totalAmount ?? 0),
              billableAmount: Number(b.billable_amount ?? b.billableAmount ?? 0),
            }))
          );
        } else {
          const cur = (String(st.currency ?? '').trim().toUpperCase() || 'USD');
          expensesByCurrency = [{ currency: cur, totalAmount: st.total_amount ?? 0, billableAmount: st.billable_amount ?? st.reimbursable_amount ?? 0 }];
        }
        return { kind: 'expenses' as const, expensesByCurrency };
      }
      const rows = (tableSearchQ ? filteredTableRows : scopedResults) as (ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam)[];
      const expMap = new Map<string, { totalAmount: number; billableAmount: number }>();
      for (const r of rows) {
        const cur = (String(r.currency ?? '').trim().toUpperCase() || 'USD');
        const prev = expMap.get(cur) ?? { totalAmount: 0, billableAmount: 0 };
        prev.totalAmount += r.total_amount ?? 0;
        prev.billableAmount += r.billable_amount ?? 0;
        expMap.set(cur, prev);
      }
      const expensesByCurrency = sortCurrencyBuckets([...expMap.entries()].map(([currency, v]) => ({
        currency,
        totalAmount: v.totalAmount,
        billableAmount: v.billableAmount,
      })));
      return { kind: 'expenses' as const, expensesByCurrency };
    }

    if (reportType === 'uninvoiced') {
      if (useServerTotals) {
        const st = serverTotals!;
        const uninvoicedHours = st.uninvoiced_hours ?? 0;
        let uninvoicedByCurrency: { currency: string; uninvoicedAmount: number; uninvoicedExpenses: number }[];
        if (Array.isArray(st.by_currency) && st.by_currency.length > 0) {
          uninvoicedByCurrency = sortCurrencyBuckets(
            st.by_currency.map((b) => ({
              currency: String(b.currency ?? 'USD').trim().toUpperCase() || 'USD',
              uninvoicedAmount: Number(b.uninvoiced_amount ?? b.uninvoicedAmount ?? 0),
              uninvoicedExpenses: Number(b.uninvoiced_expenses ?? b.uninvoicedExpenses ?? 0),
            }))
          );
        } else {
          const cur = (String(st.currency ?? '').trim().toUpperCase() || 'USD');
          uninvoicedByCurrency = [{ currency: cur, uninvoicedAmount: st.uninvoiced_amount ?? 0, uninvoicedExpenses: st.uninvoiced_expenses ?? 0 }];
        }
        return { kind: 'uninvoiced' as const, uninvoicedHours, uninvoicedByCurrency };
      }
      const rows = (tableSearchQ ? filteredTableRows : scopedResults) as UninvoicedRow[];
      const uninvoicedHours = rows.reduce((s, r) => s + (r.uninvoiced_hours ?? 0), 0);
      const uMap = new Map<string, { uninvoicedAmount: number; uninvoicedExpenses: number }>();
      for (const r of rows) {
        const cur = (String(r.currency ?? '').trim().toUpperCase() || 'USD');
        const prev = uMap.get(cur) ?? { uninvoicedAmount: 0, uninvoicedExpenses: 0 };
        prev.uninvoicedAmount += r.uninvoiced_amount ?? 0;
        prev.uninvoicedExpenses += r.uninvoiced_expenses ?? 0;
        uMap.set(cur, prev);
      }
      const uninvoicedByCurrency = sortCurrencyBuckets([...uMap.entries()].map(([currency, v]) => ({
        currency,
        uninvoicedAmount: v.uninvoicedAmount,
        uninvoicedExpenses: v.uninvoicedExpenses,
      })));
      return { kind: 'uninvoiced' as const, uninvoicedHours, uninvoicedByCurrency };
    }

    const rows = (tableSearchQ ? filteredTableRows : scopedResults) as BudgetRow[];
    const projectCount = rows.length;
    let totalHoursBudget = 0;
    let spentHours = 0;
    const moneyByCurMap = new Map<string, { totalBudget: number; spent: number }>();
    for (const r of rows) {
      if (r.budget_by === 'none' || r.has_budget === false)
        continue;
      if (r.budget_by === 'hours' || r.budget_by === 'hours_and_money') {
        const h = budgetReportHoursMetrics(r);
        totalHoursBudget += h.budget;
        spentHours += h.spent;
      }
      if (r.budget_by === 'money' || r.budget_by === 'hours_and_money') {
        const m = budgetReportMoneyMetrics(r);
        const c = (r.currency ?? '').trim().toUpperCase() || 'USD';
        const prev = moneyByCurMap.get(c) ?? { totalBudget: 0, spent: 0 };
        prev.totalBudget += m.budget;
        prev.spent += m.spent;
        moneyByCurMap.set(c, prev);
      }
    }
    const moneyBudgetByCurrency = [...moneyByCurMap.entries()]
      .map(([currency, v]) => ({ currency, totalBudget: v.totalBudget, spent: v.spent }))
      .sort((a, b) => {
        const rank = (x: string) => (x === 'USD' ? 0 : x === 'UZS' ? 1 : 2);
        const d = rank(a.currency) - rank(b.currency);
        return d !== 0 ? d : a.currency.localeCompare(b.currency, 'en');
      });
    return {
      kind: 'budget' as const,
      projectCount,
      totalHoursBudget,
      spentHours,
      moneyBudgetByCurrency,
    };
  }, [results, filteredTableRows, scopedResults, tableSearchQ, reportType, serverTotals, partnerProjectsScopeActive]);
  const singleProjectIdForSubmit = useMemo(() => {
    if (reportType !== 'time' || groupBy !== 'projects')
      return null;
    if (filteredTableRows.length !== 1)
      return null;
    const row = filteredTableRows[0] as TimeRowProjects;
    const pid = String(row.project_id ?? '').trim();
    return pid || null;
  }, [reportType, groupBy, filteredTableRows]);
  const submitBlockedForProject = useMemo(() => {
    if (!singleProjectIdForSubmit || !dateFrom || !dateTo)
      return false;
    const pid = singleProjectIdForSubmit;
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    const inFlight = (r: PartnerReportConfirmationRequest) => {
      if (String(r.projectId ?? '').trim() !== pid)
        return false;
      if (r.dateFrom.slice(0, 10) !== df || r.dateTo.slice(0, 10) !== dt)
        return false;
      return String(r.status || '').trim().toLowerCase() !== 'fully_confirmed';
    };
    return partnerPendingList.some(inFlight) || partnerConfirmedList.some(inFlight);
  }, [singleProjectIdForSubmit, dateFrom, dateTo, partnerPendingList, partnerConfirmedList]);
  const showSubmitForPartnerReview = hasFullTimeTrackingTabs(user) && Boolean(singleProjectIdForSubmit) && !tableDataLoading;
  const canSubmitForPartnerReview = showSubmitForPartnerReview && !submitBlockedForProject;
  async function handleSubmitForPartnerReview() {
    if (!canSubmitForPartnerReview || !singleProjectIdForSubmit || submitForReviewBusy)
      return;
    const confirmed = await showConfirm({
      title: t('timeTrackingPage.reports.submitForReview.confirmTitle'),
      message: t('timeTrackingPage.reports.submitForReview.confirmMessage'),
      confirmLabel: t('timeTrackingPage.reports.submitForReview.confirmLabel'),
    });
    if (!confirmed)
      return;
    setSubmitForReviewBusy(true);
    try {
      await submitPartnerReportConfirmationFromPreview({
        projectId: singleProjectIdForSubmit,
        dateFrom,
        dateTo,
      });
      notifyPartnerConfirmedReportsListInvalidate();
      await showAlert({ message: t('timeTrackingPage.reports.submitForReview.done') });
    }
    catch (e) {
      await showAlert({
        message: e instanceof Error ? e.message : t('timeTrackingPage.reports.submitForReview.failed'),
      });
    }
    finally {
      setSubmitForReviewBusy(false);
    }
  }
  function buildPreviewTransferPeriod(): ReportPreviewPeriodState {
    return {
      periodGranularity: activePeriodGranularity,
      periodAnchorIso: isoDateLocal(periodDate),
      customRangeActive,
    };
  }
  function openReportPreview() {
    if (tableDataLoading || filteredTableRows.length === 0)
      return;
    const period = buildPreviewTransferPeriod();
    const filters: ReportFiltersV2 = withPartnerReportScope({
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page: 1,
      per_page: effectivePerPage,
    });
    let payload: ReportPreviewTransferV2;
    if (reportType === 'time') {
      payload = { v: 2, reportType: 'time', groupBy: groupBy as ReportPreviewTimeGroup, filters, period };
    }
    else if (reportType === 'expenses') {
      const g = groupBy as ExpenseGroup;
      payload = { v: 2, reportType: 'expenses', groupBy: g, filters, period };
    }
    else if (reportType === 'uninvoiced') {
      payload = { v: 2, reportType: 'uninvoiced', filters, period };
    }
    else {
      payload = { v: 2, reportType: 'project-budget', filters, period };
    }
    writeReportPreviewTransfer(payload);
    navigate(routes.timeTrackingReportPreview);
  }
  function openTimeProjectPreview(projectId: string) {
    if (tableDataLoading)
      return;
    const trimmed = String(projectId ?? '').trim();
    if (!trimmed)
      return;
    const period = buildPreviewTransferPeriod();
    const filters: ReportFiltersV2 = withPartnerReportScope({
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: includeFixed,
      project_id: trimmed,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page: 1,
      per_page: effectivePerPage,
    });
    const payload: ReportPreviewTransferV2 = {
      v: 2,
      reportType: 'time',
      groupBy: 'projects',
      filters,
      period,
    };
    writeReportPreviewTransfer(payload);
    navigate(routes.timeTrackingReportPreview);
  }
  function openTimeClientPreview(clientId: string) {
    if (tableDataLoading)
      return;
    const trimmed = String(clientId ?? '').trim();
    if (!trimmed)
      return;
    const period = buildPreviewTransferPeriod();
    const filters: ReportFiltersV2 = withPartnerReportScope({
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: includeFixed,
      client_id: trimmed,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page: 1,
      per_page: effectivePerPage,
    });
    const payload: ReportPreviewTransferV2 = {
      v: 2,
      reportType: 'time',
      groupBy: 'clients',
      filters,
      period,
    };
    writeReportPreviewTransfer(payload);
    navigate(routes.timeTrackingReportPreview);
  }
  async function handleExport(format: 'csv' | 'xlsx') {
    if (exportBusy)
      return;
    setExportBusy(true);
    try {
      const baseFilters = withPartnerReportScope({
        dateFrom,
        dateTo,
        user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
        include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      });
      const gb = groups ? groupBy : null;
      if (reportType === 'time')
        await exportReportV2(reportType, gb, baseFilters, format, { timeExport: format === 'xlsx' ? 'summary' : 'detail' });
      else
        await exportReportV2(reportType, gb, baseFilters, format);
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.reports.errors.exportFailed') });
    }
    finally {
      setExportBusy(false);
    }
  }
  const breakdownHint = useMemo(() => {
    if (reportType === 'time') {
      const g = ttReportGroupLabel(groupBy as GroupByV2, t);
      const base = t('timeTrackingPage.reports.hints.timeByGroup').replace('{group}', g);
      if (groupBy === 'clients') {
        return `${base}. ${t('timeTrackingPage.reports.hints.timeClientsMultiCurrency')}`;
      }
      return base;
    }
    if (reportType === 'expenses') {
      const g = ttReportGroupLabel(groupBy as GroupByV2, t);
      return t('timeTrackingPage.reports.hints.expensesByGroup').replace('{group}', g);
    }
    if (reportType === 'uninvoiced')
      return t('timeTrackingPage.reports.hints.uninvoiced');
    return t('timeTrackingPage.reports.hints.projectBudget');
  }, [reportType, groupBy, t]);
  const reportsSectionSwitcher = (<div className="tt-reports__type-block tt-reports__section-switch">
      <p className="tt-reports__type-block-title" id="tt-reports-section-heading">
        {t('timeTrackingPage.reports.section.title')}
      </p>
      <nav className="tt-reports__type-nav" role="tablist" aria-labelledby="tt-reports-section-heading">
        <button type="button" role="tab" aria-selected={reportsSection === 'build'} className={`tt-reports__type-tab${reportsSection === 'build' ? ' tt-reports__type-tab--active' : ''}`} onClick={() => selectReportsSection('build')}>
          {t('timeTrackingPage.reports.section.build')}
        </button>
        <button type="button" role="tab" aria-selected={reportsSection === 'weekly'} className={`tt-reports__type-tab${reportsSection === 'weekly' ? ' tt-reports__type-tab--active' : ''}`} onClick={() => selectReportsSection('weekly')}>
          {t('timeTrackingPage.reports.section.weekly')}
        </button>
        <button type="button" role="tab" aria-selected={reportsSection === 'monthly'} className={`tt-reports__type-tab${reportsSection === 'monthly' ? ' tt-reports__type-tab--active' : ''}`} onClick={() => selectReportsSection('monthly')}>
          {t('timeTrackingPage.reports.section.monthly')}
        </button>
        <button type="button" role="tab" aria-selected={reportsSection === 'partner-confirmed'} className={`tt-reports__type-tab${reportsSection === 'partner-confirmed' ? ' tt-reports__type-tab--active' : ''}`} onClick={() => selectReportsSection('partner-confirmed')}>
          {t('timeTrackingPage.reports.section.partnerConfirmed')}
        </button>
        <button type="button" role="tab" aria-selected={reportsSection === 'for-review'} className={`tt-reports__type-tab${reportsSection === 'for-review' ? ' tt-reports__type-tab--active' : ''}`} onClick={() => selectReportsSection('for-review')}>
          <span className="tt-reports__type-tab-inner">
            {t('timeTrackingPage.reports.section.forReview')}
            {forReviewBadge ? (<span className="tt-reports__type-tab-badge" aria-hidden>{forReviewBadge}</span>) : null}
          </span>
        </button>
      </nav>
    </div>);
  if (reportsSection === 'for-review') {
    return (<div className="tt-reports tt-reports--fluid">
        {reportsSectionSwitcher}
        <ForReviewReportsPanel />
      </div>);
  }
  if (reportsSection === 'partner-confirmed') {
    return (<div className="tt-reports tt-reports--fluid">
        {reportsSectionSwitcher}
        <ConfirmedPartnerReportsPanel subView={partnerConfirmedSubview} onSubViewChange={selectPartnerConfirmedSubview} />
      </div>);
  }
  if (initialLoading) {
    return (<div className="tt-reports">
        {reportsSectionSwitcher}
        <ReportsSkeleton />
      </div>);
  }
  return (<div className="tt-reports">

    {reportsSectionSwitcher}

    {partnerScopeSectionActive ? (<div className="tt-reports__type-block tt-reports__partner-scope" role="group" aria-label={t('timeTrackingPage.reports.partnerScope.aria')}>
        <p className="tt-reports__type-block-title">{t('timeTrackingPage.reports.partnerScope.aria')}</p>
        <nav className="tt-reports__type-nav">
          <button type="button" className={`tt-reports__type-tab${partnerReportScope === 'all' ? ' tt-reports__type-tab--active' : ''}`} aria-pressed={partnerReportScope === 'all'} onClick={() => { setPartnerReportScope('all'); setPage(1); }}>
            {t('timeTrackingPage.reports.partnerScope.all')}
          </button>
          <button type="button" className={`tt-reports__type-tab${partnerReportScope === 'confirmed' ? ' tt-reports__type-tab--active' : ''}`} aria-pressed={partnerReportScope === 'confirmed'} onClick={() => { setPartnerReportScope('confirmed'); setPage(1); }}>
            {t('timeTrackingPage.reports.partnerScope.confirmedOnly')}
          </button>
        </nav>
      </div>) : null}

    <div className="tt-reports__type-block">
      <p className="tt-reports__type-block-title" id="tt-reports-type-heading">
        {t('timeTrackingPage.reports.reportType.title')}
      </p>
      <nav className="tt-reports__type-nav" role="tablist" aria-labelledby="tt-reports-type-heading">
        {REPORT_TYPES.map((tab) => (<button key={tab.id} type="button" role="tab" aria-selected={reportType === tab.id} className={`tt-reports__type-tab${reportType === tab.id ? ' tt-reports__type-tab--active' : ''}`} onClick={() => changeReportType(tab.id)}>
          {ttReportTypeLabel(tab.id, t)}
        </button>))}
      </nav>
    </div>

    <div className="tt-reports__header">
      <div className="tt-reports__header-left">
        <button type="button" className="tt-reports__nav-btn" onClick={goPrev} disabled={activePeriodGranularity === 'all'} aria-label={t('timeTrackingPage.reports.header.prevPeriod')}>
          <IcoChevLeft />
        </button>
        <h2 className="tt-reports__period-title">{periodTitle}</h2>
        <button type="button" className="tt-reports__nav-btn" onClick={goNext} disabled={activePeriodGranularity === 'all'} aria-label={t('timeTrackingPage.reports.header.nextPeriod')}>
          <IcoChevRight />
        </button>
      </div>
      <div className="tt-reports__header-right">
        {usersForFilterError ? (<p className="tt-reports__users-filter-err" role="status">{usersForFilterError}</p>) : null}
        <ReportsUserFilterDropdown users={usersForFilter} selected={selectedUserIds} onChange={(ids) => { setSelectedUserIds(ids); setPage(1); }} />

        {periodGranularityLocked ? (<span className="tt-reports__btn tt-reports__btn--outline tt-reports__period-locked" aria-current="true">
            {ttReportPeriodLabel(activePeriodGranularity, t)}
          </span>) : (<div className="tt-reports__period-dropdown-wrap" ref={periodDropdownRef}>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown" onClick={() => setPeriodDropdown((v) => !v)} aria-expanded={periodDropdown}>
              {ttReportPeriodLabel(periodGranularity, t)} <IcoChevDown />
            </button>
            {periodDropdown && (<div className="tt-reports__period-dropdown" role="listbox">
              {PERIOD_OPTIONS.map((opt) => (<button key={opt.id} type="button" role="option" aria-selected={periodGranularity === opt.id} className={`tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`} onClick={() => {
                setCustomRangeActive(false);
                setPeriodGranularity(opt.id);
                setPeriodDropdown(false);
              }}>
                {ttReportPeriodLabel(opt.id, t)}
              </button>))}
            </div>)}
          </div>)}
      </div>
    </div>

    <div className="tt-reports__date-range" aria-label={t('timeTrackingPage.reports.dateRange.aria')}>
      <span className="tt-reports__date-range-title">{t('timeTrackingPage.reports.dateRange.title')}</span>
      <div className="tt-reports__date-field">
        <span className="tt-reports__date-field-label" id={`${reportsDateRangeId}-from`}>
          {t('timeTrackingPage.reports.dateRange.from')}
        </span>
        <DatePicker value={dateFrom} max={dateTo} onChange={(iso) => {
          if (periodGranularityLocked) {
            const d = parseIsoDateLocal(iso);
            if (d) {
              setPeriodDate(d);
              setCustomRangeActive(false);
            }
            setPage(1);
            return;
          }
          setDateFrom(iso);
          if (iso > dateTo)
            setDateTo(iso);
          setCustomRangeActive(true);
          setPage(1);
        }} aria-labelledby={`${reportsDateRangeId}-from`} portal buttonClassName="tt-reports__date-picker-btn" />
      </div>
      <div className="tt-reports__date-field">
        <span className="tt-reports__date-field-label" id={`${reportsDateRangeId}-to`}>
          {t('timeTrackingPage.reports.dateRange.to')}
        </span>
        <DatePicker value={dateTo} min={dateFrom} onChange={(iso) => {
          if (periodGranularityLocked) {
            const d = parseIsoDateLocal(iso);
            if (d) {
              setPeriodDate(d);
              setCustomRangeActive(false);
            }
            setPage(1);
            return;
          }
          setDateTo(iso);
          if (iso < dateFrom)
            setDateFrom(iso);
          setCustomRangeActive(true);
          setPage(1);
        }} aria-labelledby={`${reportsDateRangeId}-to`} portal buttonClassName="tt-reports__date-picker-btn" />
      </div>
      {customRangeActive && !periodGranularityLocked ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => {
        setCustomRangeActive(false);
        setPage(1);
      }}>
        {t('timeTrackingPage.reports.dateRange.backToPeriod').replace('{period}', ttReportPeriodLabel(activePeriodGranularity, t).toLowerCase())}
      </button>) : null}
    </div>

    <div className="tt-reports__summary">
      {kpi.kind === 'time' && (<>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.totalHours')}</span>
          <span className="tt-reports__summary-value">{fmtH(kpi.totalHours)}</span>
        </div>
        <div className="tt-reports__summary-card tt-reports__summary-chart">
          <div className="tt-reports__pie-wrap">
            {(() => {
              const billPct = kpi.totalHours > 0 ? (kpi.billableHours / kpi.totalHours) * 100 : 0;
              const nonBillPct = 100 - billPct;
              return (<svg viewBox="0 0 36 36" className="tt-reports__pie">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--app-accent,#4f46e5)" strokeWidth="3" strokeDasharray={`${billPct} ${100 - billPct}`} strokeDashoffset="0" transform="rotate(-90 18 18)" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(37,99,235,0.25)" strokeWidth="3" strokeDasharray={`${nonBillPct} ${100 - nonBillPct}`} strokeDashoffset={-billPct} transform="rotate(-90 18 18)" />
                <text x="18" y="21.5" textAnchor="middle" fontSize="8" fill="currentColor">{Math.round(billPct)}%</text>
              </svg>);
            })()}
          </div>
          <div className="tt-reports__pie-legend">
            <span className="tt-reports__legend-item">
              <span className="tt-reports__legend-item-top">
                <span className="tt-reports__legend-dot tt-reports__legend-dot--billable" aria-hidden />
                <span>{t('timeTrackingPage.reports.kpi.billable')}</span>
              </span>
              <span className="tt-reports__legend-item-value">{fmtH(kpi.billableHours)}</span>
            </span>
            <span className="tt-reports__legend-item">
              <span className="tt-reports__legend-item-top">
                <span className="tt-reports__legend-dot tt-reports__legend-dot--nonbillable" aria-hidden />
                <span>{t('timeTrackingPage.reports.kpi.nonBillable')}</span>
              </span>
              <span className="tt-reports__legend-item-value">{fmtH(kpi.totalHours - kpi.billableHours)}</span>
            </span>
          </div>
        </div>
        {kpi.billableByCurrency.length === 0 ? (<div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">{t('timeTrackingPage.reports.kpi.billableAmount')}</span>
          </span>
          <span className="tt-reports__summary-value">—</span>
        </div>) : (kpi.billableByCurrency.map((bc) => (<div key={bc.currency} className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">{t('timeTrackingPage.reports.kpi.billableAmount')}</span>
            <span className="tt-reports__summary-label-accent">{bc.currency}</span>
          </span>
          <span className="tt-reports__summary-value">{fmtAmtWithIso(bc.amount, bc.currency)}</span>
        </div>)))}
        {reportType === 'time' && kpi.billableByCurrency.length > 1 && (<p className="tt-reports__summary-footnote">
          {t('timeTrackingPage.reports.kpi.multiCurrencyFootnote')}
        </p>)}
        {reportType === 'time' && (<div className="tt-reports__summary-options" role="group" aria-label={t('timeTrackingPage.reports.kpi.timeOptionsAria')}>
          <label className="tt-reports__summary-check">
            <input type="checkbox" checked={includeFixed} onChange={(e) => { setIncludeFixed(e.target.checked); setPage(1); }} />
            <span>{t('timeTrackingPage.reports.kpi.includeFixedFee')}</span>
          </label>
        </div>)}
      </>)}
      {kpi.kind === 'expenses' && kpi.expensesByCurrency.length === 1 && (() => {
        const x = kpi.expensesByCurrency[0]!;
        const billPct = x.totalAmount > 0 ? (x.billableAmount / x.totalAmount) * 100 : 0;
        return (<>
          <div className="tt-reports__summary-card">
            <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.totalExpenses')}</span>
            <span className="tt-reports__summary-value">{fmtAmt(x.totalAmount, x.currency)}</span>
          </div>
          <div className="tt-reports__summary-card tt-reports__summary-chart">
            <div className="tt-reports__pie-wrap">
              <svg viewBox="0 0 36 36" className="tt-reports__pie">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--app-accent,#4f46e5)" strokeWidth="3" strokeDasharray={`${billPct} ${100 - billPct}`} strokeDashoffset="0" transform="rotate(-90 18 18)" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(37,99,235,0.25)" strokeWidth="3" strokeDasharray={`${100 - billPct} ${billPct}`} strokeDashoffset={-billPct} transform="rotate(-90 18 18)" />
                <text x="18" y="21.5" textAnchor="middle" fontSize="8" fill="currentColor">{Math.round(billPct)}%</text>
              </svg>
            </div>
            <div className="tt-reports__pie-legend">
              <span className="tt-reports__legend-item">
                <span className="tt-reports__legend-item-top">
                  <span className="tt-reports__legend-dot tt-reports__legend-dot--billable" aria-hidden />
                  <span>{t('timeTrackingPage.reports.kpi.reimbursable')}</span>
                </span>
                <span className="tt-reports__legend-item-value">{fmtAmt(x.billableAmount, x.currency)}</span>
              </span>
              <span className="tt-reports__legend-item">
                <span className="tt-reports__legend-item-top">
                  <span className="tt-reports__legend-dot tt-reports__legend-dot--nonbillable" aria-hidden />
                  <span>{t('timeTrackingPage.reports.kpi.otherExpenses')}</span>
                </span>
                <span className="tt-reports__legend-item-value">{fmtAmt(x.totalAmount - x.billableAmount, x.currency)}</span>
              </span>
            </div>
          </div>
          <div className="tt-reports__summary-card tt-reports__summary-amount">
            <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.reimbursable')}</span>
            <span className="tt-reports__summary-value">{fmtAmt(x.billableAmount, x.currency)}</span>
          </div>
          <div className="tt-reports__summary-card">
            <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.reimbursablePct')}</span>
            <span className="tt-reports__summary-value">{pct(x.billableAmount, x.totalAmount)}</span>
          </div>
        </>);
      })()}
      {kpi.kind === 'expenses' && kpi.expensesByCurrency.length > 1 && (<>
        {kpi.expensesByCurrency.map((x) => (<div key={x.currency} className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">{t('timeTrackingPage.reports.kpi.expensesLabel')}</span>
            <span className="tt-reports__summary-label-accent">{x.currency}</span>
          </span>
          <span className="tt-reports__summary-value">{fmtAmt(x.totalAmount, x.currency)}</span>
          <span className="tt-reports__summary-sub">
            {t('timeTrackingPage.reports.kpi.reimbursableLine')
              .replace('{billable}', fmtAmt(x.billableAmount, x.currency))
              .replace('{pct}', pct(x.billableAmount, x.totalAmount))}
          </span>
        </div>))}
        <div className="tt-reports__summary-card tt-reports__summary-chart">
          <div className="tt-reports__pie-legend tt-reports__pie-legend--stack">
            <span className="tt-reports__summary-label tt-reports__summary-label--block-head">
              {t('timeTrackingPage.reports.kpi.reimbursableShareByCurrency')}
            </span>
            {kpi.expensesByCurrency.map((x) => {
              const billPct = x.totalAmount > 0 ? (x.billableAmount / x.totalAmount) * 100 : 0;
              return (<span key={x.currency} className="tt-reports__legend-item tt-reports__legend-item--wide">
                <span className="tt-reports__legend-item-top">
                  <span className="tt-reports__legend-dot tt-reports__legend-dot--billable" aria-hidden />
                  <span>
                    {x.currency} · {Math.round(billPct)}%
                  </span>
                </span>
                <span className="tt-reports__legend-item-value">
                  {fmtAmt(x.billableAmount, x.currency)} / {fmtAmt(x.totalAmount, x.currency)}
                </span>
              </span>);
            })}
          </div>
        </div>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.reimbursablePct')}</span>
          <span className="tt-reports__summary-value">—</span>
          <span className="tt-reports__summary-sub">{t('timeTrackingPage.reports.kpi.reimbursablePerCurrencyNote')}</span>
        </div>
      </>)}
      {kpi.kind === 'expenses' && kpi.expensesByCurrency.length === 0 && (<div className="tt-reports__summary-card tt-reports__summary-amount">
        <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.expensesLabel')}</span>
        <span className="tt-reports__summary-value">—</span>
      </div>)}
      {kpi.kind === 'uninvoiced' && (<>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.uninvoicedHours')}</span>
          <span className="tt-reports__summary-value">{fmtH(kpi.uninvoicedHours)}</span>
        </div>
        {kpi.uninvoicedByCurrency.length === 0 ? (<div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">{t('timeTrackingPage.reports.kpi.uninvoicedAmounts')}</span>
          </span>
          <span className="tt-reports__summary-value">—</span>
        </div>) : (kpi.uninvoicedByCurrency.map((u) => (<div key={u.currency} className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">{t('timeTrackingPage.reports.kpi.uninvoicedShort')}</span>
            <span className="tt-reports__summary-label-accent">{u.currency}</span>
          </span>
          <span className="tt-reports__summary-value">{fmtAmt(u.uninvoicedAmount, u.currency)}</span>
          <span className="tt-reports__summary-sub">
            {t('timeTrackingPage.reports.kpi.uninvoicedExpensesLine').replace('{amount}', fmtAmt(u.uninvoicedExpenses, u.currency))}
          </span>
        </div>)))}
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.projectsInList')}</span>
          <span className="tt-reports__summary-value">{tableSearchQ ? filteredTableRows.length : (partnerProjectsScopeActive ? scopedResults.length : (pagination?.total_entries ?? results.length))}</span>
        </div>
      </>)}
      {kpi.kind === 'budget' && (<>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.projectsWithBudget')}</span>
          <span className="tt-reports__summary-value">{kpi.projectCount}</span>
        </div>
        <div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.budgetHoursSpent')}</span>
          <span className="tt-reports__summary-value">{fmtH(kpi.spentHours)} / {fmtH(kpi.totalHoursBudget)}</span>
        </div>
        {kpi.moneyBudgetByCurrency.length === 0 ? (<div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.budgetMoneySpent')}</span>
          <span className="tt-reports__summary-value">—</span>
        </div>) : (kpi.moneyBudgetByCurrency.map((m) => {
          const hasBudget = m.totalBudget > 0;
          const line = !hasBudget && m.spent <= 0
            ? '—'
            : hasBudget
              ? `${fmtAmt(m.spent, m.currency)} / ${fmtAmt(m.totalBudget, m.currency)}`
              : fmtAmt(m.spent, m.currency);
          return (<div key={m.currency} className="tt-reports__summary-card tt-reports__summary-amount">
            <span className="tt-reports__summary-label tt-reports__summary-label--stack">
              <span className="tt-reports__summary-label-primary">{t('timeTrackingPage.reports.kpi.budgetMoney')}</span>
              <span className="tt-reports__summary-label-accent">{m.currency}</span>
            </span>
            <span className="tt-reports__summary-value">{line}</span>
          </div>);
        }))}
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.reports.kpi.utilizationHours')}</span>
          <span className="tt-reports__summary-value">
            <IcoBudget />
            {kpi.totalHoursBudget > 0 ? ` ${Math.round((kpi.spentHours / kpi.totalHoursBudget) * 100)}%` : '—'}
          </span>
        </div>
      </>)}
    </div>

    {groups && (<nav className="tt-reports__group-nav" role="tablist">
      {groups.map((g) => (<button key={g.id} type="button" role="tab" aria-selected={groupBy === g.id} className={`tt-reports__group-tab${groupBy === g.id ? ' tt-reports__group-tab--active' : ''}`} onClick={() => changeGroupBy(g.id)}>
        {ttReportGroupLabel(g.id, t)}
      </button>))}
    </nav>)}

    <div className="tt-reports__content">
      <div className="tt-reports__content-header">
        <div className="tt-reports__breakdown-label" role="status">
          <span className="tt-reports__breakdown-hint">{breakdownHint}</span>
          {reportType === 'time' && partnerConfirmedList.length > 0 && !partnerHintsLoadFailed ? (<span className="tt-reports__partner-legend" role="note">
              <span className="rp-partner-chip rp-partner-chip--confirmed" aria-hidden>{t('timeTrackingPage.reports.partnerChip.confirmed')}</span>
              <span className="rp-partner-chip rp-partner-chip--invoiced" aria-hidden>{t('timeTrackingPage.reports.partnerChip.invoiced')}</span>
              <span className="tt-reports__partner-legend-note">{t('timeTrackingPage.reports.content.partnerLegendNote')}</span>
            </span>) : null}
          {tableDataLoading && <span className="tt-reports__loading-pulse tt-reports__breakdown-status">{t('timeTrackingPage.reports.content.updating')}</span>}
        </div>
        <div className="tt-reports__content-header-right">
          <div className="tt-reports__toolbar">
            <label className="tt-reports__toolbar-check" title={t('timeTrackingPage.reports.partnerScope.onlyMyProjectsHint')}>
              <input type="checkbox" checked={onlyMyProjects} onChange={(e) => { setOnlyMyProjects(e.target.checked); setPage(1); }} />
              <span>{t('timeTrackingPage.reports.partnerScope.onlyMyProjects')}</span>
            </label>
            <div className="tt-reports__toolbar-search">
              <input type="search" className="tt-reports__table-search-input" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder={tableSearchPlaceholder} aria-label={t('timeTrackingPage.reports.table.searchPlaceholder')} />
            </div>
            <div className="tt-reports__toolbar-meta" aria-live="polite">
              {tableSearchQ ? (<span className="tt-reports__row-count tt-reports__breakdown-status">
                {searchFullLoading ? t('timeTrackingPage.reports.table.searchLoading') : t('timeTrackingPage.reports.table.searchResult').replace('{count}', String(filteredTableRows.length))}
              </span>) : (!loading && pagination ? (<span className="tt-reports__row-count tt-reports__breakdown-status">
                {pagination.total_entries > effectivePerPage
                  ? t('timeTrackingPage.reports.content.rowCountPaged')
                      .replace('{total}', String(pagination.total_entries))
                      .replace('{page}', String(page))
                      .replace('{pages}', String(pagination.total_pages))
                  : t('timeTrackingPage.reports.content.rowCount').replace('{count}', String(pagination.total_entries))}
              </span>) : !loading ? (<span className="tt-reports__row-count tt-reports__breakdown-status">{t('timeTrackingPage.reports.content.rowCount').replace('{count}', String(partnerProjectsScopeActive ? scopedResults.length : results.length))}</span>) : null)}
            </div>
          </div>
          <div className="tt-reports__content-actions">
            {showSubmitForPartnerReview ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => void handleSubmitForPartnerReview()} disabled={submitForReviewBusy || submitBlockedForProject} title={submitBlockedForProject ? t('timeTrackingPage.reports.submitForReview.sent') : submitForReviewBusy ? t('timeTrackingPage.reports.submitForReview.busy') : t('timeTrackingPage.reports.submitForReview.action')}>
              {submitBlockedForProject
                ? t('timeTrackingPage.reports.submitForReview.sentShort')
                : submitForReviewBusy
                  ? t('timeTrackingPage.reports.submitForReview.busy')
                  : t('timeTrackingPage.reports.submitForReview.action')}
            </button>) : null}
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={openReportPreview} disabled={tableDataLoading || filteredTableRows.length === 0} title={t('timeTrackingPage.reports.table.previewTitle')}>
              {t('timeTrackingPage.reports.content.preview')}
            </button>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => void handleExport('xlsx')} disabled={exportBusy || tableDataLoading} title={reportType === 'time' ? t('timeTrackingPage.reports.table.exportXlsxTime') : t('timeTrackingPage.reports.table.exportXlsxDefault')}>
              <IcoDownload /> Excel
            </button>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => void handleExport('csv')} disabled={exportBusy || tableDataLoading} title={reportType === 'time' ? t('timeTrackingPage.reports.table.exportCsvTime') : t('timeTrackingPage.reports.table.exportCsvDefault')}>
              <IcoDownload /> CSV
            </button>
          </div>
        </div>
      </div>

      {error && (<div className="tt-reports__table-err" role="alert">{error}</div>)}

      <div className={`tt-reports__table-wrap${tableDataLoading ? ' tt-reports__table-wrap--loading' : ''}${reportType === 'time' || isExpenseLikeReportType(reportType) || reportType === 'uninvoiced' || reportType === 'project-budget' ? ' tt-reports__table-wrap--scroll-x' : ''}`}>
        {filteredTableRows.length === 0 && !tableDataLoading ? (<div className="tt-reports__empty">
          {tableSearchQ ? (<p>{t('timeTrackingPage.reports.content.noSearchMatch')}</p>) : (<>
            <p className="tt-reports__empty-period">{formatIsoRangeTitle(dateFrom, dateTo)}</p>
            {onlyMyProjects && partnerProjectsScopeActive && partnerAllowedProjectIds != null && partnerAllowedProjectIds.size === 0 ? (<p>{t('timeTrackingPage.reports.partnerScope.noMyProjects')}</p>) : (<p>
              {selectedUserIds.length > 0
                ? t('timeTrackingPage.reports.table.emptyFiltered')
                : t('timeTrackingPage.reports.table.empty')}
            </p>)}
            {isExpenseLikeReportType(reportType) && !tableSearchQ ? (<p className="tt-reports__empty-hint" style={{ marginTop: '0.75rem', fontSize: '0.9rem', opacity: 0.85 }}>
                {t('timeTrackingPage.reports.content.expensesEmptyHint')}
              </p>) : null}
          </>)}
        </div>) : reportType === 'time' ? (<TimeTable groupBy={groupBy as TimeGroup} rows={sortedTimeTableRows ?? []} expanded={expandedRows} onToggle={toggleRow} onProjectRowPreview={groupBy === 'projects' ? openTimeProjectPreview : undefined} projectRowPreviewDisabled={groupBy === 'projects' ? tableDataLoading : undefined} onClientRowPreview={groupBy === 'clients' ? openTimeClientPreview : undefined} clientRowPreviewDisabled={groupBy === 'clients' ? tableDataLoading : undefined} partnerProjectBadge={partnerProjectBadgeMap ? partnerProjectBadgeFn : undefined} partnerClientBadge={partnerClientBadgeMap ? partnerClientBadgeFn : undefined} />) : isExpenseLikeReportType(reportType) ? (<ExpenseTable groupBy={groupBy as ExpenseGroup} rows={filteredTableRows as (ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam)[]} expanded={expandedRows} onToggle={toggleRow} />) : reportType === 'uninvoiced' ? (<UninvoicedTable rows={filteredTableRows as UninvoicedRow[]} expanded={expandedRows} onToggle={toggleRow} />) : (<BudgetTable rows={filteredTableRows as BudgetRow[]} expanded={expandedRows} onToggle={toggleRow} />)}
      </div>

      {pagination && pagination.total_pages > 1 && !tableSearchQ && (<div className="tt-reports__pagination">
        <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={!pagination.previous_page} onClick={() => setPage((p) => p - 1)}>
          <IcoChevLeft /> {t('timeTrackingPage.reports.pagination.back')}
        </button>
        <span className="tt-reports__pagination-info">
          {t('timeTrackingPage.reports.pagination.info')
            .replace('{page}', String(pagination.page))
            .replace('{pages}', String(pagination.total_pages))
            .replace('{total}', String(pagination.total_entries))}
        </span>
        <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={!pagination.next_page} onClick={() => setPage((p) => p + 1)}>
          {t('timeTrackingPage.reports.pagination.forward')} <IcoChevRight />
        </button>
      </div>)}
    </div>
  </div>);
}
