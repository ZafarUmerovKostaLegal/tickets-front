import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { addTransitionType, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { NAV_TRANSITION_TYPE, navigateWithTransition } from './AnimatedLink';
function joinClasses(...parts) {
    return parts.filter(Boolean).join(' ');
}
export function AppBackButton({ to, onClick, historyBack = false, className, label: labelProp, ariaLabel: ariaLabelProp, hideLabelOnMobile = false, iconOnly = false, }) {
    const navigate = useNavigate();
    const { t } = useI18n();
    const label = labelProp ?? t('ticketsPage.back');
    const ariaLabel = ariaLabelProp ?? t('ticketsPage.backAria');
    const handleClick = () => {
        onClick?.();
        if (historyBack) {
            startTransition(() => {
                addTransitionType(NAV_TRANSITION_TYPE);
                navigate(-1);
            });
            return;
        }
        const dest = to ?? (onClick ? undefined : routes.home);
        if (dest != null)
            navigateWithTransition(navigate, dest);
    };
    return (_jsxs("button", { type: "button", className: joinClasses('app-back-btn', iconOnly && 'app-back-btn--icon-only', hideLabelOnMobile && 'app-back-btn--hide-label-mobile', className), onClick: handleClick, "aria-label": ariaLabel, children: [_jsx("svg", { className: "app-back-btn__chevron", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m15 18-6-6 6-6" }) }), !iconOnly ? _jsx("span", { className: "app-back-btn__label", children: label }) : null] }));
}
