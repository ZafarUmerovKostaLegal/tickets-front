import type { ChangeEvent } from 'react';
import { legalVertLogoPublicUrl } from '../lib/invoiceCoverLogoRaster';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { KOSTA_LEGAL_FIRM } from '../lib/invoiceCoverLetterModel';
import {
    packCurrencyCode,
    packInvoiceNumberDisplay,
    packResolveDueIso,
    packResolveIssueIso,
    packResolveBillingPeriodIso,
    packUppercaseRibbonDate,
    packUppercaseRibbonPeriodMonth,
    packZeroCommaAmount,
} from '../lib/invoicePreviewPackShared';
import { getLegalInvoiceLabels } from '../lib/invoiceLegalPageI18n';
import {
    formatLegalExchangeRateValue,
    formatLegalTotalWithFxAlt,
} from '../lib/invoiceLegalFxDisplay';
import {
    legalBankingInputValue,
    legalFirmBankingRows,
    isBankingPlaceholderValue,
    resolveLegalBillToBankName,
    resolveLegalBillToSwift,
    resolveLegalCaseDetailLine,
    resolveLegalOverrideText,
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
    placeholder,
    onChange,
}: {
    className?: string;
    value: string;
    editable?: boolean;
    multiline?: boolean;
    ariaLabel?: string;
    placeholder?: string;
    onChange?: (next: string) => void;
}) {
    if (!editable) {
        return <span className={className}>{value}</span>;
    }
    const shared = {
        className: `tt-inv-li__field${className ? ` ${className}` : ''}`,
        value,
        placeholder,
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
                placeholder="—"
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
    const labels = getLegalInvoiceLabels(model.coverLanguage);
    const issueIso = packResolveIssueIso(session);
    const dueIso = packResolveDueIso(session, issueIso);
    const periodIso = packResolveBillingPeriodIso(session, model);
    const defaultRibbonIssue = packUppercaseRibbonPeriodMonth(periodIso, model.coverLanguage);
    const defaultDueBanner = packUppercaseRibbonDate(dueIso, model.coverLanguage);
    const defaultInvNo = packInvoiceNumberDisplay(session);
    const defaultZero = packZeroCommaAmount(model);

    const ribbonIssue = resolveLegalOverrideText(legalOverrides?.issueDateDisplay, defaultRibbonIssue);
    const dueBanner = resolveLegalOverrideText(legalOverrides?.dueDateDisplay, defaultDueBanner);
    const invNo = resolveLegalOverrideText(legalOverrides?.invoiceNumber, defaultInvNo);
    const vatAmount = resolveLegalOverrideText(legalOverrides?.vatAmount, defaultZero);
    const extraExpensesAmount = resolveLegalOverrideText(legalOverrides?.extraExpensesAmount, defaultZero);
    const firmAddress = resolveLegalOverrideText(legalOverrides?.firmAddress, KOSTA_LEGAL_FIRM.addressLine);

    const caseLine = resolveLegalCaseDetailLine(session, legalOverrides, model.coverLanguage);
    const cur = packCurrencyCode(model);
    const svcLine = resolveLegalServiceDescriptionLine(model, legalOverrides);
    const paymentDisclaimer = resolveLegalPaymentDisclaimer(legalOverrides, model.coverLanguage);
    const totalWithFx = formatLegalTotalWithFxAlt(model.totalFormatted, legalOverrides);
    const exchangeRateValue = formatLegalExchangeRateValue(legalOverrides, model.coverLanguage);
    const addr2 = model.recipientAddressLines[1];
    const firmBankingRows = legalFirmBankingRows(cur, legalOverrides, model.coverLanguage);
    const billToBankName = resolveLegalBillToBankName(legalOverrides);
    const billToSwift = resolveLegalBillToSwift(legalOverrides);

    const patchBanking = (field: InvoiceLegalBankingFieldKey, next: string) => {
        onChangeLegalOverrides?.({ [field]: next });
    };

    return (<div className={`tt-inv-li${editable ? ' tt-inv-li--editable' : ''}`}>
      <header className="tt-inv-li__masthead">
        <div className="tt-inv-li__firm-blurb">
          <p className="tt-inv-li__firm-name">{KOSTA_LEGAL_FIRM.brandName} LF</p>
          <p className="tt-inv-li__firm-line">
            <LiField
              editable={editable}
              className="tt-inv-li__field--firm-addr"
              value={editable ? (legalOverrides?.firmAddress ?? firmAddress) : firmAddress}
              ariaLabel={labels.address}
              onChange={(next) => onChangeLegalOverrides?.({ firmAddress: next })}
            />
          </p>
          {firmBankingRows
            .filter((row) => editable || !isBankingPlaceholderValue(row.value))
            .map((row) => (
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
          <img className="tt-inv-li__logo" src={legalVertLogoPublicUrl()} alt="" decoding="async"/>
        </div>
      </header>

      <div className="tt-inv-li__ribbon">
        <span className="tt-inv-li__ribbon-no">
          {editable ? (
            <>
              <span className="tt-inv-li__ribbon-prefix">{labels.invoiceNoPrefix}</span>
              {' '}
              <LiField
                editable
                className="tt-inv-li__field--ribbon"
                value={legalOverrides?.invoiceNumber ?? invNo}
                ariaLabel={labels.invoiceNoPrefix}
                onChange={(invoiceNumber) => onChangeLegalOverrides?.({ invoiceNumber })}
              />
            </>
          ) : labels.invoiceNo(invNo)}
        </span>
        <span className="tt-inv-li__ribbon-date">
          <LiField
            editable={editable}
            className="tt-inv-li__field--ribbon tt-inv-li__field--ribbon-date"
            value={editable ? (legalOverrides?.issueDateDisplay ?? ribbonIssue) : ribbonIssue}
            ariaLabel="Дата счёта"
            onChange={(issueDateDisplay) => onChangeLegalOverrides?.({ issueDateDisplay })}
          />
        </span>
      </div>

      <div className="tt-inv-li__panels">
        <h3 className="tt-inv-li__panel-h tt-inv-li__panel-h--bill">{labels.billTo}</h3>
        <h3 className="tt-inv-li__panel-h tt-inv-li__panel-h--case">{labels.caseDetails}</h3>
        <div className="tt-inv-li__panel-heads-rule" aria-hidden/>
        <div className="tt-inv-li__panel tt-inv-li__panel--bill">
          <p className="tt-inv-li__panel-strong">
            <LiField
              editable={editable}
              value={model.recipientCompany}
              ariaLabel={labels.billTo}
              onChange={(recipientCompany) => onChangeModel?.({ recipientCompany, quotedCompanyName: recipientCompany })}
            />
          </p>
          <p className="tt-inv-li__panel-label">{labels.address}:</p>
          <p className="tt-inv-li__panel-muted">
            <LiField
              editable={editable}
              value={model.recipientAddressLines[0]}
              ariaLabel={`${labels.billTo} ${labels.address} 1`}
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
                ariaLabel={`${labels.billTo} ${labels.address} 2`}
                multiline={editable}
                onChange={(line1) => onChangeModel?.({
                  recipientAddressLines: [model.recipientAddressLines[0], line1],
                })}
              />
            </p>
          ) : null}
          <p className="tt-inv-li__panel-label">{labels.bankName}:</p>
          <p className="tt-inv-li__panel-muted">
            <LiField
              editable={editable}
              value={editable ? legalBankingInputValue(legalOverrides?.billToBankName) : billToBankName}
              placeholder="—"
              ariaLabel={`${labels.billTo} ${labels.bankName}`}
              onChange={(billToBankName) => patchBanking('billToBankName', billToBankName)}
            />
          </p>
          <p className="tt-inv-li__panel-label">{labels.swift}:</p>
          <p className="tt-inv-li__panel-muted">
            <LiField
              editable={editable}
              value={editable ? legalBankingInputValue(legalOverrides?.billToSwift) : billToSwift}
              placeholder="—"
              ariaLabel={`${labels.billTo} ${labels.swift}`}
              onChange={(billToSwift) => patchBanking('billToSwift', billToSwift)}
            />
          </p>
        </div>
        <div className="tt-inv-li__panel tt-inv-li__panel--right">
          <p className="tt-inv-li__panel-text">
            <LiField
              editable={editable}
              value={caseLine}
              ariaLabel={labels.caseDetails}
              multiline={editable}
              onChange={(caseDetailLine) => onChangeLegalOverrides?.({ caseDetailLine })}
            />
          </p>
        </div>
      </div>

      <table className="tt-inv-li__svc-table" role="presentation">
        <thead>
          <tr>
            <th scope="col">{labels.description}</th>
            <th scope="col" className="tt-inv-li__th-total">{labels.total(cur)}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="tt-inv-li__svc-row-main">
            <td>
              <LiField
                editable={editable}
                value={svcLine}
                ariaLabel={labels.description}
                multiline={editable}
                onChange={(serviceDescriptionLine) => onChangeLegalOverrides?.({ serviceDescriptionLine })}
              />
            </td>
            <td className="tt-inv-li__svc-amt">
              <LiField
                editable={editable}
                className="tt-inv-li__field--amt"
                value={editable ? model.totalFormatted : totalWithFx}
                ariaLabel={labels.total(cur)}
                onChange={(totalFormatted) => onChangeModel?.({ totalFormatted })}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="tt-inv-li__totals">
        <div className="tt-inv-li__total-line">
          <span className="tt-inv-li__total-label">{labels.subtotal}</span>
          <span className="tt-inv-li__total-value">
            <LiField
              editable={editable}
              className="tt-inv-li__field--inline"
              value={editable ? model.totalFormatted : totalWithFx}
              ariaLabel={labels.subtotal}
              onChange={(totalFormatted) => onChangeModel?.({ totalFormatted })}
            />
          </span>
        </div>
        <div className="tt-inv-li__total-line">
          <span className="tt-inv-li__total-label">{labels.vat}</span>
          <span className="tt-inv-li__total-value">
            <LiField
              editable={editable}
              className="tt-inv-li__field--inline"
              value={editable ? (legalOverrides?.vatAmount ?? vatAmount) : vatAmount}
              ariaLabel={labels.vat}
              onChange={(vatAmount) => onChangeLegalOverrides?.({ vatAmount })}
            />
          </span>
        </div>
        <div className="tt-inv-li__total-line">
          <span className="tt-inv-li__total-label">{labels.extraExpenses}</span>
          <span className="tt-inv-li__total-value">
            <LiField
              editable={editable}
              className="tt-inv-li__field--inline"
              value={editable ? (legalOverrides?.extraExpensesAmount ?? extraExpensesAmount) : extraExpensesAmount}
              ariaLabel={labels.extraExpenses}
              onChange={(extraExpensesAmount) => onChangeLegalOverrides?.({ extraExpensesAmount })}
            />
          </span>
        </div>
        {exchangeRateValue ? (
          <div className="tt-inv-li__total-line tt-inv-li__total-line--fx">
            <span className="tt-inv-li__total-label">{labels.exchangeRate}</span>
            <span className="tt-inv-li__total-value tt-inv-li__total-fx">
              {exchangeRateValue}
            </span>
          </div>
        ) : null}
        <div className="tt-inv-li__total-line tt-inv-li__total-line--due">
          <span className="tt-inv-li__total-due-label">
            {labels.totalDueByPrefix}
            {' '}
            <LiField
              editable={editable}
              className="tt-inv-li__field--inline tt-inv-li__field--due-date"
              value={editable ? (legalOverrides?.dueDateDisplay ?? dueBanner) : dueBanner}
              ariaLabel={labels.totalDueByPrefix}
              onChange={(dueDateDisplay) => onChangeLegalOverrides?.({ dueDateDisplay })}
            />
          </span>
          <span className="tt-inv-li__total-due-amt">
            <LiField
              editable={editable}
              className="tt-inv-li__field--inline tt-inv-li__field--due"
              value={editable ? model.totalFormatted : totalWithFx}
              ariaLabel={labels.totalDueBy(dueBanner)}
              onChange={(totalFormatted) => onChangeModel?.({ totalFormatted })}
            />
          </span>
        </div>
      </div>

      <div className="tt-inv-li__closing">
        <p className="tt-inv-li__thanks">{labels.thanks}</p>
        <p className="tt-inv-li__disclaimer">
          <LiField
            editable={editable}
            value={paymentDisclaimer}
            ariaLabel="Payment disclaimer"
            multiline={editable}
            onChange={(paymentDisclaimer) => onChangeLegalOverrides?.({ paymentDisclaimer })}
          />
        </p>
      </div>
    </div>);
}
