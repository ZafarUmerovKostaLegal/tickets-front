import { createPortal } from 'react-dom';
import { useInventory } from '../model';
export function CategoryModal() {
    const ctx = useInventory();
    const { categoryModal, setCategoryModal, categoryForm, setCategoryForm, formError, submitting, handleCategorySubmit, } = ctx;
    if (!categoryModal)
        return null;
    const content = (<div className="inv__overlay" onClick={() => !submitting && setCategoryModal(null)} role="dialog" aria-modal="true">
      <div className="inv__modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv__modal-head">
          <h3 className="inv__modal-title">
            {categoryModal === 'add' ? 'Новая категория' : 'Изменить категорию'}
          </h3>
          <button type="button" className="inv__modal-close" onClick={() => setCategoryModal(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {formError && <p className="inv__form-err">{formError}</p>}
        <form onSubmit={handleCategorySubmit} className="inv__form">
          <label className="inv__form-field">
            <span className="inv__form-label">Название</span>
            <input className="inv__input" value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} required/>
          </label>
          <label className="inv__form-field">
            <span className="inv__form-label">Описание</span>
            <textarea className="inv__input" rows={2} value={categoryForm.description} onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}/>
          </label>
          <div className="inv__modal-foot">
            <button type="button" className="inv__btn inv__btn--ghost" onClick={() => setCategoryModal(null)} disabled={submitting}>
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
