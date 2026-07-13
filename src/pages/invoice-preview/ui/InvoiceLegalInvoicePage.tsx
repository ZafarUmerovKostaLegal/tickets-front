import type { ChangeEvent } from 'react';
import letterheadFullLogoUrl from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?url';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { KOSTA_LEGAL_FIRM } from '../lib/invoiceCoverLetterModel';
import {
    packCurrencyCode,
    packInvoiceNumberDisplay,
    packResolveDueIso,
    packResolveIssueIso,
    packUppercaseRibbonDate,
    packZeroCommaAmount,
} from '../lib/invoicePreviewPackShared';
import {
    legalBankingInputValue,
    legalFirmBankingRows,
    resolveLegalBillToBankName,
    resolveLegalBillToSwift,
    resolveLegalCaseDetailLine,
    resolveLegalPaymentDisclaimer,
    resolveLegalServiceDescriptionLine,
    type InvoiceLegalBankingFieldKey,
    type InvoiceLegalPageOverrides,
} from '../lib/invoiceLegalPageModel';
import './InvoiceLegalInvoicePage.css';

export type InvoiceLegalInvoicePageProps = {
    model: InvoiceCoverLetterModel;
    session: InvoicePreviewSessionV1 | null;
    editable?: boolean;
    legalOverrides?: InvoiceLegalPageOverrides;
    onChangeLegalOverrides?: (patch: Partial<InvoiceLegalPageOverrides>) => void;
    onChangeModel?: (patch: Partial<InvoiceCoverLetterModel>) => void;
};

function LiField({
    className,
    value,
    editable,
    multiline,
    ariaLabel,
    onChange,
}: {
    className?: string;
    value: string;
    editable?: boolean;
    multiline?: boolean;
    ariaLabel?: string;
    onChange?: (next: string) => void;
}) {
    if (!editable) {
        return <span className={className}>{value}</span>;
    }
    const shared = {
        className: `tt-inv-li__field${className ? ` ${className}` : ''}`,
        value,
        'aria-label': ariaLabel,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange?.(e.target.value),
    };
    if (multiline) {
        return <textarea {...shared} rows={3} />;
    }
    return <input type="text" {...shared} />;
}

function BankingLine({
    label,
    displayValue,
    inputValue,
    editable,
    ariaLabel,
    onChange,
}: {
    label: string;
    displayValue: string;
    inputValue: string;
    editable?: boolean;
    ariaLabel: string;
    onChange?: (next: string) => void;
}) {
    return (
        <p className="tt-inv-li__firm-line tt-inv-li__bank-line">
            <span className="tt-inv-li__bank-label">{label}:</span>{' '}
            <LiField
                editable={editable}
                className="tt-inv-li__field--bank"
                value={editable ? inputValue : displayValue}
                ariaLabel={ariaLabel}
                onChange={onChange}
            />
        </p>
    );
}

export function InvoiceLegalInvoicePage({
    model,
    session,
    editable = false,
    legalOverrides,
    onChangeLegalOverrides,
    onChangeModel,
}: InvoiceLegalInvoicePageProps) {
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const ribbonIssue = packUppercaseRibbonDate(issueIso);
    const dueBanner = packUppercaseRibbonDate(dueIso);
    const invNo = packInvoiceNumberDisplay(session);
    const caseLine = resolveLegalCaseDetailLine(session, legalOverrides);
    const cur = packCurrencyCode(model);
    const zeroLine = packZeroCommaAmount(model);
    const svcLine = resolveLegalServiceDescriptionLine(model, legalOverrides);
    const paymentDisclaimer = resolveLegalPaymentDisclaimer(legalOverrides);
    const addr2 = model.recipientAddressLines[1];
    const firmBankingRows = legalFirmBankingRows(cur, legalOverrides);
    const billToBankName = resolveLegalBillToBankName(legalOverrides);
    const billToSwift = resolveLegalBillToSwift(legalOverrides);

    const patchBanking = (field: InvoiceLegalBankingFieldKey, next: string) => {
        onChangeLegalOverrides?.({ [field]: next });
    };

    return (<div className={`tt-inv-li${editable ? ' tt-inv-li--editable' : ''}`}>
      <header className="tt-inv-li__masthead">
        <div className="tt-inv-li__firm-blurb">
          <p className="tt-inv-li__firm-name">{KOSTA_LEGAL_FIRM.brandName} LF</p>
          <p className="tt-inv-li__firm-line">{KOSTA_LEGAL_FIRM.addressLine}</p>
          {firmBankingRows.map((row) => (
            <BankingLine
              key={row.field}
              label={row.label}
              displayValue={row.value}
              inputValue={legalBankingInputValue(legalOverrides?.[row.field])}
              editable={editable}
              ariaLabel={row.label}
              onChange={(next) => patchBanking(row.field, next)}
            />
          ))}
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
          <p className="tt-inv-li__panel-strong">
            <LiField
              editable={editable}
              value={model.recipientCompany}
              ariaLabel="Bill to company"
              onChange={(recipientCompany) => onChangeModel?.({ recipientCompany, quotedCompanyName: recipientCompany })}
            />
          </p>
          <p className="tt-inv-li__panel-label">Address:</p>
          <p className="tt-inv-li__panel-muted">
            <LiField
              editable={editable}
              value={model.recipientAddressLines[0]}
              ariaLabel="Bill to address line 1"
              onChange={(line0) => onChangeModel?.({
                recipientAddressLines: [line0, model.recipientAddressLines[1] ?? ''],
              })}
            />
          </p>
          {editable || addr2 ? (
            <p className="tt-inv-li__panel-muted">
              <LiField
                editable={editable}
                value={addr2 ?? ''}
                ariaLabel="Bill to address line 2"
                multiline={editable}
                onChange={(line1) => onChangeModel?.({
                  recipientAddressLines: [model.recipientAddressLines[0], line1],
                })}
              />
            </p>
          ) : null}
          <p className="tt-inv-li__panel-label">Bank name:</p>
          <p className="tt-inv-li__panel-muted">
            <LiField
              editable={editable}
              value={editable ? legalBankingInputValue(legalOverrides?.billToBankName) : billToBankName}
              ariaLabel="Bill to bank name"
              onChange={(billToBankName) => patchBanking('billToBankName', billToBankName)}
            />
          </p>
          <p className="tt-inv-li__panel-label">SWIFT:</p>
          <p className="tt-inv-li__panel-muted">
            <LiField
              editable={editable}
              value={editable ? legalBankingInputValue(legalOverrides?.billToSwift) : billToSwift}
              ariaLabel="Bill to SWIFT"
              onChange={(billToSwift) => patchBanking('billToSwift', billToSwift)}
            />
          </p>
        </div>
        <div className="tt-inv-li__panel tt-inv-li__panel--right">
          <h3 className="tt-inv-li__panel-h">Case details</h3>
          <p className="tt-inv-li__panel-text">
            <LiField
              editable={editable}
              value={caseLine}
              ariaLabel="Case details"
              multiline={editable}
              onChange={(caseDetailLine) => onChangeLegalOverrides?.({ caseDetailLine })}
            />
          </p>
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
            <td>
              <LiField
                editable={editable}
                value={svcLine}
                ariaLabel="Service description"
                multiline={editable}
                onChange={(serviceDescriptionLine) => onChangeLegalOverrides?.({ serviceDescriptionLine })}
              />
            </td>
            <td className="tt-inv-li__svc-amt">
              <LiField
                editable={editable}
                className="tt-inv-li__field--amt"
                value={model.totalFormatted}
                ariaLabel="Invoice total amount"
                onChange={(totalFormatted) => onChangeModel?.({ totalFormatted })}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="tt-inv-li__totals">
        <div className="tt-inv-li__total-line">
          <span className="tt-inv-li__total-label">SUBTOTAL:</span>{' '}
          <LiField
            editable={editable}
            className="tt-inv-li__field--inline"
            value={model.totalFormatted}
            ariaLabel="Subtotal"
            onChange={(totalFormatted) => onChangeModel?.({ totalFormatted })}
          />
        </div>
        <div className="tt-inv-li__total-line">{`VAT: ${zeroLine}`}</div>
        <div className="tt-inv-li__total-line">{`Extra expenses: ${zeroLine}`}</div>
        <div className="tt-inv-li__total-due">
          <span className="tt-inv-li__total-due-label">{`TOTAL DUE BY ${dueBanner}:`}</span>
          {' '}
          <span className="tt-inv-li__total-due-amt">
            <LiField
              editable={editable}
              className="tt-inv-li__field--inline tt-inv-li__field--due"
              value={model.totalFormatted}
              ariaLabel="Total due"
              onChange={(totalFormatted) => onChangeModel?.({ totalFormatted })}
            />
          </span>
        </div>
      </div>

      <p className="tt-inv-li__thanks">Thank you for your business!</p>

      <footer className="tt-inv-li__bottom" aria-label="Условия">
        <p className="tt-inv-li__disclaimer">
          <LiField
            editable={editable}
            value={paymentDisclaimer}
            ariaLabel="Payment disclaimer"
            multiline={editable}
            onChange={(paymentDisclaimer) => onChangeLegalOverrides?.({ paymentDisclaimer })}
          />
        </p>
      </footer>
    </div>);
}
