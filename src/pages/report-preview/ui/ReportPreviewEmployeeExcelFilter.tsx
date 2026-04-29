import { useMemo, useState, type ReactNode } from 'react';
import { ReportPreviewFilterPopover } from './ReportPreviewFilterPopover';
export type ReportPreviewEmployeeExcelFilterProps = {
    uniqueNames: string[];
    excludedNames: Set<string>;
    onExcludedChange: (next: Set<string>) => void;
    sortAsc: boolean;
    onSortAscChange: (asc: boolean) => void;
    
    tableNameSearch?: {
        value: string;
        onChange: (q: string) => void;
    };
};
export function ReportPreviewEmployeeExcelFilter({ uniqueNames, excludedNames, onExcludedChange, sortAsc, onSortAscChange, tableNameSearch, }: ReportPreviewEmployeeExcelFilterProps) {
    const [listQuery, setListQuery] = useState('');
    const q = useMemo(() => listQuery.trim().toLowerCase(), [listQuery]);
    const namesForList = useMemo(() => {
        if (!q)
            return uniqueNames;
        return uniqueNames.filter((n) => n.toLowerCase().includes(q));
    }, [uniqueNames, q]);
    const toggleName = (name: string) => {
        const next = new Set(excludedNames);
        if (next.has(name)) {
            next.delete(name);
            onExcludedChange(next);
            return;
        }
        next.add(name);
        const stillVisible = uniqueNames.some((n) => !next.has(n));
        if (!stillVisible)
            return;
        onExcludedChange(next);
    };
    const selectAll = () => onExcludedChange(new Set());
    const rowCount = uniqueNames.filter((n) => !excludedNames.has(n)).length;
    if (uniqueNames.length === 0)
        return null;
    const panel: ReactNode = (<>
        <div className="tt-rp-xlf__section">
          <div className="tt-rp-xlf__section-title">Поиск по списку</div>
          <input type="search" className="tt-rp-xlf__search-input" value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Сузить список имён…" autoComplete="off" spellCheck={false} />
          <p className="tt-rp-xlf__hint">Фильтрует чекбоксы ниже, не строки таблицы.</p>
        </div>
        {tableNameSearch ? (<>
        <div className="tt-rp-xlf__sep" />
        <div className="tt-rp-xlf__section">
          <div className="tt-rp-xlf__section-title">Поиск в таблице</div>
          <input type="search" className="tt-rp-xlf__search-input" value={tableNameSearch.value} onChange={(e) => tableNameSearch.onChange(e.target.value)} placeholder="Сотрудник…" autoComplete="off" spellCheck={false} />
          <p className="tt-rp-xlf__hint">Скрывает строки, в которых нет вхождения (без учёта регистра).</p>
        </div>
        </>) : null}
        <div className="tt-rp-xlf__sep" />
        <div className="tt-rp-xlf__section">
          <div className="tt-rp-xlf__section-title">Сортировка</div>
          <button type="button" role="menuitemradio" aria-checked={sortAsc} className={`tt-rp-xlf__opt${sortAsc ? ' tt-rp-xlf__opt--active' : ''}`} onClick={() => onSortAscChange(true)}>
            От А до Я
          </button>
          <button type="button" role="menuitemradio" aria-checked={!sortAsc} className={`tt-rp-xlf__opt${!sortAsc ? ' tt-rp-xlf__opt--active' : ''}`} onClick={() => onSortAscChange(false)}>
            От Я до А
          </button>
        </div>
        <div className="tt-rp-xlf__sep" />
        <div className="tt-rp-xlf__section">
          <div className="tt-rp-xlf__section-head">
            <span className="tt-rp-xlf__section-title">Значения</span>
            <button type="button" className="tt-rp-xlf__link" onClick={selectAll}>
              Показать всех
            </button>
          </div>
          <p className="tt-rp-xlf__hint">Снимите флажок, чтобы скрыть сотрудника из таблицы.</p>
          <ul className="tt-rp-xlf__list">
            {namesForList.map((name) => (<li key={name} className="tt-rp-xlf__li">
                <label className="tt-rp-xlf__lbl">
                  <input type="checkbox" className="tt-rp-xlf__cb" checked={!excludedNames.has(name)} onChange={() => toggleName(name)}/>
                  <span className="tt-rp-xlf__name">{name}</span>
                </label>
              </li>))}
          </ul>
        </div>
        <div className="tt-rp-xlf__foot">
          Видно:&nbsp;<strong>{rowCount}</strong>
          &nbsp;/&nbsp;{uniqueNames.length}
        </div>
      </>);
    return (<>
      <ReportPreviewFilterPopover aria-label="Фильтр и сортировка по сотруднику" title="Как в Excel: фильтр, сортировка и значения">
        {panel}
      </ReportPreviewFilterPopover>
    </>);
}
