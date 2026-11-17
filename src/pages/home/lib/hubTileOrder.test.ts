/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import {
    hubTileOrderStorageKey,
    loadHubTileOrder,
    mergeHubTileOrder,
    reorderHubTileIds,
    reorderHubTilesInSection,
    saveHubTileOrder,
    type HubTileId,
} from './hubTileOrder';

const ids = (...xs: string[]) => xs as HubTileId[];

describe('hubTileOrder storage', () => {
    afterEach(() => window.localStorage.clear());

    it('uses a per-user storage key', () => {
        expect(hubTileOrderStorageKey(7)).toBe('home_hub_tile_order_v1:7');
    });

    it('round-trips the saved order', () => {
        saveHubTileOrder(7, ids('todo', 'expenses'));
        expect(loadHubTileOrder(7)).toEqual(['todo', 'expenses']);
        expect(loadHubTileOrder(8)).toBeNull();
    });

    it('ignores corrupted or non-array values', () => {
        window.localStorage.setItem(hubTileOrderStorageKey(1), '{oops');
        expect(loadHubTileOrder(1)).toBeNull();
        window.localStorage.setItem(hubTileOrderStorageKey(1), '{"a":1}');
        expect(loadHubTileOrder(1)).toBeNull();
        window.localStorage.setItem(hubTileOrderStorageKey(1), '["todo", 5, null, "expenses"]');
        expect(loadHubTileOrder(1)).toEqual(['todo', 'expenses']);
    });
});

describe('mergeHubTileOrder', () => {
    const tiles = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as unknown as { id: HubTileId }[];

    it('keeps the default order when nothing is saved', () => {
        expect(mergeHubTileOrder(tiles, null)).toBe(tiles);
        expect(mergeHubTileOrder(tiles, [])).toBe(tiles);
    });

    it('applies the saved order, drops unknown ids and appends new tiles', () => {
        const merged = mergeHubTileOrder(tiles, ids('c', 'zzz', 'a'));
        expect(merged.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    });
});

describe('reorderHubTileIds', () => {
    it('moves the dragged tile to the target position', () => {
        expect(reorderHubTileIds(ids('a', 'b', 'c', 'd'), ids('a')[0]!, ids('c')[0]!)).toEqual(['b', 'c', 'a', 'd']);
        expect(reorderHubTileIds(ids('a', 'b', 'c', 'd'), ids('d')[0]!, ids('b')[0]!)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('is a no-op for the same tile or unknown ids', () => {
        const order = ids('a', 'b');
        expect(reorderHubTileIds(order, order[0]!, order[0]!)).toBe(order);
        expect(reorderHubTileIds(order, ids('x')[0]!, order[0]!)).toBe(order);
    });

    it('reorders only inside a section, keeping other tiles in place', () => {
        const order = ids('a', 'x', 'b', 'y', 'c');
        const next = reorderHubTilesInSection(order, ids('a', 'b', 'c'), ids('c')[0]!, ids('a')[0]!);
        expect(next).toEqual(['c', 'x', 'a', 'y', 'b']);
    });
});
