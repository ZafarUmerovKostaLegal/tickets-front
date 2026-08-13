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
            <p className="app-attention__text">{text}</p>
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
