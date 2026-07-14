import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, type ReactNode, type KeyboardEvent, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

type PortalBox = {
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxH: number;
};

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
    filterItems?: (items: readonly T[], queryLowerTrimmed: string) => T[];
    onSelect: (item: T) => void;
    renderOption?: (item: T, opts: {
        active: boolean;
        selected: boolean;
    }) => ReactNode;
    className?: string;
    buttonClassName?: string;
    /** Render dropdown in a portal (avoids clipping inside overflow panels). */
    portalDropdown?: boolean;
    portalZIndex?: number;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
    'aria-label'?: string;
};

export function ExpenseSearchableSelect<T>({
    disabled = false,
    placeholder = 'Выберите…',
    emptyListText = 'Нет вариантов',
    noMatchText = 'Ничего не найдено',
    value,
    items,
    getOptionValue,
    getOptionLabel,
    getSearchText,
    filterItems,
    onSelect,
    renderOption,
    className = '',
    buttonClassName = '',
    portalDropdown = false,
    portalZIndex = 13000,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
}: Props<T>) {
    const listId = useId();
    const inputId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [portalBox, setPortalBox] = useState<PortalBox | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedItem = useMemo(() => items.find(it => getOptionValue(it) === value) ?? null, [items, value, getOptionValue]);
    const displayLabel = selectedItem ? getOptionLabel(selectedItem) : '';
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (filterItems)
            return filterItems(items, q);
        if (!q)
            return [...items];
        return items.filter(it => getSearchText(it).toLowerCase().includes(q));
    }, [items, query, getSearchText, filterItems]);

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
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !portalDropdown) {
            setPortalBox(null);
            return;
        }
        const update = () => {
            const el = wrapRef.current;
            if (!el || typeof window === 'undefined')
                return;
            const r = el.getBoundingClientRect();
            const w = Math.max(r.width, 240);
            const maxW = Math.max(0, window.innerWidth - 16);
            const width = maxW > 0 ? Math.min(w, maxW) : w;
            let left = r.left;
            if (maxW > 0 && left + width > window.innerWidth - 8)
                left = Math.max(8, window.innerWidth - 8 - width);
            const margin = 8;
            const gap = 4;
            const spaceBelow = window.innerHeight - r.bottom - margin;
            const spaceAbove = r.top - margin;
            const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
            if (openAbove) {
                setPortalBox({
                    bottom: window.innerHeight - r.top + gap,
                    left,
                    width,
                    maxH: Math.max(120, r.top - margin - gap),
                });
            }
            else {
                setPortalBox({
                    top: r.bottom + gap,
                    left,
                    width,
                    maxH: Math.max(120, spaceBelow - gap),
                });
            }
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open, portalDropdown, filtered.length]);

    useEffect(() => {
        if (open) {
            setQuery('');
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            setOpen(false);
        }
    };

    const dropdownInner = (
        <>
            <div className="exp-searchable__search">
                <label htmlFor={inputId} className="exp-searchable__search-label">
                    Поиск
                </label>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="search"
                    className="exp-form-input exp-searchable__input"
                    placeholder="Начните вводить…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Escape') {
                            e.stopPropagation();
                            setOpen(false);
                        }
                    }}
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>
            <ul id={listId} className="exp-searchable__list" role="listbox" aria-label="Варианты">
                {items.length === 0 ? (
                    <li className="exp-searchable__empty" role="presentation">{emptyListText}</li>
                ) : filtered.length === 0 ? (
                    <li className="exp-searchable__empty" role="presentation">{noMatchText}</li>
                ) : (
                    filtered.map(it => {
                        const v = getOptionValue(it);
                        const selected = v === value;
                        return (
                            <li key={v || '__empty__'} role="presentation">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    className={`exp-searchable__opt${selected ? ' exp-searchable__opt--selected' : ''}`}
                                    onClick={() => {
                                        onSelect(it);
                                        setOpen(false);
                                    }}
                                >
                                    {renderOption ? renderOption(it, { active: false, selected }) : getOptionLabel(it)}
                                </button>
                            </li>
                        );
                    })
                )}
            </ul>
        </>
    );

    const portalStyle: CSSProperties | undefined = portalBox
        ? {
            position: 'fixed',
            top: portalBox.top,
            bottom: portalBox.bottom,
            left: portalBox.left,
            width: portalBox.width,
            maxHeight: portalBox.maxH,
            zIndex: portalZIndex,
        }
        : undefined;

    return (
        <div ref={wrapRef} className={`exp-searchable ${className}${open ? ' exp-searchable--open' : ''}`}>
            <button
                type="button"
                className={`exp-searchable__btn exp-form-input ${buttonClassName}`}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                aria-label={ariaLabel}
                onClick={() => {
                    if (!disabled)
                        setOpen(o => !o);
                }}
            >
                <span className={`exp-searchable__btn-text${!displayLabel ? ' exp-searchable__btn-text--placeholder' : ''}`}>
                    {displayLabel || placeholder}
                </span>
                <span className="exp-searchable__chev" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </span>
            </button>
            {open && !portalDropdown && (
                <div className="exp-searchable__dropdown" role="presentation" onKeyDown={onKeyDown} ref={dropdownRef}>
                    {dropdownInner}
                </div>
            )}
            {open && portalDropdown && portalBox && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    className="exp-searchable__dropdown exp-searchable__dropdown--portal"
                    role="presentation"
                    style={portalStyle}
                    onKeyDown={onKeyDown}
                >
                    {dropdownInner}
                </div>,
                document.body,
            )}
        </div>
    );
}
