import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, } from 'react';
type PanelBox = {
    top: number;
    left: number;
    width: number;
};
export type ReportPreviewFilterPopoverProps = {
    title?: string;
    'aria-label': string;
    children: ReactNode;
};

export function ReportPreviewFilterPopover({ title, 'aria-label': ariaLabel, children, }: ReportPreviewFilterPopoverProps) {
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState<PanelBox | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const updateBox = useCallback(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const r = el.getBoundingClientRect();
        const w = Math.min(320, Math.max(220, window.innerWidth - 24));
        let left = r.right - w;
        left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
        setBox({ top: r.bottom + 6, left, width: w });
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
        const onScroll = () => {
            updateBox();
        };
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
    const panel = open && box && typeof document !== 'undefined'
        ? createPortal(<div ref={panelRef} className="tt-rp-xlf__panel--portal" role="dialog" aria-label={ariaLabel} style={{
                position: 'fixed',
                top: box.top,
                left: box.left,
                width: box.width,
                zIndex: 6000,
            }} onMouseDown={(e) => e.stopPropagation()}>
            {children}
          </div>, document.body)
        : null;
    return (<>
      <div className={`tt-rp-xlf${open ? ' tt-rp-xlf--open' : ''}`} ref={wrapRef}>
        <button type="button" className="tt-rp-xlf__trigger" aria-expanded={open} aria-haspopup="true" aria-label={ariaLabel} title={title} onClick={() => setOpen((o) => !o)}>
          <span className="tt-rp-xlf__chev" aria-hidden>
            ▼
          </span>
        </button>
      </div>
      {panel}
    </>);
}
