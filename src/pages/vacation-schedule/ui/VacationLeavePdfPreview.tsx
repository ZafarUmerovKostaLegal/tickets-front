import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { VacationLeaveRequestApi } from '@entities/vacation';
import { VacationLeaveApplicationLetter } from './VacationLeaveApplicationLetter';
import './VacationDocLightbox.css';

type Props = {
    request: VacationLeaveRequestApi;
    onClose: () => void;
};

export function VacationLeavePdfPreview({ request, onClose }: Props) {
    const title = `Заявление · #${request.id}`;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    return createPortal(
        <div
            className="vac-doc-lb"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div className="vac-doc-lb__frame vac-doc-lb__frame--pdf vac-doc-lb__frame--letter" onClick={(e) => e.stopPropagation()}>
                <div className="vac-doc-lb__head">
                    <span className="vac-doc-lb__title" title={title}>{title}</span>
                    <div className="vac-doc-lb__actions">
                        <button
                            type="button"
                            className="vac-doc-lb__btn"
                            onClick={() => window.print()}
                            title="Печать или сохранить как PDF"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Печать / PDF
                        </button>
                        <button type="button" className="vac-doc-lb__close" onClick={onClose} aria-label="Закрыть">
                            ×
                        </button>
                    </div>
                </div>
                <div className="vac-doc-lb__body vac-doc-lb__body--letter">
                    <VacationLeaveApplicationLetter request={request} />
                </div>
            </div>
        </div>,
        document.body,
    );
}
