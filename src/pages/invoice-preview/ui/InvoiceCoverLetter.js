import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { listPartners } from '@entities/user';
import { SearchableSelect } from '@shared/ui';
import { coverLetterheadLogoUrl } from '../lib/invoiceCoverLogoRaster';
import { COVER_SIGNATORY_PARTNERS, coverSignaturePublicUrl, findCoverSignatoryPartnerByInitials, findCoverSignatoryPartnerByName, mergeCoverSignatoryOptions, resolveCoverSignatoryPartner, } from '../lib/invoiceCoverSignature';
import { KOSTA_LEGAL_FIRM, getCoverLetterLabels, resolveCoverIntroParagraph, resolveCoverInvoiceParagraph, } from '../lib/invoiceCoverLetterModel';
import './InvoiceCoverLetter.css';
function CoverField({ className, value, onChange, editable, multiline, ariaLabel, }) {
    if (!editable) {
        return _jsx("span", { className: className, children: value });
    }
    const shared = {
        className: `tt-inv-cover__field${className ? ` ${className}` : ''}`,
        value,
        'aria-label': ariaLabel,
        onChange: (e) => onChange?.(e.target.value),
    };
    if (multiline) {
        return _jsx("textarea", { ...shared, rows: 2 });
    }
    return _jsx("input", { type: "text", ...shared });
}
function resolveActiveSignatory(model) {
    return resolveCoverSignatoryPartner({
        initials: model.signatoryInitials,
        name: model.signatoryName,
    });
}
export function InvoiceCoverLetter({ model, editable = false, onChange, secondParagraphMode = 'invoice', }) {
    const addr2 = model.recipientAddressLines[1];
    const patch = onChange;
    const labels = getCoverLetterLabels(model.coverLanguage);
    const introText = resolveCoverIntroParagraph(model);
    const invoiceText = resolveCoverInvoiceParagraph(model);
    const showSecondParagraph = secondParagraphMode === 'invoice'
        || editable
        || Boolean(model.invoiceParagraphOverride?.trim());
    const [directoryPartners, setDirectoryPartners] = useState(null);
    useEffect(() => {
        let cancelled = false;
        void listPartners()
            .then((rows) => {
            if (cancelled)
                return;
            const merged = mergeCoverSignatoryOptions(rows.map((row) => ({
                id: row.id,
                displayName: row.display_name?.trim() || row.email?.trim() || '',
            })));
            setDirectoryPartners(merged.length > 0 ? merged : [...COVER_SIGNATORY_PARTNERS]);
        })
            .catch(() => {
            if (!cancelled)
                setDirectoryPartners(null);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const activePartner = resolveActiveSignatory(model);
    const signatureUrl = coverSignaturePublicUrl(activePartner);
    const signatoryOptions = directoryPartners ?? [...COVER_SIGNATORY_PARTNERS];
    const namedOption = signatoryOptions.find((partner) => (partner.displayName.trim().toLocaleLowerCase() === model.signatoryName.trim().toLocaleLowerCase()));
    const partnerItems = namedOption || !model.signatoryName.trim()
        ? signatoryOptions
        : [
            {
                initials: '__current__',
                displayName: model.signatoryName.trim(),
                fileName: '',
            },
            ...signatoryOptions,
        ];
    const selectValue = (activePartner && signatoryOptions.some((partner) => partner.initials === activePartner.initials)
        ? activePartner.initials
        : null)
        ?? namedOption?.initials
        ?? (model.signatoryName.trim() ? '__current__' : '');
    return (_jsxs("div", { className: `tt-inv-cover${editable ? ' tt-inv-cover--editable' : ''}`, children: [_jsxs("header", { className: "tt-inv-cover__header", children: [_jsx("div", { className: "tt-inv-cover__brand", children: _jsx("img", { className: "tt-inv-cover__logo", src: coverLetterheadLogoUrl(), alt: "", decoding: "async" }) }), _jsxs("address", { className: "tt-inv-cover__firm-contact", children: [_jsxs("span", { className: "tt-inv-cover__firm-contact-group", children: [_jsx("span", { children: KOSTA_LEGAL_FIRM.addressLine }), _jsx("span", { children: KOSTA_LEGAL_FIRM.phone })] }), _jsxs("span", { className: "tt-inv-cover__firm-contact-group", children: [_jsx("span", { children: KOSTA_LEGAL_FIRM.email }), _jsx("span", { children: KOSTA_LEGAL_FIRM.web })] })] })] }), _jsxs("div", { className: "tt-inv-cover__letter-body", children: [_jsx("p", { className: "tt-inv-cover__date", children: _jsx(CoverField, { editable: editable, value: model.letterDateDisplay, ariaLabel: "\u0414\u0430\u0442\u0430 \u043F\u0438\u0441\u044C\u043C\u0430", onChange: (letterDateDisplay) => patch?.({ letterDateDisplay }) }) }), _jsxs("div", { className: "tt-inv-cover__recipient", children: [_jsx("p", { className: "tt-inv-cover__recipient-line tt-inv-cover__recipient-line--company", children: _jsx(CoverField, { editable: editable, value: model.recipientCompany, ariaLabel: "\u041A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044F", onChange: (recipientCompany) => patch?.({ recipientCompany, quotedCompanyName: recipientCompany }) }) }), _jsx("p", { className: "tt-inv-cover__recipient-line", children: _jsx(CoverField, { editable: editable, value: model.recipientAddressLines[0], ariaLabel: "\u0410\u0434\u0440\u0435\u0441 \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044F, \u0441\u0442\u0440\u043E\u043A\u0430 1", onChange: (line0) => patch?.({
                                        recipientAddressLines: [line0, model.recipientAddressLines[1] ?? ''],
                                    }) }) }), editable || addr2 ? (_jsx("p", { className: "tt-inv-cover__recipient-line", children: _jsx(CoverField, { editable: editable, value: addr2 ?? '', ariaLabel: "\u0410\u0434\u0440\u0435\u0441 \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044F, \u0441\u0442\u0440\u043E\u043A\u0430 2", multiline: editable, onChange: (line1) => patch?.({
                                        recipientAddressLines: [model.recipientAddressLines[0], line1],
                                    }) }) })) : null] }), _jsxs("p", { className: "tt-inv-cover__attention", children: [labels.attention, ":", ' ', _jsx(CoverField, { editable: editable, value: model.attentionName, ariaLabel: "\u0418\u043C\u044F \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u043E\u0433\u043E \u043B\u0438\u0446\u0430", onChange: (attentionName) => patch?.({ attentionName }) })] }), _jsx("p", { className: "tt-inv-cover__attention-sub", children: _jsx(CoverField, { editable: editable, value: model.attentionTitle, ariaLabel: "\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u043E\u0433\u043E \u043B\u0438\u0446\u0430", onChange: (attentionTitle) => patch?.({ attentionTitle }) }) }), _jsxs("p", { className: "tt-inv-cover__salutation", children: [labels.dear, ' ', _jsx(CoverField, { editable: editable, value: model.attentionName, ariaLabel: "\u041E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0435, \u0438\u043C\u044F", onChange: (attentionName) => patch?.({ attentionName }) }), ","] }), editable ? (_jsx("textarea", { className: "tt-inv-cover__field tt-inv-cover__field--para", rows: 3, "aria-label": "\u041F\u0435\u0440\u0432\u044B\u0439 \u0430\u0431\u0437\u0430\u0446 \u043F\u0438\u0441\u044C\u043C\u0430", value: introText, onChange: (e) => patch?.({ introParagraphOverride: e.target.value }) })) : (_jsx("p", { className: "tt-inv-cover__para", children: introText })), showSecondParagraph ? (editable ? (_jsx("textarea", { className: "tt-inv-cover__field tt-inv-cover__field--para", rows: 3, "aria-label": secondParagraphMode === 'invoice' ? 'Второй абзац письма' : 'Дополнительный абзац', placeholder: secondParagraphMode === 'freeform' ? 'Дополнительный абзац (необязательно)' : undefined, value: invoiceText, onChange: (e) => patch?.({ invoiceParagraphOverride: e.target.value }) })) : (_jsx("p", { className: "tt-inv-cover__para", children: invoiceText }))) : null, _jsx("p", { className: "tt-inv-cover__closing", children: labels.closing }), _jsxs("div", { className: "tt-inv-cover__signature", children: [signatureUrl ? (_jsx("img", { className: "tt-inv-cover__sig-image", src: signatureUrl, alt: "", decoding: "async" })) : (_jsx("span", { className: "tt-inv-cover__sig-image tt-inv-cover__sig-image--empty", "aria-hidden": true })), _jsx("span", { className: "tt-inv-cover__sig-line", "aria-hidden": true }), _jsx("p", { className: "tt-inv-cover__sig-name", children: editable ? (_jsx(SearchableSelect, { className: "tt-inv-cover__partner-select", buttonClassName: "tt-inv-cover__field tt-inv-cover__partner-select-btn", value: selectValue, items: partnerItems, getOptionValue: (p) => p.initials, getOptionLabel: (p) => p.displayName, getSearchText: (p) => `${p.displayName} ${p.initials === '__current__' ? '' : p.initials}`, onSelect: (p) => {
                                        if (p.initials === '__current__')
                                            return;
                                        const catalog = findCoverSignatoryPartnerByInitials(p.initials)
                                            ?? findCoverSignatoryPartnerByName(p.displayName);
                                        patch?.({
                                            signatoryName: p.displayName,
                                            signatoryInitials: catalog?.initials ?? '',
                                        });
                                    }, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430", emptyListText: "\u041D\u0435\u0442 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432", noMatchText: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", portalDropdown: true, portalZIndex: 12000, portalMinWidth: 240 })) : (_jsx("span", { children: model.signatoryName })) }), _jsx("p", { className: "tt-inv-cover__sig-title", children: _jsx(CoverField, { editable: editable, value: model.signatoryTitle, ariaLabel: "\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u0442\u0430", onChange: (signatoryTitle) => patch?.({ signatoryTitle }) }) })] })] })] }));
}
