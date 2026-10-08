import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getInvoicesListUrl, routes } from '@shared/config';
import { buildInvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '@pages/invoice-preview/lib/invoicePreviewDownload';
import { DatePicker } from '@shared/ui/DatePicker';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppDialog, useAppToast } from '@shared/ui';
import { useI18n, ttInvoiceSendActionLabel, ttInvoiceStatusLabel } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { invoiceCreatedBeforeAllSignatures } from '@pages/time-tracking/lib/partnerConfirmedInvoice';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { getInvoice, patchInvoice, sendInvoice, unsendInvoice, createInvoiceOutlookDraft, getInvoiceOutlookDraftStatus, markInvoiceViewed, registerInvoicePayment, submitInvoicePaymentConfirmation, cancelInvoice, deleteDraftInvoice, listAllTimeManagerClientsMerged, getTimeManagerClient, INVOICE_STATUS_BADGE_CLASS, invoiceCanSend, invoiceCanMarkViewed, invoiceCanRegisterPayment, invoiceCanCancel, invoiceCanUnsend, invoiceCanDeleteDraft, invoiceCanPatchDraft, writeInvoicePreviewSession, mergeInvoiceDtoAfterPayment, isTimeTrackingHttpError, } from '@entities/time-tracking';
import { isActiveTimeManagerClientRow } from '@entities/time-tracking/lib/projectTimeEntry';
import { getCalendarStatus, invalidateCalendarApiCache, reconnectOutlookCalendar, } from '@entities/todo/lib/calendarApi';
import { InvoiceSendContactModal } from './InvoiceSendContactModal';
import { invoiceDescriptionWithTask } from '../lib/invoiceClientDescription';
import { invoiceClientMailSignature, rasterizePublicLogoPng } from '../lib/invoiceClientMailSignature';
import { blobToBase64, buildPaidAtForPaymentApi, escapeHtml, fmtDisplayDate, fmtMoney, invoiceLineKindLabel, invoiceLineKindSlug, invoicePreviewMetaForExisting, buildExistingInvoicePdfFile, notifyAccountingLastInvoicePage, notifyReportsInvalidated, openOutlookComposePopup, parseMoneyRu, parseOptionalPercentField, summarizeBilledOverrideLines, } from '../lib/invoicePageShared';
import { invoiceDisplayMoneyTotals, invoiceExpenseLineDisplayAmounts, loadInvoiceExpenseRegistryUsd, } from '../lib/invoiceExpenseLineDisplay';
import './TimeTrackingPage.css';
import './TimesheetPanel.css';
import './TimeTrackingForms.css';
import './InvoicePage.css';
export function InvoiceDetailPage() {
    const { invoiceId: invoiceIdParam } = useParams();
    const invoiceId = (invoiceIdParam ?? '').trim();
    const [searchParams] = useSearchParams();
    const accountingVariant = searchParams.get('variant') === 'accounting';
    const readOnly = accountingVariant;
    const { t, locale } = useI18n();
    const { user, loading: userLoading } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const { pushToast } = useAppToast();
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(true);
    const paySectionRef = useRef(null);
    const [payOpen, setPayOpen] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [payAt, setPayAt] = useState('');
    const [payMethod, setPayMethod] = useState('');
    const [payNote, setPayNote] = useState('');
    const [paymentConfirmDocUrl, setPaymentConfirmDocUrl] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [sendContactOpen, setSendContactOpen] = useState(false);
    const [outlookSendWait, setOutlookSendWait] = useState(null);
    const outlookWaitAbortRef = useRef(null);
    const sendAbortRef = useRef(null);
    const [detailExportBusy, setDetailExportBusy] = useState(null);
    const [draftIssueDate, setDraftIssueDate] = useState('');
    const [draftDueDate, setDraftDueDate] = useState('');
    const [draftTaxPct, setDraftTaxPct] = useState('');
    const [draftTax2Pct, setDraftTax2Pct] = useState('');
    const [draftDiscAmt, setDraftDiscAmt] = useState('');
    const [expenseRegistryUsd, setExpenseRegistryUsd] = useState(() => new Map());
    const clientNameById = useMemo(() => {
        const m = new Map();
        clients.forEach((c) => m.set(String(c.id), c.name));
        return m;
    }, [clients]);
    const billedLinesSummary = useMemo(() => summarizeBilledOverrideLines(detail?.lines, detail?.currency), [detail?.lines, detail?.currency]);
    /** KPI: expense lines at registry USD — keep total and balance on the same basis. */
    const displayMoney = useMemo(() => {
        if (!detail)
            return { totalAmount: 0, balanceDue: 0 };
        return invoiceDisplayMoneyTotals(detail, expenseRegistryUsd);
    }, [detail, expenseRegistryUsd]);
    const displayTotalAmount = displayMoney.totalAmount;
    const displayBalanceDue = displayMoney.balanceDue;
    const listHref = getInvoicesListUrl(accountingVariant ? { variant: 'accounting' } : undefined);
    const toInvoices = () => {
        void navigate(listHref);
    };
    useEffect(() => {
        listAllTimeManagerClientsMerged(false)
            .then((rows) => setClients(rows.filter(isActiveTimeManagerClientRow)))
            .catch(() => setClients([]));
    }, []);
    useEffect(() => {
        if (!payOpen)
            return;
        const el = paySectionRef.current;
        if (!el)
            return;
        requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const amountInput = el.querySelector('input');
            if (amountInput instanceof HTMLInputElement)
                amountInput.focus();
        });
    }, [payOpen]);
    useEffect(() => {
        setPaymentConfirmDocUrl('');
    }, [invoiceId]);
    useEffect(() => {
        if (!invoiceId) {
            setDetail(null);
            setDetailLoading(false);
            setExpenseRegistryUsd(new Map());
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        setDetail(null);
        setExpenseRegistryUsd(new Map());
        void getInvoice(invoiceId, true)
            .then(async (inv) => {
            if (cancelled)
                return;
            const registry = await loadInvoiceExpenseRegistryUsd(inv.lines);
            if (cancelled)
                return;
            const money = invoiceDisplayMoneyTotals(inv, registry);
            setExpenseRegistryUsd(registry);
            setDetail({
                ...inv,
                totalAmount: money.totalAmount,
                balanceDue: money.balanceDue,
            });
        })
            .catch(() => {
            if (!cancelled)
                setDetail(null);
        })
            .finally(() => {
            if (!cancelled)
                setDetailLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [invoiceId]);
    useEffect(() => {
        if (!detail || detail.status !== 'draft')
            return;
        setDraftIssueDate((detail.issueDate ?? '').slice(0, 10));
        setDraftDueDate((detail.dueDate ?? '').slice(0, 10));
        setDraftTaxPct(detail.taxPercent != null ? String(detail.taxPercent) : '');
        setDraftTax2Pct(detail.tax2Percent != null ? String(detail.tax2Percent) : '');
        setDraftDiscAmt(detail.discountAmount != null && detail.discountAmount > 0
            ? String(detail.discountAmount)
            : '');
    }, [detail]);
    useEffect(() => () => {
        outlookWaitAbortRef.current?.abort();
    }, []);
    const refreshDetail = useCallback(async (id) => {
        const inv = await getInvoice(id, true);
        const registry = await loadInvoiceExpenseRegistryUsd(inv.lines);
        const money = invoiceDisplayMoneyTotals(inv, registry);
        setExpenseRegistryUsd(registry);
        setDetail({
            ...inv,
            totalAmount: money.totalAmount,
            balanceDue: money.balanceDue,
        });
        notifyReportsInvalidated();
    }, []);
    const trackOutlookSendAndMarkInvoice = useCallback(async (opts) => {
        outlookWaitAbortRef.current?.abort();
        const ac = new AbortController();
        outlookWaitAbortRef.current = ac;
        setOutlookSendWait({ invoiceId: opts.invoiceId, label: opts.label });
        pushToast({
            message: t('timeTrackingPage.invoices.sendDialog.outlookWaitingSend').replace('{invoice}', opts.label),
            variant: 'info',
        });
        const createdAfter = new Date(Date.now() - 120_000).toISOString();
        const startedAt = Date.now();
        let missingSince = null;
        const maxMs = 15 * 60_000;
        const missingGraceMs = 90_000;
        const pollMs = 3000;
        const sleep = (ms) => new Promise((resolve) => {
            const timer = window.setTimeout(() => resolve(), ms);
            ac.signal.addEventListener('abort', () => {
                window.clearTimeout(timer);
                resolve();
            }, { once: true });
        });
        try {
            while (!ac.signal.aborted && Date.now() - startedAt < maxMs) {
                const st = await getInvoiceOutlookDraftStatus(opts.invoiceId, {
                    messageId: opts.messageId,
                    subject: opts.subject,
                    createdAfter,
                });
                if (ac.signal.aborted)
                    return;
                if (st.state === 'sent') {
                    await sendInvoice(opts.invoiceId);
                    await refreshDetail(opts.invoiceId);
                    try {
                        await opts.afterSent?.();
                    }
                    catch (e) {
                        console.warn('invoice accounting last-page notify failed', e);
                    }
                    pushToast({
                        message: t('timeTrackingPage.invoices.sendDialog.outlookSentStatusUpdated').replace('{invoice}', opts.label),
                        variant: 'info',
                    });
                    return;
                }
                if (st.state === 'missing') {
                    if (missingSince == null)
                        missingSince = Date.now();
                    else if (Date.now() - missingSince >= missingGraceMs) {
                        pushToast({
                            message: t('timeTrackingPage.invoices.sendDialog.outlookDraftDiscarded').replace('{invoice}', opts.label),
                            variant: 'warning',
                        });
                        return;
                    }
                }
                else {
                    missingSince = null;
                }
                await sleep(pollMs);
            }
            if (!ac.signal.aborted) {
                pushToast({
                    message: t('timeTrackingPage.invoices.sendDialog.outlookWaitTimeout').replace('{invoice}', opts.label),
                    variant: 'warning',
                });
            }
        }
        catch (e) {
            if (ac.signal.aborted)
                return;
            const msg = e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic');
            pushToast({ message: msg, variant: 'error' });
        }
        finally {
            if (outlookWaitAbortRef.current === ac) {
                outlookWaitAbortRef.current = null;
                setOutlookSendWait(null);
            }
        }
    }, [pushToast, refreshDetail, t]);
    const openExistingInvoicePreview = useCallback((inv) => {
        void (async () => {
            try {
                const clientLabel = (clientNameById.get(inv.clientId) ?? inv.clientId).trim();
                const meta = await invoicePreviewMetaForExisting(inv, clientLabel);
                let documentOverrides = inv.documentOverrides ?? undefined;
                if (documentOverrides === undefined) {
                    try {
                        const fresh = await getInvoice(inv.id, false);
                        documentOverrides = fresh.documentOverrides ?? undefined;
                    }
                    catch {
                        documentOverrides = undefined;
                    }
                }
                const { parseInvoiceDocumentOverrides, scrubStaleBillingPeriodDocumentOverrides } = await import('@pages/invoice-preview/lib/invoiceDocumentOverrides');
                const periodIso = meta.billingPeriodTo || meta.billingPeriodFrom || null;
                const scrubbed = scrubStaleBillingPeriodDocumentOverrides(parseInvoiceDocumentOverrides(documentOverrides), {
                    issueDateIso: meta.issueDateIso ?? inv.issueDate.slice(0, 10),
                    billingPeriodIso: periodIso,
                });
                writeInvoicePreviewSession({
                    v: 1,
                    mode: 'existing',
                    invoiceId: inv.id,
                    meta,
                    ...(scrubbed ? { documentOverrides: scrubbed } : {}),
                });
                navigate(routes.timeTrackingInvoicePreview);
            }
            catch (e) {
                await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.previewFailed') });
            }
        })();
    }, [clientNameById, navigate, showAlert, t]);
    const handleDetailDownloadPdf = useCallback(async (inv) => {
        setDetailExportBusy('pdf');
        try {
            const fresh = inv.documentOverrides != null ? inv : await getInvoice(inv.id, false);
            const { applyCoverDocumentOverrides, parseInvoiceDocumentOverrides, scrubStaleBillingPeriodDocumentOverrides } = await import('@pages/invoice-preview/lib/invoiceDocumentOverrides');
            const clientLabel = (clientNameById.get(fresh.clientId) ?? fresh.clientId).trim();
            const meta = await invoicePreviewMetaForExisting(fresh, clientLabel);
            const periodIso = meta.billingPeriodTo || meta.billingPeriodFrom || null;
            const doc = scrubStaleBillingPeriodDocumentOverrides(parseInvoiceDocumentOverrides(fresh.documentOverrides), {
                issueDateIso: meta.issueDateIso ?? fresh.issueDate.slice(0, 10),
                billingPeriodIso: periodIso,
            });
            const client = await getTimeManagerClient(fresh.clientId);
            const displayTotal = invoiceDisplayMoneyTotals(fresh, await loadInvoiceExpenseRegistryUsd(fresh.lines)).totalAmount;
            const model = applyCoverDocumentOverrides(buildInvoiceCoverLetterModel({
                issueDateIso: fresh.issueDate.slice(0, 10),
                billingPeriodIso: periodIso ?? fresh.issueDate.slice(0, 10),
                clientName: client.name,
                clientAddress: client.address,
                contactName: client.contact_name ?? null,
                totalAmount: displayTotal,
                currency: fresh.currency,
            }), doc?.cover);
            if (doc?.legal?.invoiceNumber?.trim())
                meta.invoiceNumber = doc.legal.invoiceNumber.trim();
            const previewSession = {
                v: 1,
                mode: 'existing',
                invoiceId: fresh.id,
                meta,
                ...(doc ? { documentOverrides: doc } : {}),
            };
            const { buildInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewPdf');
            const { splitDetailRowsForPagedTimeReport } = await import('@pages/invoice-preview/lib/invoiceTimeReportChunking');
            const { pageNumbersForIncludedKeys } = await import('@pages/invoice-preview/lib/invoicePreviewPageSlots');
            const trChunks = doc?.combinedReport
                ? 1
                : (doc?.timeReport
                    ? splitDetailRowsForPagedTimeReport(doc.timeReport.detailSlots).length
                    : 1);
            const blob = await buildInvoicePreviewPdfBlob({
                model,
                session: previewSession,
                timeReportPack: doc?.timeReport ?? undefined,
                legalOverrides: doc?.legal ?? undefined,
                combinedReport: doc?.combinedReport,
                selectedPageNumbers: pageNumbersForIncludedKeys(doc?.includedPageKeys, trChunks),
            });
            const base = buildInvoicePreviewExportBasename({
                invoiceNumber: fresh.invoiceNumber,
                clientLabel: clientNameById.get(fresh.clientId) ?? fresh.clientId,
                issueDateIso: fresh.issueDate.slice(0, 10),
            });
            triggerBrowserDownload(blob, `${base}.pdf`);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.pdfFailed') });
        }
        finally {
            setDetailExportBusy(null);
        }
    }, [clientNameById, showAlert, t]);
    const handleDetailDownloadWord = useCallback(async (inv) => {
        setDetailExportBusy('word');
        try {
            const fresh = inv.documentOverrides != null ? inv : await getInvoice(inv.id, false);
            const { applyCoverDocumentOverrides, parseInvoiceDocumentOverrides, scrubStaleBillingPeriodDocumentOverrides } = await import('@pages/invoice-preview/lib/invoiceDocumentOverrides');
            const clientLabel = (clientNameById.get(fresh.clientId) ?? fresh.clientId).trim();
            const meta = await invoicePreviewMetaForExisting(fresh, clientLabel);
            const periodIso = meta.billingPeriodTo || meta.billingPeriodFrom || null;
            const doc = scrubStaleBillingPeriodDocumentOverrides(parseInvoiceDocumentOverrides(fresh.documentOverrides), {
                issueDateIso: meta.issueDateIso ?? fresh.issueDate.slice(0, 10),
                billingPeriodIso: periodIso,
            });
            const client = await getTimeManagerClient(fresh.clientId);
            const displayTotal = invoiceDisplayMoneyTotals(fresh, await loadInvoiceExpenseRegistryUsd(fresh.lines)).totalAmount;
            const model = applyCoverDocumentOverrides(buildInvoiceCoverLetterModel({
                issueDateIso: fresh.issueDate.slice(0, 10),
                billingPeriodIso: periodIso ?? fresh.issueDate.slice(0, 10),
                clientName: client.name,
                clientAddress: client.address,
                contactName: client.contact_name ?? null,
                totalAmount: displayTotal,
                currency: fresh.currency,
            }), doc?.cover);
            if (doc?.legal?.invoiceNumber?.trim())
                meta.invoiceNumber = doc.legal.invoiceNumber.trim();
            const previewSession = {
                v: 1,
                mode: 'existing',
                invoiceId: fresh.id,
                meta,
                ...(doc ? { documentOverrides: doc } : {}),
            };
            const { buildInvoicePreviewDocxBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewDocx');
            const { splitDetailRowsForPagedTimeReport } = await import('@pages/invoice-preview/lib/invoiceTimeReportChunking');
            const { pageNumbersForIncludedKeys } = await import('@pages/invoice-preview/lib/invoicePreviewPageSlots');
            const trChunks = doc?.combinedReport
                ? 1
                : (doc?.timeReport
                    ? splitDetailRowsForPagedTimeReport(doc.timeReport.detailSlots).length
                    : 1);
            const blob = await buildInvoicePreviewDocxBlob({
                model,
                session: previewSession,
                timeReportPack: doc?.timeReport ?? undefined,
                legalOverrides: doc?.legal ?? undefined,
                combinedReport: doc?.combinedReport,
                selectedPageNumbers: pageNumbersForIncludedKeys(doc?.includedPageKeys, trChunks),
            });
            const base = buildInvoicePreviewExportBasename({
                invoiceNumber: fresh.invoiceNumber,
                clientLabel: clientNameById.get(fresh.clientId) ?? fresh.clientId,
                issueDateIso: fresh.issueDate.slice(0, 10),
            });
            triggerBrowserDownload(blob, `${base}.docx`);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.wordFailed') });
        }
        finally {
            setDetailExportBusy(null);
        }
    }, [clientNameById, showAlert, t]);
    const deleteInvoiceById = useCallback(async (inv) => {
        const isCanceled = inv.status === 'canceled';
        if (!await showConfirm({
            title: isCanceled
                ? t('timeTrackingPage.invoices.confirm.deleteCanceledTitle')
                : t('timeTrackingPage.invoices.confirm.deleteDraftTitle'),
            message: isCanceled
                ? t('timeTrackingPage.invoices.confirm.deleteCanceledMessage')
                : t('timeTrackingPage.invoices.confirm.deleteDraftMessage'),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.invoices.confirm.deleteConfirm'),
        }))
            return false;
        setActionBusy(true);
        try {
            await deleteDraftInvoice(inv.id);
            notifyReportsInvalidated();
            navigate(listHref, { replace: true });
            return true;
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
            return false;
        }
        finally {
            setActionBusy(false);
        }
    }, [listHref, navigate, showAlert, showConfirm, t]);
    const handlePayment = useCallback(async () => {
        if (!invoiceId || !detail)
            return;
        const trimmedAmount = String(payAmount).replace(/\s/g, '').replace(/\u00a0/g, '').trim();
        let amountPayload;
        if (trimmedAmount !== '') {
            const n = parseMoneyRu(trimmedAmount);
            if (!Number.isFinite(n) || n <= 0) {
                await showAlert({ message: t('timeTrackingPage.invoices.errors.invalidAmount') });
                return;
            }
            amountPayload = /,/.test(trimmedAmount) ? trimmedAmount.replace(/\s/g, '') : n;
        }
        const paidAtPayload = buildPaidAtForPaymentApi(String(payAt));
        const paidBefore = Number(detail.amountPaid) || 0;
        setActionBusy(true);
        try {
            const posted = await registerInvoicePayment(invoiceId, {
                ...(amountPayload !== undefined ? { amount: amountPayload } : {}),
                ...(paidAtPayload !== undefined ? { paidAt: paidAtPayload } : {}),
                paymentMethod: payMethod.trim() || null,
                note: payNote.trim() || null,
            });
            let next = posted;
            try {
                const refreshed = await getInvoice(invoiceId, true);
                next = mergeInvoiceDtoAfterPayment(posted, refreshed);
            }
            catch {
                next = posted;
            }
            const paidAfter = Number(next.amountPaid) || 0;
            if (paidAfter <= paidBefore + 1e-6) {
                await showAlert({ message: t('timeTrackingPage.invoices.errors.paymentNotApplied') });
                return;
            }
            setDetail(next);
            setPayOpen(false);
            notifyReportsInvalidated();
            pushToast({ message: t('timeTrackingPage.invoices.payment.recorded'), variant: 'info' });
            if (next.requiresPaymentConfirmationDocument === true)
                pushToast({ message: t('timeTrackingPage.invoices.payment.documentRequired'), variant: 'warning' });
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
        }
        finally {
            setActionBusy(false);
        }
    }, [invoiceId, detail, payAmount, payAt, payMethod, payNote, showAlert, pushToast, t]);
    const handleFullPaymentNow = useCallback(async () => {
        if (!invoiceId || !detail)
            return;
        const due = displayBalanceDue;
        if (!Number.isFinite(due) || due <= 1e-9) {
            await showAlert({ message: t('timeTrackingPage.invoices.errors.alreadyPaid') });
            return;
        }
        if (!await showConfirm({
            title: t('timeTrackingPage.invoices.confirm.fullPaymentTitle'),
            message: t('timeTrackingPage.invoices.confirm.fullPaymentMessage')
                .replace('{amount}', fmtMoney(due, detail.currency, locale)),
            confirmLabel: t('timeTrackingPage.invoices.detail.fullPayment'),
        }))
            return;
        const paidBefore = Number(detail.amountPaid) || 0;
        setActionBusy(true);
        try {
            const posted = await registerInvoicePayment(invoiceId, {});
            let next = posted;
            try {
                const refreshed = await getInvoice(invoiceId, true);
                next = mergeInvoiceDtoAfterPayment(posted, refreshed);
            }
            catch {
                next = posted;
            }
            const paidAfter = Number(next.amountPaid) || 0;
            if (paidAfter <= paidBefore + 1e-6) {
                await showAlert({ message: t('timeTrackingPage.invoices.errors.paymentNotApplied') });
                return;
            }
            setDetail(next);
            setPayOpen(false);
            notifyReportsInvalidated();
            pushToast({ message: t('timeTrackingPage.invoices.payment.recorded'), variant: 'info' });
            if (next.requiresPaymentConfirmationDocument === true)
                pushToast({ message: t('timeTrackingPage.invoices.payment.documentRequired'), variant: 'warning' });
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
        }
        finally {
            setActionBusy(false);
        }
    }, [invoiceId, detail, displayBalanceDue, locale, showAlert, showConfirm, pushToast, t]);
    const handleSubmitPaymentConfirmation = useCallback(async () => {
        if (!invoiceId)
            return;
        const url = paymentConfirmDocUrl.trim();
        if (!url) {
            await showAlert({ message: t('timeTrackingPage.invoices.payment.documentLinkRequired') });
            return;
        }
        setActionBusy(true);
        try {
            const posted = await submitInvoicePaymentConfirmation(invoiceId, { documentUrl: url });
            let next = posted;
            try {
                const refreshed = await getInvoice(invoiceId, true);
                next = mergeInvoiceDtoAfterPayment(posted, refreshed);
            }
            catch {
                next = posted;
            }
            setDetail(next);
            setPaymentConfirmDocUrl(next.paymentConfirmationDocumentUrl?.trim() ?? url);
            notifyReportsInvalidated();
            pushToast({ message: t('timeTrackingPage.invoices.payment.saved'), variant: 'info' });
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
        }
        finally {
            setActionBusy(false);
        }
    }, [invoiceId, paymentConfirmDocUrl, showAlert, pushToast, t]);
    const handleSaveDraft = useCallback(async () => {
        if (!detail || detail.status !== 'draft')
            return;
        const cn = document.getElementById('inv-client-note')?.value ?? '';
        const inn = document.getElementById('inv-int-note')?.value ?? '';
        const issue = draftIssueDate.trim() || (detail.issueDate ?? '').slice(0, 10);
        const due = draftDueDate.trim() || (detail.dueDate ?? '').slice(0, 10);
        if (!issue || !due) {
            await showAlert({ message: t('timeTrackingPage.invoices.errors.datesRequired') });
            return;
        }
        const body = {
            issueDate: issue,
            dueDate: due,
            clientNote: cn || null,
            internalNote: inn || null,
        };
        const t1 = parseOptionalPercentField(draftTaxPct);
        const t2 = parseOptionalPercentField(draftTax2Pct);
        const discRaw = draftDiscAmt.trim();
        if (discRaw) {
            const d = parseMoneyRu(discRaw);
            if (!Number.isFinite(d) || d < 0) {
                await showAlert({ message: t('timeTrackingPage.invoices.errors.invalidAmount') });
                return;
            }
            body.discountAmount = d;
        }
        else {
            body.discountAmount = 0;
        }
        if (t1 !== undefined)
            body.taxPercent = t1;
        if (t2 !== undefined)
            body.tax2Percent = t2;
        setActionBusy(true);
        try {
            await patchInvoice(detail.id, body);
            await refreshDetail(detail.id);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
        }
        finally {
            setActionBusy(false);
        }
    }, [detail, draftIssueDate, draftDueDate, draftTaxPct, draftTax2Pct, draftDiscAmt, refreshDetail, showAlert, t]);
    const title = detailLoading
        ? t('timeTrackingPage.invoices.detail.loading')
        : (detail?.invoiceNumber ?? t('timeTrackingPage.invoices.detail.defaultTitle'));
    const clientSubtitle = detail && !detailLoading
        ? (clientNameById.get(detail.clientId) ?? detail.clientId)
        : null;
    if (!invoiceId)
        return _jsx(Navigate, { to: getInvoicesListUrl(), replace: true });
    if (userLoading) {
        return (_jsx("div", { className: "time-page time-page--enter time-page--invoice-sub", role: "status", "aria-live": "polite", "aria-busy": "true", children: _jsxs("main", { className: "time-page__main", children: [_jsxs("nav", { className: "time-page__navbar", "aria-label": t('timeTrackingPage.invoices.detailPage.navAria'), children: [_jsx(AppBackButton, { onClick: toInvoices, label: t('timeTrackingPage.invoices.backToInvoices'), ariaLabel: t('timeTrackingPage.invoices.backToInvoices'), hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("span", { className: "time-page__navbar-title", children: t('timeTrackingPage.invoices.detail.loading') }), _jsx("div", { className: "time-page__navbar-spacer" }), _jsx("div", { className: "time-page__navbar-settings", children: _jsx(AppPageSettings, {}) })] }), _jsx("div", { className: "time-page__content time-page__content--enter", children: _jsx("p", { className: "tt-inv__muted", children: t('timeTrackingPage.invoices.detail.loadingCard') }) })] }) }));
    }
    if (!user || !canAccessTimeTracking(user))
        return _jsx(Navigate, { to: routes.home, replace: true });
    return (_jsxs("div", { className: "time-page time-page--enter time-page--invoice-sub", children: [_jsxs("main", { className: "time-page__main", children: [_jsxs("nav", { className: "time-page__navbar", "aria-label": t('timeTrackingPage.invoices.detailPage.navAria'), children: [_jsx(AppBackButton, { onClick: toInvoices, label: t('timeTrackingPage.invoices.backToInvoices'), ariaLabel: t('timeTrackingPage.invoices.backToInvoices'), hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("span", { className: "time-page__navbar-title", children: title }), _jsx("div", { className: "time-page__navbar-spacer" }), _jsx("div", { className: "time-page__navbar-settings", children: _jsx(AppPageSettings, {}) })] }), _jsx("div", { className: "time-page__content time-page__content--enter tt-inv-page", role: "region", "aria-labelledby": "tt-inv-detail-title", children: !detail || detailLoading ? (_jsx("div", { className: "tt-inv-page__loading", children: _jsx("p", { className: "tt-inv__muted", children: t('timeTrackingPage.invoices.detail.loadingCard') }) })) : (_jsxs(_Fragment, { children: [_jsx("header", { className: "tt-inv-page__header", children: _jsxs("div", { className: "tt-inv-page__header-main", children: [_jsxs("div", { className: "tt-inv-page__title-row", children: [_jsx("h1", { id: "tt-inv-detail-title", className: "tt-inv-page__title", children: title }), _jsx("span", { className: `tt-inv__badge ${INVOICE_STATUS_BADGE_CLASS[detail.status] ?? 'tt-inv__badge--neutral'}`, children: ttInvoiceStatusLabel(detail.status, t) }), readOnly && (_jsx("span", { className: "tt-inv__readonly-badge", role: "status", children: t('timeTrackingPage.invoices.readonlyBadge') }))] }), clientSubtitle && _jsx("p", { className: "tt-inv-page__sub", children: clientSubtitle }), invoiceCreatedBeforeAllSignatures(detail.internalNote) ? (_jsxs("p", { className: "tt-inv-unsigned-banner", role: "status", children: [_jsx("span", { className: "tt-inv-unsigned-banner__tag", children: t('timeTrackingPage.reports.forReview.unsignedInvoiceTag') }), _jsx("span", { children: t('timeTrackingPage.invoices.unsignedInvoiceBanner').replace('{date}', (() => {
                                                            const raw = String(detail.createdAt ?? '').trim();
                                                            const d = new Date(raw);
                                                            return Number.isNaN(d.getTime())
                                                                ? raw
                                                                : d.toLocaleString(localeTag(locale), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                                                        })()) })] })) : null, detail.storedStatus !== detail.status && (_jsxs("p", { className: "tt-inv-page__sub", children: [t('timeTrackingPage.invoices.detail.inDb'), ": ", _jsx("code", { children: detail.storedStatus })] }))] }) }), _jsxs("div", { className: "tt-inv-page__body", children: [_jsxs("div", { className: "tt-reports__summary tt-inv-page__kpis", "aria-label": t('timeTrackingPage.invoices.summary.aria'), children: [_jsxs("div", { className: "tt-reports__summary-card tt-inv-page__kpi-status", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.detail.status') }), _jsx("span", { className: "tt-reports__summary-value", children: _jsx("span", { className: `tt-inv__badge ${INVOICE_STATUS_BADGE_CLASS[detail.status] ?? 'tt-inv__badge--neutral'}`, children: ttInvoiceStatusLabel(detail.status, t) }) })] }), _jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.detail.issueDate') }), _jsx("span", { className: "tt-reports__summary-value", style: { fontSize: '1.05rem' }, children: fmtDisplayDate(detail.issueDate, locale) })] }), _jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.detail.dueDate') }), _jsx("span", { className: "tt-reports__summary-value", style: { fontSize: '1.05rem' }, children: fmtDisplayDate(detail.dueDate, locale) })] }), _jsxs("div", { className: "tt-reports__summary-card tt-inv__summary-card--accent", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.detail.amount') }), _jsx("span", { className: "tt-reports__summary-value", style: { fontSize: '1.05rem' }, children: fmtMoney(displayTotalAmount, detail.currency, locale) })] }), billedLinesSummary.isBilledOverride && billedLinesSummary.workedAmount > 1e-9 ? (_jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.detail.workedAmount') }), _jsx("span", { className: "tt-reports__summary-value", style: { fontSize: '1.05rem' }, children: fmtMoney(billedLinesSummary.workedAmount, billedLinesSummary.workedCurrency, locale) })] })) : null, _jsxs("div", { className: "tt-reports__summary-card tt-inv__summary-card--success", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.detail.paid') }), _jsx("span", { className: "tt-reports__summary-value", style: { fontSize: '1.05rem' }, children: fmtMoney(detail.amountPaid, detail.currency, locale) })] }), _jsxs("div", { className: `tt-reports__summary-card${displayBalanceDue > 1e-9 ? ' tt-inv__summary-card--danger' : ' tt-inv__summary-card--muted'}`, children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.detail.balance') }), _jsx("span", { className: "tt-reports__summary-value", style: { fontSize: '1.05rem' }, children: fmtMoney(displayBalanceDue, detail.currency, locale) })] })] }), _jsxs("div", { className: "tt-inv-page__toolbar", role: "toolbar", "aria-label": t('timeTrackingPage.invoices.detail.exportAria'), children: [_jsxs("div", { className: "tt-inv-detail-export", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: Boolean(actionBusy || detailExportBusy), onClick: () => openExistingInvoicePreview(detail), title: t('timeTrackingPage.invoices.detail.previewTitle'), children: t('timeTrackingPage.invoices.detail.preview') }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: Boolean(actionBusy || detailExportBusy), onClick: () => void handleDetailDownloadPdf(detail), children: detailExportBusy === 'pdf' ? t('timeTrackingPage.invoices.detail.preparingPdf') : t('timeTrackingPage.invoices.detail.downloadPdf') }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: Boolean(actionBusy || detailExportBusy), onClick: () => void handleDetailDownloadWord(detail), children: detailExportBusy === 'word' ? t('timeTrackingPage.invoices.detail.preparingWord') : t('timeTrackingPage.invoices.detail.downloadWord') })] }), !readOnly && (_jsxs(_Fragment, { children: [_jsx("span", { className: "tt-inv-page__toolbar-sep", "aria-hidden": true }), _jsxs("div", { className: "tt-inv-actions", children: [invoiceCanSend(detail.status) && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", disabled: actionBusy || Boolean(outlookSendWait && outlookSendWait.invoiceId === detail.id), onClick: () => setSendContactOpen(true), children: outlookSendWait && outlookSendWait.invoiceId === detail.id
                                                                        ? t('timeTrackingPage.invoices.sendDialog.outlookWaitingShort')
                                                                        : ttInvoiceSendActionLabel(detail.status, t) })), invoiceCanUnsend(detail.status) && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: actionBusy, onClick: async () => {
                                                                        if (!await showConfirm({
                                                                            title: t('timeTrackingPage.invoices.confirm.unsendTitle'),
                                                                            message: t('timeTrackingPage.invoices.confirm.unsendMessage'),
                                                                            confirmLabel: t('timeTrackingPage.invoices.confirm.unsendConfirm'),
                                                                        }))
                                                                            return;
                                                                        setActionBusy(true);
                                                                        try {
                                                                            await unsendInvoice(detail.id);
                                                                            await refreshDetail(detail.id);
                                                                            pushToast({
                                                                                message: t('timeTrackingPage.invoices.detail.unsendDone'),
                                                                                variant: 'info',
                                                                            });
                                                                        }
                                                                        catch (e) {
                                                                            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
                                                                        }
                                                                        finally {
                                                                            setActionBusy(false);
                                                                        }
                                                                    }, children: t('timeTrackingPage.invoices.detail.unsend') })), invoiceCanMarkViewed(detail.status) && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: actionBusy, onClick: async () => {
                                                                        setActionBusy(true);
                                                                        try {
                                                                            await markInvoiceViewed(detail.id);
                                                                            await refreshDetail(detail.id);
                                                                        }
                                                                        catch (e) {
                                                                            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
                                                                        }
                                                                        finally {
                                                                            setActionBusy(false);
                                                                        }
                                                                    }, children: t('timeTrackingPage.invoices.detail.markViewed') })), invoiceCanRegisterPayment(detail.status, displayBalanceDue) && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", disabled: actionBusy, onClick: () => void handleFullPaymentNow(), children: t('timeTrackingPage.invoices.detail.fullPayment') }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: actionBusy, onClick: () => {
                                                                                setPayAmount(displayBalanceDue > 1e-9 ? String(displayBalanceDue).replace('.', ',') : '');
                                                                                setPayAt('');
                                                                                setPayOpen(true);
                                                                            }, children: t('timeTrackingPage.invoices.detail.partialPayment') })] })), invoiceCanCancel(detail.status) && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: actionBusy, onClick: async () => {
                                                                        if (!await showConfirm({
                                                                            title: t('timeTrackingPage.invoices.confirm.cancelTitle'),
                                                                            message: t('timeTrackingPage.invoices.confirm.cancelMessage'),
                                                                            variant: 'danger',
                                                                            confirmLabel: t('timeTrackingPage.invoices.confirm.cancelConfirm'),
                                                                        }))
                                                                            return;
                                                                        setActionBusy(true);
                                                                        try {
                                                                            await cancelInvoice(detail.id);
                                                                            await refreshDetail(detail.id);
                                                                        }
                                                                        catch (e) {
                                                                            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
                                                                        }
                                                                        finally {
                                                                            setActionBusy(false);
                                                                        }
                                                                    }, children: t('timeTrackingPage.invoices.detail.cancelInvoice') })), invoiceCanDeleteDraft(detail.status) && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: actionBusy, onClick: () => {
                                                                        void deleteInvoiceById(detail);
                                                                    }, children: detail.status === 'canceled'
                                                                        ? t('timeTrackingPage.invoices.detail.deleteCanceled')
                                                                        : t('timeTrackingPage.invoices.detail.deleteDraft') }))] })] }))] }), !readOnly && payOpen && (_jsxs("section", { ref: paySectionRef, className: "tt-inv-page__section tt-inv-page__section--soft", "aria-labelledby": "tt-inv-pay-section-title", children: [_jsx("div", { className: "tt-inv-page__section-head", children: _jsx("h2", { id: "tt-inv-pay-section-title", className: "tt-inv-page__section-title", children: t('timeTrackingPage.invoices.payment.title') }) }), _jsxs("div", { className: "tt-inv-pay", children: [_jsx("p", { className: "tt-inv-pay__hint", children: t('timeTrackingPage.invoices.payment.hint') }), _jsxs("label", { children: [t('timeTrackingPage.invoices.payment.amountLabel'), _jsx("input", { className: "tt-inv__input", value: payAmount, onChange: (e) => setPayAmount(e.target.value), placeholder: t('timeTrackingPage.invoices.payment.amountPlaceholder') })] }), _jsxs("label", { children: [t('timeTrackingPage.invoices.payment.paidAtLabel'), _jsx("input", { type: "text", className: "tt-inv__input", value: payAt, onChange: (e) => setPayAt(e.target.value), placeholder: t('timeTrackingPage.invoices.payment.paidAtPlaceholder') })] }), _jsxs("label", { children: [t('timeTrackingPage.invoices.payment.methodLabel'), _jsx("input", { className: "tt-inv__input", value: payMethod, onChange: (e) => setPayMethod(e.target.value) })] }), _jsxs("label", { children: [t('timeTrackingPage.invoices.payment.noteLabel'), _jsx("input", { className: "tt-inv__input", value: payNote, onChange: (e) => setPayNote(e.target.value) })] }), _jsxs("div", { className: "tt-inv-page__draft-actions", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => setPayOpen(false), disabled: actionBusy, children: t('timeTrackingPage.common.cancel') }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", onClick: () => void handlePayment(), disabled: actionBusy, children: t('timeTrackingPage.invoices.payment.recordPayment') })] })] })] })), outlookSendWait && outlookSendWait.invoiceId === detail.id && (_jsx("p", { className: "tt-inv-outlook-wait", role: "status", children: t('timeTrackingPage.invoices.sendDialog.outlookWaitingBanner').replace('{invoice}', outlookSendWait.label) })), (detail.requiresPaymentConfirmationDocument === true || Boolean(detail.paymentConfirmationDocumentUrl?.trim())) && (_jsxs("section", { className: "tt-inv-page__section tt-inv-page__section--soft", "aria-label": t('timeTrackingPage.invoices.detail.paymentConfirmRegion'), children: [_jsx("div", { className: "tt-inv-page__section-head", children: _jsx("h2", { className: "tt-inv-page__section-title", children: t('timeTrackingPage.invoices.detail.paymentConfirmTitle') }) }), _jsxs("div", { className: "tt-inv-pay-confirm", children: [detail.requiresPaymentConfirmationDocument === true && !readOnly ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "tt-inv-pay-confirm__hint", children: t('timeTrackingPage.invoices.detail.paymentConfirmHint') }), _jsxs("label", { children: [t('timeTrackingPage.invoices.detail.paymentConfirmDocLabel'), _jsx("input", { className: "tt-inv__input", value: paymentConfirmDocUrl, onChange: (e) => setPaymentConfirmDocUrl(e.target.value), placeholder: t('timeTrackingPage.invoices.detail.paymentConfirmDocPlaceholder'), autoComplete: "off" })] }), _jsx("div", { className: "tt-inv-page__draft-actions", children: _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", disabled: actionBusy, onClick: () => void handleSubmitPaymentConfirmation(), children: t('timeTrackingPage.invoices.detail.savePaymentConfirm') }) })] })) : null, detail.requiresPaymentConfirmationDocument === true && readOnly ? (_jsx("p", { className: "tt-inv-pay-confirm__hint tt-inv__muted", children: t('timeTrackingPage.invoices.detail.paymentConfirmReadonly') })) : null, detail.paymentConfirmationDocumentUrl?.trim() ? (() => {
                                                            const u = detail.paymentConfirmationDocumentUrl.trim();
                                                            const recRaw = detail.paymentConfirmationRecordedAt?.trim();
                                                            let recLabel = '';
                                                            if (recRaw) {
                                                                const d = new Date(recRaw);
                                                                recLabel = Number.isNaN(d.getTime())
                                                                    ? recRaw
                                                                    : d.toLocaleString(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' });
                                                            }
                                                            return (_jsxs("p", { className: "tt-inv-pay-confirm__saved", children: [t('timeTrackingPage.invoices.detail.paymentConfirmRecorded'), recLabel ? ` · ${recLabel}` : '', ' · ', /^https?:\/\//i.test(u)
                                                                        ? (_jsx("a", { href: u, target: "_blank", rel: "noopener noreferrer", children: u }))
                                                                        : _jsx("code", { children: u })] }));
                                                        })() : null] })] })), !readOnly && invoiceCanPatchDraft(detail.status) && (_jsxs("section", { className: "tt-inv-page__section", "aria-labelledby": "tt-inv-draft-section-title", children: [_jsx("div", { className: "tt-inv-page__section-head", children: _jsxs("div", { children: [_jsx("h2", { id: "tt-inv-draft-section-title", className: "tt-inv-page__section-title", children: t('timeTrackingPage.invoices.detail.draftDates') }), _jsx("p", { className: "tt-inv-page__section-desc", children: t('timeTrackingPage.invoices.detail.draftEditHint') })] }) }), _jsxs("div", { className: "tt-inv-draft", children: [_jsxs("div", { className: "tt-inv-dialog__grid tt-inv-dialog__grid--draft-invoice", children: [_jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("span", { id: "inv-draft-issue-lbl", className: "tt-inv-dialog__label", children: t('timeTrackingPage.invoices.detail.issueDate') }), _jsx(DatePicker, { id: "inv-draft-issue", className: "tt-inv-dialog-dp", buttonClassName: "tt-inv-dialog-dp-btn", value: draftIssueDate, max: draftDueDate || undefined, onChange: (iso) => setDraftIssueDate(iso), portal: true, portalZIndex: 12100, emptyLabel: t('timeTrackingPage.invoices.filters.dateEmpty'), title: t('timeTrackingPage.invoices.detail.issueDate'), showChevron: true, "aria-labelledby": "inv-draft-issue-lbl" })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("span", { id: "inv-draft-due-lbl", className: "tt-inv-dialog__label", children: t('timeTrackingPage.invoices.detail.dueDate') }), _jsx(DatePicker, { id: "inv-draft-due", className: "tt-inv-dialog-dp", buttonClassName: "tt-inv-dialog-dp-btn", value: draftDueDate, min: draftIssueDate || undefined, onChange: (iso) => setDraftDueDate(iso), portal: true, portalZIndex: 12100, emptyLabel: t('timeTrackingPage.invoices.filters.dateEmpty'), title: t('timeTrackingPage.invoices.detail.dueDate'), showChevron: true, "aria-labelledby": "inv-draft-due-lbl" })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("label", { className: "tt-inv-dialog__label", htmlFor: "inv-tax1", children: t('timeTrackingPage.invoices.detail.tax1') }), _jsx("input", { id: "inv-tax1", type: "text", inputMode: "decimal", className: "tt-inv-dialog__control", value: draftTaxPct, onChange: (e) => setDraftTaxPct(e.target.value), placeholder: t('timeTrackingPage.invoices.detail.taxPlaceholder') })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("label", { className: "tt-inv-dialog__label", htmlFor: "inv-tax2", children: t('timeTrackingPage.invoices.detail.tax2') }), _jsx("input", { id: "inv-tax2", type: "text", inputMode: "decimal", className: "tt-inv-dialog__control", value: draftTax2Pct, onChange: (e) => setDraftTax2Pct(e.target.value), placeholder: t('timeTrackingPage.invoices.detail.optionalPlaceholder') })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("label", { className: "tt-inv-dialog__label", htmlFor: "inv-disc", children: t('timeTrackingPage.invoices.detail.discount') }), _jsx("input", { id: "inv-disc", type: "text", inputMode: "decimal", className: "tt-inv-dialog__control", value: draftDiscAmt, onChange: (e) => setDraftDiscAmt(e.target.value), placeholder: t('timeTrackingPage.invoices.detail.discountPlaceholder') })] })] }), _jsxs("div", { className: "tt-inv-draft__notes", children: [_jsxs("label", { htmlFor: "inv-client-note", children: [t('timeTrackingPage.invoices.detail.clientNote'), _jsx("textarea", { className: "tt-inv__textarea", rows: 3, defaultValue: detail.clientNote ?? '', id: "inv-client-note" })] }), _jsxs("label", { htmlFor: "inv-int-note", children: [t('timeTrackingPage.invoices.detail.internalNote'), _jsx("textarea", { className: "tt-inv__textarea", rows: 3, defaultValue: detail.internalNote ?? '', id: "inv-int-note" })] })] }), _jsx("div", { className: "tt-inv-page__draft-actions", children: _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", disabled: actionBusy, onClick: () => void handleSaveDraft(), children: t('timeTrackingPage.invoices.detail.saveDraft') }) })] })] })), _jsxs("section", { className: "tt-inv-page__section", "aria-labelledby": "tt-inv-lines-section-title", children: [_jsxs("div", { className: "tt-inv-page__section-head", children: [_jsx("h2", { id: "tt-inv-lines-section-title", className: "tt-inv-page__section-title", children: t('timeTrackingPage.invoices.detail.linesTitle') }), _jsx("span", { className: "tt-inv-page__section-desc", children: billedLinesSummary.isBilledOverride
                                                                ? billedLinesSummary.visibleLines.length
                                                                : (detail.lines ?? []).length })] }), _jsx("div", { className: "tt-reports__table-wrap tt-inv-page__table-wrap", children: _jsxs("table", { className: "tt-inv-mini tt-inv-mini--lines", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: t('timeTrackingPage.invoices.detail.linesKind') }), _jsx("th", { children: t('timeTrackingPage.invoices.detail.linesDescription') }), _jsx("th", { children: t('timeTrackingPage.invoices.detail.linesQty') }), _jsx("th", { children: t('timeTrackingPage.invoices.detail.linesPrice') }), _jsx("th", { children: t('timeTrackingPage.invoices.detail.linesAmount') })] }) }), _jsx("tbody", { children: billedLinesSummary.visibleLines.map((ln) => {
                                                                    const amounts = invoiceExpenseLineDisplayAmounts(ln, detail.currency, expenseRegistryUsd);
                                                                    return (_jsxs("tr", { children: [_jsx("td", { children: _jsx("span", { className: `tt-inv-line-kind tt-inv-line-kind--${invoiceLineKindSlug(ln)}`, children: invoiceLineKindLabel(ln, t) }) }), _jsx("td", { children: invoiceDescriptionWithTask(ln.description) || '—' }), _jsx("td", { children: Number.isFinite(Number(ln.quantity)) ? Number(ln.quantity).toFixed(2) : ln.quantity }), _jsx("td", { children: fmtMoney(amounts.unitAmount, detail.currency, locale) }), _jsxs("td", { children: [fmtMoney(amounts.lineTotal, detail.currency, locale), ln.sourceCurrency && ln.sourceCurrency !== detail.currency && ln.sourceAmount != null
                                                                                        ? ` (${fmtMoney(ln.sourceAmount, ln.sourceCurrency, locale)})`
                                                                                        : ''] })] }, ln.id));
                                                                }) })] }) }), billedLinesSummary.isBilledOverride ? (_jsx("p", { className: "tt-inv-page__section-desc", style: { marginTop: '0.65rem' }, children: t('timeTrackingPage.invoices.detail.closedLinkageSummary')
                                                        .replace('{time}', String(billedLinesSummary.closedTimeCount))
                                                        .replace('{expense}', String(billedLinesSummary.closedExpenseCount)) })) : null, (detail.payments ?? []).length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "tt-inv-page__section-title", style: { marginTop: '1rem' }, children: t('timeTrackingPage.invoices.detail.paymentsTitle') }), _jsx("ul", { className: "tt-inv-page__payments", children: detail.payments.map((p) => (_jsxs("li", { children: [fmtMoney(p.amount, detail.currency, locale), " \u2014 ", p.paidAt] }, p.id))) })] }))] })] })] })) })] }), sendContactOpen && detail && !readOnly && (_jsx(InvoiceSendContactModal, { clientId: detail.clientId, clientName: clientNameById.get(detail.clientId) ?? detail.clientId, invoiceLabel: detail.invoiceNumber || detail.id, onClose: () => {
                    sendAbortRef.current?.abort();
                    setActionBusy(false);
                    setSendContactOpen(false);
                }, onConfirm: async (contact) => {
                    const ac = new AbortController();
                    sendAbortRef.current = ac;
                    const signal = AbortSignal.any([ac.signal, AbortSignal.timeout(90_000)]);
                    const cancelled = () => ac.signal.aborted;
                    setActionBusy(true);
                    try {
                        invalidateCalendarApiCache();
                        const outlookSt = await getCalendarStatus();
                        if (cancelled())
                            return;
                        if (!outlookSt.connected || outlookSt.mailReady === false) {
                            // Modal stays open with Connect Outlook — do not open another dialog under it.
                            return;
                        }
                        const pdfFile = await buildExistingInvoicePdfFile(detail.id);
                        if (cancelled())
                            return;
                        const pdfBase64 = await blobToBase64(pdfFile.blob);
                        const invoiceLabel = detail.invoiceNumber || detail.id;
                        const greetingName = (contact.name || '').trim().split(/\s+/)[0] || 'Sir or Madam';
                        const projectOnly = (pdfFile.session.meta.projectLabel || '').trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
                        const clientOnly = pdfFile.clientLabel.trim();
                        const matterCore = projectOnly && clientOnly && projectOnly.localeCompare(clientOnly, undefined, { sensitivity: 'accent' }) !== 0
                            ? `${clientOnly}/${projectOnly}`
                            : (projectOnly || clientOnly);
                        const matter = matterCore ? `${matterCore} project` : 'the project';
                        const subject = t('timeTrackingPage.invoices.sendDialog.mailSubject').replace('{invoice}', invoiceLabel);
                        const logoPngBase64 = await rasterizePublicLogoPng();
                        if (cancelled())
                            return;
                        const signature = invoiceClientMailSignature({
                            name: user?.display_name?.trim() || 'Kosta Legal',
                            position: 'Contract Manager',
                            embedLogo: Boolean(logoPngBase64),
                        });
                        const bodyHtml = t('timeTrackingPage.invoices.sendDialog.mailBodyHtml')
                            .replaceAll('{greetingName}', escapeHtml(greetingName))
                            .replaceAll('{matter}', escapeHtml(matter))
                            .replaceAll('{signatureHtml}', signature.html);
                        const bodyText = t('timeTrackingPage.invoices.sendDialog.mailBodyText')
                            .replaceAll('{greetingName}', greetingName)
                            .replaceAll('{matter}', matter)
                            .replaceAll('{signatureText}', signature.text);
                        const pdfFileName = `${pdfFile.fileBase}.pdf`;
                        const draft = await createInvoiceOutlookDraft(detail.id, {
                            toEmail: contact.email,
                            toName: contact.name || null,
                            subject,
                            bodyHtml,
                            bodyText,
                            pdfBase64,
                            pdfFileName,
                            logoPngBase64,
                            signal,
                        });
                        if (cancelled())
                            return;
                        const notifyAccounting = () => notifyAccountingLastInvoicePage({
                            invoiceId: detail.id,
                            model: pdfFile.model,
                            session: pdfFile.session,
                            clientLabel: pdfFile.clientLabel,
                            invoiceNumber: pdfFile.invoiceNumber,
                            issueDateIso: pdfFile.issueDateIso,
                        });
                        const opened = openOutlookComposePopup(draft.webLink);
                        if (!opened)
                            await showAlert({ message: t('timeTrackingPage.invoices.errors.outlookOpenFailed') });
                        setSendContactOpen(false);
                        const messageId = (draft.messageId || '').trim();
                        if (!messageId) {
                            await sendInvoice(detail.id);
                            await refreshDetail(detail.id);
                            try {
                                await notifyAccounting();
                            }
                            catch (e) {
                                console.warn('invoice accounting last-page notify failed', e);
                            }
                            pushToast({
                                message: t('timeTrackingPage.invoices.sendDialog.outlookSentStatusUpdated').replace('{invoice}', invoiceLabel),
                                variant: 'info',
                            });
                            return;
                        }
                        void trackOutlookSendAndMarkInvoice({
                            invoiceId: detail.id,
                            messageId,
                            subject,
                            label: invoiceLabel,
                            afterSent: notifyAccounting,
                        });
                    }
                    catch (e) {
                        if (ac.signal.aborted)
                            return;
                        const aborted = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
                        const msg = aborted
                            ? 'Сервер слишком долго готовил черновик письма. Повторите отправку.'
                            : e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic');
                        const lower = msg.toLowerCase();
                        const outlookAuthIssue = isTimeTrackingHttpError(e, 409)
                            || isTimeTrackingHttpError(e, 403)
                            || lower.includes('не подключ')
                            || lower.includes('not connected')
                            || lower.includes('mail.readwrite');
                        if (outlookAuthIssue) {
                            invalidateCalendarApiCache();
                            setSendContactOpen(false);
                            const reconnect = await showConfirm({
                                message: msg || t('timeTrackingPage.invoices.errors.outlookReconnectNeeded'),
                                confirmLabel: t('timeTrackingPage.invoices.sendDialog.outlookReconnect'),
                                cancelLabel: t('timeTrackingPage.cancel'),
                            });
                            if (reconnect)
                                await reconnectOutlookCalendar();
                            return;
                        }
                        await showAlert({ message: msg || t('timeTrackingPage.invoices.errors.outlookDraftFailed') });
                    }
                    finally {
                        if (sendAbortRef.current === ac)
                            sendAbortRef.current = null;
                        setActionBusy(false);
                    }
                } }))] }));
}
