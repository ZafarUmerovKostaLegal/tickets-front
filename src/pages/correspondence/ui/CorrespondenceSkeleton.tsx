import type { CSSProperties } from 'react';

const SKEL_LIST_ROWS = 6;
const SKEL_INBOX_ROWS = 4;

function Shimmer({ className = '', style }: { className?: string; style?: CSSProperties }) {
    return <span className={`corr-skel__bone${className ? ` ${className}` : ''}`} style={style} />;
}

export function CorrespondenceHeaderTitleSkeleton({ compact = false }: { compact?: boolean }) {
    return (<div className="corr-skel__header-text" aria-hidden>
        <span className="corr-skel__bone corr-skel__header-h1" style={compact ? { width: '180px', maxWidth: '40%' } : undefined} />
        {!compact && <span className="corr-skel__bone corr-skel__header-p" />}
    </div>);
}


export function CorrespondenceHubSkeleton() {
    return <CorrespondenceListSkeleton />;
}


export function CorrespondenceListSkeleton() {
    return (<div className="corr-skel corr-skel--list" aria-busy="true" aria-label="Загрузка списка">
        <div className="corr-skel__tabs-row" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (<Shimmer key={i} className="corr-skel__tab-pill" style={{ width: `${64 + i * 6}px` }} />))}
        </div>
        <div className="corr-skel__list" aria-hidden>
            {Array.from({ length: SKEL_LIST_ROWS }).map((_, row) => (<div key={row} className="corr-skel__list-item">
                <div className="corr-skel__list-start">
                    <Shimmer className="corr-skel__list-num" />
                    <div className="corr-skel__list-main">
                        <Shimmer className="corr-skel__list-subject" style={{ width: `${55 + (row % 3) * 12}%` }} />
                        <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '38%' }} />
                    </div>
                </div>
                <div className="corr-skel__list-end">
                    <Shimmer className="corr-skel__badge" />
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '72px' }} />
                </div>
            </div>))}
        </div>
    </div>);
}


export function CorrespondenceComposeSkeleton() {
    return (<div className="corr-skel corr-skel--compose" aria-busy="true" aria-label="Загрузка формы">
        <div className="corr-skel__compose-paper" aria-hidden>
            {Array.from({ length: 2 }).map((_, i) => (<div key={i} className="corr-skel__field">
                <Shimmer className="corr-skel__field-label" />
                <Shimmer className="corr-skel__field-input" />
            </div>))}
            <div className="corr-skel__field">
                <Shimmer className="corr-skel__field-label" />
                <Shimmer className="corr-skel__field-textarea" />
            </div>
            <div className="corr-skel__field">
                <Shimmer className="corr-skel__field-label" />
                <Shimmer className="corr-skel__field-btn" />
            </div>
        </div>
    </div>);
}


export function CorrespondencePreviewSkeleton() {
    return (<div className="corr-skel corr-skel--preview" aria-busy="true" aria-label="Загрузка документа">
        <Shimmer className="corr-skel__banner" />
        <div className="corr-skel__doc" aria-hidden>
            <div className="corr-skel__doc-head">
                <div className="corr-skel__doc-logo">
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--lg" style={{ width: '120px' }} />
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '90px' }} />
                </div>
                <div className="corr-skel__doc-meta">
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '100px' }} />
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '80px' }} />
                </div>
            </div>
            <Shimmer className="corr-skel__doc-hr" />
            <Shimmer className="corr-skel__stat-line corr-skel__stat-line--md" style={{ width: '45%' }} />
            <Shimmer className="corr-skel__stat-line corr-skel__stat-line--lg" style={{ width: '70%', marginTop: '1.25rem' }} />
            {Array.from({ length: 5 }).map((_, i) => (<Shimmer key={i} className="corr-skel__doc-line" style={{ width: `${88 - (i % 3) * 8}%` }} />))}
            <Shimmer className="corr-skel__doc-line" style={{ width: '52%' }} />
        </div>
    </div>);
}


export function CorrespondenceInboxSkeleton() {
    return (<div className="corr-skel corr-skel--inbox" aria-busy="true" aria-label="Загрузка входящих">
        <div className="corr-skel__inbox-list" aria-hidden>
            {Array.from({ length: SKEL_INBOX_ROWS }).map((_, row) => (<div key={row} className="corr-skel__inbox-item">
                <Shimmer className="corr-skel__inbox-dot" />
                <div className="corr-skel__inbox-body">
                    <div className="corr-skel__inbox-row1">
                        <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '72px' }} />
                        <Shimmer className="corr-skel__badge corr-skel__badge--sm" />
                    </div>
                    <Shimmer className="corr-skel__list-subject" style={{ width: `${60 + (row % 2) * 15}%` }} />
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '48%' }} />
                </div>
                <Shimmer className="corr-skel__badge" />
            </div>))}
        </div>
    </div>);
}


export const CorrespondenceMainSkeleton = CorrespondenceHubSkeleton;


export function CorrespondenceRegistrySkeleton({ rows = 6 }: { rows?: number }) {
    return (<div className="corr-skel corr-skel--registry" aria-busy="true" aria-label="Загрузка реестра">
        <div className="corr-skel__stats" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="corr-skel__stat">
                <Shimmer className="corr-skel__stat-icon" />
                <div className="corr-skel__stat-text">
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" />
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--lg" />
                    <Shimmer className="corr-skel__stat-line corr-skel__stat-line--sm" style={{ width: '40%' }} />
                </div>
            </div>))}
        </div>
        <div className="corr-skel__table-card" aria-hidden>
            <div className="corr-skel__toolbar">
                <div className="corr-skel__tabs">
                    {Array.from({ length: 4 }).map((_, i) => (<Shimmer key={i} className="corr-skel__tab" style={{ width: `${56 + i * 8}px` }} />))}
                </div>
                <div className="corr-skel__toolbar-actions">
                    <Shimmer className="corr-skel__btn" />
                    <Shimmer className="corr-skel__icon-btn" />
                </div>
            </div>
            <div className="corr-skel__table-wrap">
                <div className="corr-skel__thead">
                    {['48px', '88px', '72px', '1fr', '56px', '64px', '72px', '56px', '24px'].map((w, i) => (
                        <Shimmer key={i} className={`corr-skel__th${w === '1fr' ? ' corr-skel__th--grow' : ''}`} style={w !== '1fr' ? { width: w } : undefined} />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, row) => (<div key={row} className="corr-skel__tr">
                    <Shimmer className="corr-skel__td" style={{ width: '72px' }} />
                    <Shimmer className="corr-skel__td" style={{ width: '88px' }} />
                    <Shimmer className="corr-skel__td" style={{ width: '80px' }} />
                    <Shimmer className="corr-skel__td corr-skel__td--subject" style={{ width: `${45 + (row % 3) * 12}%` }} />
                    <Shimmer className="corr-skel__td" style={{ width: '52px' }} />
                    <Shimmer className="corr-skel__td" style={{ width: '28px' }} />
                    <Shimmer className="corr-skel__td" style={{ width: '96px' }} />
                    <Shimmer className="corr-skel__td" style={{ width: '72px' }} />
                    <Shimmer className="corr-skel__td" style={{ width: '56px' }} />
                    <Shimmer className="corr-skel__td" style={{ width: '20px' }} />
                </div>))}
            </div>
            <div className="corr-skel__footer">
                <Shimmer className="corr-skel__footer-meta" />
                <div className="corr-skel__pager">
                    <Shimmer className="corr-skel__page-arrow" />
                    <Shimmer className="corr-skel__page-num" />
                    <Shimmer className="corr-skel__page-arrow" />
                </div>
            </div>
        </div>
    </div>);
}


export function CorrespondenceRegistrySkeletonLegacy() {
    return <CorrespondenceListSkeleton />;
}

export function CorrespondenceAsideSkeleton() {
    return (<div className="corr-skel corr-skel--aside" aria-hidden>
        <Shimmer className="corr-skel__aside-title" />
        <Shimmer className="corr-skel__aside-btn corr-skel__aside-btn--primary" />
        <Shimmer className="corr-skel__aside-btn" />
    </div>);
}

export type CorrespondenceScreenKind = 'incoming' | 'outgoing' | 'compose' | 'preview' | 'partner-review';

export function CorrespondenceScreenSkeleton({ kind }: { kind: CorrespondenceScreenKind }) {
    switch (kind) {
        case 'incoming':
        case 'outgoing':
            return null;
        case 'compose':
            return <CorrespondenceComposeSkeleton />;
        case 'preview':
        case 'partner-review':
            return <CorrespondencePreviewSkeleton />;
    }
}
