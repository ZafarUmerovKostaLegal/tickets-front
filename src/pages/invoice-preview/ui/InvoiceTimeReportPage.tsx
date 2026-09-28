import type { ChangeEvent } from 'react';
import { KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { coverLetterheadLogoUrl } from '../lib/invoiceCoverLogoRaster';
import type { InvoiceTimeReportDetailRow, InvoiceTimeReportPack, InvoiceTimeReportSummaryRow } from '../lib/invoiceTimeReportModel';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { getTimeReportLabels } from '../lib/invoiceTimeReportI18n';
import { joinServiceInitiatorName, splitServiceInitiatorName } from '../lib/splitServiceInitiatorName';
import './InvoiceTimeReportPage.css';

export type InvoiceTimeReportPageProps = {
    model: InvoiceCoverLetterModel;
    pack: InvoiceTimeReportPack;

    pageNumber: number;
    projectName?: string | null;

    detailRows?: readonly InvoiceTimeReportDetailRow[];
    continuation?: boolean;

    showDetailTotalRow?: boolean;

    showExpenseSection?: boolean;
    showMehnatSection?: boolean;

    showSummarySection?: boolean;
    /** Cut the name after "/", "*" or "=" out of Description and show it in its own column. */
    showInitiatorName?: boolean;
    editable?: boolean;
    onPatchDetailRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchExpenseRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchMehnatRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchSummaryRow?: (rowIndex: number, field: keyof InvoiceTimeReportSummaryRow, value: string) => void;
    onPatchPack?: (patch: Partial<Pick<InvoiceTimeReportPack, 'detailTotalHoursDisplay' | 'detailTotalAmountDisplay' | 'expenseTotalAmountDisplay' | 'mehnatTotalHoursDisplay' | 'mehnatTotalAmountDisplay' | 'summaryGrandHoursDisplay' | 'summaryGrandAmountDisplay'>>) => void;
};

function TrCell({
    value,
    editable,
    onChange,
    className,
    ariaLabel,
}: {
    value: string;
    editable?: boolean;
    onChange?: (next: string) => void;
    className?: string;
    ariaLabel?: string;
}) {
    if (!editable) {
        return <td className={className}>{value || '\u00a0'}</td>;
    }
    return (
        <td className={className}>
            <input
                type="text"
                className="tt-inv-tr__cell-input"
                value={value}
                aria-label={ariaLabel}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
            />
        </td>
    );
}

export function InvoiceTimeReportPage({
    model,
    pack,
    pageNumber,
    projectName,
    detailRows,
    continuation = false,
    showDetailTotalRow = true,
    showExpenseSection = true,
    showMehnatSection = true,
    showSummarySection = true,
    showInitiatorName = false,
    editable = false,
    onPatchDetailRow,
    onPatchExpenseRow,
    onPatchMehnatRow,
    onPatchSummaryRow,
    onPatchPack,
}: InvoiceTimeReportPageProps) {
    const labels = getTimeReportLabels(model.coverLanguage);
    const cur = packCurrencyCode(model);
    const amountHeader = labels.amount(cur);
    const sumGrandAmt = pack.summaryGrandAmountDisplay.trim().length ? pack.summaryGrandAmountDisplay : cur;
    const detail = detailRows ?? pack.detailSlots;
    const expenses = (pack.expenseSlots ?? []).filter((r) =>
        [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0),
    );
    const mehnat = (pack.mehnatSlots ?? []).filter((r) =>
        [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0),
    );
    const detailHasContent = detail.some((r) =>
        [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0),
    );
    const showMainTimeTable = detailHasContent || mehnat.length === 0;
    const title = continuation
        ? labels.titleContinued(model.servicesMonthYear)
        : labels.title(model.servicesMonthYear);
    const subProject = (projectName ?? '').trim();
    const nameByInitials = new Map(
        pack.summarySlots
            .filter((row) => row.initials.trim() && row.name.trim())
            .map((row) => [row.initials.trim(), row.name.trim()]),
    );
    const userLabel = (initials: string) => nameByInitials.get(initials.trim()) || initials;
    const leadSpan = showInitiatorName ? 4 : 3;

    return (<div className={`tt-inv-tr${editable ? ' tt-inv-tr--editable' : ''}`}>
      <header className="tt-inv-tr__letterhead">
        <img className="tt-inv-tr__logo" src={coverLetterheadLogoUrl()} alt="KOSTA LEGAL" />
        <address>
          <span>{KOSTA_LEGAL_FIRM.addressLine}</span>
          <span>{KOSTA_LEGAL_FIRM.phone}</span>
          <span>{KOSTA_LEGAL_FIRM.email}</span>
          <span>{KOSTA_LEGAL_FIRM.web}</span>
        </address>
      </header>
      <p className="tt-inv-tr__lead">{title}</p>
      {subProject && !continuation ? <h2 className="tt-inv-tr__sub">{labels.subProject(subProject)}</h2> : null}

      {showMainTimeTable ? (
      <div className="tt-inv-tr__table-wrap">
        <table className="tt-inv-tr__table" role="grid" aria-label="Детальный отчёт по времени">
          <thead className="tt-inv-tr__thead">
            <tr>
              <th scope="col" style={{ width: '14%' }}>{labels.date}</th>
              <th scope="col" style={{ width: '16%' }}>{labels.user}</th>
              <th scope="col">{labels.description}</th>
              {showInitiatorName ? <th scope="col" style={{ width: '14%' }}>{labels.initiatorName}</th> : null}
              <th scope="col" style={{ width: '10%' }}>{labels.hours}</th>
              <th scope="col" style={{ width: '16%' }}>{amountHeader}</th>
            </tr>
          </thead>
          <tbody className="tt-inv-tr__tbody">
            {detail.map((r, i) => {
                const empty = !([r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
                const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                const moneyClass = `${numClass} tt-inv-tr__cell--amount`;
                return (
                    <tr key={i}>
                      <TrCell editable={editable} className={cellClass} value={r.date} ariaLabel={`${labels.date}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'date', v)} />
                      <TrCell editable={editable} className={cellClass} value={editable ? r.initials : userLabel(r.initials)} ariaLabel={`${labels.user}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'initials', v)} />
                      <TrCell editable={editable} className={cellClass} value={showInitiatorName ? splitServiceInitiatorName(r.description).note : (r.description || r.task)} ariaLabel={`${labels.description}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'description', showInitiatorName ? joinServiceInitiatorName(v, splitServiceInitiatorName(r.description).name, splitServiceInitiatorName(r.description).mark) : v)} />
                      {showInitiatorName ? (
                        <TrCell editable={editable} className={cellClass} value={splitServiceInitiatorName(r.description).name} ariaLabel={`${labels.initiatorName}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'description', joinServiceInitiatorName(splitServiceInitiatorName(r.description).note, v, splitServiceInitiatorName(r.description).mark))} />
                      ) : null}
                      <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.hours}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'hours', v)} />
                      <TrCell editable={editable} className={moneyClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'amount', v)} />
                    </tr>
                );
            })}
          </tbody>
          {showDetailTotalRow ? (
              <tfoot className="tt-inv-tr__tfoot">
                <tr>
                  <td colSpan={leadSpan}>{labels.total}</td>
                  <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">
                    {editable
                      ? (
                          <input
                            type="text"
                            className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                            value={pack.detailTotalHoursDisplay}
                            aria-label={`${labels.total} ${labels.hours}`}
                            onChange={(e) => onPatchPack?.({ detailTotalHoursDisplay: e.target.value })}
                          />
                        )
                      : (pack.detailTotalHoursDisplay || '\u00a0')}
                  </td>
                  <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount">
                    {editable
                      ? (
                          <input
                            type="text"
                            className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                            value={pack.detailTotalAmountDisplay}
                            aria-label={`${labels.total} ${labels.amount(cur)}`}
                            onChange={(e) => onPatchPack?.({ detailTotalAmountDisplay: e.target.value })}
                          />
                        )
                      : (pack.detailTotalAmountDisplay || '\u00a0')}
                  </td>
                </tr>
              </tfoot>
            ) : null}
        </table>
      </div>
      ) : null}

      {showMehnatSection && mehnat.length > 0 ? (
          <>
            <h3 className="tt-inv-tr__subtitle">{labels.mehnatTitle}</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table" role="grid" aria-label={labels.mehnatTitle}>
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: '14%' }}>{labels.date}</th>
                    <th scope="col" style={{ width: '16%' }}>{labels.user}</th>
                    <th scope="col">{labels.description}</th>
                    {showInitiatorName ? <th scope="col" style={{ width: '14%' }}>{labels.initiatorName}</th> : null}
                    <th scope="col" style={{ width: '10%' }}>{labels.hours}</th>
                    <th scope="col" style={{ width: '16%' }}>{amountHeader}</th>
                  </tr>
                </thead>
                <tbody className="tt-inv-tr__tbody">
                  {mehnat.map((r, i) => {
                      const empty = !([r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
                      const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                      const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                      const moneyClass = `${numClass} tt-inv-tr__cell--amount`;
                      return (
                          <tr key={i}>
                            <TrCell editable={editable} className={cellClass} value={r.date} ariaLabel={`${labels.date}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'date', v)} />
                            <TrCell editable={editable} className={cellClass} value={editable ? r.initials : userLabel(r.initials)} ariaLabel={`${labels.user}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'initials', v)} />
                            <TrCell editable={editable} className={cellClass} value={showInitiatorName ? splitServiceInitiatorName(r.description).note : (r.description || r.task)} ariaLabel={`${labels.description}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'description', showInitiatorName ? joinServiceInitiatorName(v, splitServiceInitiatorName(r.description).name, splitServiceInitiatorName(r.description).mark) : v)} />
                            {showInitiatorName ? (
                              <TrCell editable={editable} className={cellClass} value={splitServiceInitiatorName(r.description).name} ariaLabel={`${labels.initiatorName}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'description', joinServiceInitiatorName(splitServiceInitiatorName(r.description).note, v, splitServiceInitiatorName(r.description).mark))} />
                            ) : null}
                            <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.hours}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'hours', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'amount', v)} />
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={leadSpan}>{labels.total}</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">
                      {editable
                        ? (
                            <input
                              type="text"
                              className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                              value={pack.mehnatTotalHoursDisplay}
                              aria-label={`${labels.mehnatTitle} ${labels.total} ${labels.hours}`}
                              onChange={(e) => onPatchPack?.({ mehnatTotalHoursDisplay: e.target.value })}
                            />
                          )
                        : (pack.mehnatTotalHoursDisplay || '\u00a0')}
                    </td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount">
                      {editable
                        ? (
                            <input
                              type="text"
                              className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                              value={pack.mehnatTotalAmountDisplay}
                              aria-label={`${labels.mehnatTitle} ${labels.total} ${labels.amount(cur)}`}
                              onChange={(e) => onPatchPack?.({ mehnatTotalAmountDisplay: e.target.value })}
                            />
                          )
                        : (pack.mehnatTotalAmountDisplay || '\u00a0')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : null}

      {showSummarySection ? (
          <>
            <h3 className="tt-inv-tr__subtitle">{labels.summaryTitle}</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table" role="grid" aria-label="Сводка по сервисам">
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: '8%' }}>{labels.initials}</th>
                    <th scope="col" style={{ width: '18%' }}>{labels.name}</th>
                    <th scope="col" style={{ width: '16%' }}>{labels.titleCol}</th>
                    <th scope="col" style={{ width: '14%' }}>{labels.rate}</th>
                    <th scope="col" style={{ width: '10%' }}>{labels.hours}</th>
                    <th scope="col" style={{ width: '16%' }}>{labels.hourlyRate}</th>
                    <th scope="col" style={{ width: '18%' }}>{labels.totalPrice(cur)}</th>
                  </tr>
                </thead>
                <tbody className="tt-inv-tr__tbody">
                  {pack.summarySlots.map((r, i) => {
                      const empty = !([r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice].some((c) => String(c).trim().length > 0));
                      const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                      const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                      const moneyClass = `${numClass} tt-inv-tr__cell--amount`;
                      return (
                          <tr key={i}>
                            <TrCell editable={editable} className={cellClass} value={r.initials} ariaLabel={`${labels.initials}, row ${i + 1}`}                             onChange={(v) => onPatchSummaryRow?.(i, 'initials', v)} />
                            <TrCell editable={editable} className={cellClass} value={r.name} ariaLabel={`${labels.name}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'name', v)} />
                            <TrCell editable={editable} className={cellClass} value={r.title} ariaLabel={`${labels.titleCol}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'title', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.hourlyRate} ariaLabel={`${labels.rate}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'hourlyRate', v)} />
                            <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.hours}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'hours', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.hourlyRate} ariaLabel={`${labels.hourlyRate}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'hourlyRate', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.totalPrice} ariaLabel={`${labels.totalPrice(cur)}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'totalPrice', v)} />
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={4}>{labels.total}</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">
                      {editable
                        ? (
                            <input
                              type="text"
                              className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                              value={pack.summaryGrandHoursDisplay}
                              aria-label={`${labels.summaryTitle} ${labels.total} ${labels.hours}`}
                              onChange={(e) => onPatchPack?.({ summaryGrandHoursDisplay: e.target.value })}
                            />
                          )
                        : (pack.summaryGrandHoursDisplay || '\u00a0')}
                    </td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num" />
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__currency-foot">
                      {editable
                        ? (
                            <input
                              type="text"
                              className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                              value={sumGrandAmt}
                              aria-label={`${labels.summaryTitle} ${labels.total}`}
                              onChange={(e) => onPatchPack?.({ summaryGrandAmountDisplay: e.target.value })}
                            />
                          )
                        : sumGrandAmt}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : null}

      {showExpenseSection ? (
          <>
            <h3 className="tt-inv-tr__subtitle">{labels.expensesTitle}</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table tt-inv-tr__table--expenses" role="grid" aria-label={labels.expensesTitle}>
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: '52%' }}>{labels.description}</th>
                    <th scope="col" style={{ width: '18%' }}>{labels.emailDate}</th>
                    <th scope="col" style={{ width: '30%' }}>{amountHeader}</th>
                  </tr>
                </thead>
                <tbody className="tt-inv-tr__tbody">
                  {expenses.map((r, i) => {
                      const empty = !([r.date, r.description, r.amount].some((c) => String(c).trim().length > 0));
                      const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                      const moneyClass = `tt-inv-tr__cell--num tt-inv-tr__cell--amount${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                      return (
                          <tr key={i}>
                            <TrCell editable={editable} className={cellClass} value={r.description} ariaLabel={`${labels.description}, ${labels.expensesTitle} ${i + 1}`} onChange={(v) => onPatchExpenseRow?.(i, 'description', v)} />
                            <TrCell editable={editable} className={cellClass} value={r.date} ariaLabel={`${labels.emailDate}, ${labels.expensesTitle} ${i + 1}`} onChange={(v) => onPatchExpenseRow?.(i, 'date', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, ${labels.expensesTitle} ${i + 1}`} onChange={(v) => onPatchExpenseRow?.(i, 'amount', v)} />
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={2}>Subtotal</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount">
                      {editable
                        ? (
                            <input
                              type="text"
                              className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                              value={pack.expenseTotalAmountDisplay}
                              aria-label={`${labels.expensesTitle} ${labels.total}`}
                              onChange={(e) => onPatchPack?.({ expenseTotalAmountDisplay: e.target.value })}
                            />
                          )
                        : (pack.expenseTotalAmountDisplay || '\u00a0')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="tt-inv-tr__cur">{cur}</p>
            <table className="tt-inv-tr__table" role="grid" aria-label={labels.sharedAmounts}>
              <thead className="tt-inv-tr__thead">
                <tr>
                  <th scope="col">{labels.sharedAmounts}</th>
                  <th scope="col" style={{ width: '28%' }}>{labels.reimbursable}</th>
                  <th scope="col" style={{ width: '28%' }}>{labels.toBeInvoiced}</th>
                </tr>
              </thead>
              <tbody className="tt-inv-tr__tbody">
                <tr>
                  <td className="tt-inv-tr__share">
                    <span>{subProject || model.quotedCompanyName}</span>
                    <span>100%</span>
                  </td>
                  <td className="tt-inv-tr__cell--num">{sumGrandAmt}</td>
                  <td className="tt-inv-tr__cell--num">{sumGrandAmt}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : null}

      <footer className="tt-inv-tr__bottom">
        <div className="tt-inv-tr__bottom-line" aria-hidden />
        <div className="tt-inv-tr__bottom-meta">
          <span className="tt-inv-tr__page-box">{pageNumber}</span>
        </div>
      </footer>
    </div>);
}
