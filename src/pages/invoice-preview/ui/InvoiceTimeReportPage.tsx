import type { ChangeEvent } from 'react';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import type { InvoiceTimeReportDetailRow, InvoiceTimeReportPack, InvoiceTimeReportSummaryRow } from '../lib/invoiceTimeReportModel';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { getTimeReportLabels } from '../lib/invoiceTimeReportI18n';
import './InvoiceTimeReportPage.css';

export type InvoiceTimeReportPageProps = {
    model: InvoiceCoverLetterModel;
    pack: InvoiceTimeReportPack;

    pageNumber: number;

    detailRows?: readonly InvoiceTimeReportDetailRow[];
    continuation?: boolean;

    showDetailTotalRow?: boolean;

    showSummarySection?: boolean;
    editable?: boolean;
    onPatchDetailRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchSummaryRow?: (rowIndex: number, field: keyof InvoiceTimeReportSummaryRow, value: string) => void;
    onPatchPack?: (patch: Partial<Pick<InvoiceTimeReportPack, 'detailTotalHoursDisplay' | 'detailTotalAmountDisplay' | 'summaryGrandHoursDisplay' | 'summaryGrandAmountDisplay'>>) => void;
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
    detailRows,
    continuation = false,
    showDetailTotalRow = true,
    showSummarySection = true,
    editable = false,
    onPatchDetailRow,
    onPatchSummaryRow,
    onPatchPack,
}: InvoiceTimeReportPageProps) {
    const labels = getTimeReportLabels(model.coverLanguage);
    const cur = packCurrencyCode(model);
    const amountHeader = labels.amount(cur);
    const sumGrandAmt = pack.summaryGrandAmountDisplay.trim().length ? pack.summaryGrandAmountDisplay : cur;
    const detail = detailRows ?? pack.detailSlots;
    const title = continuation
        ? labels.titleContinued(model.servicesMonthYear)
        : labels.title(model.servicesMonthYear);

    return (<div className={`tt-inv-tr${editable ? ' tt-inv-tr--editable' : ''}`}>
      <div className="tt-inv-tr__top">
        <span className="tt-inv-tr__confidential">{labels.confidential}</span>
      </div>
      <div className="tt-inv-tr__rule" aria-hidden />
      <h2 className="tt-inv-tr__title">{title}</h2>

      <div className="tt-inv-tr__table-wrap">
        <table className="tt-inv-tr__table" role="grid" aria-label="Детальный отчёт по времени">
          <thead className="tt-inv-tr__thead">
            <tr>
              <th scope="col" style={{ width: '10%' }}>{labels.date}</th>
              <th scope="col" style={{ width: '8%' }}>{labels.initials}</th>
              <th scope="col" style={{ width: '12%' }}>{labels.task}</th>
              <th scope="col" style={{ width: '30%' }}>{labels.description}</th>
              <th scope="col" style={{ width: '8%' }}>{labels.hours}</th>
              <th scope="col" style={{ width: '14%' }}>{labels.rate}</th>
              <th scope="col" style={{ width: '18%' }}>{amountHeader}</th>
            </tr>
          </thead>
          <tbody className="tt-inv-tr__tbody">
            {detail.map((r, i) => {
                const empty = !([r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
                const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                const amtClass = `${numClass} tt-inv-tr__cell--amount`;
                return (
                    <tr key={i}>
                      <TrCell editable={editable} className={cellClass} value={r.date} ariaLabel={`${labels.date}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'date', v)} />
                      <TrCell editable={editable} className={cellClass} value={r.initials} ariaLabel={`${labels.initials}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'initials', v)} />
                      <TrCell editable={editable} className={cellClass} value={r.task} ariaLabel={`${labels.task}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'task', v)} />
                      <TrCell editable={editable} className={cellClass} value={r.description} ariaLabel={`${labels.description}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'description', v)} />
                      <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.hours}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'hours', v)} />
                      <TrCell editable={editable} className={numClass} value={r.hourlyRate} ariaLabel={`${labels.rate}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'hourlyRate', v)} />
                      <TrCell editable={editable} className={amtClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'amount', v)} />
                    </tr>
                );
            })}
          </tbody>
          {showDetailTotalRow ? (
              <tfoot className="tt-inv-tr__tfoot">
                <tr>
                  <td colSpan={4}>{labels.total}</td>
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
                  <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">—</td>
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

      {showSummarySection ? (
          <>
            <h3 className="tt-inv-tr__subtitle">{labels.summaryTitle}</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table" role="grid" aria-label="Сводка по сервисам">
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: '9%' }}>{labels.initials}</th>
                    <th scope="col" style={{ width: '26%' }}>{labels.name}</th>
                    <th scope="col" style={{ width: '26%' }}>{labels.titleCol}</th>
                    <th scope="col" style={{ width: '13%' }}>{labels.hours}</th>
                    <th scope="col" style={{ width: '13%' }}>{labels.hourlyRate}</th>
                    <th scope="col" style={{ width: '13%' }}>{labels.totalPrice(cur)}</th>
                  </tr>
                </thead>
                <tbody className="tt-inv-tr__tbody">
                  {pack.summarySlots.map((r, i) => {
                      const empty = !([r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice].some((c) => String(c).trim().length > 0));
                      const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                      const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                      const amtClass = `${numClass} tt-inv-tr__cell--amount`;
                      return (
                          <tr key={i}>
                            <TrCell editable={editable} className={cellClass} value={r.initials} ariaLabel={`${labels.initials}, row ${i + 1}`}                             onChange={(v) => onPatchSummaryRow?.(i, 'initials', v)} />
                            <TrCell editable={editable} className={cellClass} value={r.name} ariaLabel={`${labels.name}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'name', v)} />
                            <TrCell editable={editable} className={cellClass} value={r.title} ariaLabel={`${labels.titleCol}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'title', v)} />
                            <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.hours}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'hours', v)} />
                            <TrCell editable={editable} className={numClass} value={r.hourlyRate} ariaLabel={`${labels.hourlyRate}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'hourlyRate', v)} />
                            <TrCell editable={editable} className={amtClass} value={r.totalPrice} ariaLabel={`${labels.totalPrice(cur)}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'totalPrice', v)} />
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={3}>{labels.total}</td>
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
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">—</td>
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

      <footer className="tt-inv-tr__bottom">
        <div className="tt-inv-tr__bottom-line" aria-hidden />
        <div className="tt-inv-tr__bottom-meta">
          <span className="tt-inv-tr__page-box">{pageNumber}</span>
        </div>
      </footer>
    </div>);
}
