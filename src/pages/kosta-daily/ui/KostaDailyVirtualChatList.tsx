import { type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export const VIRTUAL_CHAT_LIST_MIN = 32;
const OVERSCAN = 6;
const ESTIMATE_HEIGHT = 68;

export type KostaDailyChatListItem =
    | { kind: 'section'; id: string; label: string }
    | { kind: 'chat'; id: string; node: ReactNode };

type KostaDailyVirtualChatListProps = {
    listRef: RefObject<HTMLUListElement | null>;
    items: KostaDailyChatListItem[];
    minItems?: number;
    className?: string;
};

export function KostaDailyVirtualChatList({
    listRef,
    items,
    minItems = VIRTUAL_CHAT_LIST_MIN,
    className = 'kd-tg__chat-list',
}: KostaDailyVirtualChatListProps) {
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
        return (
            <ul className={className} ref={listRef} role="list">
                {items.map((item) => (
                    item.kind === 'section'
                        ? <li key={item.id} className="kd-tg__chat-section" role="presentation">{item.label}</li>
                        : <li key={item.id} role="listitem">{item.node}</li>
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
                if (item.kind === 'section') {
                    return (
                        <li
                            key={item.id}
                            className="kd-tg__chat-section"
                            role="presentation"
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
                            {item.label}
                        </li>
                    );
                }
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
