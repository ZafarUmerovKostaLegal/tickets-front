import type { ReactNode } from 'react';

type Props<T extends string> = {
    pool: readonly T[];
    labels: Record<T, string>;
    activeOrderedIds: T[];
    onChange: (next: T[]) => void;
};


export function ReportPreviewColumnPickerDualPane<T extends string>(p: Props<T>): ReactNode {
    const inactive = p.pool.filter((id) => !p.activeOrderedIds.includes(id));
    const activate = (id: T) => {
        if (p.activeOrderedIds.includes(id))
            return;
        p.onChange([...p.activeOrderedIds, id]);
    };
    const deactivate = (id: T) => {
        if (p.activeOrderedIds.length <= 1)
            return;
        p.onChange(p.activeOrderedIds.filter((x) => x !== id));
    };

    return (<>
      <p className="tt-rp-brief-columns__hint">
        Слева — скрытые колонки; справа — видимые. Нажмите пункт, чтобы перенести в другую группу.
      </p>
      <div className="tt-rp-brief-columns__panes">
        <div className="tt-rp-brief-columns__pane">
          <span className="tt-rp-brief-columns__pane-label">Не показываются</span>
          <ul className="tt-rp-brief-columns__list" role="listbox" aria-label="Скрытые колонки">
            {inactive.length === 0 ? (
                <li className="tt-rp-brief-columns__empty">Все колонки включены</li>
            ) : (
                inactive.map((id) => (
                    <li key={id}>
                      <button type="button" className="tt-rp-brief-columns__item" onClick={() => activate(id)}>
                        <span className="tt-rp-brief-columns__item-label">{p.labels[id]}</span>
                        <span className="tt-rp-brief-columns__item-hint" aria-hidden>
                          →
                        </span>
                      </button>
                    </li>
                ))
            )}
          </ul>
        </div>
        <div className="tt-rp-brief-columns__divider" aria-hidden />
        <div className="tt-rp-brief-columns__pane tt-rp-brief-columns__pane--active">
          <span className="tt-rp-brief-columns__pane-label">В таблице</span>
          <ul className="tt-rp-brief-columns__list" role="listbox" aria-label="Видимые колонки">
            {p.activeOrderedIds.map((id) => (
                <li key={id}>
                  <button type="button" className="tt-rp-brief-columns__item tt-rp-brief-columns__item--active" onClick={() => deactivate(id)} disabled={p.activeOrderedIds.length <= 1} title={p.activeOrderedIds.length <= 1 ? 'Должна остаться хотя бы одна колонка' : 'Убрать колонку из таблицы'}>
                    <span className="tt-rp-brief-columns__item-label">{p.labels[id]}</span>
                    <span className="tt-rp-brief-columns__item-hint" aria-hidden>
                      ×
                    </span>
                  </button>
                </li>
            ))}
          </ul>
        </div>
      </div>
    </>);
}
