import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import {
    TIME_FULL_COLUMN_LABELS,
    TIME_FULL_COLUMN_ORDER_DEFAULT,
    type TimeFullColumnId,
} from '../lib/timeFullReportColumns';
import { ReportPreviewColumnPickerDualPane } from './ReportPreviewColumnPickerDualPane';

type Props = {
    open: boolean;
    onClose: () => void;
    activeOrderedIds: TimeFullColumnId[];
    onChange: (next: TimeFullColumnId[]) => void;
};

export function ReportPreviewTimeFullColumnsModal({ open, onClose, activeOrderedIds, onChange, }: Props) {
    const uid = useId();
    const pool = TIME_FULL_COLUMN_ORDER_DEFAULT;
    const includeAll = () => {
        onChange([...pool]);
    };

    useEffect(() => {
        if (!open)
            return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', h);
        return () => { document.removeEventListener('keydown', h); };
    }, [open, onClose]);

    if (!open)
        return null;

    return createPortal(<div className="tt-rp-brief-columns-modal-ov" role="presentation">
      <div className="tt-rp-brief-columns-modal tt-rp-brief-columns-modal--full-cols" role="dialog" aria-modal="true" aria-labelledby={`${uid}-full-cols-title`} onClick={(e) => e.stopPropagation()}>
        <div className="tt-rp-brief-columns-modal__head">
          <h2 id={`${uid}-full-cols-title`} className="tt-rp-brief-columns-modal__title">
            Колонки полного отчёта
          </h2>
          <div className="tt-rp-brief-columns-modal__head-actions">
            <button type="button" className="tt-rp-brief-columns__all tt-rp-brief-columns__all--modal" onClick={includeAll}>
              Показать все
            </button>
            <button type="button" className="tt-rp-brief-columns-modal__x" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
        </div>
        <div className="tt-rp-brief-columns-modal__body">
          <ReportPreviewColumnPickerDualPane<TimeFullColumnId>
            pool={pool}
            labels={TIME_FULL_COLUMN_LABELS}
            activeOrderedIds={activeOrderedIds}
            onChange={onChange}
          />
        </div>
        <div className="tt-rp-brief-columns-modal__foot">
          <button type="button" className="tt-rp-brief-columns-modal__done" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>, document.body);
}
