import { useLayoutEffect, useRef, type ChangeEvent } from 'react';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { fixedFeeScopeText, type InvoiceTimeReportDetailRow, type InvoiceTimeReportPack, type InvoiceTimeReportSummaryRow } from '../lib/invoiceTimeReportModel';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { getTimeReportLabels, localizeTimeReportTaskLabel, timeReportHeading, timeReportServicesMonthYear } from '../lib/invoiceTimeReportI18n';
import { joinServiceInitiatorName, splitServiceInitiatorName } from '../lib/splitServiceInitiatorName';
import './InvoiceTimeReportPage.css';

export type InvoiceTimeReportPageProps = {
    model: InvoiceCoverLetterModel;
    pack: InvoiceTimeReportPack;

    pageNumber: number;

    detailRows?: readonly InvoiceTimeReportDetailRow[];
    continuation?: boolean;

    showDetailTotalRow?: boolean;

    showExpenseSection?: boolean;
    showMehnatSection?: boolean;

    showSummarySection?: boolean;
    /** Summary of services on its own sheet, without the hours table. */
    summaryOnly?: boolean;
    /** Cut the name after "/", "*" or "=" out of Description and show it in its own column. */
    showInitiatorName?: boolean;
    editable?: boolean;
    onPatchDetailRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchExpenseRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchMehnatRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchFixedFeeRow?: (rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => void;
    onPatchSummaryRow?: (rowIndex: number, field: keyof InvoiceTimeReportSummaryRow, value: string) => void;
    onPatchPack?: (patch: Partial<Pick<InvoiceTimeReportPack, 'detailTotalHoursDisplay' | 'detailTotalAmountDisplay' | 'expenseTotalAmountDisplay' | 'mehnatTotalHoursDisplay' | 'mehnatTotalAmountDisplay' | 'fixedFeeTotalAmountDisplay' | 'summaryGrandHoursDisplay' | 'summaryGrandAmountDisplay' | 'reportTitle' | 'reportTitleContinued'>>) => void;
};

function fitBreakableTextarea(el: HTMLTextAreaElement) {
    el.style.height = '0px';
    const line = Number.parseFloat(getComputedStyle(el).lineHeight);
    const linePx = Number.isFinite(line) ? line : 16;
    let height = el.scrollHeight;
    if (el.value.endsWith('\n'))
        height += linePx;
    el.style.height = `${Math.max(height, linePx)}px`;
}

function insertLineBreak(
    value: string,
    start: number,
    end: number,
): { next: string; caret: number } {
    return {
        next: `${value.slice(0, start)}\n${value.slice(end)}`,
        caret: start + 1,
    };
}

function TimeReportTitleInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (next: string) => void;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const caretRef = useRef<number | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        fitBreakableTextarea(el);
        if (caretRef.current == null)
            return;
        const pos = Math.min(caretRef.current, el.value.length);
        caretRef.current = null;
        el.selectionStart = pos;
        el.selectionEnd = pos;
    }, [value]);
    return (
        <textarea
            ref={ref}
            rows={1}
            className="tt-inv-tr__title tt-inv-tr__title-input"
            value={value}
            aria-label="Time report title"
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key !== 'Enter')
                    return;
                e.preventDefault();
                if (!e.ctrlKey && !e.metaKey)
                    return;
                const el = e.currentTarget;
                const start = el.selectionStart ?? value.length;
                const end = el.selectionEnd ?? start;
                const broken = insertLineBreak(value, start, end);
                caretRef.current = broken.caret;
                onChange(broken.next);
            }}
        />
    );
}

function TrMultilineInput({
    value,
    ariaLabel,
    onChange,
}: {
    value: string;
    ariaLabel?: string;
    onChange?: (next: string) => void;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const caretRef = useRef<number | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        fitBreakableTextarea(el);
        if (caretRef.current == null)
            return;
        const pos = Math.min(caretRef.current, el.value.length);
        caretRef.current = null;
        el.selectionStart = pos;
        el.selectionEnd = pos;
    }, [value]);
    return (
        <textarea
            ref={ref}
            rows={1}
            className="tt-inv-tr__cell-input tt-inv-tr__cell-input--multiline"
            value={value}
            aria-label={ariaLabel}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)}
            onKeyDown={(e) => {
                if (e.key !== 'Enter')
                    return;
                e.preventDefault();
                if (!e.ctrlKey && !e.metaKey)
                    return;
                const el = e.currentTarget;
                const start = el.selectionStart ?? value.length;
                const end = el.selectionEnd ?? start;
                const broken = insertLineBreak(value, start, end);
                caretRef.current = broken.caret;
                onChange?.(broken.next);
            }}
        />
    );
}

function TrCell({
    value,
    editable,
    multiline,
    onChange,
    className,
    ariaLabel,
}: {
    value: string;
    editable?: boolean;
    multiline?: boolean;
    onChange?: (next: string) => void;
    className?: string;
    ariaLabel?: string;
}) {
    const cellClass = multiline ? [className, 'tt-inv-tr__cell--wrap'].filter(Boolean).join(' ') : className;
    if (!editable) {
        return <td className={cellClass}>{value || '\u00a0'}</td>;
    }
    return (
        <td className={cellClass}>
            {multiline ? (
                <TrMultilineInput value={value} ariaLabel={ariaLabel} onChange={onChange} />
            ) : (
                <input
                    type="text"
                    className="tt-inv-tr__cell-input"
                    value={value}
                    aria-label={ariaLabel}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
                />
            )}
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
    showExpenseSection = true,
    showMehnatSection = true,
    showSummarySection = true,
    summaryOnly = false,
    showInitiatorName = false,
    editable = false,
    onPatchDetailRow,
    onPatchExpenseRow,
    onPatchMehnatRow,
    onPatchFixedFeeRow,
    onPatchSummaryRow,
    onPatchPack,
}: InvoiceTimeReportPageProps) {
    const labels = getTimeReportLabels(model.coverLanguage);
    const taskText = (task: string) => localizeTimeReportTaskLabel(task, model.coverLanguage);
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
    const fixedFee = (pack.fixedFeeSlots ?? []).filter((r) =>
        [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0),
    );
    const detailHasContent = detail.some((r) =>
        [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0),
    );
    const showMainTimeTable = !summaryOnly && (detailHasContent || mehnat.length === 0);
    const title = timeReportHeading({
        language: model.coverLanguage,
        servicesMonthYear: timeReportServicesMonthYear(pack, model.servicesMonthYear, model.coverLanguage),
        continuation,
        reportTitle: pack.reportTitle,
        reportTitleContinued: pack.reportTitleContinued,
    });

    return (<div className={`tt-inv-tr${editable ? ' tt-inv-tr--editable' : ''}`}>
      <div className="tt-inv-tr__top">
        <span className="tt-inv-tr__confidential">{labels.confidential}</span>
      </div>
      <div className="tt-inv-tr__rule" aria-hidden />
      {editable ? (
          <TimeReportTitleInput
              value={title}
              onChange={(next) => onPatchPack?.(continuation
                  ? { reportTitleContinued: next }
                  : { reportTitle: next })}
          />
      ) : <h2 className="tt-inv-tr__title">{title}</h2>}

      {showMainTimeTable ? (
      <div className="tt-inv-tr__table-wrap">
        <table className="tt-inv-tr__table" role="grid" aria-label="Детальный отчёт по времени">
          <thead className="tt-inv-tr__thead">
            <tr>
              <th scope="col" style={{ width: showInitiatorName ? '10%' : '12%' }}>{labels.date}</th>
              <th scope="col" className="tt-inv-tr__th--initials" style={{ width: showInitiatorName ? '14%' : '16%' }}>{labels.initials}</th>
              <th scope="col" style={{ width: showInitiatorName ? '10%' : '12%' }}>{labels.task}</th>
              <th scope="col" style={{ width: showInitiatorName ? '11%' : '14%' }}>{labels.description}</th>
              {showInitiatorName ? <th scope="col" style={{ width: '11%' }}>{labels.initiatorName}</th> : null}
              <th scope="col" className="tt-inv-tr__th--num" style={{ width: showInitiatorName ? '10%' : '10%' }}>{labels.hours}</th>
              <th scope="col" className="tt-inv-tr__th--num" style={{ width: showInitiatorName ? '17%' : '18%' }}>{labels.rate}</th>
              <th scope="col" className="tt-inv-tr__th--num" style={{ width: showInitiatorName ? '17%' : '18%' }}>{amountHeader}</th>
            </tr>
          </thead>
          <tbody className="tt-inv-tr__tbody">
            {detail.map((r, i) => {
                const descriptionText = r.description;
                const empty = !([r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
                const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                const moneyClass = `${numClass} tt-inv-tr__cell--amount`;
                return (
                    <tr key={i}>
                      <TrCell editable={editable} className={cellClass} value={r.date} ariaLabel={`${labels.date}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'date', v)} />
                      <TrCell editable={editable} className={cellClass} value={r.initials} ariaLabel={`${labels.initials}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'initials', v)} />
                      <TrCell editable={editable} className={cellClass} value={taskText(r.task)} ariaLabel={`${labels.task}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'task', v)} />
                      <TrCell multiline editable={editable} className={cellClass} value={showInitiatorName ? splitServiceInitiatorName(descriptionText).note : descriptionText} ariaLabel={`${labels.description}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'description', showInitiatorName ? joinServiceInitiatorName(v, splitServiceInitiatorName(r.description).name, splitServiceInitiatorName(r.description).mark) : v)} />
                      {showInitiatorName ? (
                        <TrCell editable={editable} className={cellClass} value={splitServiceInitiatorName(r.description).name} ariaLabel={`${labels.initiatorName}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'description', joinServiceInitiatorName(splitServiceInitiatorName(r.description).note, v, splitServiceInitiatorName(r.description).mark))} />
                      ) : null}
                      <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.hours}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'hours', v)} />
                      <TrCell editable={editable} className={moneyClass} value={r.hourlyRate} ariaLabel={`${labels.rate}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'hourlyRate', v)} />
                      <TrCell editable={editable} className={moneyClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, row ${i + 1}`} onChange={(v) => onPatchDetailRow?.(i, 'amount', v)} />
                    </tr>
                );
            })}
          </tbody>
          {showDetailTotalRow ? (
              <tfoot className="tt-inv-tr__tfoot">
                <tr>
                  <td colSpan={showInitiatorName ? 5 : 4}>{labels.total}</td>
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
      ) : null}

      {showMehnatSection && !summaryOnly && mehnat.length > 0 ? (
          <>
            <h3 className="tt-inv-tr__subtitle">{labels.mehnatTitle}</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table" role="grid" aria-label={labels.mehnatTitle}>
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: showInitiatorName ? '10%' : '12%' }}>{labels.date}</th>
                    <th scope="col" className="tt-inv-tr__th--initials" style={{ width: showInitiatorName ? '14%' : '16%' }}>{labels.initials}</th>
                    <th scope="col" style={{ width: showInitiatorName ? '10%' : '11%' }}>{labels.task}</th>
                    <th scope="col" style={{ width: showInitiatorName ? '11%' : '13%' }}>{labels.description}</th>
                    {showInitiatorName ? <th scope="col" style={{ width: '10%' }}>{labels.initiatorName}</th> : null}
                    <th scope="col" className="tt-inv-tr__th--per-recording" style={{ width: showInitiatorName ? '14%' : '15%' }}>{labels.perRecording}</th>
                    <th scope="col" className="tt-inv-tr__th--money" style={{ width: showInitiatorName ? '14%' : '15%' }}>{labels.rate}</th>
                    <th scope="col" className="tt-inv-tr__th--money" style={{ width: showInitiatorName ? '17%' : '18%' }}>{amountHeader}</th>
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
                            <TrCell editable={editable} className={cellClass} value={r.initials} ariaLabel={`${labels.initials}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'initials', v)} />
                            <TrCell editable={editable} className={cellClass} value={taskText(r.task)} ariaLabel={`${labels.task}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'task', v)} />
                            <TrCell multiline editable={editable} className={cellClass} value={showInitiatorName ? splitServiceInitiatorName(r.description).note : r.description} ariaLabel={`${labels.description}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'description', showInitiatorName ? joinServiceInitiatorName(v, splitServiceInitiatorName(r.description).name, splitServiceInitiatorName(r.description).mark) : v)} />
                            {showInitiatorName ? (
                              <TrCell editable={editable} className={cellClass} value={splitServiceInitiatorName(r.description).name} ariaLabel={`${labels.initiatorName}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'description', joinServiceInitiatorName(splitServiceInitiatorName(r.description).note, v, splitServiceInitiatorName(r.description).mark))} />
                            ) : null}
                            <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.perRecording}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'hours', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.hourlyRate} ariaLabel={`${labels.rate}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'hourlyRate', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, ${labels.mehnatTitle} ${i + 1}`} onChange={(v) => onPatchMehnatRow?.(i, 'amount', v)} />
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={showInitiatorName ? 5 : 4}>{labels.total}</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">
                      {editable
                        ? (
                            <input
                              type="text"
                              className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                              value={pack.mehnatTotalHoursDisplay}
                              aria-label={`${labels.mehnatTitle} ${labels.total} ${labels.perRecording}`}
                              onChange={(e) => onPatchPack?.({ mehnatTotalHoursDisplay: e.target.value })}
                            />
                          )
                        : (pack.mehnatTotalHoursDisplay || '\u00a0')}
                    </td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num">—</td>
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

      {showSummarySection && fixedFee.length > 0 ? (
          <>
            <h3 className="tt-inv-tr__subtitle">{labels.fixedFeeTitle}</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table" role="grid" aria-label={labels.fixedFeeTitle}>
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: '46%' }}>{labels.fixedFeeScope}</th>
                    <th scope="col" style={{ width: '24%' }}>{labels.fixedFeeCol}</th>
                    <th scope="col" className="tt-inv-tr__th--money" style={{ width: '30%' }}>{labels.fixedFeeAmount}</th>
                  </tr>
                </thead>
                <tbody className="tt-inv-tr__tbody">
                  {fixedFee.map((r, i) => {
                      const moneyClass = 'tt-inv-tr__cell--num tt-inv-tr__cell--amount';
                      return (
                          <tr key={i}>
                            <TrCell multiline editable={editable} value={fixedFeeScopeText(r)} ariaLabel={`${labels.fixedFeeScope}, ${labels.fixedFeeTitle} ${i + 1}`} onChange={(v) => onPatchFixedFeeRow?.(i, 'description', v)} />
                            <td>{labels.fixedFeeCol}</td>
                            <TrCell editable={editable} className={moneyClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, ${labels.fixedFeeTitle} ${i + 1}`} onChange={(v) => onPatchFixedFeeRow?.(i, 'amount', v)} />
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={2}>{labels.total}</td>
                    <td className="tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount">
                      {editable
                        ? (
                            <input
                              type="text"
                              className="tt-inv-tr__cell-input tt-inv-tr__cell-input--foot"
                              value={pack.fixedFeeTotalAmountDisplay ?? ''}
                              aria-label={`${labels.fixedFeeTitle} ${labels.total}`}
                              onChange={(e) => onPatchPack?.({ fixedFeeTotalAmountDisplay: e.target.value })}
                            />
                          )
                        : (pack.fixedFeeTotalAmountDisplay || '\u00a0')}
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
                    <th scope="col" className="tt-inv-tr__th--initials" style={{ width: '22%' }}>{labels.initials}</th>
                    <th scope="col" style={{ width: '18%' }}>{labels.name}</th>
                    <th scope="col" style={{ width: '18%' }}>{labels.titleCol}</th>
                    <th scope="col" style={{ width: '10%' }}>{labels.hours}</th>
                    <th scope="col" style={{ width: '16%' }}>{labels.hourlyRate}</th>
                    <th scope="col" style={{ width: '16%' }}>{labels.totalPrice(cur)}</th>
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
                            <TrCell editable={editable} className={numClass} value={r.hours} ariaLabel={`${labels.hours}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'hours', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.hourlyRate} ariaLabel={`${labels.hourlyRate}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'hourlyRate', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.totalPrice} ariaLabel={`${labels.totalPrice(cur)}, row ${i + 1}`} onChange={(v) => onPatchSummaryRow?.(i, 'totalPrice', v)} />
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

      {showExpenseSection && !summaryOnly && expenses.length > 0 ? (
          <>
            <h3 className="tt-inv-tr__subtitle">{labels.expensesTitle}</h3>
            <div className="tt-inv-tr__table-wrap">
              <table className="tt-inv-tr__table tt-inv-tr__table--expenses" role="grid" aria-label={labels.expensesTitle}>
                <thead className="tt-inv-tr__thead">
                  <tr>
                    <th scope="col" style={{ width: '18%' }}>{labels.date}</th>
                    <th scope="col" style={{ width: '52%' }}>{labels.description}</th>
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
                            <TrCell editable={editable} className={cellClass} value={r.date} ariaLabel={`${labels.date}, ${labels.expensesTitle} ${i + 1}`} onChange={(v) => onPatchExpenseRow?.(i, 'date', v)} />
                            <TrCell multiline editable={editable} className={cellClass} value={r.description} ariaLabel={`${labels.description}, ${labels.expensesTitle} ${i + 1}`} onChange={(v) => onPatchExpenseRow?.(i, 'description', v)} />
                            <TrCell editable={editable} className={moneyClass} value={r.amount} ariaLabel={`${labels.amount(cur)}, ${labels.expensesTitle} ${i + 1}`} onChange={(v) => onPatchExpenseRow?.(i, 'amount', v)} />
                          </tr>
                      );
                  })}
                </tbody>
                <tfoot className="tt-inv-tr__tfoot">
                  <tr>
                    <td colSpan={2}>{labels.total}</td>
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
