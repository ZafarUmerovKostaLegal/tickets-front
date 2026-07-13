import { forwardRef, useImperativeHandle, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { RenderBlock } from '@entities/chat';

export const VIRTUAL_CHAT_MIN_BLOCKS = 24;
const VIRTUAL_CHAT_OVERSCAN = 8;
const VIRTUAL_CHAT_ESTIMATE_HEIGHT = 72;

export type KostaDailyVirtualFeedHandle = {
    scrollToBottom: (behavior?: ScrollBehavior) => void;
    scrollToBlockId: (blockId: string, behavior?: ScrollBehavior) => void;
};

type KostaDailyVirtualFeedProps = {
    blocks: RenderBlock[];
    scrollRef: RefObject<HTMLDivElement | null>;
    innerRef?: RefObject<HTMLDivElement | null>;
    renderBlock: (block: RenderBlock, index: number) => ReactNode;
    minBlocks?: number;
};

export const KostaDailyVirtualFeed = forwardRef<KostaDailyVirtualFeedHandle, KostaDailyVirtualFeedProps>(
    function KostaDailyVirtualFeed({ blocks, scrollRef, innerRef, renderBlock, minBlocks = VIRTUAL_CHAT_MIN_BLOCKS }, ref) {
        const virtualEnabled = blocks.length >= minBlocks;
        const virtualizer = useVirtualizer({
            count: blocks.length,
            getScrollElement: () => scrollRef.current,
            estimateSize: () => VIRTUAL_CHAT_ESTIMATE_HEIGHT,
            overscan: VIRTUAL_CHAT_OVERSCAN,
            enabled: virtualEnabled,
            getItemKey: (index) => blocks[index]?.id ?? index,
        });

        useImperativeHandle(ref, () => ({
            scrollToBottom(behavior = 'auto') {
                if (blocks.length === 0)
                    return;
                const el = scrollRef.current;
                if (!virtualEnabled) {
                    if (el)
                        el.scrollTo({ top: el.scrollHeight, behavior });
                    return;
                }
                virtualizer.scrollToIndex(blocks.length - 1, { align: 'end', behavior });
                requestAnimationFrame(() => {
                    if (el)
                        el.scrollTop = el.scrollHeight;
                });
            },
            scrollToBlockId(blockId, behavior = 'smooth') {
                const index = blocks.findIndex((b) => b.id === blockId);
                if (index < 0)
                    return;
                if (!virtualEnabled) {
                    const el = scrollRef.current?.querySelector(`[data-block-id="${blockId}"]`);
                    if (el instanceof HTMLElement)
                        el.scrollIntoView({ block: 'center', behavior });
                    return;
                }
                virtualizer.scrollToIndex(index, { align: 'center', behavior });
            },
        }), [blocks, virtualEnabled, scrollRef, virtualizer]);

        if (!virtualEnabled) {
            return (
                <div className="kd-tg__messages" ref={innerRef} role="log" aria-live="polite">
                    {blocks.map((block, index) => (
                        <div key={block.id} data-block-id={block.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 72px' }}>
                            {renderBlock(block, index)}
                        </div>
                    ))}
                </div>
            );
        }

        const virtualItems = virtualizer.getVirtualItems();
        return (
            <div
                className="kd-tg__messages kd-tg__messages--virtual"
                ref={innerRef}
                role="log"
                aria-live="polite"
                style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
            >
                {virtualItems.map((virtualRow) => {
                    const block = blocks[virtualRow.index];
                    if (!block)
                        return null;
                    return (
                        <div
                            key={block.id}
                            data-index={virtualRow.index}
                            data-block-id={block.id}
                            ref={virtualizer.measureElement}
                            className="kd-tg__messages-virtual-item"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                                contain: 'layout style',
                            }}
                        >
                            {renderBlock(block, virtualRow.index)}
                        </div>
                    );
                })}
            </div>
        );
    },
);
