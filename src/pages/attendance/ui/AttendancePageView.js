import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useI18n } from '@shared/i18n';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { AttendanceOverviewCard } from './AttendanceOverviewCard';
import './AttendancePage.css';
export function AttendancePageView() {
    const { t } = useI18n();
    return (_jsx("div", { className: "att", children: _jsxs("main", { className: "att__main", children: [_jsx("header", { className: "att__header", children: _jsxs("div", { className: "att__header-inner", children: [_jsxs("div", { className: "att__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { children: [_jsx("h1", { className: "att__title", children: t('attendancePage.title') }), _jsx("p", { className: "att__subtitle", children: t('attendancePage.subtitle') })] })] }), _jsx("div", { className: "att__header-actions", children: _jsx(AppPageSettings, {}) })] }) }), _jsx("div", { className: "att__content", children: _jsx(AttendanceOverviewCard, {}) })] }) }));
}
