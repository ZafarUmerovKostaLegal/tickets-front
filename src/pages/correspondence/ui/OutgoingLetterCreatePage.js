import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { getCorrespondenceOutgoingUrl, routes } from '@shared/config';
import { showToast, useAppDialog } from '@shared/ui';
import { buildOutgoingLetterDocxBytes, outgoingLetterDocxFileFromBytes, } from '../lib/buildOutgoingLetterDocx';
import { canRunInBrowserDocxEditor, DOCX_EDITOR_BROWSER_HINT, } from '../lib/docxEditorSupport';
import { defaultOutgoingLetterCoverModel, isWordLetterFile, pickOutgoingWordFile, } from '../lib/openOutgoingLetterInWord';
import { clearOutgoingLetterDraft, formatAttachmentSizeLabel, isOutgoingLetterDraftValid, newOutgoingLetterCommentId, readOutgoingLetterDraft, resolveOutgoingCounterparty, writeOutgoingLetterDraft, getOutgoingLetterDraftFiles, } from '../lib/outgoingLetterSession';
import { CORR_SHELL_NAV_TABS } from '../model/constants';
import { correspondenceErrorMessage, createOutgoingDraft, invalidateCorrespondencePartnerAttention, isCorrespondenceHttpError, mintCorrespondenceDownloadQr, uploadCorrespondenceAttachment, } from '@entities/correspondence';
import { submitOutgoingLetterForReview } from '../lib/registerOutgoingLetter';
import { useCurrentUser } from '@shared/hooks';
import { CorrespondenceShell } from './CorrespondenceShell';
import { OutgoingLetterCommentsPane } from './OutgoingLetterCommentsPane';
import { OutgoingLetterDocxErrorBoundary } from './OutgoingLetterDocxErrorBoundary';
import { OutgoingSubmitReviewModal } from './OutgoingSubmitReviewModal';
import { IcoPaperclip } from './CorrespondencePage';
import './CorrespondenceLetterPreview.css';
import './CorrespondencePage.css';
import './CorrespondenceShell.css';
const OutgoingLetterDocxEditor = lazy(async () => {
    const m = await import('./OutgoingLetterDocxEditor');
    return { default: m.OutgoingLetterDocxEditor };
});
function todayIso() {
    return new Date().toISOString().slice(0, 10);
}
function IcoSave() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" }), _jsx("polyline", { points: "17 21 17 13 7 13 7 21" }), _jsx("polyline", { points: "7 3 7 8 15 8" })] }));
}
function IcoEditorFullscreen({ exit }) {
    if (exit) {
        return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "4 14 10 14 10 20" }), _jsx("polyline", { points: "20 10 14 10 14 4" }), _jsx("line", { x1: "14", y1: "10", x2: "21", y2: "3" }), _jsx("line", { x1: "3", y1: "21", x2: "10", y2: "14" })] }));
    }
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "15 3 21 3 21 9" }), _jsx("polyline", { points: "9 21 3 21 3 15" }), _jsx("line", { x1: "21", y1: "3", x2: "14", y2: "10" }), _jsx("line", { x1: "3", y1: "21", x2: "10", y2: "14" })] }));
}
function IcoComments() {
    return (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }));
}
function IcoMore() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, children: [_jsx("circle", { cx: "5", cy: "12", r: "1.75" }), _jsx("circle", { cx: "12", cy: "12", r: "1.75" }), _jsx("circle", { cx: "19", cy: "12", r: "1.75" })] }));
}
function fileToUint8Array(file) {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
}
function hasComposeContent(subject, recipientCompany, files, dirty) {
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
    const { user } = useCurrentUser();
    const extraFileRef = useRef(null);
    const importFileRef = useRef(null);
    const editorRef = useRef(null);
    const moreMenuRef = useRef(null);
    const allowLeaveRef = useRef(false);
    const leavePromptOpenRef = useRef(false);
    const pendingComposeRef = useRef(null);
    const [sessionId, setSessionId] = useState(null);
    const [serverDocumentId, setServerDocumentId] = useState(null);
    const [downloadQrUrl, setDownloadQrUrl] = useState(null);
    const [subject, setSubject] = useState('');
    const [letterDateIso, setLetterDateIso] = useState(todayIso);
    const [coverModel, setCoverModel] = useState(defaultOutgoingLetterCoverModel);
    const [files, setFiles] = useState([]);
    const [attachmentMeta, setAttachmentMeta] = useState([]);
    const [comments, setComments] = useState([]);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [commentsComposing, setCommentsComposing] = useState(false);
    const [composeQuote, setComposeQuote] = useState('');
    const [activeCommentId, setActiveCommentId] = useState(null);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [templateBusy, setTemplateBusy] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [documentBytes, setDocumentBytes] = useState(null);
    const [templateKey, setTemplateKey] = useState(() => `tpl_${Date.now()}`);
    const [editorReady, setEditorReady] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [editorCrashed, setEditorCrashed] = useState(false);
    const [editorFullscreen, setEditorFullscreen] = useState(false);
    const browserSupportsEditor = useMemo(() => canRunInBrowserDocxEditor(), []);
    const useInBrowserEditor = browserSupportsEditor && !editorCrashed;
    const commentAuthorName = (user?.display_name || user?.email || 'Пользователь').trim();
    const openCommentsCount = comments.filter((c) => !c.resolved).length;
    const needsLeaveConfirm = hydrated && hasComposeContent(subject, coverModel.recipientCompany, files, dirty);
    useEffect(() => {
        const draft = readOutgoingLetterDraft();
        if (draft) {
            setSessionId(draft.sessionId);
            setServerDocumentId(draft.serverDocumentId ?? null);
            setSubject(draft.subject);
            setLetterDateIso(draft.letterDateIso);
            setCoverModel(draft.coverModel);
            setAttachmentMeta(draft.attachmentMeta);
            setFiles(getOutgoingLetterDraftFiles(draft.sessionId));
            setComments(draft.comments ?? []);
            if ((draft.comments ?? []).length > 0)
                setCommentsOpen(true);
        }
        setHydrated(true);
    }, []);
    useEffect(() => {
        document.documentElement.classList.toggle('corr-docx-fs', editorFullscreen);
        return () => document.documentElement.classList.remove('corr-docx-fs');
    }, [editorFullscreen]);
    useEffect(() => {
        if (!moreMenuOpen)
            return;
        const onPointerDown = (e) => {
            const root = moreMenuRef.current;
            if (root && !root.contains(e.target))
                setMoreMenuOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape')
                setMoreMenuOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [moreMenuOpen]);
    useEffect(() => {
        if (!editorFullscreen)
            return;
        const onKey = (e) => {
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
        const onBeforeUnload = (e) => {
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
    const persistDraft = useCallback((nextFiles, nextMeta, nextComments = comments, nextServerDocumentId = serverDocumentId) => {
        const id = writeOutgoingLetterDraft({
            sessionId: sessionId ?? undefined,
            subject,
            letterDateIso,
            coverModel,
            files: nextFiles,
            attachmentMeta: nextMeta,
            comments: nextComments,
            serverDocumentId: nextServerDocumentId,
        });
        setSessionId(id);
        return id;
    }, [comments, coverModel, letterDateIso, serverDocumentId, sessionId, subject]);
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
                comments,
                serverDocumentId,
            });
            setSessionId((prev) => prev ?? id);
        }, 600);
        return () => window.clearTimeout(t);
    }, [hydrated, subject, letterDateIso, coverModel, files, attachmentMeta, comments, sessionId, serverDocumentId]);
    const ensureServerDraftAndQr = useCallback(async () => {
        const openDraft = async () => {
            const counterparty = resolveOutgoingCounterparty(coverModel);
            const draft = await createOutgoingDraft({
                counterparty: counterparty && counterparty !== 'Company Name' ? counterparty : 'Черновик',
                subject: subject.trim() || 'Черновик исходящего письма',
                docType: 'letter',
            });
            setServerDocumentId(draft.id);
            persistDraft(files, attachmentMeta, comments, draft.id);
            return draft.id;
        };
        let docId = (serverDocumentId ?? '').trim();
        const reusedStoredId = Boolean(docId);
        if (!docId)
            docId = await openDraft();
        if (downloadQrUrl)
            return { url: downloadQrUrl, documentId: docId };
        try {
            const minted = await mintCorrespondenceDownloadQr(docId);
            setDownloadQrUrl(minted.url);
            return { url: minted.url, documentId: docId };
        }
        catch (err) {
            // Session can keep a draft id after the letter was deleted. Open a new one and mint again.
            if (!reusedStoredId || !isCorrespondenceHttpError(err, 404))
                throw err;
            docId = await openDraft();
            const minted = await mintCorrespondenceDownloadQr(docId);
            setDownloadQrUrl(minted.url);
            return { url: minted.url, documentId: docId };
        }
    }, [attachmentMeta, comments, coverModel, downloadQrUrl, files, persistDraft, serverDocumentId, subject]);
    const beginNewComment = useCallback(() => {
        if (!useInBrowserEditor || busy || templateBusy)
            return;
        const snap = editorRef.current?.getSelectionSnapshot();
        const quote = (snap?.text ?? '').trim();
        if (!quote) {
            void showAlert({
                title: 'Выделите текст',
                message: 'Как в Word: сначала выделите фрагмент письма, затем добавьте комментарий (Ctrl+Alt+M).',
            });
            setCommentsOpen(true);
            return;
        }
        pendingComposeRef.current = {
            quote,
            selectionJson: snap?.selectionJson ?? null,
        };
        setComposeQuote(quote);
        setCommentsComposing(true);
        setCommentsOpen(true);
        setActiveCommentId(null);
    }, [busy, showAlert, templateBusy, useInBrowserEditor]);
    const commitNewComment = useCallback((body) => {
        const pending = pendingComposeRef.current;
        const quote = (pending?.quote || composeQuote).trim();
        if (!body.trim())
            return;
        const next = {
            id: newOutgoingLetterCommentId(),
            quote,
            body: body.trim(),
            authorName: commentAuthorName,
            authorUserId: user?.id ?? null,
            createdAt: new Date().toISOString(),
            resolved: false,
            selectionJson: pending?.selectionJson ?? null,
        };
        setComments((prev) => {
            const list = [next, ...prev];
            persistDraft(files, attachmentMeta, list);
            return list;
        });
        pendingComposeRef.current = null;
        setCommentsComposing(false);
        setComposeQuote('');
        setActiveCommentId(next.id);
        setDirty(true);
    }, [attachmentMeta, commentAuthorName, composeQuote, files, persistDraft, user?.id]);
    const cancelNewComment = useCallback(() => {
        pendingComposeRef.current = null;
        setCommentsComposing(false);
        setComposeQuote('');
    }, []);
    const selectComment = useCallback((id) => {
        setActiveCommentId(id);
        const target = comments.find((c) => c.id === id);
        if (target?.selectionJson)
            editorRef.current?.restoreSelection(target.selectionJson);
    }, [comments]);
    const changeCommentBody = useCallback((id, body) => {
        setComments((prev) => {
            const list = prev.map((c) => (c.id === id ? { ...c, body } : c));
            persistDraft(files, attachmentMeta, list);
            return list;
        });
        setDirty(true);
    }, [attachmentMeta, files, persistDraft]);
    const toggleCommentResolved = useCallback((id) => {
        setComments((prev) => {
            const list = prev.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c));
            persistDraft(files, attachmentMeta, list);
            return list;
        });
        setDirty(true);
    }, [attachmentMeta, files, persistDraft]);
    const deleteComment = useCallback((id) => {
        setComments((prev) => {
            const list = prev.filter((c) => c.id !== id);
            persistDraft(files, attachmentMeta, list);
            return list;
        });
        setActiveCommentId((prev) => (prev === id ? null : prev));
        setDirty(true);
    }, [attachmentMeta, files, persistDraft]);
    const applyDocumentBytes = useCallback((bytes, remount) => {
        setDocumentBytes(bytes);
        setDirty(false);
        setEditorReady(false);
        if (remount)
            setTemplateKey(`tpl_${Date.now()}`);
    }, []);
    const loadBlankTemplate = useCallback(async (model, remount) => {
        setTemplateBusy(true);
        try {
            let qrUrl = downloadQrUrl;
            let docId = (serverDocumentId ?? '').trim();
            let mintError = null;
            try {
                const minted = await ensureServerDraftAndQr();
                qrUrl = minted.url;
                docId = (minted.documentId ?? docId).trim();
            }
            catch (qrErr) {
                mintError = correspondenceErrorMessage(qrErr, 'QR недоступен');
                console.warn(mintError);
            }
            if (!qrUrl) {
                showToast({
                    message: mintError
                        ? `QR не добавлен: ${mintError.split('\n')[0]}`
                        : 'QR не добавлен: нет ссылки скачивания. Проверьте correspondence (секрет и GATEWAY_BASE_URL).',
                    variant: 'error',
                });
            }
            const bytes = await buildOutgoingLetterDocxBytes(model, {
                downloadQrUrl: qrUrl,
            });
            applyDocumentBytes(bytes, remount);
            if (docId && /^[0-9a-f-]{36}$/i.test(docId) && qrUrl) {
                try {
                    const seed = outgoingLetterDocxFileFromBytes(bytes, subject.trim() || 'Черновик исходящего письма', letterDateIso);
                    await uploadCorrespondenceAttachment(docId, seed, 'attachment');
                }
                catch {
                    /* download will work after submit */
                }
            }
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
    }, [
        applyDocumentBytes,
        downloadQrUrl,
        ensureServerDraftAndQr,
        letterDateIso,
        serverDocumentId,
        showAlert,
        subject,
    ]);
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
                    // Still mint QR for overlay / later rebuild even if imported file has none.
                    if (!cancelled) {
                        try {
                            await ensureServerDraftAndQr();
                        }
                        catch {
                            /* toast on blank rebuild */
                        }
                    }
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
    const confirmLeavePage = useCallback(async () => {
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
    const mergeExtraFiles = (picked) => {
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
    const captureEditorFile = async () => {
        const buf = await editorRef.current?.save();
        if (!buf || buf.byteLength < 64)
            throw new Error('Не удалось сохранить документ из редактора. Дождитесь загрузки бланка.');
        return outgoingLetterDocxFileFromBytes(buf, subject, letterDateIso);
    };
    const syncEditorIntoDraftFiles = async () => {
        if (!useInBrowserEditor) {
            const word = pickOutgoingWordFile(files);
            if (!word) {
                throw new Error('Загрузите готовый .docx или откройте страницу в поддерживаемом браузере.');
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
    const handleImportDocx = async (file) => {
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
    const handleSubmitReview = async (partnerUserId, partnerName) => {
        setBusy(true);
        try {
            const nextFiles = await syncEditorIntoDraftFiles();
            await submitOutgoingLetterForReview({
                subject,
                coverModel,
                letterDateIso,
                partnerUserId,
                extraFiles: nextFiles,
                existingDocumentId: serverDocumentId,
                downloadQrUrl,
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
    return (_jsxs(_Fragment, { children: [_jsx(CorrespondenceShell, { activeTab: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043F\u0438\u0441\u044C\u043C\u043E", onBack: goBack, fullHeight: true, contentClassName: "corr-shell__content--docx-compose", tabs: CORR_SHELL_NAV_TABS.map((tab) => ({
                    id: tab.key,
                    label: tab.label,
                    active: tab.key === 'outgoing',
                    onClick: () => navigate(tab.key === 'outgoing' ? getCorrespondenceOutgoingUrl() : `${routes.correspondence}?tab=incoming`),
                })), actions: (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "corr__btn corr__btn--outline", onClick: () => { void handleSaveDraft(); }, disabled: actionsDisabled || (useInBrowserEditor && !documentBytes), children: [_jsx(IcoSave, {}), ' ', "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A"] }), _jsx("button", { type: "button", className: "corr__btn corr__btn--primary", onClick: () => { void openReviewModal(); }, disabled: actionsDisabled || !documentBytes, children: busy ? 'Подготовка…' : 'На согласование' })] })), children: _jsxs("div", { className: `corr-word corr-word--docx${editorFullscreen ? ' corr-word--docx-fs' : ''}`, children: [_jsxs("div", { className: "corr-word__toolbar corr-word__toolbar--slim", "aria-label": "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u043F\u0438\u0441\u044C\u043C\u0430", children: [_jsxs("label", { className: "corr-word__field corr-word__field--inline", children: [_jsx("span", { className: "corr-word__field-label", children: "\u041A\u043E\u043C\u0443" }), _jsx("input", { type: "text", className: "corr-modal__input", placeholder: "\u041F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044C", value: recipientValue, onChange: (e) => setCoverModel((prev) => ({ ...prev, recipientCompany: e.target.value })), disabled: busy })] }), _jsxs("label", { className: "corr-word__field corr-word__field--inline corr-word__field--subject", children: [_jsxs("span", { className: "corr-word__field-label", children: ["\u0422\u0435\u043C\u0430", dirty ? _jsx("span", { className: "corr-word__dirty", title: "\u0415\u0441\u0442\u044C \u043D\u0435\u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438", children: " \u25CF" }) : null] }), _jsx("input", { type: "text", className: "corr-modal__input", placeholder: "\u0422\u0435\u043C\u0430 \u043F\u0438\u0441\u044C\u043C\u0430", value: subject, onChange: (e) => setSubject(e.target.value), disabled: busy })] }), _jsxs("div", { className: "corr-word__toolbar-actions", onMouseDown: (e) => {
                                        const el = e.target;
                                        if (el?.closest('button'))
                                            e.preventDefault();
                                    }, children: [_jsxs("button", { type: "button", className: "corr-word__icon-btn", onClick: () => extraFileRef.current?.click(), disabled: busy, title: extraFiles.length ? `Вложения (${extraFiles.length})` : 'Вложения', "aria-label": extraFiles.length ? `Вложения, файлов: ${extraFiles.length}` : 'Вложения', children: [_jsx(IcoPaperclip, {}), extraFiles.length > 0 ? (_jsx("span", { className: "corr-word__icon-badge", children: extraFiles.length })) : null] }), useInBrowserEditor ? (_jsxs("button", { type: "button", className: "corr-word__icon-btn", onClick: () => setCommentsOpen((v) => !v), disabled: actionsDisabled || !documentBytes, "aria-pressed": commentsOpen, title: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438", "aria-label": openCommentsCount > 0 ? `Комментарии, открытых: ${openCommentsCount}` : 'Комментарии', children: [_jsx(IcoComments, {}), openCommentsCount > 0 ? (_jsx("span", { className: "corr-word__icon-badge", children: openCommentsCount })) : null] })) : null, _jsxs("div", { className: "corr-word__more", ref: moreMenuRef, children: [_jsx("button", { type: "button", className: "corr-word__icon-btn", onClick: () => setMoreMenuOpen((v) => !v), disabled: actionsDisabled, "aria-expanded": moreMenuOpen, "aria-haspopup": "menu", title: "\u0415\u0449\u0451", "aria-label": "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F", children: _jsx(IcoMore, {}) }), moreMenuOpen ? (_jsxs("div", { className: "corr-word__more-menu", role: "menu", children: [_jsx("button", { type: "button", role: "menuitem", className: "corr-word__more-item", disabled: actionsDisabled, onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                void handleRebuildTemplate();
                                                            }, children: templateBusy ? 'Сборка бланка…' : 'Пересобрать бланк' }), _jsx("button", { type: "button", role: "menuitem", className: "corr-word__more-item", disabled: actionsDisabled, onClick: () => {
                                                                setMoreMenuOpen(false);
                                                                importFileRef.current?.click();
                                                            }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C .docx" })] })) : null] }), _jsx("button", { type: "button", className: "corr-word__icon-btn", onClick: () => setEditorFullscreen((v) => !v), title: editorFullscreen ? 'Свернуть редактор (Esc)' : 'На весь экран', "aria-label": editorFullscreen ? 'Свернуть редактор' : 'На весь экран', "aria-pressed": editorFullscreen, children: _jsx(IcoEditorFullscreen, { exit: editorFullscreen }) }), _jsx("input", { ref: importFileRef, type: "file", accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", hidden: true, onChange: (e) => {
                                                const file = e.target.files?.[0];
                                                e.target.value = '';
                                                if (file)
                                                    void handleImportDocx(file);
                                            } }), _jsx("input", { ref: extraFileRef, type: "file", multiple: true, hidden: true, onChange: (e) => {
                                                const picked = Array.from(e.target.files ?? []);
                                                e.target.value = '';
                                                if (picked.length)
                                                    mergeExtraFiles(picked);
                                            } })] }), extraFiles.length > 0 ? (_jsx("ul", { className: "corr-word__extra-list corr-word__extra-list--toolbar", children: extraFiles.map((f) => (_jsx("li", { children: f.name }, `${f.name}-${f.size}`))) })) : null] }), _jsxs("section", { className: `corr-word__editor-wrap${commentsOpen && useInBrowserEditor ? ' corr-word__editor-wrap--comments' : ''}`, "aria-label": "\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043F\u0438\u0441\u044C\u043C\u0430", children: [useInBrowserEditor && documentBytes && !templateBusy ? (_jsxs("button", { type: "button", className: "corr-word__fs-comments-btn", onClick: () => setCommentsOpen((v) => !v), disabled: actionsDisabled, "aria-pressed": commentsOpen, title: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438 (Ctrl+Alt+M \u2014 \u043D\u043E\u0432\u044B\u0439)", children: [_jsx(IcoComments, {}), "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438", openCommentsCount > 0 ? ` (${openCommentsCount})` : ''] })) : null, !useInBrowserEditor ? (_jsxs("div", { className: "corr-word__editor-fallback", role: "status", children: [_jsx("p", { children: DOCX_EDITOR_BROWSER_HINT }), _jsx("p", { children: letterFile
                                                ? `Готов файл: ${letterFile.name}. Можно отправлять на согласование.`
                                                : 'Пока нет загруженного .docx — нажмите «Загрузить .docx».' }), _jsx("button", { type: "button", className: "corr__btn corr__btn--outline", disabled: actionsDisabled, onClick: () => importFileRef.current?.click(), children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C .docx" })] })) : !documentBytes || templateBusy ? (_jsx("div", { className: "corr-word__editor-loading", role: "status", children: "\u0413\u043E\u0442\u043E\u0432\u0438\u043C \u0431\u043B\u0430\u043D\u043A \u043F\u0438\u0441\u044C\u043C\u0430\u2026" })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "corr-word__editor-main", children: _jsx(OutgoingLetterDocxErrorBoundary, { fallback: (_jsxs("div", { className: "corr-word__editor-fallback", role: "alert", children: [_jsx("p", { children: "\u0412\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043D\u0435 \u0441\u043C\u043E\u0433 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C\u0441\u044F \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435." }), _jsx("p", { children: DOCX_EDITOR_BROWSER_HINT }), _jsx("button", { type: "button", className: "corr__btn corr__btn--outline", disabled: actionsDisabled, onClick: () => importFileRef.current?.click(), children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C .docx" })] })), onError: () => setEditorCrashed(true), children: _jsx(Suspense, { fallback: _jsx("div", { className: "corr-word__editor-loading", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430\u2026" }), children: _jsx(OutgoingLetterDocxEditor, { ref: editorRef, documentBytes: documentBytes, title: editorTitle, templateKey: templateKey, disabled: busy, onReady: () => setEditorReady(true), onChange: () => setDirty(true), onSaveRequest: () => { void handleSaveDraft(); }, onNewCommentRequest: beginNewComment }) }) }) }), _jsx(OutgoingLetterCommentsPane, { open: commentsOpen, comments: comments, disabled: busy, activeId: activeCommentId, draftQuote: composeQuote, composing: commentsComposing, onClose: () => {
                                                cancelNewComment();
                                                setCommentsOpen(false);
                                            }, onNewComment: beginNewComment, onSelect: selectComment, onChangeBody: changeCommentBody, onToggleResolved: toggleCommentResolved, onDelete: deleteComment, onCommitNew: commitNewComment, onCancelNew: cancelNewComment })] }))] })] }) }), _jsx(OutgoingSubmitReviewModal, { open: reviewOpen, onClose: () => { if (!busy)
                    setReviewOpen(false); }, onSubmit: (partnerUserId, partnerName) => { void handleSubmitReview(partnerUserId, partnerName); }, submitPending: busy })] }));
}
