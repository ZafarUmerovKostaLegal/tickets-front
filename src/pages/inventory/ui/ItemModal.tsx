import { createPortal } from 'react-dom';
import { useInventory } from '../model';
export function ItemModal() {
    const { itemModal, setItemModal, itemForm, setItemForm, itemPhotoFile, setItemPhotoFile, formError, submitting, categories, statuses, photoInputRef, handleItemSubmit, } = useInventory();
    if (!itemModal)
        return null;
    const content = (<div className="inv__overlay" onClick={() => !submitting && setItemModal(null)} role="dialog" aria-modal="true">
      <div className="inv__modal inv__modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="inv__modal-head">
          <h3 className="inv__modal-title">
            {itemModal === 'add' ? 'Новая позиция' : 'Редактировать позицию'}
          </h3>
          <button type="button" className="inv__modal-close" onClick={() => setItemModal(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {formError && <p className="inv__form-err">{formError}</p>}
        <form onSubmit={handleItemSubmit} className="inv__form">
          <label className="inv__form-field">
            <span className="inv__form-label">Название *</span>
            <input className="inv__input" value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} required/>
          </label>
          <label className="inv__form-field">
            <span className="inv__form-label">Категория *</span>
            <select className="inv__input" value={itemForm.category_id === '' ? '' : itemForm.category_id} onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value === '' ? '' : Number(e.target.value) }))} required>
              <option value="">Выберите</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>
                  {c.name}
                </option>))}
            </select>
          </label>
          <label className="inv__form-field">
            <span className="inv__form-label">Инв. номер *</span>
            <input className="inv__input" value={itemForm.inventory_number} onChange={(e) => setItemForm((f) => ({ ...f, inventory_number: e.target.value }))} required placeholder="Уникальный номер"/>
          </label>
          <label className="inv__form-field">
            <span className="inv__form-label">Описание</span>
            <textarea className="inv__input" rows={2} value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}/>
          </label>
          <label className="inv__form-field">
            <span className="inv__form-label">Серийный номер</span>
            <input className="inv__input" value={itemForm.serial_number} onChange={(e) => setItemForm((f) => ({ ...f, serial_number: e.target.value }))}/>
          </label>
          <label className="inv__form-field">
            <span className="inv__form-label">Статус</span>
            <select className="inv__input" value={itemForm.status} onChange={(e) => setItemForm((f) => ({ ...f, status: e.target.value }))}>
              {statuses.map((s) => (<option key={s.value} value={s.value}>
                  {s.label}
                </option>))}
            </select>
          </label>
          <div className="inv__form-row">
            <label className="inv__form-field">
              <span className="inv__form-label">Дата покупки</span>
              <input type="date" className="inv__input" value={itemForm.purchase_date} onChange={(e) => setItemForm((f) => ({ ...f, purchase_date: e.target.value }))}/>
            </label>
            <label className="inv__form-field">
              <span className="inv__form-label">Гарантия до</span>
              <input type="date" className="inv__input" value={itemForm.warranty_until} onChange={(e) => setItemForm((f) => ({ ...f, warranty_until: e.target.value }))}/>
            </label>
          </div>
          <label className="inv__form-field">
            <span className="inv__form-label">Фото</span>
            <input ref={photoInputRef} type="file" accept="image/*" className="inv__file" onChange={(e) => setItemPhotoFile(e.target.files?.[0] ?? null)}/>
            {itemPhotoFile && <span className="inv__file-name">{itemPhotoFile.name}</span>}
          </label>
          <div className="inv__modal-foot">
            <button type="button" className="inv__btn inv__btn--ghost" onClick={() => setItemModal(null)} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="inv__btn inv__btn--primary" disabled={submitting}>
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>);
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
