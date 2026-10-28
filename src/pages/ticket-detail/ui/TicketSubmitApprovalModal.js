import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { listPartners } from '@entities/user';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';
function partnerLabel(p) {
    return p.display_name?.trim() || p.email || `User #${p.id}`;
}
export function TicketSubmitApprovalModal({ open, onClose, onSubmit, submitPending = false, }) {
    const { t } = useI18n();
    const titleId = useId();
    const [partnerUserId, setPartnerUserId] = useState('');
    const [error, setError] = useState(null);
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [partnersLoad, setPartnersLoad] = useState('idle');
    const [partnersLoadErr, setPartnersLoadErr] = useState(null);
    const sortedPartners = useMemo(() => sortByRuLabel(partnerOptions, partnerLabel), [partnerOptions]);
    useEffect(() => {
        if (!open)
            return;
        setPartnerUserId('');
        setError(null);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setPartnersLoad('loading');
        setPartnersLoadErr(null);
        void listPartners()
            .then((rows) => {
            if (cancelled)
                return;
            setPartnerOptions(rows);
            setPartnersLoad('ok');
        })
            .catch((err) => {
            if (cancelled)
                return;
            setPartnerOptions([]);
            setPartnersLoad('error');
            setPartnersLoadErr(err instanceof Error ? err.message : t('ticketDetailPage.approvalPartnersLoadErr'));
        });
        return () => { cancelled = true; };
    }, [open, t]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !submitPending) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, submitPending]);
    if (!open)
        return null;
    const handleSubmit = () => {
        const partner = partnerOptions.find((p) => String(p.id) === partnerUserId);
        if (!partner) {
            setError(t('ticketDetailPage.approvalPartnerRequired'));
            return;
        }
        onSubmit(partner.id);
    };
    return createPortal(_jsx("div", { className: "td-approval-modal", role: "presentation", onMouseDown: (e) => {
            if (e.target === e.currentTarget && !submitPending)
                onClose();
        }, children: _jsxs("div", { className: "td-approval-modal__panel", role: "dialog", "aria-modal": true, "aria-labelledby": titleId, onMouseDown: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "td-approval-modal__head", children: [_jsxs("div", { children: [_jsx("h2", { id: titleId, className: "td-approval-modal__title", children: t('ticketDetailPage.approvalModalTitle') }), _jsx("p", { className: "td-approval-modal__lead", children: t('ticketDetailPage.approvalModalLead') })] }), _jsx("button", { type: "button", className: "td-approval-modal__close", onClick: onClose, disabled: submitPending, "aria-label": t('ticketDetailPage.closePreview'), children: "\u00D7" })] }), _jsxs("div", { className: `td-approval-modal__field${error ? ' td-approval-modal__field--err' : ''}`, children: [_jsx("label", { className: "td-approval-modal__label", id: "ticket-approval-partner-label", children: t('ticketDetailPage.approvalPartnerLabel') }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 10120, className: "td-approval-modal__srch", buttonClassName: "td-approval-modal__srch-btn", buttonId: "ticket-approval-partner", "aria-labelledby": "ticket-approval-partner-label", "aria-invalid": Boolean(error), placeholder: partnersLoad === 'loading'
                                ? t('ticketDetailPage.approvalPartnersLoading')
                                : t('ticketDetailPage.approvalPartnerPlaceholder'), emptyListText: t('ticketDetailPage.approvalPartnersEmpty'), noMatchText: t('ticketDetailPage.approvalPartnersNoMatch'), value: partnerUserId, items: sortedPartners, disabled: partnersLoad === 'loading' || submitPending || partnersLoad === 'error', getOptionValue: (p) => String(p.id), getOptionLabel: partnerLabel, getSearchText: (p) => `${partnerLabel(p)} ${p.email ?? ''}`.trim(), onSelect: (p) => {
                                setPartnerUserId(String(p.id));
                                setError(null);
                            } }), error ? _jsx("p", { className: "td-approval-modal__err", children: error }) : null, partnersLoadErr ? _jsx("p", { className: "td-approval-modal__err", children: partnersLoadErr }) : null] }), _jsxs("div", { className: "td-approval-modal__actions", children: [_jsx("button", { type: "button", className: "td-approval-modal__btn td-approval-modal__btn--ghost", onClick: onClose, disabled: submitPending, children: t('ticketDetailPage.approvalCancel') }), _jsx("button", { type: "button", className: "td-approval-modal__btn td-approval-modal__btn--primary", onClick: handleSubmit, disabled: submitPending || partnersLoad !== 'ok', children: submitPending
                                ? t('ticketDetailPage.approvalSubmitting')
                                : t('ticketDetailPage.approvalSubmit') })] })] }) }), document.body);
}
