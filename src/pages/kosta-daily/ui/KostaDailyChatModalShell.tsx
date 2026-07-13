import type { ReactNode } from 'react';

export type KostaDailyChatModalShellProps = {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    ariaLabel?: string;
};

function IconClose() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

export function KostaDailyChatModalShell({
    open,
    title,
    onClose,
    children,
    footer,
    className,
    ariaLabel,
}: KostaDailyChatModalShellProps) {
    if (!open)
        return null;

    return (
        <div className="kd-tg__modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className={`kd-tg__modal${className ? ` ${className}` : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel ?? title}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="kd-tg__modal-head">
                    <h2 className="kd-tg__modal-title">{title}</h2>
                    <button
                        type="button"
                        className="kd-tg__modal-close"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <IconClose />
                    </button>
                </header>
                <div className="kd-tg__modal-body">
                    {children}
                </div>
                {footer ? (
                    <footer className="kd-tg__modal-foot">
                        {footer}
                    </footer>
                ) : null}
            </div>
        </div>
    );
}
