import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useId } from 'react';
import { SearchableSelect, useAppDialog, useAppToast } from '@shared/ui';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { listAllTimeManagerClientsMerged, listClientExpenseCategories, createClientExpenseCategory, patchClientExpenseCategory, deleteClientExpenseCategory, isForbiddenError, } from '@entities/time-tracking';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
const IcoPen = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }));
const IcoTrash = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }));
function sortCategories(a, b) {
    const oa = a.sort_order ?? 9999;
    const ob = b.sort_order ?? 9999;
    if (oa !== ob)
        return oa - ob;
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
}
function emptyCatForm() {
    return {
        name: '',
        hasUnitPrice: false,
        isArchived: false,
        sortOrder: '',
    };
}
function rowToCatForm(c) {
    return {
        name: c.name,
        hasUnitPrice: c.has_unit_price,
        isArchived: c.is_archived,
        sortOrder: c.sort_order != null ? String(c.sort_order) : '',
    };
}
function ExpenseCategoryModal({ mode, clientId, initial, onClose, onSaved }) {
    const { t } = useI18n();
    const uid = useId();
    const [form, setForm] = useState(() => (initial ? rowToCatForm(initial) : emptyCatForm()));
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError(t('timeTrackingPage.expenseCategories.errors.nameRequired'));
            return;
        }
        let sortOrder = null;
        const sortRaw = form.sortOrder.trim();
        if (sortRaw) {
            const n = parseInt(sortRaw, 10);
            if (Number.isNaN(n)) {
                setError(t('timeTrackingPage.expenseCategories.errors.sortOrderInteger'));
                return;
            }
            sortOrder = n;
        }
        setError(null);
        setSaving(true);
        try {
            if (mode === 'create') {
                const row = await createClientExpenseCategory(clientId, {
                    name,
                    hasUnitPrice: form.hasUnitPrice,
                    sortOrder,
                });
                onSaved(row);
            }
            else if (initial) {
                const row = await patchClientExpenseCategory(clientId, initial.id, {
                    name,
                    hasUnitPrice: form.hasUnitPrice,
                    isArchived: form.isArchived,
                    sortOrder,
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
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--task", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-ecat-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-ecat-title`, className: "tt-tm-modal__title", children: mode === 'create' ? t('timeTrackingPage.expenseCategories.modal.createTitle') : t('timeTrackingPage.expenseCategories.modal.editTitle') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-cname`, children: [t('timeTrackingPage.expenseCategories.labels.name'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-cname`, className: "tt-tm-input", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })) }), _jsx("p", { className: "tt-tm-hint", children: t('timeTrackingPage.expenseCategories.labels.uniqueNameHint') })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-sort`, children: t('timeTrackingPage.expenseCategories.labels.sortOrder') }), _jsx("input", { id: `${uid}-sort`, type: "number", className: "tt-tm-input", placeholder: t('timeTrackingPage.common.optional'), value: form.sortOrder, onChange: (e) => setForm((f) => ({ ...f, sortOrder: e.target.value })) })] }), _jsxs("fieldset", { className: "tt-tm-fieldset", children: [_jsx("legend", { className: "tt-tm-fieldset-legend", children: t('timeTrackingPage.common.parameters') }), _jsxs("label", { className: "tt-tm-check-row", children: [_jsx("input", { type: "checkbox", checked: form.hasUnitPrice, onChange: (e) => setForm((f) => ({ ...f, hasUnitPrice: e.target.checked })) }), _jsx("span", { children: t('timeTrackingPage.expenseCategories.labels.hasUnitPrice') })] }), mode === 'edit' && (_jsxs("label", { className: "tt-tm-check-row", children: [_jsx("input", { type: "checkbox", checked: form.isArchived, onChange: (e) => setForm((f) => ({ ...f, isArchived: e.target.checked })) }), _jsx("span", { children: t('timeTrackingPage.common.archived') })] }))] }), error && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error }))] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving, onClick: () => void handleSubmit(), children: saving ? t('timeTrackingPage.saving') : mode === 'create' ? t('timeTrackingPage.common.create') : t('timeTrackingPage.save') })] })] }) }));
}
export function TimeTrackingClientExpenseCategoriesPanel() {
    const { t } = useI18n();
    const { showAlert, showConfirm } = useAppDialog();
    const { pushToast } = useAppToast();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);
    const [clients, setClients] = useState([]);
    const [clientsLoading, setClientsLoading] = useState(true);
    const [clientsError, setClientsError] = useState(null);
    const [clientId, setClientId] = useState('');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [categories, setCategories] = useState([]);
    const [catLoading, setCatLoading] = useState(false);
    const [catError, setCatError] = useState(null);
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
    useEffect(() => {
        if (catError)
            pushToast({ message: catError, variant: 'error' });
    }, [catError, pushToast]);
    const loadCategories = useCallback(async (cid, archived) => {
        if (!cid) {
            setCategories([]);
            return;
        }
        setCatLoading(true);
        setCatError(null);
        try {
            const rows = await listClientExpenseCategories(cid, { includeArchived: archived });
            rows.sort(sortCategories);
            setCategories(rows);
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setCatError(t('timeTrackingPage.expenseCategories.errors.insufficientRightsView'));
            }
            else {
                setCatError(e instanceof Error ? e.message : t('timeTrackingPage.expenseCategories.errors.loadCategoriesFailed'));
            }
            setCategories([]);
        }
        finally {
            setCatLoading(false);
        }
    }, [t]);
    useEffect(() => {
        void loadCategories(clientId, includeArchived);
    }, [clientId, includeArchived, loadCategories]);
    const onSaved = (row) => {
        setCategories((prev) => {
            const idx = prev.findIndex((x) => x.id === row.id);
            if (idx < 0) {
                const next = [...prev, row];
                next.sort(sortCategories);
                return next;
            }
            const next = [...prev];
            next[idx] = row;
            next.sort(sortCategories);
            return next;
        });
    };
    const handleDelete = async (cat) => {
        if (!cat.deletable)
            return;
        const ok = await showConfirm({
            title: t('timeTrackingPage.expenseCategories.deleteConfirm.title'),
            message: t('timeTrackingPage.expenseCategories.deleteConfirm.message').replace('{name}', cat.name),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.delete'),
        });
        if (!ok)
            return;
        try {
            await deleteClientExpenseCategory(clientId, cat.id);
            setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.common.deleteFailed') });
        }
    };
    const selectedClient = clients.find((c) => c.id === clientId);
    return (_jsxs("div", { className: "tt-settings__content tt-tasks-page tt-ecat-page", children: [_jsx("h1", { className: "tt-settings__page-title", children: t('timeTrackingPage.expenseCategories.title') }), _jsx("p", { className: "tt-settings__desc tt-tasks-page__lead", children: t('timeTrackingPage.expenseCategories.intro') }), _jsxs("div", { className: "tt-tasks-page__controls tt-ecat-page__controls", children: [_jsx("div", { className: "tt-tasks-toolbar tt-ecat-toolbar", children: _jsxs("div", { className: "tt-ecat-toolbar__main", children: [_jsxs("div", { className: "tt-ecat-toolbar__row", children: [_jsxs("div", { className: "tt-tasks-toolbar__client tt-ecat-toolbar__client-field", children: [_jsx("label", { className: "tt-tasks-toolbar__label", id: "tt-ecat-client-lbl", htmlFor: "tt-ecat-client-select", children: t('timeTrackingPage.common.client') }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: "tt-ecat-client-select", value: clientId, items: clients, getOptionValue: (c) => c.id, getOptionLabel: (c) => c.name, getSearchText: clientRowSearchText, onSelect: (c) => setClientId(c.id), placeholder: clients.length === 0 && !clientsLoading ? t('timeTrackingPage.common.noClients') : t('timeTrackingPage.common.selectClient'), emptyListText: t('timeTrackingPage.common.noClients'), noMatchText: t('timeTrackingPage.common.clientNotFound'), disabled: clientsLoading || clients.length === 0, portalDropdown: true, portalZIndex: 11020, portalMinWidth: 300, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": "tt-ecat-client-lbl", renderOption: (c) => (_jsxs("span", { className: "tt-tm-dd__opt", children: [_jsx("span", { className: "tt-tm-dd__opt-name", children: c.name }), c.address ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.address })) : c.email ? (_jsx("span", { className: "tt-tm-dd__opt-sub", children: c.email })) : null] })) })] }), _jsxs("div", { className: "tt-ecat-toolbar__toggle-field", children: [_jsx("span", { className: "tt-tasks-toolbar__label tt-ecat-toolbar__label-spacer", "aria-hidden": "true", children: t('timeTrackingPage.common.client') }), _jsxs("label", { className: "tt-ecat-archive-toggle tt-ecat-archive-toggle--toolbar tt-ecat-archive-toggle--field", children: [_jsx("input", { type: "checkbox", checked: includeArchived, onChange: (e) => setIncludeArchived(e.target.checked) }), _jsx("span", { children: t('timeTrackingPage.expenseCategories.labels.showArchived') })] })] }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary tt-ecat-toolbar__new-btn", disabled: !canManage || !clientId, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => setModal({ mode: 'create', row: null }), children: t('timeTrackingPage.expenseCategories.cta.newCategory') })] }), !clientsLoading && clients.length === 0 && !clientsError && (_jsx("p", { className: "tt-tasks-toolbar__hint tt-ecat-toolbar__hint", children: t('timeTrackingPage.common.addClientsTabHint') }))] }) }), clientsError && (_jsx("p", { className: "tt-tasks-page__load-err", role: "alert", children: clientsError })), _jsxs("div", { className: "tt-tasks-page__notice tt-ecat-page__policy", children: [_jsx("p", { className: "tt-tasks-page__notice-title", children: t('timeTrackingPage.expenseCategories.policy.title') }), _jsx("p", { className: "tt-tasks-page__notice-text", children: t('timeTrackingPage.expenseCategories.policy.text') })] }), selectedClient && (_jsxs("p", { className: "tt-tasks-page__scope", children: [_jsx("span", { className: "tt-tasks-page__scope-k", children: t('timeTrackingPage.common.context') }), " ", selectedClient.name] }))] }), !canManage && !clientsLoading && clients.length > 0 && (_jsx("p", { className: "tt-settings__banner-info tt-tasks-page__banner", role: "status", children: t('timeTrackingPage.common.viewOnlyCategories') })), selectedClient && (_jsx("h2", { className: "tt-tasks-page__list-heading", children: t('timeTrackingPage.expenseCategories.listHeading') })), selectedClient && catError && (_jsx("p", { className: "tt-tasks-page__load-err", role: "alert", children: catError })), selectedClient && !catError && (_jsxs("div", { className: "tt-settings__list tt-tasks-page__list", children: [catLoading && (_jsx("div", { className: "tt-settings__list-loading", role: "status", children: t('timeTrackingPage.expenseCategories.loading') })), !catLoading && clientId && categories.length === 0 && (_jsx("div", { className: "tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty", children: t('timeTrackingPage.expenseCategories.empty.noCategories') })), !catLoading &&
                        categories.map((c) => (_jsx("div", { className: "tt-settings__list-row tt-task-card", children: _jsxs("div", { className: "tt-task-card__main", children: [_jsxs("div", { className: "tt-task-card__top", children: [_jsxs("h3", { className: "tt-task-card__title", children: [c.name, c.is_archived && (_jsx("span", { className: "tt-ecat-badge tt-ecat-badge--arch tt-ecat-badge--title", title: t('timeTrackingPage.common.archived'), children: t('timeTrackingPage.common.archive') }))] }), _jsxs("div", { className: "tt-task-card__actions", children: [_jsxs("button", { type: "button", className: "tt-task-card__btn", disabled: !canManage, title: !canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.expenseCategories.tooltips.editCategory'), onClick: () => setModal({ mode: 'edit', row: c }), children: [_jsx(IcoPen, {}), _jsx("span", { children: t('timeTrackingPage.common.change') })] }), _jsxs("button", { type: "button", className: "tt-task-card__btn tt-task-card__btn--danger", disabled: !canManage || !c.deletable, title: !canManage
                                                            ? t('timeTrackingPage.common.insufficientRights')
                                                            : !c.deletable
                                                                ? t('timeTrackingPage.expenseCategories.tooltips.archiveOrWaitUsage')
                                                                : t('timeTrackingPage.expenseCategories.tooltips.deleteCategory'), onClick: () => void handleDelete(c), children: [_jsx(IcoTrash, {}), _jsx("span", { children: t('timeTrackingPage.delete') })] })] })] }), _jsxs("div", { className: "tt-task-card__meta tt-ecat-card__meta", children: [_jsx("span", { className: `tt-task-pill${c.has_unit_price ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`, children: c.has_unit_price ? t('timeTrackingPage.expenseCategories.labels.withUnitPrice') : t('timeTrackingPage.expenseCategories.labels.withoutUnitPrice') }), c.sort_order != null && (_jsx("span", { className: "tt-task-pill tt-task-pill--scope", children: t('timeTrackingPage.expenseCategories.labels.sortOrderBadge').replace('{order}', String(c.sort_order)) })), _jsx("span", { className: "tt-task-pill tt-task-pill--muted", children: t('timeTrackingPage.expenseCategories.labels.usageCount').replace('{count}', String(c.usage_count)) }), !c.deletable && (_jsx("span", { className: "tt-task-pill tt-task-pill--muted", title: t('timeTrackingPage.expenseCategories.tooltips.deleteBlockedUsage'), children: t('timeTrackingPage.expenseCategories.labels.deleteUnavailable') }))] })] }) }, c.id)))] })), modal && clientId && (_jsx(ExpenseCategoryModal, { mode: modal.mode, clientId: clientId, initial: modal.row, onClose: () => setModal(null), onSaved: onSaved }, modal.mode === 'edit' && modal.row ? modal.row.id : 'create'))] }));
}
