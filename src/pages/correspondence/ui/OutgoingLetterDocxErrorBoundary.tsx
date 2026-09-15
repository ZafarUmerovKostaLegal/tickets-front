import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
    children: ReactNode;
    fallback: ReactNode;
    onError?: (error: Error) => void;
};

type State = {
    hasError: boolean;
};

/** Isolates DocxEditor crashes so the compose page can fall back to .docx upload. */
export class OutgoingLetterDocxErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, _info: ErrorInfo): void {
        this.props.onError?.(error);
    }

    render(): ReactNode {
        if (this.state.hasError)
            return this.props.fallback;
        return this.props.children;
    }
}
