import { jsx as _jsx } from "react/jsx-runtime";
export function partnerReportIsEmpty(row) {
    if (row.isEmpty === true)
        return true;
    if (row.isEmpty === false)
        return false;
    if (row.entryCount != null)
        return row.entryCount <= 0;
    return false;
}
export function PartnerReportEmptyBadge({ label, title }) {
    return (_jsx("span", { className: "tt-partner-confirmed__empty-badge", title: title ?? label, children: label }));
}
