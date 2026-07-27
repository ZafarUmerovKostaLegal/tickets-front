import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    REPORT_PREVIEW_SCOPE_DEFAULT,
    REPORT_PREVIEW_SCOPE_PALETTE,
} from '../lib/reportPreviewScopePalette';

type PanelBox = {
    top: number;
    left: number;
};

export function ReportPreviewScopeColorPicker({
    value,
    usedColors = [],
    disabled = false,
    title,
    'aria-label': ariaLabel,
    onPick,
}: {
    value: string | null;
    usedColors?: readonly string[];
    disabled?: boolean;
    title?: string;
    'aria-label': string;
    onPick: (color: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState<PanelBox | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const current = (value ?? '').trim().toUpperCase() || null;
    const usedSet = new Set(usedColors.map((c) => c.toUpperCase()));
    const paletteSet = new Set(REPORT_PREVIEW_SCOPE_PALETTE);
    const extraUsed = usedColors
        .map((c) => c.toUpperCase())
        .filter((c) => /^#[0-9A-F]{6}$/.test(c) && !paletteSet.has(c));

    const updateBox = useCallback(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const r = el.getBoundingClientRect();
        const panelW = 196;
        const panelH = 220;
        let left = r.left;
        left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
        let top = r.bottom + 6;
        if (top + panelH > window.innerHeight - 8 && r.top - panelH - 6 > 8)
            top = r.top - panelH - 6;
        setBox({ top, left });
    }, []);

    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        updateBox();
    }, [open, updateBox]);

    useEffect(() => {
        if (!open)
            return;
        const onScroll = () => updateBox();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [open, updateBox]);

    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e: MouseEvent) => {
            const n = e.target as Node;
            if (wrapRef.current?.contains(n) || panelRef.current?.contains(n))
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

    const pick = (color: string) => {
        onPick(color.toUpperCase());
        setOpen(false);
    };

    const panel = open && box && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="tt-rp-scope-picker__panel"
              role="dialog"
              aria-label={ariaLabel}
              style={{ top: box.top, left: box.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="tt-rp-scope-picker__title">Цвет Scope</div>
              <div className="tt-rp-scope-picker__grid" role="listbox" aria-label="Палитра">
                {REPORT_PREVIEW_SCOPE_PALETTE.map((color) => {
                    const on = current === color;
                    const used = usedSet.has(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={`tt-rp-scope-picker__swatch${on ? ' tt-rp-scope-picker__swatch--on' : ''}${used ? ' tt-rp-scope-picker__swatch--used' : ''}`}
                        style={{ background: color }}
                        title={used ? `${color} · уже в отчёте` : color}
                        onClick={() => pick(color)}
                      />
                    );
                })}
              </div>
              {extraUsed.length > 0 ? (
                <div className="tt-rp-scope-picker__used">
                  <div className="tt-rp-scope-picker__used-label">Уже в отчёте</div>
                  <div className="tt-rp-scope-picker__grid tt-rp-scope-picker__grid--used" role="group" aria-label="Уже использованные цвета">
                    {extraUsed.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`tt-rp-scope-picker__swatch${current === color ? ' tt-rp-scope-picker__swatch--on' : ''} tt-rp-scope-picker__swatch--used`}
                        style={{ background: color }}
                        title={`${color} · уже в отчёте`}
                        onClick={() => pick(color)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {!current ? (
                <p className="tt-rp-scope-picker__hint">Выберите цвет из палитры</p>
              ) : (
                <p className="tt-rp-scope-picker__hint">{current}</p>
              )}
            </div>,
            document.body,
          )
        : null;

    return (
      <>
        <div className="tt-rp-scope-picker" ref={wrapRef}>
          <button
            type="button"
            className={`tt-rp-mtable__row-act tt-rp-mtable__row-act--scope${current ? ' tt-rp-mtable__row-act--scope-on' : ''}${open ? ' tt-rp-mtable__row-act--scope-open' : ''}`}
            title={title}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
          >
            <span
              className="tt-rp-mtable__row-act-ico tt-rp-mtable__row-scope-swatch"
              aria-hidden
              style={current ? { background: current } : { background: REPORT_PREVIEW_SCOPE_DEFAULT, opacity: 0.35 }}
            />
          </button>
        </div>
        {panel}
      </>
    );
}
