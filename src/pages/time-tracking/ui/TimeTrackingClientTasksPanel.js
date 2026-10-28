import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useId } from 'react';
import { listAllTimeManagerClientsMerged, listAllClientProjectsForClientMerged, listProjectTasksCached, invalidateProjectTasksCache, createProjectTask, patchProjectTask, deleteProjectTask, isForbiddenError, } from '@entities/time-tracking';
import { SearchableSelect, useAppDialog } from '@shared/ui';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
function rateToInput(v) {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? String(n) : '';
}
function formatBillableRate(v, locale) {
    if (v == null || v === '')
        return '';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n.toLocaleString(localeTag(locale), { maximumFractionDigits: 2 }) : '';
}
function TaskRowBadges({ task }) {
    const { t } = useI18n();
    return (_jsxs("div", { className: "tt-task-card__badges", children: [_jsxs("span", { className: `tt-task-pill${task.billable_by_default ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`, title: task.billable_by_default ? t('timeTrackingPage.tasks.labels.defaultBillableBadge') : t('timeTrackingPage.tasks.labels.defaultNonBillableBadge'), children: [_jsx("span", { className: "tt-task-pill__dot", "aria-hidden": true }), task.billable_by_default ? t('timeTrackingPage.common.billable') : t('timeTrackingPage.common.nonBillable')] }), task.billing_mode === 'flat_fee' ? (_jsx("span", { className: "tt-task-pill tt-task-pill--billable", title: t('timeTrackingPage.tasks.labels.flatFeeBadge'), children: t('timeTrackingPage.tasks.labels.flatFeeBadge') })) : null] }));
}
function taskInitial(name) {
    const trimmed = name.trim();
    if (!trimmed)
        return '?';
    return trimmed.charAt(0).toUpperCase();
}
function taskAccentIndex(id) {
    let h = 0;
    for (let i = 0; i < id.length; i += 1)
        h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h % 6;
}
const IcoPen = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }));
const IcoTrash = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }));
function emptyTaskForm() {
    return {
        name: '',
        defaultBillableRate: '',
        billableByDefault: true,
        billingMode: 'hourly',
        flatFeeAmount: '',
        flatFeeCurrency: 'UZS',
    };
}
function rowToTaskForm(t) {
    return {
        name: t.name,
        defaultBillableRate: rateToInput(t.default_billable_rate),
        billableByDefault: t.billable_by_default,
        billingMode: t.billing_mode === 'flat_fee' ? 'flat_fee' : 'hourly',
        flatFeeAmount: rateToInput(t.flat_fee_amount),
        flatFeeCurrency: (t.flat_fee_currency || 'UZS').trim() || 'UZS',
    };
}
function projectSearchText(p) {
    return [p.name, p.code ?? '', p.id].filter(Boolean).join(' ').trim();
}
function ClientTaskModal({ mode, clientId, projectId, initial, onClose, onSaved }) {
    const { t } = useI18n();
    const uid = useId();
    const [form, setForm] = useState(() => (initial ? rowToTaskForm(initial) : emptyTaskForm()));
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError(t('timeTrackingPage.tasks.errors.nameRequired'));
            return;
        }
        const rateRaw = form.defaultBillableRate.trim();
        let defaultBillableRate = null;
        if (rateRaw) {
            const n = parseFloat(rateRaw.replace(',', '.'));
            if (!Number.isFinite(n) || n < 0) {
                setError(t('timeTrackingPage.tasks.errors.rateNonNegative'));
                return;
            }
            defaultBillableRate = n;
        }
        let flatFeeAmount = null;
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
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--task", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-task-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-task-title`, className: "tt-tm-modal__title", children: mode === 'create' ? t('timeTrackingPage.tasks.modal.createTitle') : t('timeTrackingPage.tasks.modal.editTitle') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-tname`, children: [t('timeTrackingPage.tasks.labels.taskName'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-tname`, className: "tt-tm-input", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })) })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-rate`, children: t('timeTrackingPage.tasks.labels.defaultRate') }), _jsx("input", { id: `${uid}-rate`, type: "text", inputMode: "decimal", className: "tt-tm-input", placeholder: t('timeTrackingPage.tasks.modal.ratePlaceholder'), value: form.defaultBillableRate, onChange: (e) => setForm((f) => ({ ...f, defaultBillableRate: e.target.value })), disabled: form.billingMode === 'flat_fee' }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.tasks.modal.rateHint') })] }), _jsxs("fieldset", { className: "tt-tm-fieldset", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.common.parameters') }), _jsxs("label", { className: "tt-tm-check-row", children: [_jsx("input", { type: "checkbox", checked: form.billableByDefault, onChange: (e) => setForm((f) => ({ ...f, billableByDefault: e.target.checked })) }), _jsx("span", { children: t('timeTrackingPage.tasks.labels.defaultBillableTask') })] }), _jsxs("label", { className: "tt-tm-check-row", children: [_jsx("input", { type: "checkbox", checked: form.billingMode === 'flat_fee', onChange: (e) => setForm((f) => ({
                                                ...f,
                                                billingMode: e.target.checked ? 'flat_fee' : 'hourly',
                                                flatFeeAmount: e.target.checked && !f.flatFeeAmount ? '230000' : f.flatFeeAmount,
                                                flatFeeCurrency: e.target.checked ? (f.flatFeeCurrency || 'UZS') : f.flatFeeCurrency,
                                            })) }), _jsx("span", { children: t('timeTrackingPage.tasks.labels.flatFeeTask') })] })] }), form.billingMode === 'flat_fee' ? (_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-flat`, children: [t('timeTrackingPage.tasks.labels.flatFeeAmount'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsxs("div", { className: "tt-tm-field-row", style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("input", { id: `${uid}-flat`, type: "text", inputMode: "decimal", className: "tt-tm-input", placeholder: t('timeTrackingPage.tasks.modal.flatFeePlaceholder'), value: form.flatFeeAmount, onChange: (e) => setForm((f) => ({ ...f, flatFeeAmount: e.target.value })) }), _jsx("input", { className: "tt-tm-input", style: { maxWidth: '5.5rem' }, value: form.flatFeeCurrency, onChange: (e) => setForm((f) => ({ ...f, flatFeeCurrency: e.target.value.toUpperCase() })), "aria-label": t('timeTrackingPage.tasks.labels.flatFeeCurrency') })] }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.tasks.modal.flatFeeHint') })] })) : null, error && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error }))] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving, onClick: () => void handleSubmit(), children: saving ? t('timeTrackingPage.saving') : mode === 'create' ? t('timeTrackingPage.common.create') : t('timeTrackingPage.save') })] })] }) }));
}
export function TimeTrackingClientTasksPanel() {
    const { t, locale } = useI18n();
    const { showAlert, showConfirm } = useAppDialog();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);
    const [clients, setClients] = useState([]);
    const [clientsLoading, setClientsLoading] = useState(true);
    const [clientsError, setClientsError] = useState(null);
    const [clientId, setClientId] = useState('');
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState(null);
    const [projectId, setProjectId] = useState('');
    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [tasksError, setTasksError] = useState(null);
    const [modal, setModal] = useState(null);
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
    const loadProjectsForClient = useCallback(async (cid) => {
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
    const loadTasks = useCallback(async (cid, pid) => {
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
    const onTaskSaved = (row) => {
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
    const handleDelete = async (task) => {
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
    const rateLabel = (task) => {
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
    return (_jsxs("div", { className: "tt-settings__content tt-tasks-page", children: [_jsx("h1", { className: "tt-settings__page-title", children: t('timeTrackingPage.tasks.title') }), _jsx("p", { className: "tt-settings__desc tt-tasks-page__lead", children: t('timeTrackingPage.tasks.intro') }), clientsError && (_jsx("p", { className: "tt-settings__banner-error", role: "alert", children: clientsError })), _jsxs("div", { className: "tt-tasks-page__controls", children: [_jsx("div", { className: "tt-tasks-toolbar tt-tasks-toolbar--projects", children: _jsxs("div", { className: "tt-tasks-toolbar__main", children: [_jsxs("div", { className: "tt-tasks-toolbar__row", children: [_jsxs("div", { className: "tt-tasks-toolbar__client", children: [_jsx("label", { className: "tt-tasks-toolbar__label", id: "tt-task-client-lbl", htmlFor: "tt-task-client-select", children: t('timeTrackingPage.common.client') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: "tt-task-client-select", value: clientId, items: clients, getOptionValue: (c) => c.id, getOptionLabel: (c) => c.name, getSearchText: clientRowSearchText, onSelect: (c) => setClientId(c.id), placeholder: clients.length === 0 && !clientsLoading ? t('timeTrackingPage.common.noClients') : t('timeTrackingPage.common.selectClient'), emptyListText: t('timeTrackingPage.common.noClients'), noMatchText: t('timeTrackingPage.common.clientNotFound'), disabled: clientsLoading || clients.length === 0, portalDropdown: true, portalZIndex: 11020, portalMinWidth: 300, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": "tt-task-client-lbl", renderOption: (c) => (_jsxs("span", { className: "tt-tm-dd__opt", children: [_jsx("span", { className: "tt-tm-dd__opt-name", children: c.name }), c.address ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.address })) : c.email ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.email })) : null] })) })] }), _jsxs("div", { className: "tt-tasks-toolbar__client", children: [_jsx("label", { className: "tt-tasks-toolbar__label", id: "tt-task-project-lbl", htmlFor: "tt-task-project-select", children: t('timeTrackingPage.common.project') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: "tt-task-project-select", value: projectId, items: projects, getOptionValue: (p) => p.id, getOptionLabel: (p) => (p.code ? `${p.name} (${p.code})` : p.name), getSearchText: projectSearchText, onSelect: (p) => setProjectId(p.id), placeholder: !clientId ? t('timeTrackingPage.common.selectClientFirst') : projects.length === 0 && !projectsLoading ? t('timeTrackingPage.common.noProjects') : t('timeTrackingPage.common.selectProject'), emptyListText: t('timeTrackingPage.common.noProjects'), noMatchText: t('timeTrackingPage.common.projectNotFound'), disabled: !clientId || projectsLoading || projects.length === 0, portalDropdown: true, portalZIndex: 11020, portalMinWidth: 300, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": "tt-task-project-lbl" })] }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary tt-tasks-toolbar__cta", disabled: !canCreateTask, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => setModal({ mode: 'create', row: null }), children: t('timeTrackingPage.tasks.cta.newTask') })] }), (!clientsLoading && clients.length === 0 && !clientsError) || projectsError ? (_jsxs("div", { className: "tt-tasks-toolbar__hints", children: [!clientsLoading && clients.length === 0 && !clientsError && (_jsx("p", { className: "tt-tasks-toolbar__hint", children: t('timeTrackingPage.common.addClientsTabHint') })), projectsError && (_jsx("p", { className: "tt-tasks-toolbar__hint", role: "alert", children: projectsError }))] })) : null] }) }), !projectsError && !projectsLoading && clientId && !hasProjectsForClient && (_jsxs("div", { className: "tt-tasks-page__notice", children: [_jsx("p", { className: "tt-tasks-page__notice-title", children: t('timeTrackingPage.tasks.empty.noProjectsForClientTitle') }), _jsx("p", { className: "tt-tasks-page__notice-text", children: t('timeTrackingPage.tasks.empty.noProjectsForClientText') })] })), selectedClient && selectedProject && (_jsxs("p", { className: "tt-tasks-page__scope", children: [_jsx("span", { className: "tt-tasks-page__scope-k", children: t('timeTrackingPage.common.context') }), " ", selectedClient.name, " \u00B7 ", selectedProject.name] }))] }), !canManage && !clientsLoading && clients.length > 0 && (_jsx("p", { className: "tt-settings__banner-info tt-tasks-page__banner", role: "status", children: t('timeTrackingPage.common.viewOnlyTasks') })), tasksError && (_jsx("p", { className: "tt-settings__banner-error", role: "alert", children: tasksError })), !tasksError && selectedClient && selectedProject && (_jsx("h2", { className: "tt-tasks-page__list-heading", children: t('timeTrackingPage.tasks.listHeading') })), !tasksError && (_jsxs("div", { className: "tt-settings__list tt-tasks-page__list", children: [tasksLoading && (_jsx("div", { className: "tt-settings__list-loading", role: "status", children: t('timeTrackingPage.tasks.loading') })), !tasksLoading && clientId && projectId && tasks.length === 0 && (_jsx("div", { className: "tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty", children: t('timeTrackingPage.tasks.empty.noTasks') })), !tasksLoading &&
                        tasks.map((taskRow) => {
                            const hasRate = !!formatBillableRate(taskRow.default_billable_rate, locale);
                            return (_jsxs("div", { className: "tt-settings__list-row tt-task-card tt-task-card--v2", "data-accent": taskAccentIndex(taskRow.id), children: [_jsx("div", { className: "tt-task-card__avatar", "aria-hidden": true, children: taskInitial(taskRow.name) }), _jsx("div", { className: "tt-task-card__body", children: _jsxs("div", { className: "tt-task-card__line", children: [_jsx("h3", { className: "tt-task-card__title", children: taskRow.name }), _jsx("span", { className: `tt-task-card__rate${hasRate ? '' : ' tt-task-card__rate--empty'}`, children: rateLabel(taskRow) }), _jsx(TaskRowBadges, { task: taskRow })] }) }), _jsxs("div", { className: "tt-task-card__actions", children: [_jsx("button", { type: "button", className: "tt-task-card__icon-btn", disabled: !canManage, "aria-label": t('timeTrackingPage.tasks.aria.editTask'), title: !canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.tasks.aria.editTask'), onClick: () => setModal({ mode: 'edit', row: taskRow }), children: _jsx(IcoPen, {}) }), _jsx("button", { type: "button", className: "tt-task-card__icon-btn tt-task-card__icon-btn--danger", disabled: !canManage, "aria-label": t('timeTrackingPage.tasks.aria.deleteTask'), title: !canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.tasks.aria.deleteTask'), onClick: () => void handleDelete(taskRow), children: _jsx(IcoTrash, {}) })] })] }, taskRow.id));
                        })] })), modal && clientId && projectId && (_jsx(ClientTaskModal, { mode: modal.mode, clientId: clientId, projectId: projectId, initial: modal.row, onClose: () => setModal(null), onSaved: onTaskSaved }, modal.mode === 'edit' && modal.row ? modal.row.id : 'create'))] }));
}
