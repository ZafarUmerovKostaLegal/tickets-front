import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { reportClientError } from '@shared/lib/clientErrorReporter';
import './ExpensesPage.css';
export class ExpensesPageBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        reportClientError(error, { source: 'expenses-error-boundary', componentStack: info.componentStack });
    }
    handleRetry = () => {
        this.setState({ error: null });
    };
    render() {
        if (this.state.error) {
            const msg = this.state.error.message;
            const legacyEquiv = msg.includes('equivalentAmount') && msg.includes('toFixed');
            return (_jsx("div", { className: "expenses-page", style: { minHeight: '100vh' }, children: _jsx("main", { className: "expenses-page__main", children: _jsx("div", { className: "expenses-page__content", children: _jsxs("div", { className: "exp-service-err", role: "alert", children: [_jsx("h2", { className: "exp-service-err__title", children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0440\u0430\u0437\u0434\u0435\u043B \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432" }), _jsx("p", { className: "exp-service-err__desc", children: legacyEquiv ? (_jsxs(_Fragment, { children: ["\u041E\u0448\u0438\u0431\u043A\u0430 \u0444\u043E\u0440\u043C\u0430\u0442\u0430 \u0441\u0443\u043C\u043C\u044B \u0432 USD \u0432 \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0435\u043C JS. \u041D\u0443\u0436\u043D\u0430 ", _jsx("strong", { children: "\u043D\u043E\u0432\u0430\u044F \u0441\u0431\u043E\u0440\u043A\u0430" }), " \u0444\u0440\u043E\u043D\u0442\u0430 \u0438 \u0441\u0431\u0440\u043E\u0441 \u043A\u044D\u0448\u0430 (Ctrl+Shift+R). \u0412 \u0440\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u0438 \u0432\u043A\u043B\u044E\u0447\u0451\u043D ", _jsx("strong", { children: "\u0434\u0435\u043C\u043E-\u0440\u0435\u0436\u0438\u043C \u0431\u0435\u0437 API" }), " \u2014 \u043F\u043E\u0441\u043B\u0435 \u0434\u0435\u043F\u043B\u043E\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C\u0441\u044F."] })) : (msg) }), _jsxs("div", { style: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }, children: [_jsx("button", { type: "button", className: "exp-service-err__btn", onClick: this.handleRetry, children: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "exp-service-err__btn", onClick: () => window.location.reload(), children: "\u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443" })] })] }) }) }) }));
        }
        return this.props.children;
    }
}
