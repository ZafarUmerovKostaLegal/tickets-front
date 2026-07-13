import { useState, useEffect, useCallback, useId } from 'react';
import { listAllTimeManagerClientsMerged, listAllClientProjectsForClientMerged, listProjectTasksCached, invalidateProjectTasksCache, createProjectTask, patchProjectTask, deleteProjectTask, isForbiddenError, type TimeManagerClientRow, type TimeManagerClientProjectRow, type TimeManagerClientTaskRow, } from '@entities/time-tracking';
import { SearchableSelect, useAppDialog } from '@shared/ui';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
function rateToInput(v: string | number | null | undefined): string {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? String(n) : '';
}
function formatBillableRate(v: string | number | null | undefined, locale: 'ru' | 'en'): string {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n.toLocaleString(localeTag(locale), { maximumFractionDigits: 2 }) : '';
}
function TaskRowBadges({ task }: {
    task: TimeManagerClientTaskRow;
}) {
    const { t } = useI18n();
    return (<div className="tt-task-card__badges">
      <span className={`tt-task-pill${task.billable_by_default ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`} title={task.billable_by_default ? t('timeTrackingPage.tasks.labels.defaultBillableBadge') : t('timeTrackingPage.tasks.labels.defaultNonBillableBadge')}>
        <span className="tt-task-pill__dot" aria-hidden/>
        {task.billable_by_default ? t('timeTrackingPage.common.billable') : t('timeTrackingPage.common.nonBillable')}
      </span>
      {task.billing_mode === 'flat_fee' ? (<span className="tt-task-pill tt-task-pill--billable" title={t('timeTrackingPage.tasks.labels.flatFeeBadge')}>
          {t('timeTrackingPage.tasks.labels.flatFeeBadge')}
        </span>) : null}
    </div>);
}
function taskInitial(name: string): string {
    const trimmed = name.trim();
    if (!trimmed)
        return '?';
    return trimmed.charAt(0).toUpperCase();
}
function taskAccentIndex(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i += 1)
        h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h % 6;
}
const IcoPen = () => (<svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>);
const IcoTrash = () => (<svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>);
type TaskFormState = {
    name: string;
    defaultBillableRate: string;
    billableByDefault: boolean;
    billingMode: 'hourly' | 'flat_fee';
    flatFeeAmount: string;
    flatFeeCurrency: string;
};
function emptyTaskForm(): TaskFormState {
    return {
        name: '',
        defaultBillableRate: '',
        billableByDefault: true,
        billingMode: 'hourly',
        flatFeeAmount: '',
        flatFeeCurrency: 'UZS',
    };
}
function rowToTaskForm(t: TimeManagerClientTaskRow): TaskFormState {
    return {
        name: t.name,
        defaultBillableRate: rateToInput(t.default_billable_rate),
        billableByDefault: t.billable_by_default,
        billingMode: t.billing_mode === 'flat_fee' ? 'flat_fee' : 'hourly',
        flatFeeAmount: rateToInput(t.flat_fee_amount),
        flatFeeCurrency: (t.flat_fee_currency || 'UZS').trim() || 'UZS',
    };
}
function projectSearchText(p: TimeManagerClientProjectRow): string {
    return [p.name, p.code ?? '', p.id].filter(Boolean).join(' ').trim();
}
type TaskModalProps = {
    mode: 'create' | 'edit';
    clientId: string;
    projectId: string;
    initial: TimeManagerClientTaskRow | null;
    onClose: () => void;
    onSaved: (row: TimeManagerClientTaskRow) => void;
};
function ClientTaskModal({ mode, clientId, projectId, initial, onClose, onSaved }: TaskModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [form, setForm] = useState<TaskFormState>(() => (initial ? rowToTaskForm(initial) : emptyTaskForm()));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError(t('timeTrackingPage.tasks.errors.nameRequired'));
            return;
        }
        const rateRaw = form.defaultBillableRate.trim();
        let defaultBillableRate: number | null = null;
        if (rateRaw) {
            const n = parseFloat(rateRaw.replace(',', '.'));
            if (!Number.isFinite(n) || n < 0) {
                setError(t('timeTrackingPage.tasks.errors.rateNonNegative'));
                return;
            }
            defaultBillableRate = n;
        }
        let flatFeeAmount: number | null = null;
        if (form.billingMode === 'flat_fee') {
            const flatRaw = form.flatFeeAmount.trim();
            if (!flatRaw) {
                setError(t('timeTrackingPage.tasks.errors.flatFeeRequired'));
                return;
            }
            const n = parseFloat(flatRaw.replace(',', '.'));
            if (!Number.isFinite(n) || n < 0) {
                setError(t('timeTrackingPage.tasks.errors.flatFeeNonNegative'));
                return;
            }
            flatFeeAmount = n;
        }
        setError(null);
        setSaving(true);
        try {
            if (mode === 'create') {
                const row = await createProjectTask(clientId, projectId, {
                    name,
                    defaultBillableRate,
                    billableByDefault: form.billableByDefault,
                    billingMode: form.billingMode,
                    flatFeeAmount,
                    flatFeeCurrency: form.billingMode === 'flat_fee' ? form.flatFeeCurrency.trim() || 'UZS' : null,
                });
                onSaved(row);
            }
            else if (initial) {
                const row = await patchProjectTask(clientId, projectId, initial.id, {
                    name,
                    defaultBillableRate,
                    billableByDefault: form.billableByDefault,
                    billingMode: form.billingMode,
                    flatFeeAmount,
                    flatFeeCurrency: form.billingMode === 'flat_fee' ? form.flatFeeCurrency.trim() || 'UZS' : null,
                });
                onSaved(row);
            }
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('timeTrackingPage.common.saveFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--task" role="dialog" aria-modal="true" aria-labelledby={`${uid}-task-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-task-title`} className="tt-tm-modal__title">
            {mode === 'create' ? t('timeTrackingPage.tasks.modal.createTitle') : t('timeTrackingPage.tasks.modal.editTitle')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-tname`}>
              {t('timeTrackingPage.tasks.labels.taskName')} <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-tname`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-rate`}>
              {t('timeTrackingPage.tasks.labels.defaultRate')}
            </label>
            <input id={`${uid}-rate`} type="text" inputMode="decimal" className="tt-tm-input" placeholder={t('timeTrackingPage.tasks.modal.ratePlaceholder')} value={form.defaultBillableRate} onChange={(e) => setForm((f) => ({ ...f, defaultBillableRate: e.target.value }))} disabled={form.billingMode === 'flat_fee'}/>
            <p className="tt-tm-hint">{t('timeTrackingPage.tasks.modal.rateHint')}</p>
          </div>
          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.common.parameters')}</legend>
            <label className="tt-tm-check-row">
              <input type="checkbox" checked={form.billableByDefault} onChange={(e) => setForm((f) => ({ ...f, billableByDefault: e.target.checked }))}/>
              <span>{t('timeTrackingPage.tasks.labels.defaultBillableTask')}</span>
            </label>
            <label className="tt-tm-check-row">
              <input type="checkbox" checked={form.billingMode === 'flat_fee'} onChange={(e) => setForm((f) => ({
                ...f,
                billingMode: e.target.checked ? 'flat_fee' : 'hourly',
                flatFeeAmount: e.target.checked && !f.flatFeeAmount ? '230000' : f.flatFeeAmount,
                flatFeeCurrency: e.target.checked ? (f.flatFeeCurrency || 'UZS') : f.flatFeeCurrency,
            }))}/>
              <span>{t('timeTrackingPage.tasks.labels.flatFeeTask')}</span>
            </label>
          </fieldset>
          {form.billingMode === 'flat_fee' ? (<div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-flat`}>
              {t('timeTrackingPage.tasks.labels.flatFeeAmount')} <span className="tt-tm-req">*</span>
            </label>
            <div className="tt-tm-field-row" style={{ display: 'flex', gap: '0.5rem' }}>
              <input id={`${uid}-flat`} type="text" inputMode="decimal" className="tt-tm-input" placeholder={t('timeTrackingPage.tasks.modal.flatFeePlaceholder')} value={form.flatFeeAmount} onChange={(e) => setForm((f) => ({ ...f, flatFeeAmount: e.target.value }))}/>
              <input className="tt-tm-input" style={{ maxWidth: '5.5rem' }} value={form.flatFeeCurrency} onChange={(e) => setForm((f) => ({ ...f, flatFeeCurrency: e.target.value.toUpperCase() }))} aria-label={t('timeTrackingPage.tasks.labels.flatFeeCurrency')}/>
            </div>
            <p className="tt-tm-hint">{t('timeTrackingPage.tasks.modal.flatFeeHint')}</p>
          </div>) : null}
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            {t('timeTrackingPage.cancel')}
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? t('timeTrackingPage.saving') : mode === 'create' ? t('timeTrackingPage.common.create') : t('timeTrackingPage.save')}
          </button>
        </div>
      </div>
    </div>);
}
export function TimeTrackingClientTasksPanel() {
    const { t, locale } = useI18n();
    const { showAlert, showConfirm } = useAppDialog();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [clientsLoading, setClientsLoading] = useState(true);
    const [clientsError, setClientsError] = useState<string | null>(null);
    const [clientId, setClientId] = useState<string>('');
    const [projects, setProjects] = useState<TimeManagerClientProjectRow[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [projectId, setProjectId] = useState<string>('');
    const [tasks, setTasks] = useState<TimeManagerClientTaskRow[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [tasksError, setTasksError] = useState<string | null>(null);
    const [modal, setModal] = useState<{
        mode: 'create' | 'edit';
        row: TimeManagerClientTaskRow | null;
    } | null>(null);
    const loadClients = useCallback(async () => {
        setClientsLoading(true);
        setClientsError(null);
        try {
            const rows = await listAllTimeManagerClientsMerged();
            rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setClients(rows);
            setClientId((prev) => {
                if (prev && rows.some((c) => c.id === prev))
                    return prev;
                return rows[0]?.id ?? '';
            });
        }
        catch (e) {
            setClients([]);
            setClientsError(e instanceof Error ? e.message : t('timeTrackingPage.tasks.errors.loadClientsFailed'));
        }
        finally {
            setClientsLoading(false);
        }
    }, [t]);
    useEffect(() => {
        void loadClients();
    }, [loadClients]);
    const loadProjectsForClient = useCallback(async (cid: string) => {
        if (!cid) {
            setProjects([]);
            setProjectId('');
            return;
        }
        setProjectsLoading(true);
        setProjectsError(null);
        try {
            const rows = await listAllClientProjectsForClientMerged(cid);
            rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setProjects(rows);
            setProjectId((prev) => {
                if (prev && rows.some((p) => p.id === prev))
                    return prev;
                return rows[0]?.id ?? '';
            });
        }
        catch (e) {
            setProjects([]);
            setProjectId('');
            setProjectsError(e instanceof Error ? e.message : t('timeTrackingPage.tasks.errors.loadProjectsFailed'));
        }
        finally {
            setProjectsLoading(false);
        }
    }, [t]);
    useEffect(() => {
        void loadProjectsForClient(clientId);
    }, [clientId, loadProjectsForClient]);
    const loadTasks = useCallback(async (cid: string, pid: string) => {
        if (!cid || !pid) {
            setTasks([]);
            return;
        }
        setTasksLoading(true);
        setTasksError(null);
        try {
            const rows = await listProjectTasksCached(cid, pid);
            rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setTasks(rows);
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setTasksError(t('timeTrackingPage.tasks.errors.insufficientRightsView'));
            }
            else {
                setTasksError(e instanceof Error ? e.message : t('timeTrackingPage.tasks.errors.loadTasksFailed'));
            }
            setTasks([]);
        }
        finally {
            setTasksLoading(false);
        }
    }, [t]);
    useEffect(() => {
        void loadTasks(clientId, projectId);
    }, [clientId, projectId, loadTasks]);
    const onTaskSaved = (row: TimeManagerClientTaskRow) => {
        invalidateProjectTasksCache(clientId, projectId);
        setTasks((prev) => {
            const idx = prev.findIndex((x) => x.id === row.id);
            if (idx < 0) {
                const next = [...prev, row];
                next.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
                return next;
            }
            const next = [...prev];
            next[idx] = row;
            return next;
        });
    };
    const handleDelete = async (task: TimeManagerClientTaskRow) => {
        const ok = await showConfirm({
            title: t('timeTrackingPage.tasks.deleteConfirm.title'),
            message: t('timeTrackingPage.tasks.deleteConfirm.message').replace('{name}', task.name),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.delete'),
        });
        if (!ok)
            return;
        try {
            await deleteProjectTask(clientId, projectId, task.id);
            invalidateProjectTasksCache(clientId, projectId);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.common.deleteFailed') });
        }
    };
    const selectedClient = clients.find((c) => c.id === clientId);
    const selectedProject = projects.find((p) => p.id === projectId);
    const hasProjectsForClient = projects.length > 0;
    const canCreateTask = canManage && Boolean(clientId) && Boolean(projectId);
    const rateLabel = (task: TimeManagerClientTaskRow) => {
        if (task.billing_mode === 'flat_fee') {
            const r = formatBillableRate(task.flat_fee_amount, locale);
            const cur = (task.flat_fee_currency || 'UZS').trim() || 'UZS';
            return r
                ? t('timeTrackingPage.tasks.rateLabels.withFlatFee').replace('{amount}', r).replace('{currency}', cur)
                : t('timeTrackingPage.tasks.rateLabels.flatFeeNoAmount');
        }
        const r = formatBillableRate(task.default_billable_rate, locale);
        return r
            ? t('timeTrackingPage.tasks.rateLabels.withRate').replace('{rate}', r)
            : t('timeTrackingPage.tasks.rateLabels.noRate');
    };
    return (<div className="tt-settings__content tt-tasks-page">
      <h1 className="tt-settings__page-title">{t('timeTrackingPage.tasks.title')}</h1>
      <p className="tt-settings__desc tt-tasks-page__lead">
        {t('timeTrackingPage.tasks.intro')}
      </p>

      {clientsError && (<p className="tt-settings__banner-error" role="alert">
          {clientsError}
        </p>)}

      <div className="tt-tasks-page__controls">
        <div className="tt-tasks-toolbar tt-tasks-toolbar--projects">
          <div className="tt-tasks-toolbar__main">
            <div className="tt-tasks-toolbar__row">
              <div className="tt-tasks-toolbar__client">
                <label className="tt-tasks-toolbar__label" id="tt-task-client-lbl" htmlFor="tt-task-client-select">
                  {t('timeTrackingPage.common.client')}
                </label>
                <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId="tt-task-client-select" value={clientId} items={clients} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setClientId(c.id)} placeholder={clients.length === 0 && !clientsLoading ? t('timeTrackingPage.common.noClients') : t('timeTrackingPage.common.selectClient')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.clientNotFound')} disabled={clientsLoading || clients.length === 0} portalDropdown portalZIndex={11020} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby="tt-task-client-lbl" renderOption={(c) => (<span className="tt-tm-dd__opt">
                    <span className="tt-tm-dd__opt-name">{c.name}</span>
                    {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
                  </span>)}/>
              </div>
              <div className="tt-tasks-toolbar__client">
                <label className="tt-tasks-toolbar__label" id="tt-task-project-lbl" htmlFor="tt-task-project-select">
                  {t('timeTrackingPage.common.project')}
                </label>
                <SearchableSelect<TimeManagerClientProjectRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId="tt-task-project-select" value={projectId} items={projects} getOptionValue={(p) => p.id} getOptionLabel={(p) => (p.code ? `${p.name} (${p.code})` : p.name)} getSearchText={projectSearchText} onSelect={(p) => setProjectId(p.id)} placeholder={!clientId ? t('timeTrackingPage.common.selectClientFirst') : projects.length === 0 && !projectsLoading ? t('timeTrackingPage.common.noProjects') : t('timeTrackingPage.common.selectProject')} emptyListText={t('timeTrackingPage.common.noProjects')} noMatchText={t('timeTrackingPage.common.projectNotFound')} disabled={!clientId || projectsLoading || projects.length === 0} portalDropdown portalZIndex={11020} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby="tt-task-project-lbl"/>
              </div>
              <button type="button" className="tt-settings__btn tt-settings__btn--primary tt-tasks-toolbar__cta" disabled={!canCreateTask} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => setModal({ mode: 'create', row: null })}>
                {t('timeTrackingPage.tasks.cta.newTask')}
              </button>
            </div>
            {(!clientsLoading && clients.length === 0 && !clientsError) || projectsError ? (<div className="tt-tasks-toolbar__hints">
                {!clientsLoading && clients.length === 0 && !clientsError && (<p className="tt-tasks-toolbar__hint">{t('timeTrackingPage.common.addClientsTabHint')}</p>)}
                {projectsError && (<p className="tt-tasks-toolbar__hint" role="alert">{projectsError}</p>)}
              </div>) : null}
          </div>
        </div>

        {!projectsError && !projectsLoading && clientId && !hasProjectsForClient && (<div className="tt-tasks-page__notice">
            <p className="tt-tasks-page__notice-title">{t('timeTrackingPage.tasks.empty.noProjectsForClientTitle')}</p>
            <p className="tt-tasks-page__notice-text">{t('timeTrackingPage.tasks.empty.noProjectsForClientText')}</p>
          </div>)}

        {selectedClient && selectedProject && (<p className="tt-tasks-page__scope">
            <span className="tt-tasks-page__scope-k">{t('timeTrackingPage.common.context')}</span> {selectedClient.name} · {selectedProject.name}
          </p>)}
      </div>

      {!canManage && !clientsLoading && clients.length > 0 && (<p className="tt-settings__banner-info tt-tasks-page__banner" role="status">
          {t('timeTrackingPage.common.viewOnlyTasks')}
        </p>)}

      {tasksError && (<p className="tt-settings__banner-error" role="alert">
          {tasksError}
        </p>)}

      {!tasksError && selectedClient && selectedProject && (<h2 className="tt-tasks-page__list-heading">{t('timeTrackingPage.tasks.listHeading')}</h2>)}

      {!tasksError && (<div className="tt-settings__list tt-tasks-page__list">
          {tasksLoading && (<div className="tt-settings__list-loading" role="status">
              {t('timeTrackingPage.tasks.loading')}
            </div>)}
          {!tasksLoading && clientId && projectId && tasks.length === 0 && (<div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
              {t('timeTrackingPage.tasks.empty.noTasks')}
            </div>)}
          {!tasksLoading &&
                tasks.map((taskRow) => {
                    const hasRate = !!formatBillableRate(taskRow.default_billable_rate, locale);
                    return (<div key={taskRow.id} className="tt-settings__list-row tt-task-card tt-task-card--v2" data-accent={taskAccentIndex(taskRow.id)}>
                  <div className="tt-task-card__avatar" aria-hidden>
                    {taskInitial(taskRow.name)}
                  </div>
                  <div className="tt-task-card__body">
                    <div className="tt-task-card__line">
                      <h3 className="tt-task-card__title">{taskRow.name}</h3>
                      <span className={`tt-task-card__rate${hasRate ? '' : ' tt-task-card__rate--empty'}`}>
                        {rateLabel(taskRow)}
                      </span>
                      <TaskRowBadges task={taskRow}/>
                    </div>
                  </div>
                  <div className="tt-task-card__actions">
                    <button type="button" className="tt-task-card__icon-btn" disabled={!canManage} aria-label={t('timeTrackingPage.tasks.aria.editTask')} title={!canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.tasks.aria.editTask')} onClick={() => setModal({ mode: 'edit', row: taskRow })}>
                      <IcoPen />
                    </button>
                    <button type="button" className="tt-task-card__icon-btn tt-task-card__icon-btn--danger" disabled={!canManage} aria-label={t('timeTrackingPage.tasks.aria.deleteTask')} title={!canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.tasks.aria.deleteTask')} onClick={() => void handleDelete(taskRow)}>
                      <IcoTrash />
                    </button>
                  </div>
                </div>);
                })}
        </div>)}

      {modal && clientId && projectId && (<ClientTaskModal key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'} mode={modal.mode} clientId={clientId} projectId={projectId} initial={modal.row} onClose={() => setModal(null)} onSaved={onTaskSaved}/>)}
    </div>);
}
