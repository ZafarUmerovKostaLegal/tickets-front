import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { estimateTimesheetVirtualItemSize, TIMESHEET_VIRTUAL_MIN_ITEMS, } from './timesheetVirtualTypes';
const OVERSCAN = 8;
export function TimesheetVirtualList({ scrollRef, items, renderItem, minItems = TIMESHEET_VIRTUAL_MIN_ITEMS, }) {
    const enabled = items.length >= minItems;
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: (index) => estimateTimesheetVirtualItemSize(items[index]),
        overscan: OVERSCAN,
        enabled,
        getItemKey: (index) => items[index]?.id ?? index,
    });
    useLayoutEffect(() => {
        if (!enabled)
            return;
        const el = scrollRef.current;
        if (!el)
            return;
        const sync = () => virtualizer.measure();
        sync();
        if (typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, [enabled, items.length, scrollRef, virtualizer]);
    if (!enabled) {
        return (_jsx(_Fragment, { children: items.map((item, index) => (_jsx("div", { "data-virtual-index": index, children: renderItem(item, index) }, item.id))) }));
    }
    const virtualRows = virtualizer.getVirtualItems();
    return (_jsx("div", { className: "tsp__virtual-list", style: { height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }, children: virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item)
                return null;
            return (_jsx("div", { "data-index": virtualRow.index, ref: virtualizer.measureElement, className: "tsp__virtual-item", style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                }, children: renderItem(item, virtualRow.index) }, item.id));
        }) }));
}
