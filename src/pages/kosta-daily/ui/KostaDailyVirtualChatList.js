import { jsx as _jsx } from "react/jsx-runtime";
import {} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
export const VIRTUAL_CHAT_LIST_MIN = 32;
const OVERSCAN = 6;
const ESTIMATE_HEIGHT = 68;
export function KostaDailyVirtualChatList({ listRef, items, minItems = VIRTUAL_CHAT_LIST_MIN, className = 'kd-tg__chat-list', }) {
    const enabled = items.length >= minItems;
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => listRef.current,
        estimateSize: (index) => (items[index]?.kind === 'section' ? 36 : ESTIMATE_HEIGHT),
        overscan: OVERSCAN,
        enabled,
        getItemKey: (index) => items[index]?.id ?? index,
    });
    if (!enabled) {
        return (_jsx("ul", { className: className, ref: listRef, role: "list", children: items.map((item) => (item.kind === 'section'
                ? _jsx("li", { className: "kd-tg__chat-section", role: "presentation", children: item.label }, item.id)
                : _jsx("li", { role: "listitem", children: item.node }, item.id))) }));
    }
    const virtualRows = virtualizer.getVirtualItems();
    return (_jsx("ul", { className: className, ref: listRef, role: "list", style: { position: 'relative', height: virtualizer.getTotalSize() }, children: virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item)
                return null;
            if (item.kind === 'section') {
                return (_jsx("li", { className: "kd-tg__chat-section", role: "presentation", ref: virtualizer.measureElement, "data-index": virtualRow.index, style: {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                    }, children: item.label }, item.id));
            }
            return (_jsx("li", { role: "listitem", ref: virtualizer.measureElement, "data-index": virtualRow.index, style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                }, children: item.node }, item.id));
        }) }));
}
