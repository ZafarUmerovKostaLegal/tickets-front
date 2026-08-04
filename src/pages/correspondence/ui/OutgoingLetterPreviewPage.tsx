import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
import { registerOutgoingLetterDocument } from '../lib/registerOutgoingLetter';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import { IcoEdit, type MockAttachment, type MockLetter } from './CorrespondencePage';
import './CorrespondenceLetterPreview.css';
import './CorrespondencePage.css';

function IcoSave() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}

export function OutgoingLetterPreviewPage() {
    const navigate = useNavigate();
    const { showAlert } = useAppDialog();
    const [draft, setDraft] = useState<OutgoingLetterDraftV1 | null | undefined>(undefined);
    const [busy, setBusy] = useState(false);

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

    const handleRegister = async () => {
        if (!draft)
            return;
        const check = isOutgoingLetterDraftValid(draft.subject, draft.coverModel);
        if (!check.ok) {
            void showAlert({ title: 'Проверьте поля', message: check.message ?? 'Заполните обязательные поля.' });
            return;
        }
        setBusy(true);
        try {
            await registerOutgoingLetterDocument({
                subject: draft.subject,
                coverModel: draft.coverModel,
                letterDateIso: draft.letterDateIso,
                extraFiles: files,
            });
            clearOutgoingLetterDraft();
            void showAlert({ title: 'Исходящее сохранено', message: 'Письмо зарегистрировано в реестре с PDF по шаблону.' });
            navigate(getCorrespondenceOutgoingUrl());
        }
        catch (err) {
            const message = err instanceof Error && err.message
                ? err.message
                : 'Не удалось зарегистрировать исходящее письмо.';
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
                    <button type="button" className="corr-n__btn-secondary" onClick={goRegistry} disabled={busy}>
                        К реестру
                    </button>
                    <button type="button" className="corr-n__btn-secondary" onClick={goBackToEdit} disabled={busy}>
                        <IcoEdit />
                        {' '}
                        Редактировать
                    </button>
                    <button type="button" className="corr-n__btn-primary" onClick={() => void handleRegister()} disabled={busy}>
                        <IcoSave />
                        {' '}
                        {busy ? 'Сохранение…' : 'Зарегистрировать'}
                    </button>
                </>
            )}
        />
    );
}
