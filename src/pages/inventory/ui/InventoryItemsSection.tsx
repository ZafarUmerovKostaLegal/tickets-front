import { useState } from 'react';
import { useInventory } from '../model';
import { InvSelect } from './InvSelect';
import { ItemDetailDrawer } from './ItemDetailDrawer';
import { EquipmentScoreBadge } from './EquipmentScoreBadge';
import { LIMIT } from '../model/constants';
import { AuthImg, Pagination } from '@shared/ui';
import { EQUIPMENT_SCORE_RANGES, laptopRamUpgrade } from '@entities/inventory';
import type { InventoryItem } from '@entities/inventory';
export function InventoryItemsSection() {
    const { canEdit, canCreateItems, categories, statuses, users, items, loadingItems, filterCategoryId, setFilterCategoryId, filterStatus, setFilterStatus, filterEquipmentClass, setFilterEquipmentClass, filterAssignedTo, setFilterAssignedTo, includeArchived, setIncludeArchived, skip, setSkip, itemsTotal, setItemModal, resetItemForm, setFormError, categoryById, statusLabel, } = useInventory();
    const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
    const page = Math.floor(skip / LIMIT) + 1;
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
          <span className="inv__card-count">{itemsTotal}</span>
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
          <label className="inv__field">
            <span className="inv__field-label">Оценка</span>
            <InvSelect value={filterEquipmentClass} placeholder="Все" options={EQUIPMENT_SCORE_RANGES.map((r) => ({ value: r.code, label: `${r.range} — ${r.short}` }))} onChange={(v) => {
            setFilterEquipmentClass(String(v));
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
                <th className="inv__col inv__col--score">Оценка</th>
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
                  <td className="inv__col inv__col--score" data-label="Оценка">
                    <span className="inv__skel-pill"/>
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
                <th className="inv__col inv__col--score">Оценка</th>
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
                const ramUpgrade = laptopRamUpgrade({ ...item, categoryName: cat?.name });
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
                          {(ramUpgrade?.canAddRam || item.description) ? (
                            <div className="inv__name-meta">
                              {ramUpgrade?.canAddRam ? (
                                <span className="inv__ram-badge" title={ramUpgrade.hint}>Слот ОЗУ</span>
                              ) : null}
                              {item.description ? (
                                <span className="inv__name-hint" title={item.description}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                  </svg>
                                  Заметки
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="inv__col inv__col--cat" data-label="Категория">
                      <span className="inv__cat-tag">{cat?.name ?? '—'}</span>
                    </td>
                    <td className="inv__col inv__col--score" data-label="Оценка">
                      <EquipmentScoreBadge item={item} compact />
                    </td>
                    <td className="inv__col inv__col--invno" data-label="Инв. номер">
                      <span className="inv__invno" title={item.inventory_number}>{item.inventory_number}</span>
                    </td>
                    <td className="inv__col inv__col--status" data-label="Статус">
                      <span className={`inv__status inv__status--${item.status}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="inv__col inv__col--assigned" data-label="Закреплено за">
                      {assigned ? (
                        <span className="inv__assignee" title={assigned.display_name || assigned.email}>
                          <span className="inv__assignee-av" aria-hidden>
                            {(assigned.display_name || assigned.email || '?').trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="inv__assignee-name">{assigned.display_name || assigned.email}</span>
                        </span>
                      ) : <span className="inv__assignee inv__assignee--empty">Не закреплено</span>}
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

      <Pagination
        page={page}
        totalCount={itemsTotal}
        pageSize={LIMIT}
        loading={loadingItems}
        onPageChange={(next) => setSkip((next - 1) * LIMIT)}
        className="inv__pager"
      />

      {viewItem && (<ItemDetailDrawer item={viewItem} onClose={() => setViewItem(null)}/>)}
    </section>);
}
