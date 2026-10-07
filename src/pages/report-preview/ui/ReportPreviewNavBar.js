import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from 'react';
import { routes } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { clearReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
import '@pages/time-tracking/ui/TimePageShell.css';
import './ReportPreviewPage.css';
export const REPORTS_TAB_URL = `${routes.timeTracking}?tab=reports`;
export function ReportPreviewNavBar({ hint, hintTitle, projectSlot, timeReportViewSlot, extrasSlot }) {
    const onLeave = () => {
        void clearReportPreviewTransfer();
    };
    return (_jsxs("nav", { className: "time-page__navbar tt-rp-preview__navbar", "aria-label": "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043E\u0442\u0447\u0451\u0442\u0430", children: [_jsxs("div", { className: "tt-rp-preview__navbar-start", children: [_jsx(AppBackButton, { to: REPORTS_TAB_URL, onClick: onLeave, hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("span", { className: "time-page__navbar-title", children: "\u041E\u0442\u0447\u0451\u0442\u044B" })] }), _jsxs("div", { className: "tt-rp-preview__navbar-center", children: [_jsxs("div", { className: "tt-rp-preview__navbar-center-leading", children: [_jsx("div", { className: "time-page__navbar-tabs", role: "tablist", "aria-label": "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0440\u0430\u0437\u0434\u0435\u043B", children: _jsx("span", { className: "time-page__navbar-tab time-page__navbar-tab--active", role: "tab", "aria-selected": "true", tabIndex: -1, children: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440" }) }), timeReportViewSlot ? (_jsx("div", { className: "tt-rp-preview__navbar-view-slot", children: timeReportViewSlot })) : null] }), extrasSlot ? (_jsx("div", { className: "tt-rp-preview__navbar-extras", children: extrasSlot })) : null] }), _jsxs("div", { className: "tt-rp-preview__navbar-end", children: [_jsx("div", { className: "time-page__navbar-settings", children: _jsx(AppPageSettings, {}) }), projectSlot !== undefined
                        ? projectSlot
                        : hint
                            ? (_jsx("span", { className: "tt-rp-preview__navbar-hint", title: hintTitle ?? undefined, children: hint }))
                            : null] })] }));
}
