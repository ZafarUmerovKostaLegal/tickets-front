import { useState, useEffect, useCallback, useId } from 'react';
import { listAllTimeManagerClientsMerged, listAllClientProjectsForClientMerged, listProjectTasks, createProjectTask, patchProjectTask, deleteProjectTask, isForbiddenError, type TimeManagerClientRow, type TimeManagerClientProjectRow, type TimeManagerClientTaskRow, } from '@entities/time-tracking';
import { SearchableSelect, useAppDialog } from '@shared/ui';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeManagerClients } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
function rateToInput(v: string | number | null | undefined): string {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? String(n) : '';
}
function formatBillableRate(v: string | number | null | undefined): string {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '';
}
function TaskRowBadges({ t }: {
    t: TimeManagerClientTaskRow;
}) {
    return (<div className="tt-task-card__badges">
      <span className={`tt-task-pill${t.billable_by_default ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`} title={t.billable_by_default ? 'По умолчанию оплачиваемая' : 'По умолчанию не оплачиваемая'}>
        <span className="tt-task-pill__dot" aria-hidden/>
        {t.billable_by_default ? 'Оплачиваемая' : 'Не оплачиваемая'}
      </span>
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
};
function emptyTaskForm(): TaskFormState {
    return {
        name: '',
        defaultBillableRate: '',
        billableByDefault: true,
    };
}
function rowToTaskForm(t: TimeManagerClientTaskRow): TaskFormState {
    return {
        name: t.name,
        defaultBillableRate: rateToInput(t.default_billable_rate),
        billableByDefault: t.billable_by_default,
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
    const uid = useId();
    const [form, setForm] = useState<TaskFormState>(() => (initial ? rowToTaskForm(initial) : emptyTaskForm()));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError('Укажите название задачи');
            return;
        }
        const rateRaw = form.defaultBillableRate.trim();
        let defaultBillableRate: number | null = null;
        if (rateRaw) {
            const n = parseFloat(rateRaw.replace(',', '.'));
            if (!Number.isFinite(n) || n < 0) {
                setError('Ставка должна быть неотрицательным числом');
                return;
            }
            defaultBillableRate = n;
        }
        setError(null);
        setSaving(true);
        try {
            if (mode === 'create') {
                const row = await createProjectTask(clientId, projectId, {
                    name,
                    defaultBillableRate,
                    billableByDefault: form.billableByDefault,
                });
                onSaved(row);
            }
            else if (initial) {
                const row = await patchProjectTask(clientId, projectId, initial.id, {
                    name,
                    defaultBillableRate,
                    billableByDefault: form.billableByDefault,
                });
                onSaved(row);
            }
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--task" role="dialog" aria-modal="true" aria-labelledby={`${uid}-task-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-task-title`} className="tt-tm-modal__title">
            {mode === 'create' ? 'Новая задача' : 'Редактировать задачу'}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-tname`}>
              Название задачи <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-tname`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-rate`}>
              Ставка по умолчанию (оплачиваемая), за час
            </label>
            <input id={`${uid}-rate`} type="text" inputMode="decimal" className="tt-tm-input" placeholder="напр. 150" value={form.defaultBillableRate} onChange={(e) => setForm((f) => ({ ...f, defaultBillableRate: e.target.value }))}/>
            <p className="tt-tm-hint">Пусто — без значения по умолчанию в справочнике.</p>
          </div>
          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">Параметры</legend>
            <label className="tt-tm-check-row">
              <input type="checkbox" checked={form.billableByDefault} onChange={(e) => setForm((f) => ({ ...f, billableByDefault: e.target.checked }))}/>
              <span>По умолчанию оплачиваемая задача</span>
            </label>
          </fieldset>
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>);
}
export function TimeTrackingClientTasksPanel() {
    const { showAlert, showConfirm } = useAppDialog();
    const { user } = useCurrentUser();
    const canManage = canManageTimeManagerClients(user?.role);
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
            setClientsError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
        }
        finally {
            setClientsLoading(false);
        }
    }, []);
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
            setProjectsError(e instanceof Error ? e.message : 'Не удалось загрузить проекты');
        }
        finally {
            setProjectsLoading(false);
        }
    }, []);
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
            const rows = await listProjectTasks(cid, pid);
            rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
            setTasks(rows);
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setTasksError('Недостаточно прав для просмотра задач.');
            }
            else {
                setTasksError(e instanceof Error ? e.message : 'Не удалось загрузить задачи');
            }
            setTasks([]);
        }
        finally {
            setTasksLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadTasks(clientId, projectId);
    }, [clientId, projectId, loadTasks]);
    const onTaskSaved = (row: TimeManagerClientTaskRow) => {
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
            title: 'Удалить задачу?',
            message: `Удалить задачу «${task.name}»?`,
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!ok)
            return;
        try {
            await deleteProjectTask(clientId, projectId, task.id);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось удалить' });
        }
    };
    const selectedClient = clients.find((c) => c.id === clientId);
    const selectedProject = projects.find((p) => p.id === projectId);
    const hasProjectsForClient = projects.length > 0;
    const canCreateTask = canManage && Boolean(clientId) && Boolean(projectId);
    const rateLabel = (t: TimeManagerClientTaskRow) => {
        const r = formatBillableRate(t.default_billable_rate);
        return r ? `Ставка по умолчанию: ${r} / ч` : 'Ставка по умолчанию не задана';
    };
    return (<div className="tt-settings__content tt-tasks-page">
      <h1 className="tt-settings__page-title">Задачи по проектам</h1>
      <p className="tt-settings__desc tt-tasks-page__lead">
        Справочник задач для выбранного проекта: ставка по умолчанию и признак оплачиваемости задаются при создании и редактировании.
      </p>

      {clientsError && (<p className="tt-settings__banner-error" role="alert">
          {clientsError}
        </p>)}

      <div className="tt-tasks-page__controls">
        <div className="tt-tasks-toolbar">
          <div className="tt-tasks-toolbar__client">
          <label className="tt-tasks-toolbar__label" id="tt-task-client-lbl" htmlFor="tt-task-client-select">
            Клиент
          </label>
          <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId="tt-task-client-select" value={clientId} items={clients} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setClientId(c.id)} placeholder={clients.length === 0 && !clientsLoading ? 'Нет клиентов' : 'Найдите или выберите клиента…'} emptyListText="Нет клиентов" noMatchText="Клиент не найден" disabled={clientsLoading || clients.length === 0} portalDropdown portalZIndex={11020} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby="tt-task-client-lbl" renderOption={(c) => (<span className="tt-tm-dd__opt">
                <span className="tt-tm-dd__opt-name">{c.name}</span>
                {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
              </span>)}/>
            {!clientsLoading && clients.length === 0 && !clientsError && (<p className="tt-tasks-toolbar__hint">Сначала добавьте клиента на вкладке «Клиенты».</p>)}
          </div>
          <div className="tt-tasks-toolbar__client">
            <label className="tt-tasks-toolbar__label" id="tt-task-project-lbl" htmlFor="tt-task-project-select">
              Проект
            </label>
            <SearchableSelect<TimeManagerClientProjectRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId="tt-task-project-select" value={projectId} items={projects} getOptionValue={(p) => p.id} getOptionLabel={(p) => (p.code ? `${p.name} (${p.code})` : p.name)} getSearchText={projectSearchText} onSelect={(p) => setProjectId(p.id)} placeholder={!clientId ? 'Сначала выберите клиента' : projects.length === 0 && !projectsLoading ? 'Нет проектов' : 'Выберите проект…'} emptyListText="Нет проектов" noMatchText="Проект не найден" disabled={!clientId || projectsLoading || projects.length === 0} portalDropdown portalZIndex={11020} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby="tt-task-project-lbl"/>
            {projectsError && (<p className="tt-tasks-toolbar__hint" role="alert">{projectsError}</p>)}
          </div>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary tt-tasks-toolbar__cta" disabled={!canCreateTask} title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined} onClick={() => setModal({ mode: 'create', row: null })}>
            + Новая задача
          </button>
        </div>

        {!projectsError && !projectsLoading && clientId && !hasProjectsForClient && (<div className="tt-tasks-page__notice">
            <p className="tt-tasks-page__notice-title">У клиента пока нет проектов</p>
            <p className="tt-tasks-page__notice-text">Создайте проект в разделе «Проекты», после этого появится справочник задач для выбранного проекта.</p>
          </div>)}

        {selectedClient && selectedProject && (<p className="tt-tasks-page__scope">
            <span className="tt-tasks-page__scope-k">Контекст:</span> {selectedClient.name} · {selectedProject.name}
          </p>)}
      </div>

      {!canManage && !clientsLoading && clients.length > 0 && (<p className="tt-settings__banner-info tt-tasks-page__banner" role="status">
          Режим просмотра: создавать и удалять задачи могут главный администратор, администратор и партнёр.
        </p>)}

      {tasksError && (<p className="tt-settings__banner-error" role="alert">
          {tasksError}
        </p>)}

      {!tasksError && selectedClient && selectedProject && (<h2 className="tt-tasks-page__list-heading">Задачи проекта</h2>)}

      {!tasksError && (<div className="tt-settings__list tt-tasks-page__list">
          {tasksLoading && (<div className="tt-settings__list-loading" role="status">
              Загрузка задач…
            </div>)}
          {!tasksLoading && clientId && projectId && tasks.length === 0 && (<div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
              Для этого проекта пока нет задач. Нажмите «Новая задача».
            </div>)}
          {!tasksLoading &&
                tasks.map((t) => {
                    const hasRate = !!formatBillableRate(t.default_billable_rate);
                    return (<div key={t.id} className="tt-settings__list-row tt-task-card tt-task-card--v2" data-accent={taskAccentIndex(t.id)}>
                  <div className="tt-task-card__avatar" aria-hidden>
                    {taskInitial(t.name)}
                  </div>
                  <div className="tt-task-card__body">
                    <div className="tt-task-card__line">
                      <h3 className="tt-task-card__title">{t.name}</h3>
                      <span className={`tt-task-card__rate${hasRate ? '' : ' tt-task-card__rate--empty'}`}>
                        {rateLabel(t)}
                      </span>
                      <TaskRowBadges t={t}/>
                    </div>
                  </div>
                  <div className="tt-task-card__actions">
                    <button type="button" className="tt-task-card__icon-btn" disabled={!canManage} aria-label="Редактировать задачу" title={!canManage ? 'Недостаточно прав' : 'Редактировать задачу'} onClick={() => setModal({ mode: 'edit', row: t })}>
                      <IcoPen />
                    </button>
                    <button type="button" className="tt-task-card__icon-btn tt-task-card__icon-btn--danger" disabled={!canManage} aria-label="Удалить задачу" title={!canManage ? 'Недостаточно прав' : 'Удалить задачу'} onClick={() => void handleDelete(t)}>
                      <IcoTrash />
                    </button>
                  </div>
                </div>);
                })}
        </div>)}

      {modal && clientId && projectId && (<ClientTaskModal key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'} mode={modal.mode} clientId={clientId} projectId={projectId} initial={modal.row} onClose={() => setModal(null)} onSaved={onTaskSaved}/>)}
    </div>);
}
