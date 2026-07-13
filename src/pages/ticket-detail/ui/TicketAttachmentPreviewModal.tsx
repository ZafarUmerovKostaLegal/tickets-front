import { createPortal } from 'react-dom';
import type { AttachmentPreviewModel } from '@entities/expenses/lib/buildAttachmentPreview';
import { useI18n } from '@shared/i18n';

export type TicketAttachmentPreviewModalProps = {
    isOpen: boolean;
    fileName: string;
    loading: boolean;
    error: string | null;
    model: AttachmentPreviewModel | null;
    canOpenExternal: boolean;
    onClose: () => void;
    onOpenExternal: () => void;
};

export function TicketAttachmentPreviewModal({
    isOpen,
    fileName,
    loading,
    error,
    model,
    canOpenExternal,
    onClose,
    onOpenExternal,
}: TicketAttachmentPreviewModalProps) {
    const { t } = useI18n();
    if (!isOpen)
        return null;
    return createPortal(
        <div className="td-attach-preview-backdrop" role="presentation" onClick={onClose}>
            <div
                className="td-attach-preview"
                role="dialog"
                aria-modal="true"
                aria-labelledby="td-attach-preview-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="td-attach-preview__hd">
                    <h2 id="td-attach-preview-title" className="td-attach-preview__title">
                        {fileName}
                    </h2>
                    <button type="button" className="td-attach-preview__close" onClick={onClose} aria-label={t('ticketDetailPage.closePreview')}>
                        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="td-attach-preview__body">
                    {loading && (
                        <div className="td-attach-preview__loading" aria-busy="true">
                            <span className="td-attach-preview__spinner" aria-hidden />
                            <span>{t('ticketDetailPage.previewLoading')}</span>
                        </div>
                    )}
                    {!loading && error && (
                        <p className="td-attach-preview__err" role="alert">
                            {error}
                        </p>
                    )}
                    {!loading && !error && model?.type === 'image' && (
                        <div className="td-attach-preview__img-wrap">
                            <img src={model.objectUrl} alt="" className="td-attach-preview__img" />
                        </div>
                    )}
                    {!loading && !error && model?.type === 'pdf' && (
                        <iframe title={fileName} src={model.objectUrl} className="td-attach-preview__iframe" />
                    )}
                    {!loading && !error && model?.type === 'text' && (
                        <pre className="td-attach-preview__pre">{model.text}</pre>
                    )}
                    {!loading && !error && model?.type === 'sheets' && (
                        <div className="td-attach-preview__sheets">
                            {model.truncatedNote && <p className="td-attach-preview__note">{model.truncatedNote}</p>}
                            {model.sheets.map((sheet) => (
                                <div key={sheet.name} className="td-attach-preview__sheet">
                                    <p className="td-attach-preview__sheet-name">{sheet.name}</p>
                                    <div className="td-attach-preview__table-wrap">
                                        <table className="td-attach-preview__table">
                                            <tbody>
                                                {sheet.rows.map((row, ri) => (
                                                    <tr key={ri}>
                                                        {row.map((cell, ci) => (
                                                            <td key={ci}>{cell}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!loading && !error && model?.type === 'unsupported' && (
                        <div className="td-attach-preview__unsupported">
                            <p>{model.hint}</p>
                        </div>
                    )}
                </div>

                <div className="td-attach-preview__ft">
                    {canOpenExternal && (
                        <button type="button" className="td__attachment-btn td__attachment-btn--ghost" onClick={onOpenExternal}>
                            {t('ticketDetailPage.openInNewTab')}
                        </button>
                    )}
                    <button type="button" className="td__attachment-btn" onClick={onClose}>
                        {t('ticketDetailPage.closePreview')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
