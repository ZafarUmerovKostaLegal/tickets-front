import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
export const VIRTUAL_TABLE_MIN_ROWS = 12;
const VIRTUAL_TABLE_OVERSCAN = 18;
export function VirtualizedTableRows({ scrollRef, rowCount, colSpan, estimateRowHeight, renderRow, minRows = VIRTUAL_TABLE_MIN_ROWS, }) {
    const enabled = rowCount >= minRows;
    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => estimateRowHeight,
        overscan: VIRTUAL_TABLE_OVERSCAN,
        enabled,
    });
    useLayoutEffect(() => {
        if (!enabled)
            return;
        const el = scrollRef.current;
        if (!el)
            return;
        const sync = () => {
            virtualizer.measure();
        };
        sync();
        if (typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, [enabled, rowCount, estimateRowHeight, scrollRef, virtualizer]);
    const noopRef = () => { };
    if (!enabled) {
        return (_jsx(_Fragment, { children: Array.from({ length: rowCount }, (_, index) => renderRow(index, {
                ref: noopRef,
                'data-index': index,
            })) }));
    }
    const virtualItems = virtualizer.getVirtualItems();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0
        ? Math.max(0, virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end) + 48
        : 48;
    return (_jsxs(_Fragment, { children: [paddingTop > 0 ? (_jsx("tr", { className: "tt-rp-mtable__virtual-spacer", "aria-hidden": true, children: _jsx("td", { colSpan: colSpan, style: { height: paddingTop, padding: 0, border: 'none', lineHeight: 0 } }) })) : null, virtualItems.map((virtualRow) => renderRow(virtualRow.index, {
                ref: virtualizer.measureElement,
                'data-index': virtualRow.index,
            })), paddingBottom > 0 ? (_jsx("tr", { className: "tt-rp-mtable__virtual-spacer", "aria-hidden": true, children: _jsx("td", { colSpan: colSpan, style: { height: paddingBottom, padding: 0, border: 'none', lineHeight: 0 } }) })) : null] }));
}
