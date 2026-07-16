import { memo, type MouseEvent } from 'react';
import { displayReportProjectLabel, type TimeRowClients, type TimeRowProjects, type TimeRowTasks, type TimeRowTeam, type TimeReportRow, } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { fmtH, fmtAmtWithIso } from '@entities/time-tracking/lib/reportsFormatUtils';
import { timeReportPhysicalRowKey } from '@entities/time-tracking/lib/timeReportRows';
import { type TimeReportPartnerRowBadge } from '@entities/time-tracking/lib/timeReportPartnerBadges';
import type { TimeGroup } from '@entities/time-tracking/model/reportsPanelConfig';
import { IcoExpand, PctBar, TimeUserRows } from './reportsDetailWidgets';

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
function reportRowContextMenuHandler(e: MouseEvent, onContextMenu: ((clientX: number, clientY: number, id: string) => void) | undefined, id: string, disabled: boolean): void {
    if (!onContextMenu || disabled)
        return;
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e.clientX, e.clientY, id);
}
export const TimeTable = memo(function TimeTable({ groupBy, rows, expanded, onToggle, onProjectRowPreview, projectRowPreviewDisabled, onClientRowPreview, clientRowPreviewDisabled, onProjectRowContextMenu, onClientRowContextMenu, partnerProjectBadge, partnerClientBadge, }: {
  groupBy: TimeGroup;
  rows: TimeReportRow[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onProjectRowPreview?: (projectId: string) => void;
  projectRowPreviewDisabled?: boolean;
  onClientRowPreview?: (clientId: string) => void;
  clientRowPreviewDisabled?: boolean;
  onProjectRowContextMenu?: (clientX: number, clientY: number, projectId: string) => void;
  onClientRowContextMenu?: (clientX: number, clientY: number, clientId: string) => void;
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
                <button type="button" className={`rp2__client-preview-btn${cliClasses.row}`} onClick={() => goClientPreview?.(r.client_id)} disabled={clientPreviewOff} title={goClientPreview ? clientAria : undefined} aria-label={goClientPreview ? clientAria : undefined} onContextMenu={(e) => reportRowContextMenuHandler(e, onClientRowContextMenu, r.client_id, clientPreviewOff)}>
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
            </>) : (<button type="button" className={`rp2__group-row rp2__group-row--button${cliClasses.row}`} onClick={() => goClientPreview?.(r.client_id)} disabled={clientPreviewOff} title={goClientPreview ? clientAria : undefined} aria-label={goClientPreview ? clientAria : undefined} onContextMenu={(e) => reportRowContextMenuHandler(e, onClientRowContextMenu, r.client_id, clientPreviewOff)}>
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
          <button type="button" className={`rp2__group-row rp2__group-row--button${pjClasses.row}`} onClick={() => goProjectPreview?.(r.project_id)} disabled={!goProjectPreview || Boolean(projectRowPreviewDisabled)} title={goProjectPreview ? pjAria : undefined} aria-label={goProjectPreview ? pjAria : undefined} onContextMenu={(e) => reportRowContextMenuHandler(e, onProjectRowContextMenu, r.project_id, !goProjectPreview || Boolean(projectRowPreviewDisabled))}>
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
