import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useRef } from 'react';
import {} from '../lib/invoiceTimeReportModel';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { getTimeReportLabels, timeReportHeading, timeReportServicesMonthYear } from '../lib/invoiceTimeReportI18n';
import { joinServiceInitiatorName, splitServiceInitiatorName } from '../lib/splitServiceInitiatorName';
import './InvoiceTimeReportPage.css';
function fitBreakableTextarea(el) {
    el.style.height = '0px';
    const line = Number.parseFloat(getComputedStyle(el).lineHeight);
    const linePx = Number.isFinite(line) ? line : 16;
    let height = el.scrollHeight;
    if (el.value.endsWith('\n'))
        height += linePx;
    el.style.height = `${Math.max(height, linePx)}px`;
}
function insertLineBreak(value, start, end) {
    return {
        next: `${value.slice(0, start)}\n${value.slice(end)}`,
        caret: start + 1,
    };
}
function TimeReportTitleInput({ value, onChange, }) {
    const ref = useRef(null);
    const caretRef = useRef(null);
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
    return (_jsx("textarea", { ref: ref, rows: 1, className: "tt-inv-tr__title tt-inv-tr__title-input", value: value, "aria-label": "Time report title", onChange: (e) => onChange(e.target.value), onKeyDown: (e) => {
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
        } }));
}
function TrMultilineInput({ value, ariaLabel, onChange, }) {
    const ref = useRef(null);
    const caretRef = useRef(null);
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
    return (_jsx("textarea", { ref: ref, rows: 1, className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--multiline", value: value, "aria-label": ariaLabel, onChange: (e) => onChange?.(e.target.value), onKeyDown: (e) => {
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
        } }));
}
function TrCell({ value, editable, multiline, onChange, className, ariaLabel, }) {
    const cellClass = multiline ? [className, 'tt-inv-tr__cell--wrap'].filter(Boolean).join(' ') : className;
    if (!editable) {
        return _jsx("td", { className: cellClass, children: value || '\u00a0' });
    }
    return (_jsx("td", { className: cellClass, children: multiline ? (_jsx(TrMultilineInput, { value: value, ariaLabel: ariaLabel, onChange: onChange })) : (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input", value: value, "aria-label": ariaLabel, onChange: (e) => onChange?.(e.target.value) })) }));
}
export function InvoiceTimeReportPage({ model, pack, pageNumber, detailRows, continuation = false, showDetailTotalRow = true, showExpenseSection = true, showMehnatSection = true, showSummarySection = true, summaryOnly = false, showInitiatorName = false, editable = false, onPatchDetailRow, onPatchExpenseRow, onPatchMehnatRow, onPatchSummaryRow, onPatchPack, }) {
    const labels = getTimeReportLabels(model.coverLanguage);
    const cur = packCurrencyCode(model);
    const amountHeader = labels.amount(cur);
    const sumGrandAmt = pack.summaryGrandAmountDisplay.trim().length ? pack.summaryGrandAmountDisplay : cur;
    const detail = detailRows ?? pack.detailSlots;
    const expenses = (pack.expenseSlots ?? []).filter((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
    const mehnat = (pack.mehnatSlots ?? []).filter((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
    const detailHasContent = detail.some((r) => [r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
    const showMainTimeTable = !summaryOnly && (detailHasContent || mehnat.length === 0);
    const title = timeReportHeading({
        language: model.coverLanguage,
        servicesMonthYear: timeReportServicesMonthYear(pack, model.servicesMonthYear, model.coverLanguage),
        continuation,
        reportTitle: pack.reportTitle,
        reportTitleContinued: pack.reportTitleContinued,
    });
    return (_jsxs("div", { className: `tt-inv-tr${editable ? ' tt-inv-tr--editable' : ''}`, children: [_jsx("div", { className: "tt-inv-tr__top", children: _jsx("span", { className: "tt-inv-tr__confidential", children: labels.confidential }) }), _jsx("div", { className: "tt-inv-tr__rule", "aria-hidden": true }), editable ? (_jsx(TimeReportTitleInput, { value: title, onChange: (next) => onPatchPack?.(continuation
                    ? { reportTitleContinued: next }
                    : { reportTitle: next }) })) : _jsx("h2", { className: "tt-inv-tr__title", children: title }), showMainTimeTable ? (_jsx("div", { className: "tt-inv-tr__table-wrap", children: _jsxs("table", { className: "tt-inv-tr__table", role: "grid", "aria-label": "\u0414\u0435\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442 \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438", children: [_jsx("thead", { className: "tt-inv-tr__thead", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", style: { width: showInitiatorName ? '13%' : '15%' }, children: labels.date }), _jsx("th", { scope: "col", style: { width: showInitiatorName ? '8%' : '9%' }, children: labels.initials }), _jsx("th", { scope: "col", style: { width: showInitiatorName ? '11%' : '13%' }, children: labels.task }), _jsx("th", { scope: "col", style: { width: showInitiatorName ? '16%' : '18%' }, children: labels.description }), showInitiatorName ? _jsx("th", { scope: "col", style: { width: '12%' }, children: labels.initiatorName }) : null, _jsx("th", { scope: "col", style: { width: showInitiatorName ? '7%' : '8%' }, children: labels.hours }), _jsx("th", { scope: "col", className: "tt-inv-tr__th--money", style: { width: showInitiatorName ? '16%' : '18%' }, children: labels.rate }), _jsx("th", { scope: "col", className: "tt-inv-tr__th--money", style: { width: showInitiatorName ? '17%' : '19%' }, children: amountHeader })] }) }), _jsx("tbody", { className: "tt-inv-tr__tbody", children: detail.map((r, i) => {
                                const descriptionText = r.description;
                                const empty = !([r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
                                const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                                const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                                const moneyClass = `${numClass} tt-inv-tr__cell--amount`;
                                return (_jsxs("tr", { children: [_jsx(TrCell, { editable: editable, className: cellClass, value: r.date, ariaLabel: `${labels.date}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'date', v) }), _jsx(TrCell, { editable: editable, className: cellClass, value: r.initials, ariaLabel: `${labels.initials}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'initials', v) }), _jsx(TrCell, { editable: editable, className: cellClass, value: r.task, ariaLabel: `${labels.task}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'task', v) }), _jsx(TrCell, { multiline: true, editable: editable, className: cellClass, value: showInitiatorName ? splitServiceInitiatorName(descriptionText).note : descriptionText, ariaLabel: `${labels.description}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'description', showInitiatorName ? joinServiceInitiatorName(v, splitServiceInitiatorName(r.description).name, splitServiceInitiatorName(r.description).mark) : v) }), showInitiatorName ? (_jsx(TrCell, { editable: editable, className: cellClass, value: splitServiceInitiatorName(r.description).name, ariaLabel: `${labels.initiatorName}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'description', joinServiceInitiatorName(splitServiceInitiatorName(r.description).note, v, splitServiceInitiatorName(r.description).mark)) })) : null, _jsx(TrCell, { editable: editable, className: numClass, value: r.hours, ariaLabel: `${labels.hours}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'hours', v) }), _jsx(TrCell, { editable: editable, className: moneyClass, value: r.hourlyRate, ariaLabel: `${labels.rate}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'hourlyRate', v) }), _jsx(TrCell, { editable: editable, className: moneyClass, value: r.amount, ariaLabel: `${labels.amount(cur)}, row ${i + 1}`, onChange: (v) => onPatchDetailRow?.(i, 'amount', v) })] }, i));
                            }) }), showDetailTotalRow ? (_jsx("tfoot", { className: "tt-inv-tr__tfoot", children: _jsxs("tr", { children: [_jsx("td", { colSpan: showInitiatorName ? 5 : 4, children: labels.total }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num", children: editable
                                            ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--foot", value: pack.detailTotalHoursDisplay, "aria-label": `${labels.total} ${labels.hours}`, onChange: (e) => onPatchPack?.({ detailTotalHoursDisplay: e.target.value }) }))
                                            : (pack.detailTotalHoursDisplay || '\u00a0') }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num", children: "\u2014" }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount", children: editable
                                            ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--foot", value: pack.detailTotalAmountDisplay, "aria-label": `${labels.total} ${labels.amount(cur)}`, onChange: (e) => onPatchPack?.({ detailTotalAmountDisplay: e.target.value }) }))
                                            : (pack.detailTotalAmountDisplay || '\u00a0') })] }) })) : null] }) })) : null, showMehnatSection && !summaryOnly && mehnat.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("h3", { className: "tt-inv-tr__subtitle", children: labels.mehnatTitle }), _jsx("div", { className: "tt-inv-tr__table-wrap", children: _jsxs("table", { className: "tt-inv-tr__table", role: "grid", "aria-label": labels.mehnatTitle, children: [_jsx("thead", { className: "tt-inv-tr__thead", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", style: { width: showInitiatorName ? '13%' : '15%' }, children: labels.date }), _jsx("th", { scope: "col", style: { width: showInitiatorName ? '8%' : '9%' }, children: labels.initials }), _jsx("th", { scope: "col", style: { width: showInitiatorName ? '11%' : '13%' }, children: labels.task }), _jsx("th", { scope: "col", style: { width: showInitiatorName ? '16%' : '18%' }, children: labels.description }), showInitiatorName ? _jsx("th", { scope: "col", style: { width: '12%' }, children: labels.initiatorName }) : null, _jsx("th", { scope: "col", style: { width: showInitiatorName ? '7%' : '8%' }, children: labels.hours }), _jsx("th", { scope: "col", className: "tt-inv-tr__th--money", style: { width: showInitiatorName ? '16%' : '18%' }, children: labels.rate }), _jsx("th", { scope: "col", className: "tt-inv-tr__th--money", style: { width: showInitiatorName ? '17%' : '19%' }, children: amountHeader })] }) }), _jsx("tbody", { className: "tt-inv-tr__tbody", children: mehnat.map((r, i) => {
                                        const empty = !([r.date, r.initials, r.task, r.description, r.hours, r.hourlyRate, r.amount].some((c) => String(c).trim().length > 0));
                                        const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                                        const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                                        const moneyClass = `${numClass} tt-inv-tr__cell--amount`;
                                        return (_jsxs("tr", { children: [_jsx(TrCell, { editable: editable, className: cellClass, value: r.date, ariaLabel: `${labels.date}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'date', v) }), _jsx(TrCell, { editable: editable, className: cellClass, value: r.initials, ariaLabel: `${labels.initials}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'initials', v) }), _jsx(TrCell, { editable: editable, className: cellClass, value: r.task, ariaLabel: `${labels.task}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'task', v) }), _jsx(TrCell, { multiline: true, editable: editable, className: cellClass, value: showInitiatorName ? splitServiceInitiatorName(r.description).note : r.description, ariaLabel: `${labels.description}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'description', showInitiatorName ? joinServiceInitiatorName(v, splitServiceInitiatorName(r.description).name, splitServiceInitiatorName(r.description).mark) : v) }), showInitiatorName ? (_jsx(TrCell, { editable: editable, className: cellClass, value: splitServiceInitiatorName(r.description).name, ariaLabel: `${labels.initiatorName}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'description', joinServiceInitiatorName(splitServiceInitiatorName(r.description).note, v, splitServiceInitiatorName(r.description).mark)) })) : null, _jsx(TrCell, { editable: editable, className: numClass, value: r.hours, ariaLabel: `${labels.hours}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'hours', v) }), _jsx(TrCell, { editable: editable, className: moneyClass, value: r.hourlyRate, ariaLabel: `${labels.rate}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'hourlyRate', v) }), _jsx(TrCell, { editable: editable, className: moneyClass, value: r.amount, ariaLabel: `${labels.amount(cur)}, ${labels.mehnatTitle} ${i + 1}`, onChange: (v) => onPatchMehnatRow?.(i, 'amount', v) })] }, i));
                                    }) }), _jsx("tfoot", { className: "tt-inv-tr__tfoot", children: _jsxs("tr", { children: [_jsx("td", { colSpan: showInitiatorName ? 5 : 4, children: labels.total }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num", children: editable
                                                    ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--foot", value: pack.mehnatTotalHoursDisplay, "aria-label": `${labels.mehnatTitle} ${labels.total} ${labels.hours}`, onChange: (e) => onPatchPack?.({ mehnatTotalHoursDisplay: e.target.value }) }))
                                                    : (pack.mehnatTotalHoursDisplay || '\u00a0') }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num", children: "\u2014" }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount", children: editable
                                                    ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--foot", value: pack.mehnatTotalAmountDisplay, "aria-label": `${labels.mehnatTitle} ${labels.total} ${labels.amount(cur)}`, onChange: (e) => onPatchPack?.({ mehnatTotalAmountDisplay: e.target.value }) }))
                                                    : (pack.mehnatTotalAmountDisplay || '\u00a0') })] }) })] }) })] })) : null, showSummarySection ? (_jsxs(_Fragment, { children: [_jsx("h3", { className: "tt-inv-tr__subtitle", children: labels.summaryTitle }), _jsx("div", { className: "tt-inv-tr__table-wrap", children: _jsxs("table", { className: "tt-inv-tr__table", role: "grid", "aria-label": "\u0421\u0432\u043E\u0434\u043A\u0430 \u043F\u043E \u0441\u0435\u0440\u0432\u0438\u0441\u0430\u043C", children: [_jsx("thead", { className: "tt-inv-tr__thead", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", style: { width: '8%' }, children: labels.initials }), _jsx("th", { scope: "col", style: { width: '26%' }, children: labels.name }), _jsx("th", { scope: "col", style: { width: '22%' }, children: labels.titleCol }), _jsx("th", { scope: "col", style: { width: '10%' }, children: labels.hours }), _jsx("th", { scope: "col", style: { width: '16%' }, children: labels.hourlyRate }), _jsx("th", { scope: "col", style: { width: '18%' }, children: labels.totalPrice(cur) })] }) }), _jsx("tbody", { className: "tt-inv-tr__tbody", children: pack.summarySlots.map((r, i) => {
                                        const empty = !([r.initials, r.name, r.title, r.hours, r.hourlyRate, r.totalPrice].some((c) => String(c).trim().length > 0));
                                        const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                                        const numClass = `tt-inv-tr__cell--num${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                                        const moneyClass = `${numClass} tt-inv-tr__cell--amount`;
                                        return (_jsxs("tr", { children: [_jsx(TrCell, { editable: editable, className: cellClass, value: r.initials, ariaLabel: `${labels.initials}, row ${i + 1}`, onChange: (v) => onPatchSummaryRow?.(i, 'initials', v) }), _jsx(TrCell, { editable: editable, className: cellClass, value: r.name, ariaLabel: `${labels.name}, row ${i + 1}`, onChange: (v) => onPatchSummaryRow?.(i, 'name', v) }), _jsx(TrCell, { editable: editable, className: cellClass, value: r.title, ariaLabel: `${labels.titleCol}, row ${i + 1}`, onChange: (v) => onPatchSummaryRow?.(i, 'title', v) }), _jsx(TrCell, { editable: editable, className: numClass, value: r.hours, ariaLabel: `${labels.hours}, row ${i + 1}`, onChange: (v) => onPatchSummaryRow?.(i, 'hours', v) }), _jsx(TrCell, { editable: editable, className: moneyClass, value: r.hourlyRate, ariaLabel: `${labels.hourlyRate}, row ${i + 1}`, onChange: (v) => onPatchSummaryRow?.(i, 'hourlyRate', v) }), _jsx(TrCell, { editable: editable, className: moneyClass, value: r.totalPrice, ariaLabel: `${labels.totalPrice(cur)}, row ${i + 1}`, onChange: (v) => onPatchSummaryRow?.(i, 'totalPrice', v) })] }, i));
                                    }) }), _jsx("tfoot", { className: "tt-inv-tr__tfoot", children: _jsxs("tr", { children: [_jsx("td", { colSpan: 3, children: labels.total }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num", children: editable
                                                    ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--foot", value: pack.summaryGrandHoursDisplay, "aria-label": `${labels.summaryTitle} ${labels.total} ${labels.hours}`, onChange: (e) => onPatchPack?.({ summaryGrandHoursDisplay: e.target.value }) }))
                                                    : (pack.summaryGrandHoursDisplay || '\u00a0') }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num", children: "\u2014" }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__currency-foot", children: editable
                                                    ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--foot", value: sumGrandAmt, "aria-label": `${labels.summaryTitle} ${labels.total}`, onChange: (e) => onPatchPack?.({ summaryGrandAmountDisplay: e.target.value }) }))
                                                    : sumGrandAmt })] }) })] }) })] })) : null, showExpenseSection && !summaryOnly && expenses.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("h3", { className: "tt-inv-tr__subtitle", children: labels.expensesTitle }), _jsx("div", { className: "tt-inv-tr__table-wrap", children: _jsxs("table", { className: "tt-inv-tr__table tt-inv-tr__table--expenses", role: "grid", "aria-label": labels.expensesTitle, children: [_jsx("thead", { className: "tt-inv-tr__thead", children: _jsxs("tr", { children: [_jsx("th", { scope: "col", style: { width: '18%' }, children: labels.date }), _jsx("th", { scope: "col", style: { width: '52%' }, children: labels.description }), _jsx("th", { scope: "col", style: { width: '30%' }, children: amountHeader })] }) }), _jsx("tbody", { className: "tt-inv-tr__tbody", children: expenses.map((r, i) => {
                                        const empty = !([r.date, r.description, r.amount].some((c) => String(c).trim().length > 0));
                                        const cellClass = empty ? 'tt-inv-tr__cell--empty' : undefined;
                                        const moneyClass = `tt-inv-tr__cell--num tt-inv-tr__cell--amount${empty ? ' tt-inv-tr__cell--empty' : ''}`;
                                        return (_jsxs("tr", { children: [_jsx(TrCell, { editable: editable, className: cellClass, value: r.date, ariaLabel: `${labels.date}, ${labels.expensesTitle} ${i + 1}`, onChange: (v) => onPatchExpenseRow?.(i, 'date', v) }), _jsx(TrCell, { multiline: true, editable: editable, className: cellClass, value: r.description, ariaLabel: `${labels.description}, ${labels.expensesTitle} ${i + 1}`, onChange: (v) => onPatchExpenseRow?.(i, 'description', v) }), _jsx(TrCell, { editable: editable, className: moneyClass, value: r.amount, ariaLabel: `${labels.amount(cur)}, ${labels.expensesTitle} ${i + 1}`, onChange: (v) => onPatchExpenseRow?.(i, 'amount', v) })] }, i));
                                    }) }), _jsx("tfoot", { className: "tt-inv-tr__tfoot", children: _jsxs("tr", { children: [_jsx("td", { colSpan: 2, children: labels.total }), _jsx("td", { className: "tt-inv-tr__cell--num tt-inv-tr__tfoot-num tt-inv-tr__cell--amount", children: editable
                                                    ? (_jsx("input", { type: "text", className: "tt-inv-tr__cell-input tt-inv-tr__cell-input--foot", value: pack.expenseTotalAmountDisplay, "aria-label": `${labels.expensesTitle} ${labels.total}`, onChange: (e) => onPatchPack?.({ expenseTotalAmountDisplay: e.target.value }) }))
                                                    : (pack.expenseTotalAmountDisplay || '\u00a0') })] }) })] }) })] })) : null, _jsxs("footer", { className: "tt-inv-tr__bottom", children: [_jsx("div", { className: "tt-inv-tr__bottom-line", "aria-hidden": true }), _jsx("div", { className: "tt-inv-tr__bottom-meta", children: _jsx("span", { className: "tt-inv-tr__page-box", children: pageNumber }) })] })] }));
}
