import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useState, useRef, useEffect, useMemo, useId, useLayoutEffect, useImperativeHandle, useCallback, Fragment, } from 'react';
import { createPortal } from 'react-dom';
import './SearchableSelect.css';
import { computePortalDropdownBox, readViewportBottomObstacle } from './searchableSelectPlacement';
function SearchableSelectInner({ disabled = false, placeholder = 'Выберите…', emptyListText = 'Нет вариантов', noMatchText = 'Ничего не найдено', value, items, getOptionValue, getOptionLabel, getSearchText, getGroupLabel, groupItemSort, filterItems, onSelect, renderOption, renderButtonContent, className = '', buttonClassName = '', buttonId, 'aria-labelledby': ariaLabelledBy, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, portalDropdown = false, portalZIndex = 5000, portalMinWidth, portalDropdownClassName, onTabFromDropdown, }, ref) {
    const listId = useId();
    const inputId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [portalBox, setPortalBox] = useState(null);
    const wrapRef = useRef(null);
    const dropdownRef = useRef(null);
    const inlineDropdownRef = useRef(null);
    const inputRef = useRef(null);
    const buttonRef = useRef(null);
    const pendingQueryRef = useRef(null);
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
        const map = new Map();
        for (const it of filtered) {
            const key = getGroupLabel(it).trim() || '—';
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(it);
        }
        const sortFn = groupItemSort
            ?? ((a, b) => getSearchText(a).localeCompare(getSearchText(b), 'ru', { sensitivity: 'base' }));
        for (const arr of map.values())
            arr.sort(sortFn);
        return [...map.entries()].sort(([ga], [gb]) => ga.localeCompare(gb, 'ru', { sensitivity: 'base' }));
    }, [filtered, getGroupLabel, groupItemSort, getSearchText]);
    const closeDropdown = useCallback(() => {
        setOpen(false);
        setQuery('');
        setActiveIndex(0);
        pendingQueryRef.current = null;
    }, []);
    const openDropdown = useCallback((initialQuery) => {
        if (disabled)
            return;
        pendingQueryRef.current = initialQuery ?? null;
        setOpen(true);
    }, [disabled]);
    function selectItem(it) {
        onSelect(it);
        closeDropdown();
        requestAnimationFrame(() => buttonRef.current?.focus());
    }
    useImperativeHandle(ref, () => ({
        focusTrigger: () => {
            buttonRef.current?.focus();
        },
        open: () => {
            openDropdown();
        },
        close: () => {
            closeDropdown();
        },
        focusAndOpen: () => {
            if (disabled)
                return;
            openDropdown();
            requestAnimationFrame(() => {
                buttonRef.current?.focus();
            });
        },
    }), [disabled, closeDropdown, openDropdown]);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e) => {
            const t = e.target;
            if (wrapRef.current?.contains(t))
                return;
            if (dropdownRef.current?.contains(t))
                return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onFocusIn = (e) => {
            const t = e.target;
            if (wrapRef.current?.contains(t))
                return;
            if (dropdownRef.current?.contains(t))
                return;
            setOpen(false);
        };
        document.addEventListener('focusin', onFocusIn);
        return () => document.removeEventListener('focusin', onFocusIn);
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
            setPortalBox(computePortalDropdownBox({ top: r.top, bottom: r.bottom, left: r.left, width: r.width }, { width: window.innerWidth, height: window.innerHeight }, {
                minWidth: portalMinWidth ?? 300,
                obstacleBottom: readViewportBottomObstacle(r.bottom),
            }));
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
        if (!open)
            return;
        const pending = pendingQueryRef.current;
        if (pending !== null) {
            setQuery(pending);
            pendingQueryRef.current = null;
        }
        else {
            setQuery('');
        }
    }, [open]);
    useEffect(() => {
        setActiveIndex(0);
    }, [query, open, filtered.length]);
    useEffect(() => {
        if (!open)
            return;
        if (portalDropdown)
            return;
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    }, [open, portalDropdown]);
    useEffect(() => {
        if (!open || !portalDropdown || !portalBox)
            return;
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    }, [open, portalDropdown, portalBox]);
    useEffect(() => {
        if (!open)
            return;
        const root = portalDropdown ? dropdownRef.current : inlineDropdownRef.current;
        const opt = root?.querySelector(`[data-srch-idx="${activeIndex}"]`);
        opt?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, open, portalDropdown]);
    function handleButtonKeyDown(e) {
        if (disabled)
            return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open)
                openDropdown();
            return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (!open) {
                openDropdown();
            }
            else if (e.key === 'Enter' && filtered[activeIndex]) {
                selectItem(filtered[activeIndex]);
            }
            return;
        }
        if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                closeDropdown();
            }
            return;
        }
        if (e.key === 'Tab') {
            if (open)
                closeDropdown();
            return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            openDropdown(e.key);
        }
    }
    function handleSearchKeyDown(e) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            e.preventDefault();
            closeDropdown();
            buttonRef.current?.focus();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const it = filtered[activeIndex];
            if (it)
                selectItem(it);
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            const direction = e.shiftKey ? 'backward' : 'forward';
            closeDropdown();
            requestAnimationFrame(() => {
                buttonRef.current?.focus();
                requestAnimationFrame(() => onTabFromDropdown?.(direction));
            });
        }
    }
    const onDropdownKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeDropdown();
            buttonRef.current?.focus();
        }
    };
    function renderOptionButton(it, idx) {
        const v = getOptionValue(it);
        const selected = v === value;
        const active = idx === activeIndex;
        return (_jsx("button", { type: "button", role: "option", "aria-selected": selected, "data-srch-idx": idx, className: `tsp-srch__opt${selected ? ' tsp-srch__opt--selected' : ''}${active ? ' tsp-srch__opt--active' : ''}`, onMouseEnter: () => setActiveIndex(idx), onClick: () => selectItem(it), children: renderOption ? renderOption(it, { active, selected }) : getOptionLabel(it) }));
    }
    let optionIndex = 0;
    const dropdownBody = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tsp-srch__search", children: [_jsx("label", { htmlFor: inputId, className: "tsp-srch__search-label", children: "\u041F\u043E\u0438\u0441\u043A" }), _jsx("input", { ref: inputRef, id: inputId, type: "search", className: "tsp-srch__input", placeholder: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C\u2026", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: handleSearchKeyDown, autoComplete: "off", spellCheck: false })] }), _jsx("ul", { id: listId, className: "tsp-srch__list", role: "listbox", "aria-label": "\u0412\u0430\u0440\u0438\u0430\u043D\u0442\u044B", children: items.length === 0 ? (_jsx("li", { className: "tsp-srch__empty", role: "presentation", children: emptyListText })) : filtered.length === 0 ? (_jsx("li", { className: "tsp-srch__empty", role: "presentation", children: noMatchText })) : getGroupLabel && filteredGroups && filteredGroups.length > 0 ? (filteredGroups.map(([gName, gItems]) => (_jsxs(Fragment, { children: [_jsx("li", { role: "presentation", className: "tsp-srch__group", children: _jsx("div", { className: "tsp-srch__group-title", children: gName }) }), gItems.map((it) => {
                            const idx = optionIndex++;
                            const v = getOptionValue(it);
                            return (_jsx("li", { role: "presentation", className: "tsp-srch__group-item", children: renderOptionButton(it, idx) }, v));
                        })] }, gName)))) : (filtered.map((it) => {
                    const idx = optionIndex++;
                    const v = getOptionValue(it);
                    return (_jsx("li", { role: "presentation", children: renderOptionButton(it, idx) }, v));
                })) })] }));
    return (_jsxs("div", { ref: wrapRef, className: `tsp-srch ${className}${open ? ' tsp-srch--open' : ''}`, children: [_jsxs("button", { ref: buttonRef, type: "button", id: buttonId, className: `tsp-srch__btn ${buttonClassName}`, disabled: disabled, "aria-haspopup": "listbox", "aria-expanded": open, "aria-controls": listId, "aria-labelledby": ariaLabelledBy, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy, onKeyDown: handleButtonKeyDown, onClick: () => {
                    if (disabled)
                        return;
                    if (open) {
                        closeDropdown();
                    }
                    else {
                        openDropdown();
                    }
                }, children: [_jsx("span", { className: `tsp-srch__btn-text${!hasSelection ? ' tsp-srch__btn-text--placeholder' : ''}${selectedItem && renderButtonContent ? ' tsp-srch__btn-text--custom' : ''}`, children: selectedItem && renderButtonContent
                            ? renderButtonContent(selectedItem)
                            : (displayLabel || placeholder) }), _jsx("span", { className: "tsp-srch__chev", "aria-hidden": true, children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })] }), open && !portalDropdown && (_jsx("div", { ref: inlineDropdownRef, className: "tsp-srch__dropdown", role: "presentation", onKeyDown: onDropdownKeyDown, children: dropdownBody })), open && portalDropdown && portalBox && typeof document !== 'undefined' && createPortal(_jsx("div", { ref: dropdownRef, className: ['tsp-srch__dropdown', 'tsp-srch__dropdown--portal', portalDropdownClassName].filter(Boolean).join(' '), role: "presentation", onKeyDown: onDropdownKeyDown, style: {
                    position: 'fixed',
                    top: portalBox.top ?? 'auto',
                    bottom: portalBox.bottom ?? 'auto',
                    right: 'auto',
                    left: portalBox.left,
                    width: portalBox.width,
                    zIndex: portalZIndex,
                    maxHeight: portalBox.maxH,
                }, children: dropdownBody }), document.body)] }));
}
export const SearchableSelect = forwardRef(SearchableSelectInner);
