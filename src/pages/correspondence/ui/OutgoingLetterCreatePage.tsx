import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCorrespondenceOutgoingUrl, routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { mockLetterToCoverModel, coverModelToMockLetter } from '../lib/correspondenceCoverLetterModel';
import {
    formatAttachmentSizeLabel,
    isOutgoingLetterDraftValid,
    readOutgoingLetterDraft,
    writeOutgoingLetterDraft,
    getOutgoingLetterDraftFiles,
    type OutgoingLetterAttachmentMeta,
} from '../lib/outgoingLetterSession';
import { registerOutgoingLetterDocument } from '../lib/registerOutgoingLetter';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import { IcoEye, IcoPaperclip, type MockAttachment, type MockLetter } from './CorrespondencePage';
import './CorrespondenceLetterPreview.css';
import './CorrespondencePage.css';

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function IcoSave() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}

export function OutgoingLetterCreatePage() {
    const navigate = useNavigate();
    const { showAlert } = useAppDialog();
    const fileRef = useRef<HTMLInputElement>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [subject, setSubject] = useState('');
    const [letterDateIso, setLetterDateIso] = useState(todayIso);
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel>(() =>
        mockLetterToCoverModel({
            body: '',
            counterparty: '',
            date: todayIso(),
        }),
    );
    const [files, setFiles] = useState<File[]>([]);
    const [attachmentMeta, setAttachmentMeta] = useState<OutgoingLetterAttachmentMeta[]>([]);
    const [busy, setBusy] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const draft = readOutgoingLetterDraft();
        if (draft) {
            setSessionId(draft.sessionId);
            setSubject(draft.subject);
            setLetterDateIso(draft.letterDateIso);
            setCoverModel(draft.coverModel);
            setAttachmentMeta(draft.attachmentMeta);
            setFiles(getOutgoingLetterDraftFiles(draft.sessionId));
        }
        setHydrated(true);
    }, []);

    const patchCoverModel = useCallback((patch: Partial<InvoiceCoverLetterModel>) => {
        setCoverModel((prev) => ({ ...prev, ...patch }));
    }, []);

    const draftLetter: MockLetter = useMemo(() => {
        const attachments: MockAttachment[] = attachmentMeta.map((a) => ({
            id: a.id,
            name: a.name,
            size: a.sizeLabel,
        }));
        return coverModelToMockLetter(coverModel, {
            id: sessionId ?? 'draft',
            docType: 'letter',
            subject: subject.trim() || '(без темы)',
            date: letterDateIso,
            status: 'draft',
            registryNumber: 'ИСХ-черновик',
            attachments,
        }) as MockLetter;
    }, [attachmentMeta, coverModel, letterDateIso, sessionId, subject]);

    const persistDraft = useCallback((nextFiles: File[], nextMeta: OutgoingLetterAttachmentMeta[]) => {
        const id = writeOutgoingLetterDraft({
            sessionId: sessionId ?? undefined,
            subject,
            letterDateIso,
            coverModel,
            files: nextFiles,
            attachmentMeta: nextMeta,
        });
        setSessionId(id);
        return id;
    }, [coverModel, letterDateIso, sessionId, subject]);

    const goBack = useCallback(() => {
        navigate(getCorrespondenceOutgoingUrl());
    }, [navigate]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (!picked.length)
            return;
        const nextFiles = [...files, ...picked];
        const nextMeta = [
            ...attachmentMeta,
            ...picked.map((f, i) => ({
                id: `att_${Date.now()}_${i}_${f.name}`,
                name: f.name,
                sizeLabel: formatAttachmentSizeLabel(f.size),
            })),
        ];
        setFiles(nextFiles);
        setAttachmentMeta(nextMeta);
        persistDraft(nextFiles, nextMeta);
    };

    const handlePreview = () => {
        const check = isOutgoingLetterDraftValid(subject, coverModel);
        if (!check.ok) {
            void showAlert({ title: 'Проверьте поля', message: check.message ?? 'Заполните обязательные поля.' });
            return;
        }
        persistDraft(files, attachmentMeta);
        navigate(routes.correspondenceOutgoingPreview);
    };

    const handleRegister = async () => {
        const check = isOutgoingLetterDraftValid(subject, coverModel);
        if (!check.ok) {
            void showAlert({ title: 'Проверьте поля', message: check.message ?? 'Заполните обязательные поля.' });
            return;
        }
        setBusy(true);
        try {
            persistDraft(files, attachmentMeta);
            await registerOutgoingLetterDocument({
                subject,
                coverModel,
                letterDateIso,
                extraFiles: files,
            });
            const { clearOutgoingLetterDraft } = await import('../lib/outgoingLetterSession');
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

    if (!hydrated)
        return null;

    return (
        <CorrespondenceLetterWorkspace
            letter={draftLetter}
            coverModel={coverModel}
            editable
            onCoverModelChange={patchCoverModel}
            navbarTab="compose"
            onBack={goBack}
            toolbarSubject={(
                <label className="corr-doc-preview__subject-field">
                    <span className="corr-doc-preview__subject-label">Тема</span>
                    <input
                        type="text"
                        className="corr-doc-preview__subject-input"
                        placeholder="Краткое описание письма"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        disabled={busy}
                    />
                </label>
            )}
            navbarActions={(
                <>
                    <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
                    <button
                        type="button"
                        className="corr-n__btn-secondary"
                        onClick={() => fileRef.current?.click()}
                        title="Прикрепить файл"
                        disabled={busy}
                    >
                        <IcoPaperclip />
                        {' '}
                        <span>
                            Вложения
                            {attachmentMeta.length > 0 ? ` (${attachmentMeta.length})` : ''}
                        </span>
                    </button>
                    <button type="button" className="corr-n__btn-secondary" onClick={goBack} disabled={busy}>
                        Отмена
                    </button>
                    <button type="button" className="corr-n__btn-secondary" onClick={handlePreview} disabled={busy}>
                        <IcoEye />
                        {' '}
                        Предпросмотр
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
