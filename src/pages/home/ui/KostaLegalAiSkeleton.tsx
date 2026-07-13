import { useI18n } from '@shared/i18n';

type KostaLegalAiSkeletonProps = {
    collapsed: boolean;
};

function Skel({ className }: { className: string }) {
    return <span className={`kl-ai-skel ${className}`} aria-hidden />;
}

export function KostaLegalAiSkeleton({ collapsed }: KostaLegalAiSkeletonProps) {
    const { t } = useI18n();

    return (
        <div
            className="kl-ai__layout kl-ai__layout--skeleton"
            aria-busy="true"
            aria-live="polite"
            aria-label={t('common.loading')}
        >
            <aside className={`kl-ai-sidebar kl-ai-sidebar--skeleton${collapsed ? ' kl-ai-sidebar--collapsed' : ''}`}>
                <div className="kl-ai-sidebar__head">
                    <Skel className="kl-ai-skel--brand" />
                    <Skel className="kl-ai-skel--collapse" />
                </div>
                <nav className="kl-ai-sidebar__nav">
                    <ul className="kl-ai-sidebar__list">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <li key={`tool-${i}`} className="kl-ai-sidebar__skel-row">
                                <Skel className="kl-ai-skel--nav-icon" />
                                {!collapsed ? <Skel className={`kl-ai-skel--nav-label kl-ai-skel--nav-label-${i % 3}`} /> : null}
                            </li>
                        ))}
                    </ul>
                    <div className="kl-ai-sidebar__divider kl-ai-skel--divider" aria-hidden />
                    <ul className="kl-ai-sidebar__list">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <li key={`folder-${i}`} className="kl-ai-sidebar__skel-row">
                                <Skel className="kl-ai-skel--nav-icon" />
                                {!collapsed ? <Skel className={`kl-ai-skel--nav-label kl-ai-skel--nav-label-${(i + 1) % 3}`} /> : null}
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="kl-ai-sidebar__foot">
                    <Skel className="kl-ai-skel--new-chat" />
                </div>
            </aside>

            <div className="kl-ai__shell">
                <main className="kl-ai__main">
                    <div className="kl-ai__workspace kl-ai__workspace--skeleton">
                        <div className="kl-ai__hero kl-ai__hero--skeleton">
                            <Skel className="kl-ai-skel--hero-title" />
                            <div className="kl-ai-skel--composer">
                                <Skel className="kl-ai-skel--composer-input" />
                                <div className="kl-ai-skel--composer-toolbar">
                                    <div className="kl-ai-skel--composer-tools">
                                        <Skel className="kl-ai-skel--tool-btn" />
                                        <Skel className="kl-ai-skel--tool-btn" />
                                        <Skel className="kl-ai-skel--filter" />
                                        <Skel className="kl-ai-skel--filter kl-ai-skel--filter-short" />
                                    </div>
                                    <Skel className="kl-ai-skel--send" />
                                </div>
                            </div>
                        </div>

                        <section className="kl-ai__commands kl-ai__commands--skeleton" aria-hidden>
                            <Skel className="kl-ai-skel--section-title" />
                            <Skel className="kl-ai-skel--section-sub" />
                            <ul className="kl-ai__commands-grid">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <li key={i}>
                                        <div className="kl-ai-skel--command-card">
                                            <Skel className="kl-ai-skel--command-icon" />
                                            <Skel className="kl-ai-skel--command-title" />
                                            <Skel className="kl-ai-skel--command-line" />
                                            <Skel className="kl-ai-skel--command-line kl-ai-skel--command-line-short" />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
