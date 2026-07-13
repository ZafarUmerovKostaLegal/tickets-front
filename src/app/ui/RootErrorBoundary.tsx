import { Component, type ErrorInfo, type ReactNode } from 'react';

type RootErrorBoundaryProps = {
    children: ReactNode;
};

type RootErrorBoundaryState = {
    error: Error | null;
};

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
    state: RootErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[app] render error', error, info.componentStack);
    }

    render() {
        const { error } = this.state;
        if (error) {
            return (
                <div
                    role="alert"
                    style={{
                        minHeight: '100vh',
                        padding: '1.5rem',
                        boxSizing: 'border-box',
                        fontFamily: "'Montserrat', system-ui, sans-serif",
                        background: '#fef2f2',
                        color: '#7f1d1d',
                    }}
                >
                    <h1 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Ошибка запуска</h1>
                    <pre
                        style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '0.8rem',
                            lineHeight: 1.45,
                        }}
                    >
                        {error.message}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}
