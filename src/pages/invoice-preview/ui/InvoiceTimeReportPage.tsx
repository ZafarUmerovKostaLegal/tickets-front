import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { TIME_REPORT_DETAIL_ROWS, TIME_REPORT_SUMMARY_ROWS } from '../lib/invoicePreviewPackShared';
import './InvoiceTimeReportPage.css';

export type InvoiceTimeReportPageProps = {
    model: InvoiceCoverLetterModel;
    /** Номер листа в пакете (в превью — 2) */
    pageNumber: number;
};

function currencyCodeFromTotal(totalFormatted: string): string {
    const raw = totalFormatted.trim().split(/\s+/)[0];
    const tok = raw?.replace(/[^A-Za-z]/g, '').toUpperCase();
    return tok && tok.length ? tok : 'EUR';
}

export function InvoiceTimeReportPage({ model, pageNumber }: InvoiceTimeReportPageProps) {
    const monthYearUpper = model.servicesMonthYear.toUpperCase();
    const cur = currencyCodeFromTotal(model.totalFormatted);
    const amountHeader = cur === 'EUR' ? 'Amount (EUR)' : `Amount (${cur})`;

    return (<div className="tt-inv-tr">
      <div className="tt-inv-tr__top">
        <span className="tt-inv-tr__confidential">Private and confidential</span>
      </div>
      <div className="tt-inv-tr__rule" aria-hidden />
      <h2 className="tt-inv-tr__title">{`TIME REPORT FOR SERVICES PROVIDED IN ${monthYearUpper}`}</h2>

      <div className="tt-inv-tr__table-wrap">
        <table className="tt-inv-tr__table" role="grid" aria-label="Детальный отчёт по времени">
          <thead className="tt-inv-tr__thead">
            <tr>
              <th scope="col" style={{ width: '11%' }}>Date</th>
              <th scope="col" style={{ width: '9%' }}>Initials</th>
              <th scope="col" style={{ width: '14%' }}>Task</th>
              <th scope="col" style={{ width: '36%' }}>Description</th>
              <th scope="col" style={{ width: '10%' }}>Hours</th>
              <th scope="col" style={{ width: '12%' }}>{amountHeader}</th>
            </tr>
          </thead>
          <tbody className="tt-inv-tr__tbody">
            {Array.from({ length: TIME_REPORT_DETAIL_ROWS }, (_, i) => (
              <tr key={i}>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="tt-inv-tr__tfoot">
            <tr>
              <td colSpan={4}>Total</td>
              <td aria-hidden style={{ border: 'none' }}/>
              <td aria-hidden style={{ border: 'none' }}/>
            </tr>
          </tfoot>
        </table>
      </div>

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
            {Array.from({ length: TIME_REPORT_SUMMARY_ROWS }, (_, i) => (
              <tr key={i}>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
                <td className="tt-inv-tr__cell--empty">&nbsp;</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="tt-inv-tr__tfoot">
            <tr>
              <td colSpan={3}>Total</td>
              <td aria-hidden style={{ border: 'none' }}/>
              <td aria-hidden style={{ border: 'none' }}/>
              <td className="tt-inv-tr__currency-foot">{cur}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <footer className="tt-inv-tr__bottom">
        <div className="tt-inv-tr__bottom-line" aria-hidden />
        <div className="tt-inv-tr__bottom-meta">
          <span className="tt-inv-tr__page-box">{pageNumber}</span>
        </div>
      </footer>
    </div>);
}
