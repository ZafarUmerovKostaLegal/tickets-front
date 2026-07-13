import type { AppNavId } from '@widgets/sidebar/model/appNavConfig';

export type HubTileId = AppNavId | 'kostaLegalAi';

const STORAGE_PREFIX = 'home_hub_tile_order_v1';

export function hubTileOrderStorageKey(userId: number): string {
    return `${STORAGE_PREFIX}:${userId}`;
}

export function loadHubTileOrder(userId: number): HubTileId[] | null {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = window.localStorage.getItem(hubTileOrderStorageKey(userId));
        if (!raw)
            return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed))
            return null;
        return parsed.filter((x): x is HubTileId => typeof x === 'string');
    }
    catch {
        return null;
    }
}

export function saveHubTileOrder(userId: number, order: HubTileId[]): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(hubTileOrderStorageKey(userId), JSON.stringify(order));
    }
    catch {

    }
}

export function mergeHubTileOrder<T extends { id: HubTileId }>(
    tiles: T[],
    savedIds: HubTileId[] | null,
): T[] {
    if (!savedIds?.length)
        return tiles;
    const byId = new Map(tiles.map((t) => [t.id, t]));
    const ordered: T[] = [];
    for (const id of savedIds) {
        const tile = byId.get(id);
        if (tile) {
            ordered.push(tile);
            byId.delete(id);
        }
    }
    for (const tile of byId.values())
        ordered.push(tile);
    return ordered;
}

export function reorderHubTileIds(order: HubTileId[], dragId: HubTileId, targetId: HubTileId): HubTileId[] {
    if (dragId === targetId)
        return order;
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0)
        return order;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    return next;
}

export function reorderHubTilesInSection(
    order: HubTileId[],
    sectionTileIds: readonly HubTileId[],
    dragId: HubTileId,
    targetId: HubTileId,
): HubTileId[] {
    const sectionSet = new Set(sectionTileIds);
    const sectionOrder = order.filter((id) => sectionSet.has(id));
    const nextSectionOrder = reorderHubTileIds(sectionOrder, dragId, targetId);
    let sectionIndex = 0;
    return order.map((id) => (sectionSet.has(id) ? nextSectionOrder[sectionIndex++]! : id));
}
