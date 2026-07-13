import { useState, useEffect, useCallback, useId } from 'react';
import { SearchableSelect, useAppDialog, useAppToast } from '@shared/ui';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { listAllTimeManagerClientsMerged, listClientExpenseCategories, createClientExpenseCategory, patchClientExpenseCategory, deleteClientExpenseCategory, isForbiddenError, type TimeManagerClientRow, type TimeManagerClientExpenseCategoryRow, } from '@entities/time-tracking';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
const IcoPen = () => (<svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>);
const IcoTrash = () => (<svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>);
function sortCategories(a: TimeManagerClientExpenseCategoryRow, b: TimeManagerClientExpenseCategoryRow): number {
    const oa = a.sort_order ?? 9999;
    const ob = b.sort_order ?? 9999;
    if (oa !== ob)
        return oa - ob;
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
}
type CatFormState = {
    name: string;
    hasUnitPrice: boolean;
    isArchived: boolean;
    sortOrder: string;
};
function emptyCatForm(): CatFormState {
    return {
        name: '',
        hasUnitPrice: false,
        isArchived: false,
        sortOrder: '',
    };
}
function rowToCatForm(c: TimeManagerClientExpenseCategoryRow): CatFormState {
    return {
        name: c.name,
        hasUnitPrice: c.has_unit_price,
        isArchived: c.is_archived,
        sortOrder: c.sort_order != null ? String(c.sort_order) : '',
    };
}
type ExpenseCatModalProps = {
    mode: 'create' | 'edit';
    clientId: string;
    initial: TimeManagerClientExpenseCategoryRow | null;
    onClose: () => void;
    onSaved: (row: TimeManagerClientExpenseCategoryRow) => void;
};
function ExpenseCategoryModal({ mode, clientId, initial, onClose, onSaved }: ExpenseCatModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [form, setForm] = useState<CatFormState>(() => (initial ? rowToCatForm(initial) : emptyCatForm()));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError(t('timeTrackingPage.expenseCategories.errors.nameRequired'));
            return;
        }
        let sortOrder: number | null = null;
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
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--task" role="dialog" aria-modal="true" aria-labelledby={`${uid}-ecat-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-ecat-title`} className="tt-tm-modal__title">
            {mode === 'create' ? t('timeTrackingPage.expenseCategories.modal.createTitle') : t('timeTrackingPage.expenseCategories.modal.editTitle')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
              {t('timeTrackingPage.expenseCategories.labels.name')} <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-cname`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}/>
            <p className="tt-tm-hint">{t('timeTrackingPage.expenseCategories.labels.uniqueNameHint')}</p>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-sort`}>
              {t('timeTrackingPage.expenseCategories.labels.sortOrder')}
            </label>
            <input id={`${uid}-sort`} type="number" className="tt-tm-input" placeholder={t('timeTrackingPage.common.optional')} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}/>
          </div>
          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">{t('timeTrackingPage.common.parameters')}</legend>
            <label className="tt-tm-check-row">
              <input type="checkbox" checked={form.hasUnitPrice} onChange={(e) => setForm((f) => ({ ...f, hasUnitPrice: e.target.checked }))}/>
              <span>{t('timeTrackingPage.expenseCategories.labels.hasUnitPrice')}</span>
            </label>
            {mode === 'edit' && (<label className="tt-tm-check-row">
                <input type="checkbox" checked={form.isArchived} onChange={(e) => setForm((f) => ({ ...f, isArchived: e.target.checked }))}/>
                <span>{t('timeTrackingPage.common.archived')}</span>
              </label>)}
          </fieldset>
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
export function TimeTrackingClientExpenseCategoriesPanel() {
    const { t } = useI18n();
    const { showAlert, showConfirm } = useAppDialog();
    const { pushToast } = useAppToast();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [clientsLoading, setClientsLoading] = useState(true);
    const [clientsError, setClientsError] = useState<string | null>(null);
    const [clientId, setClientId] = useState<string>('');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [categories, setCategories] = useState<TimeManagerClientExpenseCategoryRow[]>([]);
    const [catLoading, setCatLoading] = useState(false);
    const [catError, setCatError] = useState<string | null>(null);
    const [modal, setModal] = useState<{
        mode: 'create' | 'edit';
        row: TimeManagerClientExpenseCategoryRow | null;
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
    useEffect(() => {
        if (catError)
            pushToast({ message: catError, variant: 'error' });
    }, [catError, pushToast]);
    const loadCategories = useCallback(async (cid: string, archived: boolean) => {
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
    const onSaved = (row: TimeManagerClientExpenseCategoryRow) => {
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
    const handleDelete = async (cat: TimeManagerClientExpenseCategoryRow) => {
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
    return (<div className="tt-settings__content tt-tasks-page tt-ecat-page">
      <h1 className="tt-settings__page-title">{t('timeTrackingPage.expenseCategories.title')}</h1>
      <p className="tt-settings__desc tt-tasks-page__lead">
        {t('timeTrackingPage.expenseCategories.intro')}
      </p>

      <div className="tt-tasks-page__controls tt-ecat-page__controls">
        <div className="tt-tasks-toolbar tt-ecat-toolbar">
          <div className="tt-ecat-toolbar__main">
            <div className="tt-ecat-toolbar__row">
              <div className="tt-tasks-toolbar__client tt-ecat-toolbar__client-field">
                <label className="tt-tasks-toolbar__label" id="tt-ecat-client-lbl" htmlFor="tt-ecat-client-select">
                  {t('timeTrackingPage.common.client')}
                </label>
                <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId="tt-ecat-client-select" value={clientId} items={clients} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setClientId(c.id)} placeholder={clients.length === 0 && !clientsLoading ? t('timeTrackingPage.common.noClients') : t('timeTrackingPage.common.selectClient')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.clientNotFound')} disabled={clientsLoading || clients.length === 0} portalDropdown portalZIndex={11020} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby="tt-ecat-client-lbl" renderOption={(c) => (<span className="tt-tm-dd__opt">
                      <span className="tt-tm-dd__opt-name">{c.name}</span>
                      {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
                    </span>)}/>
              </div>
              <div className="tt-ecat-toolbar__toggle-field">
                <span className="tt-tasks-toolbar__label tt-ecat-toolbar__label-spacer" aria-hidden="true">
                  {t('timeTrackingPage.common.client')}
                </span>
                <label className="tt-ecat-archive-toggle tt-ecat-archive-toggle--toolbar tt-ecat-archive-toggle--field">
                  <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)}/>
                  <span>{t('timeTrackingPage.expenseCategories.labels.showArchived')}</span>
                </label>
              </div>
              <button type="button" className="tt-settings__btn tt-settings__btn--primary tt-ecat-toolbar__new-btn" disabled={!canManage || !clientId} title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined} onClick={() => setModal({ mode: 'create', row: null })}>
                {t('timeTrackingPage.expenseCategories.cta.newCategory')}
              </button>
            </div>
            {!clientsLoading && clients.length === 0 && !clientsError && (<p className="tt-tasks-toolbar__hint tt-ecat-toolbar__hint">{t('timeTrackingPage.common.addClientsTabHint')}</p>)}
            </div>
        </div>

        {clientsError && (<p className="tt-tasks-page__load-err" role="alert">
            {clientsError}
          </p>)}

        <div className="tt-tasks-page__notice tt-ecat-page__policy">
          <p className="tt-tasks-page__notice-title">{t('timeTrackingPage.expenseCategories.policy.title')}</p>
          <p className="tt-tasks-page__notice-text">{t('timeTrackingPage.expenseCategories.policy.text')}</p>
        </div>

        {selectedClient && (<p className="tt-tasks-page__scope">
            <span className="tt-tasks-page__scope-k">{t('timeTrackingPage.common.context')}</span> {selectedClient.name}
          </p>)}
      </div>

      {!canManage && !clientsLoading && clients.length > 0 && (<p className="tt-settings__banner-info tt-tasks-page__banner" role="status">
          {t('timeTrackingPage.common.viewOnlyCategories')}
        </p>)}

      {selectedClient && (<h2 className="tt-tasks-page__list-heading">{t('timeTrackingPage.expenseCategories.listHeading')}</h2>)}
      {selectedClient && catError && (<p className="tt-tasks-page__load-err" role="alert">
          {catError}
        </p>)}

      {selectedClient && !catError && (<div className="tt-settings__list tt-tasks-page__list">
          {catLoading && (<div className="tt-settings__list-loading" role="status">
              {t('timeTrackingPage.expenseCategories.loading')}
            </div>)}
          {!catLoading && clientId && categories.length === 0 && (<div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
              {t('timeTrackingPage.expenseCategories.empty.noCategories')}
            </div>)}
          {!catLoading &&
                categories.map((c) => (<div key={c.id} className="tt-settings__list-row tt-task-card">
                <div className="tt-task-card__main">
                  <div className="tt-task-card__top">
                    <h3 className="tt-task-card__title">
                      {c.name}
                      {c.is_archived && (<span className="tt-ecat-badge tt-ecat-badge--arch tt-ecat-badge--title" title={t('timeTrackingPage.common.archived')}>
                          {t('timeTrackingPage.common.archive')}
                        </span>)}
                    </h3>
                    <div className="tt-task-card__actions">
                      <button type="button" className="tt-task-card__btn" disabled={!canManage} title={!canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.expenseCategories.tooltips.editCategory')} onClick={() => setModal({ mode: 'edit', row: c })}>
                        <IcoPen />
                        <span>{t('timeTrackingPage.common.change')}</span>
                      </button>
                      <button type="button" className="tt-task-card__btn tt-task-card__btn--danger" disabled={!canManage || !c.deletable} title={!canManage
                        ? t('timeTrackingPage.common.insufficientRights')
                        : !c.deletable
                            ? t('timeTrackingPage.expenseCategories.tooltips.archiveOrWaitUsage')
                            : t('timeTrackingPage.expenseCategories.tooltips.deleteCategory')} onClick={() => void handleDelete(c)}>
                        <IcoTrash />
                        <span>{t('timeTrackingPage.delete')}</span>
                      </button>
                    </div>
                  </div>
                  <div className="tt-task-card__meta tt-ecat-card__meta">
                    <span className={`tt-task-pill${c.has_unit_price ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`}>
                      {c.has_unit_price ? t('timeTrackingPage.expenseCategories.labels.withUnitPrice') : t('timeTrackingPage.expenseCategories.labels.withoutUnitPrice')}
                    </span>
                    {c.sort_order != null && (<span className="tt-task-pill tt-task-pill--scope">{t('timeTrackingPage.expenseCategories.labels.sortOrderBadge').replace('{order}', String(c.sort_order))}</span>)}
                    <span className="tt-task-pill tt-task-pill--muted">{t('timeTrackingPage.expenseCategories.labels.usageCount').replace('{count}', String(c.usage_count))}</span>
                    {!c.deletable && (<span className="tt-task-pill tt-task-pill--muted" title={t('timeTrackingPage.expenseCategories.tooltips.deleteBlockedUsage')}>
                        {t('timeTrackingPage.expenseCategories.labels.deleteUnavailable')}
                      </span>)}
                  </div>
                </div>
              </div>))}
        </div>)}

      {modal && clientId && (<ExpenseCategoryModal key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'} mode={modal.mode} clientId={clientId} initial={modal.row} onClose={() => setModal(null)} onSaved={onSaved}/>)}
    </div>);
}
