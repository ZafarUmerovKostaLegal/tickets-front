import letterheadFullLogoUrl from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?url';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { KOSTA_LEGAL_FIRM } from '../lib/invoiceCoverLetterModel';
import './InvoiceLegalInvoicePage.css';

function bankingLines(currencyCode: string): readonly string[] {
    const cur = currencyCode.toUpperCase() || 'EUR';
    return [
        'TIN: —',
        'Bank name: —',
        'Bank address: —',
        `AC (${cur}): —`,
        'Bank code: —',
        'SWIFT: —',
        'Correspondent bank: —',
        `Corr. ACC (${cur}): —`,
    ] as const;
}

const DISCLAIMER = (
    'The payment under this invoice shall constitute the due acceptance of the Services by '
    + 'the Client. Perfection of a separate document on acceptance of the Services is not '
    + 'required.'
);

function isoToday(): string {
    return new Date().toISOString().slice(0, 10);
}

function resolveIssueIso(session: InvoicePreviewSessionV1 | null): string {
    if (!session)
        return isoToday();
    if (session.mode === 'existing')
        return session.meta.issueDateIso?.slice(0, 10) ?? isoToday();
    return session.form.issueDate.slice(0, 10);
}

function resolveDueIso(session: InvoicePreviewSessionV1 | null, issueIso: string): string {
    if (session?.mode === 'create')
        return session.form.dueDate.slice(0, 10);
    return issueIso;
}

function uppercaseLongDate(isoYmd: string): string {
    if (!isoYmd || !/^\d{4}-\d{2}-\d{2}$/.test(isoYmd))
        return '—';
    const d = new Date(`${isoYmd}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).toUpperCase();
}

function invoiceNoDisplay(session: InvoicePreviewSessionV1 | null): string {
    const n = session?.meta.invoiceNumber?.trim();
    if (n)
        return n;
    return 'KL-XXXX-00/00';
}

function currencyPrefix(model: InvoiceCoverLetterModel): string {
    const t = model.totalFormatted.trim().split(/\s+/)[0];
    return t?.replace(/[^A-Za-z]/g, '').toUpperCase() || 'EUR';
}

/** «0 000,00» с учётом валютного символа в первой колонке — только число EUR */
function zeroAmountStyled(model: InvoiceCoverLetterModel): string {
    const cur = currencyPrefix(model);
    return `${cur} 0,00`;
}

export type InvoiceLegalInvoicePageProps = {
    model: InvoiceCoverLetterModel;
    session: InvoicePreviewSessionV1 | null;
};

export function InvoiceLegalInvoicePage({ model, session }: InvoiceLegalInvoicePageProps) {
    const issueIso = resolveIssueIso(session);
    const dueIso = resolveDueIso(session, issueIso);
    const ribbonIssue = uppercaseLongDate(issueIso);
    const dueBanner = uppercaseLongDate(dueIso);
    const invNo = invoiceNoDisplay(session);
    const caseLine = session?.meta.projectLabel?.trim() || 'Legal services';
    const cur = currencyPrefix(model);
    const svcLine = `Legal services rendered in ${model.servicesMonthYear}`;

    return (<div className="tt-inv-li">
      <header className="tt-inv-li__masthead">
        <div className="tt-inv-li__firm-blurb">
          <p className="tt-inv-li__firm-name">{KOSTA_LEGAL_FIRM.brandName} LF</p>
          <p className="tt-inv-li__firm-line">{KOSTA_LEGAL_FIRM.addressLine}</p>
          {bankingLines(cur).map((line, i) => (<p key={i} className="tt-inv-li__firm-line">{line}</p>))}
        </div>
        <div className="tt-inv-li__brand">
          <img className="tt-inv-li__logo" src={letterheadFullLogoUrl} alt="" decoding="async"/>
        </div>
      </header>

      <div className="tt-inv-li__ribbon">
        <span className="tt-inv-li__ribbon-no">{`INVOICE No. ${invNo}`}</span>
        <span className="tt-inv-li__ribbon-date">{ribbonIssue}</span>
      </div>

      <div className="tt-inv-li__panels">
        <div className="tt-inv-li__panel">
          <h3 className="tt-inv-li__panel-h">Bill to</h3>
          <p className="tt-inv-li__panel-strong">{model.recipientCompany}</p>
          <p className="tt-inv-li__panel-label">Address:</p>
          <p className="tt-inv-li__panel-muted">{model.recipientAddressLines[0]}</p>
          {model.recipientAddressLines[1] ? <p className="tt-inv-li__panel-muted">{model.recipientAddressLines[1]}</p> : null}
          <p className="tt-inv-li__panel-label">Bank name:</p>
          <p className="tt-inv-li__panel-muted tt-inv-li__muted-dash">—</p>
          <p className="tt-inv-li__panel-label">SWIFT:</p>
          <p className="tt-inv-li__panel-muted tt-inv-li__muted-dash">—</p>
        </div>
        <div className="tt-inv-li__panel tt-inv-li__panel--right">
          <h3 className="tt-inv-li__panel-h">Case details</h3>
          <p className="tt-inv-li__panel-text">{caseLine}</p>
        </div>
      </div>

      <table className="tt-inv-li__svc-table" role="presentation">
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col" className="tt-inv-li__th-total">{`Total (${cur})`}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="tt-inv-li__svc-row-main">
            <td>{svcLine}</td>
            <td className="tt-inv-li__svc-amt">{model.totalFormatted}</td>
          </tr>
        </tbody>
      </table>

      <div className="tt-inv-li__totals">
        <div className="tt-inv-li__total-line"><span className="tt-inv-li__total-label">SUBTOTAL:</span>{' '}{model.totalFormatted}</div>
        <div className="tt-inv-li__total-line">{`VAT: ${zeroAmountStyled(model)}`}</div>
        <div className="tt-inv-li__total-line">{`Extra expenses: ${zeroAmountStyled(model)}`}</div>
        <div className="tt-inv-li__total-due">
          <span className="tt-inv-li__total-due-label">{`TOTAL DUE BY ${dueBanner}:`}</span>
          {' '}
          <span className="tt-inv-li__total-due-amt">{model.totalFormatted}</span>
        </div>
      </div>

      <p className="tt-inv-li__thanks">Thank you for your business!</p>

      <footer className="tt-inv-li__bottom" aria-label="Условия">
        <p className="tt-inv-li__disclaimer">{DISCLAIMER}</p>
      </footer>
    </div>);
}
