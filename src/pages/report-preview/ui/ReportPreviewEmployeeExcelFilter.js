import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { compareRuLabels } from '@shared/lib/sortByRuLabel';
import { ReportPreviewFilterPopover } from './ReportPreviewFilterPopover';
export function ReportPreviewEmployeeExcelFilter({ uniqueNames, excludedNames, onExcludedChange, sortAsc, onSortAscChange, tableNameSearch, }) {
    const [listQuery, setListQuery] = useState('');
    const q = useMemo(() => listQuery.trim().toLowerCase(), [listQuery]);
    const namesForList = useMemo(() => {
        const base = !q
            ? uniqueNames
            : uniqueNames.filter((n) => n.toLowerCase().includes(q));
        return [...base].sort(compareRuLabels);
    }, [uniqueNames, q]);
    const toggleName = (name) => {
        const next = new Set(excludedNames);
        if (next.has(name)) {
            next.delete(name);
            onExcludedChange(next);
            return;
        }
        next.add(name);
        const stillVisible = uniqueNames.some((n) => !next.has(n));
        if (!stillVisible)
            return;
        onExcludedChange(next);
    };
    const selectAll = () => onExcludedChange(new Set());
    const deselectAll = () => onExcludedChange(new Set(uniqueNames));
    const rowCount = uniqueNames.filter((n) => !excludedNames.has(n)).length;
    if (uniqueNames.length === 0)
        return null;
    const panel = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-rp-xlf__section", children: [_jsx("div", { className: "tt-rp-xlf__section-title", children: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u043F\u0438\u0441\u043A\u0443" }), _jsx("input", { type: "search", className: "tt-rp-xlf__search-input", value: listQuery, onChange: (e) => setListQuery(e.target.value), placeholder: "\u0421\u0443\u0437\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0438\u043C\u0451\u043D\u2026", autoComplete: "off", spellCheck: false }), _jsx("p", { className: "tt-rp-xlf__hint", children: "\u0424\u0438\u043B\u044C\u0442\u0440\u0443\u0435\u0442 \u0447\u0435\u043A\u0431\u043E\u043A\u0441\u044B \u043D\u0438\u0436\u0435, \u043D\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u044B." })] }), tableNameSearch ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "tt-rp-xlf__sep" }), _jsxs("div", { className: "tt-rp-xlf__section", children: [_jsx("div", { className: "tt-rp-xlf__section-title", children: "\u041F\u043E\u0438\u0441\u043A \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435" }), _jsx("input", { type: "search", className: "tt-rp-xlf__search-input", value: tableNameSearch.value, onChange: (e) => tableNameSearch.onChange(e.target.value), placeholder: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u2026", autoComplete: "off", spellCheck: false }), _jsx("p", { className: "tt-rp-xlf__hint", children: "\u0421\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0441\u0442\u0440\u043E\u043A\u0438, \u0432 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043D\u0435\u0442 \u0432\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F (\u0431\u0435\u0437 \u0443\u0447\u0451\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430)." })] })] })) : null, _jsx("div", { className: "tt-rp-xlf__sep" }), _jsxs("div", { className: "tt-rp-xlf__section", children: [_jsx("div", { className: "tt-rp-xlf__section-title", children: "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430" }), _jsx("button", { type: "button", role: "menuitemradio", "aria-checked": sortAsc, className: `tt-rp-xlf__opt${sortAsc ? ' tt-rp-xlf__opt--active' : ''}`, onClick: () => onSortAscChange(true), children: "\u041E\u0442 \u0410 \u0434\u043E \u042F" }), _jsx("button", { type: "button", role: "menuitemradio", "aria-checked": !sortAsc, className: `tt-rp-xlf__opt${!sortAsc ? ' tt-rp-xlf__opt--active' : ''}`, onClick: () => onSortAscChange(false), children: "\u041E\u0442 \u042F \u0434\u043E \u0410" })] }), _jsx("div", { className: "tt-rp-xlf__sep" }), _jsxs("div", { className: "tt-rp-xlf__section", children: [_jsxs("div", { className: "tt-rp-xlf__section-head", children: [_jsx("span", { className: "tt-rp-xlf__section-title", children: "\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u044F" }), _jsxs("div", { className: "tt-rp-xlf__section-actions", children: [_jsx("button", { type: "button", className: "tt-rp-xlf__link", onClick: selectAll, children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0435\u0445" }), _jsx("button", { type: "button", className: "tt-rp-xlf__link", onClick: deselectAll, children: "\u0423\u0431\u0440\u0430\u0442\u044C \u0432\u0441\u0435\u0445" })] })] }), _jsx("p", { className: "tt-rp-xlf__hint", children: "\u0421\u043D\u0438\u043C\u0438\u0442\u0435 \u0444\u043B\u0430\u0436\u043E\u043A, \u0447\u0442\u043E\u0431\u044B \u0441\u043A\u0440\u044B\u0442\u044C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B." }), _jsx("ul", { className: "tt-rp-xlf__list", children: namesForList.map((name) => (_jsx("li", { className: "tt-rp-xlf__li", children: _jsxs("label", { className: "tt-rp-xlf__lbl", children: [_jsx("input", { type: "checkbox", className: "tt-rp-xlf__cb", checked: !excludedNames.has(name), onChange: () => toggleName(name) }), _jsx("span", { className: "tt-rp-xlf__name", children: name })] }) }, name))) })] }), _jsxs("div", { className: "tt-rp-xlf__foot", children: ["\u0412\u0438\u0434\u043D\u043E:\u00A0", _jsx("strong", { children: rowCount }), "\u00A0/\u00A0", uniqueNames.length] })] }));
    return (_jsx(_Fragment, { children: _jsx(ReportPreviewFilterPopover, { "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u0438 \u0441\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430 \u043F\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443", title: "\u041A\u0430\u043A \u0432 Excel: \u0444\u0438\u043B\u044C\u0442\u0440, \u0441\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430 \u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F", children: panel }) }));
}
