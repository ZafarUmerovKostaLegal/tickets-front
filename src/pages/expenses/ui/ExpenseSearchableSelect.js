import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
export function ExpenseSearchableSelect({ disabled = false, placeholder = 'Выберите…', emptyListText = 'Нет вариантов', noMatchText = 'Ничего не найдено', value, items, getOptionValue, getOptionLabel, getSearchText, filterItems, onSelect, renderOption, className = '', buttonClassName = '', portalDropdown = false, portalZIndex = 13000, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, 'aria-label': ariaLabel, }) {
    const listId = useId();
    const inputId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [portalBox, setPortalBox] = useState(null);
    const wrapRef = useRef(null);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);
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
        const onDoc = (e) => {
            const t = e.target;
            if (wrapRef.current?.contains(t))
                return;
            if (dropdownRef.current?.contains(t))
                return;
            setOpen(false);
        };
        const onKey = (e) => {
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
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            setOpen(false);
        }
    };
    const dropdownInner = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "exp-searchable__search", children: [_jsx("label", { htmlFor: inputId, className: "exp-searchable__search-label", children: "\u041F\u043E\u0438\u0441\u043A" }), _jsx("input", { ref: inputRef, id: inputId, type: "search", className: "exp-form-input exp-searchable__input", placeholder: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C\u2026", value: query, onChange: e => setQuery(e.target.value), onKeyDown: e => {
                            if (e.key === 'Escape') {
                                e.stopPropagation();
                                setOpen(false);
                            }
                        }, autoComplete: "off", spellCheck: false })] }), _jsx("ul", { id: listId, className: "exp-searchable__list", role: "listbox", "aria-label": "\u0412\u0430\u0440\u0438\u0430\u043D\u0442\u044B", children: items.length === 0 ? (_jsx("li", { className: "exp-searchable__empty", role: "presentation", children: emptyListText })) : filtered.length === 0 ? (_jsx("li", { className: "exp-searchable__empty", role: "presentation", children: noMatchText })) : (filtered.map(it => {
                    const v = getOptionValue(it);
                    const selected = v === value;
                    return (_jsx("li", { role: "presentation", children: _jsx("button", { type: "button", role: "option", "aria-selected": selected, className: `exp-searchable__opt${selected ? ' exp-searchable__opt--selected' : ''}`, onClick: () => {
                                onSelect(it);
                                setOpen(false);
                            }, children: renderOption ? renderOption(it, { active: false, selected }) : getOptionLabel(it) }) }, v || '__empty__'));
                })) })] }));
    const portalStyle = portalBox
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
    return (_jsxs("div", { ref: wrapRef, className: `exp-searchable ${className}${open ? ' exp-searchable--open' : ''}`, children: [_jsxs("button", { type: "button", className: `exp-searchable__btn exp-form-input ${buttonClassName}`, disabled: disabled, "aria-haspopup": "listbox", "aria-expanded": open, "aria-controls": listId, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy, "aria-label": ariaLabel, onClick: () => {
                    if (!disabled)
                        setOpen(o => !o);
                }, children: [_jsx("span", { className: `exp-searchable__btn-text${!displayLabel ? ' exp-searchable__btn-text--placeholder' : ''}`, children: displayLabel || placeholder }), _jsx("span", { className: "exp-searchable__chev", "aria-hidden": true, children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })] }), open && !portalDropdown && (_jsx("div", { className: "exp-searchable__dropdown", role: "presentation", onKeyDown: onKeyDown, ref: dropdownRef, children: dropdownInner })), open && portalDropdown && portalBox && typeof document !== 'undefined' && createPortal(_jsx("div", { ref: dropdownRef, className: "exp-searchable__dropdown exp-searchable__dropdown--portal", role: "presentation", style: portalStyle, onKeyDown: onKeyDown, children: dropdownInner }), document.body)] }));
}
