import letterheadFullLogoUrl from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?url';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { KOSTA_LEGAL_FIRM } from '../lib/invoiceCoverLetterModel';
import {
    INVOICE_PAYMENT_DISCLAIMER,
    packCaseDetailLine,
    packCurrencyCode,
    packFirmBankingLines,
    packInvoiceNumberDisplay,
    packResolveDueIso,
    packResolveIssueIso,
    packUppercaseRibbonDate,
    packZeroCommaAmount,
} from '../lib/invoicePreviewPackShared';
import './InvoiceLegalInvoicePage.css';

export type InvoiceLegalInvoicePageProps = {
    model: InvoiceCoverLetterModel;
    session: InvoicePreviewSessionV1 | null;
};

export function InvoiceLegalInvoicePage({ model, session }: InvoiceLegalInvoicePageProps) {
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const ribbonIssue = packUppercaseRibbonDate(issueIso);
    const dueBanner = packUppercaseRibbonDate(dueIso);
    const invNo = packInvoiceNumberDisplay(session);
    const caseLine = packCaseDetailLine(session);
    const cur = packCurrencyCode(model);
    const zeroLine = packZeroCommaAmount(model);
    const svcLine = `Legal services rendered in ${model.servicesMonthYear}`;

    return (<div className="tt-inv-li">
      <header className="tt-inv-li__masthead">
        <div className="tt-inv-li__firm-blurb">
          <p className="tt-inv-li__firm-name">{KOSTA_LEGAL_FIRM.brandName} LF</p>
          <p className="tt-inv-li__firm-line">{KOSTA_LEGAL_FIRM.addressLine}</p>
          {packFirmBankingLines(cur).map((line, i) => (<p key={i} className="tt-inv-li__firm-line">{line}</p>))}
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
        <div className="tt-inv-li__total-line">{`VAT: ${zeroLine}`}</div>
        <div className="tt-inv-li__total-line">{`Extra expenses: ${zeroLine}`}</div>
        <div className="tt-inv-li__total-due">
          <span className="tt-inv-li__total-due-label">{`TOTAL DUE BY ${dueBanner}:`}</span>
          {' '}
          <span className="tt-inv-li__total-due-amt">{model.totalFormatted}</span>
        </div>
      </div>

      <p className="tt-inv-li__thanks">Thank you for your business!</p>

      <footer className="tt-inv-li__bottom" aria-label="Условия">
        <p className="tt-inv-li__disclaimer">{INVOICE_PAYMENT_DISCLAIMER}</p>
      </footer>
    </div>);
}
