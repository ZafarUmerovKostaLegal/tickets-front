const SKELETON_ROWS = 6;

export function PartnerReportsListLoading({ label, columns = 6 }: {
    label: string;
    columns?: number;
}) {
    return (
        <div className="tt-partner-confirmed__loading" role="status" aria-live="polite" aria-busy="true">
            <div className="tt-partner-confirmed__loading-banner">
                <svg className="tt-partner-confirmed__loading-spinner" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" opacity="0.22" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <span className="tt-partner-confirmed__loading-label">{label}</span>
            </div>
            <div className="tt-partner-confirmed__skel" aria-hidden>
                <div className="tt-partner-confirmed__skel-head" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                    {Array.from({ length: columns }, (_, i) => (
                        <span key={`h-${i}`} className="tt-partner-confirmed__skel-th" />
                    ))}
                </div>
                {Array.from({ length: SKELETON_ROWS }, (_, row) => (
                    <div key={`r-${row}`} className="tt-partner-confirmed__skel-row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {Array.from({ length: columns }, (_, col) => (
                            <span
                                key={`c-${row}-${col}`}
                                className={`tt-partner-confirmed__skel-cell${col === 0 ? ' tt-partner-confirmed__skel-cell--wide' : ''}${col === columns - 1 ? ' tt-partner-confirmed__skel-cell--short' : ''}`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
