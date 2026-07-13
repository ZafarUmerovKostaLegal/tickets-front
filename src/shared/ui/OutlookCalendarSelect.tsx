import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    buildOutlookCalendarOptions,
    displayOutlookCalendarLabel,
    type OutlookCalendarOption,
} from './outlookCalendarSelectUtils';
import './OutlookCalendarSelect.css';

const Chevron = () => (
    <svg className="ocs__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9l6 6 6-6"/>
    </svg>
);

export type OutlookCalendarSelectProps = {
    value: string;
    onChange: (calendarId: string) => void;
    calendars: readonly OutlookCalendarOption[];
    showLabel: string;
    listAriaLabel: string;
    defaultCalendarLabel: string;
    allCalendarsId?: string;
    allCalendarsLabel?: string;
    disabled?: boolean;
    layout?: 'inline' | 'block';
    minPanelWidth?: number;
};

export function OutlookCalendarSelect({
    value,
    onChange,
    calendars,
    showLabel,
    listAriaLabel,
    defaultCalendarLabel,
    allCalendarsId,
    allCalendarsLabel,
    disabled = false,
    layout = 'inline',
    minPanelWidth = 220,
}: OutlookCalendarSelectProps) {
    const menuId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

    const options = useMemo(
        () => buildOutlookCalendarOptions(
            calendars,
            defaultCalendarLabel,
            allCalendarsId && allCalendarsLabel
                ? { id: allCalendarsId, label: allCalendarsLabel }
                : undefined,
        ),
        [calendars, defaultCalendarLabel, allCalendarsId, allCalendarsLabel],
    );
    const selected = useMemo(() => options.find((o) => o.id === value) ?? options[0], [options, value]);
    const label = selected
        ? selected.id === 'default'
            ? defaultCalendarLabel
            : selected.id === allCalendarsId
                ? allCalendarsLabel ?? selected.name
                : displayOutlookCalendarLabel(selected.name)
        : '—';

    const placePanel = useCallback(() => {
        const el = triggerRef.current;
        if (!el) {
            setBox(null);
            return;
        }
        const r = el.getBoundingClientRect();
        const w = Math.max(r.width, minPanelWidth);
        const maxW = Math.max(0, typeof window !== 'undefined' ? window.innerWidth - 16 : 0);
        const width = maxW > 0 ? Math.min(w, maxW) : w;
        let left = r.left;
        if (typeof window !== 'undefined' && maxW > 0) {
            const rightEdge = r.left + width;
            if (rightEdge > window.innerWidth - 8)
                left = Math.max(8, window.innerWidth - 8 - width);
        }
        setBox({ top: r.bottom + 4, left, width });
    }, [minPanelWidth]);

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
            const target = e.target as Node;
            if (triggerRef.current?.contains(target) || panelRef.current?.contains(target))
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

    return (
        <div className={`ocs${layout === 'block' ? ' ocs--block' : ''}`}>
            <span className="ocs__label" id={`${menuId}-lbl`}>{showLabel}</span>
            <button
                ref={triggerRef}
                type="button"
                className="ocs__trigger"
                disabled={disabled}
                aria-disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? `${menuId}-list` : undefined}
                aria-labelledby={`${menuId}-lbl`}
                onClick={() => {
                    if (!disabled)
                        setOpen((v) => !v);
                }}
            >
                <span className="ocs__trigger-text">{label}</span>
                <Chevron />
            </button>
            {open && box && typeof document !== 'undefined'
                ? createPortal(
                    <div
                        ref={panelRef}
                        id={`${menuId}-list`}
                        className="ocs__panel"
                        style={{
                            position: 'fixed',
                            top: box.top,
                            left: box.left,
                            width: box.width,
                            zIndex: 6000,
                        }}
                        role="listbox"
                        aria-label={listAriaLabel}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape')
                                setOpen(false);
                        }}
                    >
                        <ul className="ocs__ul" role="none">
                            {options.map((o) => {
                                const isSelected = o.id === value;
                                const rowLabel = o.id === 'default'
                                    ? defaultCalendarLabel
                                    : o.id === allCalendarsId
                                        ? allCalendarsLabel ?? o.name
                                        : displayOutlookCalendarLabel(o.name);
                                return (
                                    <li key={o.id} role="none" className="ocs__li">
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            className={`ocs__opt${isSelected ? ' ocs__opt--active' : ''}${o.isKosta ? ' ocs__opt--kosta' : ''}`}
                                            onClick={() => onPick(o.id)}
                                        >
                                            <span className="ocs__opt-label">{rowLabel}</span>
                                            {o.isKosta ? (
                                                <span className="ocs__kosta-badge" aria-hidden>Kosta</span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
}
