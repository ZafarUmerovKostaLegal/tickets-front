import type { ReactNode } from 'react';

type Props = {
    title: string;
    detailHint?: string;
    wide?: boolean;
    fullWidth?: boolean;
    children: ReactNode;
};

export function StatisticsWidgetCard({ title, detailHint, wide, fullWidth, children }: Props) {
    return (
        <article className={`tt-statistics__widget${wide ? ' tt-statistics__widget--wide' : ''}${fullWidth ? ' tt-statistics__widget--full' : ''}`}>
            <div className="tt-statistics__widget-head">
                <h3 className="tt-statistics__widget-title">{title}</h3>
            </div>
            {detailHint ? (
                <p className="tt-statistics__widget-detail-hint">{detailHint}</p>
            ) : null}
            <div className="tt-statistics__widget-body">{children}</div>
        </article>
    );
}
