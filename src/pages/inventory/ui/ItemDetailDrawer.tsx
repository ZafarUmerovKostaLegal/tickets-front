import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import type { InventoryItem } from '@entities/inventory';
import { useInventory } from '../model';
import { AuthImg } from '@shared/ui';
import { formatDateOnly } from '@shared/lib/formatDate';
type Props = {
    item: InventoryItem;
    onClose: () => void;
};
export function ItemDetailDrawer({ item, onClose }: Props) {
    const { canEdit, users, categoryById, statusLabel, openEditItem, handleUnassign, handleArchive, setDeleteTarget, setAssignModal, setAssignUserId, setFormError, } = useInventory();
    const cat = categoryById(item.category_id);
    const assigned = users.find((u) => u.id === item.assigned_to_user_id);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape')
            onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    const content = (<div className="inv-drawer__overlay" onClick={onClose} role="dialog" aria-modal="true">
      <aside className="inv-drawer" onClick={(e) => e.stopPropagation()}>
        
        <div className="inv-drawer__header">
          <div className="inv-drawer__header-left">
            <h3 className="inv-drawer__title">{item.name}</h3>
            {item.is_archived && (<span className="inv-drawer__archived-badge">В архиве</span>)}
          </div>
          <button className="inv-drawer__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        
        <div className="inv-drawer__body">
          
          {item.photo_path && (<div className="inv-drawer__photo-wrap">
              <AuthImg mediaPath={item.photo_path} alt={item.name} className="inv-drawer__photo"/>
            </div>)}

          
          <div className="inv-drawer__status-row">
            <span className={`inv__status inv__status--${item.status}`}>
              {statusLabel(item.status)}
            </span>
          </div>

          
          <div className="inv-drawer__grid">
            <div className="inv-drawer__field">
              <span className="inv-drawer__field-label">Категория</span>
              <span className="inv-drawer__field-value">{cat?.name ?? '—'}</span>
            </div>
            <div className="inv-drawer__field">
              <span className="inv-drawer__field-label">Инв. номер</span>
              <span className="inv-drawer__field-value inv-drawer__field-value--mono">
                {item.inventory_number}
              </span>
            </div>
            <div className="inv-drawer__field inv-drawer__field--full">
              <span className="inv-drawer__field-label">Серийный номер</span>
              <span className="inv-drawer__field-value inv-drawer__field-value--mono">
                {item.serial_number?.trim() || '—'}
              </span>
            </div>
            <div className="inv-drawer__field">
              <span className="inv-drawer__field-label">Закреплено за</span>
              <span className="inv-drawer__field-value">
                {assigned
            ? (assigned.display_name || assigned.email)
            : '—'}
              </span>
            </div>
            {item.assigned_at && (<div className="inv-drawer__field">
                <span className="inv-drawer__field-label">Дата закрепления</span>
                <span className="inv-drawer__field-value">{formatDateOnly(item.assigned_at)}</span>
              </div>)}
            <div className="inv-drawer__field">
              <span className="inv-drawer__field-label">Дата покупки</span>
              <span className="inv-drawer__field-value">{formatDateOnly(item.purchase_date) || '—'}</span>
            </div>
            <div className="inv-drawer__field">
              <span className="inv-drawer__field-label">Гарантия до</span>
              <span className="inv-drawer__field-value">{formatDateOnly(item.warranty_until) || '—'}</span>
            </div>
            <div className="inv-drawer__field">
              <span className="inv-drawer__field-label">Добавлена</span>
              <span className="inv-drawer__field-value">{formatDateOnly(item.created_at)}</span>
            </div>
            <div className="inv-drawer__field">
              <span className="inv-drawer__field-label">Обновлена</span>
              <span className="inv-drawer__field-value">{formatDateOnly(item.updated_at)}</span>
            </div>
          </div>

          
          {item.description?.trim() && (<div className="inv-drawer__desc-section">
              <span className="inv-drawer__field-label">Описание / Заметки</span>
              <p className="inv-drawer__desc">{item.description.trim()}</p>
            </div>)}
        </div>

        
        {canEdit && (<div className="inv-drawer__footer">
            <button type="button" className="inv__btn inv__btn--ghost inv-drawer__action" onClick={() => { openEditItem(item); onClose(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Изменить
            </button>

            {item.assigned_to_user_id ? (<button type="button" className="inv__btn inv__btn--ghost inv-drawer__action" onClick={() => handleUnassign(item)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                  <line x1="18" y1="11" x2="23" y2="11"/>
                </svg>
                Открепить
              </button>) : (<button type="button" className="inv__btn inv__btn--ghost inv-drawer__action" onClick={() => {
                    setAssignModal(item);
                    setAssignUserId('');
                    setFormError(null);
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Закрепить
              </button>)}

            <button type="button" className="inv__btn inv__btn--ghost inv-drawer__action" onClick={() => handleArchive(item, !item.is_archived)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8"/>
                <rect x="1" y="3" width="22" height="5"/>
                <line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              {item.is_archived ? 'Восстановить' : 'В архив'}
            </button>

            <button type="button" className="inv__btn inv__btn--danger inv-drawer__action" onClick={() => {
                setDeleteTarget({ type: 'item', uuid: item.uuid });
                onClose();
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              Удалить
            </button>
          </div>)}
      </aside>
    </div>);
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
