import { useState, useRef, useEffect, useMemo, useId, useLayoutEffect, Fragment, type ReactNode, type KeyboardEvent, } from 'react';
import { createPortal } from 'react-dom';
import './SearchableSelect.css';
type Props<T> = {
    disabled?: boolean;
    placeholder?: string;
    emptyListText?: string;
    noMatchText?: string;
    value: string;
    items: readonly T[];
    getOptionValue: (item: T) => string;
    getOptionLabel: (item: T) => string;
    getSearchText: (item: T) => string;
    
    getGroupLabel?: (item: T) => string;
    
    groupItemSort?: (a: T, b: T) => number;
    filterItems?: (items: readonly T[], queryLowerTrimmed: string) => T[];
    onSelect: (item: T) => void;
    renderOption?: (item: T, opts: {
        active: boolean;
        selected: boolean;
    }) => ReactNode;
    
    renderButtonContent?: (item: T) => ReactNode;
    className?: string;
    buttonClassName?: string;
    buttonId?: string;
    'aria-labelledby'?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
    
    portalDropdown?: boolean;
    
    portalZIndex?: number;
    
    /** Минимальная ширина портального списка (px). Если не задано, используется 300. Передайте `0`, чтобы не расширять относительно триггера. */
    portalMinWidth?: number;
    
    portalDropdownClassName?: string;
};
export function SearchableSelect<T>({ disabled = false, placeholder = 'Выберите…', emptyListText = 'Нет вариантов', noMatchText = 'Ничего не найдено', value, items, getOptionValue, getOptionLabel, getSearchText, getGroupLabel, groupItemSort, filterItems, onSelect, renderOption, renderButtonContent, className = '', buttonClassName = '', buttonId, 'aria-labelledby': ariaLabelledBy, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, portalDropdown = false, portalZIndex = 5000, portalMinWidth, portalDropdownClassName, }: Props<T>) {
    const listId = useId();
    const inputId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [portalBox, setPortalBox] = useState<{
        top: number | undefined;
        bottom: number | undefined;
        left: number;
        width: number;
        maxH: number;
    } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedItem = useMemo(() => items.find((it) => getOptionValue(it) === value) ?? null, [items, value, getOptionValue]);
    const displayLabel = selectedItem ? getOptionLabel(selectedItem) : '';
    const hasSelection = Boolean(selectedItem);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (filterItems)
            return filterItems(items, q);
        if (!q)
            return [...items];
        return items.filter((it) => getSearchText(it).toLowerCase().includes(q));
    }, [items, query, getSearchText, filterItems]);
    const filteredGroups = useMemo(() => {
        if (!getGroupLabel)
            return null;
        const map = new Map<string, T[]>();
        for (const it of filtered) {
            const key = getGroupLabel(it).trim() || '—';
            if (!map.has(key))
                map.set(key, []);
            map.get(key)!.push(it);
        }
        const sortFn = groupItemSort
            ?? ((a: T, b: T) => getSearchText(a).localeCompare(getSearchText(b), 'ru', { sensitivity: 'base' }));
        for (const arr of map.values())
            arr.sort(sortFn);
        return [...map.entries()].sort(([ga], [gb]) => ga.localeCompare(gb, 'ru', { sensitivity: 'base' }));
    }, [filtered, getGroupLabel, groupItemSort, getSearchText]);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t))
                return;
            if (dropdownRef.current?.contains(t))
                return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    useLayoutEffect(() => {
        if (!open || !portalDropdown) {
            setPortalBox(null);
            return;
        }
        const update = () => {
            const el = wrapRef.current;
            if (!el)
                return;
            if (typeof window === 'undefined')
                return;
            const r = el.getBoundingClientRect();
            const minW = portalMinWidth ?? 300;
            const w = Math.max(r.width, minW);
            const maxW = Math.max(0, window.innerWidth - 16);
            const width = maxW > 0 ? Math.min(w, maxW) : w;
            let left = r.left;
            if (maxW > 0) {
                const rightEdge = r.left + width;
                if (rightEdge > window.innerWidth - 8)
                    left = Math.max(8, window.innerWidth - 8 - width);
            }
            const margin = 8;
            const gap = 4;
            const spaceBelow = window.innerHeight - r.bottom - margin;
            const spaceAbove = r.top - margin;
            const minFlip = 120;
            const openAbove = spaceBelow < minFlip && spaceAbove > spaceBelow;
            let top: number | undefined;
            let bottom: number | undefined;
            let maxH: number;
            if (openAbove) {
                bottom = window.innerHeight - r.top + gap;
                top = undefined;
                maxH = Math.max(80, r.top - margin - gap);
            }
            else {
                top = r.bottom + gap;
                bottom = undefined;
                maxH = Math.max(80, spaceBelow - gap);
            }
            setPortalBox({ top, bottom, left, width, maxH });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open, portalDropdown, portalMinWidth]);
    useEffect(() => {
        if (open)
            setQuery('');
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        if (portalDropdown)
            return;
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open, portalDropdown]);
    useEffect(() => {
        if (!open || !portalDropdown || !portalBox)
            return;
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open, portalDropdown, portalBox]);
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            setOpen(false);
        }
    };
    const dropdownBody = (<>
      <div className="tsp-srch__search">
        <label htmlFor={inputId} className="tsp-srch__search-label">
          Поиск
        </label>
        <input ref={inputRef} id={inputId} type="search" className="tsp-srch__input" placeholder="Начните вводить…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
            }
        }} autoComplete="off" spellCheck={false}/>
      </div>
      <ul id={listId} className="tsp-srch__list" role="listbox" aria-label="Варианты">
        {items.length === 0 ? (<li className="tsp-srch__empty" role="presentation">
            {emptyListText}
          </li>) : filtered.length === 0 ? (<li className="tsp-srch__empty" role="presentation">
            {noMatchText}
          </li>) : getGroupLabel && filteredGroups && filteredGroups.length > 0 ? (filteredGroups.map(([gName, gItems]) => (<Fragment key={gName}>
            <li role="presentation" className="tsp-srch__group">
              <div className="tsp-srch__group-title">{gName}</div>
            </li>
            {gItems.map((it) => {
                const v = getOptionValue(it);
                const selected = v === value;
                return (<li key={v} role="presentation" className="tsp-srch__group-item">
                <button type="button" role="option" aria-selected={selected} className={`tsp-srch__opt${selected ? ' tsp-srch__opt--selected' : ''}`} onClick={() => {
                    onSelect(it);
                    setOpen(false);
                }}>
                  {renderOption ? renderOption(it, { active: false, selected }) : getOptionLabel(it)}
                </button>
              </li>);
            })}
          </Fragment>))) : (filtered.map((it) => {
            const v = getOptionValue(it);
            const selected = v === value;
            return (<li key={v} role="presentation">
                <button type="button" role="option" aria-selected={selected} className={`tsp-srch__opt${selected ? ' tsp-srch__opt--selected' : ''}`} onClick={() => {
                    onSelect(it);
                    setOpen(false);
                }}>
                  {renderOption ? renderOption(it, { active: false, selected }) : getOptionLabel(it)}
                </button>
              </li>);
        }))}
      </ul>
    </>);
    return (<div ref={wrapRef} className={`tsp-srch ${className}${open ? ' tsp-srch--open' : ''}`}>
      <button type="button" id={buttonId} className={`tsp-srch__btn ${buttonClassName}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={ariaLabelledBy} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy} onClick={() => {
            if (!disabled)
                setOpen((o) => !o);
        }}>
        <span className={`tsp-srch__btn-text${!hasSelection ? ' tsp-srch__btn-text--placeholder' : ''}${selectedItem && renderButtonContent ? ' tsp-srch__btn-text--custom' : ''}`}>
          {selectedItem && renderButtonContent
            ? renderButtonContent(selectedItem)
            : (displayLabel || placeholder)}
        </span>
        <span className="tsp-srch__chev" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </span>
      </button>
      {open &&
            !portalDropdown && (<div className="tsp-srch__dropdown" role="presentation" onKeyDown={onKeyDown}>
            {dropdownBody}
          </div>)}
      {open &&
            portalDropdown &&
            portalBox &&
            typeof document !== 'undefined' &&
            createPortal(<div ref={dropdownRef} className={['tsp-srch__dropdown', 'tsp-srch__dropdown--portal', portalDropdownClassName].filter(Boolean).join(' ')} role="presentation" onKeyDown={onKeyDown} style={{
                    position: 'fixed',
                    ...(portalBox.top != null ? { top: portalBox.top } : {}),
                    ...(portalBox.bottom != null ? { bottom: portalBox.bottom } : {}),
                    left: portalBox.left,
                    width: portalBox.width,
                    zIndex: portalZIndex,
                    maxHeight: portalBox.maxH,
                }}>
            {dropdownBody}
          </div>, document.body)}
    </div>);
}
