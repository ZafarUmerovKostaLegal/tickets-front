import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { VacationMarkCell, VacationUiLegendItem } from '../lib/vacationScheduleModel';
import './VacationDayEditPopover.css';
type Props = {
    open: boolean;
    x: number;
    y: number;
    legendItems: VacationUiLegendItem[];
    current: VacationMarkCell | undefined;
    saving: boolean;
    context?: {
        employeeName: string;
        dateLabel: string;
    };
    onPickKindCode: (kindCode: number) => void;
    onClear: () => void;
    onClose: () => void;
};
export function VacationDayEditPopover({ open, x, y, legendItems, current, saving, context, onPickKindCode, onClear, onClose, }: Props) {
    const uid = useId();
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDoc);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDoc);
        };
    }, [open, onClose]);
    if (!open)
        return null;
    const pad = 12;
    const maxW = 220;
    const left = Math.max(pad, Math.min(x, window.innerWidth - maxW - pad));
    const top = Math.max(pad, Math.min(y + 6, window.innerHeight - 280));
    return createPortal(<div ref={ref} className="vac-day-pop" style={{ position: 'fixed', left, top, zIndex: 10050 }} role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
      {context && (<div className="vac-day-pop__context">
          <span className="vac-day-pop__ctx-date">{context.dateLabel}</span>
          <span className="vac-day-pop__ctx-name">{context.employeeName}</span>
        </div>)}
      <button type="button" className="vac-day-pop__close" onClick={onClose} aria-label="Закрыть" title="Закрыть">
        ✕
      </button>
      <div id={`${uid}-title`} className="vac-day-pop__title">
        Вид отсутствия
      </div>
      <ul className="vac-day-pop__list">
        {legendItems.map((it) => {
            const isCurrent = current?.kindCode === it.kindCode;
            return (<li key={`${it.kindCode}-${it.kind}`}>
              <button type="button" className={['vac-day-pop__opt', isCurrent && 'vac-day-pop__opt--current'].filter(Boolean).join(' ')} disabled={saving} onClick={() => onPickKindCode(it.kindCode)}>
                <span className="vac-day-pop__swatch" style={{ backgroundColor: it.color }} aria-hidden/>
                {it.label}
              </button>
            </li>);
        })}
      </ul>
      {current != null && current.absenceDayId != null && (<button type="button" className="vac-day-pop__clear" disabled={saving} onClick={() => onClear()}>
          Снять отметку
        </button>)}
    </div>, document.body);
}
