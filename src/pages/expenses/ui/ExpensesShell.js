import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from 'react';
import { routes } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import './ExpensesPage.css';
export function ExpensesShell({ title, backTo = routes.home, children }) {
    return (_jsx("div", { className: "expenses-page", children: _jsxs("main", { className: "expenses-page__main", children: [_jsx("header", { className: "expenses-page__header", children: _jsxs("div", { className: "expenses-page__header-inner", children: [_jsxs("div", { className: "expenses-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn", to: backTo }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "expenses-page__header-titles", children: _jsx("h1", { className: "expenses-page__title", children: title }) })] }), _jsx(AppPageSettings, {})] }) }), _jsx("div", { className: "expenses-page__content", children: children })] }) }));
}
