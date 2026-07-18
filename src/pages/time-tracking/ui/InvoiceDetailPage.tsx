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
import {
  blobToBase64,
  buildPaidAtForPaymentApi,
  escapeHtml,
  fmtDisplayDate,
  fmtMoney,
  invoiceLineKindLabel,
  invoiceLineKindSlug,
  invoicePreviewMetaForExisting,
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
  const [draftDiscPct, setDraftDiscPct] = useState('');

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
    setDraftDiscPct(detail.discountPercent != null ? String(detail.discountPercent) : '');
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
        writeInvoicePreviewSession({
          v: 1,
          mode: 'existing',
          invoiceId: inv.id,
          meta,
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
      const client = await getTimeManagerClient(inv.clientId);
      const model = buildInvoiceCoverLetterModel({
        issueDateIso: inv.issueDate.slice(0, 10),
        clientName: client.name,
        clientAddress: client.address,
        contactName: client.contact_name ?? null,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
      });
      const clientLabel = (clientNameById.get(inv.clientId) ?? inv.clientId).trim();
      const meta = await invoicePreviewMetaForExisting(inv, clientLabel);
      const previewSession = { v: 1 as const, mode: 'existing' as const, invoiceId: inv.id, meta };

      const { buildInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewPdf');
      const blob = await buildInvoicePreviewPdfBlob({ model, session: previewSession });
      const base = buildInvoicePreviewExportBasename({
        invoiceNumber: inv.invoiceNumber,
        clientLabel: clientNameById.get(inv.clientId) ?? inv.clientId,
        issueDateIso: inv.issueDate.slice(0, 10),
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
      const client = await getTimeManagerClient(inv.clientId);
      const model = buildInvoiceCoverLetterModel({
        issueDateIso: inv.issueDate.slice(0, 10),
        clientName: client.name,
        clientAddress: client.address,
        contactName: client.contact_name ?? null,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
      });
      const clientLabel = (clientNameById.get(inv.clientId) ?? inv.clientId).trim();
      const meta = await invoicePreviewMetaForExisting(inv, clientLabel);
      const previewSession = { v: 1 as const, mode: 'existing' as const, invoiceId: inv.id, meta };

      const { buildInvoicePreviewDocxBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewDocx');
      const blob = await buildInvoicePreviewDocxBlob({ model, session: previewSession });
      const base = buildInvoicePreviewExportBasename({
        invoiceNumber: inv.invoiceNumber,
        clientLabel: clientNameById.get(inv.clientId) ?? inv.clientId,
        issueDateIso: inv.issueDate.slice(0, 10),
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
      setDetail(next);
      setPayOpen(false);
      notifyReportsInvalidated();
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
    if (!Number.isFinite(due) || due <= 1e-9)
      return;
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
      setDetail(next);
      setPayOpen(false);
      notifyReportsInvalidated();
      if (next.requiresPaymentConfirmationDocument === true)
        pushToast({ message: t('timeTrackingPage.invoices.payment.documentRequired'), variant: 'warning' });
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
    }
    finally {
      setActionBusy(false);
    }
  }, [invoiceId, detail, showAlert, pushToast, t]);

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
    const d = parseOptionalPercentField(draftDiscPct);
    if (t1 !== undefined)
      body.taxPercent = t1;
    if (t2 !== undefined)
      body.tax2Percent = t2;
    if (d !== undefined)
      body.discountPercent = d;
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
  }, [detail, draftIssueDate, draftDueDate, draftTaxPct, draftTax2Pct, draftDiscPct, refreshDetail, showAlert, t]);

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
          <header className="tt-inv-page__header">
            <h1 id="tt-inv-detail-title" className="tt-inv-page__title">{title}</h1>
            {clientSubtitle && <p className="tt-inv-page__sub">{clientSubtitle}</p>}
            {readOnly && (
              <span className="tt-inv__readonly-badge" role="status">{t('timeTrackingPage.invoices.readonlyBadge')}</span>
            )}
          </header>

          <div className="tt-inv-page__body">
            {!detail || detailLoading ? (
              <p className="tt-inv__muted">{t('timeTrackingPage.invoices.detail.loadingCard')}</p>
            ) : (
              <>
                <div className="tt-inv-detail-meta tt-inv-detail-meta--page">
                  <div className="tt-inv-detail-meta__item">
                    <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.status')}</span>
                    <span className="tt-inv-detail-meta__v">
                      <span className={`tt-inv__badge ${INVOICE_STATUS_BADGE_CLASS[detail.status] ?? 'tt-inv__badge--neutral'}`}>
                        {ttInvoiceStatusLabel(detail.status, t)}
                      </span>
                    </span>
                  </div>
                  {detail.storedStatus !== detail.status && (
                    <div className="tt-inv-detail-meta__item">
                      <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.inDb')}</span>
                      <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--mono">{detail.storedStatus}</span>
                    </div>
                  )}
                  <div className="tt-inv-detail-meta__item">
                    <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.issueDate')}</span>
                    <span className="tt-inv-detail-meta__v">{fmtDisplayDate(detail.issueDate, locale)}</span>
                  </div>
                  <div className="tt-inv-detail-meta__item">
                    <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.dueDate')}</span>
                    <span className="tt-inv-detail-meta__v">{fmtDisplayDate(detail.dueDate, locale)}</span>
                  </div>
                  <div className="tt-inv-detail-meta__item">
                    <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.amount')}</span>
                    <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num">{fmtMoney(detail.totalAmount, detail.currency, locale)}</span>
                  </div>
                  <div className="tt-inv-detail-meta__item">
                    <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.paid')}</span>
                    <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num">{fmtMoney(detail.amountPaid, detail.currency, locale)}</span>
                  </div>
                  <div className="tt-inv-detail-meta__item">
                    <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.balance')}</span>
                    <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num tt-inv-detail-meta__v--strong">{fmtMoney(detail.balanceDue, detail.currency, locale)}</span>
                  </div>
                </div>

                {(detail.requiresPaymentConfirmationDocument === true || Boolean(detail.paymentConfirmationDocumentUrl?.trim())) && (
                  <div className="tt-inv-pay-confirm" role="region" aria-label={t('timeTrackingPage.invoices.detail.paymentConfirmRegion')}>
                    {detail.requiresPaymentConfirmationDocument === true && !readOnly ? (
                      <>
                        <h2 className="tt-inv__section-title">{t('timeTrackingPage.invoices.detail.paymentConfirmTitle')}</h2>
                        <p className="tt-inv-pay-confirm__hint">
                          {t('timeTrackingPage.invoices.detail.paymentConfirmHint')}
                        </p>
                        <label>
                          {t('timeTrackingPage.invoices.detail.paymentConfirmDocLabel')}
                          <input className="tt-inv__input" value={paymentConfirmDocUrl} onChange={(e) => setPaymentConfirmDocUrl(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.paymentConfirmDocPlaceholder')} autoComplete="off" />
                        </label>
                        <div className="tt-inv-actions tt-inv-pay-confirm__actions">
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
                )}

                <div className="tt-inv-detail-export" role="group" aria-label={t('timeTrackingPage.invoices.detail.exportAria')}>
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

                {outlookSendWait && outlookSendWait.invoiceId === detail.id && (
                  <p className="tt-inv-outlook-wait" role="status">
                    {t('timeTrackingPage.invoices.sendDialog.outlookWaitingBanner').replace('{invoice}', outlookSendWait.label)}
                  </p>
                )}

                {!readOnly && (
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
                )}

                {!readOnly && invoiceCanPatchDraft(detail.status as InvoiceUiStatus) && (
                  <div className="tt-inv-draft">
                    <p className="tt-inv-draft__hint">{t('timeTrackingPage.invoices.detail.draftEditHint')}</p>
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
                        <input id="inv-disc" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftDiscPct} onChange={(e) => setDraftDiscPct(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.optionalPlaceholder')} />
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
                    <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleSaveDraft()}>
                      {t('timeTrackingPage.invoices.detail.saveDraft')}
                    </button>
                  </div>
                )}

                {!readOnly && payOpen && (
                  <div className="tt-inv-pay">
                    <h2 className="tt-inv__section-title">{t('timeTrackingPage.invoices.payment.title')}</h2>
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
                    <div className="tt-inv-actions">
                      <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setPayOpen(false)} disabled={actionBusy}>{t('timeTrackingPage.common.cancel')}</button>
                      <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void handlePayment()} disabled={actionBusy}>{t('timeTrackingPage.invoices.payment.recordPayment')}</button>
                    </div>
                  </div>
                )}

                <div className="tt-inv-detail__section-divider" role="presentation" aria-hidden />
                <h2 className="tt-inv__section-title">{t('timeTrackingPage.invoices.detail.linesTitle')}</h2>
                <div className="tt-reports__table-wrap tt-inv-page__table-wrap">
                  <table className="tt-inv-mini">
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
                          <td>{ln.description ?? '—'}</td>
                          <td>{ln.quantity}</td>
                          <td>{ln.unitAmount}</td>
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
                    <h2 className="tt-inv__section-title">{t('timeTrackingPage.invoices.detail.paymentsTitle')}</h2>
                    <ul className="tt-inv-payments">
                      {detail.payments!.map((p) => (
                        <li key={p.id}>{fmtMoney(p.amount, detail.currency, locale)} — {p.paidAt}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
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

              const opened = openOutlookComposePopup(draft.webLink);
              if (!opened)
                await showAlert({ message: t('timeTrackingPage.invoices.errors.outlookOpenFailed') });

              setSendContactOpen(false);

              const messageId = (draft.messageId || '').trim();
              if (!messageId) {
                await sendInvoice(detail.id);
                await refreshDetail(detail.id);
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
