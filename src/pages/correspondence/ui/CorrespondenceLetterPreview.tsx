import { useMemo } from 'react';
import {
    STATUS_META, MOCK_PARTNERS,
    IcoAlert, IcoCheck, IcoCross, IcoSend, IcoEdit,
    type MockLetter, type MockPartner,
} from './CorrespondencePage';
import { mockLetterToCoverModel } from '../lib/correspondenceCoverLetterModel';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import './CorrespondenceLetterPreview.css';

function IcoPrint() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polyline points="6 9 6 2 18 2 18 9"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
    </svg>);
}

function IcoDownload() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>);
}

type Props = {
    letter: MockLetter;
    mode: 'employee' | 'partner';
    loading?: boolean;
    onBack: () => void;
    onSendToReview?: () => void;
    onApprove?: () => void;
    onReject?: () => void;
    onEdit?: () => void;
};

export function CorrespondenceLetterPreview({
    letter,
    mode,
    loading,
    onBack,
    onSendToReview,
    onApprove,
    onReject,
    onEdit,
}: Props) {
    const sm = STATUS_META[letter.status];
    const coverModel = useMemo(() => mockLetterToCoverModel(letter), [letter]);

    const canSendToReview = mode === 'employee' && (letter.status === 'draft' || letter.status === 'rejected');
    const canEdit = mode === 'employee' && (letter.status === 'draft' || letter.status === 'rejected');
    const canPartnerAct = mode === 'partner' && letter.status === 'pending_review';

    const partnerObj: MockPartner | undefined = letter.partnerId
        ? MOCK_PARTNERS.find(p => p.id === letter.partnerId)
        : undefined;

    const statusNote = useMemo(() => {
        if (letter.status === 'pending_review') {
            return partnerObj
                ? `На проверке у ${partnerObj.name}`
                : 'Ожидает проверки партнёра';
        }
        if (letter.status === 'rejected' && letter.rejectionReason) {
            return `Отклонено: ${letter.rejectionReason}`;
        }
        if (letter.status === 'approved') {
            return letter.partnerName
                ? `Подтверждено — ${letter.partnerName}`
                : 'Документ подтверждён';
        }
        return null;
    }, [letter, partnerObj]);

    const statusTone = letter.status === 'pending_review'
        ? 'pending'
        : letter.status === 'rejected'
            ? 'rejected'
            : letter.status === 'approved'
                ? 'approved'
                : null;

    return (
        <CorrespondenceLetterWorkspace
            letter={letter}
            coverModel={coverModel}
            loading={loading}
            navbarTab="preview"
            onBack={onBack}
            statusNote={statusNote}
            statusTone={statusTone}
            statusIcon={letter.status === 'rejected' ? <IcoAlert /> : undefined}
            navbarActions={(
                <>
                    <span className={`corr-n__badge ${sm.cls}`}>{sm.label}</span>
                    {canEdit && onEdit && (
                        <button type="button" className="corr-n__btn-secondary" onClick={onEdit}>
                            <IcoEdit /> <span>Редактировать</span>
                        </button>
                    )}
                    {canSendToReview && onSendToReview && (
                        <button type="button" className="corr-n__btn-primary" onClick={onSendToReview}>
                            <IcoSend />
                            <span>{letter.status === 'rejected' ? 'Отправить повторно' : 'На проверку'}</span>
                        </button>
                    )}
                    {canPartnerAct && onReject && (
                        <button type="button" className="corr-n__btn-danger" onClick={onReject}>
                            <IcoCross /> <span>Отклонить</span>
                        </button>
                    )}
                    {canPartnerAct && onApprove && (
                        <button type="button" className="corr-n__btn-success" onClick={onApprove}>
                            <IcoCheck /> <span>Подтвердить</span>
                        </button>
                    )}
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn" onClick={() => window.print()} title="Печать">
                        <IcoPrint /> Печать
                    </button>
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn" title="Скачать PDF">
                        <IcoDownload /> PDF
                    </button>
                </>
            )}
        />
    );
}