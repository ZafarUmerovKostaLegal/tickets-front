import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { filesApi } from '../api/filesApi';
import { Icon, StateBlock, useFm, useLoad } from './fmShared';
import { PeopleTab } from './SecurityWorkspace';
import './SecurityWorkspace.css';
import './MatterAccessPopover.css';

type Props = {
    matterId: string;
    anchor: HTMLElement;
    onClose: () => void;
    onChanged: () => void;
};

const WIDTH = 780;
const GAP = 8;

function place(anchor: HTMLElement): CSSProperties {
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw <= 640)
        return {};
    const width = Math.min(WIDTH, vw - 32);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), vw - width - 16);
    const below = vh - rect.bottom - GAP - 16;
    const above = rect.top - GAP - 16;
    if (below >= 360 || below >= above)
        return { left, top: rect.bottom + GAP, width, maxHeight: Math.max(240, below) };
    return { left, bottom: vh - rect.top + GAP, width, maxHeight: Math.max(240, above) };
}

export function MatterAccessPopover({ matterId, anchor, onClose, onChanged }: Props) {
    const { tr } = useFm();
    const security = useLoad(() => filesApi.security(matterId), [matterId]);
    const [style, setStyle] = useState<CSSProperties>(() => place(anchor));
    const card = useRef<HTMLDivElement | null>(null);
    const data = security.data && security.data.matter.id === matterId ? security.data : null;

    useLayoutEffect(() => {
        const update = () => setStyle(place(anchor));
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [anchor]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !document.querySelector('.fm-modal'))
                onClose();
        };
        window.addEventListener('keydown', onKey);
        card.current?.focus();
        return () => {
            window.removeEventListener('keydown', onKey);
            anchor.focus();
        };
    }, [onClose, anchor]);

    return createPortal(
        <div className="fm-mxpop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget)
                onClose();
        }}>
            <div ref={card} className="fm-mxpop__card" role="dialog" aria-modal="false" aria-label={tr('securityX.popTitle')} tabIndex={-1} style={style}>
                <header className="fm-mxpop__head">
                    <span className="fm-mxpop__ico" aria-hidden><Icon name="key" /></span>
                    <div>
                        <h3>{tr('securityX.popTitle')}</h3>
                        <p title={data?.matter.name}>
                            {data ? `${data.matter.code ? `${data.matter.code} · ` : ''}${data.matter.name}` : '…'}
                        </p>
                    </div>
                    <button type="button" className="fm-icon-btn" aria-label={tr('common.close')} onClick={onClose}><Icon name="close" /></button>
                </header>
                <div className="fm-mxpop__body">
                    <StateBlock loading={security.loading && !data} error={security.error} onRetry={security.reload}>
                        {data ? (
                            <div className="fm-sx fm-mxpop__sx">
                                <PeopleTab data={data} onReload={() => {
                                    security.reload();
                                    onChanged();
                                }} />
                            </div>
                        ) : null}
                    </StateBlock>
                </div>
            </div>
        </div>,
        document.body,
    );
}
