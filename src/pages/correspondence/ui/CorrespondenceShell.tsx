import type { ReactNode } from 'react';
import { AppBackButton, AppPageSettings } from '@shared/ui';
import './CorrespondenceShell.css';
import '@shared/ui/AttentionBanner.css';

export type CorrespondenceNavTab = {
    id: string;
    label: string;
    active?: boolean;
    onClick?: () => void;
    badge?: string;
};

type CorrespondenceShellProps = {
    activeTab: string;
    tabs?: CorrespondenceNavTab[];
    onBack?: () => void;
    actions?: ReactNode;
    children?: ReactNode;
    contentClassName?: string;
    fullHeight?: boolean;
};

function IconSeal() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M12 2L4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    );
}

export function CorrespondenceShell({
    activeTab,
    tabs,
    onBack,
    actions,
    children,
    contentClassName,
    fullHeight = false,
}: CorrespondenceShellProps) {
    const navTabs = tabs ?? [{ id: activeTab, label: activeTab, active: true }];

    return (
        <div className={`corr-shell${fullHeight ? ' corr-shell--full' : ''}`}>
            <header className="corr-shell__header">
                <div className="corr-shell__header-inner">
                    <AppBackButton className="corr-shell__back" onClick={onBack} hideLabelOnMobile />
                    <span className="corr-shell__seal" aria-hidden>
                        <IconSeal />
                    </span>
                    <h1 className="corr-shell__title">Корреспонденция</h1>
                    <nav className="corr-shell__tabs" role="tablist" aria-label="Раздел корреспонденции">
                        {navTabs.map((tab) => {
                            const isActive = tab.active ?? tab.label === activeTab;
                            if (tab.onClick) {
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`corr-shell__tab${isActive ? ' corr-shell__tab--active' : ''}`}
                                        onClick={tab.onClick}
                                    >
                                        <span className="corr-shell__tab-inner">
                                            {tab.label}
                                            {tab.badge ? (
                                                <span className="app-count-badge" aria-hidden>{tab.badge}</span>
                                            ) : null}
                                        </span>
                                    </button>
                                );
                            }
                            return (
                                <span
                                    key={tab.id}
                                    className={`corr-shell__tab${isActive ? ' corr-shell__tab--active' : ''}`}
                                    role="tab"
                                    aria-selected={isActive}
                                    tabIndex={-1}
                                >
                                    {tab.label}
                                </span>
                            );
                        })}
                    </nav>
                    <div className="corr-shell__header-spacer" aria-hidden />
                    {actions ? (
                        <div className="corr-shell__actions" role="group" aria-label="Действия">
                            {actions}
                        </div>
                    ) : null}
                    <div className="corr-shell__settings">
                        <AppPageSettings />
                    </div>
                </div>
            </header>
            <main className="corr-shell__main">
                <div className={[
                    'corr-shell__content',
                    children ? '' : ' corr-shell__content--empty',
                    contentClassName,
                ].filter(Boolean).join('')}>
                    {children}
                </div>
            </main>
        </div>
    );
}
