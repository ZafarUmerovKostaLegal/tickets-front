import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { reportClientError } from '@shared/lib/clientErrorReporter';
export class RootErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        reportClientError(error, { source: 'root-error-boundary', componentStack: info.componentStack });
    }
    render() {
        const { error } = this.state;
        if (error) {
            return (_jsxs("div", { role: "alert", style: {
                    minHeight: '100vh',
                    padding: '1.5rem',
                    boxSizing: 'border-box',
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                    background: '#fef2f2',
                    color: '#7f1d1d',
                }, children: [_jsx("h1", { style: { fontSize: '1.1rem', margin: '0 0 0.75rem' }, children: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430" }), _jsx("pre", { style: {
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '0.8rem',
                            lineHeight: 1.45,
                        }, children: error.message })] }));
        }
        return this.props.children;
    }
}
