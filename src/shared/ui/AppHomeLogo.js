import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
function joinClasses(...parts) {
    return parts.filter(Boolean).join(' ');
}
export function AppHomeLogo({ className, withSeparator = false }) {
    const navigate = useNavigate();
    const { t } = useI18n();
    const label = t('brand.homeAria');
    return (_jsxs(_Fragment, { children: [withSeparator ? _jsx("span", { className: "app-home-logo__sep", "aria-hidden": "true" }) : null, _jsx("button", { type: "button", className: joinClasses('app-home-logo', className), onClick: () => navigate(routes.home), "aria-label": label, title: label, children: _jsx("img", { src: "/logo.svg", alt: "", className: "app-home-logo__img", width: 24, height: 34, draggable: false }) })] }));
}
