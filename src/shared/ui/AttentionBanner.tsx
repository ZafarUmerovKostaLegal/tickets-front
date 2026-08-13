import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './AttentionBanner.css';

export type AttentionBannerProps = {
    text: string;
    actionLabel: string;
    onAction?: () => void;
    to?: string;
    tone?: 'alert' | 'info';
    className?: string;
};

function AttentionIcon({ tone }: { tone: 'alert' | 'info' }) {
    if (tone === 'info') {
        return (
            <svg className="app-attention__icon" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                    d="M10 1.75a8.25 8.25 0 1 1 0 16.5 8.25 8.25 0 0 1 0-16.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                />
                <path d="M10 9v4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
            </svg>
        );
    }
    return (
        <svg className="app-attention__icon" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
                d="M10 2.25a5.75 5.75 0 0 0-5.75 5.75v1.42c0 .52-.17 1.03-.48 1.45L2.7 12.4A1.35 1.35 0 0 0 3.8 14.5h12.4a1.35 1.35 0 0 0 1.1-2.1l-1.07-1.53c-.31-.42-.48-.93-.48-1.45V8A5.75 5.75 0 0 0 10 2.25Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path d="M8.2 14.5a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function AttentionBanner({
    text,
    actionLabel,
    onAction,
    to,
    tone = 'alert',
    className,
}: AttentionBannerProps) {
    const action: ReactNode = to ? (
        <Link to={to} className="app-attention__action">
            {actionLabel}
        </Link>
    ) : (
        <button type="button" className="app-attention__action" onClick={onAction}>
            {actionLabel}
        </button>
    );
    return (
        <div
            className={['app-attention', tone === 'info' ? 'app-attention--info' : '', className]
                .filter(Boolean)
                .join(' ')}
            role="status"
        >
            <div className="app-attention__main">
                <span className="app-attention__icon-wrap" aria-hidden>
                    <AttentionIcon tone={tone} />
                </span>
                <p className="app-attention__text">{text}</p>
            </div>
            {action}
        </div>
    );
}

export function formatCountBadge(count: number): string {
    if (count <= 0)
        return '';
    if (count > 99)
        return '99+';
    return String(count);
}
