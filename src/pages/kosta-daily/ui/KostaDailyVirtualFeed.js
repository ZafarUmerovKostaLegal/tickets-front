import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
export const VIRTUAL_CHAT_MIN_BLOCKS = 24;
const VIRTUAL_CHAT_OVERSCAN = 8;
const VIRTUAL_CHAT_ESTIMATE_HEIGHT = 72;
export const KostaDailyVirtualFeed = forwardRef(function KostaDailyVirtualFeed({ blocks, scrollRef, innerRef, renderBlock, minBlocks = VIRTUAL_CHAT_MIN_BLOCKS }, ref) {
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
            if (el) {
                const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
                if (dist <= 2)
                    return;
            }
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
        return (_jsx("div", { className: "kd-tg__messages", ref: innerRef, children: blocks.map((block, index) => (_jsx("div", { "data-block-id": block.id, style: { contentVisibility: 'auto', containIntrinsicSize: 'auto 72px' }, children: renderBlock(block, index) }, block.id))) }));
    }
    const virtualItems = virtualizer.getVirtualItems();
    return (_jsx("div", { className: "kd-tg__messages kd-tg__messages--virtual", ref: innerRef, style: { height: virtualizer.getTotalSize(), position: 'relative' }, children: virtualItems.map((virtualRow) => {
            const block = blocks[virtualRow.index];
            if (!block)
                return null;
            return (_jsx("div", { "data-index": virtualRow.index, "data-block-id": block.id, ref: virtualizer.measureElement, className: "kd-tg__messages-virtual-item", style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    contain: 'layout style',
                }, children: renderBlock(block, virtualRow.index) }, block.id));
        }) }));
});
