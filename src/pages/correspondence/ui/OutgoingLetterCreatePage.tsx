import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCorrespondenceOutgoingUrl, routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { defaultOutgoingLetterCoverModel, isWordLetterFile, openOutgoingLetterInWordOnline, pickOutgoingWordFile } from '../lib/openOutgoingLetterInWord';
import {
    formatAttachmentSizeLabel,
    isOutgoingLetterDraftValid,
    readOutgoingLetterDraft,
    writeOutgoingLetterDraft,
    getOutgoingLetterDraftFiles,
    type OutgoingLetterAttachmentMeta,
} from '../lib/outgoingLetterSession';
import { CORR_SHELL_NAV_TABS } from '../model/constants';
import { submitOutgoingLetterForReview } from '../lib/registerOutgoingLetter';
import { CorrespondenceShell } from './CorrespondenceShell';
import { OutgoingSubmitReviewModal } from './OutgoingSubmitReviewModal';
import { IcoPaperclip } from './CorrespondencePage';
import './CorrespondenceLetterPreview.css';
import './CorrespondencePage.css';
import './CorrespondenceShell.css';

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

function IcoWord() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 13h8M8 17h5" />
        </svg>
    );
}

export function OutgoingLetterCreatePage() {
    const navigate = useNavigate();
    const { showAlert } = useAppDialog();
    const wordFileRef = useRef<HTMLInputElement>(null);
    const extraFileRef = useRef<HTMLInputElement>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [subject, setSubject] = useState('');
    const [letterDateIso, setLetterDateIso] = useState(todayIso);
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel>(defaultOutgoingLetterCoverModel);
    const [files, setFiles] = useState<File[]>([]);
    const [attachmentMeta, setAttachmentMeta] = useState<OutgoingLetterAttachmentMeta[]>([]);
    const [busy, setBusy] = useState(false);
    const [wordBusy, setWordBusy] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);

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

    useEffect(() => {
        if (!hydrated)
            return;
        const t = window.setTimeout(() => {
            const id = writeOutgoingLetterDraft({
                sessionId: sessionId ?? undefined,
                subject,
                letterDateIso,
                coverModel,
                files,
                attachmentMeta,
            });
            setSessionId((prev) => prev ?? id);
        }, 600);
        return () => window.clearTimeout(t);
    }, [hydrated, subject, letterDateIso, coverModel, files, attachmentMeta, sessionId]);

    const goBack = useCallback(() => {
        navigate(getCorrespondenceOutgoingUrl());
    }, [navigate]);

    const letterFile = pickOutgoingWordFile(files);
    const extraFiles = letterFile ? files.filter((f) => f !== letterFile) : files;

    const mergeFiles = (picked: File[], replaceWord: boolean) => {
        const wordPicked = picked.filter(isWordLetterFile);
        const otherPicked = picked.filter((f) => !isWordLetterFile(f));
        let next = [...files];
        if (replaceWord && wordPicked[0]) {
            next = next.filter((f) => !isWordLetterFile(f));
            next = [wordPicked[0], ...next, ...wordPicked.slice(1), ...otherPicked];
        }
        else
            next = [...next, ...picked];
        const nextMeta = next.map((f, i) => ({
            id: `att_${i}_${f.name}`,
            name: f.name,
            sizeLabel: formatAttachmentSizeLabel(f.size),
        }));
        setFiles(next);
        setAttachmentMeta(nextMeta);
        persistDraft(next, nextMeta);
    };

    const handleOpenWord = async () => {
        setWordBusy(true);
        try {
            await openOutgoingLetterInWordOnline(coverModel, { subject });
            void showAlert({
                title: 'Шаблон открыт',
                message: 'Скачан бланк .docx и открыт Word в браузере. В Word: Файл → Открыть → Загрузить — выберите скачанный шаблон. После текста: Файл → Скачать копию, затем прикрепите файл ниже.',
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось открыть Word',
                message: err instanceof Error ? err.message : 'Не получилось собрать шаблон письма.',
            });
        }
        finally {
            setWordBusy(false);
        }
    };

    const openReviewModal = () => {
        const fields = isOutgoingLetterDraftValid(subject, coverModel);
        if (!fields.ok) {
            void showAlert({ title: 'Проверьте поля', message: fields.message ?? 'Заполните обязательные поля.' });
            return;
        }
        if (!letterFile) {
            void showAlert({
                title: 'Нет файла письма',
                message: 'Откройте шаблон в Word Online, напишите письмо и прикрепите сохранённый .docx.',
            });
            return;
        }
        persistDraft(files, attachmentMeta);
        setReviewOpen(true);
    };

    const handleSubmitReview = async (partnerUserId: number, partnerName: string) => {
        setBusy(true);
        try {
            await submitOutgoingLetterForReview({
                subject,
                coverModel,
                letterDateIso,
                partnerUserId,
                extraFiles: files,
            });
            const { clearOutgoingLetterDraft } = await import('../lib/outgoingLetterSession');
            clearOutgoingLetterDraft();
            setReviewOpen(false);
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

    if (!hydrated)
        return null;

    const recipientValue = coverModel.recipientCompany === 'Company Name' ? '' : coverModel.recipientCompany;

    return (
        <>
        <CorrespondenceShell
            activeTab="Написать письмо"
            onBack={goBack}
            fullHeight
            contentClassName="corr-shell__content--word-compose"
            tabs={CORR_SHELL_NAV_TABS.map((tab) => ({
                id: tab.key,
                label: tab.label,
                active: tab.key === 'outgoing',
                onClick: () => navigate(tab.key === 'outgoing' ? getCorrespondenceOutgoingUrl() : `${routes.correspondence}?tab=incoming`),
            }))}
            actions={(
                <>
                    <button type="button" className="corr__btn corr__btn--outline" onClick={goBack} disabled={busy || wordBusy}>
                        Отмена
                    </button>
                    <button type="button" className="corr__btn corr__btn--primary" onClick={openReviewModal} disabled={busy || wordBusy}>
                        <IcoSave />
                        {' '}
                        {busy ? 'Отправка…' : 'Сохранить на проверку'}
                    </button>
                </>
            )}
        >
            <div className="corr-word">
                <section className="corr-word__hero">
                    <h2 className="corr-word__title">Написать письмо в Word</h2>
                    <p className="corr-word__lead">
                        Откроется Word в браузере и скачается бланк Kosta Legal. Напишите текст в Word, сохраните копию
                        и прикрепите файл сюда — письмо уйдёт в исходящие.
                    </p>
                    <button
                        type="button"
                        className="corr__btn corr__btn--primary corr-word__open"
                        onClick={() => void handleOpenWord()}
                        disabled={busy || wordBusy}
                    >
                        <IcoWord />
                        {wordBusy ? 'Готовим шаблон…' : 'Открыть шаблон в Word Online'}
                    </button>
                </section>

                <div className="corr-word__grid">
                    <label className="corr-word__field">
                        <span>Получатель</span>
                        <input
                            type="text"
                            className="corr-modal__input"
                            placeholder="Компания / адресат"
                            value={recipientValue}
                            onChange={(e) => setCoverModel((prev) => ({ ...prev, recipientCompany: e.target.value }))}
                            disabled={busy}
                        />
                    </label>
                    <label className="corr-word__field">
                        <span>Тема</span>
                        <input
                            type="text"
                            className="corr-modal__input"
                            placeholder="Краткое описание письма"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={busy}
                        />
                    </label>
                </div>

                <section className={`corr-word__drop${letterFile ? ' corr-word__drop--ready' : ''}`}>
                    <input
                        ref={wordFileRef}
                        type="file"
                        accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        hidden
                        onChange={(e) => {
                            const picked = Array.from(e.target.files ?? []);
                            e.target.value = '';
                            if (picked.length)
                                mergeFiles(picked, true);
                        }}
                    />
                    <p className="corr-word__drop-label">Письмо из Word</p>
                    {letterFile ? (
                        <p className="corr-word__file">
                            {letterFile.name}
                            {' · '}
                            {formatAttachmentSizeLabel(letterFile.size)}
                        </p>
                    ) : (
                        <p className="corr-word__drop-hint">Прикрепите сохранённый .docx — это и есть письмо для реестра.</p>
                    )}
                    <button type="button" className="corr__btn corr__btn--outline" onClick={() => wordFileRef.current?.click()} disabled={busy}>
                        {letterFile ? 'Заменить файл' : 'Прикрепить .docx'}
                    </button>
                </section>

                <section className="corr-word__extras">
                    <input
                        ref={extraFileRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => {
                            const picked = Array.from(e.target.files ?? []);
                            e.target.value = '';
                            if (picked.length)
                                mergeFiles(picked, false);
                        }}
                    />
                    <button type="button" className="corr__btn corr__btn--outline" onClick={() => extraFileRef.current?.click()} disabled={busy}>
                        <IcoPaperclip />
                        {' '}
                        Доп. вложения
                        {extraFiles.length > 0 ? ` (${extraFiles.length})` : ''}
                    </button>
                    {extraFiles.length > 0 ? (
                        <ul className="corr-word__extra-list">
                            {extraFiles.map((f) => (
                                <li key={`${f.name}-${f.size}`}>{f.name}</li>
                            ))}
                        </ul>
                    ) : null}
                </section>
            </div>
        </CorrespondenceShell>
        <OutgoingSubmitReviewModal
            open={reviewOpen}
            onClose={() => { if (!busy) setReviewOpen(false); }}
            onSubmit={(partnerUserId, partnerName) => { void handleSubmitReview(partnerUserId, partnerName); }}
            submitPending={busy}
        />
        </>
    );
}
