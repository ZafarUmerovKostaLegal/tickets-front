import { describe, expect, it } from 'vitest';
import {
    ancestorIds,
    buildFolderTree,
    canDrop,
    clickSelect,
    compareItems,
    invalidNameReason,
    itemKey,
    parentMap,
    parseItemKey,
    stepSelect,
    toSelection,
} from './diskExplorer';

const order = ['folder:a', 'folder:b', 'file:c', 'file:d', 'file:e'];

describe('clickSelect', () => {
    it('plain click selects one item', () => {
        const { selection, anchor } = clickSelect(new Set(['folder:a', 'file:c']), order, 'file:d', 'folder:a', { ctrl: false, shift: false });
        expect([...selection]).toEqual(['file:d']);
        expect(anchor).toBe('file:d');
    });

    it('ctrl toggles', () => {
        const added = clickSelect(new Set(['folder:a']), order, 'file:c', 'folder:a', { ctrl: true, shift: false });
        expect([...added.selection].sort()).toEqual(['file:c', 'folder:a']);
        const removed = clickSelect(added.selection, order, 'folder:a', 'file:c', { ctrl: true, shift: false });
        expect([...removed.selection]).toEqual(['file:c']);
    });

    it('shift selects a range from the anchor in both directions, ctrl+shift adds it', () => {
        expect([...clickSelect(new Set(), order, 'file:d', 'folder:b', { ctrl: false, shift: true }).selection])
            .toEqual(['folder:b', 'file:c', 'file:d']);
        expect([...clickSelect(new Set(), order, 'folder:a', 'file:c', { ctrl: false, shift: true }).selection])
            .toEqual(['folder:a', 'folder:b', 'file:c']);
        const added = clickSelect(new Set(['file:e']), order, 'folder:b', 'folder:a', { ctrl: true, shift: true });
        expect([...added.selection].sort()).toEqual(['file:e', 'folder:a', 'folder:b']);
    });
});

describe('keys and selection payload', () => {
    it('round-trips keys and splits folders / files', () => {
        expect(parseItemKey(itemKey('file', 'x:y'))).toEqual({ kind: 'file', id: 'x:y' });
        expect(parseItemKey('nope')).toBeNull();
        expect(toSelection(['folder:1', 'file:2', 'bad', 'file:3'])).toEqual({ folderIds: ['1'], fileIds: ['2', '3'] });
    });

    it('steps through the list with arrows', () => {
        expect(stepSelect(order, null, 1)).toBe('folder:a');
        expect(stepSelect(order, null, -1)).toBe('file:e');
        expect(stepSelect(order, 'file:c', 1)).toBe('file:d');
        expect(stepSelect(order, 'file:e', 1)).toBe('file:e');
        expect(stepSelect([], null, 1)).toBeNull();
    });
});

describe('folder tree', () => {
    const rows = [
        { id: 'c', parentId: 'b', name: '2026', hidden: false },
        { id: 'a', parentId: null, name: 'Клиенты', hidden: false },
        { id: 'b', parentId: 'a', name: 'ACME', hidden: false },
        { id: 'z', parentId: null, name: 'Архив', hidden: true },
        { id: 'orphan', parentId: 'gone', name: 'Orphan', hidden: false },
    ];

    it('nests rows and sorts by name', () => {
        const tree = buildFolderTree(rows);
        expect(tree.map((node) => node.name).sort()).toEqual(['Orphan', 'Архив', 'Клиенты'].sort());
        expect(tree.findIndex((node) => node.name === 'Архив')).toBeLessThan(tree.findIndex((node) => node.name === 'Клиенты'));
        expect(tree.find((node) => node.name === 'Клиенты')!.children[0]!.children[0]!.name).toBe('2026');
    });

    it('walks ancestors and forbids dropping a folder into itself or its children', () => {
        const parents = parentMap(rows);
        expect(ancestorIds(parents, 'c')).toEqual(['a', 'b', 'c']);
        expect(canDrop({ folderIds: ['a'], fileIds: [] }, 'c', parents, null)).toBe(false);
        expect(canDrop({ folderIds: ['b'], fileIds: [] }, 'b', parents, 'a')).toBe(false);
        expect(canDrop({ folderIds: ['c'], fileIds: [] }, 'z', parents, 'b')).toBe(true);
        expect(canDrop({ folderIds: [], fileIds: ['f'] }, 'b', parents, 'b')).toBe(false);
        expect(canDrop({ folderIds: [], fileIds: ['f'] }, null, parents, 'b')).toBe(true);
    });
});

describe('sorting and names', () => {
    it('sorts by size, date and name with direction', () => {
        const a = { name: 'a', sizeBytes: 10, updatedAt: '2026-01-02' };
        const b = { name: 'B', sizeBytes: 5, updatedAt: '2026-01-01' };
        expect(compareItems(a, b, 'size', 'asc')).toBeGreaterThan(0);
        expect(compareItems(a, b, 'date', 'desc')).toBeLessThan(0);
        expect(compareItems({ name: 'file 10' }, { name: 'file 9' }, 'name', 'asc')).toBeGreaterThan(0);
    });

    it('rejects Windows-reserved characters, paths only where allowed', () => {
        expect(invalidNameReason('  ')).toBe('empty');
        expect(invalidNameReason('a:b')).toBe('chars');
        expect(invalidNameReason('A/B')).toBe('chars');
        expect(invalidNameReason('A/B', { allowPath: true })).toBeNull();
        expect(invalidNameReason('Договор №5')).toBeNull();
    });
});
