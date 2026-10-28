import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { listPartners } from '@entities/user';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { SearchableSelect } from '@shared/ui';
function partnerLabel(p) {
    return p.display_name?.trim() || p.email || `User #${p.id}`;
}
export function OutgoingSubmitReviewModal({ open, onClose, onSubmit, submitPending = false, nested = false, }) {
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
            setPartnersLoadErr(err instanceof Error ? err.message : 'Не удалось загрузить партнёров');
        });
        return () => { cancelled = true; };
    }, [open]);
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
            setError('Выберите партнёра');
            return;
        }
        onSubmit(partner.id, partnerLabel(partner));
    };
    return createPortal(_jsx("div", { className: `corr-modal corr-modal--enter${nested ? ' corr-modal--nested' : ''}`, role: "presentation", onMouseDown: (e) => {
            if (e.target === e.currentTarget && !submitPending)
                onClose();
        }, children: _jsxs("div", { className: "corr-modal__panel", role: "dialog", "aria-modal": true, "aria-labelledby": titleId, onMouseDown: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "corr-modal__head", children: [_jsxs("div", { children: [_jsx("h2", { id: titleId, className: "corr-modal__title", children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("p", { className: "corr-modal__lead", children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440 \u0441\u043E\u0433\u043B\u0430\u0441\u0443\u0435\u0442 \u043F\u0438\u0441\u044C\u043C\u043E. \u041F\u043E\u0441\u043B\u0435 \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0438\u044F \u043D\u0443\u0436\u043D\u043E \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u043D\u044B\u0439 \u0441\u043A\u0430\u043D." })] }), _jsx("button", { type: "button", className: "corr-modal__close", onClick: onClose, disabled: submitPending, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsxs("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: `corr-modal__field${error ? ' corr-modal__field--err' : ''}`, children: [_jsxs("label", { className: "corr-modal__label", id: "outgoing-review-partner-label", children: ["\u041F\u0430\u0440\u0442\u043D\u0451\u0440 ", _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: "*" })] }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 10120, className: "corr-modal__srch", buttonClassName: "corr-modal__srch-btn", buttonId: "outgoing-review-partner", "aria-labelledby": "outgoing-review-partner-label", "aria-invalid": Boolean(error), placeholder: partnersLoad === 'loading' ? 'Загрузка партнёров…' : 'Выберите партнёра', emptyListText: "\u041D\u0435\u0442 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: partnerUserId, items: sortedPartners, disabled: partnersLoad === 'loading' || submitPending || partnersLoad === 'error', getOptionValue: (p) => String(p.id), getOptionLabel: partnerLabel, getSearchText: (p) => `${partnerLabel(p)} ${p.email ?? ''}`.trim(), onSelect: (p) => {
                                setPartnerUserId(String(p.id));
                                setError(null);
                            } }), error ? _jsx("p", { className: "corr-modal__err", children: error }) : null, partnersLoadErr ? _jsx("p", { className: "corr-modal__err", children: partnersLoadErr }) : null] }), _jsxs("div", { className: "corr-modal__actions", children: [_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--ghost", onClick: onClose, disabled: submitPending, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", onClick: handleSubmit, disabled: submitPending || partnersLoad !== 'ok', children: submitPending ? 'Отправка…' : 'На согласование' })] })] }) }), document.body);
}
