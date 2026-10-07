import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';
function ruCount(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? one
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? few
            : many;
    return `${count} ${word}`;
}
function monthSummary(rows) {
    if (rows.length === 0)
        return 'Нет отсутствий';
    const lates = rows.filter((row) => row.kindLabel === 'Опоздание').length;
    const away = rows.length - lates;
    if (lates === 0)
        return ruCount(away, 'отсутствие', 'отсутствия', 'отсутствий');
    if (away === 0)
        return ruCount(lates, 'опоздание', 'опоздания', 'опозданий');
    return `${ruCount(away, 'отсутствие', 'отсутствия', 'отсутствий')} · ${ruCount(lates, 'опоздание', 'опоздания', 'опозданий')}`;
}
function rowWhen(row) {
    if (row.kindLabel !== 'Опоздание')
        return { when: row.rangeLabel, times: null };
    const [head, tail] = row.rangeLabel.split(' · ');
    if (tail && /^\d+/.test(head))
        return { when: tail, times: head.split(' ')[0] ?? null };
    return { when: head, times: tail ?? null };
}
function groupedRows(rows) {
    const order = [];
    const byKind = new Map();
    for (const row of rows) {
        const bucket = byKind.get(row.kindLabel);
        if (bucket)
            bucket.rows.push(row);
        else {
            order.push(row.kindLabel);
            byKind.set(row.kindLabel, { color: row.color, rows: [row] });
        }
    }
    order.sort((a, b) => {
        if (a === 'Опоздание')
            return 1;
        if (b === 'Опоздание')
            return -1;
        return (byKind.get(b)?.rows.length ?? 0) - (byKind.get(a)?.rows.length ?? 0) || a.localeCompare(b, 'ru');
    });
    return order.map((kind) => {
        const bucket = byKind.get(kind);
        return {
            kind,
            color: bucket.color,
            rows: bucket.rows.slice().sort((a, b) => a.label.localeCompare(b.label, 'ru')),
        };
    });
}
export function VacationMonthPanel({ year, monthIndex, open, visible = true, rows, onToggle, onStepMonth, onOpenCard, onOpenDocs, showDocs }) {
    const title = `${VACATION_MONTH_NAMES[monthIndex]} ${year}`;
    return (_jsxs("aside", { className: `vac-month${open ? '' : ' vac-month--closed'}${visible ? '' : ' vac-month--away'}`, "aria-hidden": !visible, "aria-label": `Отсутствия за ${title}`, children: [_jsxs("div", { className: "vac-month__bar", children: [open ? (_jsxs("div", { className: "vac-month__heading", children: [_jsxs("div", { className: "vac-month__nav", children: [_jsx("button", { type: "button", className: "vac-month__step", "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446", title: "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446", onClick: () => onStepMonth?.(-1), children: "\u2039" }), _jsx("h2", { className: "vac-month__title", children: title }), _jsx("button", { type: "button", className: "vac-month__step", "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446", title: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446", onClick: () => onStepMonth?.(1), children: "\u203A" })] }), _jsx("p", { className: "vac-month__count", children: monthSummary(rows) })] })) : null, _jsx("button", { type: "button", className: "vac-month__toggle", "aria-expanded": open, "aria-label": open ? 'Свернуть детали месяца' : 'Показать детали месяца', title: open ? 'Свернуть' : title, onClick: onToggle, children: open ? '›' : '‹' })] }), open ? (rows.length === 0 ? (_jsx("p", { className: "vac-month__empty", children: "\u0412 \u044D\u0442\u043E\u043C \u043C\u0435\u0441\u044F\u0446\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0439 \u043D\u0435\u0442" })) : (_jsx("div", { className: "vac-month__list", children: groupedRows(rows).map((group) => (_jsxs("section", { className: "vac-month__group", children: [_jsxs("h3", { className: "vac-month__group-title", children: [_jsx("i", { style: { background: group.color }, "aria-hidden": true }), _jsx("span", { children: group.kind }), _jsx("em", { children: group.rows.length })] }), _jsx("ul", { children: group.rows.map((row) => {
                                const meta = rowWhen(row);
                                const docs = showDocs && row.allowDocs !== false && row.canOpenCard;
                                return (_jsxs("li", { className: "vac-month__row", children: [row.canOpenCard ? (_jsx("button", { type: "button", className: "vac-month__who", onClick: () => onOpenCard(row.employeeId), children: row.label })) : _jsx("span", { className: "vac-month__who", children: row.label }), _jsxs("span", { className: "vac-month__when", children: [meta.times ? _jsxs("em", { children: ["\u00D7", meta.times] }) : null, meta.when] }), docs ? (_jsx("button", { type: "button", className: "vac-month__doc", title: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B", onClick: () => onOpenDocs(row.employeeId, row.label), children: "\u0414\u043E\u043A." })) : null] }, `${row.employeeId}-${row.kindLabel}`));
                            }) })] }, group.kind))) }))) : (_jsx("span", { className: "vac-month__rail", children: VACATION_MONTH_NAMES[monthIndex] }))] }));
}
