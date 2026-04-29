import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';

const OUTLOOK_CALENDAR_M365 = 'https://outlook.office.com/calendar/';

export function isKostaCalendarName(name: string): boolean {
    const n = name.trim();
    if (!n)
        return false;
    return /kosta\s*legal|kostalegal|kosta-?legal/i.test(n);
}

function displayCalendarLabel(name: string): string {
    if (isKostaCalendarName(name))
        return 'Kosta Legal';
    return name;
}

export type CallScheduleCalendarItem = { id: string; name: string };

type Opt = { id: string; name: string; isKosta: boolean };

function buildOptions(calendars: readonly CallScheduleCalendarItem[]): Opt[] {
    const def: Opt = { id: 'default', name: 'Основной (default)', isKosta: false };
    const rest = [...calendars].map((c) => ({
        id: c.id,
        name: c.name,
        isKosta: isKostaCalendarName(c.name),
    }));
    const kosta = rest.filter((o) => o.isKosta);
    const other = rest
        .filter((o) => !o.isKosta)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    
    if (kosta.length > 0)
        return [...kosta, def, ...other];
    return [def, ...other];
}

type CallScheduleCalendarSelectProps = {
    value: string;
    onChange: (calendarId: string) => void;
    calendars: readonly CallScheduleCalendarItem[];
    
    disabled?: boolean;
};

const Chevron = () => (<svg className="csched-cal-menu__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <path d="M6 9l6 6 6-6"/>
  </svg>);

export function CallScheduleCalendarSelect({ value, onChange, calendars, disabled = false, }: CallScheduleCalendarSelectProps) {
    const menuId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);
    const options = useMemo(() => buildOptions(calendars), [calendars]);
    const selected = useMemo(() => options.find((o) => o.id === value) ?? options[0], [options, value]);
    const label = selected ? (selected.id === 'default' ? 'Основной (default)' : displayCalendarLabel(selected.name)) : '—';
    const hasKostaInMailbox = useMemo(() => calendars.some((c) => isKostaCalendarName(c.name)), [calendars]);
    const m365Url = useMemo(() => {
        const u = sanitizeHttpsWebUrl(OUTLOOK_CALENDAR_M365);
        return u || OUTLOOK_CALENDAR_M365;
    }, []);
    const placePanel = useCallback(() => {
        const el = triggerRef.current;
        if (!el) {
            setBox(null);
            return;
        }
        const r = el.getBoundingClientRect();
        const w = r.width;
        const maxW = Math.max(0, typeof window !== 'undefined' ? window.innerWidth - 16 : 0);
        const width = maxW > 0 ? Math.min(w, maxW) : w;
        let left = r.left;
        if (typeof window !== 'undefined' && maxW > 0) {
            const rightEdge = r.left + width;
            if (rightEdge > window.innerWidth - 8)
                left = Math.max(8, window.innerWidth - 8 - width);
        }
        setBox({ top: r.bottom + 4, left, width: Math.max(width, 220) });
    }, []);
    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        placePanel();
        window.addEventListener('resize', placePanel);
        window.addEventListener('scroll', placePanel, true);
        return () => {
            window.removeEventListener('resize', placePanel);
            window.removeEventListener('scroll', placePanel, true);
        };
    }, [open, placePanel]);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || panelRef.current?.contains(t))
                return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    const onPick = (id: string) => {
        onChange(id);
        setOpen(false);
    };
    return (<div className="csched-cal-menu">
      <div className="csched-rail__select-wrap">
        <span className="csched-rail__select-label" id={`${menuId}-lbl`}>
          Показать
        </span>
        <button ref={triggerRef} type="button" className="csched-cal-menu__trigger" disabled={disabled} aria-disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${menuId}-list` : undefined} aria-labelledby={`${menuId}-lbl`} onClick={() => {
            if (!disabled)
                setOpen((o) => !o);
        }}>
          <span className="csched-cal-menu__trigger-text">{label}</span>
          <Chevron />
        </button>
      </div>
      {open &&
            box &&
            typeof document !== 'undefined' &&
            createPortal(<div ref={panelRef} id={`${menuId}-list`} className="csched-cal-menu__panel" style={{
                position: 'fixed',
                top: box.top,
                left: box.left,
                width: box.width,
                zIndex: 6000,
            }} role="listbox" aria-label="Календарь для просмотра" onKeyDown={(e) => {
                if (e.key === 'Escape')
                    setOpen(false);
            }}>
          <ul className="csched-cal-menu__ul" role="none">
            {options.map((o) => {
                const isSelected = o.id === value;
                const rowLabel = o.id === 'default' ? 'Основной (default)' : displayCalendarLabel(o.name);
                return (<li key={o.id} role="none" className="csched-cal-menu__li">
                    <button type="button" role="option" aria-selected={isSelected} className={`csched-cal-menu__opt${isSelected ? ' csched-cal-menu__opt--active' : ''}${o.isKosta ? ' csched-cal-menu__opt--kosta' : ''}`} onClick={() => onPick(o.id)}>
                      <span className="csched-cal-menu__opt-label">{rowLabel}</span>
                      {o.isKosta ? (<span className="csched-cal-menu__kosta-badge" aria-hidden>Kosta</span>) : null}
                    </button>
                  </li>);
            })}
          </ul>
        </div>, document.body)}
      <p className="csched-rail__m365-wrap">
        <a href={m365Url} className="csched-rail__m365" target="_blank" rel="noopener noreferrer">
          {hasKostaInMailbox ? 'Открыть Kosta Legal в Microsoft 365' : 'Открыть календарь в Microsoft 365'}
        </a>
      </p>
    </div>);
}


export function CschedCalendarBlockSkeleton() {
    return (<div className="csched-rail__block csched-rail__block--muted csched-rail__block--skeleton" aria-hidden>
      <div className="csched-rail__skel csched-rail__skel--title" role="presentation"/>
      <div className="csched-rail__skel-group">
        <div className="csched-rail__skel csched-rail__skel--label" role="presentation"/>
        <div className="csched-rail__skel csched-rail__skel--select" role="presentation"/>
      </div>
      <div className="csched-rail__skel csched-rail__skel--hint" role="presentation"/>
    </div>);
}
