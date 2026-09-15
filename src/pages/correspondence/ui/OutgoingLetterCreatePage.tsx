import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCorrespondenceOutgoingUrl, routes } from '@shared/config';
import { showToast, useAppDialog } from '@shared/ui';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import {
    buildOutgoingLetterDocxBytes,
    outgoingLetterDocxFileFromBytes,
} from '../lib/buildOutgoingLetterDocx';
import {
    canRunInBrowserDocxEditor,
    DOCX_EDITOR_BROWSER_HINT,
} from '../lib/docxEditorSupport';
import {
    defaultOutgoingLetterCoverModel,
    isWordLetterFile,
    openOutgoingLetterInWordOnline,
    pickOutgoingWordFile,
} from '../lib/openOutgoingLetterInWord';
import {
    formatAttachmentSizeLabel,
    isOutgoingLetterDraftValid,
    readOutgoingLetterDraft,
    writeOutgoingLetterDraft,
    getOutgoingLetterDraftFiles,
    type OutgoingLetterAttachmentMeta,
} from '../lib/outgoingLetterSession';
import { CORR_SHELL_NAV_TABS } from '../model/constants';
import { invalidateCorrespondencePartnerAttention } from '@entities/correspondence';
import { submitOutgoingLetterForReview } from '../lib/registerOutgoingLetter';
import { CorrespondenceShell } from './CorrespondenceShell';
import { OutgoingLetterDocxErrorBoundary } from './OutgoingLetterDocxErrorBoundary';
import { OutgoingSubmitReviewModal } from './OutgoingSubmitReviewModal';
import type { OutgoingLetterDocxEditorHandle } from './outgoingLetterDocxEditorHandle';
import { IcoPaperclip } from './CorrespondencePage';
import './CorrespondenceLetterPreview.css';
import './CorrespondencePage.css';
import './CorrespondenceShell.css';

const OutgoingLetterDocxEditor = lazy(async () => {
    const m = await import('./OutgoingLetterDocxEditor');
    return { default: m.OutgoingLetterDocxEditor };
});

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

function fileToUint8Array(file: File): Promise<Uint8Array> {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
}

export function OutgoingLetterCreatePage() {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAppDialog();
    const extraFileRef = useRef<HTMLInputElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<OutgoingLetterDocxEditorHandle>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [subject, setSubject] = useState('');
    const [letterDateIso, setLetterDateIso] = useState(todayIso);
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel>(defaultOutgoingLetterCoverModel);
    const [files, setFiles] = useState<File[]>([]);
    const [attachmentMeta, setAttachmentMeta] = useState<OutgoingLetterAttachmentMeta[]>([]);
    const [busy, setBusy] = useState(false);
    const [templateBusy, setTemplateBusy] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);
    const [templateKey, setTemplateKey] = useState(() => `tpl_${Date.now()}`);
    const [editorReady, setEditorReady] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [editorCrashed, setEditorCrashed] = useState(false);
    const browserSupportsEditor = useMemo(() => canRunInBrowserDocxEditor(), []);
    const useInBrowserEditor = browserSupportsEditor && !editorCrashed;

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

    const applyDocumentBytes = useCallback((bytes: Uint8Array, remount: boolean) => {
        setDocumentBytes(bytes);
        setDirty(false);
        setEditorReady(false);
        if (remount)
            setTemplateKey(`tpl_${Date.now()}`);
    }, []);

    const loadBlankTemplate = useCallback(async (model: InvoiceCoverLetterModel, remount: boolean) => {
        setTemplateBusy(true);
        try {
            const bytes = await buildOutgoingLetterDocxBytes(model, {});
            applyDocumentBytes(bytes, remount);
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось собрать бланк',
                message: err instanceof Error ? err.message : 'Ошибка подготовки шаблона письма.',
            });
        }
        finally {
            setTemplateBusy(false);
        }
    }, [applyDocumentBytes, showAlert]);

    useEffect(() => {
        if (!hydrated)
            return;
        let cancelled = false;
        void (async () => {
            const draftFiles = sessionId ? getOutgoingLetterDraftFiles(sessionId) : files;
            const existingWord = pickOutgoingWordFile(draftFiles.length ? draftFiles : files);
            if (existingWord) {
                try {
                    const bytes = await fileToUint8Array(existingWord);
                    if (!cancelled)
                        applyDocumentBytes(bytes, true);
                    return;
                }
                catch {
                    /* fall through to blank */
                }
            }
            if (!cancelled)
                await loadBlankTemplate(coverModel, true);
        })();
        return () => {
            cancelled = true;
        };
        // Initial open only — later rebuilds go through explicit actions.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount hydrate
    }, [hydrated]);

    const goBack = useCallback(() => {
        navigate(getCorrespondenceOutgoingUrl());
    }, [navigate]);

    const letterFile = pickOutgoingWordFile(files);
    const extraFiles = letterFile ? files.filter((f) => f !== letterFile) : files;

    const mergeExtraFiles = (picked: File[]) => {
        const otherPicked = picked.filter((f) => !isWordLetterFile(f));
        if (!otherPicked.length)
            return;
        const next = [...files.filter((f) => !isWordLetterFile(f) || f === letterFile), ...otherPicked];
        // Keep current letter file if present
        const word = pickOutgoingWordFile(files);
        const withWord = word && !next.includes(word) ? [word, ...next] : next;
        const nextMeta = withWord.map((f, i) => ({
            id: `att_${i}_${f.name}`,
            name: f.name,
            sizeLabel: formatAttachmentSizeLabel(f.size),
        }));
        setFiles(withWord);
        setAttachmentMeta(nextMeta);
        persistDraft(withWord, nextMeta);
    };

    const captureEditorFile = async (): Promise<File> => {
        const buf = await editorRef.current?.save();
        if (!buf || buf.byteLength < 64)
            throw new Error('Не удалось сохранить документ из редактора. Дождитесь загрузки бланка.');
        return outgoingLetterDocxFileFromBytes(buf, subject, letterDateIso);
    };

    const syncEditorIntoDraftFiles = async (): Promise<File[]> => {
        if (!useInBrowserEditor) {
            const word = pickOutgoingWordFile(files);
            if (!word) {
                throw new Error(
                    'Загрузите готовый .docx (после Word Online) или откройте страницу в поддерживаемом браузере.',
                );
            }
            return files;
        }
        const word = await captureEditorFile();
        const extras = files.filter((f) => !isWordLetterFile(f));
        const next = [word, ...extras];
        const nextMeta = next.map((f, i) => ({
            id: `att_${i}_${f.name}`,
            name: f.name,
            sizeLabel: formatAttachmentSizeLabel(f.size),
        }));
        setFiles(next);
        setAttachmentMeta(nextMeta);
        persistDraft(next, nextMeta);
        setDirty(false);
        return next;
    };

    const handleRebuildTemplate = async () => {
        if (dirty) {
            const ok = await showConfirm({
                title: 'Пересобрать бланк?',
                message: 'Текст в редакторе будет заменён новым бланком Kosta Legal с текущими полями «Получатель» и датой.',
            });
            if (!ok)
                return;
        }
        await loadBlankTemplate(coverModel, true);
        showToast({ message: 'Бланк обновлён', variant: 'success' });
    };

    const handleImportDocx = async (file: File) => {
        if (!isWordLetterFile(file)) {
            void showAlert({ title: 'Нужен файл Word', message: 'Выберите документ .docx.' });
            return;
        }
        try {
            const bytes = await fileToUint8Array(file);
            applyDocumentBytes(bytes, true);
            const extras = files.filter((f) => !isWordLetterFile(f));
            const next = [file, ...extras];
            const nextMeta = next.map((f, i) => ({
                id: `att_${i}_${f.name}`,
                name: f.name,
                sizeLabel: formatAttachmentSizeLabel(f.size),
            }));
            setFiles(next);
            setAttachmentMeta(nextMeta);
            persistDraft(next, nextMeta);
            showToast({ message: 'Документ загружен в редактор', variant: 'success' });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось открыть файл',
                message: err instanceof Error ? err.message : 'Ошибка чтения .docx',
            });
        }
    };

    const handleOpenWordOnline = async () => {
        setTemplateBusy(true);
        try {
            await openOutgoingLetterInWordOnline(coverModel, { subject });
            void showAlert({
                title: 'Word Online',
                message: 'Скачан бланк и открыт Word в браузере. После правок скачайте копию и нажмите «Загрузить .docx» на этой странице.',
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось открыть Word',
                message: err instanceof Error ? err.message : 'Не получилось собрать шаблон письма.',
            });
        }
        finally {
            setTemplateBusy(false);
        }
    };

    const openReviewModal = async () => {
        const fields = isOutgoingLetterDraftValid(subject, coverModel);
        if (!fields.ok) {
            void showAlert({ title: 'Проверьте поля', message: fields.message ?? 'Заполните обязательные поля.' });
            return;
        }
        if (useInBrowserEditor && (!documentBytes || !editorReady)) {
            void showAlert({
                title: 'Редактор ещё загружается',
                message: 'Дождитесь появления бланка письма, затем отправьте на согласование.',
            });
            return;
        }
        if (!useInBrowserEditor && !pickOutgoingWordFile(files)) {
            void showAlert({
                title: 'Нужен файл письма',
                message: `${DOCX_EDITOR_BROWSER_HINT} Откройте Word Online, сохраните копию и нажмите «Загрузить .docx».`,
            });
            return;
        }
        setBusy(true);
        try {
            await syncEditorIntoDraftFiles();
            setReviewOpen(true);
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось сохранить письмо',
                message: err instanceof Error ? err.message : 'Ошибка экспорта .docx из редактора.',
            });
        }
        finally {
            setBusy(false);
        }
    };

    const handleSubmitReview = async (partnerUserId: number, partnerName: string) => {
        setBusy(true);
        try {
            const nextFiles = await syncEditorIntoDraftFiles();
            await submitOutgoingLetterForReview({
                subject,
                coverModel,
                letterDateIso,
                partnerUserId,
                extraFiles: nextFiles,
            });
            const { clearOutgoingLetterDraft } = await import('../lib/outgoingLetterSession');
            clearOutgoingLetterDraft();
            setReviewOpen(false);
            invalidateCorrespondencePartnerAttention();
            void showAlert({
                title: 'Отправлено на согласование',
                message: `Письмо отправлено партнёру «${partnerName}». После одобрения распечатайте, подпишите и загрузите скан.`,
            });
            navigate(getCorrespondenceOutgoingUrl());
        }
        catch (err) {
            const message = err instanceof Error && err.message
                ? err.message
                : 'Не удалось отправить письмо на согласование.';
            void showAlert({ title: 'Не удалось сохранить', message });
        }
        finally {
            setBusy(false);
        }
    };

    if (!hydrated)
        return null;

    const recipientValue = coverModel.recipientCompany === 'Company Name' ? '' : coverModel.recipientCompany;
    const editorTitle = subject.trim() || 'Исходящее письмо';

    return (
        <>
        <CorrespondenceShell
            activeTab="Написать письмо"
            onBack={goBack}
            fullHeight
            contentClassName="corr-shell__content--docx-compose"
            tabs={CORR_SHELL_NAV_TABS.map((tab) => ({
                id: tab.key,
                label: tab.label,
                active: tab.key === 'outgoing',
                onClick: () => navigate(tab.key === 'outgoing' ? getCorrespondenceOutgoingUrl() : `${routes.correspondence}?tab=incoming`),
            }))}
            actions={(
                <>
                    <button type="button" className="corr__btn corr__btn--outline" onClick={goBack} disabled={busy || templateBusy}>
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="corr__btn corr__btn--primary"
                        onClick={() => { void openReviewModal(); }}
                        disabled={busy || templateBusy || !documentBytes}
                    >
                        <IcoSave />
                        {' '}
                        {busy ? 'Подготовка…' : 'Сохранить на согласование'}
                    </button>
                </>
            )}
        >
            <div className="corr-word corr-word--docx">
                <section className="corr-word__hero">
                    <div className="corr-word__hero-text">
                        <h2 className="corr-word__title">
                            Написать письмо
                            {dirty ? <span className="corr-word__dirty" title="Есть несохранённые правки"> ●</span> : null}
                        </h2>
                        <p className="corr-word__lead">
                            {useInBrowserEditor
                                ? 'Редактируйте бланк Kosta Legal прямо здесь. После текста нажмите «Сохранить на согласование» и выберите партнёра.'
                                : `${DOCX_EDITOR_BROWSER_HINT} Откройте бланк в Word Online, затем загрузите готовый .docx сюда.`}
                        </p>
                    </div>
                    <div className="corr-word__hero-actions">
                        <button
                            type="button"
                            className="corr__btn corr__btn--outline"
                            disabled={busy || templateBusy}
                            onClick={() => { void handleRebuildTemplate(); }}
                        >
                            {templateBusy ? 'Сборка…' : 'Пересобрать бланк'}
                        </button>
                        <button
                            type="button"
                            className="corr__btn corr__btn--outline"
                            disabled={busy || templateBusy}
                            onClick={() => importFileRef.current?.click()}
                        >
                            Загрузить .docx
                        </button>
                        <button
                            type="button"
                            className="corr__btn corr__btn--ghost"
                            disabled={busy || templateBusy}
                            onClick={() => { void handleOpenWordOnline(); }}
                        >
                            Word Online
                        </button>
                        <input
                            ref={importFileRef}
                            type="file"
                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            hidden
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file)
                                    void handleImportDocx(file);
                            }}
                        />
                    </div>
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

                <section className="corr-word__editor-wrap" aria-label="Редактор письма">
                    {!useInBrowserEditor ? (
                        <div className="corr-word__editor-fallback" role="status">
                            <p>{DOCX_EDITOR_BROWSER_HINT}</p>
                            <p>
                                {letterFile
                                    ? `Готов файл: ${letterFile.name}. Можно отправлять на согласование.`
                                    : 'Пока нет загруженного .docx — используйте «Word Online», затем «Загрузить .docx».'}
                            </p>
                            <div className="corr-word__hero-actions">
                                <button
                                    type="button"
                                    className="corr__btn corr__btn--outline"
                                    disabled={busy || templateBusy}
                                    onClick={() => { void handleOpenWordOnline(); }}
                                >
                                    Word Online
                                </button>
                                <button
                                    type="button"
                                    className="corr__btn corr__btn--outline"
                                    disabled={busy || templateBusy}
                                    onClick={() => importFileRef.current?.click()}
                                >
                                    Загрузить .docx
                                </button>
                            </div>
                        </div>
                    ) : !documentBytes || templateBusy ? (
                        <div className="corr-word__editor-loading" role="status">
                            Готовим бланк письма…
                        </div>
                    ) : (
                        <OutgoingLetterDocxErrorBoundary
                            fallback={(
                                <div className="corr-word__editor-fallback" role="alert">
                                    <p>Встроенный редактор не смог загрузиться в этом браузере.</p>
                                    <p>{DOCX_EDITOR_BROWSER_HINT}</p>
                                    <button
                                        type="button"
                                        className="corr__btn corr__btn--outline"
                                        disabled={busy || templateBusy}
                                        onClick={() => { void handleOpenWordOnline(); }}
                                    >
                                        Открыть в Word Online
                                    </button>
                                </div>
                            )}
                            onError={() => setEditorCrashed(true)}
                        >
                            <Suspense fallback={<div className="corr-word__editor-loading" role="status">Загрузка редактора…</div>}>
                                <OutgoingLetterDocxEditor
                                    ref={editorRef}
                                    documentBytes={documentBytes}
                                    title={editorTitle}
                                    templateKey={templateKey}
                                    disabled={busy}
                                    onReady={() => setEditorReady(true)}
                                    onChange={() => setDirty(true)}
                                    onSaveRequest={() => { void openReviewModal(); }}
                                />
                            </Suspense>
                        </OutgoingLetterDocxErrorBoundary>
                    )}
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
                                mergeExtraFiles(picked);
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
