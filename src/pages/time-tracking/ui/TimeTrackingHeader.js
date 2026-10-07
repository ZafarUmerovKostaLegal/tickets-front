import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppBackButton } from '@shared/ui';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
export function TimeTrackingHeader({ trailing }) {
    const { t } = useI18n();
    const withManager = Boolean(trailing);
    return (_jsxs("header", { className: `time-page__header${withManager ? ' time-page__header--with-manager' : ''}`.trim(), children: [_jsx(AppBackButton, { to: routes.home, hideLabelOnMobile: true }), _jsx("div", { className: "time-page__header-divider" }), _jsxs("div", { className: "time-page__header-inner", children: [_jsx("h1", { className: "time-page__title", children: t('timeTrackingPage.page.title') }), trailing ? _jsx("div", { className: "time-page__header-trailing", children: trailing }) : null] })] }));
}
