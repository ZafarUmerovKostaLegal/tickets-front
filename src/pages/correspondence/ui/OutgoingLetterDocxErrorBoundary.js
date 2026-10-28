import { Component } from 'react';
/** Isolates DocxEditor crashes so the compose page can fall back to .docx upload. */
export class OutgoingLetterDocxErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, _info) {
        this.props.onError?.(error);
    }
    render() {
        if (this.state.hasError)
            return this.props.fallback;
        return this.props.children;
    }
}
