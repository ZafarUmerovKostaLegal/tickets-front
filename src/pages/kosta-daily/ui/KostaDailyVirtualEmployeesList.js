import { jsx as _jsx } from "react/jsx-runtime";
import {} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
export const VIRTUAL_EMPLOYEES_LIST_MIN = 48;
const OVERSCAN = 8;
const ESTIMATE_HEIGHT = 72;
export function KostaDailyVirtualEmployeesList({ listRef, items, minItems = VIRTUAL_EMPLOYEES_LIST_MIN, className = 'kd-tg__members-list', }) {
    const enabled = items.length >= minItems;
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => listRef.current,
        estimateSize: () => ESTIMATE_HEIGHT,
        overscan: OVERSCAN,
        enabled,
        getItemKey: (index) => items[index]?.id ?? index,
    });
    if (!enabled) {
        return (_jsx("ul", { className: className, ref: listRef, role: "list", children: items.map((item) => (_jsx("li", { role: "listitem", children: item.node }, item.id))) }));
    }
    const virtualRows = virtualizer.getVirtualItems();
    return (_jsx("ul", { className: className, ref: listRef, role: "list", style: { position: 'relative', height: virtualizer.getTotalSize() }, children: virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item)
                return null;
            return (_jsx("li", { role: "listitem", ref: virtualizer.measureElement, "data-index": virtualRow.index, style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                }, children: item.node }, item.id));
        }) }));
}
