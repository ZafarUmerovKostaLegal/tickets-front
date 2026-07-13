import { type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export const VIRTUAL_EMPLOYEES_LIST_MIN = 48;
const OVERSCAN = 8;
const ESTIMATE_HEIGHT = 72;

export type KostaDailyEmployeeListItem = {
    id: number;
    node: ReactNode;
};

type KostaDailyVirtualEmployeesListProps = {
    listRef: RefObject<HTMLUListElement | null>;
    items: KostaDailyEmployeeListItem[];
    minItems?: number;
    className?: string;
};

export function KostaDailyVirtualEmployeesList({
    listRef,
    items,
    minItems = VIRTUAL_EMPLOYEES_LIST_MIN,
    className = 'kd-tg__members-list',
}: KostaDailyVirtualEmployeesListProps) {
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
        return (
            <ul className={className} ref={listRef} role="list">
                {items.map((item) => (
                    <li key={item.id} role="listitem">{item.node}</li>
                ))}
            </ul>
        );
    }

    const virtualRows = virtualizer.getVirtualItems();
    return (
        <ul
            className={className}
            ref={listRef}
            role="list"
            style={{ position: 'relative', height: virtualizer.getTotalSize() }}
        >
            {virtualRows.map((virtualRow) => {
                const item = items[virtualRow.index];
                if (!item)
                    return null;
                return (
                    <li
                        key={item.id}
                        role="listitem"
                        ref={virtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        {item.node}
                    </li>
                );
            })}
        </ul>
    );
}
