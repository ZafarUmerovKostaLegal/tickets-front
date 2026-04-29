import { createPortal } from 'react-dom';
import { useInventory } from '../model';
export function DeleteConfirmModal() {
    const { deleteTarget, setDeleteTarget, formError, submitting, handleDeleteCategory, handleDeleteItem, } = useInventory();
    if (!deleteTarget)
        return null;
    const content = (<div className="inv__overlay" role="dialog" aria-modal="true">
      <div className="inv__modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv__modal-head">
          <h3 className="inv__modal-title">Удалить?</h3>
          <button type="button" className="inv__modal-close" onClick={() => setDeleteTarget(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {formError && <p className="inv__form-err">{formError}</p>}
        <p className="inv__modal-desc">
          {deleteTarget.type === 'category'
            ? `Категорию с id ${deleteTarget.id}`
            : 'Эту позицию'}{' '}
          нельзя будет восстановить.
        </p>
        <div className="inv__modal-foot">
          <button type="button" className="inv__btn inv__btn--ghost" onClick={() => setDeleteTarget(null)} disabled={submitting}>
            Нет
          </button>
          <button type="button" className="inv__btn inv__btn--danger" disabled={submitting} onClick={() => deleteTarget.type === 'category'
            ? handleDeleteCategory(deleteTarget.id)
            : handleDeleteItem(deleteTarget.uuid)}>
            Удалить
          </button>
        </div>
      </div>
    </div>);
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
