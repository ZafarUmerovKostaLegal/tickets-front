import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, } from 'react';
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
type DateSegments = {
    day: string;
    month: string;
    year: string;
};
function segmentsFromDate(d: Date | null): DateSegments {
    if (!d)
        return { day: '', month: '', year: '' };
    return {
        day: pad2(d.getDate()),
        month: pad2(d.getMonth() + 1),
        year: String(d.getFullYear()),
    };
}
function buildDateFromSegments(day: string, month: string, year: string): Date | null {
    if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year))
        return null;
    const da = Number(day);
    const mo = Number(month);
    const y = Number(year);
    if (!da || !mo || !y || mo < 1 || mo > 12 || da < 1 || da > 31)
        return null;
    const d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da)
        return null;
    return d;
}
function onlyDigits(raw: string, maxLen: number): string {
    return raw.replace(/\D/g, '').slice(0, maxLen);
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
    
    isDateDisabled?: (iso: string) => boolean;
    emptyLabel?: string;
    labelText?: string;
    /** Allow typing dd.mm.yyyy (or ISO) in addition to the calendar. */
    editable?: boolean;
};
export function DatePicker({ value, onChange, min, max, disabled = false, isDateDisabled, className = '', buttonClassName = '', id, 'aria-labelledby': ariaLabelledBy, portal = false, portalZIndex = 1300, title = 'Выбрать дату', iconAfterLabel = false, showChevron = true, emptyLabel, labelText, editable = false, }: DatePickerProps) {
    const genId = useId();
    const btnId = id ?? `${genId}-btn`;
    const gridId = `${genId}-grid`;
    const [open, setOpen] = useState(false);
    const parsedValue = useMemo(() => parseIsoDate(value), [value]);
    const [viewMonth, setViewMonth] = useState<Date>(() => parsedValue ?? new Date());
    const [segs, setSegs] = useState<DateSegments>(() => segmentsFromDate(parsedValue));
    const segsRef = useRef(segs);
    segsRef.current = segs;
    const editingRef = useRef(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const dayRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);
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
        if (editable && !editingRef.current)
            setSegs(segmentsFromDate(p));
    }, [value, editable]);
    const isDisabledDay = useCallback((d: Date): boolean => {
        const iso = toIsoDate(d);
        if (min && compareIso(iso, min) < 0)
            return true;
        if (max && compareIso(iso, max) > 0)
            return true;
        if (isDateDisabled?.(iso))
            return true;
        return false;
    }, [min, max, isDateDisabled]);
    const builtFromSegs = useMemo(() => buildDateFromSegments(segs.day, segs.month, segs.year), [segs]);
    const segsComplete = segs.day.length >= 2 && segs.month.length >= 2 && segs.year.length === 4;
    const segsInvalid = segsComplete && (builtFromSegs == null || isDisabledDay(builtFromSegs));
    /** Keep typed day/month; block year until the date is valid again. */
    const yearLocked = segsInvalid;
    const commitSegments = useCallback((next: DateSegments) => {
        const d = buildDateFromSegments(next.day, next.month, next.year);
        if (d == null || isDisabledDay(d))
            return;
        const iso = toIsoDate(d);
        if (iso !== value)
            onChange(iso);
    }, [isDisabledDay, onChange, value]);
    const updateSeg = useCallback((part: keyof DateSegments, raw: string) => {
        editingRef.current = true;
        const maxLen = part === 'year' ? 4 : 2;
        const digits = onlyDigits(raw, maxLen);
        const next = { ...segsRef.current, [part]: digits };
        segsRef.current = next;
        setSegs(next);
        commitSegments(next);
        const d = buildDateFromSegments(next.day, next.month, next.year);
        const invalid = next.day.length >= 2 && next.month.length >= 2 && next.year.length === 4
            && (d == null || isDisabledDay(d));
        if (part === 'day' && digits.length === 2) {
            requestAnimationFrame(() => monthRef.current?.focus());
        }
        else if (part === 'month' && digits.length === 2 && !invalid) {
            requestAnimationFrame(() => yearRef.current?.focus());
        }
    }, [commitSegments, isDisabledDay]);
    const onSegBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
        const next = event.relatedTarget as Node | null;
        const stillInside = !!next && !!wrapRef.current?.contains(next);
        if (stillInside)
            return;
        editingRef.current = false;
        // Keep typed segments when invalid — do not snap back to today/previous value.
        const cur = segsRef.current;
        const d = buildDateFromSegments(cur.day, cur.month, cur.year);
        const invalid = cur.day.length >= 2 && cur.month.length >= 2 && cur.year.length === 4
            && (d == null || isDisabledDay(d));
        if (!invalid && d)
            setSegs(segmentsFromDate(d));
        else if (!cur.day && !cur.month && !cur.year && parsedValue)
            setSegs(segmentsFromDate(parsedValue));
    }, [isDisabledDay, parsedValue]);
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
            const el = btnRef.current ?? wrapRef.current;
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
        document.addEventListener('mousedown', onDoc, true);
        return () => document.removeEventListener('mousedown', onDoc, true);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                (editable ? dayRef.current : btnRef.current)?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [editable, open]);
    const today = useMemo(() => {
        const t = new Date();
        return new Date(t.getFullYear(), t.getMonth(), t.getDate());
    }, []);
    const pick = (d: Date) => {
        if (disabled || isDisabledDay(d))
            return;
        const iso = toIsoDate(d);
        if (editable) {
            editingRef.current = false;
            const next = segmentsFromDate(d);
            segsRef.current = next;
            setSegs(next);
        }
        onChange(iso);
        setOpen(false);
        (editable ? dayRef.current : btnRef.current)?.focus();
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
        ? (labelText ?? parsedValue.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }))
        : (emptyLabel ?? displayRuFromIso(value));
    const labelClass = ['ttp__label', !parsedValue ? 'ttp__label--empty' : ''].filter(Boolean).join(' ');
    return (<div ref={wrapRef} className={`ttp${iconAfterLabel ? ' ttp--icon-end' : ''}${editable ? ' ttp--editable' : ''} ${className}`.trim()}>
      {editable ? (
        <div
          className={`ttp__edit${segsInvalid ? ' ttp__edit--invalid' : ''} ${buttonClassName}`.trim()}
          aria-labelledby={ariaLabelledBy}
        >
          {ico}
          <div className="ttp__segs" role="group" aria-label={title}>
            <input
              ref={dayRef}
              id={btnId}
              type="text"
              className={`ttp__seg ttp__seg--day${segsInvalid ? ' ttp__seg--error' : ''}`}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="дд"
              maxLength={2}
              value={segs.day}
              disabled={disabled}
              aria-label="День"
              aria-invalid={segsInvalid || undefined}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? gridId : undefined}
              title={title}
              onChange={(event) => updateSeg('day', event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={onSegBlur}
              onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' && (event.currentTarget.selectionStart ?? 0) >= event.currentTarget.value.length) {
                      event.preventDefault();
                      monthRef.current?.focus();
                  }
                  if (event.key === 'ArrowDown' && !disabled) {
                      event.preventDefault();
                      setOpen(true);
                  }
                  if (event.key === 'Enter') {
                      event.preventDefault();
                      if (!segsInvalid)
                          setOpen(false);
                  }
              }}
            />
            <span className="ttp__seg-dot" aria-hidden>.</span>
            <input
              ref={monthRef}
              type="text"
              className={`ttp__seg ttp__seg--month${segsInvalid ? ' ttp__seg--error' : ''}`}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="мм"
              maxLength={2}
              value={segs.month}
              disabled={disabled}
              aria-label="Месяц"
              aria-invalid={segsInvalid || undefined}
              onChange={(event) => updateSeg('month', event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={onSegBlur}
              onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' && (event.currentTarget.selectionStart ?? 0) <= 0) {
                      event.preventDefault();
                      dayRef.current?.focus();
                  }
                  if (event.key === 'ArrowRight' && (event.currentTarget.selectionStart ?? 0) >= event.currentTarget.value.length) {
                      event.preventDefault();
                      if (!yearLocked)
                          yearRef.current?.focus();
                  }
                  if (event.key === 'ArrowDown' && !disabled) {
                      event.preventDefault();
                      setOpen(true);
                  }
              }}
            />
            <span className="ttp__seg-dot" aria-hidden>.</span>
            <input
              ref={yearRef}
              type="text"
              className="ttp__seg ttp__seg--year"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="гггг"
              maxLength={4}
              value={segs.year}
              disabled={disabled || yearLocked}
              aria-label="Год"
              title={yearLocked ? 'Сначала исправьте день или месяц' : undefined}
              onChange={(event) => updateSeg('year', event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={onSegBlur}
              onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' && (event.currentTarget.selectionStart ?? 0) <= 0) {
                      event.preventDefault();
                      monthRef.current?.focus();
                  }
                  if (event.key === 'ArrowDown' && !disabled) {
                      event.preventDefault();
                      setOpen(true);
                  }
              }}
            />
          </div>
          <button
            ref={btnRef}
            type="button"
            className="ttp__edit-btn"
            disabled={disabled}
            aria-label={title}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => !disabled && setOpen((o) => !o)}
          >
            {chev ?? ico}
          </button>
        </div>
      ) : (
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
      )}
      {open && !portal ? <div className="ttp__dropdown">{popover}</div> : null}
      {open && portal && portalBox && typeof document !== 'undefined'
            ? createPortal(popover, document.body)
            : null}
    </div>);
}
