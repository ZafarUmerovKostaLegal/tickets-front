import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { coverLetterheadLogoUrl } from '@pages/invoice-preview/lib/invoiceCoverLogoRaster';
import { CORRESPONDENCE_LETTERHEAD_CONTACT, formatOutgoingLetterheadDate, formatOutgoingRefLine, } from '../lib/correspondenceLetterhead';
import { CorrespondenceLetterBodyReadonly, CorrespondenceLetterEditorSurface, } from './CorrespondenceLetterBodyEditor';
import { CorrespondenceLetterQr } from './CorrespondenceLetterQr';
export { CORRESPONDENCE_LETTERHEAD_CONTACT, formatOutgoingLetterheadDate, formatOutgoingRefLine, } from '../lib/correspondenceLetterhead';
function LetterField({ className, value, editable, ariaLabel, onChange }) {
    if (!editable) {
        return _jsx("span", { className: className, children: value });
    }
    return (_jsx("input", { type: "text", className: `corr-letter__field${className ? ` ${className}` : ''}`, value: value, "aria-label": ariaLabel, onChange: (e) => onChange?.(e.target.value) }));
}
export function CorrespondenceLetterSheet({ coverModel, registryNumber, editable = false, onCoverModelChange, downloadQrUrl, }) {
    const refLine = formatOutgoingRefLine(registryNumber);
    const dateValue = formatOutgoingLetterheadDate(coverModel);
    const dateLinePrefix = 'Дата: ';
    const bodyHtml = coverModel.introParagraphOverride ?? '';
    return (_jsxs("div", { className: `corr-letter${editable ? ' corr-letter--editable' : ''}`, "aria-label": editable ? 'Лист исходящего письма' : 'Лист письма', children: [_jsxs("header", { className: "corr-letter__header", children: [_jsxs("div", { className: "corr-letter__brand-col", children: [_jsx("div", { className: "corr-letter__brand", children: _jsx("img", { className: "corr-letter__logo", src: coverLetterheadLogoUrl(), alt: "KOSTA LEGAL", decoding: "async" }) }), _jsxs("div", { className: "corr-letter__meta", children: [_jsx("p", { className: "corr-letter__meta-line", children: refLine }), _jsxs("p", { className: "corr-letter__meta-line", children: [_jsx("span", { className: "corr-letter__meta-label", children: dateLinePrefix }), _jsx(LetterField, { editable: editable, className: "corr-letter__meta-date", value: dateValue, ariaLabel: "\u0414\u0430\u0442\u0430 \u043F\u0438\u0441\u044C\u043C\u0430", onChange: (letterDateDisplay) => onCoverModelChange?.({ letterDateDisplay }) })] })] })] }), _jsxs("address", { className: "corr-letter__contact", children: [_jsx("span", { children: CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine1 }), _jsx("span", { children: CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine2 }), _jsx("span", { children: CORRESPONDENCE_LETTERHEAD_CONTACT.phone }), _jsx("span", { children: CORRESPONDENCE_LETTERHEAD_CONTACT.email }), _jsx("span", { children: CORRESPONDENCE_LETTERHEAD_CONTACT.web })] })] }), _jsx("div", { className: "corr-letter__body", children: editable ? (_jsx(CorrespondenceLetterEditorSurface, {})) : (_jsx(CorrespondenceLetterBodyReadonly, { value: bodyHtml })) }), downloadQrUrl ? (_jsx("footer", { className: "corr-letter__footer", children: _jsx(CorrespondenceLetterQr, { url: downloadQrUrl }) })) : null] }));
}
