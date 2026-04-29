import { createPortal } from 'react-dom';
import { useInventory } from '../model';
export function AssignModal() {
    const { assignModal, setAssignModal, assignUserId, setAssignUserId, formError, submitting, users, handleAssignSubmit, } = useInventory();
    if (!assignModal)
        return null;
    const content = (<div className="inv__overlay" role="dialog" aria-modal="true">
      <div className="inv__modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv__modal-head">
          <h3 className="inv__modal-title">Закрепить за сотрудником</h3>
          <button type="button" className="inv__modal-close" onClick={() => setAssignModal(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p className="inv__modal-desc">
          {assignModal.name} (инв. {assignModal.inventory_number})
        </p>
        {formError && <p className="inv__form-err">{formError}</p>}
        <form onSubmit={handleAssignSubmit} className="inv__form">
          <label className="inv__form-field">
            <span className="inv__form-label">Сотрудник</span>
            <select className="inv__input" value={assignUserId === '' ? '' : assignUserId} onChange={(e) => setAssignUserId(e.target.value === '' ? '' : Number(e.target.value))} required>
              <option value="">Выберите</option>
              {users.map((u) => (<option key={u.id} value={u.id}>
                  {u.display_name || u.email}
                </option>))}
            </select>
          </label>
          <div className="inv__modal-foot">
            <button type="button" className="inv__btn inv__btn--ghost" onClick={() => setAssignModal(null)} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="inv__btn inv__btn--primary" disabled={submitting || assignUserId === ''}>
              Закрепить
            </button>
          </div>
        </form>
      </div>
    </div>);
    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
