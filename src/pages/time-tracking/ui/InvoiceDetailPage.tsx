import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getInvoicesListUrl, routes } from '@shared/config';
import { buildInvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '@pages/invoice-preview/lib/invoicePreviewDownload';
import { DatePicker } from '@shared/ui/DatePicker';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppDialog, useAppToast } from '@shared/ui';
import { useI18n, ttInvoiceSendActionLabel, ttInvoiceStatusLabel } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import {
  getInvoice,
  patchInvoice,
  sendInvoice,
  createInvoiceOutlookDraft,
  getInvoiceOutlookDraftStatus,
  markInvoiceViewed,
  registerInvoicePayment,
  submitInvoicePaymentConfirmation,
  cancelInvoice,
  deleteDraftInvoice,
  listAllTimeManagerClientsMerged,
  getTimeManagerClient,
  INVOICE_STATUS_BADGE_CLASS,
  invoiceCanSend,
  invoiceCanMarkViewed,
  invoiceCanRegisterPayment,
  invoiceCanCancel,
  invoiceCanDeleteDraft,
  invoiceCanPatchDraft,
  writeInvoicePreviewSession,
  mergeInvoiceDtoAfterPayment,
  type InvoiceDto,
  type InvoicePatchInput,
  type InvoiceUiStatus,
  type TimeManagerClientRow,
} from '@entities/time-tracking';
import { isActiveTimeManagerClientRow } from '@entities/time-tracking/lib/projectTimeEntry';
import { InvoiceSendContactModal } from './InvoiceSendContactModal';
import { invoiceClientDescription } from '../lib/invoiceClientDescription';
import {
  blobToBase64,
  buildPaidAtForPaymentApi,
  escapeHtml,
  fmtDisplayDate,
  fmtMoney,
  invoiceLineKindLabel,
  invoiceLineKindSlug,
  invoicePreviewMetaForExisting,
  notifyAccountingLastInvoicePage,
  notifyReportsInvalidated,
  openOutlookComposePopup,
  parseMoneyRu,
  parseOptionalPercentField,
} from '../lib/invoicePageShared';
import './TimeTrackingPage.css';
import './TimesheetPanel.css';
import './InvoicePage.css';

export function InvoiceDetailPage() {
  const { invoiceId: invoiceIdParam } = useParams<{ invoiceId: string }>();
  const invoiceId = (invoiceIdParam ?? '').trim();
  const [searchParams] = useSearchParams();
  const accountingVariant = searchParams.get('variant') === 'accounting';
  const readOnly = accountingVariant;
  const { t, locale } = useI18n();
  const { user, loading: userLoading } = useCurrentUser();
  const { showAlert, showConfirm } = useAppDialog();
  const { pushToast } = useAppToast();
  const navigate = useNavigate();

  const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
  const [detail, setDetail] = useState<InvoiceDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const paySectionRef = useRef<HTMLElement | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payAt, setPayAt] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paymentConfirmDocUrl, setPaymentConfirmDocUrl] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [sendContactOpen, setSendContactOpen] = useState(false);
  const [outlookSendWait, setOutlookSendWait] = useState<{ invoiceId: string; label: string } | null>(null);
  const outlookWaitAbortRef = useRef<AbortController | null>(null);
  const [detailExportBusy, setDetailExportBusy] = useState<'pdf' | 'word' | null>(null);
  const [draftIssueDate, setDraftIssueDate] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftTaxPct, setDraftTaxPct] = useState('');
  const [draftTax2Pct, setDraftTax2Pct] = useState('');
  const [draftDiscAmt, setDraftDiscAmt] = useState('');

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(String(c.id), c.name));
    return m;
  }, [clients]);

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
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    void getInvoice(invoiceId, true)
      .then((inv) => {
        if (!cancelled)
          setDetail(inv);
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

  const refreshDetail = useCallback(async (id: string) => {
    const inv = await getInvoice(id, true);
    setDetail(inv);
    notifyReportsInvalidated();
  }, []);

  const trackOutlookSendAndMarkInvoice = useCallback(async (opts: {
    invoiceId: string;
    messageId: string;
    subject: string;
    label: string;
    afterSent?: () => void | Promise<void>;
  }) => {
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
    let missingSince: number | null = null;
    const maxMs = 15 * 60_000;
    const missingGraceMs = 90_000;
    const pollMs = 3000;

    const sleep = (ms: number) => new Promise<void>((resolve) => {
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

  const openExistingInvoicePreview = useCallback((inv: InvoiceDto) => {
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
        writeInvoicePreviewSession({
          v: 1,
          mode: 'existing',
          invoiceId: inv.id,
          meta,
          ...(documentOverrides ? { documentOverrides } : {}),
        });
        navigate(routes.timeTrackingInvoicePreview);
      }
      catch (e) {
        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.previewFailed') });
      }
    })();
  }, [clientNameById, navigate, showAlert, t]);

  const handleDetailDownloadPdf = useCallback(async (inv: InvoiceDto) => {
    setDetailExportBusy('pdf');
    try {
      const fresh = inv.documentOverrides != null ? inv : await getInvoice(inv.id, false);
      const { applyCoverDocumentOverrides, parseInvoiceDocumentOverrides } = await import('@pages/invoice-preview/lib/invoiceDocumentOverrides');
      const doc = parseInvoiceDocumentOverrides(fresh.documentOverrides);
      const client = await getTimeManagerClient(fresh.clientId);
      const model = applyCoverDocumentOverrides(buildInvoiceCoverLetterModel({
        issueDateIso: fresh.issueDate.slice(0, 10),
        clientName: client.name,
        clientAddress: client.address,
        contactName: client.contact_name ?? null,
        totalAmount: fresh.totalAmount,
        currency: fresh.currency,
      }), doc?.cover);
      const clientLabel = (clientNameById.get(fresh.clientId) ?? fresh.clientId).trim();
      const meta = await invoicePreviewMetaForExisting(fresh, clientLabel);
      if (doc?.legal?.invoiceNumber?.trim())
        meta.invoiceNumber = doc.legal.invoiceNumber.trim();
      const previewSession = {
        v: 1 as const,
        mode: 'existing' as const,
        invoiceId: fresh.id,
        meta,
        ...(fresh.documentOverrides ? { documentOverrides: fresh.documentOverrides } : {}),
      };

      const { buildInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewPdf');
      const { splitDetailRowsForPagedTimeReport } = await import('@pages/invoice-preview/lib/invoiceTimeReportChunking');
      const { pageNumbersForIncludedKeys } = await import('@pages/invoice-preview/lib/invoicePreviewPageSlots');
      const trChunks = doc?.timeReport
        ? splitDetailRowsForPagedTimeReport(doc.timeReport.detailSlots).length
        : 1;
      const blob = await buildInvoicePreviewPdfBlob({
        model,
        session: previewSession,
        timeReportPack: doc?.timeReport ?? undefined,
        legalOverrides: doc?.legal ?? undefined,
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

  const handleDetailDownloadWord = useCallback(async (inv: InvoiceDto) => {
    setDetailExportBusy('word');
    try {
      const fresh = inv.documentOverrides != null ? inv : await getInvoice(inv.id, false);
      const { applyCoverDocumentOverrides, parseInvoiceDocumentOverrides } = await import('@pages/invoice-preview/lib/invoiceDocumentOverrides');
      const doc = parseInvoiceDocumentOverrides(fresh.documentOverrides);
      const client = await getTimeManagerClient(fresh.clientId);
      const model = applyCoverDocumentOverrides(buildInvoiceCoverLetterModel({
        issueDateIso: fresh.issueDate.slice(0, 10),
        clientName: client.name,
        clientAddress: client.address,
        contactName: client.contact_name ?? null,
        totalAmount: fresh.totalAmount,
        currency: fresh.currency,
      }), doc?.cover);
      const clientLabel = (clientNameById.get(fresh.clientId) ?? fresh.clientId).trim();
      const meta = await invoicePreviewMetaForExisting(fresh, clientLabel);
      if (doc?.legal?.invoiceNumber?.trim())
        meta.invoiceNumber = doc.legal.invoiceNumber.trim();
      const previewSession = {
        v: 1 as const,
        mode: 'existing' as const,
        invoiceId: fresh.id,
        meta,
        ...(fresh.documentOverrides ? { documentOverrides: fresh.documentOverrides } : {}),
      };

      const { buildInvoicePreviewDocxBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewDocx');
      const { splitDetailRowsForPagedTimeReport } = await import('@pages/invoice-preview/lib/invoiceTimeReportChunking');
      const { pageNumbersForIncludedKeys } = await import('@pages/invoice-preview/lib/invoicePreviewPageSlots');
      const trChunks = doc?.timeReport
        ? splitDetailRowsForPagedTimeReport(doc.timeReport.detailSlots).length
        : 1;
      const blob = await buildInvoicePreviewDocxBlob({
        model,
        session: previewSession,
        timeReportPack: doc?.timeReport ?? undefined,
        legalOverrides: doc?.legal ?? undefined,
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

  const deleteInvoiceById = useCallback(async (inv: InvoiceDto) => {
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
    let amountPayload: number | string | undefined;
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
      let next: InvoiceDto = posted;
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
    const due = Number(detail.balanceDue);
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
      let next: InvoiceDto = posted;
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
  }, [invoiceId, detail, locale, showAlert, showConfirm, pushToast, t]);

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
      let next: InvoiceDto = posted;
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
    const cn = (document.getElementById('inv-client-note') as HTMLTextAreaElement)?.value ?? '';
    const inn = (document.getElementById('inv-int-note') as HTMLTextAreaElement)?.value ?? '';
    const issue = draftIssueDate.trim() || (detail.issueDate ?? '').slice(0, 10);
    const due = draftDueDate.trim() || (detail.dueDate ?? '').slice(0, 10);
    if (!issue || !due) {
      await showAlert({ message: t('timeTrackingPage.invoices.errors.datesRequired') });
      return;
    }
    const body: InvoicePatchInput = {
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
    return <Navigate to={getInvoicesListUrl()} replace />;

  if (userLoading) {
    return (
      <div className="time-page time-page--enter time-page--invoice-sub" role="status" aria-live="polite" aria-busy="true">
        <main className="time-page__main">
          <nav className="time-page__navbar" aria-label={t('timeTrackingPage.invoices.detailPage.navAria')}>
            <AppBackButton onClick={toInvoices} label={t('timeTrackingPage.invoices.backToInvoices')} ariaLabel={t('timeTrackingPage.invoices.backToInvoices')} hideLabelOnMobile />
            <AppHomeLogo withSeparator />
            <div className="time-page__navbar-sep" aria-hidden="true" />
            <span className="time-page__navbar-title">{t('timeTrackingPage.invoices.detail.loading')}</span>
            <div className="time-page__navbar-spacer" />
            <div className="time-page__navbar-settings"><AppPageSettings /></div>
          </nav>
          <div className="time-page__content time-page__content--enter">
            <p className="tt-inv__muted">{t('timeTrackingPage.invoices.detail.loadingCard')}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user || !canAccessTimeTracking(user))
    return <Navigate to={routes.home} replace />;

  return (
    <div className="time-page time-page--enter time-page--invoice-sub">
      <main className="time-page__main">
        <nav className="time-page__navbar" aria-label={t('timeTrackingPage.invoices.detailPage.navAria')}>
          <AppBackButton
            onClick={toInvoices}
            label={t('timeTrackingPage.invoices.backToInvoices')}
            ariaLabel={t('timeTrackingPage.invoices.backToInvoices')}
            hideLabelOnMobile
          />
          <AppHomeLogo withSeparator />
          <div className="time-page__navbar-sep" aria-hidden="true" />
          <span className="time-page__navbar-title">{title}</span>
          <div className="time-page__navbar-spacer" />
          <div className="time-page__navbar-settings">
            <AppPageSettings />
          </div>
        </nav>
        <div className="time-page__content time-page__content--enter tt-inv-page" role="region" aria-labelledby="tt-inv-detail-title">
          {!detail || detailLoading ? (
            <div className="tt-inv-page__loading">
              <p className="tt-inv__muted">{t('timeTrackingPage.invoices.detail.loadingCard')}</p>
            </div>
          ) : (
            <>
              <header className="tt-inv-page__header">
                <div className="tt-inv-page__header-main">
                  <div className="tt-inv-page__title-row">
                    <h1 id="tt-inv-detail-title" className="tt-inv-page__title">{title}</h1>
                    <span className={`tt-inv__badge ${INVOICE_STATUS_BADGE_CLASS[detail.status] ?? 'tt-inv__badge--neutral'}`}>
                      {ttInvoiceStatusLabel(detail.status, t)}
                    </span>
                    {readOnly && (
                      <span className="tt-inv__readonly-badge" role="status">{t('timeTrackingPage.invoices.readonlyBadge')}</span>
                    )}
                  </div>
                  {clientSubtitle && <p className="tt-inv-page__sub">{clientSubtitle}</p>}
                  {detail.storedStatus !== detail.status && (
                    <p className="tt-inv-page__sub">
                      {t('timeTrackingPage.invoices.detail.inDb')}: <code>{detail.storedStatus}</code>
                    </p>
                  )}
                </div>
              </header>

              <div className="tt-inv-page__body">
                <div className="tt-reports__summary tt-inv-page__kpis" aria-label={t('timeTrackingPage.invoices.summary.aria')}>
                  <div className="tt-reports__summary-card tt-inv-page__kpi-status">
                    <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.detail.status')}</span>
                    <span className="tt-reports__summary-value">
                      <span className={`tt-inv__badge ${INVOICE_STATUS_BADGE_CLASS[detail.status] ?? 'tt-inv__badge--neutral'}`}>
                        {ttInvoiceStatusLabel(detail.status, t)}
                      </span>
                    </span>
                  </div>
                  <div className="tt-reports__summary-card">
                    <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.detail.issueDate')}</span>
                    <span className="tt-reports__summary-value" style={{ fontSize: '1.05rem' }}>{fmtDisplayDate(detail.issueDate, locale)}</span>
                  </div>
                  <div className="tt-reports__summary-card">
                    <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.detail.dueDate')}</span>
                    <span className="tt-reports__summary-value" style={{ fontSize: '1.05rem' }}>{fmtDisplayDate(detail.dueDate, locale)}</span>
                  </div>
                  <div className="tt-reports__summary-card tt-inv__summary-card--accent">
                    <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.detail.amount')}</span>
                    <span className="tt-reports__summary-value" style={{ fontSize: '1.05rem' }}>{fmtMoney(detail.totalAmount, detail.currency, locale)}</span>
                  </div>
                  <div className="tt-reports__summary-card tt-inv__summary-card--success">
                    <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.detail.paid')}</span>
                    <span className="tt-reports__summary-value" style={{ fontSize: '1.05rem' }}>{fmtMoney(detail.amountPaid, detail.currency, locale)}</span>
                  </div>
                  <div className={`tt-reports__summary-card${detail.balanceDue > 1e-9 ? ' tt-inv__summary-card--danger' : ' tt-inv__summary-card--muted'}`}>
                    <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.detail.balance')}</span>
                    <span className="tt-reports__summary-value" style={{ fontSize: '1.05rem' }}>{fmtMoney(detail.balanceDue, detail.currency, locale)}</span>
                  </div>
                </div>

                <div className="tt-inv-page__toolbar" role="toolbar" aria-label={t('timeTrackingPage.invoices.detail.exportAria')}>
                  <div className="tt-inv-detail-export">
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => openExistingInvoicePreview(detail)} title={t('timeTrackingPage.invoices.detail.previewTitle')}>
                      {t('timeTrackingPage.invoices.detail.preview')}
                    </button>
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => void handleDetailDownloadPdf(detail)}>
                      {detailExportBusy === 'pdf' ? t('timeTrackingPage.invoices.detail.preparingPdf') : t('timeTrackingPage.invoices.detail.downloadPdf')}
                    </button>
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => void handleDetailDownloadWord(detail)}>
                      {detailExportBusy === 'word' ? t('timeTrackingPage.invoices.detail.preparingWord') : t('timeTrackingPage.invoices.detail.downloadWord')}
                    </button>
                  </div>
                  {!readOnly && (
                    <>
                      <span className="tt-inv-page__toolbar-sep" aria-hidden />
                      <div className="tt-inv-actions">
                        {invoiceCanSend(detail.status as InvoiceUiStatus) && (
                          <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy || Boolean(outlookSendWait && outlookSendWait.invoiceId === detail.id)} onClick={() => setSendContactOpen(true)}>
                            {outlookSendWait && outlookSendWait.invoiceId === detail.id
                              ? t('timeTrackingPage.invoices.sendDialog.outlookWaitingShort')
                              : ttInvoiceSendActionLabel(detail.status as InvoiceUiStatus, t)}
                          </button>
                        )}
                        {invoiceCanMarkViewed(detail.status as InvoiceUiStatus) && (
                          <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={async () => {
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
                          }}>
                            {t('timeTrackingPage.invoices.detail.markViewed')}
                          </button>
                        )}
                        {invoiceCanRegisterPayment(detail.status as InvoiceUiStatus, detail.balanceDue) && (
                          <>
                            <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleFullPaymentNow()}>
                              {t('timeTrackingPage.invoices.detail.fullPayment')}
                            </button>
                            <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={() => {
                              setPayAmount(detail.balanceDue > 1e-9 ? String(detail.balanceDue).replace('.', ',') : '');
                              setPayAt('');
                              setPayOpen(true);
                            }}>
                              {t('timeTrackingPage.invoices.detail.partialPayment')}
                            </button>
                          </>
                        )}
                        {invoiceCanCancel(detail.status as InvoiceUiStatus) && (
                          <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={async () => {
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
                          }}>
                            {t('timeTrackingPage.invoices.detail.cancelInvoice')}
                          </button>
                        )}
                        {invoiceCanDeleteDraft(detail.status as InvoiceUiStatus) && (
                          <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={() => {
                            void deleteInvoiceById(detail);
                          }}>
                            {detail.status === 'canceled'
                              ? t('timeTrackingPage.invoices.detail.deleteCanceled')
                              : t('timeTrackingPage.invoices.detail.deleteDraft')}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {!readOnly && payOpen && (
                  <section
                    ref={paySectionRef}
                    className="tt-inv-page__section tt-inv-page__section--soft"
                    aria-labelledby="tt-inv-pay-section-title"
                  >
                    <div className="tt-inv-page__section-head">
                      <h2 id="tt-inv-pay-section-title" className="tt-inv-page__section-title">{t('timeTrackingPage.invoices.payment.title')}</h2>
                    </div>
                    <div className="tt-inv-pay">
                      <p className="tt-inv-pay__hint">
                        {t('timeTrackingPage.invoices.payment.hint')}
                      </p>
                      <label>
                        {t('timeTrackingPage.invoices.payment.amountLabel')}
                        <input className="tt-inv__input" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={t('timeTrackingPage.invoices.payment.amountPlaceholder')} />
                      </label>
                      <label>
                        {t('timeTrackingPage.invoices.payment.paidAtLabel')}
                        <input type="text" className="tt-inv__input" value={payAt} onChange={(e) => setPayAt(e.target.value)} placeholder={t('timeTrackingPage.invoices.payment.paidAtPlaceholder')} />
                      </label>
                      <label>
                        {t('timeTrackingPage.invoices.payment.methodLabel')}
                        <input className="tt-inv__input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
                      </label>
                      <label>
                        {t('timeTrackingPage.invoices.payment.noteLabel')}
                        <input className="tt-inv__input" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                      </label>
                      <div className="tt-inv-page__draft-actions">
                        <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setPayOpen(false)} disabled={actionBusy}>{t('timeTrackingPage.common.cancel')}</button>
                        <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void handlePayment()} disabled={actionBusy}>{t('timeTrackingPage.invoices.payment.recordPayment')}</button>
                      </div>
                    </div>
                  </section>
                )}

                {outlookSendWait && outlookSendWait.invoiceId === detail.id && (
                  <p className="tt-inv-outlook-wait" role="status">
                    {t('timeTrackingPage.invoices.sendDialog.outlookWaitingBanner').replace('{invoice}', outlookSendWait.label)}
                  </p>
                )}

                {(detail.requiresPaymentConfirmationDocument === true || Boolean(detail.paymentConfirmationDocumentUrl?.trim())) && (
                  <section className="tt-inv-page__section tt-inv-page__section--soft" aria-label={t('timeTrackingPage.invoices.detail.paymentConfirmRegion')}>
                    <div className="tt-inv-page__section-head">
                      <h2 className="tt-inv-page__section-title">{t('timeTrackingPage.invoices.detail.paymentConfirmTitle')}</h2>
                    </div>
                    <div className="tt-inv-pay-confirm">
                      {detail.requiresPaymentConfirmationDocument === true && !readOnly ? (
                        <>
                          <p className="tt-inv-pay-confirm__hint">
                            {t('timeTrackingPage.invoices.detail.paymentConfirmHint')}
                          </p>
                          <label>
                            {t('timeTrackingPage.invoices.detail.paymentConfirmDocLabel')}
                            <input className="tt-inv__input" value={paymentConfirmDocUrl} onChange={(e) => setPaymentConfirmDocUrl(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.paymentConfirmDocPlaceholder')} autoComplete="off" />
                          </label>
                          <div className="tt-inv-page__draft-actions">
                            <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleSubmitPaymentConfirmation()}>
                              {t('timeTrackingPage.invoices.detail.savePaymentConfirm')}
                            </button>
                          </div>
                        </>
                      ) : null}
                      {detail.requiresPaymentConfirmationDocument === true && readOnly ? (
                        <p className="tt-inv-pay-confirm__hint tt-inv__muted">
                          {t('timeTrackingPage.invoices.detail.paymentConfirmReadonly')}
                        </p>
                      ) : null}
                      {detail.paymentConfirmationDocumentUrl?.trim() ? (() => {
                        const u = detail.paymentConfirmationDocumentUrl!.trim();
                        const recRaw = detail.paymentConfirmationRecordedAt?.trim();
                        let recLabel = '';
                        if (recRaw) {
                          const d = new Date(recRaw);
                          recLabel = Number.isNaN(d.getTime())
                            ? recRaw
                            : d.toLocaleString(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' });
                        }
                        return (
                          <p className="tt-inv-pay-confirm__saved">
                            {t('timeTrackingPage.invoices.detail.paymentConfirmRecorded')}{recLabel ? ` · ${recLabel}` : ''}
                            {' · '}
                            {/^https?:\/\//i.test(u)
                              ? (<a href={u} target="_blank" rel="noopener noreferrer">{u}</a>)
                              : <code>{u}</code>}
                          </p>
                        );
                      })() : null}
                    </div>
                  </section>
                )}

                {!readOnly && invoiceCanPatchDraft(detail.status as InvoiceUiStatus) && (
                  <section className="tt-inv-page__section" aria-labelledby="tt-inv-draft-section-title">
                    <div className="tt-inv-page__section-head">
                      <div>
                        <h2 id="tt-inv-draft-section-title" className="tt-inv-page__section-title">{t('timeTrackingPage.invoices.detail.draftDates')}</h2>
                        <p className="tt-inv-page__section-desc">{t('timeTrackingPage.invoices.detail.draftEditHint')}</p>
                      </div>
                    </div>
                    <div className="tt-inv-draft">
                      <div className="tt-inv-dialog__grid tt-inv-dialog__grid--draft-invoice">
                        <div className="tt-inv-dialog__field">
                          <span id="inv-draft-issue-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.detail.issueDate')}</span>
                          <DatePicker id="inv-draft-issue" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={draftIssueDate} max={draftDueDate || undefined} onChange={(iso) => setDraftIssueDate(iso)} portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.detail.issueDate')} showChevron aria-labelledby="inv-draft-issue-lbl" />
                        </div>
                        <div className="tt-inv-dialog__field">
                          <span id="inv-draft-due-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.detail.dueDate')}</span>
                          <DatePicker id="inv-draft-due" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={draftDueDate} min={draftIssueDate || undefined} onChange={(iso) => setDraftDueDate(iso)} portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.detail.dueDate')} showChevron aria-labelledby="inv-draft-due-lbl" />
                        </div>
                        <div className="tt-inv-dialog__field">
                          <label className="tt-inv-dialog__label" htmlFor="inv-tax1">{t('timeTrackingPage.invoices.detail.tax1')}</label>
                          <input id="inv-tax1" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftTaxPct} onChange={(e) => setDraftTaxPct(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.taxPlaceholder')} />
                        </div>
                        <div className="tt-inv-dialog__field">
                          <label className="tt-inv-dialog__label" htmlFor="inv-tax2">{t('timeTrackingPage.invoices.detail.tax2')}</label>
                          <input id="inv-tax2" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftTax2Pct} onChange={(e) => setDraftTax2Pct(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.optionalPlaceholder')} />
                        </div>
                        <div className="tt-inv-dialog__field">
                          <label className="tt-inv-dialog__label" htmlFor="inv-disc">{t('timeTrackingPage.invoices.detail.discount')}</label>
                          <input id="inv-disc" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftDiscAmt} onChange={(e) => setDraftDiscAmt(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.discountPlaceholder')} />
                        </div>
                      </div>
                      <div className="tt-inv-draft__notes">
                        <label htmlFor="inv-client-note">
                          {t('timeTrackingPage.invoices.detail.clientNote')}
                          <textarea className="tt-inv__textarea" rows={3} defaultValue={detail.clientNote ?? ''} id="inv-client-note" />
                        </label>
                        <label htmlFor="inv-int-note">
                          {t('timeTrackingPage.invoices.detail.internalNote')}
                          <textarea className="tt-inv__textarea" rows={3} defaultValue={detail.internalNote ?? ''} id="inv-int-note" />
                        </label>
                      </div>
                      <div className="tt-inv-page__draft-actions">
                        <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleSaveDraft()}>
                          {t('timeTrackingPage.invoices.detail.saveDraft')}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                <section className="tt-inv-page__section" aria-labelledby="tt-inv-lines-section-title">
                  <div className="tt-inv-page__section-head">
                    <h2 id="tt-inv-lines-section-title" className="tt-inv-page__section-title">{t('timeTrackingPage.invoices.detail.linesTitle')}</h2>
                    <span className="tt-inv-page__section-desc">
                      {(detail.lines ?? []).length}
                    </span>
                  </div>
                  <div className="tt-reports__table-wrap tt-inv-page__table-wrap">
                    <table className="tt-inv-mini tt-inv-mini--lines">
                      <thead>
                        <tr>
                          <th>{t('timeTrackingPage.invoices.detail.linesKind')}</th>
                          <th>{t('timeTrackingPage.invoices.detail.linesDescription')}</th>
                          <th>{t('timeTrackingPage.invoices.detail.linesQty')}</th>
                          <th>{t('timeTrackingPage.invoices.detail.linesPrice')}</th>
                          <th>{t('timeTrackingPage.invoices.detail.linesAmount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.lines ?? []).map((ln) => (
                          <tr key={ln.id}>
                            <td>
                              <span className={`tt-inv-line-kind tt-inv-line-kind--${invoiceLineKindSlug(ln)}`}>
                                {invoiceLineKindLabel(ln, t)}
                              </span>
                            </td>
                            <td>{ln.description ? invoiceClientDescription(ln.description) || '—' : '—'}</td>
                            <td>{Number.isFinite(Number(ln.quantity)) ? Number(ln.quantity).toFixed(2) : ln.quantity}</td>
                            <td>{fmtMoney(ln.unitAmount, detail.currency, locale)}</td>
                            <td>
                              {fmtMoney(ln.lineTotal, detail.currency, locale)}
                              {ln.sourceCurrency && ln.sourceCurrency !== detail.currency && ln.sourceAmount != null
                                ? ` (${fmtMoney(ln.sourceAmount, ln.sourceCurrency, locale)})`
                                : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(detail.payments ?? []).length > 0 && (
                    <>
                      <h3 className="tt-inv-page__section-title" style={{ marginTop: '1rem' }}>{t('timeTrackingPage.invoices.detail.paymentsTitle')}</h3>
                      <ul className="tt-inv-page__payments">
                        {detail.payments!.map((p) => (
                          <li key={p.id}>{fmtMoney(p.amount, detail.currency, locale)} — {p.paidAt}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </main>

      {sendContactOpen && detail && !readOnly && (
        <InvoiceSendContactModal
          clientId={detail.clientId}
          clientName={clientNameById.get(detail.clientId) ?? detail.clientId}
          invoiceLabel={detail.invoiceNumber || detail.id}
          onClose={() => {
            if (!actionBusy)
              setSendContactOpen(false);
          }}
          onConfirm={async (contact) => {
            setActionBusy(true);
            try {
              const client = await getTimeManagerClient(detail.clientId);
              const model = buildInvoiceCoverLetterModel({
                issueDateIso: detail.issueDate.slice(0, 10),
                clientName: client.name,
                clientAddress: client.address,
                contactName: client.contact_name ?? null,
                totalAmount: detail.totalAmount,
                currency: detail.currency,
              });
              const clientLabel = (clientNameById.get(detail.clientId) ?? detail.clientId).trim();
              const meta = await invoicePreviewMetaForExisting(detail, clientLabel);
              const previewSession = { v: 1 as const, mode: 'existing' as const, invoiceId: detail.id, meta };
              const { buildInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewPdf');
              const blob = await buildInvoicePreviewPdfBlob({ model, session: previewSession });
              const pdfBase64 = await blobToBase64(blob);
              const invoiceLabel = detail.invoiceNumber || detail.id;
              const amountLabel = fmtMoney(detail.totalAmount, detail.currency, locale);
              const nameSuffix = contact.name
                ? t('timeTrackingPage.invoices.sendDialog.nameSuffix').replace('{name}', contact.name)
                : '';
              const subject = t('timeTrackingPage.invoices.sendDialog.mailSubject').replace('{invoice}', invoiceLabel);
              const bodyHtml = t('timeTrackingPage.invoices.sendDialog.mailBodyHtml')
                .replaceAll('{nameSuffix}', escapeHtml(nameSuffix))
                .replaceAll('{invoice}', escapeHtml(invoiceLabel))
                .replaceAll('{amount}', escapeHtml(amountLabel));
              const bodyText = t('timeTrackingPage.invoices.sendDialog.mailBodyText')
                .replaceAll('{nameSuffix}', nameSuffix)
                .replaceAll('{invoice}', invoiceLabel)
                .replaceAll('{amount}', amountLabel);
              const pdfFileName = `${buildInvoicePreviewExportBasename({
                invoiceNumber: detail.invoiceNumber,
                clientLabel,
                issueDateIso: detail.issueDate.slice(0, 10),
              })}.pdf`;

              const draft = await createInvoiceOutlookDraft(detail.id, {
                toEmail: contact.email,
                toName: contact.name || null,
                subject,
                bodyHtml,
                bodyText,
                pdfBase64,
                pdfFileName,
              });

              const notifyAccounting = () => notifyAccountingLastInvoicePage({
                invoiceId: detail.id,
                model,
                session: previewSession,
                clientLabel,
                invoiceNumber: detail.invoiceNumber,
                issueDateIso: detail.issueDate.slice(0, 10),
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
              const msg = e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic');
              const lower = msg.toLowerCase();
              if (lower.includes('не подключ') || lower.includes('not connected') || lower.includes('mail.readwrite'))
                await showAlert({ message: t('timeTrackingPage.invoices.errors.outlookNotConnected') });
              else
                await showAlert({ message: msg || t('timeTrackingPage.invoices.errors.outlookDraftFailed') });
              throw e;
            }
            finally {
              setActionBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
