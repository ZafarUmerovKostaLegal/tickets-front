import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
function ttLabel(opts, v) {
    return opts.find((o) => o.value === v)?.label ?? '—';
}
export function UserFieldChangeConfirmModal({ pending, ttRoleOptions, savingUserId, onConfirm, onDismiss, }) {
    useEffect(() => {
        if (!pending)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onDismiss();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pending, onDismiss]);
    if (!pending)
        return null;
    const user = pending.user;
    const busy = savingUserId === user.id;
    const title = pending.kind === 'role' ? 'Смена роли' : 'Смена роли в учёте времени';
    const body = pending.kind === 'role' ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "ap__modal-desc ap__modal-desc--confirm", children: ["\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u043E\u043B\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ", _jsx("strong", { children: user.display_name || user.email }), "?"] }), _jsxs("div", { className: "ap__modal-row ap__modal-row--col", children: [_jsx("span", { className: "ap__modal-lbl", children: "\u0411\u044B\u043B\u043E" }), _jsx("span", { className: "ap__modal-val", children: user.role || '—' })] }), _jsxs("div", { className: "ap__modal-row ap__modal-row--col", children: [_jsx("span", { className: "ap__modal-lbl", children: "\u0411\u0443\u0434\u0435\u0442" }), _jsx("span", { className: "ap__modal-val ap__modal-val--accent", children: pending.newRole })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "ap__modal-desc ap__modal-desc--confirm", children: ["\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u043E\u043B\u044C \u0432 \u0443\u0447\u0451\u0442\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0434\u043B\u044F ", _jsx("strong", { children: user.display_name || user.email }), "?"] }), _jsxs("div", { className: "ap__modal-row ap__modal-row--col", children: [_jsx("span", { className: "ap__modal-lbl", children: "\u0411\u044B\u043B\u043E" }), _jsx("span", { className: "ap__modal-val", children: ttLabel(ttRoleOptions, user.time_tracking_role ?? null) })] }), _jsxs("div", { className: "ap__modal-row ap__modal-row--col", children: [_jsx("span", { className: "ap__modal-lbl", children: "\u0411\u0443\u0434\u0435\u0442" }), _jsx("span", { className: "ap__modal-val ap__modal-val--accent", children: ttLabel(ttRoleOptions, pending.newTtRole) })] })] }));
    return createPortal(_jsx("div", { className: "ap__overlay", role: "presentation", children: _jsxs("div", { className: "ap__modal ap__modal--confirm", role: "dialog", "aria-modal": "true", "aria-labelledby": "ap-user-field-confirm-title", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "ap__modal-head", children: [_jsx("h3", { id: "ap-user-field-confirm-title", className: "ap__modal-title", children: title }), _jsx("button", { type: "button", className: "ap__modal-close", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", disabled: busy, onClick: onDismiss, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsx("div", { className: "ap__modal-body", children: body }), _jsxs("div", { className: "ap__modal-foot", children: [_jsx("button", { type: "button", className: "ap__btn ap__btn--ghost", disabled: busy, onClick: onDismiss, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "ap__btn ap__btn--primary", disabled: busy, onClick: () => void onConfirm(), children: busy ? 'Сохранение…' : 'Подтвердить' })] })] }) }), document.body);
}
