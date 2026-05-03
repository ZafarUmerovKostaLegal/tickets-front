import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import type { InvoiceTimeReportDetailRow, InvoiceTimeReportPack } from '../lib/invoiceTimeReportModel';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import './InvoiceTimeReportPage.css';

export type InvoiceTimeReportPageProps = {
    model: InvoiceCoverLetterModel;
    pack: InvoiceTimeReportPack;
    /** Номер листа в пакете */
    pageNumber: number;
    /** Чанк детальных строк (если не задан — весь pack.detailSlots) */
    detailRows?: readonly InvoiceTimeReportDetailRow[];
    continuation?: boolean;
    /** Показывать строку Total по детализации (только на последнем чанке) */
    showDetailTotalRow?: boolean;
    /** Показывать блок Summary (только на последнем чанке) */
    showSummarySection?: boolean;
};

export function InvoiceTimeReportPage({
    model,
    pack,
    pageNumber,
    detailRows,
    continuation = false,
    showDetailTotalRow = true,
    showSummarySection = true,
}: InvoiceTimeReportPageProps) {
    const monthYearUpper = model.servicesMonthYear.toUpperCase();
    const cur = packCurrencyCode(model);
    const amountHeader = cur === 'EUR' ? 'Amount (EUR)' : `Amount (${cur})`;
    const sumGrandAmt = pack.summaryGrandAmountDisplay.trim().length ? pack.summaryGrandAmountDisplay : cur;
    const detail = detailRows ?? pack.detailSlots;
    const title = continuation
        ? `TIME REPORT FOR SERVICES PROVIDED IN ${monthYearUpper} — CONTINUED`
        : `TIME REPORT FOR SERVICES PROVIDED IN ${monthYearUpper}`;

    return (<div className="tt-inv-tr">
      <div className="tt-inv-tr__top">
        <span className="tt-inv-tr__confidential">Private and confidential</span>
      </div>
      <div className="tt-inv-tr__rule" aria-hidden />
      <h2 className="tt-inv-tr__title">{title}</h2>

      <div className="tt-inv-tr__table-wrap">
        <table className="tt-inv-tr__table" role="grid" aria-label="Детальный отчёт по времени">
          <thead className="tt-inv-tr__thead">
            <tr>
              <th scope="col" style={{ width: '11%' }}>Date</th>
              <th scope="col" style={{ width: '8%' }}>Initials</th>
              <th scope="col" style={{ width: '11%' }}>Task</th>
              <th scope="col" style={{ width: '28%' }}>Description</th>
              <th scope="col" style={{ width: '11%' }}>Hours</th>
              <th scope="col" style={{ width: '16%' }}>{amountHeader}</th>
            </tr>
          </thead>
          <tbody className="tt-inv-tr__tbody">
            {detail.map((r, i) => {
                const empty = !([r.date, r.initials, r.task, r.description, r.hours, r.amount].some((c) => String(c).trim().length > 0));
                return (
                    <tr key={i}>
                      <td className={empty ? 'tt-inv-tr__cell--empty' : undefined}>{r.date || '\u00a0'}</td>
                      <td className={empty ? 'tt-inv-tr__cell--empty' : undefined}>{r.initials || '\u00a0'}</td>
                      <td className={empty ? 'tt-inv-tr__cell--empty' : undefined}>{r.task || '\u00a0'}</td>
                      <td className={empty ? 'tt-inv-tr__cell--empty' : undefined}>{r.description || '\u00a0'}</td>
                      <td className={`tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`}>{r.hours || '\u00a0'}</td>
                      <td className={`tt-inv-tr__cell--num tt-inv-tr__cell--amount${empty ? ' tt-inv-tr__cell--empty' : ''}`}>{r.amount || '\u00a0'}</td>
                    </tr>
                );
            })}
          </tbody>
          {showDetailTotalRow ? (
              <tfoot className="tt-inv-tr__tfoot">
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">{pack.detailTotalHoursDisplay || '\u00a0'}</td>
                  <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount">{pack.detailTotalAmountDisplay || '\u00a0'}</td>
                </tr>
              </tfoot>
            ) : null}
        </table>
      </div>

      {showSummarySection ? (
          <>
            <h3 className="tt-inv-tr__subtitle">Summary of services</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table" role="grid" aria-label="Сводка по сервисам">
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: '9%' }}>Initials</th>
                    <th scope="col" style={{ width: '26%' }}>Name</th>
                    <th scope="col" style={{ width: '26%' }}>Title</th>
                    <th scope="col" style={{ width: '13%' }}>Hours</th>
                    <th scope="col" style={{ width: '13%' }}>Hourly rate</th>
                    <th scope="col" style={{ width: '13%' }}>{`Total price (${cur})`}</th>
                  </tr>
                </thead>
                <tbody className="tt-inv-tr__tbody">
                  {pack.summarySlots.map((r, i) => {
                      const empty = !([r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice].some((c) => String(c).trim().length > 0));
                      return (
                          <tr key={i}>
                            <td className={empty ? 'tt-inv-tr__cell--empty' : undefined}>{r.initials || '\u00a0'}</td>
                            <td className={empty ? 'tt-inv-tr__cell--empty' : undefined}>{r.name || '\u00a0'}</td>
                            <td className={empty ? 'tt-inv-tr__cell--empty' : undefined}>{r.title || '\u00a0'}</td>
                            <td className={`tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`}>{r.hours || '\u00a0'}</td>
                            <td className={`tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`}>{r.hourlyRate || '\u00a0'}</td>
                            <td className={`tt-inv-tr__cell--num tt-inv-tr__cell--amount${empty ? ' tt-inv-tr__cell--empty' : ''}`}>{r.totalPrice || '\u00a0'}</td>
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">{pack.summaryGrandHoursDisplay || '\u00a0'}</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">—</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__currency-foot">{sumGrandAmt}</td>
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
