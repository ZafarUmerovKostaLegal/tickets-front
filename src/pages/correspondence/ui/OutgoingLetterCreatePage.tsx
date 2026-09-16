import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
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
    pickOutgoingWordFile,
} from '../lib/openOutgoingLetterInWord';
import {
    clearOutgoingLetterDraft,
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

function IcoEditorFullscreen({ exit }: { exit: boolean }) {
    if (exit) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
        );
    }
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
    );
}

function fileToUint8Array(file: File): Promise<Uint8Array> {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
}

function hasComposeContent(
    subject: string,
    recipientCompany: string,
    files: File[],
    dirty: boolean,
): boolean {
    if (dirty)
        return true;
    if (subject.trim())
        return true;
    const recipient = recipientCompany.trim();
    if (recipient && recipient !== 'Company Name')
        return true;
    return files.length > 0;
}

export function OutgoingLetterCreatePage() {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAppDialog();
    const extraFileRef = useRef<HTMLInputElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<OutgoingLetterDocxEditorHandle>(null);
    const allowLeaveRef = useRef(false);
    const leavePromptOpenRef = useRef(false);
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
    const [editorFullscreen, setEditorFullscreen] = useState(false);
    const browserSupportsEditor = useMemo(() => canRunInBrowserDocxEditor(), []);
    const useInBrowserEditor = browserSupportsEditor && !editorCrashed;

    const needsLeaveConfirm = hydrated && hasComposeContent(
        subject,
        coverModel.recipientCompany,
        files,
        dirty,
    );

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

    useEffect(() => {
        document.documentElement.classList.toggle('corr-docx-fs', editorFullscreen);
        return () => document.documentElement.classList.remove('corr-docx-fs');
    }, [editorFullscreen]);

    useEffect(() => {
        if (!editorFullscreen)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape')
                return;
            const active = document.activeElement;
            if (active instanceof Element && active.closest('[role="dialog"], .corr-modal, .app-dialog'))
                return;
            e.preventDefault();
            setEditorFullscreen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [editorFullscreen]);

    useEffect(() => {
        if (!needsLeaveConfirm)
            return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (allowLeaveRef.current)
                return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [needsLeaveConfirm]);

    const blocker = useBlocker(({ currentLocation, nextLocation }) => {
        if (allowLeaveRef.current || !needsLeaveConfirm)
            return false;
        return currentLocation.pathname !== nextLocation.pathname
            || currentLocation.search !== nextLocation.search;
    });

    useEffect(() => {
        if (blocker.state !== 'blocked' || leavePromptOpenRef.current)
            return;
        leavePromptOpenRef.current = true;
        void (async () => {
            const leave = await showConfirm({
                title: 'Покинуть страницу?',
                message: dirty
                    ? 'В письме есть несохранённые правки. Сохраните черновик или подтвердите выход без сохранения.'
                    : 'Вы уверены, что хотите уйти со страницы написания письма?',
                confirmLabel: 'Уйти',
                cancelLabel: 'Остаться',
            });
            leavePromptOpenRef.current = false;
            if (leave) {
                allowLeaveRef.current = true;
                blocker.proceed();
            }
            else {
                blocker.reset();
            }
        })();
    }, [blocker, dirty, showConfirm]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount hydrate
    }, [hydrated]);

    const confirmLeavePage = useCallback(async (): Promise<boolean> => {
        if (allowLeaveRef.current || !needsLeaveConfirm)
            return true;
        return showConfirm({
            title: 'Покинуть страницу?',
            message: dirty
                ? 'В письме есть несохранённые правки. Сохраните черновик или подтвердите выход без сохранения.'
                : 'Вы уверены, что хотите уйти со страницы написания письма?',
            confirmLabel: 'Уйти',
            cancelLabel: 'Остаться',
        });
    }, [dirty, needsLeaveConfirm, showConfirm]);

    const goBack = useCallback(() => {
        void (async () => {
            const ok = await confirmLeavePage();
            if (!ok)
                return;
            allowLeaveRef.current = true;
            navigate(getCorrespondenceOutgoingUrl());
        })();
    }, [confirmLeavePage, navigate]);

    const letterFile = pickOutgoingWordFile(files);
    const extraFiles = letterFile ? files.filter((f) => f !== letterFile) : files;

    const mergeExtraFiles = (picked: File[]) => {
        const otherPicked = picked.filter((f) => !isWordLetterFile(f));
        if (!otherPicked.length)
            return;
        const next = [...files.filter((f) => !isWordLetterFile(f) || f === letterFile), ...otherPicked];
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
                    'Загрузите готовый .docx или откройте страницу в поддерживаемом браузере.',
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

    const handleSaveDraft = async () => {
        if (useInBrowserEditor && (!documentBytes || !editorReady)) {
            void showAlert({
                title: 'Редактор ещё загружается',
                message: 'Дождитесь появления бланка письма, затем сохраните черновик.',
            });
            return;
        }
        setBusy(true);
        try {
            await syncEditorIntoDraftFiles();
            showToast({ message: 'Черновик сохранён', variant: 'success' });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось сохранить черновик',
                message: err instanceof Error ? err.message : 'Ошибка сохранения .docx.',
            });
        }
        finally {
            setBusy(false);
        }
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
                message: `${DOCX_EDITOR_BROWSER_HINT} Нажмите «Загрузить .docx».`,
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
            clearOutgoingLetterDraft();
            setDirty(false);
            setReviewOpen(false);
            invalidateCorrespondencePartnerAttention();
            allowLeaveRef.current = true;
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
    const actionsDisabled = busy || templateBusy;

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
                    <button type="button" className="corr__btn corr__btn--outline" onClick={goBack} disabled={actionsDisabled}>
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="corr__btn corr__btn--outline"
                        onClick={() => { void handleSaveDraft(); }}
                        disabled={actionsDisabled || (useInBrowserEditor && !documentBytes)}
                    >
                        <IcoSave />
                        {' '}
                        Сохранить черновик
                    </button>
                    <button
                        type="button"
                        className="corr__btn corr__btn--primary"
                        onClick={() => { void openReviewModal(); }}
                        disabled={actionsDisabled || !documentBytes}
                    >
                        <IcoSave />
                        {' '}
                        {busy ? 'Подготовка…' : 'Сохранить на согласование'}
                    </button>
                </>
            )}
        >
            <div className={`corr-word corr-word--docx${editorFullscreen ? ' corr-word--docx-fs' : ''}`}>
                <div className="corr-word__toolbar" aria-label="Параметры письма">
                    <label className="corr-word__field corr-word__field--inline">
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
                    <label className="corr-word__field corr-word__field--inline">
                        <span>
                            Тема
                            {dirty ? <span className="corr-word__dirty" title="Есть несохранённые правки"> ●</span> : null}
                        </span>
                        <input
                            type="text"
                            className="corr-modal__input"
                            placeholder="Краткое описание письма"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={busy}
                        />
                    </label>
                    <div
                        className="corr-word__toolbar-actions"
                        onMouseDown={(e) => {
                            const el = e.target as HTMLElement | null;
                            if (el?.closest('button'))
                                e.preventDefault();
                        }}
                    >
                        <button
                            type="button"
                            className="corr__btn corr__btn--outline"
                            disabled={actionsDisabled}
                            onClick={() => { void handleRebuildTemplate(); }}
                        >
                            {templateBusy ? 'Сборка…' : 'Пересобрать бланк'}
                        </button>
                        <button
                            type="button"
                            className="corr__btn corr__btn--outline"
                            disabled={actionsDisabled}
                            onClick={() => importFileRef.current?.click()}
                        >
                            Загрузить .docx
                        </button>
                        <button
                            type="button"
                            className="corr__btn corr__btn--outline"
                            onClick={() => extraFileRef.current?.click()}
                            disabled={busy}
                        >
                            <IcoPaperclip />
                            {' '}
                            Вложения
                            {extraFiles.length > 0 ? ` (${extraFiles.length})` : ''}
                        </button>
                        <button
                            type="button"
                            className="corr__btn corr__btn--outline"
                            onClick={() => { void handleSaveDraft(); }}
                            disabled={actionsDisabled || (useInBrowserEditor && !documentBytes)}
                        >
                            <IcoSave />
                            {' '}
                            Черновик
                        </button>
                        <button
                            type="button"
                            className="corr-word__fs-btn"
                            onClick={() => setEditorFullscreen((v) => !v)}
                            title={editorFullscreen ? 'Свернуть редактор (Esc)' : 'Расширить на весь экран'}
                            aria-label={editorFullscreen ? 'Свернуть редактор' : 'Расширить на весь экран'}
                            aria-pressed={editorFullscreen}
                        >
                            <IcoEditorFullscreen exit={editorFullscreen} />
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
                    </div>
                    {extraFiles.length > 0 ? (
                        <ul className="corr-word__extra-list corr-word__extra-list--toolbar">
                            {extraFiles.map((f) => (
                                <li key={`${f.name}-${f.size}`}>{f.name}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                {editorFullscreen ? (
                    <div className="corr-word__fs-chrome" role="toolbar" aria-label="Полноэкранный режим">
                        <span className="corr-word__fs-chrome-title">
                            {editorTitle}
                            {dirty ? <span className="corr-word__dirty" title="Есть несохранённые правки"> ●</span> : null}
                        </span>
                        <div className="corr-word__fs-chrome-actions">
                            <button
                                type="button"
                                className="corr__btn corr__btn--outline"
                                onClick={() => { void handleSaveDraft(); }}
                                disabled={actionsDisabled || (useInBrowserEditor && !documentBytes)}
                            >
                                <IcoSave />
                                {' '}
                                Черновик
                            </button>
                            <button
                                type="button"
                                className="corr__btn corr__btn--primary"
                                onClick={() => { void openReviewModal(); }}
                                disabled={actionsDisabled || !documentBytes}
                            >
                                {busy ? 'Подготовка…' : 'На согласование'}
                            </button>
                            <button
                                type="button"
                                className="corr-word__fs-btn"
                                onClick={() => setEditorFullscreen(false)}
                                title="Свернуть редактор (Esc)"
                                aria-label="Свернуть редактор"
                                aria-pressed
                            >
                                <IcoEditorFullscreen exit />
                            </button>
                        </div>
                    </div>
                ) : null}

                <section className="corr-word__editor-wrap" aria-label="Редактор письма">
                    {!useInBrowserEditor ? (
                        <div className="corr-word__editor-fallback" role="status">
                            <p>{DOCX_EDITOR_BROWSER_HINT}</p>
                            <p>
                                {letterFile
                                    ? `Готов файл: ${letterFile.name}. Можно отправлять на согласование.`
                                    : 'Пока нет загруженного .docx — нажмите «Загрузить .docx».'}
                            </p>
                            <button
                                type="button"
                                className="corr__btn corr__btn--outline"
                                disabled={actionsDisabled}
                                onClick={() => importFileRef.current?.click()}
                            >
                                Загрузить .docx
                            </button>
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
                                        disabled={actionsDisabled}
                                        onClick={() => importFileRef.current?.click()}
                                    >
                                        Загрузить .docx
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
                                    onSaveRequest={() => { void handleSaveDraft(); }}
                                />
                            </Suspense>
                        </OutgoingLetterDocxErrorBoundary>
                    )}
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
