import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getInvoiceCreateUrl, getInvoiceDetailUrl } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings, SearchableSelect, useAppToast } from '@shared/ui';
import { getInvoice, loadFirmBankingProfiles, patchInvoice, pickFirmBankingProfileForCurrency } from '@entities/time-tracking/api';
import { readInvoicePreviewSession, writeInvoicePreviewSession, } from '@entities/time-tracking/model/invoicePreviewSession';
import { firmBankingToLegalOverrides, applyFirmBankingProfileToLegalOverrides, profileDisplayTitle } from '@entities/time-tracking/lib/firmBankingDetailsStorage';
import { buildInvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { applyCoverLetterLanguage } from '../lib/invoiceCoverLetterI18n';
import { emptyInvoiceTimeReportPack, ensureMehnatSeparatedPack, mergeTimeReportPackPreferLiveExpenses, timeReportPackHasContent } from '../lib/invoiceTimeReportModel';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '../lib/invoicePreviewDownload';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { splitDetailRowsForPagedTimeReport } from '../lib/invoiceTimeReportChunking';
import {} from '../lib/invoiceLegalPageModel';
import { applyCoverDocumentOverrides, buildInvoiceDocumentOverridesPayload, parseInvoiceDocumentOverrides, scrubStaleBillingPeriodDocumentOverrides, } from '../lib/invoiceDocumentOverrides';
import { buildInvoicePreviewPageSlots, expandIncludedPageKeysIfCompleteSubset, normalizeIncludedPageKeys, pageKindLabelForSlot, } from '../lib/invoicePreviewPageSlots';
import { resolveInvoiceCoverLetterModel } from '../lib/resolveInvoiceCoverLetterModel';
import { resolveInvoiceTimeReportPack, overlayExpenseAmountsFromRegistry } from '../lib/resolveInvoiceTimeReportPack';
import { planCombinedReportPreviewPages } from '../lib/combinedReportPreviewPages';
import { InvoiceCoverLetter } from './InvoiceCoverLetter';
import { CombinedReportPage } from './CombinedReportPage';
import { InvoiceTimeReportPage } from './InvoiceTimeReportPage';
import { InvoiceLegalInvoicePage } from './InvoiceLegalInvoicePage';
import '@fontsource/carlito/400.css';
import '@fontsource/carlito/700.css';
import '@pages/time-tracking/ui/TimePageShell.css';
import './InvoicePreviewPage.css';
const INV_PREVIEW_PAGE_BASE_PX = 794;
function InvoicePageSkeleton({ type }) {
    return (_jsxs("div", { className: "tt-inv-skel-page", "aria-hidden": "true", children: [_jsxs("div", { className: "tt-inv-skel-cover__header", children: [_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__logo" }), _jsx("div", { className: "tt-inv-skel-cover__addr", children: [90, 70, 80, 65].map((w, i) => (_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__line", style: { width: w, animationDelay: `${i * 0.05}s` } }, i))) })] }), type === 'cover' && (_jsxs(_Fragment, { children: [_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__date", style: { animationDelay: '0.05s' } }), _jsx("div", { className: "tt-inv-skel-cover__block", children: [120, 90].map((w, i) => (_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__line", style: { width: w, animationDelay: `${0.08 + i * 0.04}s` } }, i))) }), _jsx("div", { className: "tt-inv-skel-cover__block", children: [100, 80].map((w, i) => (_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__line", style: { width: w, animationDelay: `${0.14 + i * 0.04}s` } }, i))) }), _jsx("div", { className: "tt-inv-skel-cover__block", style: { marginTop: 8 }, children: [160, 440, 380].map((w, i) => (_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__line", style: { width: w, animationDelay: `${0.2 + i * 0.04}s` } }, i))) }), _jsx("div", { className: "tt-inv-skel-cover__block", style: { marginTop: 16 }, children: [90].map((w, i) => (_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__line", style: { width: w, animationDelay: `${0.3 + i * 0.04}s` } }, i))) }), _jsx("div", { className: "tt-inv-skel-cover__block", style: { marginTop: 32 }, children: [130, 60].map((w, i) => (_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-cover__line", style: { width: w, animationDelay: `${0.36 + i * 0.04}s` } }, i))) })] })), (type === 'report' || type === 'invoice') && (_jsx(_Fragment, { children: _jsxs("div", { style: { marginTop: 28 }, children: [_jsx("div", { className: "tt-inv-skel-table__head tt-inv-skel-b", style: { animationDelay: '0.04s' }, children: [60, 40, 120, 180, 55, 60, 70].map((w, i) => (_jsx("span", { className: "tt-inv-skel-table__head-cell", style: { width: w } }, i))) }), Array.from({ length: type === 'report' ? 12 : 5 }, (_, i) => (_jsx("div", { className: "tt-inv-skel-table__row", style: { animationDelay: `${0.04 + i * 0.03}s` }, children: [60, 40, 120, 180, 55, 60, 70].map((w, j) => (_jsx("span", { className: "tt-inv-skel-b tt-inv-skel-table__cell", style: { width: w, animationDelay: `${0.04 + i * 0.03 + j * 0.01}s` } }, j))) }, i)))] }) }))] }));
}
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 250;
const SHEET_ZOOM_STEP = 10;
function fallbackCoverModel() {
    const iso = new Date().toISOString().slice(0, 10);
    return buildInvoiceCoverLetterModel({
        issueDateIso: iso,
        clientName: 'Company Name',
        clientAddress: null,
        contactName: null,
        totalAmount: null,
        currency: 'EUR',
    });
}
function globalDetailRowOffset(chunks, chunkIndex) {
    let offset = 0;
    for (let c = 0; c < chunkIndex; c += 1)
        offset += chunks[c]?.length ?? 0;
    return offset;
}
export function InvoicePreviewPage() {
    const { pushToast } = useAppToast();
    const location = useLocation();
    const [downloadBusy, setDownloadBusy] = useState(null);
    const [saveBusy, setSaveBusy] = useState(false);
    // Stabilize session identity — readInvoicePreviewSession() returns a new object every call;
    // using it bare in effect deps cancels pack loading on every re-render (empty tables, PDF still works).
    const session = useMemo(() => readInvoicePreviewSession(), [location.key, location.pathname]);
    const [coverModel, setCoverModel] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [legalOverrides, setLegalOverrides] = useState(() => firmBankingToLegalOverrides());
    const [bankProfiles, setBankProfiles] = useState([]);
    const [selectedBankProfileId, setSelectedBankProfileId] = useState('');
    const userPickedBankRef = useRef(false);
    const pendingDocOverridesRef = useRef(null);
    const skipNextAutosaveRef = useRef(true);
    const includedPagesHydratedRef = useRef(false);
    const prevTrChunkCountRef = useRef(0);
    const [invoiceStatus, setInvoiceStatus] = useState(null);
    const [includedPageKeys, setIncludedPageKeys] = useState(null);
    const [timeReportPack, setTimeReportPack] = useState(null);
    const [showInitiatorName, setShowInitiatorName] = useState(false);
    const [combinedReport, setCombinedReport] = useState(null);
    const sheetStackRef = useRef(null);
    const pageRefs = useRef([]);
    const [activePage, setActivePage] = useState(1);
    const [sheetZoomPct, setSheetZoomPct] = useState(100);
    const displayModel = useMemo(() => coverModel ?? fallbackCoverModel(), [coverModel]);
    const pagesZoomStyle = useMemo(() => ({
        zoom: `${sheetZoomPct}%`,
    }), [sheetZoomPct]);
    const scrollToPage = useCallback((page) => {
        const root = sheetStackRef.current;
        const el = pageRefs.current[page - 1];
        if (!root || !el)
            return;
        const rootRect = root.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const nextTop = root.scrollTop + (elRect.top - rootRect.top) - 8;
        root.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
        setActivePage(page);
    }, []);
    const issueDateIso = useMemo(() => {
        if (session?.mode === 'existing')
            return session.meta.issueDateIso ?? coverModel?.issueDateIso ?? new Date().toISOString().slice(0, 10);
        if (session?.mode === 'create')
            return session.form.issueDate.slice(0, 10);
        return coverModel?.issueDateIso ?? new Date().toISOString().slice(0, 10);
    }, [session, coverModel?.issueDateIso]);
    const setCoverLanguage = useCallback((lang) => {
        setCoverModel((prev) => applyCoverLetterLanguage(prev ?? fallbackCoverModel(), lang, issueDateIso));
        setLegalOverrides((prev) => ({
            ...prev,
            serviceDescriptionLine: null,
            paymentDisclaimer: null,
        }));
    }, [issueDateIso]);
    const patchCoverModel = useCallback((patch) => {
        setCoverModel((prev) => ({
            ...(prev ?? fallbackCoverModel()),
            ...patch,
        }));
    }, []);
    const coverLanguage = displayModel.coverLanguage ?? 'ENG';
    const patchLegalOverrides = useCallback((patch) => {
        setLegalOverrides((prev) => ({ ...prev, ...patch }));
    }, []);
    const applyBankProfile = useCallback((profile, opts) => {
        if (opts?.userInitiated)
            userPickedBankRef.current = true;
        setSelectedBankProfileId(profile?.id ?? '');
        setLegalOverrides((prev) => applyFirmBankingProfileToLegalOverrides(prev, profile));
    }, []);
    const applyDocumentOverridesToState = useCallback((doc, metaInvoiceNumber) => {
        if (!doc)
            return;
        pendingDocOverridesRef.current = doc;
        // Do not set userPickedBankRef — saved legal edits must not block auto-pick of
        // firm banking by invoice currency (USD invoice → USD реквизиты).
        skipNextAutosaveRef.current = true;
        // Keep includedPageKeys in pendingDocOverridesRef only — hydrate after the real
        // time-report pack is ready so tr:1+ are not dropped against the empty 1-chunk pack.
        setLegalOverrides((prev) => ({
            ...prev,
            ...(doc.legal ?? {}),
            invoiceNumber: (doc.legal?.invoiceNumber ?? metaInvoiceNumber ?? prev.invoiceNumber) || null,
        }));
        if (doc.cover) {
            setCoverModel((prev) => (prev ? applyCoverDocumentOverrides(prev, doc.cover) : prev));
        }
        setShowInitiatorName(doc.showServiceInitiatorName === true);
        setCombinedReport(doc.combinedReport ?? null);
        // timeReport is applied after live resolve (mergeTimeReportPackPreferLiveExpenses)
        // so expense USD stays locked to the registry, not a stale invoice FX snapshot.
    }, []);
    useEffect(() => {
        let cancelled = false;
        userPickedBankRef.current = false;
        pendingDocOverridesRef.current = null;
        skipNextAutosaveRef.current = true;
        includedPagesHydratedRef.current = false;
        prevTrChunkCountRef.current = 0;
        setInvoiceStatus(null);
        setIncludedPageKeys(null);
        setTimeReportPack(null);
        setShowInitiatorName(false);
        setCombinedReport(null);
        setLegalOverrides(firmBankingToLegalOverrides());
        const sessionNow = readInvoicePreviewSession();
        (async () => {
            const profiles = await loadFirmBankingProfiles({ migrateLocal: true });
            if (cancelled)
                return;
            setBankProfiles(profiles);
            let docFromApi = null;
            let invoiceCurrency = null;
            let invoiceIssueDate = null;
            if (sessionNow?.mode === 'existing') {
                try {
                    const inv = await getInvoice(sessionNow.invoiceId, false);
                    if (cancelled)
                        return;
                    setInvoiceStatus(String(inv.status ?? '').toLowerCase() || null);
                    invoiceCurrency = String(inv.currency ?? '').trim().toUpperCase() || null;
                    invoiceIssueDate = String(inv.issueDate ?? '').trim().slice(0, 10) || null;
                    docFromApi = parseInvoiceDocumentOverrides(inv.documentOverrides);
                    if (!docFromApi?.legal?.invoiceNumber && inv.invoiceNumber?.trim()) {
                        docFromApi = {
                            ...(docFromApi ?? { v: 1 }),
                            v: 1,
                            legal: {
                                ...(docFromApi?.legal ?? {}),
                                invoiceNumber: inv.invoiceNumber.trim(),
                            },
                        };
                    }
                }
                catch (e) {
                    console.error(e);
                    if (!cancelled) {
                        pushToast({
                            message: e instanceof Error ? e.message : 'Не удалось загрузить сохранённые правки счёта',
                            variant: 'warning',
                        });
                    }
                }
            }
            const docFromSession = parseInvoiceDocumentOverrides(sessionNow?.documentOverrides);
            const rawDoc = docFromApi ?? docFromSession;
            const periodIso = sessionNow?.mode === 'existing'
                ? (sessionNow.meta.billingPeriodTo || sessionNow.meta.billingPeriodFrom || null)
                : (sessionNow?.mode === 'create'
                    ? (sessionNow.form.unbilledTo || sessionNow.form.unbilledFrom || null)
                    : null);
            const issueIso = sessionNow?.mode === 'existing'
                ? (sessionNow.meta.issueDateIso ?? invoiceIssueDate ?? null)
                : (sessionNow?.mode === 'create' ? sessionNow.form.issueDate : null);
            const doc = issueIso
                ? scrubStaleBillingPeriodDocumentOverrides(rawDoc, {
                    issueDateIso: issueIso,
                    billingPeriodIso: periodIso,
                })
                : rawDoc;
            if (doc) {
                applyDocumentOverridesToState(doc, sessionNow?.meta.invoiceNumber);
            }
            else if (sessionNow?.meta.invoiceNumber?.trim()) {
                skipNextAutosaveRef.current = true;
                setLegalOverrides((prev) => ({
                    ...prev,
                    invoiceNumber: sessionNow.meta.invoiceNumber,
                }));
            }
            // Prefer invoice currency immediately; coverModel effect will refine once totals load.
            const picked = pickFirmBankingProfileForCurrency(profiles, invoiceCurrency);
            if (picked && !userPickedBankRef.current)
                applyBankProfile(picked);
        })();
        return () => {
            cancelled = true;
        };
    }, [location.key, location.pathname, applyBankProfile, applyDocumentOverridesToState, pushToast]);
    useEffect(() => {
        if (!bankProfiles.length || !coverModel || userPickedBankRef.current)
            return;
        const currency = packCurrencyCode(coverModel);
        const picked = pickFirmBankingProfileForCurrency(bankProfiles, currency);
        if (!picked)
            return;
        const selected = bankProfiles.find((p) => p.id === selectedBankProfileId);
        const selectedCur = (selected?.accountCurrency ?? '').trim().toUpperCase();
        const needsSwitch = picked.id !== selectedBankProfileId
            || (Boolean(currency) && selectedCur !== currency);
        if (needsSwitch)
            applyBankProfile(picked);
    }, [coverModel, bankProfiles, selectedBankProfileId, applyBankProfile]);
    const persistPreviewEdits = useCallback(async (opts) => {
        if (!session || !coverModel || timeReportPack == null)
            return false;
        const pack = timeReportPack;
        const trChunks = splitDetailRowsForPagedTimeReport(pack.detailSlots);
        const slots = buildInvoicePreviewPageSlots(trChunks.length);
        const included = expandIncludedPageKeysIfCompleteSubset(includedPageKeys ?? slots.map((s) => s.key), slots);
        const doc = buildInvoiceDocumentOverridesPayload({
            legal: legalOverrides,
            cover: coverModel,
            timeReport: pack,
            showServiceInitiatorName: showInitiatorName,
            combinedReport,
            includedPageKeys: included,
            persistIncludedPages: true,
        });
        const invNo = (legalOverrides.invoiceNumber ?? session.meta.invoiceNumber ?? '').trim();
        if (session.mode === 'create') {
            writeInvoicePreviewSession({
                ...session,
                form: {
                    ...session.form,
                    ...(invNo ? { invoiceNumber: invNo } : { invoiceNumber: session.form.invoiceNumber }),
                },
                meta: {
                    ...session.meta,
                    ...(invNo ? { invoiceNumber: invNo } : {}),
                },
                documentOverrides: doc,
            });
            return true;
        }
        setSaveBusy(true);
        try {
            let status = invoiceStatus;
            if (!status) {
                try {
                    const inv = await getInvoice(session.invoiceId, false);
                    status = String(inv.status ?? '').toLowerCase() || null;
                    if (status)
                        setInvoiceStatus(status);
                }
                catch {
                    status = null;
                }
            }
            const body = {
                documentOverrides: doc,
            };
            if (status === 'draft' && invNo)
                body.invoiceNumber = invNo;
            const updated = await patchInvoice(session.invoiceId, body);
            setInvoiceStatus(String(updated.status ?? status ?? '').toLowerCase() || status);
            writeInvoicePreviewSession({
                v: 1,
                mode: 'existing',
                invoiceId: session.invoiceId,
                meta: {
                    ...session.meta,
                    invoiceNumber: updated.invoiceNumber?.trim() || invNo || session.meta.invoiceNumber,
                },
                documentOverrides: (updated.documentOverrides
                    ?? doc),
            });
            if (updated.invoiceNumber?.trim()) {
                skipNextAutosaveRef.current = true;
                setLegalOverrides((prev) => ({
                    ...prev,
                    invoiceNumber: updated.invoiceNumber.trim(),
                }));
            }
            if (!opts?.silent) {
                pushToast({ message: 'Правки счёта сохранены', variant: 'info' });
            }
            return true;
        }
        catch (e) {
            pushToast({
                message: e instanceof Error ? e.message : 'Не удалось сохранить правки счёта',
                variant: 'error',
            });
            return false;
        }
        finally {
            setSaveBusy(false);
        }
    }, [session, coverModel, timeReportPack, showInitiatorName, combinedReport, legalOverrides, includedPageKeys, invoiceStatus, pushToast]);
    const togglePageEdit = useCallback(() => {
        if (editMode) {
            void persistPreviewEdits({ silent: false }).finally(() => setEditMode(false));
            return;
        }
        setEditMode(true);
    }, [editMode, persistPreviewEdits]);
    // Autosave while editing (debounced).
    useEffect(() => {
        if (!editMode || !session || !coverModel)
            return;
        if (skipNextAutosaveRef.current) {
            skipNextAutosaveRef.current = false;
            return;
        }
        const t = window.setTimeout(() => {
            void persistPreviewEdits({ silent: true });
        }, 900);
        return () => window.clearTimeout(t);
    }, [editMode, session, coverModel, legalOverrides, timeReportPack, combinedReport, includedPageKeys, persistPreviewEdits]);
    const editingPage = editMode ? activePage : null;
    const timeReportFallback = useMemo(() => emptyInvoiceTimeReportPack(packCurrencyCode(displayModel)), [displayModel]);
    const resolvedTimeReportPack = ensureMehnatSeparatedPack(timeReportPack ?? timeReportFallback);
    const combinedReportPages = useMemo(() => combinedReport ? Math.max(1, planCombinedReportPreviewPages(combinedReport).length) : 0, [combinedReport]);
    const timeReportChunks = useMemo(() => combinedReport
        ? Array.from({ length: combinedReportPages }, () => resolvedTimeReportPack.detailSlots)
        : splitDetailRowsForPagedTimeReport(resolvedTimeReportPack.detailSlots), [combinedReport, combinedReportPages, resolvedTimeReportPack.detailSlots]);
    const allPageSlots = useMemo(() => buildInvoicePreviewPageSlots(timeReportChunks.length), [timeReportChunks.length]);
    const resolvedIncludedKeys = useMemo(() => normalizeIncludedPageKeys(includedPageKeys, allPageSlots), [includedPageKeys, allPageSlots]);
    const visiblePageSlots = useMemo(() => allPageSlots.filter((slot) => resolvedIncludedKeys.has(slot.key)), [allPageSlots, resolvedIncludedKeys]);
    const pageCount = visiblePageSlots.length;
    const fullPackPageCount = allPageSlots.length;
    const exportPageNumbers = useMemo(() => {
        const nums = [];
        allPageSlots.forEach((slot, idx) => {
            if (resolvedIncludedKeys.has(slot.key))
                nums.push(idx + 1);
        });
        return nums;
    }, [allPageSlots, resolvedIncludedKeys]);
    // Seed included pages only after the real time-report pack is loaded (not the empty fallback).
    useEffect(() => {
        if (timeReportPack == null)
            return;
        if (includedPagesHydratedRef.current && includedPageKeys != null)
            return;
        if (allPageSlots.length === 0)
            return;
        const pending = pendingDocOverridesRef.current?.includedPageKeys;
        if (pending?.length) {
            includedPagesHydratedRef.current = true;
            setIncludedPageKeys(expandIncludedPageKeysIfCompleteSubset(pending, allPageSlots));
            return;
        }
        if (includedPageKeys == null) {
            includedPagesHydratedRef.current = true;
            setIncludedPageKeys(new Set(allPageSlots.map((s) => s.key)));
        }
    }, [timeReportPack, allPageSlots, includedPageKeys]);
    // If the pack grows after hydrate (more TR chunks) and the current selection is still a
    // complete smaller pack, treat that as the load race / row growth — include new pages.
    useEffect(() => {
        if (timeReportPack == null || includedPageKeys == null || !includedPagesHydratedRef.current)
            return;
        const nextCount = timeReportChunks.length;
        const prevCount = prevTrChunkCountRef.current;
        prevTrChunkCountRef.current = nextCount;
        if (prevCount <= 0 || nextCount <= prevCount)
            return;
        setIncludedPageKeys((prev) => {
            if (prev == null)
                return prev;
            const expanded = expandIncludedPageKeysIfCompleteSubset(prev, allPageSlots);
            if (expanded.size === prev.size && [...expanded].every((k) => prev.has(k)))
                return prev;
            skipNextAutosaveRef.current = false;
            return expanded;
        });
    }, [timeReportPack, timeReportChunks.length, allPageSlots, includedPageKeys]);
    const removePageKey = useCallback((key) => {
        setIncludedPageKeys((prev) => {
            const base = normalizeIncludedPageKeys(prev, allPageSlots);
            if (base.size <= 1) {
                pushToast({ variant: 'warning', message: 'В счёте должна остаться хотя бы одна страница' });
                return prev ?? base;
            }
            if (!base.has(key))
                return prev ?? base;
            const next = new Set(base);
            next.delete(key);
            skipNextAutosaveRef.current = false;
            return next;
        });
    }, [allPageSlots, pushToast]);
    const restorePageKey = useCallback((key) => {
        setIncludedPageKeys((prev) => {
            const base = normalizeIncludedPageKeys(prev, allPageSlots);
            if (base.has(key))
                return prev ?? base;
            const next = new Set(base);
            next.add(key);
            skipNextAutosaveRef.current = false;
            return next;
        });
    }, [allPageSlots]);
    const restoreAllPages = useCallback(() => {
        skipNextAutosaveRef.current = false;
        setIncludedPageKeys(new Set(allPageSlots.map((s) => s.key)));
    }, [allPageSlots]);
    const persistPreviewEditsRef = useRef(persistPreviewEdits);
    persistPreviewEditsRef.current = persistPreviewEdits;
    // Persist page inclusion changes (even outside edit mode).
    useEffect(() => {
        if (!session || !coverModel || includedPageKeys == null)
            return;
        if (skipNextAutosaveRef.current)
            return;
        const t = window.setTimeout(() => {
            void persistPreviewEditsRef.current({ silent: true }).finally(() => {
                skipNextAutosaveRef.current = true;
            });
        }, 500);
        return () => window.clearTimeout(t);
    }, [includedPageKeys, session, coverModel]);
    const selectAllPagesForExport = useCallback(() => {
        restoreAllPages();
    }, [restoreAllPages]);
    useEffect(() => {
        setActivePage((prev) => (prev > pageCount ? Math.max(1, pageCount) : prev));
    }, [pageCount]);
    useEffect(() => {
        setEditMode(false);
    }, [pageCount]);
    useEffect(() => {
        let cancel = false;
        void resolveInvoiceCoverLetterModel(session).then((m) => {
            if (cancel)
                return;
            const pending = pendingDocOverridesRef.current;
            const scrubbed = scrubStaleBillingPeriodDocumentOverrides(pending, {
                issueDateIso: m.issueDateIso,
                billingPeriodIso: m.billingPeriodIso,
            });
            if (scrubbed)
                pendingDocOverridesRef.current = scrubbed;
            const coverSrc = scrubbed?.cover ?? pending?.cover;
            const withCover = applyCoverDocumentOverrides(m, coverSrc);
            setCoverModel(withCover);
            if (scrubbed?.legal) {
                setLegalOverrides((prev) => ({
                    ...prev,
                    ...scrubbed.legal,
                }));
            }
        });
        return () => {
            cancel = true;
        };
    }, [session]);
    useEffect(() => {
        if (!session || coverModel == null)
            return;
        const savedPack = pendingDocOverridesRef.current?.timeReport;
        let cancel = false;
        void (async () => {
            let projectId = session.mode === 'create'
                ? (session.form.createProjectId?.trim() || null)
                : null;
            if (!projectId && session.mode === 'existing') {
                try {
                    const inv = await getInvoice(session.invoiceId, false);
                    projectId = inv.projectId?.trim() || null;
                }
                catch {
                    projectId = null;
                }
            }
            if (cancel)
                return;
            try {
                const live = await resolveInvoiceTimeReportPack(session, coverModel, {
                    onPartnerConfirmationBlocked(message) {
                        if (!cancel)
                            pushToast({ message, variant: 'warning' });
                    },
                });
                if (cancel)
                    return;
                const merged = savedPack && timeReportPackHasContent(savedPack)
                    ? mergeTimeReportPackPreferLiveExpenses(savedPack, live)
                    : live;
                const healed = projectId
                    ? await overlayExpenseAmountsFromRegistry(merged, projectId)
                    : merged;
                if (cancel)
                    return;
                setTimeReportPack(ensureMehnatSeparatedPack(healed));
            }
            catch (err) {
                console.error(err);
                if (cancel)
                    return;
                if (savedPack && timeReportPackHasContent(savedPack)) {
                    const healed = projectId
                        ? await overlayExpenseAmountsFromRegistry(savedPack, projectId)
                        : savedPack;
                    if (!cancel)
                        setTimeReportPack(ensureMehnatSeparatedPack(healed));
                }
                else
                    pushToast({ message: 'Не удалось загрузить time report для счёта', variant: 'error' });
            }
        })();
        return () => {
            cancel = true;
        };
    }, [session, coverLanguage, coverModel, pushToast]);
    const patchDetailRowInChunk = useCallback((chunkIndex, rowIndex, field, value) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const chunks = splitDetailRowsForPagedTimeReport(base.detailSlots);
            const globalIdx = globalDetailRowOffset(chunks, chunkIndex) + rowIndex;
            const nextSlots = [...base.detailSlots];
            while (nextSlots.length <= globalIdx)
                nextSlots.push({ date: '', initials: '', task: '', description: '', hours: '', hourlyRate: '', amount: '' });
            nextSlots[globalIdx] = { ...nextSlots[globalIdx], [field]: value };
            return { ...base, detailSlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);
    const patchSummaryRow = useCallback((rowIndex, field, value) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const nextSlots = [...base.summarySlots];
            while (nextSlots.length <= rowIndex)
                nextSlots.push({ initials: '', name: '', title: '', hours: '', hourlyRate: '', totalPrice: '' });
            nextSlots[rowIndex] = { ...nextSlots[rowIndex], [field]: value };
            return { ...base, summarySlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);
    const patchExpenseRow = useCallback((rowIndex, field, value) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const nextSlots = [...(base.expenseSlots ?? [])];
            while (nextSlots.length <= rowIndex)
                nextSlots.push({ date: '', initials: '', task: '', description: '', hours: '', hourlyRate: '', amount: '' });
            nextSlots[rowIndex] = { ...nextSlots[rowIndex], [field]: value };
            return { ...base, expenseSlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);
    const patchMehnatRow = useCallback((rowIndex, field, value) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const nextSlots = [...(base.mehnatSlots ?? [])];
            while (nextSlots.length <= rowIndex)
                nextSlots.push({ date: '', initials: '', task: '', description: '', hours: '', hourlyRate: '', amount: '' });
            nextSlots[rowIndex] = { ...nextSlots[rowIndex], [field]: value };
            return { ...base, mehnatSlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);
    const patchTimeReportPack = useCallback((patch) => {
        setTimeReportPack((prev) => ({ ...(prev ?? resolvedTimeReportPack), ...patch }));
    }, [resolvedTimeReportPack]);
    useEffect(() => {
        const root = sheetStackRef.current;
        if (!root)
            return;
        const els = pageRefs.current.filter((n) => n != null);
        if (els.length === 0)
            return;
        const obs = new IntersectionObserver((entries) => {
            const best = entries
                .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!best?.target)
                return;
            const idx = els.indexOf(best.target);
            if (idx >= 0)
                setActivePage(idx + 1);
        }, { root, rootMargin: '-8% 0px -35% 0px', threshold: [0.1, 0.25, 0.45, 0.65, 0.85] });
        for (const el of els)
            obs.observe(el);
        return () => obs.disconnect();
    }, [coverModel, pageCount, timeReportChunks.length]);
    const zoomOut = useCallback(() => {
        setSheetZoomPct((z) => Math.max(SHEET_ZOOM_MIN, z - SHEET_ZOOM_STEP));
    }, []);
    const zoomIn = useCallback(() => {
        setSheetZoomPct((z) => Math.min(SHEET_ZOOM_MAX, z + SHEET_ZOOM_STEP));
    }, []);
    const zoomReset = useCallback(() => setSheetZoomPct(100), []);
    const zoomFitWidth = useCallback(() => {
        const el = sheetStackRef.current;
        if (!el)
            return;
        const cs = window.getComputedStyle(el);
        const px = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
        const cw = Math.max(0, el.clientWidth - (Number.isFinite(px) ? px : 48));
        const next = Math.round((cw / INV_PREVIEW_PAGE_BASE_PX) * 100);
        setSheetZoomPct(Math.min(SHEET_ZOOM_MAX, Math.max(SHEET_ZOOM_MIN, next)));
    }, []);
    const subtitleParts = session?.mode === 'existing'
        ? [
            (legalOverrides.invoiceNumber ?? session.meta.invoiceNumber)?.trim() || null,
            session.meta.clientLabel,
        ].filter(Boolean)
        : [session?.meta.clientLabel, session?.meta.projectLabel].filter(Boolean);
    const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : null;
    const defaultFilename = useMemo(() => {
        if (!session)
            return 'Schet_predprosmotr';
        if (session.mode === 'existing') {
            return buildInvoicePreviewExportBasename({
                invoiceNumber: legalOverrides.invoiceNumber ?? session.meta.invoiceNumber,
                clientLabel: session.meta.clientLabel,
                issueDateIso: session.meta.issueDateIso,
            });
        }
        return buildInvoicePreviewExportBasename({
            clientLabel: session.meta.clientLabel,
            issueDateIso: session.form.issueDate.slice(0, 10),
        });
    }, [session, legalOverrides.invoiceNumber]);
    const backHref = session?.mode === 'existing'
        ? getInvoiceDetailUrl(session.invoiceId)
        : getInvoiceCreateUrl({ resume: true });
    const exportInput = useMemo(() => ({
        model: coverModel ?? fallbackCoverModel(),
        session,
        timeReportPack: resolvedTimeReportPack,
        legalOverrides,
        selectedPageNumbers: exportPageNumbers,
        showServiceInitiatorName: showInitiatorName,
        combinedReport,
    }), [coverModel, session, resolvedTimeReportPack, legalOverrides, exportPageNumbers, showInitiatorName, combinedReport]);
    const handleDownloadWord = useCallback(async () => {
        if (exportPageNumbers.length === 0) {
            pushToast({ variant: 'warning', message: 'Выберите хотя бы одну страницу для экспорта' });
            return;
        }
        setDownloadBusy('word');
        try {
            const { buildInvoicePreviewDocxBlob } = await import('../lib/buildInvoicePreviewDocx');
            const blob = await buildInvoicePreviewDocxBlob(exportInput);
            triggerBrowserDownload(blob, `${defaultFilename}.docx`);
        }
        catch (e) {
            pushToast({
                variant: 'error',
                message: e instanceof Error ? e.message : 'Не удалось сформировать документ Word',
            });
        }
        finally {
            setDownloadBusy(null);
        }
    }, [defaultFilename, exportInput, pushToast, exportPageNumbers.length]);
    const handleDownloadPdf = useCallback(async () => {
        if (exportPageNumbers.length === 0) {
            pushToast({ variant: 'warning', message: 'Выберите хотя бы одну страницу для экспорта' });
            return;
        }
        setDownloadBusy('pdf');
        try {
            const { buildInvoicePreviewPdfBlob } = await import('../lib/buildInvoicePreviewPdf');
            const blob = await buildInvoicePreviewPdfBlob(exportInput);
            triggerBrowserDownload(blob, `${defaultFilename}.pdf`);
        }
        catch (e) {
            pushToast({
                variant: 'error',
                message: e instanceof Error ? e.message : 'Не удалось сформировать PDF',
            });
        }
        finally {
            setDownloadBusy(null);
        }
    }, [defaultFilename, exportInput, pushToast, exportPageNumbers.length]);
    const handleDownloadActivePage = useCallback(async () => {
        const slot = visiblePageSlots[activePage - 1];
        if (!slot) {
            pushToast({ variant: 'warning', message: 'Нет активной страницы для сохранения' });
            return;
        }
        const fullIdx = allPageSlots.findIndex((s) => s.key === slot.key);
        if (fullIdx < 0)
            return;
        setDownloadBusy('page');
        try {
            // Persist latest edits first so the downloaded page matches what is on screen.
            await persistPreviewEdits({ silent: true });
            const { buildInvoicePreviewPdfBlob } = await import('../lib/buildInvoicePreviewPdf');
            const blob = await buildInvoicePreviewPdfBlob({
                ...exportInput,
                selectedPageNumbers: [fullIdx + 1],
            });
            const pageSuffix = slot.kind === 'cover'
                ? 'letter'
                : slot.kind === 'invoice'
                    ? 'invoice'
                    : `time-report-${slot.chunkIndex + 1}`;
            triggerBrowserDownload(blob, `${defaultFilename}_${pageSuffix}.pdf`);
            pushToast({ message: `Страница «${pageKindLabelForSlot(slot)}» сохранена`, variant: 'info' });
        }
        catch (e) {
            pushToast({
                variant: 'error',
                message: e instanceof Error ? e.message : 'Не удалось сохранить страницу',
            });
        }
        finally {
            setDownloadBusy(null);
        }
    }, [visiblePageSlots, activePage, allPageSlots, persistPreviewEdits, exportInput, defaultFilename, pushToast]);
    const handleSaveActivePageEdits = useCallback(async () => {
        const ok = await persistPreviewEdits({ silent: false });
        if (ok && editMode)
            setEditMode(false);
    }, [persistPreviewEdits, editMode]);
    const toolbarTitle = subtitle ?? defaultFilename;
    const deletedPageCount = fullPackPageCount - pageCount;
    const isEditingActivePage = editMode;
    const exportSelectionLabel = deletedPageCount === 0
        ? `все ${pageCount}`
        : `${pageCount} из ${fullPackPageCount}`;
    const pdfToolbarTip = 'Удалите ненужные страницы слева — состав сохраняется вместе с правками. «Скачать страницу» экспортирует только текущий лист. «Редактировать» / «Готово» сохраняет правки документа.';
    const activeSlot = visiblePageSlots[activePage - 1] ?? null;
    return (_jsxs("div", { className: "tt-inv-preview", children: [_jsxs("nav", { className: "time-page__navbar tt-inv-preview__navbar", "aria-label": "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0441\u0447\u0451\u0442\u0430", children: [_jsx(AppBackButton, { to: backHref, hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("span", { className: "time-page__navbar-title", children: "\u0421\u0447\u0435\u0442\u0430" }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("div", { className: "time-page__navbar-tabs", role: "tablist", "aria-label": "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0440\u0430\u0437\u0434\u0435\u043B", children: _jsx("span", { className: "time-page__navbar-tab time-page__navbar-tab--active", role: "tab", "aria-selected": "true", tabIndex: -1, children: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440" }) }), _jsx("div", { className: "time-page__navbar-spacer" }), _jsxs("div", { className: "tt-inv-preview__downloads", role: "group", "aria-label": "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn", disabled: downloadBusy != null || !activeSlot, onClick: () => void handleDownloadActivePage(), title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0432 PDF", children: downloadBusy === 'page' ? 'Подготовка…' : 'Скачать страницу' }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn", disabled: downloadBusy != null || exportPageNumbers.length === 0, onClick: () => void handleDownloadPdf(), children: downloadBusy === 'pdf' ? 'Подготовка…' : 'Скачать PDF' }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent tt-inv-preview__download-btn", disabled: downloadBusy != null || exportPageNumbers.length === 0, onClick: () => void handleDownloadWord(), children: downloadBusy === 'word' ? 'Подготовка…' : 'Скачать Word' })] }), _jsx("div", { className: "time-page__navbar-settings", children: _jsx(AppPageSettings, {}) })] }), _jsx("main", { className: "tt-inv-preview__main", children: _jsxs("div", { className: "tt-inv-preview__viewer", "aria-label": "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", children: [_jsxs("aside", { className: "tt-inv-preview__thumbs", "aria-label": "\u041C\u0438\u043D\u0438\u0430\u0442\u044E\u0440\u044B \u0441\u0442\u0440\u0430\u043D\u0438\u0446", children: [_jsxs("div", { className: "tt-inv-preview__thumbs-head", children: [_jsx("span", { className: "tt-inv-preview__thumbs-title", children: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B" }), coverModel
                                            ? (_jsx("button", { type: "button", className: "tt-inv-preview__thumbs-all", onClick: selectAllPagesForExport, title: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0432\u0441\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B", children: "\u0412\u0441\u0435" }))
                                            : null] }), !coverModel
                                    ? ([1, 2, 3].map((n) => (_jsxs("div", { className: `tt-inv-preview__thumb-wrap${n === 1 ? ' tt-inv-preview__thumb-wrap--active' : ''}`, children: [_jsx("span", { className: "tt-inv-preview__thumb-sheet", "aria-hidden": true, children: _jsx("span", { className: "tt-inv-skel-thumb" }) }), _jsx("div", { className: "tt-inv-preview__thumb-meta", children: _jsx("span", { className: "tt-inv-preview__thumb-num", children: n }) })] }, n))))
                                    : null, coverModel
                                    ? allPageSlots.map((slot) => {
                                        const included = resolvedIncludedKeys.has(slot.key);
                                        const visibleIdx = included
                                            ? visiblePageSlots.findIndex((s) => s.key === slot.key)
                                            : -1;
                                        const displayNum = visibleIdx >= 0 ? visibleIdx + 1 : null;
                                        const isActive = included && displayNum === activePage;
                                        const lastTr = timeReportChunks.length - 1;
                                        return (_jsxs("div", { className: `tt-inv-preview__thumb-wrap${isActive ? ' tt-inv-preview__thumb-wrap--active' : ''}${!included ? ' tt-inv-preview__thumb-wrap--off tt-inv-preview__thumb-wrap--deleted' : ''}`, children: [_jsx("button", { type: "button", className: `tt-inv-preview__thumb${isActive ? ' tt-inv-preview__thumb--active' : ''}`, "aria-current": isActive ? 'page' : undefined, "aria-label": `${pageKindLabelForSlot(slot)}${included ? '' : ', удалена'}`, disabled: !included, onClick: () => {
                                                        if (displayNum != null)
                                                            scrollToPage(displayNum);
                                                    }, children: _jsx("span", { className: "tt-inv-preview__thumb-sheet", "aria-hidden": true, children: _jsx("span", { className: "tt-inv-preview__thumb-scale", children: slot.kind === 'cover'
                                                                ? (_jsx("div", { className: "tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--letter", children: _jsx(InvoiceCoverLetter, { model: displayModel }) }))
                                                                : slot.kind === 'timeReport' && timeReportChunks[slot.chunkIndex]
                                                                    ? (_jsx("div", { className: "tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--timerpt", children: combinedReport
                                                                            ? _jsx(CombinedReportPage, { report: combinedReport, pageIndex: slot.chunkIndex, pageNumber: 2 + slot.chunkIndex })
                                                                            : (_jsx(InvoiceTimeReportPage, { model: displayModel, pack: resolvedTimeReportPack, pageNumber: 2 + slot.chunkIndex, detailRows: timeReportChunks[slot.chunkIndex], continuation: slot.chunkIndex > 0, showDetailTotalRow: slot.chunkIndex === lastTr, showExpenseSection: slot.chunkIndex === lastTr, showMehnatSection: slot.chunkIndex === lastTr, showSummarySection: slot.chunkIndex === lastTr, showInitiatorName: showInitiatorName })) }))
                                                                    : slot.kind === 'invoice'
                                                                        ? (_jsx("div", { className: "tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--invoice", children: _jsx(InvoiceLegalInvoicePage, { model: displayModel, session: session, legalOverrides: legalOverrides }) }))
                                                                        : (_jsx("div", { className: "tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--blank", "aria-hidden": true })) }) }) }), _jsxs("div", { className: "tt-inv-preview__thumb-meta", children: [included
                                                            ? (_jsx("button", { type: "button", className: "tt-inv-preview__thumb-remove", title: `Удалить страницу «${pageKindLabelForSlot(slot)}» из счёта`, "aria-label": `Удалить страницу «${pageKindLabelForSlot(slot)}»`, onClick: () => removePageKey(slot.key), children: "\u00D7" }))
                                                            : (_jsx("button", { type: "button", className: "tt-inv-preview__thumb-restore", title: `Вернуть страницу «${pageKindLabelForSlot(slot)}»`, "aria-label": `Вернуть страницу «${pageKindLabelForSlot(slot)}»`, onClick: () => restorePageKey(slot.key), children: "\u21A9" })), _jsx("span", { className: "tt-inv-preview__thumb-num", children: included ? displayNum : '—' })] })] }, slot.key));
                                    })
                                    : null] }), _jsxs("div", { className: "tt-inv-preview__stage", children: [_jsxs("div", { className: "tt-inv-preview__pdf-toolbar", role: "toolbar", "aria-label": "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", title: pdfToolbarTip, children: [_jsxs("div", { className: "tt-inv-preview__pdf-toolbar-meta", children: [_jsx("span", { className: "tt-inv-preview__pdf-toolbar-doc", title: toolbarTitle, children: toolbarTitle }), !coverModel ? _jsx("span", { className: "tt-inv-preview__pdf-toolbar-status", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }) : null, _jsxs("span", { className: "tt-inv-preview__pdf-toolbar-export", title: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B, \u0432\u0445\u043E\u0434\u044F\u0449\u0438\u0435 \u0432 \u0441\u0447\u0451\u0442", children: ["\u0412 \u0441\u0447\u0451\u0442\u0435: ", exportSelectionLabel] }), _jsxs("div", { className: "tt-inv-preview__lang-toggle", role: "group", "aria-label": "\u042F\u0437\u044B\u043A \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", children: [_jsx("button", { type: "button", className: `tt-inv-preview__lang-btn${coverLanguage === 'ENG' ? ' tt-inv-preview__lang-btn--active' : ''}`, "aria-pressed": coverLanguage === 'ENG', disabled: !coverModel, onClick: () => setCoverLanguage('ENG'), title: "English cover letter", children: "ENG" }), _jsx("button", { type: "button", className: `tt-inv-preview__lang-btn${coverLanguage === 'RU' ? ' tt-inv-preview__lang-btn--active' : ''}`, "aria-pressed": coverLanguage === 'RU', disabled: !coverModel, onClick: () => setCoverLanguage('RU'), title: "\u0421\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u0438\u0441\u044C\u043C\u043E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C", children: "RU" })] }), bankProfiles.length > 0 ? (_jsxs("div", { className: "tt-inv-preview__bank-select", title: "\u0411\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u0438\u0435 \u0440\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0441\u0447\u0451\u0442\u0430", children: [_jsx("span", { className: "tt-inv-preview__bank-select-label", id: "tt-inv-bank-select-lbl", children: "\u0420\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B" }), _jsx(SearchableSelect, { className: "tt-inv-preview__bank-dd", buttonClassName: "tt-inv-preview__bank-dd-btn", value: selectedBankProfileId, items: bankProfiles, getOptionValue: (p) => p.id, getOptionLabel: (p) => {
                                                                const title = profileDisplayTitle(p, 'Без названия');
                                                                const bits = [title];
                                                                if (p.isDefault)
                                                                    bits.push('по умолчанию');
                                                                if (p.accountCurrency.trim())
                                                                    bits.push(p.accountCurrency.trim());
                                                                return bits.join(' · ');
                                                            }, getSearchText: (p) => [
                                                                p.title,
                                                                p.bankName,
                                                                p.accountCurrency,
                                                                p.accountNumber,
                                                                p.swift,
                                                            ].filter(Boolean).join(' '), renderButtonContent: (p) => (_jsxs("span", { className: "tt-inv-preview__bank-dd-btn-text", children: [_jsx("span", { className: "tt-inv-preview__bank-dd-btn-title", children: profileDisplayTitle(p, 'Без названия') }), p.accountCurrency.trim() ? (_jsx("span", { className: "tt-inv-preview__bank-dd-btn-meta", children: p.accountCurrency.trim() })) : null] })), renderOption: (p, { selected }) => (_jsxs("span", { className: `tt-inv-preview__bank-dd-opt${selected ? ' tt-inv-preview__bank-dd-opt--selected' : ''}`, children: [_jsxs("span", { className: "tt-inv-preview__bank-dd-opt-title", children: [profileDisplayTitle(p, 'Без названия'), p.isDefault ? (_jsx("span", { className: "tt-inv-preview__bank-dd-opt-badge", children: "\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E" })) : null] }), _jsx("span", { className: "tt-inv-preview__bank-dd-opt-meta", children: [p.accountCurrency, p.bankName, p.accountNumber].map((x) => x.trim()).filter(Boolean).join(' · ') })] })), onSelect: (p) => applyBankProfile(p, { userInitiated: true }), placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B", emptyListText: "\u041D\u0435\u0442 \u0440\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u043E\u0432", noMatchText: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", disabled: !coverModel, portalDropdown: true, portalZIndex: 12000, portalMinWidth: 280, portalDropdownClassName: "tt-inv-preview__bank-dd-menu", "aria-labelledby": "tt-inv-bank-select-lbl" })] })) : null, _jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-edit-btn", onClick: () => void handleSaveActivePageEdits(), disabled: !coverModel || saveBusy || downloadBusy != null, title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0440\u0430\u0432\u043A\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430 (\u0432\u043A\u043B\u044E\u0447\u0430\u044F \u0441\u043E\u0441\u0442\u0430\u0432 \u0441\u0442\u0440\u0430\u043D\u0438\u0446)", children: saveBusy ? 'Сохранение…' : 'Сохранить' }), _jsx("button", { type: "button", className: `tt-inv-preview__pdf-toolbar-edit-btn${isEditingActivePage ? ' tt-inv-preview__pdf-toolbar-edit-btn--active' : ''}`, onClick: togglePageEdit, disabled: !coverModel || saveBusy, "aria-pressed": isEditingActivePage, title: editMode ? 'Сохранить и завершить редактирование' : `Редактировать страницу ${activePage}`, children: editMode ? 'Готово' : 'Редактировать' }), _jsxs("label", { className: "tt-inv-preview__show-name", title: "\u0418\u043C\u044F \u0438\u043D\u0438\u0446\u0438\u0430\u0442\u043E\u0440\u0430 \u0443\u0441\u043B\u0443\u0433 \u0441\u0442\u043E\u0438\u0442 \u0432 \u0437\u0430\u043C\u0435\u0442\u043A\u0435 \u043F\u043E\u0441\u043B\u0435 \u0441\u0438\u043C\u0432\u043E\u043B\u0430 /, * \u0438\u043B\u0438 =. \u0413\u0430\u043B\u043E\u0447\u043A\u0430 \u0432\u044B\u0440\u0435\u0437\u0430\u0435\u0442 \u0435\u0433\u043E \u0432 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u043E\u043B\u0431\u0435\u0446.", children: [_jsx("input", { type: "checkbox", checked: showInitiatorName, disabled: !coverModel, onChange: (e) => setShowInitiatorName(e.target.checked) }), "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0438\u043C\u044F"] })] }), _jsxs("div", { className: "tt-inv-preview__pdf-toolbar-zoom", role: "group", "aria-label": "\u041C\u0430\u0441\u0448\u0442\u0430\u0431 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", children: [_jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn", onClick: zoomOut, disabled: sheetZoomPct <= SHEET_ZOOM_MIN, "aria-label": "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B", title: "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C", children: "\u2212" }), _jsxs("span", { className: "tt-inv-preview__pdf-toolbar-zoom-val", "aria-live": "polite", children: [sheetZoomPct, "%"] }), _jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn", onClick: zoomIn, disabled: sheetZoomPct >= SHEET_ZOOM_MAX, "aria-label": "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B", title: "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C", children: "+" }), _jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow", onClick: zoomReset, title: "\u041C\u0430\u0441\u0448\u0442\u0430\u0431 100%", children: "100%" }), _jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow", onClick: zoomFitWidth, title: "\u041F\u043E\u0434\u043E\u0433\u043D\u0430\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u0443 \u043B\u0438\u0441\u0442\u0430 \u043A \u043E\u043A\u043D\u0443 \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430", children: "\u041F\u043E \u0448\u0438\u0440\u0438\u043D\u0435" })] }), _jsxs("div", { className: "tt-inv-preview__pdf-toolbar-pages", "aria-live": "polite", children: ["\u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 ", activePage, "\u00A0/\u00A0", pageCount] })] }), _jsx("div", { ref: sheetStackRef, className: "tt-inv-preview__sheet-stack", "aria-label": "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442, \u043F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u0430 \u043A\u043E\u043B\u0451\u0441\u0438\u043A\u043E\u043C \u043C\u044B\u0448\u0438 \u0438\u043B\u0438 \u0436\u0435\u0441\u0442\u0430\u043C\u0438", children: _jsxs("div", { className: "tt-inv-preview__pages", style: pagesZoomStyle, children: [!coverModel
                                                ? (_jsxs(_Fragment, { children: [_jsx(InvoicePageSkeleton, { type: "cover" }), _jsx(InvoicePageSkeleton, { type: "report" }), _jsx(InvoicePageSkeleton, { type: "invoice" })] }))
                                                : null, coverModel
                                                ? visiblePageSlots.map((slot, visibleIdx) => {
                                                    const pageNum = visibleIdx + 1;
                                                    const lastTr = timeReportChunks.length - 1;
                                                    if (slot.kind === 'cover') {
                                                        return (_jsx("div", { ref: (el) => {
                                                                pageRefs.current[visibleIdx] = el;
                                                            }, className: `tt-inv-a4-page tt-inv-a4-page--cover${editingPage === pageNum ? ' tt-inv-a4-page--editing' : ''}`, "aria-label": `Страница ${pageNum} из ${pageCount} — сопроводительное письмо${editingPage === pageNum ? ', режим редактирования' : ''}`, children: _jsx(InvoiceCoverLetter, { model: displayModel, editable: editingPage === pageNum, onChange: patchCoverModel }) }, slot.key));
                                                    }
                                                    if (slot.kind === 'timeReport') {
                                                        const chunk = timeReportChunks[slot.chunkIndex] ?? [];
                                                        return (_jsx("div", { ref: (el) => {
                                                                pageRefs.current[visibleIdx] = el;
                                                            }, className: `tt-inv-a4-page tt-inv-a4-page--timerpt${combinedReport ? ' tt-inv-a4-page--creport' : ''}${editingPage === pageNum ? ' tt-inv-a4-page--editing' : ''}`, "aria-label": `Страница ${pageNum} из ${pageCount} — time report${slot.chunkIndex > 0 ? ', продолжение' : ''}`, children: combinedReport
                                                                ? (_jsx(CombinedReportPage, { report: combinedReport, pageIndex: slot.chunkIndex, pageNumber: pageNum, editable: editingPage === pageNum, onChange: setCombinedReport }))
                                                                : (_jsx(InvoiceTimeReportPage, { model: displayModel, pack: resolvedTimeReportPack, pageNumber: pageNum, detailRows: chunk, continuation: slot.chunkIndex > 0, showDetailTotalRow: slot.chunkIndex === lastTr, showExpenseSection: slot.chunkIndex === lastTr, showMehnatSection: slot.chunkIndex === lastTr, showSummarySection: slot.chunkIndex === lastTr, showInitiatorName: showInitiatorName, editable: editingPage === pageNum, onPatchDetailRow: (rowIndex, field, value) => patchDetailRowInChunk(slot.chunkIndex, rowIndex, field, value), onPatchExpenseRow: patchExpenseRow, onPatchMehnatRow: patchMehnatRow, onPatchSummaryRow: patchSummaryRow, onPatchPack: patchTimeReportPack })) }, slot.key));
                                                    }
                                                    return (_jsx("div", { ref: (el) => {
                                                            pageRefs.current[visibleIdx] = el;
                                                        }, className: `tt-inv-a4-page tt-inv-a4-page--invoice${editingPage === pageNum ? ' tt-inv-a4-page--editing' : ''}`, "aria-label": `Страница ${pageNum} из ${pageCount} — счёт`, children: _jsx(InvoiceLegalInvoicePage, { model: displayModel, session: session, editable: editingPage === pageNum, legalOverrides: legalOverrides, onChangeLegalOverrides: patchLegalOverrides, onChangeModel: patchCoverModel }) }, slot.key));
                                                })
                                                : null] }) })] })] }) })] }));
}
