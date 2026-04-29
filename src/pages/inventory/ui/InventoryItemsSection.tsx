import { useState } from 'react';
import { useInventory } from '../model';
import { InvSelect } from './InvSelect';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import { LIMIT } from '../model/constants';
import { AuthImg } from '@shared/ui';
import type { InventoryItem } from '@entities/inventory';
export function InventoryItemsSection() {
    const { canEdit, canCreateItems, categories, statuses, users, items, loadingItems, filterCategoryId, setFilterCategoryId, filterStatus, setFilterStatus, filterAssignedTo, setFilterAssignedTo, includeArchived, setIncludeArchived, skip, setSkip, setItemModal, resetItemForm, setFormError, categoryById, statusLabel, } = useInventory();
    const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
    const showPager = skip > 0 || items.length >= LIMIT;
    const canGoNext = items.length >= LIMIT;
    const rangeLabel = items.length === 0
        ? skip > 0
            ? 'На странице нет записей'
            : ''
        : `${skip + 1}–${skip + items.length}`;
    return (<section className="inv__card">
      <div className="inv__card-head">
        <h2 className="inv__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          Позиции
        </h2>
        <div className="inv__card-head-right">
          <span className="inv__card-count">{items.length}</span>
          {canCreateItems && (<button type="button" className="inv__btn inv__btn--primary" onClick={() => {
                setItemModal('add');
                resetItemForm();
                setFormError(null);
            }}>
              + Позиция
            </button>)}
        </div>
      </div>

      <div className="inv__toolbar">
        <div className="inv__toolbar-group">
          <label className="inv__field">
            <span className="inv__field-label">Категория</span>
            <InvSelect value={filterCategoryId === '' ? '' : filterCategoryId} placeholder="Все" options={categories.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => {
            setFilterCategoryId(v === '' ? '' : Number(v));
            setSkip(0);
        }}/>
          </label>
          <label className="inv__field">
            <span className="inv__field-label">Статус</span>
            <InvSelect value={filterStatus} placeholder="Все" options={statuses.map((s) => ({ value: s.value, label: s.label }))} onChange={(v) => {
            setFilterStatus(String(v));
            setSkip(0);
        }}/>
          </label>
          {canEdit && users.length > 0 && (<label className="inv__field">
              <span className="inv__field-label">Закреплено за</span>
              <InvSelect value={filterAssignedTo === '' ? '' : filterAssignedTo} placeholder="Все" options={users.map((u) => ({ value: u.id, label: u.display_name || u.email }))} onChange={(v) => {
                setFilterAssignedTo(v === '' ? '' : Number(v));
                setSkip(0);
            }}/>
            </label>)}
        </div>
        <label className="inv__switch-label">
          <span className="switch">
            <input type="checkbox" className="switch__input" checked={includeArchived} onChange={(e) => {
            setIncludeArchived(e.target.checked);
            setSkip(0);
        }}/>
            <span className="switch__track">
              <span className="switch__thumb"/>
            </span>
          </span>
          <span>С архивом</span>
        </label>
      </div>

      {loadingItems ? (<div className="inv__table-wrap inv__table-wrap--skeleton">
          <table className="inv__table">
            <thead>
              <tr>
                <th className="inv__col inv__col--name">Название</th>
                <th className="inv__col inv__col--cat">Категория</th>
                <th className="inv__col inv__col--invno">Инв. номер</th>
                <th className="inv__col inv__col--status">Статус</th>
                <th className="inv__col inv__col--assigned">Закреплено за</th>
                <th className="inv__col inv__col--open"/>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (<tr key={i}>
                  <td className="inv__col inv__col--name" data-label="Название">
                    <span className="inv__skel inv__skel--lg"/>
                  </td>
                  <td className="inv__col inv__col--cat" data-label="Категория">
                    <span className="inv__skel"/>
                  </td>
                  <td className="inv__col inv__col--invno" data-label="Инв. номер">
                    <span className="inv__skel"/>
                  </td>
                  <td className="inv__col inv__col--status" data-label="Статус">
                    <span className="inv__skel-pill"/>
                  </td>
                  <td className="inv__col inv__col--assigned" data-label="Закреплено за">
                    <span className="inv__skel inv__skel--md"/>
                  </td>
                  <td className="inv__col inv__col--open" data-label=""/>
                </tr>))}
            </tbody>
          </table>
        </div>) : items.length === 0 && skip === 0 ? (<div className="inv__empty">
          <p>Нет позиций</p>
          {canCreateItems && (<button type="button" className="inv__btn inv__btn--ghost" onClick={() => {
                    setItemModal('add');
                    resetItemForm();
                }}>
              Добавить первую
            </button>)}
        </div>) : items.length === 0 && skip > 0 ? (<div className="inv__empty">
          <p>Дальше записей нет — вернитесь назад.</p>
        </div>) : (<div className="inv__table-wrap">
          <table className="inv__table">
            <thead>
              <tr>
                <th className="inv__col inv__col--name">Название</th>
                <th className="inv__col inv__col--cat">Категория</th>
                <th className="inv__col inv__col--invno">Инв. номер</th>
                <th className="inv__col inv__col--status">Статус</th>
                <th className="inv__col inv__col--assigned">Закреплено за</th>
                <th className="inv__col inv__col--open"/>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cat = categoryById(item.category_id);
                const assigned = users.find((u) => u.id === item.assigned_to_user_id);
                return (<tr key={item.uuid} className={`inv__row--clickable${item.is_archived ? ' inv__row--dim' : ''}`} onClick={() => setViewItem(item)}>
                    <td className="inv__col inv__col--name" data-label="Название">
                      <div className="inv__name-cell">
                        {item.photo_path ? (<span className="inv__thumb">
                            <AuthImg mediaPath={item.photo_path} alt=""/>
                          </span>) : (<span className="inv__thumb inv__thumb--placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="7" width="20" height="14" rx="2"/>
                              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                            </svg>
                          </span>)}
                        <div className="inv__name-body">
                          <div className="inv__name-title">{item.name}</div>
                          {item.description && (<div className="inv__name-hint">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                              Есть заметки
                            </div>)}
                        </div>
                      </div>
                    </td>
                    <td className="inv__col inv__col--cat" data-label="Категория">
                      {cat?.name ?? '—'}
                    </td>
                    <td className="inv__col inv__col--invno inv__td-mono" data-label="Инв. номер">
                      {item.inventory_number}
                    </td>
                    <td className="inv__col inv__col--status" data-label="Статус">
                      <span className={`inv__status inv__status--${item.status}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="inv__col inv__col--assigned" data-label="Закреплено за">
                      {assigned ? (assigned.display_name || assigned.email) : '—'}
                    </td>
                    <td className="inv__col inv__col--open" data-label="" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="inv__open-btn" onClick={() => setViewItem(item)} aria-label="Подробнее" title="Подробнее">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                    </td>
                  </tr>);
            })}
            </tbody>
          </table>
        </div>)}

      {showPager && (<div className="inv__pager">
          <button type="button" className="inv__btn inv__btn--ghost" disabled={skip === 0} onClick={() => setSkip((s) => Math.max(0, s - LIMIT))}>
            Назад
          </button>
          <span className="inv__pager-info">{rangeLabel || `Показано ${items.length}`}</span>
          <button type="button" className="inv__btn inv__btn--ghost" disabled={!canGoNext} onClick={() => setSkip((s) => s + LIMIT)}>
            Далее
          </button>
        </div>)}

      {viewItem && (<ItemDetailDrawer item={viewItem} onClose={() => setViewItem(null)}/>)}
    </section>);
}
