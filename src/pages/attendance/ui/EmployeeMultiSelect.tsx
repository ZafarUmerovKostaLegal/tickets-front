import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';

export type EmployeeChoice = { key: string; name: string };

function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function EmployeeMultiSelect({ options, value, onChange, labelledBy }: {
    options: EmployeeChoice[];
    value: string[];
    onChange: (next: string[]) => void;
    labelledBy?: string;
}) {
    const { t } = useI18n();
    const listId = useId();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [pinned, setPinned] = useState<Set<string>>(new Set());
    const [rect, setRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

    const selected = useMemo(() => new Set(value), [value]);
    const names = useMemo(() => new Map(options.map((o) => [o.key, o.name])), [options]);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const list = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options;
        return [...list].sort((a, b) => Number(pinned.has(b.key)) - Number(pinned.has(a.key)));
    }, [options, query, pinned]);

    useEffect(() => {
        if (!open)
            return;
        const place = () => {
            const r = buttonRef.current?.getBoundingClientRect();
            if (!r)
                return;
            const width = Math.max(r.width, Math.min(320, window.innerWidth - 16));
            const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
            const below = window.innerHeight - r.bottom - 12;
            setRect({ left, top: r.bottom + 4, width, maxHeight: Math.max(220, Math.min(420, below)) });
        };
        place();
        const onDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target))
                setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        requestAnimationFrame(() => searchRef.current?.focus());
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const toggle = (key: string) => {
        onChange(selected.has(key) ? value.filter((k) => k !== key) : [...value, key]);
    };

    const label = value.length === 0
        ? t('attendancePage.filterAll')
        : value.length === 1
            ? names.get(value[0]) ?? '—'
            : fill(t('attendancePage.multi.selected'), { count: value.length });

    return (
        <div className="att-multi">
            <button
                ref={buttonRef}
                type="button"
                className="att-multi__button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-labelledby={labelledBy}
                onClick={() => {
                    if (!open)
                        setPinned(new Set(value));
                    setOpen((v) => !v);
                }}
            >
                <span className="att-multi__label">{label}</span>
                {value.length > 1 ? (
                    <span className="att-multi__names" title={value.map((k) => names.get(k)).filter(Boolean).join(', ')}>
                        {value.map((k) => names.get(k)).filter(Boolean).join(', ')}
                    </span>
                ) : null}
                <svg className="att-multi__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {value.length > 0 ? (
                <button type="button" className="att-multi__clear" aria-label={t('attendancePage.multi.clear')} title={t('attendancePage.multi.clear')} onClick={() => onChange([])}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
            ) : null}
            {open && rect ? createPortal(
                <div
                    ref={panelRef}
                    className="att-multi__panel"
                    style={{ left: rect.left, top: rect.top, width: rect.width, maxHeight: rect.maxHeight }}
                >
                    <input
                        ref={searchRef}
                        type="search"
                        className="att-multi__search"
                        value={query}
                        placeholder={t('attendancePage.multi.search')}
                        aria-label={t('attendancePage.multi.search')}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <div className="att-multi__bar">
                        <span>{value.length ? fill(t('attendancePage.multi.selected'), { count: value.length }) : t('attendancePage.multi.everyone')}</span>
                        {value.length ? <button type="button" onClick={() => onChange([])}>{t('attendancePage.multi.clear')}</button> : null}
                    </div>
                    <ul id={listId} role="listbox" aria-multiselectable="true" className="att-multi__list">
                        {filtered.length === 0 ? <li className="att-multi__empty">{t('attendancePage.multi.nothing')}</li> : null}
                        {filtered.map((option) => {
                            const checked = selected.has(option.key);
                            return (
                                <li key={option.key} role="option" aria-selected={checked}>
                                    <label className={`att-multi__option${checked ? ' is-checked' : ''}`}>
                                        <input type="checkbox" checked={checked} onChange={() => toggle(option.key)} />
                                        <span>{option.name}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </div>,
                document.body,
            ) : null}
        </div>
    );
}
