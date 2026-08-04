import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { invalidateCorrespondencePartnerAttention } from '@entities/correspondence';
import { getCorrespondenceOutgoingUrl, routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';
import { coverModelToMockLetter } from '../lib/correspondenceCoverLetterModel';
import {
    clearOutgoingLetterDraft,
    getOutgoingLetterDraftFiles,
    isOutgoingLetterDraftValid,
    readOutgoingLetterDraft,
    type OutgoingLetterDraftV1,
} from '../lib/outgoingLetterSession';
import { submitOutgoingLetterForReview } from '../lib/registerOutgoingLetter';
import { downloadOutgoingLetterPdf } from '../lib/buildOutgoingLetterPdf';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import { OutgoingSubmitReviewModal } from './OutgoingSubmitReviewModal';
import { IcoEdit, type MockAttachment, type MockLetter } from './CorrespondencePage';
import './CorrespondenceLetterPreview.css';
import './CorrespondencePage.css';

function IcoSend() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    );
}

function IcoDownload() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

export function OutgoingLetterPreviewPage() {
    const navigate = useNavigate();
    const { showAlert } = useAppDialog();
    const [draft, setDraft] = useState<OutgoingLetterDraftV1 | null | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);

    useEffect(() => {
        setDraft(readOutgoingLetterDraft());
    }, []);

    const files = useMemo(
        () => (draft ? getOutgoingLetterDraftFiles(draft.sessionId) : []),
        [draft],
    );

    const letter: MockLetter | null = useMemo(() => {
        if (!draft)
            return null;
        const attachments: MockAttachment[] = draft.attachmentMeta.map((a) => ({
            id: a.id,
            name: a.name,
            size: a.sizeLabel,
        }));
        return coverModelToMockLetter(draft.coverModel, {
            id: draft.sessionId,
            docType: 'letter',
            subject: draft.subject.trim() || '(без темы)',
            date: draft.letterDateIso,
            status: 'draft',
            registryNumber: 'ИСХ-черновик',
            attachments,
        }) as MockLetter;
    }, [draft]);

    const goBackToEdit = useCallback(() => {
        navigate(routes.correspondenceOutgoingCreate);
    }, [navigate]);

    const goRegistry = useCallback(() => {
        navigate(getCorrespondenceOutgoingUrl());
    }, [navigate]);

    const openReviewModal = () => {
        if (!draft)
            return;
        const check = isOutgoingLetterDraftValid(draft.subject, draft.coverModel);
        if (!check.ok) {
            void showAlert({ title: 'Проверьте поля', message: check.message ?? 'Заполните обязательные поля.' });
            return;
        }
        setReviewOpen(true);
    };

    const handleDownloadPdf = async () => {
        if (!draft)
            return;
        setPdfBusy(true);
        try {
            await downloadOutgoingLetterPdf(draft.coverModel, {
                subject: draft.subject,
                dateIso: draft.letterDateIso,
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось скачать PDF',
                message: err instanceof Error ? err.message : 'Ошибка формирования файла',
            });
        }
        finally {
            setPdfBusy(false);
        }
    };

    const handleSubmitReview = async (partnerUserId: number, partnerName: string) => {
        if (!draft)
            return;
        setBusy(true);
        try {
            await submitOutgoingLetterForReview({
                subject: draft.subject,
                coverModel: draft.coverModel,
                letterDateIso: draft.letterDateIso,
                partnerUserId,
                extraFiles: files,
            });
            clearOutgoingLetterDraft();
            setReviewOpen(false);
            invalidateCorrespondencePartnerAttention();
            void showAlert({
                title: 'Отправлено на проверку',
                message: `Письмо отправлено партнёру «${partnerName}». После подтверждения оно будет зарегистрировано автоматически.`,
            });
            navigate(getCorrespondenceOutgoingUrl());
        }
        catch (err) {
            const message = err instanceof Error && err.message
                ? err.message
                : 'Не удалось отправить письмо на проверку.';
            void showAlert({ title: 'Не удалось сохранить', message });
        }
        finally {
            setBusy(false);
        }
    };

    if (draft === undefined)
        return null;
    if (!draft || !letter)
        return <Navigate to={routes.correspondenceOutgoingCreate} replace />;

    return (
        <>
            <CorrespondenceLetterWorkspace
                letter={letter}
                coverModel={draft.coverModel}
                editable={false}
                navbarTab="preview"
                onBack={goBackToEdit}
                toolbarSubject={(
                    <span className="tt-inv-preview__pdf-toolbar-export" title={draft.subject}>
                        {draft.subject}
                    </span>
                )}
                navbarActions={(
                    <>
                        <button type="button" className="corr-n__btn-secondary" onClick={goRegistry} disabled={busy || pdfBusy}>
                            К реестру
                        </button>
                        <button
                            type="button"
                            className="corr-n__btn-secondary"
                            onClick={() => { void handleDownloadPdf(); }}
                            disabled={busy || pdfBusy}
                        >
                            <IcoDownload />
                            {' '}
                            {pdfBusy ? 'PDF…' : 'Скачать PDF'}
                        </button>
                        <button type="button" className="corr-n__btn-secondary" onClick={goBackToEdit} disabled={busy || pdfBusy}>
                            <IcoEdit />
                            {' '}
                            Редактировать
                        </button>
                        <button type="button" className="corr-n__btn-primary" onClick={openReviewModal} disabled={busy || pdfBusy}>
                            <IcoSend />
                            {' '}
                            {busy ? 'Отправка…' : 'На проверку'}
                        </button>
                    </>
                )}
            />
            <OutgoingSubmitReviewModal
                open={reviewOpen}
                onClose={() => { if (!busy) setReviewOpen(false); }}
                onSubmit={(partnerUserId, partnerName) => { void handleSubmitReview(partnerUserId, partnerName); }}
                submitPending={busy}
            />
        </>
    );
}
