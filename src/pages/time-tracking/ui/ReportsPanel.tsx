import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useId, } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { fetchReportsMeta, fetchReportsUsersForFilter, fetchTimeReport, fetchExpenseReport, fetchUninvoicedReport, fetchBudgetReport, fetchAllTimeReportClientRows, fetchAllTimeReportProjectRows, fetchAllExpenseReportRows, fetchAllUninvoicedReportRows, fetchAllBudgetReportRows, exportReportV2, isTimeTrackingHttpError, type ReportsFilterUser, type ReportPagination, type TimeRowClients, type TimeRowProjects, type ExpRowClients, type ExpRowProjects, type ExpRowCategories, type ExpRowTeam, type UninvoicedRow, type BudgetRow, type ReportFiltersV2, type RUBExpense, type RUBUninvoiced, type RUBBudget, } from '@entities/time-tracking';
import { budgetReportHoursMetrics, budgetReportMoneyMetrics, budgetReportRowProgressPercent } from '@entities/time-tracking/lib/projectBudgetReportMetrics';
import { ReportsSkeleton } from './ReportsSkeleton';
import { ConfirmedPartnerReportsPanel } from './ConfirmedPartnerReportsPanel';
import { DatePicker } from '@shared/ui/DatePicker';
import { useAppDialog } from '@shared/ui';
import { writeReportPreviewTransfer, type ReportPreviewTransferV2, type ReportPreviewTimeGroup, } from '@entities/time-tracking/model/reportPreviewTransfer';
import {
  type ReportTypeV2,
  type TimeGroup,
  type ExpenseGroup,
  type GroupByV2,
  type PeriodGranularity,
  REPORT_TYPES,
  GROUPS_FOR_TYPE,
  DEFAULT_GROUP,
  PERIOD_OPTIONS,
  PER_PAGE,
  migrateStoredReportType,
  isExpenseLikeReportType,
  coerceGroupByForType,
} from '@entities/time-tracking/model/reportsPanelConfig';
import { isoDateLocal, periodToDates, formatPeriodLabel, formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { readReportsPrefsFromStorage, writeReportsPrefsToStorage, readInitialReportsRangeState } from '@entities/time-tracking/lib/reportsPrefsStorage';
import {
  fmtH,
  fmtAmt,
  fmtAmtWithIso,
  sortCurrencyBuckets,
  pct,
} from '@entities/time-tracking/lib/reportsFormatUtils';
import { sortTimeReportRowsForDisplay, timeReportPhysicalRowKey, } from '@entities/time-tracking/lib/timeReportRows';
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
const IcoUser = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
</svg>);
const IcoCheck = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
  <polyline points="20 6 9 17 4 12" />
</svg>);
const IcoBudget = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
</svg>);
type UserFilterMenuLayout = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};
function UserFilterDropdown({ users, selected, onChange, }: {
  users: ReportsFilterUser[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuLayout, setMenuLayout] = useState<UserFilterMenuLayout | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const computeMenuLayout = useCallback((): UserFilterMenuLayout | null => {
    const root = ref.current;
    if (!root)
      return null;
    const rect = root.getBoundingClientRect();
    const pad = 10;
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.max(260, Math.min(380, vw - pad * 2));
    let left = rect.right - width;
    left = Math.min(Math.max(left, pad), vw - width - pad);
    const preferBelowTop = rect.bottom + gap;
    const spaceBelow = vh - preferBelowTop - pad;
    const spaceAbove = rect.top - pad - gap;
    const listCap = 320;
    let top: number;
    let maxHeight: number;
    if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
      top = preferBelowTop;
      maxHeight = Math.max(160, Math.min(listCap, spaceBelow));
    }
    else {
      maxHeight = Math.max(160, Math.min(listCap, spaceAbove));
      top = Math.max(pad, rect.top - gap - maxHeight);
    }
    return { top, left, width, maxHeight };
  }, []);
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q)
      return users;
    return users.filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);
  useEffect(() => {
    if (!open)
      setSearch('');
  }, [open]);
  useLayoutEffect(() => {
    if (!open) {
      setMenuLayout(null);
      return;
    }
    setMenuLayout(computeMenuLayout());
  }, [open, computeMenuLayout]);
  useEffect(() => {
    if (!open)
      return;
    const sync = () => {
      const L = computeMenuLayout(); if (L)
        setMenuLayout(L);
    };
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => { window.removeEventListener('resize', sync); window.removeEventListener('scroll', sync, true); };
  }, [open, computeMenuLayout]);
  useEffect(() => {
    if (!open || !menuLayout)
      return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 40);
    return () => clearTimeout(id);
  }, [open, menuLayout]);
  useEffect(() => {
    if (!open)
      return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t))
        return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const label = selected.length === 0
    ? 'Все сотрудники'
    : selected.length === 1
      ? (users.find((u) => u.id === selected[0])?.displayName ?? '1 сотрудник')
      : `${selected.length} сотрудника(ов)`;
  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  const menu = open && menuLayout
    ? createPortal(<div ref={menuRef} className="rp-user-filter__menu rp-user-filter__menu--fixed" style={{ top: menuLayout.top, left: menuLayout.left, width: menuLayout.width, maxHeight: menuLayout.maxHeight }}>
      <div className="rp-user-filter__menu-inner">
        <div className="rp-user-filter__header">
          <span>Сотрудники</span>
          {selected.length > 0 && (<button type="button" className="rp-user-filter__clear" onClick={() => onChange([])}>Сбросить</button>)}
        </div>
        <div className="rp-user-filter__search">
          <input ref={searchRef} type="search" className="rp-user-filter__search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Имя или email…" aria-label="Поиск сотрудника" autoComplete="off" spellCheck={false} />
        </div>
        <div className="rp-user-filter__list">
          {users.length === 0 ? (<p className="rp-user-filter__empty">Нет доступных сотрудников</p>) : filteredUsers.length === 0 ? (<p className="rp-user-filter__empty">Никого не найдено</p>) : (filteredUsers.map((u) => (<label key={u.id} className="rp-user-filter__item">
            <span className={`rp-user-filter__check${selected.includes(u.id) ? ' rp-user-filter__check--on' : ''}`}>
              {selected.includes(u.id) && <IcoCheck />}
            </span>
            <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} tabIndex={-1} />
            <span className="rp-user-filter__item-text">
              <span className="rp-user-filter__name">{u.displayName}</span>
              <span className="rp-user-filter__email" title={u.email}>{u.email}</span>
            </span>
          </label>)))}
        </div>
      </div>
    </div>, document.body)
    : null;
  return (<div className="rp-user-filter" ref={ref}>
    <button type="button" className="tt-reports__btn tt-reports__btn--outline rp-user-filter__btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      <IcoUser />
      <span className="rp-user-filter__label">{label}</span>
      <IcoChevDown />
    </button>
    {menu}
  </div>);
}
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
  return (<>
    {users.map((u) => (<tr key={u.user_id} className="rp-table__sub-row">
      <td className="rp-table__sub-indent">
        <span className="rp-table__sub-icon">↳</span>
        <span>{u.user_name}</span>
      </td>
      <td className="rp-table__num">{fmtAmt(u.total_amount, currency)}</td>
      <td className="rp-table__num">{fmtAmt(u.billable_amount, currency)}</td>
      <td className="rp-table__num">{pct(u.billable_amount, u.total_amount)}</td>
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
        secondary = `${fmtH(userHours)} ч`;
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
        <div className="rpb__user-share" title={`Доля от израсходованного по проекту: ${sharePct}%`}>
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
function TimeTable({ groupBy, rows, expanded, onToggle, onProjectRowPreview, projectRowPreviewDisabled, onClientRowPreview, clientRowPreviewDisabled, }: {
  groupBy: TimeGroup;
  rows: (TimeRowClients | TimeRowProjects)[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onProjectRowPreview?: (projectId: string) => void;
  projectRowPreviewDisabled?: boolean;
  onClientRowPreview?: (clientId: string) => void;
  clientRowPreviewDisabled?: boolean;
}) {
  if (groupBy === 'clients') {
    const clientRows = rows as TimeRowClients[];
    const goClientPreview = onClientRowPreview;
    return (<div className="rp2 rp2--clients" role="table" aria-label="Отчёт: клиенты">
      <div className="rp2__head" role="row">
        <div role="columnheader">Клиент</div>
        <div className="rp2-num" role="columnheader">Все часы</div>
        <div className="rp2-num" role="columnheader">Оплачиваемые</div>
        <div role="columnheader">Оплачиваемых %</div>
        <div className="rp2-num" role="columnheader" title="Оплачиваемая сумма в валюте проекта строки (код в ячейке)">Сумма</div>
        <div className="rp2__head-chev" aria-hidden />
      </div>
      <div className="rp2__body" role="rowgroup">
        {clientRows.map((r) => {
          const key = timeReportPhysicalRowKey('clients', r);
          const isOpen = expanded.has(key);
          const canToggle = !!r.users?.length;
          const prevTitle = goClientPreview
            ? `Предпросмотр: отчёт по клиенту «${r.client_name}» — широкая редактируемая таблица (локально)`
            : undefined;
          const clientPreviewOff = !goClientPreview || Boolean(clientRowPreviewDisabled);
          return (<div key={key} className={`rp2__group${isOpen ? ' rp2__group--open' : ''}${canToggle ? '' : ' rp2__group--leaf'}`}>
            {canToggle ? (<>
              <div className="rp2__group-row rp2__group-row--split" role="row">
                <button type="button" className="rp2__client-preview-btn" onClick={() => goClientPreview?.(r.client_id)} disabled={clientPreviewOff} title={goClientPreview ? prevTitle : undefined} aria-label={goClientPreview ? prevTitle : undefined}>
                  <span className="rp2__group-name">
                    <span className="rp2__group-dot" data-hash={key} aria-hidden />
                    <span className="rp2__group-title">{r.client_name}</span>
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
                <button type="button" className="rp2__client-expand-btn" onClick={() => onToggle(key)} aria-expanded={isOpen} aria-label={isOpen ? 'Свернуть строки по сотрудникам' : 'Развернуть строки по сотрудникам'}>
                  <span className="rp2__group-chev" aria-hidden>
                    <IcoExpand open={isOpen} />
                  </span>
                </button>
              </div>
            </>) : (<button type="button" className="rp2__group-row rp2__group-row--button" onClick={() => goClientPreview?.(r.client_id)} disabled={clientPreviewOff} title={goClientPreview ? prevTitle : undefined} aria-label={goClientPreview ? prevTitle : undefined}>
              <span className="rp2__group-name">
                <span className="rp2__group-dot" data-hash={key} aria-hidden />
                <span className="rp2__group-title">{r.client_name}</span>
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
  const projectRows = rows as TimeRowProjects[];
  const goProjectPreview = onProjectRowPreview;
  return (<div className="rp2 rp2--projects" role="table" aria-label="Отчёт: проекты">
    <div className="rp2__head" role="row">
      <div role="columnheader">Проект</div>
      <div role="columnheader">Клиент</div>
      <div className="rp2-num" role="columnheader">Все часы</div>
      <div className="rp2-num" role="columnheader">Оплачиваемые</div>
      <div role="columnheader">Оплачиваемых %</div>
      <div className="rp2-num" role="columnheader" title="Оплачиваемая сумма в валюте проекта">Сумма</div>
      <div className="rp2__head-chev" aria-hidden />
    </div>
    <div className="rp2__body" role="rowgroup">
      {projectRows.map((r) => {
        const key = r.project_id;
        const title = `Предпросмотр: отчёт по проекту «${r.project_name}» — широкая редактируемая таблица (локально)`;
        return (<div key={key} className="rp2__group rp2__group--leaf">
          <button type="button" className="rp2__group-row rp2__group-row--button" onClick={() => goProjectPreview?.(r.project_id)} disabled={!goProjectPreview || Boolean(projectRowPreviewDisabled)} title={goProjectPreview ? title : undefined} aria-label={goProjectPreview ? title : undefined}>
            <span className="rp2__group-name rp2__group-name--bold">
              <span className="rp2__group-dot" data-hash={key} aria-hidden />
              <span className="rp2__group-title">{r.project_name}</span>
            </span>
            <span className="rp2__group-sub">{r.client_name}</span>
            <span className="rp2-num rp2__group-metric">{fmtH(r.total_hours)}</span>
            <span className="rp2-num rp2__group-metric">{fmtH(r.billable_hours)}</span>
            <span className="rp2__group-metric">
              <PctBar a={r.billable_hours} b={r.total_hours} />
            </span>
            <span className="rp2-num rp2__group-metric rp2__group-metric--amount">
              {fmtAmtWithIso(r.billable_amount, r.currency)}
            </span>
            <span className="rp2__group-chev" aria-hidden />
          </button>
        </div>);
      })}
    </div>
  </div>);
}
export function ExpenseTable({ groupBy, rows, expanded, onToggle, }: {
  groupBy: ExpenseGroup;
  rows: (ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam)[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (groupBy === 'team') {
    const teamRows = rows as ExpRowTeam[];
    return (<table className="tt-reports__table rp-table">
      <thead>
        <tr>
          <th>Сотрудник</th>
          <th className="rp-table__num">Всего расходов</th>
          <th className="rp-table__num">Возмещаемые</th>
          <th className="rp-table__num">Возмещаемых %</th>
        </tr>
      </thead>
      <tbody>
        {teamRows.map((r) => (<tr key={r.user_id}>
          <td>
            {r.user_name}
            {r.is_contractor && <span className="rp-badge rp-badge--muted">Подрядчик</span>}
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
          <th>Клиент</th>
          <th className="rp-table__num">Всего расходов</th>
          <th className="rp-table__num">Возмещаемые</th>
          <th className="rp-table__num">Возмещаемых %</th>
          <th className="rp-table__expand-col" aria-label="Развернуть" />
        </tr>
      </thead>
      <tbody>
        {clientRows.map((r) => {
          const key = expenseClientsRowKey(r);
          const isOpen = expanded.has(key);
          return (<>
            <tr key={key} className="rp-table__group-row" onClick={() => r.users?.length && onToggle(key)}>
              <td className="rp-table__name-cell">{r.client_name}</td>
              <td className="rp-table__num">{fmtAmt(r.total_amount, r.currency)}</td>
              <td className="rp-table__num">{fmtAmt(r.billable_amount, r.currency)}</td>
              <td className="rp-table__num">{pct(r.billable_amount, r.total_amount)}</td>
              <td className="rp-table__expand-col">
                {r.users?.length ? <button type="button" className="rp-table__expand-btn" aria-expanded={isOpen}><IcoExpand open={isOpen} /></button> : null}
              </td>
            </tr>
            {isOpen && <ExpenseUserRows users={r.users ?? []} currency={r.currency} />}
          </>);
        })}
      </tbody>
    </table>);
  }
  if (groupBy === 'categories') {
    const catRows = rows as ExpRowCategories[];
    return (<table className="tt-reports__table rp-table">
      <thead>
        <tr>
          <th>Категория</th>
          <th className="rp-table__num">Всего расходов</th>
          <th className="rp-table__num">Возмещаемые</th>
          <th className="rp-table__num">Возмещаемых %</th>
          <th className="rp-table__expand-col" aria-label="Развернуть" />
        </tr>
      </thead>
      <tbody>
        {catRows.map((r, i) => {
          const key = r.expense_category_id ?? `cat-${i}`;
          const isOpen = expanded.has(key);
          return (<>
            <tr key={key} className="rp-table__group-row" onClick={() => r.users?.length && onToggle(key)}>
              <td className="rp-table__name-cell">{r.expense_category_name || '—'}</td>
              <td className="rp-table__num">{fmtAmt(r.total_amount, r.currency)}</td>
              <td className="rp-table__num">{fmtAmt(r.billable_amount, r.currency)}</td>
              <td className="rp-table__num">{pct(r.billable_amount, r.total_amount)}</td>
              <td className="rp-table__expand-col">
                {r.users?.length ? <button type="button" className="rp-table__expand-btn" aria-expanded={isOpen}><IcoExpand open={isOpen} /></button> : null}
              </td>
            </tr>
            {isOpen && <ExpenseUserRows users={r.users ?? []} currency={r.currency} />}
          </>);
        })}
      </tbody>
    </table>);
  }
  const projectRows = rows as ExpRowProjects[];
  return (<table className="tt-reports__table rp-table">
    <thead>
      <tr>
        <th>Проект</th>
        <th>Клиент</th>
        <th className="rp-table__num">Всего расходов</th>
        <th className="rp-table__num">Возмещаемые</th>
        <th className="rp-table__num">Возмещаемых %</th>
        <th className="rp-table__expand-col" aria-label="Развернуть" />
      </tr>
    </thead>
    <tbody>
      {projectRows.map((r) => {
        const key = r.project_id;
        const isOpen = expanded.has(key);
        return (<>
          <tr key={key} className="rp-table__group-row" onClick={() => r.users?.length && onToggle(key)}>
            <td className="rp-table__name-cell rp-table__name-cell--bold">{r.project_name}</td>
            <td className="rp-table__muted">{r.client_name}</td>
            <td className="rp-table__num">{fmtAmt(r.total_amount, r.currency)}</td>
            <td className="rp-table__num">{fmtAmt(r.billable_amount, r.currency)}</td>
            <td className="rp-table__num">{pct(r.billable_amount, r.total_amount)}</td>
            <td className="rp-table__expand-col">
              {r.users?.length ? <button type="button" className="rp-table__expand-btn" aria-expanded={isOpen}><IcoExpand open={isOpen} /></button> : null}
            </td>
          </tr>
          {isOpen && <ExpenseUserRows users={r.users ?? []} currency={r.currency} />}
        </>);
      })}
    </tbody>
  </table>);
}
export function UninvoicedTable({ rows, expanded, onToggle, }: {
  rows: UninvoicedRow[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (<table className="tt-reports__table rp-table">
    <thead>
      <tr>
        <th>Проект</th>
        <th>Клиент</th>
        <th>Вал.</th>
        <th className="rp-table__num">Billable часов</th>
        <th className="rp-table__num">Без счёта ч.</th>
        <th className="rp-table__num">Без счёта (сумма)</th>
        <th className="rp-table__num">Расходы без счёта</th>
        <th className="rp-table__expand-col" aria-label="Развернуть" />
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
  if (!rows.length)
    return null;
  return (<div className="rpb" role="table" aria-label="Бюджет проектов">
    <div className="rpb__head" role="row">
      <div role="columnheader">Проект</div>
      <div role="columnheader">Клиент</div>
      <div role="columnheader">Тип</div>
      <div className="rpb-num" role="columnheader">Бюджет</div>
      <div className="rpb-num" role="columnheader">Израсходовано</div>
      <div className="rpb-num" role="columnheader">Остаток</div>
      <div role="columnheader">Прогресс</div>
      <div role="columnheader" aria-label="Развернуть" />
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
          ? 'часы'
          : r.budget_by === 'money'
            ? (cur || '—')
            : 'часы + сумма';
      const fmtMoneyCell = (n: number | null | undefined) => n != null && Number.isFinite(n)
        ? `${Math.round(n).toLocaleString('ru-RU')}${cur ? ` ${cur}` : ''}`
        : '—';
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
              {!r.is_active && <span className="rpb-tag rpb-tag--muted">Архив</span>}
              {r.budget_is_monthly && <span className="rpb-tag rpb-tag--info">В месяц</span>}
              {isOver && <span className="rpb-tag rpb-tag--danger">Перерасход</span>}
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
function expenseClientsRowKey(r: ExpRowClients): string {
    const gid = r.report_group_id?.trim();
    if (gid)
        return gid;
    const cur = String(r.group_currency ?? r.currency ?? '').trim() || '—';
    return `${r.client_id}|${cur}`;
}
export function ReportsPanel() {
  const navigate = useNavigate();
  const reportsDateRangeId = useId();
  const { user } = useCurrentUser();
  const { showAlert } = useAppDialog();
  void user;
  const savedPrefs = useMemo(() => readReportsPrefsFromStorage(), []);
  const initRange = useMemo(() => readInitialReportsRangeState(), []);
  const [periodDate, setPeriodDate] = useState(() => initRange.periodDate);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>(() => initRange.periodGranularity);
  const [customRangeActive, setCustomRangeActive] = useState(() => initRange.customRangeActive);
  const [dateFrom, setDateFrom] = useState(() => initRange.dateFrom);
  const [dateTo, setDateTo] = useState(() => initRange.dateTo);
  const [periodDropdown, setPeriodDropdown] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const presetRange = useMemo(() => periodToDates(periodDate, periodGranularity), [periodDate, periodGranularity]);
  useEffect(() => {
    if (customRangeActive)
      return;
    setDateFrom(presetRange.dateFrom);
    setDateTo(presetRange.dateTo);
  }, [presetRange.dateFrom, presetRange.dateTo, customRangeActive]);
  const periodTitle = useMemo(() => (customRangeActive ? formatIsoRangeTitle(dateFrom, dateTo) : formatPeriodLabel(periodDate, periodGranularity)), [customRangeActive, dateFrom, dateTo, periodDate, periodGranularity]);
  function goPrev() {
    setCustomRangeActive(false);
    setPeriodDate((d) => {
      const next = new Date(d);
      if (periodGranularity === 'week')
        next.setDate(next.getDate() - 7);
      else if (periodGranularity === 'month')
        next.setMonth(next.getMonth() - 1);
      else if (periodGranularity === 'quarter')
        next.setMonth(next.getMonth() - 3);
      else
        next.setFullYear(next.getFullYear() - 1);
      return next;
    });
  }
  function goNext() {
    setCustomRangeActive(false);
    setPeriodDate((d) => {
      const next = new Date(d);
      if (periodGranularity === 'week')
        next.setDate(next.getDate() + 7);
      else if (periodGranularity === 'month')
        next.setMonth(next.getMonth() + 1);
      else if (periodGranularity === 'quarter')
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
  type AnyRow = TimeRowClients | TimeRowProjects | ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam | UninvoicedRow | BudgetRow;
  const [results, setResults] = useState<AnyRow[]>([]);
  const [pagination, setPagination] = useState<ReportPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [reportsSection, setReportsSection] = useState<'build' | 'partner-confirmed'>('build');
  const [exportBusy, setExportBusy] = useState(false);
  const [reportPageSizeMax, setReportPageSizeMax] = useState<number | null>(null);
  const effectivePerPage = useMemo(() => Math.min(PER_PAGE, reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : 500), [reportPageSizeMax]);
  const [tableSearch, setTableSearch] = useState('');
  const [debouncedTableSearch, setDebouncedTableSearch] = useState('');
  const [searchFullRows, setSearchFullRows] = useState<AnyRow[] | null>(null);
  const [searchFullLoading, setSearchFullLoading] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTableSearch(tableSearch.trim()), 300);
    return () => window.clearTimeout(t);
  }, [tableSearch]);
  useEffect(() => {
    const q = debouncedTableSearch.trim();
    if (!q || !dateFrom || !dateTo || dateFrom > dateTo) {
      setSearchFullRows(null);
      setSearchFullLoading(false);
      return;
    }
    let cancelled = false;
    setSearchFullLoading(true);
    setSearchFullRows(null);
    const filtersBase: Omit<ReportFiltersV2, 'page' | 'per_page'> = {
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
    };
    void (async () => {
      try {
        let out: AnyRow[] = [];
        if (reportType === 'time') {
          if (groupBy === 'clients')
            out = await fetchAllTimeReportClientRows(filtersBase);
          else if (groupBy === 'projects')
            out = await fetchAllTimeReportProjectRows(filtersBase);
        }
        else if (isExpenseLikeReportType(reportType)) {
          out = await fetchAllExpenseReportRows(groupBy as ExpenseGroup, filtersBase);
        }
        else if (reportType === 'uninvoiced') {
          out = await fetchAllUninvoicedReportRows(filtersBase);
        }
        else if (reportType === 'project-budget') {
          out = await fetchAllBudgetReportRows(filtersBase);
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
  }, [debouncedTableSearch, reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, reportPageSizeMax]);
  useEffect(() => {
    setUsersForFilterError(null);
    fetchReportsUsersForFilter()
      .then((list) => {
        setUsersForFilter(list);
        setUsersForFilterError(null);
        if (list.length === 1 && user && list[0].id === user.id) {
          setSelectedUserIds((prev) => (prev.length === 0 ? [user.id] : prev));
        }
      })
      .catch((e: unknown) => {
        setUsersForFilter([]);
        if (isTimeTrackingHttpError(e, 401) || isTimeTrackingHttpError(e, 403))
          setUsersForFilterError('Нет доступа к списку сотрудников для фильтра.');
      });
  }, [user]);
  useEffect(() => {
    void fetchReportsMeta()
      .then((m) => {
        setReportPageSizeMax(m.pageSizeMax);
      })
      .catch(() => {
        setReportPageSizeMax(null);
      });
  }, []);
  useEffect(() => {
    writeReportsPrefsToStorage({
      v: 1,
      reportType,
      groupBy,
      periodGranularity,
      periodAnchorIso: isoDateLocal(periodDate),
      selectedUserIds,
      includeFixed,
      customRange: customRangeActive,
      rangeDateFrom: customRangeActive ? dateFrom : undefined,
      rangeDateTo: customRangeActive ? dateTo : undefined,
    });
  }, [
    reportType,
    groupBy,
    periodGranularity,
    periodDate,
    selectedUserIds,
    includeFixed,
    customRangeActive,
    dateFrom,
    dateTo,
  ]);
  useEffect(() => {
    const aborted = { current: false };
    setLoading(true);
    setError(null);
    if (!dateFrom || !dateTo) {
      setError('Укажите даты периода (поля «С» и «По»).');
      setResults([]);
      setPagination(null);
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    if (dateFrom > dateTo) {
      setError('Дата «с» не может быть позже даты «по».');
      setResults([]);
      setPagination(null);
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    const filters: ReportFiltersV2 = {
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page,
      per_page: effectivePerPage,
    };
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
      })
      .catch((e: unknown) => {
        if (aborted.current)
          return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки отчёта');
        setResults([]);
        setPagination(null);
      })
      .finally(() => {
        if (aborted.current)
          return;
        setLoading(false);
        setInitialLoading(false);
      });
    return () => { aborted.current = true; };
  }, [reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, page, reportPageSizeMax, effectivePerPage]);
  const tableSearchQ = debouncedTableSearch.trim().toLowerCase();
  const filteredTableRows = useMemo(() => {
    if (!tableSearchQ)
      return results;
    const src = searchFullRows ?? [];
    if (!src.length)
      return [];
    return src.filter((r) => buildReportRowHaystack(r).includes(tableSearchQ));
  }, [tableSearchQ, results, searchFullRows]);
  const sortedTimeTableRows = useMemo((): (TimeRowClients | TimeRowProjects)[] | null => {
    if (reportType !== 'time')
      return null;
    return sortTimeReportRowsForDisplay(groupBy as TimeGroup, filteredTableRows as (TimeRowClients | TimeRowProjects)[]);
  }, [reportType, groupBy, filteredTableRows]);
  const tableDataLoading = loading || (Boolean(tableSearchQ) && searchFullLoading);
  const tableSearchPlaceholder = useMemo(() => {
    if (reportType === 'time') {
      if (groupBy === 'projects')
        return 'Проект, клиент, код…';
      if (groupBy === 'clients')
        return 'Клиент, валюта (USD, UZS…)…';
    }
    if (isExpenseLikeReportType(reportType)) {
      if (groupBy === 'projects')
        return 'Проект, клиент…';
      if (groupBy === 'clients')
        return 'Клиент…';
      if (groupBy === 'categories')
        return 'Категория…';
      if (groupBy === 'team')
        return 'Сотрудник…';
    }
    if (reportType === 'uninvoiced')
      return 'Клиент, проект…';
    return 'Клиент, проект…';
  }, [reportType, groupBy]);
  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const kpi = useMemo(() => {
    const kpiRows: AnyRow[] = tableSearchQ ? filteredTableRows : results;
    if (reportType === 'time') {
      const rows = kpiRows as (TimeRowClients | TimeRowProjects)[];
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
      const rows = kpiRows as (ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam)[];
      const expMap = new Map<string, {
        totalAmount: number;
        billableAmount: number;
      }>();
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
      const rows = kpiRows as UninvoicedRow[];
      const uninvoicedHours = rows.reduce((s, r) => s + (r.uninvoiced_hours ?? 0), 0);
      const uMap = new Map<string, {
        uninvoicedAmount: number;
        uninvoicedExpenses: number;
      }>();
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
    const rows = kpiRows as BudgetRow[];
    const projectCount = rows.length;
    let totalHoursBudget = 0;
    let spentHours = 0;
    const moneyByCurMap = new Map<string, {
      totalBudget: number;
      spent: number;
    }>();
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
  }, [results, filteredTableRows, tableSearchQ, reportType]);
  function openReportPreview() {
    if (tableDataLoading || filteredTableRows.length === 0)
      return;
    const filters: ReportFiltersV2 = {
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page: 1,
      per_page: effectivePerPage,
    };
    let payload: ReportPreviewTransferV2;
    if (reportType === 'time') {
      payload = { v: 2, reportType: 'time', groupBy: groupBy as ReportPreviewTimeGroup, filters };
    }
    else if (reportType === 'expenses') {
      const g = groupBy as ExpenseGroup;
      payload = { v: 2, reportType: 'expenses', groupBy: g, filters };
    }
    else if (reportType === 'uninvoiced') {
      payload = { v: 2, reportType: 'uninvoiced', filters };
    }
    else {
      payload = { v: 2, reportType: 'project-budget', filters };
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
    const filters: ReportFiltersV2 = {
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: includeFixed,
      project_id: trimmed,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page: 1,
      per_page: effectivePerPage,
    };
    const payload: ReportPreviewTransferV2 = {
      v: 2,
      reportType: 'time',
      groupBy: 'projects',
      filters,
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
    const filters: ReportFiltersV2 = {
      dateFrom,
      dateTo,
      user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
      include_fixed_fee: includeFixed,
      client_id: trimmed,
      pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
      page: 1,
      per_page: effectivePerPage,
    };
    const payload: ReportPreviewTransferV2 = {
      v: 2,
      reportType: 'time',
      groupBy: 'clients',
      filters,
    };
    writeReportPreviewTransfer(payload);
    navigate(routes.timeTrackingReportPreview);
  }
  async function handleExport(format: 'csv' | 'xlsx') {
    if (exportBusy)
      return;
    setExportBusy(true);
    try {
      const baseFilters: Omit<ReportFiltersV2, 'page' | 'per_page'> = {
        dateFrom,
        dateTo,
        user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
        include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
      };
      const gb = groups ? groupBy : null;
      if (reportType === 'time')
        await exportReportV2(reportType, gb, baseFilters, format, { timeExport: format === 'xlsx' ? 'summary' : 'detail' });
      else
        await exportReportV2(reportType, gb, baseFilters, format);
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : 'Ошибка экспорта' });
    }
    finally {
      setExportBusy(false);
    }
  }
  const breakdownHint = useMemo(() => {
    if (reportType === 'time') {
      const g = groups?.find((x) => x.id === groupBy)?.label ?? groupBy;
      const base = `Отчёт по времени — разрез: ${g}`;
      if (groupBy === 'clients') {
        return `${base}. Один клиент может быть в нескольких строках — по валюте проекта записей; суммы в разных валютах не складываются.`;
      }
      return base;
    }
    if (reportType === 'expenses') {
      const g = groups?.find((x) => x.id === groupBy)?.label ?? groupBy;
      return `Отчёт по расходам — разрез: ${g}`;
    }
    if (reportType === 'uninvoiced')
      return 'Неинвойсированные часы и расходы по проектам';
    return 'Бюджет проектов: план / факт / остаток';
  }, [reportType, groupBy, groups]);
  const reportsSectionSwitcher = (<div className="tt-reports__type-block tt-reports__section-switch">
      <p className="tt-reports__type-block-title" id="tt-reports-section-heading">
        Раздел
      </p>
      <nav className="tt-reports__type-nav" role="tablist" aria-labelledby="tt-reports-section-heading">
        <button type="button" role="tab" aria-selected={reportsSection === 'build'} className={`tt-reports__type-tab${reportsSection === 'build' ? ' tt-reports__type-tab--active' : ''}`} onClick={() => setReportsSection('build')}>
          Построение отчётов
        </button>
        <button type="button" role="tab" aria-selected={reportsSection === 'partner-confirmed'} className={`tt-reports__type-tab${reportsSection === 'partner-confirmed' ? ' tt-reports__type-tab--active' : ''}`} onClick={() => setReportsSection('partner-confirmed')}>
          Подтверждённые партнёром
        </button>
      </nav>
    </div>);
  if (reportsSection === 'partner-confirmed') {
    return (<div className="tt-reports">
        {reportsSectionSwitcher}
        <ConfirmedPartnerReportsPanel />
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

    <div className="tt-reports__type-block">
      <p className="tt-reports__type-block-title" id="tt-reports-type-heading">
        Вид отчёта
      </p>
      <nav className="tt-reports__type-nav" role="tablist" aria-labelledby="tt-reports-type-heading">
        {REPORT_TYPES.map((tab) => (<button key={tab.id} type="button" role="tab" aria-selected={reportType === tab.id} className={`tt-reports__type-tab${reportType === tab.id ? ' tt-reports__type-tab--active' : ''}`} onClick={() => changeReportType(tab.id)}>
          {tab.label}
        </button>))}
      </nav>
    </div>

    <div className="tt-reports__header">
      <div className="tt-reports__header-left">
        <button type="button" className="tt-reports__nav-btn" onClick={goPrev} aria-label="Предыдущий период">
          <IcoChevLeft />
        </button>
        <h2 className="tt-reports__period-title">{periodTitle}</h2>
        <button type="button" className="tt-reports__nav-btn" onClick={goNext} aria-label="Следующий период">
          <IcoChevRight />
        </button>
      </div>
      <div className="tt-reports__header-right">
        {usersForFilterError ? (<p className="tt-reports__users-filter-err" role="status">{usersForFilterError}</p>) : null}
        <UserFilterDropdown users={usersForFilter} selected={selectedUserIds} onChange={(ids) => { setSelectedUserIds(ids); setPage(1); }} />

        <div className="tt-reports__period-dropdown-wrap" ref={periodDropdownRef}>
          <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown" onClick={() => setPeriodDropdown((v) => !v)} aria-expanded={periodDropdown}>
            {PERIOD_OPTIONS.find((o) => o.id === periodGranularity)?.label ?? 'Месяц'} <IcoChevDown />
          </button>
          {periodDropdown && (<div className="tt-reports__period-dropdown" role="listbox">
            {PERIOD_OPTIONS.map((opt) => (<button key={opt.id} type="button" role="option" aria-selected={periodGranularity === opt.id} className={`tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`} onClick={() => {
              setCustomRangeActive(false);
              setPeriodGranularity(opt.id);
              setPeriodDropdown(false);
            }}>
              {opt.label}
            </button>))}
          </div>)}
        </div>
      </div>
    </div>

    <div className="tt-reports__date-range" aria-label="Фильтр по датам">
      <span className="tt-reports__date-range-title">Даты отчёта</span>
      <div className="tt-reports__date-field">
        <span className="tt-reports__date-field-label" id={`${reportsDateRangeId}-from`}>
          С
        </span>
        <DatePicker value={dateFrom} max={dateTo} onChange={(iso) => {
          setDateFrom(iso);
          if (iso > dateTo)
            setDateTo(iso);
          setCustomRangeActive(true);
          setPage(1);
        }} aria-labelledby={`${reportsDateRangeId}-from`} portal buttonClassName="tt-reports__date-picker-btn" />
      </div>
      <div className="tt-reports__date-field">
        <span className="tt-reports__date-field-label" id={`${reportsDateRangeId}-to`}>
          По
        </span>
        <DatePicker value={dateTo} min={dateFrom} onChange={(iso) => {
          setDateTo(iso);
          if (iso < dateFrom)
            setDateFrom(iso);
          setCustomRangeActive(true);
          setPage(1);
        }} aria-labelledby={`${reportsDateRangeId}-to`} portal buttonClassName="tt-reports__date-picker-btn" />
      </div>
      {customRangeActive ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => {
        setCustomRangeActive(false);
        setPage(1);
      }}>
        К периоду ({PERIOD_OPTIONS.find((o) => o.id === periodGranularity)?.label ?? 'месяц'})
      </button>) : null}
    </div>


    <div className="tt-reports__summary">
      {kpi.kind === 'time' && (<>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">Всего часов</span>
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
                <span>Оплачиваемые</span>
              </span>
              <span className="tt-reports__legend-item-value">{fmtH(kpi.billableHours)}</span>
            </span>
            <span className="tt-reports__legend-item">
              <span className="tt-reports__legend-item-top">
                <span className="tt-reports__legend-dot tt-reports__legend-dot--nonbillable" aria-hidden />
                <span>Неоплачиваемые</span>
              </span>
              <span className="tt-reports__legend-item-value">{fmtH(kpi.totalHours - kpi.billableHours)}</span>
            </span>
          </div>
        </div>
        {kpi.billableByCurrency.length === 0 ? (<div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">Оплачиваемая сумма</span>
          </span>
          <span className="tt-reports__summary-value">—</span>
        </div>) : (kpi.billableByCurrency.map((bc) => (<div key={bc.currency} className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">Оплачиваемая сумма</span>
            <span className="tt-reports__summary-label-accent">{bc.currency}</span>
          </span>
          <span className="tt-reports__summary-value">{fmtAmtWithIso(bc.amount, bc.currency)}</span>
        </div>)))}
        {reportType === 'time' && kpi.billableByCurrency.length > 1 && (<p className="tt-reports__summary-footnote">
          Суммы по валютам считаются отдельно; одна цифра «всего денег» без курса не показывается.
        </p>)}
        {reportType === 'time' && (<div className="tt-reports__summary-options" role="group" aria-label="Параметры отчёта по времени">
          <label className="tt-reports__summary-check">
            <input type="checkbox" checked={includeFixed} onChange={(e) => { setIncludeFixed(e.target.checked); setPage(1); }} />
            <span>Включить проекты с фиксированной оплатой</span>
          </label>
        </div>)}
      </>)}
      {kpi.kind === 'expenses' && kpi.expensesByCurrency.length === 1 && (() => {
        const x = kpi.expensesByCurrency[0]!;
        const billPct = x.totalAmount > 0 ? (x.billableAmount / x.totalAmount) * 100 : 0;
        return (<>
          <div className="tt-reports__summary-card">
            <span className="tt-reports__summary-label">Всего расходов</span>
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
                  <span>Возмещаемые</span>
                </span>
                <span className="tt-reports__legend-item-value">{fmtAmt(x.billableAmount, x.currency)}</span>
              </span>
              <span className="tt-reports__legend-item">
                <span className="tt-reports__legend-item-top">
                  <span className="tt-reports__legend-dot tt-reports__legend-dot--nonbillable" aria-hidden />
                  <span>Прочие</span>
                </span>
                <span className="tt-reports__legend-item-value">{fmtAmt(x.totalAmount - x.billableAmount, x.currency)}</span>
              </span>
            </div>
          </div>
          <div className="tt-reports__summary-card tt-reports__summary-amount">
            <span className="tt-reports__summary-label">Возмещаемые</span>
            <span className="tt-reports__summary-value">{fmtAmt(x.billableAmount, x.currency)}</span>
          </div>
          <div className="tt-reports__summary-card">
            <span className="tt-reports__summary-label">% возмещаемых</span>
            <span className="tt-reports__summary-value">{pct(x.billableAmount, x.totalAmount)}</span>
          </div>
        </>);
      })()}
      {kpi.kind === 'expenses' && kpi.expensesByCurrency.length > 1 && (<>
        {kpi.expensesByCurrency.map((x) => (<div key={x.currency} className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">Расходы</span>
            <span className="tt-reports__summary-label-accent">{x.currency}</span>
          </span>
          <span className="tt-reports__summary-value">{fmtAmt(x.totalAmount, x.currency)}</span>
          <span className="tt-reports__summary-sub">
            Возмещаемые: {fmtAmt(x.billableAmount, x.currency)} · {pct(x.billableAmount, x.totalAmount)} от суммы в
            этой валюте
          </span>
        </div>))}
        <div className="tt-reports__summary-card tt-reports__summary-chart">
          <div className="tt-reports__pie-legend tt-reports__pie-legend--stack">
            <span className="tt-reports__summary-label tt-reports__summary-label--block-head">
              Доля возмещаемых по валютам
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
          <span className="tt-reports__summary-label">% возмещаемых</span>
          <span className="tt-reports__summary-value">—</span>
          <span className="tt-reports__summary-sub">Считается отдельно по каждой валюте (см. плитки выше).</span>
        </div>
      </>)}
      {kpi.kind === 'expenses' && kpi.expensesByCurrency.length === 0 && (<div className="tt-reports__summary-card tt-reports__summary-amount">
        <span className="tt-reports__summary-label">Расходы</span>
        <span className="tt-reports__summary-value">—</span>
      </div>)}
      {kpi.kind === 'uninvoiced' && (<>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">Без счёта (часы)</span>
          <span className="tt-reports__summary-value">{fmtH(kpi.uninvoicedHours)}</span>
        </div>
        {kpi.uninvoicedByCurrency.length === 0 ? (<div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">Без счёта (суммы)</span>
          </span>
          <span className="tt-reports__summary-value">—</span>
        </div>) : (kpi.uninvoicedByCurrency.map((u) => (<div key={u.currency} className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label tt-reports__summary-label--stack">
            <span className="tt-reports__summary-label-primary">Без счёта</span>
            <span className="tt-reports__summary-label-accent">{u.currency}</span>
          </span>
          <span className="tt-reports__summary-value">{fmtAmt(u.uninvoicedAmount, u.currency)}</span>
          <span className="tt-reports__summary-sub">
            Расходы без счёта: {fmtAmt(u.uninvoicedExpenses, u.currency)}
          </span>
        </div>)))}
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">Проектов в списке</span>
          <span className="tt-reports__summary-value">{tableSearchQ ? filteredTableRows.length : (pagination?.total_entries ?? results.length)}</span>
        </div>
      </>)}
      {kpi.kind === 'budget' && (<>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">Проектов с бюджетом</span>
          <span className="tt-reports__summary-value">{kpi.projectCount}</span>
        </div>
        <div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label">Бюджет (часы) израсх.</span>
          <span className="tt-reports__summary-value">{fmtH(kpi.spentHours)} / {fmtH(kpi.totalHoursBudget)}</span>
        </div>
        {kpi.moneyBudgetByCurrency.length === 0 ? (<div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label">Бюджет (деньги) израсх.</span>
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
              <span className="tt-reports__summary-label-primary">Бюджет (деньги)</span>
              <span className="tt-reports__summary-label-accent">{m.currency}</span>
            </span>
            <span className="tt-reports__summary-value">{line}</span>
          </div>);
        }))}
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">Загрузка (часовые пр.)</span>
          <span className="tt-reports__summary-value">
            <IcoBudget />
            {kpi.totalHoursBudget > 0 ? ` ${Math.round((kpi.spentHours / kpi.totalHoursBudget) * 100)}%` : '—'}
          </span>
        </div>
      </>)}
    </div>


    {groups && (<nav className="tt-reports__group-nav" role="tablist">
      {groups.map((g) => (<button key={g.id} type="button" role="tab" aria-selected={groupBy === g.id} className={`tt-reports__group-tab${groupBy === g.id ? ' tt-reports__group-tab--active' : ''}`} onClick={() => changeGroupBy(g.id)}>
        {g.label}
      </button>))}
    </nav>)}


    <div className="tt-reports__content">
      <div className="tt-reports__content-header">
        <div className="tt-reports__breakdown-label" role="status">
          <span className="tt-reports__breakdown-hint">{breakdownHint}</span>
          {tableDataLoading && <span className="tt-reports__loading-pulse tt-reports__breakdown-status">обновление…</span>}
        </div>
        <div className="tt-reports__content-header-right">
          <div className="tt-reports__toolbar">
            <div className="tt-reports__toolbar-search">
              <input type="search" className="tt-reports__table-search-input" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder={tableSearchPlaceholder} aria-label="Поиск по таблице" />
            </div>
            <div className="tt-reports__toolbar-meta" aria-live="polite">
              {tableSearchQ ? (<span className="tt-reports__row-count tt-reports__breakdown-status">
                {searchFullLoading ? 'загрузка…' : `${filteredTableRows.length} строк по запросу`}
              </span>) : (!loading && pagination ? (<span className="tt-reports__row-count tt-reports__breakdown-status">
                {pagination.total_entries} строк{pagination.total_entries > effectivePerPage && ` (стр. ${page} / ${pagination.total_pages})`}
              </span>) : !loading ? (<span className="tt-reports__row-count tt-reports__breakdown-status">{results.length} строк</span>) : null)}
            </div>
          </div>
          <div className="tt-reports__content-actions">
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={openReportPreview} disabled={tableDataLoading || filteredTableRows.length === 0} title="Открыть страницу предпросмотра: те же фильтры и разрез, данные с сервера в виде широкой редактируемой таблицы (правки только локально, не в этой свёрнутой таблице).">
              Предпросмотр
            </button>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => void handleExport('xlsx')} disabled={exportBusy || tableDataLoading} title={reportType === 'time' ? 'Excel (.xlsx), как в таблице на экране: export=summary. Для больших периодов выгрузка может занять дольше.' : 'Скачать Excel (.xlsx) с сервера по текущим фильтрам.'}>
              <IcoDownload /> Excel
            </button>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => void handleExport('csv')} disabled={exportBusy || tableDataLoading} title={reportType === 'time' ? 'CSV, полный детальный лог: export=detail. Для больших периодов выгрузка может занять дольше.' : 'Скачать CSV по текущим фильтрам.'}>
              <IcoDownload /> CSV
            </button>
          </div>
        </div>
      </div>

      {error && (<div className="tt-reports__table-err" role="alert">{error}</div>)}

      <div className={`tt-reports__table-wrap${tableDataLoading ? ' tt-reports__table-wrap--loading' : ''}${reportType === 'time' || isExpenseLikeReportType(reportType) || reportType === 'uninvoiced' || reportType === 'project-budget' ? ' tt-reports__table-wrap--scroll-x' : ''}`}>
        {filteredTableRows.length === 0 && !tableDataLoading ? (<div className="tt-reports__empty">
          {tableSearchQ ? (<p>Ничего не найдено по запросу.</p>) : (<>
            <p className="tt-reports__empty-period">{formatIsoRangeTitle(dateFrom, dateTo)}</p>
            <p>
              {selectedUserIds.length > 0
                ? 'Нет данных за период и выбранные фильтры.'
                : 'Нет данных за выбранный период.'}
            </p>
          </>)}
        </div>) : reportType === 'time' ? (<TimeTable groupBy={groupBy as TimeGroup} rows={sortedTimeTableRows ?? []} expanded={expandedRows} onToggle={toggleRow} onProjectRowPreview={groupBy === 'projects' ? openTimeProjectPreview : undefined} projectRowPreviewDisabled={groupBy === 'projects' ? tableDataLoading : undefined} onClientRowPreview={groupBy === 'clients' ? openTimeClientPreview : undefined} clientRowPreviewDisabled={groupBy === 'clients' ? tableDataLoading : undefined} />) : isExpenseLikeReportType(reportType) ? (<ExpenseTable groupBy={groupBy as ExpenseGroup} rows={filteredTableRows as (ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam)[]} expanded={expandedRows} onToggle={toggleRow} />) : reportType === 'uninvoiced' ? (<UninvoicedTable rows={filteredTableRows as UninvoicedRow[]} expanded={expandedRows} onToggle={toggleRow} />) : (<BudgetTable rows={filteredTableRows as BudgetRow[]} expanded={expandedRows} onToggle={toggleRow} />)}
      </div>


      {pagination && pagination.total_pages > 1 && !tableSearchQ && (<div className="tt-reports__pagination">
        <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={!pagination.previous_page} onClick={() => setPage((p) => p - 1)}>
          <IcoChevLeft /> Назад
        </button>
        <span className="tt-reports__pagination-info">
          Стр. {pagination.page} / {pagination.total_pages} · {pagination.total_entries} строк
        </span>
        <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={!pagination.next_page} onClick={() => setPage((p) => p + 1)}>
          Вперёд <IcoChevRight />
        </button>
      </div>)}
    </div>
  </div>);
}
