import { type ReactNode, type RefObject, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    estimateTimesheetVirtualItemSize,
    TIMESHEET_VIRTUAL_MIN_ITEMS,
    type TimesheetVirtualItem,
} from './timesheetVirtualTypes';

const OVERSCAN = 8;

export type TimesheetVirtualListProps = {
    scrollRef: RefObject<HTMLElement | null>;
    items: TimesheetVirtualItem[];
    renderItem: (item: TimesheetVirtualItem, index: number) => ReactNode;
    minItems?: number;
};

export function TimesheetVirtualList({
    scrollRef,
    items,
    renderItem,
    minItems = TIMESHEET_VIRTUAL_MIN_ITEMS,
}: TimesheetVirtualListProps) {
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
        return (
            <>
                {items.map((item, index) => (
                    <div key={item.id} data-virtual-index={index}>
                        {renderItem(item, index)}
                    </div>
                ))}
            </>
        );
    }

    const virtualRows = virtualizer.getVirtualItems();

    return (
        <div
            className="tsp__virtual-list"
            style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
        >
            {virtualRows.map((virtualRow) => {
                const item = items[virtualRow.index];
                if (!item)
                    return null;
                return (
                    <div
                        key={item.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className="tsp__virtual-item"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        {renderItem(item, virtualRow.index)}
                    </div>
                );
            })}
        </div>
    );
}
