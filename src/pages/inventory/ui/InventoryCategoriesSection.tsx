import { useInventory } from '../model';
export function InventoryCategoriesSection() {
    const { canManageCats, loadingCat, sortedCategories, countByCategory, filterCategoryId, setFilterCategoryId, setCategoryModal, setCategoryForm, setFormError, setDeleteTarget, } = useInventory();
    if (!canManageCats)
        return null;
    return (<section className="inv__card">
      <div className="inv__card-head">
        <h2 className="inv__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Категории
        </h2>
        <button type="button" className="inv__btn inv__btn--primary" onClick={() => {
            setCategoryModal('add');
            setCategoryForm({ name: '', description: '' });
            setFormError(null);
        }}>
          + Категория
        </button>
      </div>
      {loadingCat ? (<div className="inv__cats inv__cats--skeleton">
          {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="inv__cat inv__cat--skeleton">
              <div className="inv__cat-top">
                <span className="inv__skel inv__skel--lg"/>
                <span className="inv__skel inv__skel--sm"/>
              </div>
              <span className="inv__skel inv__skel--md" style={{ width: '80%', marginTop: '0.5rem' }}/>
              <div className="inv__cat-actions" style={{ marginTop: '0.75rem' }}>
                <span className="inv__skel inv__skel--sm" style={{ width: 70 }}/>
                <span className="inv__skel inv__skel--sm" style={{ width: 70 }}/>
              </div>
            </div>))}
        </div>) : sortedCategories.length === 0 ? (<div className="inv__empty">
          <p>Нет категорий</p>
        </div>) : (<div className="inv__cats">
          {sortedCategories.map((c) => {
                const count = countByCategory[c.id] ?? 0;
                const isActive = filterCategoryId === c.id;
                return (<div key={c.id} className={`inv__cat${isActive ? ' inv__cat--active' : ''}`}>
                <div className="inv__cat-top">
                  <button type="button" className="inv__cat-name" onClick={() => setFilterCategoryId(isActive ? '' : c.id)}>
                    {c.name}
                  </button>
                  <span className="inv__cat-badge">{count}</span>
                </div>
                <p className="inv__cat-desc">{c.description || '—'}</p>
                <div className="inv__cat-actions">
                  <button type="button" className="inv__mini-btn" onClick={() => {
                        setCategoryModal({ id: c.id });
                        setCategoryForm({ name: c.name, description: c.description || '' });
                        setFormError(null);
                    }}>
                    Изменить
                  </button>
                  <button type="button" className="inv__mini-btn inv__mini-btn--danger" onClick={() => setDeleteTarget({ type: 'category', id: c.id })}>
                    Удалить
                  </button>
                </div>
              </div>);
            })}
        </div>)}
    </section>);
}
