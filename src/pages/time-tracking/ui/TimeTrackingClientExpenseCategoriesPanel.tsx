import { useState, useEffect, useCallback, useId } from 'react';
import { SearchableSelect } from '@shared/ui';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { listAllTimeManagerClientsMerged, listClientExpenseCategories, createClientExpenseCategory, patchClientExpenseCategory, deleteClientExpenseCategory, isForbiddenError, type TimeManagerClientRow, type TimeManagerClientExpenseCategoryRow, } from '@entities/time-tracking';
import { useCurrentUser } from '@shared/hooks';
import { canManageTimeManagerClients } from '@entities/time-tracking/model/timeManagerClientsAccess';
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
    const uid = useId();
    const [form, setForm] = useState<CatFormState>(() => (initial ? rowToCatForm(initial) : emptyCatForm()));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError('Укажите название категории');
            return;
        }
        let sortOrder: number | null = null;
        const sortRaw = form.sortOrder.trim();
        if (sortRaw) {
            const n = parseInt(sortRaw, 10);
            if (Number.isNaN(n)) {
                setError('Порядок сортировки — целое число');
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
            setError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
      <div className="tt-tm-modal tt-tm-modal--task" role="dialog" aria-modal="true" aria-labelledby={`${uid}-ecat-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-ecat-title`} className="tt-tm-modal__title">
            {mode === 'create' ? 'Новая категория расходов' : 'Редактировать категорию'}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
              Название <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-cname`} className="tt-tm-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}/>
            <p className="tt-tm-hint">Имя уникально среди активных категорий этого клиента.</p>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-sort`}>
              Порядок сортировки
            </label>
            <input id={`${uid}-sort`} type="number" className="tt-tm-input" placeholder="необязательно" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}/>
          </div>
          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">Параметры</legend>
            <label className="tt-tm-check-row">
              <input type="checkbox" checked={form.hasUnitPrice} onChange={(e) => setForm((f) => ({ ...f, hasUnitPrice: e.target.checked }))}/>
              <span>У расхода есть цена за единицу</span>
            </label>
            {mode === 'edit' && (<label className="tt-tm-check-row">
                <input type="checkbox" checked={form.isArchived} onChange={(e) => setForm((f) => ({ ...f, isArchived: e.target.checked }))}/>
                <span>В архиве</span>
              </label>)}
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
export function TimeTrackingClientExpenseCategoriesPanel() {
    const { user } = useCurrentUser();
    const canManage = canManageTimeManagerClients(user?.role);
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
            setClientsError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
        }
        finally {
            setClientsLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadClients();
    }, [loadClients]);
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
                setCatError('Недостаточно прав для просмотра категорий.');
            }
            else {
                setCatError(e instanceof Error ? e.message : 'Не удалось загрузить категории');
            }
            setCategories([]);
        }
        finally {
            setCatLoading(false);
        }
    }, []);
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
        if (!window.confirm(`Удалить категорию «${cat.name}»?`))
            return;
        try {
            await deleteClientExpenseCategory(clientId, cat.id);
            setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        }
        catch (e) {
            window.alert(e instanceof Error ? e.message : 'Не удалось удалить');
        }
    };
    const selectedClient = clients.find((c) => c.id === clientId);
    return (<div className="tt-settings__content tt-tasks-page tt-ecat-page">
      <h1 className="tt-settings__page-title">Категории расходов</h1>
      <p className="tt-settings__desc tt-tasks-page__lead">
        Справочник категорий привязан к клиенту. Удаление возможно только при нулевом счётчике использования; иначе
        переведите категорию в архив в форме редактирования.
      </p>

      {clientsError && (<p className="tt-settings__banner-error" role="alert">
          {clientsError}
        </p>)}

      <div className="tt-tasks-toolbar tt-ecat-toolbar">
        <div className="tt-ecat-toolbar__main">
          <div className="tt-ecat-toolbar__row">
            <div className="tt-tasks-toolbar__client tt-ecat-toolbar__client-field">
              <label className="tt-tasks-toolbar__label" id="tt-ecat-client-lbl" htmlFor="tt-ecat-client-select">
                Клиент
              </label>
              <SearchableSelect<TimeManagerClientRow> className="tt-tm-dd" buttonClassName="tt-tm-dd__btn" buttonId="tt-ecat-client-select" value={clientId} items={clients} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={clientRowSearchText} onSelect={(c) => setClientId(c.id)} placeholder={clients.length === 0 && !clientsLoading ? 'Нет клиентов' : 'Найдите или выберите клиента…'} emptyListText="Нет клиентов" noMatchText="Клиент не найден" disabled={clientsLoading || clients.length === 0} portalDropdown portalZIndex={11020} portalMinWidth={300} portalDropdownClassName="tsp-srch__dropdown--tall" aria-labelledby="tt-ecat-client-lbl" renderOption={(c) => (<span className="tt-tm-dd__opt">
                    <span className="tt-tm-dd__opt-name">{c.name}</span>
                    {c.address ? (<span className="tt-tm-dd__opt-sub">{c.address}</span>) : c.email ? (<span className="tt-tm-dd__opt-sub">{c.email}</span>) : null}
                  </span>)}/>
            </div>
            <button type="button" className="tt-settings__btn tt-settings__btn--primary tt-ecat-toolbar__new-btn" disabled={!canManage || !clientId} title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined} onClick={() => setModal({ mode: 'create', row: null })}>
              + Новая категория
            </button>
          </div>
          <label className="tt-ecat-archive-toggle tt-ecat-archive-toggle--toolbar">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)}/>
            <span>Показать архивные</span>
          </label>
          {!clientsLoading && clients.length === 0 && !clientsError && (<p className="tt-tasks-toolbar__hint tt-ecat-toolbar__hint">Сначала добавьте клиента на вкладке «Клиенты».</p>)}
        </div>
      </div>

      {!canManage && !clientsLoading && clients.length > 0 && (<p className="tt-settings__banner-info tt-tasks-page__banner" role="status">
          Режим просмотра: изменять категории могут главный администратор, администратор и партнёр.
        </p>)}

      {catError && (<p className="tt-settings__banner-error" role="alert">
          {catError}
        </p>)}

      {!catError && selectedClient && (<h2 className="tt-tasks-page__list-heading">
          Категории <span className="tt-tasks-page__list-heading-client">{selectedClient.name}</span>
        </h2>)}

      {!catError && (<div className="tt-settings__list tt-tasks-page__list">
          {catLoading && (<div className="tt-settings__list-loading" role="status">
              Загрузка категорий…
            </div>)}
          {!catLoading && clientId && categories.length === 0 && (<div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
              Для этого клиента пока нет категорий. Нажмите «Новая категория».
            </div>)}
          {!catLoading &&
                categories.map((c) => (<div key={c.id} className="tt-settings__list-row tt-task-card">
                <div className="tt-task-card__main">
                  <div className="tt-task-card__top">
                    <h3 className="tt-task-card__title">
                      {c.name}
                      {c.is_archived && (<span className="tt-ecat-badge tt-ecat-badge--arch tt-ecat-badge--title" title="В архиве">
                          Архив
                        </span>)}
                    </h3>
                    <div className="tt-task-card__actions">
                      <button type="button" className="tt-task-card__btn" disabled={!canManage} title={!canManage ? 'Недостаточно прав' : 'Редактировать категорию'} onClick={() => setModal({ mode: 'edit', row: c })}>
                        <IcoPen />
                        <span>Изменить</span>
                      </button>
                      <button type="button" className="tt-task-card__btn tt-task-card__btn--danger" disabled={!canManage || !c.deletable} title={!canManage
                        ? 'Недостаточно прав'
                        : !c.deletable
                            ? 'Сначала архив или дождитесь нулевого использования'
                            : 'Удалить категорию'} onClick={() => void handleDelete(c)}>
                        <IcoTrash />
                        <span>Удалить</span>
                      </button>
                    </div>
                  </div>
                  <div className="tt-task-card__meta tt-ecat-card__meta">
                    <span className={`tt-task-pill${c.has_unit_price ? ' tt-task-pill--billable' : ' tt-task-pill--muted'}`}>
                      {c.has_unit_price ? 'Цена за единицу' : 'Без цены за единицу'}
                    </span>
                    {c.sort_order != null && (<span className="tt-task-pill tt-task-pill--scope">Порядок: {c.sort_order}</span>)}
                    <span className="tt-task-pill tt-task-pill--muted">Использований: {c.usage_count}</span>
                    {!c.deletable && (<span className="tt-task-pill tt-task-pill--muted" title="Удаление недоступно при ненулевом использовании">
                        Удаление недоступно
                      </span>)}
                  </div>
                </div>
              </div>))}
        </div>)}

      {modal && clientId && (<ExpenseCategoryModal key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'} mode={modal.mode} clientId={clientId} initial={modal.row} onClose={() => setModal(null)} onSaved={onSaved}/>)}
    </div>);
}
