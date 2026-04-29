import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import {
    TIME_BRIEF_COLUMN_LABELS,
    TIME_BRIEF_COLUMN_ORDER_DEFAULT,
    type TimeBriefColumnId,
} from '../lib/timeBriefReportColumns';
import { ReportPreviewColumnPickerDualPane } from './ReportPreviewColumnPickerDualPane';

export type BriefColumnPickerProps = {
    
    includeActionsColumn: boolean;
    activeOrderedIds: TimeBriefColumnId[];
    onChange: (next: TimeBriefColumnId[]) => void;
};

function BriefColumnPickerContent(p: BriefColumnPickerProps & {
    toolbarSlot: 'inline' | 'modal-header';
}) {
    const pool = TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter((id) => (p.includeActionsColumn ? true : id !== 'actions'));

    const toolbar = p.toolbarSlot === 'inline' ? (<div className="tt-rp-brief-columns__head">
          <h3 className="tt-rp-brief-columns__title">Колонки отчёта</h3>
          <button type="button" className="tt-rp-brief-columns__all" onClick={() => p.onChange([...pool])}>
            Показать все
          </button>
        </div>) : null;

    return (<>
      {toolbar}
      <ReportPreviewColumnPickerDualPane<TimeBriefColumnId>
        pool={pool}
        labels={TIME_BRIEF_COLUMN_LABELS}
        activeOrderedIds={p.activeOrderedIds}
        onChange={p.onChange}
      />
    </>);
}


export function ReportPreviewTimeBriefColumnConstructor(p: BriefColumnPickerProps) {
    return (<section className="tt-rp-brief-columns" aria-label="Конструктор колонок отчёта">
      <BriefColumnPickerContent {...p} toolbarSlot="inline"/>
    </section>);
}

type ModalProps = BriefColumnPickerProps & {
    open: boolean;
    onClose: () => void;
};

export function ReportPreviewTimeBriefColumnsModal({ open, onClose, includeActionsColumn, activeOrderedIds, onChange, }: ModalProps) {
    const uid = useId();
    const pool = TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter((id) => (includeActionsColumn ? true : id !== 'actions'));
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

    return createPortal(<div className="tt-rp-brief-columns-modal-ov" role="presentation" onClick={onClose}>
      <div className="tt-rp-brief-columns-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-cols-title`} onClick={(e) => e.stopPropagation()}>
        <div className="tt-rp-brief-columns-modal__head">
          <h2 id={`${uid}-cols-title`} className="tt-rp-brief-columns-modal__title">
            Колонки отчёта
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
          <BriefColumnPickerContent includeActionsColumn={includeActionsColumn} activeOrderedIds={activeOrderedIds} onChange={onChange} toolbarSlot="modal-header"/>
        </div>
        <div className="tt-rp-brief-columns-modal__foot">
          <button type="button" className="tt-rp-brief-columns-modal__done" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>, document.body);
}
