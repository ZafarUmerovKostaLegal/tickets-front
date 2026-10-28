import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { ItSecurityJournal } from './ItSecurityJournal';
import './ItSecurityPage.css';
export function ItSecurityPage() {
    const { t } = useI18n();
    return (_jsx("div", { className: "its-page", children: _jsxs("main", { className: "its-page__main", children: [_jsx("header", { className: "its-page__header", children: _jsxs("div", { className: "its-page__header-inner", children: [_jsxs("div", { className: "its-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { children: [_jsx("h1", { className: "its-page__title", children: t('nav.itSecurity') }), _jsx("p", { className: "its-page__subtitle", children: t('itSecurityPage.subtitle') })] })] }), _jsx(AppPageSettings, {})] }) }), _jsx("div", { className: "its-page__content", children: _jsx(ItSecurityJournal, {}) })] }) }));
}
