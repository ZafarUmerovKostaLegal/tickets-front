import { createPortal } from 'react-dom';
import type { AttachmentPreviewModel } from '@entities/expenses/lib/buildAttachmentPreview';
export type ExpenseAttachmentPreviewModalProps = {
    isOpen: boolean;
    fileName: string;
    loading: boolean;
    error: string | null;
    model: AttachmentPreviewModel | null;
    canOpenExternal: boolean;
    onClose: () => void;
    onOpenExternal: () => void;
};
export function ExpenseAttachmentPreviewModal({ isOpen, fileName, loading, error, model, canOpenExternal, onClose, onOpenExternal, }: ExpenseAttachmentPreviewModalProps) {
    if (!isOpen)
        return null;
    return createPortal(<div className="exp-attach-preview-backdrop" role="presentation">
      <div className="exp-attach-preview" role="dialog" aria-modal aria-labelledby="exp-attach-preview-title" onClick={e => e.stopPropagation()}>
        <div className="exp-attach-preview__hd">
          <h2 id="exp-attach-preview-title" className="exp-attach-preview__title">
            {fileName}
          </h2>
          <button type="button" className="exp-attach-preview__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="exp-attach-preview__body">
          {loading && (<div className="exp-attach-preview__loading" aria-busy>
              <span className="exp-attach-preview__spinner" aria-hidden/>
              <span>Загрузка превью…</span>
            </div>)}
          {!loading && error && (<p className="exp-attach-preview__err" role="alert">
              {error}
            </p>)}
          {!loading && !error && model?.type === 'image' && (<div className="exp-attach-preview__img-wrap">
              <img src={model.objectUrl} alt="" className="exp-attach-preview__img"/>
            </div>)}
          {!loading && !error && model?.type === 'pdf' && (<iframe title={fileName} src={model.objectUrl} className="exp-attach-preview__iframe"/>)}
          {!loading && !error && model?.type === 'text' && (<pre className="exp-attach-preview__pre">{model.text}</pre>)}
          {!loading && !error && model?.type === 'sheets' && (<div className="exp-attach-preview__sheets">
              {model.truncatedNote && <p className="exp-attach-preview__note">{model.truncatedNote}</p>}
              {model.sheets.map(sheet => (<div key={sheet.name} className="exp-attach-preview__sheet">
                  <p className="exp-attach-preview__sheet-name">{sheet.name}</p>
                  <div className="exp-attach-preview__table-wrap">
                    <table className="exp-attach-preview__table">
                      <tbody>
                        {sheet.rows.map((row, ri) => (<tr key={ri}>
                            {row.map((cell, ci) => (<td key={ci}>{cell}</td>))}
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>))}
            </div>)}
          {!loading && !error && model?.type === 'unsupported' && (<div className="exp-attach-preview__unsupported">
              <p>{model.hint}</p>
            </div>)}
        </div>

        <div className="exp-attach-preview__ft">
          {canOpenExternal && (<button type="button" className="exp-panel-btn exp-panel-btn--outline" onClick={onOpenExternal}>
              В новой вкладке
            </button>)}
          <button type="button" className="exp-panel-btn exp-panel-btn--primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>, document.body);
}
