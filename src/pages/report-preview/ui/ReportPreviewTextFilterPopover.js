import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ReportPreviewFilterPopover } from './ReportPreviewFilterPopover';
export function ReportPreviewTextFilterPopover({ 'aria-label': ariaLabel, title, value, onChange, placeholder, hint, }) {
    return (_jsx(ReportPreviewFilterPopover, { "aria-label": ariaLabel, title: title, children: _jsxs("div", { className: "tt-rp-xlf__section", children: [_jsx("div", { className: "tt-rp-xlf__section-title", children: "\u041F\u043E\u0438\u0441\u043A" }), _jsx("input", { type: "search", className: "tt-rp-xlf__search-input", value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, autoComplete: "off", spellCheck: false }), hint ? (_jsx("p", { className: "tt-rp-xlf__hint", children: hint })) : null] }) }));
}
