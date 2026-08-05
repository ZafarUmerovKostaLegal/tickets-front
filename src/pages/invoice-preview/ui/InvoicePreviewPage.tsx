import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { getInvoiceCreateUrl, getInvoiceDetailUrl } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings, SearchableSelect, useAppToast } from '@shared/ui';
import { getInvoice, loadFirmBankingProfiles, patchInvoice, pickFirmBankingProfileForCurrency } from '@entities/time-tracking/api';
import {
    readInvoicePreviewSession,
    writeInvoicePreviewSession,
} from '@entities/time-tracking/model/invoicePreviewSession';
import { firmBankingToLegalOverrides, applyFirmBankingProfileToLegalOverrides, profileDisplayTitle, type FirmBankingProfile } from '@entities/time-tracking/lib/firmBankingDetailsStorage';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { buildInvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { applyCoverLetterLanguage, type InvoiceCoverLanguage } from '../lib/invoiceCoverLetterI18n';
import { emptyInvoiceTimeReportPack, type InvoiceTimeReportDetailRow, type InvoiceTimeReportPack, type InvoiceTimeReportSummaryRow } from '../lib/invoiceTimeReportModel';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '../lib/invoicePreviewDownload';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { splitDetailRowsForPagedTimeReport } from '../lib/invoiceTimeReportChunking';
import { type InvoiceLegalPageOverrides } from '../lib/invoiceLegalPageModel';
import {
    applyCoverDocumentOverrides,
    buildInvoiceDocumentOverridesPayload,
    parseInvoiceDocumentOverrides,
    scrubStaleBillingPeriodDocumentOverrides,
    type InvoiceDocumentOverridesV1,
} from '../lib/invoiceDocumentOverrides';
import {
    buildInvoicePreviewPageSlots,
    normalizeIncludedPageKeys,
    pageKindLabelForSlot,
    type InvoicePreviewPageKey,
} from '../lib/invoicePreviewPageSlots';
import { resolveInvoiceCoverLetterModel } from '../lib/resolveInvoiceCoverLetterModel';
import { resolveInvoiceTimeReportPack } from '../lib/resolveInvoiceTimeReportPack';
import { InvoiceCoverLetter } from './InvoiceCoverLetter';
import { InvoiceTimeReportPage } from './InvoiceTimeReportPage';
import { InvoiceLegalInvoicePage } from './InvoiceLegalInvoicePage';
import '@fontsource/carlito/400.css';
import '@fontsource/carlito/700.css';
import '@pages/time-tracking/ui/TimePageShell.css';
import './InvoicePreviewPage.css';

const INV_PREVIEW_PAGE_BASE_PX = 794;

type InvoicePageSkeletonType = 'cover' | 'report' | 'invoice';
function InvoicePageSkeleton({ type }: { type: InvoicePageSkeletonType }) {
    return (
      <div className="tt-inv-skel-page" aria-hidden="true">
        {/* Header: logo + address */}
        <div className="tt-inv-skel-cover__header">
          <span className="tt-inv-skel-b tt-inv-skel-cover__logo"/>
          <div className="tt-inv-skel-cover__addr">
            {[90, 70, 80, 65].map((w, i) => (
              <span key={i} className="tt-inv-skel-b tt-inv-skel-cover__line" style={{ width: w, animationDelay: `${i * 0.05}s` }}/>
            ))}
          </div>
        </div>

        {type === 'cover' && (
          <>
            <span className="tt-inv-skel-b tt-inv-skel-cover__date" style={{ animationDelay: '0.05s' }}/>
            <div className="tt-inv-skel-cover__block">
              {[120, 90].map((w, i) => (
                <span key={i} className="tt-inv-skel-b tt-inv-skel-cover__line" style={{ width: w, animationDelay: `${0.08 + i * 0.04}s` }}/>
              ))}
            </div>
            <div className="tt-inv-skel-cover__block">
              {[100, 80].map((w, i) => (
                <span key={i} className="tt-inv-skel-b tt-inv-skel-cover__line" style={{ width: w, animationDelay: `${0.14 + i * 0.04}s` }}/>
              ))}
            </div>
            <div className="tt-inv-skel-cover__block" style={{ marginTop: 8 }}>
              {[160, 440, 380].map((w, i) => (
                <span key={i} className="tt-inv-skel-b tt-inv-skel-cover__line" style={{ width: w, animationDelay: `${0.2 + i * 0.04}s` }}/>
              ))}
            </div>
            <div className="tt-inv-skel-cover__block" style={{ marginTop: 16 }}>
              {[90].map((w, i) => (
                <span key={i} className="tt-inv-skel-b tt-inv-skel-cover__line" style={{ width: w, animationDelay: `${0.3 + i * 0.04}s` }}/>
              ))}
            </div>
            <div className="tt-inv-skel-cover__block" style={{ marginTop: 32 }}>
              {[130, 60].map((w, i) => (
                <span key={i} className="tt-inv-skel-b tt-inv-skel-cover__line" style={{ width: w, animationDelay: `${0.36 + i * 0.04}s` }}/>
              ))}
            </div>
          </>
        )}

        {(type === 'report' || type === 'invoice') && (
          <>
            {/* Table */}
            <div style={{ marginTop: 28 }}>
              <div className="tt-inv-skel-table__head tt-inv-skel-b" style={{ animationDelay: '0.04s' }}>
                {[60, 40, 120, 180, 55, 60, 70].map((w, i) => (
                  <span key={i} className="tt-inv-skel-table__head-cell" style={{ width: w }}/>
                ))}
              </div>
              {Array.from({ length: type === 'report' ? 12 : 5 }, (_, i) => (
                <div key={i} className="tt-inv-skel-table__row" style={{ animationDelay: `${0.04 + i * 0.03}s` }}>
                  {[60, 40, 120, 180, 55, 60, 70].map((w, j) => (
                    <span key={j} className="tt-inv-skel-b tt-inv-skel-table__cell" style={{ width: w, animationDelay: `${0.04 + i * 0.03 + j * 0.01}s` }}/>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
}
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 250;
const SHEET_ZOOM_STEP = 10;

function fallbackCoverModel(): InvoiceCoverLetterModel {
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

function globalDetailRowOffset(chunks: InvoiceTimeReportDetailRow[][], chunkIndex: number): number {
    let offset = 0;
    for (let c = 0; c < chunkIndex; c += 1)
        offset += chunks[c]?.length ?? 0;
    return offset;
}

export function InvoicePreviewPage() {
    const { pushToast } = useAppToast();
    const location = useLocation();
    const [downloadBusy, setDownloadBusy] = useState<'word' | 'pdf' | 'page' | null>(null);
    const [saveBusy, setSaveBusy] = useState(false);
    // Stabilize session identity — readInvoicePreviewSession() returns a new object every call;
    // using it bare in effect deps cancels pack loading on every re-render (empty tables, PDF still works).
    const session = useMemo(
        () => readInvoicePreviewSession(),
        [location.key, location.pathname],
    );
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [legalOverrides, setLegalOverrides] = useState<InvoiceLegalPageOverrides>(() => firmBankingToLegalOverrides());
    const [bankProfiles, setBankProfiles] = useState<FirmBankingProfile[]>([]);
    const [selectedBankProfileId, setSelectedBankProfileId] = useState<string>('');
    const userPickedBankRef = useRef(false);
    const pendingDocOverridesRef = useRef<InvoiceDocumentOverridesV1 | null>(null);
    const skipNextAutosaveRef = useRef(true);
    const includedPagesHydratedRef = useRef(false);
    const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
    const [includedPageKeys, setIncludedPageKeys] = useState<Set<InvoicePreviewPageKey> | null>(null);
    const [timeReportPack, setTimeReportPack] = useState<InvoiceTimeReportPack | null>(null);
    const sheetStackRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [activePage, setActivePage] = useState(1);
    const [sheetZoomPct, setSheetZoomPct] = useState(100);

    const displayModel = useMemo(() => coverModel ?? fallbackCoverModel(), [coverModel]);

    const pagesZoomStyle = useMemo(() => ({
        zoom: `${sheetZoomPct}%`,
    } as CSSProperties), [sheetZoomPct]);

    const scrollToPage = useCallback((page: number) => {
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

    const setCoverLanguage = useCallback((lang: InvoiceCoverLanguage) => {
        setCoverModel((prev) => applyCoverLetterLanguage(prev ?? fallbackCoverModel(), lang, issueDateIso));
        setLegalOverrides((prev) => ({
            ...prev,
            serviceDescriptionLine: null,
            paymentDisclaimer: null,
        }));
    }, [issueDateIso]);

    const patchCoverModel = useCallback((patch: Partial<InvoiceCoverLetterModel>) => {
        setCoverModel((prev) => ({
            ...(prev ?? fallbackCoverModel()),
            ...patch,
        }));
    }, []);

    const coverLanguage = displayModel.coverLanguage ?? 'ENG';

    const patchLegalOverrides = useCallback((patch: Partial<InvoiceLegalPageOverrides>) => {
        setLegalOverrides((prev) => ({ ...prev, ...patch }));
    }, []);

    const applyBankProfile = useCallback((profile: FirmBankingProfile | null, opts?: { userInitiated?: boolean }) => {
        if (opts?.userInitiated)
            userPickedBankRef.current = true;
        setSelectedBankProfileId(profile?.id ?? '');
        setLegalOverrides((prev) => applyFirmBankingProfileToLegalOverrides(prev, profile));
    }, []);

    const applyDocumentOverridesToState = useCallback((doc: InvoiceDocumentOverridesV1 | null | undefined, metaInvoiceNumber?: string | null) => {
        if (!doc)
            return;
        pendingDocOverridesRef.current = doc;
        userPickedBankRef.current = true;
        skipNextAutosaveRef.current = true;
        if (doc.includedPageKeys?.length) {
            includedPagesHydratedRef.current = true;
            setIncludedPageKeys(new Set(doc.includedPageKeys));
        }
        setLegalOverrides((prev) => ({
            ...prev,
            ...(doc.legal ?? {}),
            invoiceNumber: (doc.legal?.invoiceNumber ?? metaInvoiceNumber ?? prev.invoiceNumber) || null,
        }));
        if (doc.cover) {
            setCoverModel((prev) => (prev ? applyCoverDocumentOverrides(prev, doc.cover) : prev));
        }
        if (doc.timeReport) {
            setTimeReportPack(doc.timeReport);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        userPickedBankRef.current = false;
        pendingDocOverridesRef.current = null;
        skipNextAutosaveRef.current = true;
        includedPagesHydratedRef.current = false;
        setInvoiceStatus(null);
        setIncludedPageKeys(null);
        setLegalOverrides(firmBankingToLegalOverrides());
        const sessionNow = readInvoicePreviewSession();
        (async () => {
            const profiles = await loadFirmBankingProfiles({ migrateLocal: true });
            if (cancelled)
                return;
            setBankProfiles(profiles);

            let docFromApi: InvoiceDocumentOverridesV1 | null = null;
            if (sessionNow?.mode === 'existing') {
                try {
                    const inv = await getInvoice(sessionNow.invoiceId, false);
                    if (cancelled)
                        return;
                    setInvoiceStatus(String(inv.status ?? '').toLowerCase() || null);
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
                ? (sessionNow.meta.issueDateIso ?? null)
                : (sessionNow?.mode === 'create' ? sessionNow.form.issueDate : null);
            const doc = issueIso
                ? scrubStaleBillingPeriodDocumentOverrides(rawDoc, {
                    issueDateIso: issueIso,
                    billingPeriodIso: periodIso,
                })
                : rawDoc;

            const picked = pickFirmBankingProfileForCurrency(profiles, null);
            if (picked && !doc?.legal)
                applyBankProfile(picked);
            else if (picked)
                setSelectedBankProfileId(picked.id);

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
        if (picked && picked.id !== selectedBankProfileId)
            applyBankProfile(picked);
    }, [coverModel, bankProfiles, selectedBankProfileId, applyBankProfile]);

    const persistPreviewEdits = useCallback(async (opts?: { silent?: boolean }) => {
        if (!session || !coverModel)
            return false;
        const pack = timeReportPack ?? emptyInvoiceTimeReportPack(packCurrencyCode(coverModel));
        const trChunks = splitDetailRowsForPagedTimeReport(pack.detailSlots);
        const slots = buildInvoicePreviewPageSlots(trChunks.length);
        const included = normalizeIncludedPageKeys(includedPageKeys, slots);
        const doc = buildInvoiceDocumentOverridesPayload({
            legal: legalOverrides,
            cover: coverModel,
            timeReport: pack,
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
                documentOverrides: doc as unknown as Record<string, unknown>,
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
            const body: Parameters<typeof patchInvoice>[1] = {
                documentOverrides: doc as unknown as Record<string, unknown>,
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
                    ?? doc) as Record<string, unknown>,
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
    }, [session, coverModel, timeReportPack, legalOverrides, includedPageKeys, invoiceStatus, pushToast]);

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
    }, [editMode, session, coverModel, legalOverrides, timeReportPack, includedPageKeys, persistPreviewEdits]);

    const editingPage = editMode ? activePage : null;

    const timeReportFallback = useMemo(
        () => emptyInvoiceTimeReportPack(packCurrencyCode(displayModel)),
        [displayModel],
    );
    const resolvedTimeReportPack = timeReportPack ?? timeReportFallback;

    const timeReportChunks = useMemo(
        () => splitDetailRowsForPagedTimeReport(resolvedTimeReportPack.detailSlots),
        [resolvedTimeReportPack.detailSlots],
    );

    const allPageSlots = useMemo(
        () => buildInvoicePreviewPageSlots(timeReportChunks.length),
        [timeReportChunks.length],
    );

    const resolvedIncludedKeys = useMemo(
        () => normalizeIncludedPageKeys(includedPageKeys, allPageSlots),
        [includedPageKeys, allPageSlots],
    );

    const visiblePageSlots = useMemo(
        () => allPageSlots.filter((slot) => resolvedIncludedKeys.has(slot.key)),
        [allPageSlots, resolvedIncludedKeys],
    );

    const pageCount = visiblePageSlots.length;
    const fullPackPageCount = allPageSlots.length;

    const exportPageNumbers = useMemo(() => {
        const nums: number[] = [];
        allPageSlots.forEach((slot, idx) => {
            if (resolvedIncludedKeys.has(slot.key))
                nums.push(idx + 1);
        });
        return nums;
    }, [allPageSlots, resolvedIncludedKeys]);

    // Seed included pages once slots are known (after hydrate or fresh open).
    useEffect(() => {
        if (includedPagesHydratedRef.current && includedPageKeys != null)
            return;
        if (allPageSlots.length === 0)
            return;
        const pending = pendingDocOverridesRef.current?.includedPageKeys;
        if (pending?.length) {
            includedPagesHydratedRef.current = true;
            setIncludedPageKeys(normalizeIncludedPageKeys(pending, allPageSlots));
            return;
        }
        if (includedPageKeys == null) {
            setIncludedPageKeys(new Set(allPageSlots.map((s) => s.key)));
        }
    }, [allPageSlots, includedPageKeys]);

    const removePageKey = useCallback((key: InvoicePreviewPageKey) => {
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

    const restorePageKey = useCallback((key: InvoicePreviewPageKey) => {
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
        if (pendingDocOverridesRef.current?.timeReport) {
            setTimeReportPack(pendingDocOverridesRef.current.timeReport);
            return;
        }
        let cancel = false;
        void resolveInvoiceTimeReportPack(session, coverModel, {
            onPartnerConfirmationBlocked(message) {
                if (!cancel)
                    pushToast({ message, variant: 'warning' });
            },
        }).then((p) => {
            if (!cancel)
                setTimeReportPack(p);
        }).catch((err) => {
            console.error(err);
            if (!cancel)
                pushToast({ message: 'Не удалось загрузить time report для счёта', variant: 'error' });
        });
        return () => {
            cancel = true;
        };
    }, [session, coverLanguage, coverModel, pushToast]);

    const patchDetailRowInChunk = useCallback((chunkIndex: number, rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const chunks = splitDetailRowsForPagedTimeReport(base.detailSlots);
            const globalIdx = globalDetailRowOffset(chunks, chunkIndex) + rowIndex;
            const nextSlots = [...base.detailSlots];
            while (nextSlots.length <= globalIdx)
                nextSlots.push({ date: '', initials: '', task: '', description: '', hours: '', hourlyRate: '', amount: '' });
            nextSlots[globalIdx] = { ...nextSlots[globalIdx]!, [field]: value };
            return { ...base, detailSlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);

    const patchSummaryRow = useCallback((rowIndex: number, field: keyof InvoiceTimeReportSummaryRow, value: string) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const nextSlots = [...base.summarySlots];
            while (nextSlots.length <= rowIndex)
                nextSlots.push({ initials: '', name: '', title: '', hours: '', hourlyRate: '', totalPrice: '' });
            nextSlots[rowIndex] = { ...nextSlots[rowIndex]!, [field]: value };
            return { ...base, summarySlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);

    const patchExpenseRow = useCallback((rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const nextSlots = [...(base.expenseSlots ?? [])];
            while (nextSlots.length <= rowIndex)
                nextSlots.push({ date: '', initials: '', task: '', description: '', hours: '', hourlyRate: '', amount: '' });
            nextSlots[rowIndex] = { ...nextSlots[rowIndex]!, [field]: value };
            return { ...base, expenseSlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);

    const patchTimeReportPack = useCallback((patch: Partial<Pick<InvoiceTimeReportPack, 'detailTotalHoursDisplay' | 'detailTotalAmountDisplay' | 'expenseTotalAmountDisplay' | 'summaryGrandHoursDisplay' | 'summaryGrandAmountDisplay'>>) => {
        setTimeReportPack((prev) => ({ ...(prev ?? resolvedTimeReportPack), ...patch }));
    }, [resolvedTimeReportPack]);

    useEffect(() => {
        const root = sheetStackRef.current;
        if (!root)
            return;
        const els = pageRefs.current.filter((n): n is HTMLDivElement => n != null);
        if (els.length === 0)
            return;

        const obs = new IntersectionObserver(
            (entries) => {
                const best = entries
                    .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (!best?.target)
                    return;
                const idx = els.indexOf(best.target as HTMLDivElement);
                if (idx >= 0)
                    setActivePage(idx + 1);
            },
            { root, rootMargin: '-8% 0px -35% 0px', threshold: [0.1, 0.25, 0.45, 0.65, 0.85] },
        );

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
    }), [coverModel, session, resolvedTimeReportPack, legalOverrides, exportPageNumbers]);

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

    return (<div className="tt-inv-preview">
      <nav className="time-page__navbar tt-inv-preview__navbar" aria-label="Предпросмотр счёта">
        <AppBackButton to={backHref} hideLabelOnMobile />
        <AppHomeLogo withSeparator />
        <div className="time-page__navbar-sep" aria-hidden="true"/>
        <span className="time-page__navbar-title">Счета</span>
        <div className="time-page__navbar-sep" aria-hidden="true"/>
        <div className="time-page__navbar-tabs" role="tablist" aria-label="Текущий раздел">
          <span className="time-page__navbar-tab time-page__navbar-tab--active" role="tab" aria-selected="true" tabIndex={-1}>
            Предпросмотр
          </span>
        </div>
        <div className="time-page__navbar-spacer"/>
        <div className="tt-inv-preview__downloads" role="group" aria-label="Скачать предпросмотр">
          <button
            type="button"
            className="tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn"
            disabled={downloadBusy != null || !activeSlot}
            onClick={() => void handleDownloadActivePage()}
            title="Сохранить только текущую страницу в PDF"
          >
            {downloadBusy === 'page' ? 'Подготовка…' : 'Скачать страницу'}
          </button>
          <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn" disabled={downloadBusy != null || exportPageNumbers.length === 0} onClick={() => void handleDownloadPdf()}>
            {downloadBusy === 'pdf' ? 'Подготовка…' : 'Скачать PDF'}
          </button>
          <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-inv-preview__download-btn" disabled={downloadBusy != null || exportPageNumbers.length === 0} onClick={() => void handleDownloadWord()}>
            {downloadBusy === 'word' ? 'Подготовка…' : 'Скачать Word'}
          </button>
        </div>
        <div className="time-page__navbar-settings">
          <AppPageSettings />
        </div>
      </nav>

      <main className="tt-inv-preview__main">
        <div className="tt-inv-preview__viewer" aria-label="Область просмотра документа">
          <aside className="tt-inv-preview__thumbs" aria-label="Миниатюры страниц">
            <div className="tt-inv-preview__thumbs-head">
              <span className="tt-inv-preview__thumbs-title">Страницы</span>
              {coverModel
                ? (
                    <button type="button" className="tt-inv-preview__thumbs-all" onClick={selectAllPagesForExport} title="Восстановить все страницы">
                      Все
                    </button>
                  )
                : null}
            </div>
            {!coverModel
              ? (
                  [1, 2, 3].map((n) => (
                    <div key={n} className={`tt-inv-preview__thumb-wrap${n === 1 ? ' tt-inv-preview__thumb-wrap--active' : ''}`}>
                      <span className="tt-inv-preview__thumb-sheet" aria-hidden>
                        <span className="tt-inv-skel-thumb"/>
                      </span>
                      <div className="tt-inv-preview__thumb-meta">
                        <span className="tt-inv-preview__thumb-num">{n}</span>
                      </div>
                    </div>
                  ))
                )
              : null}
            {coverModel
              ? allPageSlots.map((slot) => {
                const included = resolvedIncludedKeys.has(slot.key);
                const visibleIdx = included
                    ? visiblePageSlots.findIndex((s) => s.key === slot.key)
                    : -1;
                const displayNum = visibleIdx >= 0 ? visibleIdx + 1 : null;
                const isActive = included && displayNum === activePage;
                const lastTr = timeReportChunks.length - 1;
                return (
                  <div
                    key={slot.key}
                    className={`tt-inv-preview__thumb-wrap${isActive ? ' tt-inv-preview__thumb-wrap--active' : ''}${!included ? ' tt-inv-preview__thumb-wrap--off tt-inv-preview__thumb-wrap--deleted' : ''}`}
                  >
                    <button
                      type="button"
                      className={`tt-inv-preview__thumb${isActive ? ' tt-inv-preview__thumb--active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={`${pageKindLabelForSlot(slot)}${included ? '' : ', удалена'}`}
                      disabled={!included}
                      onClick={() => {
                          if (displayNum != null)
                              scrollToPage(displayNum);
                      }}
                    >
                      <span className="tt-inv-preview__thumb-sheet" aria-hidden>
                        <span className="tt-inv-preview__thumb-scale">
                          {slot.kind === 'cover'
                            ? (
                                <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--letter">
                                  <InvoiceCoverLetter model={displayModel}/>
                                </div>
                              )
                            : slot.kind === 'timeReport' && timeReportChunks[slot.chunkIndex]
                              ? (
                                  <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--timerpt">
                                    <InvoiceTimeReportPage
                                      model={displayModel}
                                      pack={resolvedTimeReportPack}
                                      pageNumber={2 + slot.chunkIndex}
                                      detailRows={timeReportChunks[slot.chunkIndex]}
                                      continuation={slot.chunkIndex > 0}
                                      showDetailTotalRow={slot.chunkIndex === lastTr}
                                      showExpenseSection={slot.chunkIndex === lastTr}
                                      showSummarySection={slot.chunkIndex === lastTr}
                                    />
                                  </div>
                                )
                              : slot.kind === 'invoice'
                                ? (
                                    <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--invoice">
                                      <InvoiceLegalInvoicePage model={displayModel} session={session} legalOverrides={legalOverrides}/>
                                    </div>
                                  )
                                : (
                                    <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--blank" aria-hidden/>
                                  )}
                        </span>
                      </span>
                    </button>
                    <div className="tt-inv-preview__thumb-meta">
                      {included
                        ? (
                            <button
                              type="button"
                              className="tt-inv-preview__thumb-remove"
                              title={`Удалить страницу «${pageKindLabelForSlot(slot)}» из счёта`}
                              aria-label={`Удалить страницу «${pageKindLabelForSlot(slot)}»`}
                              onClick={() => removePageKey(slot.key)}
                            >
                              ×
                            </button>
                          )
                        : (
                            <button
                              type="button"
                              className="tt-inv-preview__thumb-restore"
                              title={`Вернуть страницу «${pageKindLabelForSlot(slot)}»`}
                              aria-label={`Вернуть страницу «${pageKindLabelForSlot(slot)}»`}
                              onClick={() => restorePageKey(slot.key)}
                            >
                              ↩
                            </button>
                          )}
                      <span className="tt-inv-preview__thumb-num">
                        {included ? displayNum : '—'}
                      </span>
                    </div>
                  </div>
                );
            })
              : null}
          </aside>

          <div className="tt-inv-preview__stage">
            <div className="tt-inv-preview__pdf-toolbar" role="toolbar" aria-label="Просмотр документа" title={pdfToolbarTip}>
              <div className="tt-inv-preview__pdf-toolbar-meta">
                <span className="tt-inv-preview__pdf-toolbar-doc" title={toolbarTitle}>{toolbarTitle}</span>
                {!coverModel ? <span className="tt-inv-preview__pdf-toolbar-status" role="status">Загрузка…</span> : null}
                <span className="tt-inv-preview__pdf-toolbar-export" title="Страницы, входящие в счёт">
                  В счёте: {exportSelectionLabel}
                </span>
                <div className="tt-inv-preview__lang-toggle" role="group" aria-label="Язык документа">
                  <button
                    type="button"
                    className={`tt-inv-preview__lang-btn${coverLanguage === 'ENG' ? ' tt-inv-preview__lang-btn--active' : ''}`}
                    aria-pressed={coverLanguage === 'ENG'}
                    disabled={!coverModel}
                    onClick={() => setCoverLanguage('ENG')}
                    title="English cover letter"
                  >
                    ENG
                  </button>
                  <button
                    type="button"
                    className={`tt-inv-preview__lang-btn${coverLanguage === 'RU' ? ' tt-inv-preview__lang-btn--active' : ''}`}
                    aria-pressed={coverLanguage === 'RU'}
                    disabled={!coverModel}
                    onClick={() => setCoverLanguage('RU')}
                    title="Сопроводительное письмо на русском"
                  >
                    RU
                  </button>
                </div>
                {bankProfiles.length > 0 ? (
                  <div className="tt-inv-preview__bank-select" title="Банковские реквизиты на странице счёта">
                    <span className="tt-inv-preview__bank-select-label" id="tt-inv-bank-select-lbl">Реквизиты</span>
                    <SearchableSelect<FirmBankingProfile>
                      className="tt-inv-preview__bank-dd"
                      buttonClassName="tt-inv-preview__bank-dd-btn"
                      value={selectedBankProfileId}
                      items={bankProfiles}
                      getOptionValue={(p) => p.id}
                      getOptionLabel={(p) => {
                          const title = profileDisplayTitle(p, 'Без названия');
                          const bits = [title];
                          if (p.isDefault)
                              bits.push('по умолчанию');
                          if (p.accountCurrency.trim())
                              bits.push(p.accountCurrency.trim());
                          return bits.join(' · ');
                      }}
                      getSearchText={(p) => [
                          p.title,
                          p.bankName,
                          p.accountCurrency,
                          p.accountNumber,
                          p.swift,
                      ].filter(Boolean).join(' ')}
                      renderButtonContent={(p) => (
                        <span className="tt-inv-preview__bank-dd-btn-text">
                          <span className="tt-inv-preview__bank-dd-btn-title">
                            {profileDisplayTitle(p, 'Без названия')}
                          </span>
                          {p.accountCurrency.trim() ? (
                            <span className="tt-inv-preview__bank-dd-btn-meta">{p.accountCurrency.trim()}</span>
                          ) : null}
                        </span>
                      )}
                      renderOption={(p, { selected }) => (
                        <span className={`tt-inv-preview__bank-dd-opt${selected ? ' tt-inv-preview__bank-dd-opt--selected' : ''}`}>
                          <span className="tt-inv-preview__bank-dd-opt-title">
                            {profileDisplayTitle(p, 'Без названия')}
                            {p.isDefault ? (
                              <span className="tt-inv-preview__bank-dd-opt-badge">по умолчанию</span>
                            ) : null}
                          </span>
                          <span className="tt-inv-preview__bank-dd-opt-meta">
                            {[p.accountCurrency, p.bankName, p.accountNumber].map((x) => x.trim()).filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      )}
                      onSelect={(p) => applyBankProfile(p, { userInitiated: true })}
                      placeholder="Выберите реквизиты"
                      emptyListText="Нет реквизитов"
                      noMatchText="Ничего не найдено"
                      disabled={!coverModel}
                      portalDropdown
                      portalZIndex={12000}
                      portalMinWidth={280}
                      portalDropdownClassName="tt-inv-preview__bank-dd-menu"
                      aria-labelledby="tt-inv-bank-select-lbl"
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-edit-btn"
                  onClick={() => void handleSaveActivePageEdits()}
                  disabled={!coverModel || saveBusy || downloadBusy != null}
                  title="Сохранить правки документа (включая состав страниц)"
                >
                  {saveBusy ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  className={`tt-inv-preview__pdf-toolbar-edit-btn${isEditingActivePage ? ' tt-inv-preview__pdf-toolbar-edit-btn--active' : ''}`}
                  onClick={togglePageEdit}
                  disabled={!coverModel || saveBusy}
                  aria-pressed={isEditingActivePage}
                  title={editMode ? 'Сохранить и завершить редактирование' : `Редактировать страницу ${activePage}`}
                >
                  {editMode ? 'Готово' : 'Редактировать'}
                </button>
              </div>
              <div className="tt-inv-preview__pdf-toolbar-zoom" role="group" aria-label="Масштаб страницы документа">
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn"
                  onClick={zoomOut}
                  disabled={sheetZoomPct <= SHEET_ZOOM_MIN}
                  aria-label="Уменьшить масштаб страницы"
                  title="Уменьшить"
                >
                  −
                </button>
                <span className="tt-inv-preview__pdf-toolbar-zoom-val" aria-live="polite">{sheetZoomPct}%</span>
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn"
                  onClick={zoomIn}
                  disabled={sheetZoomPct >= SHEET_ZOOM_MAX}
                  aria-label="Увеличить масштаб страницы"
                  title="Увеличить"
                >
                  +
                </button>
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow"
                  onClick={zoomReset}
                  title="Масштаб 100%"
                >
                  100%
                </button>
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow"
                  onClick={zoomFitWidth}
                  title="Подогнать ширину листа к окну просмотра"
                >
                  По ширине
                </button>
              </div>
              <div className="tt-inv-preview__pdf-toolbar-pages" aria-live="polite">
                страница {activePage}&nbsp;/&nbsp;{pageCount}
              </div>
            </div>
            <div ref={sheetStackRef} className="tt-inv-preview__sheet-stack" aria-label="Документ, прокрутка колёсиком мыши или жестами">
              <div className="tt-inv-preview__pages" style={pagesZoomStyle}>
                {!coverModel
                  ? (
                      <>
                        <InvoicePageSkeleton type="cover"/>
                        <InvoicePageSkeleton type="report"/>
                        <InvoicePageSkeleton type="invoice"/>
                      </>
                    )
                  : null}
                {coverModel
                  ? visiblePageSlots.map((slot, visibleIdx) => {
                      const pageNum = visibleIdx + 1;
                      const lastTr = timeReportChunks.length - 1;
                      if (slot.kind === 'cover') {
                          return (
                            <div
                              key={slot.key}
                              ref={(el) => {
                                pageRefs.current[visibleIdx] = el;
                              }}
                              className={`tt-inv-a4-page tt-inv-a4-page--cover${editingPage === pageNum ? ' tt-inv-a4-page--editing' : ''}`}
                              aria-label={`Страница ${pageNum} из ${pageCount} — сопроводительное письмо${editingPage === pageNum ? ', режим редактирования' : ''}`}
                            >
                              <InvoiceCoverLetter
                                model={displayModel}
                                editable={editingPage === pageNum}
                                onChange={patchCoverModel}
                              />
                            </div>
                          );
                      }
                      if (slot.kind === 'timeReport') {
                          const chunk = timeReportChunks[slot.chunkIndex] ?? [];
                          return (
                            <div
                              key={slot.key}
                              ref={(el) => {
                                pageRefs.current[visibleIdx] = el;
                              }}
                              className={`tt-inv-a4-page tt-inv-a4-page--timerpt${editingPage === pageNum ? ' tt-inv-a4-page--editing' : ''}`}
                              aria-label={`Страница ${pageNum} из ${pageCount} — time report${slot.chunkIndex > 0 ? ', продолжение' : ''}`}
                            >
                              <InvoiceTimeReportPage
                                model={displayModel}
                                pack={resolvedTimeReportPack}
                                pageNumber={pageNum}
                                detailRows={chunk}
                                continuation={slot.chunkIndex > 0}
                                showDetailTotalRow={slot.chunkIndex === lastTr}
                                showExpenseSection={slot.chunkIndex === lastTr}
                                showSummarySection={slot.chunkIndex === lastTr}
                                editable={editingPage === pageNum}
                                onPatchDetailRow={(rowIndex, field, value) => patchDetailRowInChunk(slot.chunkIndex, rowIndex, field, value)}
                                onPatchExpenseRow={patchExpenseRow}
                                onPatchSummaryRow={patchSummaryRow}
                                onPatchPack={patchTimeReportPack}
                              />
                            </div>
                          );
                      }
                      return (
                        <div
                          key={slot.key}
                          ref={(el) => {
                            pageRefs.current[visibleIdx] = el;
                          }}
                          className={`tt-inv-a4-page tt-inv-a4-page--invoice${editingPage === pageNum ? ' tt-inv-a4-page--editing' : ''}`}
                          aria-label={`Страница ${pageNum} из ${pageCount} — счёт`}
                        >
                          <InvoiceLegalInvoicePage
                            model={displayModel}
                            session={session}
                            editable={editingPage === pageNum}
                            legalOverrides={legalOverrides}
                            onChangeLegalOverrides={patchLegalOverrides}
                            onChangeModel={patchCoverModel}
                          />
                        </div>
                      );
                  })
                  : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>);
}
