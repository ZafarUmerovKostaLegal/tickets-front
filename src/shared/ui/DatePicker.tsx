import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import './DatePicker.css';
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
function pad2(n: number): string {
    return String(n).padStart(2, '0');
}
export function toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseIsoDate(iso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m)
        return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    if (!y || !mo || !da)
        return null;
    const d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da)
        return null;
    return d;
}
function addMonths(d: Date, n: number): Date {
    const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return x;
}
function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function isSameDay(a: Date, b: Date): boolean {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
function isSameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function calendarGridStart(monthAnchor: Date): Date {
    const first = startOfMonth(monthAnchor);
    const dow = first.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    return addDays(first, diff);
}
function monthTitleRu(d: Date): string {
    const raw = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}
function displayRuFromIso(iso: string): string {
    const d = parseIsoDate(iso);
    if (!d)
        return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function compareIso(a: string, b: string): number {
    return a.localeCompare(b);
}
export type DatePickerProps = {
    value: string;
    onChange: (iso: string) => void;
    min?: string;
    max?: string;
    disabled?: boolean;
    className?: string;
    buttonClassName?: string;
    id?: string;
    'aria-labelledby'?: string;
    portal?: boolean;
    
    portalZIndex?: number;
    title?: string;
    
    iconAfterLabel?: boolean;
    showChevron?: boolean;
    
    emptyLabel?: string;
};
export function DatePicker({ value, onChange, min, max, disabled = false, className = '', buttonClassName = '', id, 'aria-labelledby': ariaLabelledBy, portal = false, portalZIndex = 1300, title = 'Выбрать дату', iconAfterLabel = false, showChevron = true, emptyLabel, }: DatePickerProps) {
    const genId = useId();
    const btnId = id ?? `${genId}-btn`;
    const gridId = `${genId}-grid`;
    const [open, setOpen] = useState(false);
    const parsedValue = useMemo(() => parseIsoDate(value), [value]);
    const [viewMonth, setViewMonth] = useState<Date>(() => parsedValue ?? new Date());
    const wrapRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const popW = 280;
    const GAP = 6;
    const V_MARGIN = 8;
    const estPopH = 300;
    const [portalBox, setPortalBox] = useState<{
        top: number;
        left: number;
    } | null>(null);
    useEffect(() => {
        const p = parseIsoDate(value);
        if (p)
            setViewMonth(startOfMonth(p));
    }, [value]);
    const isDisabledDay = useCallback((d: Date): boolean => {
        const iso = toIsoDate(d);
        if (min && compareIso(iso, min) < 0)
            return true;
        if (max && compareIso(iso, max) > 0)
            return true;
        return false;
    }, [min, max]);
    const cells = useMemo(() => {
        const start = calendarGridStart(viewMonth);
        const out: {
            date: Date;
            inMonth: boolean;
        }[] = [];
        for (let i = 0; i < 42; i++) {
            const date = addDays(start, i);
            out.push({ date, inMonth: isSameMonth(date, viewMonth) });
        }
        return out;
    }, [viewMonth]);
    useLayoutEffect(() => {
        if (!open || !portal) {
            setPortalBox(null);
            return;
        }
        const computeTop = (r: DOMRect, popHeight: number): number => {
            if (typeof window === 'undefined')
                return r.bottom + GAP;
            const vh = window.innerHeight;
            const spaceBelow = vh - V_MARGIN - r.bottom - GAP;
            const spaceAbove = r.top - V_MARGIN - GAP;
            let top = r.bottom + GAP;
            if (spaceBelow < popHeight && spaceAbove > spaceBelow) {
                top = r.top - GAP - popHeight;
            }
            const maxTop = vh - V_MARGIN - popHeight;
            if (maxTop < V_MARGIN) {
                return V_MARGIN;
            }
            return Math.max(V_MARGIN, Math.min(top, maxTop));
        };
        const update = (measuredH: number | null) => {
            const el = btnRef.current;
            if (!el)
                return;
            const r = el.getBoundingClientRect();
            let left = r.left;
            if (typeof window !== 'undefined') {
                const wPop = popRef.current?.getBoundingClientRect().width || popW;
                const maxLeft = window.innerWidth - V_MARGIN - wPop;
                if (left > maxLeft)
                    left = Math.max(V_MARGIN, maxLeft);
            }
            const h = measuredH != null && measuredH > 40 ? measuredH : estPopH;
            setPortalBox({ top: computeTop(r, h), left });
        };
        update(null);
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                const h = popRef.current?.getBoundingClientRect().height;
                if (h != null && h > 40)
                    update(h);
            });
        });
        const onScrollResize = () => {
            const h = popRef.current?.getBoundingClientRect().height;
            update(h != null && h > 40 ? h : null);
        };
        window.addEventListener('resize', onScrollResize);
        window.addEventListener('scroll', onScrollResize, true);
        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
            window.removeEventListener('resize', onScrollResize);
            window.removeEventListener('scroll', onScrollResize, true);
        };
    }, [open, portal, viewMonth]);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t))
                return;
            if (popRef.current?.contains(t))
                return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                btnRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);
    const today = useMemo(() => {
        const t = new Date();
        return new Date(t.getFullYear(), t.getMonth(), t.getDate());
    }, []);
    const pick = (d: Date) => {
        if (disabled || isDisabledDay(d))
            return;
        onChange(toIsoDate(d));
        setOpen(false);
        btnRef.current?.focus();
    };
    const goToday = () => {
        if (!isDisabledDay(today))
            pick(today);
    };
    const popover = (<div ref={popRef} id={gridId} className={`ttp-pop${portal ? ' ttp-pop--portal' : ''}`} role="dialog" aria-label="Календарь" style={portal && portalBox
            ? { position: 'fixed', top: portalBox.top, left: portalBox.left, zIndex: portalZIndex }
            : undefined}>
      <div className="ttp-pop__head">
        <button type="button" className="ttp-pop__nav" aria-label="Предыдущий месяц" onClick={() => setViewMonth((m) => addMonths(m, -1))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <span className="ttp-pop__title">{monthTitleRu(viewMonth)}</span>
        <button type="button" className="ttp-pop__nav" aria-label="Следующий месяц" onClick={() => setViewMonth((m) => addMonths(m, 1))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
      <div className="ttp-pop__dow" role="row">
        {WEEKDAY_LABELS.map((w) => (<span key={w} className="ttp-pop__dow-cell" role="columnheader">
            {w}
          </span>))}
      </div>
      <div className="ttp-pop__grid" role="grid">
        {cells.map(({ date, inMonth }, i) => {
            const sel = parsedValue && isSameDay(date, parsedValue);
            const dis = isDisabledDay(date);
            const isToday = isSameDay(date, today);
            return (<button key={i} type="button" role="gridcell" disabled={dis} className={[
                    'ttp-pop__day',
                    !inMonth ? 'ttp-pop__day--muted' : '',
                    isToday ? 'ttp-pop__day--today' : '',
                    sel ? 'ttp-pop__day--selected' : '',
                    dis ? 'ttp-pop__day--disabled' : '',
                ]
                    .filter(Boolean)
                    .join(' ')} onClick={() => pick(date)} aria-label={date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} aria-selected={sel || undefined}>
              {date.getDate()}
            </button>);
        })}
      </div>
      <div className="ttp-pop__foot">
        <button type="button" className="ttp-pop__today" onClick={goToday} disabled={isDisabledDay(today)}>
          Сегодня
        </button>
      </div>
    </div>);
    const ico = (<span className="ttp__ico" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M8 3v4M16 3v4M3 10h18"/>
      </svg>
    </span>);
    const chev = showChevron
        ? (<span className="ttp__chev" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </span>)
        : null;
    const displayLabel = parsedValue
        ? parsedValue.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : (emptyLabel ?? displayRuFromIso(value));
    const labelClass = ['ttp__label', !parsedValue ? 'ttp__label--empty' : ''].filter(Boolean).join(' ');
    return (<div ref={wrapRef} className={`ttp${iconAfterLabel ? ' ttp--icon-end' : ''} ${className}`.trim()}>
      <button ref={btnRef} id={btnId} type="button" className={`ttp__btn ${buttonClassName}`.trim()} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? gridId : undefined} aria-labelledby={ariaLabelledBy} onClick={() => !disabled && setOpen((o) => !o)} title={title}>
        {iconAfterLabel
            ? (<>
          <span className={labelClass}>{displayLabel}</span>
          {chev}
          {ico}
        </>)
            : (<>
          {ico}
          <span className={labelClass}>{displayLabel}</span>
          {chev}
        </>)}
      </button>
      {open && !portal ? <div className="ttp__dropdown">{popover}</div> : null}
      {open && portal && portalBox && typeof document !== 'undefined'
            ? createPortal(popover, document.body)
            : null}
    </div>);
}
