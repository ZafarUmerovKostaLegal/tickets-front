import { listAllClientProjectsForClientMerged, type InvoiceDto, type InvoiceLineDto, type InvoicePreviewMeta } from '@entities/time-tracking';
import type { TimeTrackingT } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import type { AppLocale } from '@shared/i18n/types';

export function fmtMoney(n: number, cur: string, locale: AppLocale): string {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `${x.toLocaleString(localeTag(locale), { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/** Build PDF of the last invoice preview page (legal invoice) and email it to accounting. */
export async function notifyAccountingLastInvoicePage(opts: {
  invoiceId: string;
  model: import('@pages/invoice-preview/lib/invoiceCoverLetterModel').InvoiceCoverLetterModel;
  session: import('@entities/time-tracking/model/invoicePreviewSession').InvoicePreviewSessionV1;
  clientLabel: string;
  invoiceNumber: string | null | undefined;
  issueDateIso: string;
}): Promise<void> {
  const { buildInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewPdf');
  const { resolveInvoiceTimeReportPack } = await import('@pages/invoice-preview/lib/resolveInvoiceTimeReportPack');
  const { splitDetailRowsForPagedTimeReport } = await import('@pages/invoice-preview/lib/invoiceTimeReportChunking');
  const { invoicePreviewPageCount } = await import('@pages/invoice-preview/lib/invoiceLegalPageModel');
  const { buildInvoicePreviewExportBasename } = await import('@pages/invoice-preview/lib/invoicePreviewDownload');
  const { notifyInvoiceAccountingLastPage } = await import('@entities/time-tracking');

  const pack = await resolveInvoiceTimeReportPack(opts.session, opts.model);
  const pageCount = invoicePreviewPageCount(splitDetailRowsForPagedTimeReport(pack.detailSlots).length);
  const blob = await buildInvoicePreviewPdfBlob({
    model: opts.model,
    session: opts.session,
    timeReportPack: pack,
    selectedPageNumbers: [pageCount],
  });
  const pdfBase64 = await blobToBase64(blob);
  const pdfFileName = `${buildInvoicePreviewExportBasename({
    invoiceNumber: opts.invoiceNumber,
    clientLabel: opts.clientLabel,
    issueDateIso: opts.issueDateIso,
  })}-invoice-page.pdf`;
  await notifyInvoiceAccountingLastPage(opts.invoiceId, {
    pdfBase64,
    pdfFileName,
    clientName: opts.clientLabel,
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Outlook compose in a centered popup (not a new browser tab). */
export function openOutlookComposePopup(url: string): Window | null {
  const href = String(url ?? '').trim();
  if (!href || typeof window === 'undefined')
    return null;
  const availW = window.screen?.availWidth || window.innerWidth || 1200;
  const availH = window.screen?.availHeight || window.innerHeight || 900;
  const width = Math.min(1100, Math.max(720, Math.floor(availW * 0.72)));
  const height = Math.min(900, Math.max(640, Math.floor(availH * 0.85)));
  const left = Math.max(0, Math.floor((availW - width) / 2) + (window.screenLeft || window.screenX || 0));
  const top = Math.max(0, Math.floor((availH - height) / 2) + (window.screenTop || window.screenY || 0));
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'scrollbars=yes',
    'resizable=yes',
  ].join(',');
  const popup = window.open(href, 'kostaOutlookInvoiceCompose', features);
  try {
    if (popup)
      popup.opener = null;
  }
  catch {
    /* ignore cross-origin */
  }
  return popup;
}

export function invoiceLineKindSlug(ln: InvoiceLineDto): string {
  const k = (ln.lineKind ?? '').toLowerCase().trim();
  if (k === 'time' || Boolean(ln.timeEntryId))
    return 'time';
  if (k === 'expense' || Boolean(ln.expenseRequestId))
    return 'expense';
  if (k === 'manual')
    return 'manual';
  return 'other';
}

export function invoiceLineKindLabel(ln: InvoiceLineDto, t: TimeTrackingT): string {
  switch (invoiceLineKindSlug(ln)) {
    case 'time':
      return t('timeTrackingPage.invoices.lineTypes.time');
    case 'expense':
      return t('timeTrackingPage.invoices.lineTypes.expense');
    case 'manual':
      return t('timeTrackingPage.invoices.lineTypes.manual');
    default:
      return (ln.lineKind && ln.lineKind.trim()) || '—';
  }
}

export function fmtDisplayDate(iso: string, locale: AppLocale): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso))
    return iso || '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime()))
    return iso;
  return d.toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function invoicePreviewMetaForExisting(inv: InvoiceDto, clientLabel: string): Promise<InvoicePreviewMeta> {
  const meta: InvoicePreviewMeta = {
    clientLabel,
    invoiceNumber: inv.invoiceNumber,
    issueDateIso: inv.issueDate.slice(0, 10),
    dueDateIso: inv.dueDate.slice(0, 10),
  };
  if (!inv.projectId?.trim())
    return meta;
  try {
    const rows = await listAllClientProjectsForClientMerged(inv.clientId);
    const p = rows.find((r) => r.id === inv.projectId);
    if (p)
      meta.projectLabel = (p.code ? `${p.name} (${p.code})` : p.name).trim();
  }
  catch {
  }
  return meta;
}

export function parseMoneyRu(raw: string): number {
  const t = raw.replace(/\s/g, '').replace(/\u00a0/g, '').trim();
  if (!t)
    return NaN;
  if (t.includes(',') && t.includes('.')) {
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) {
      return Number.parseFloat(t.replace(/\./g, '').replace(',', '.'));
    }
    return Number.parseFloat(t.replace(/,/g, ''));
  }
  if (t.includes(','))
    return Number.parseFloat(t.replace(',', '.'));
  return Number.parseFloat(t);
}

export function buildPaidAtForPaymentApi(raw: string): string | undefined {
  const t = raw.trim();
  if (!t)
    return undefined;
  if (/^\d{2}\.\d{2}\.\d{4}/.test(t))
    return t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime()))
    return d.toISOString();
  return t;
}

export function parseOptionalPercentField(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t)
    return undefined;
  const n = Number.parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(n))
    return undefined;
  return n;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function lastOfMonthIso(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

export function notifyReportsInvalidated() {
  window.dispatchEvent(new Event('tt-reports-invalidate'));
}
