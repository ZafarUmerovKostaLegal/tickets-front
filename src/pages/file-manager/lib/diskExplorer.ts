import type { DiskSelection, DiskTreeRow } from '../api/diskApi';

export type ItemKind = 'folder' | 'file';
export type ItemKey = string;

export const DRAG_MIME = 'application/x-kosta-disk';

export function itemKey(kind: ItemKind, id: string): ItemKey {
    return `${kind}:${id}`;
}

export function parseItemKey(key: ItemKey): { kind: ItemKind; id: string } | null {
    const at = key.indexOf(':');
    if (at < 0)
        return null;
    const kind = key.slice(0, at);
    if (kind !== 'folder' && kind !== 'file')
        return null;
    return { kind, id: key.slice(at + 1) };
}

export function toSelection(keys: Iterable<ItemKey>): DiskSelection {
    const out: DiskSelection = { folderIds: [], fileIds: [] };
    for (const key of keys) {
        const parsed = parseItemKey(key);
        if (!parsed)
            continue;
        (parsed.kind === 'folder' ? out.folderIds : out.fileIds).push(parsed.id);
    }
    return out;
}

export function selectionSize(selection: DiskSelection): number {
    return selection.folderIds.length + selection.fileIds.length;
}

export function clickSelect(
    current: ReadonlySet<ItemKey>,
    order: readonly ItemKey[],
    key: ItemKey,
    anchor: ItemKey | null,
    mods: { ctrl: boolean; shift: boolean },
): { selection: Set<ItemKey>; anchor: ItemKey | null } {
    if (mods.shift) {
        const from = anchor && order.includes(anchor) ? order.indexOf(anchor) : order.indexOf(key);
        const to = order.indexOf(key);
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        const range = order.slice(Math.max(0, lo), hi + 1);
        const next = mods.ctrl ? new Set(current) : new Set<ItemKey>();
        range.forEach((item) => next.add(item));
        return { selection: next, anchor: anchor ?? key };
    }
    if (mods.ctrl) {
        const next = new Set(current);
        if (next.has(key))
            next.delete(key);
        else
            next.add(key);
        return { selection: next, anchor: key };
    }
    return { selection: new Set([key]), anchor: key };
}

export function stepSelect(order: readonly ItemKey[], focus: ItemKey | null, delta: number): ItemKey | null {
    if (!order.length)
        return null;
    const index = focus ? order.indexOf(focus) : -1;
    if (index < 0)
        return delta >= 0 ? order[0]! : order[order.length - 1]!;
    return order[Math.min(order.length - 1, Math.max(0, index + delta))]!;
}

export type FolderNode = DiskTreeRow & { children: FolderNode[] };

export function buildFolderTree(rows: readonly DiskTreeRow[]): FolderNode[] {
    const byId = new Map<string, FolderNode>();
    rows.forEach((row) => byId.set(row.id, { ...row, children: [] }));
    const roots: FolderNode[] = [];
    byId.forEach((node) => {
        const parent = node.parentId ? byId.get(node.parentId) : undefined;
        if (parent)
            parent.children.push(node);
        else
            roots.push(node);
    });
    const sort = (nodes: FolderNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
        nodes.forEach((node) => sort(node.children));
    };
    sort(roots);
    return roots;
}

export function parentMap(rows: readonly DiskTreeRow[]): Map<string, string | null> {
    return new Map(rows.map((row) => [row.id, row.parentId]));
}

export function ancestorIds(parents: ReadonlyMap<string, string | null>, id: string | null): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    let current = id;
    while (current && !seen.has(current)) {
        seen.add(current);
        out.unshift(current);
        current = parents.get(current) ?? null;
    }
    return out;
}

export function canDrop(
    selection: DiskSelection,
    targetId: string | null,
    parents: ReadonlyMap<string, string | null>,
    sourceParentId: string | null | undefined,
): boolean {
    if (!selectionSize(selection))
        return false;
    const chain = new Set(ancestorIds(parents, targetId));
    if (selection.folderIds.some((id) => chain.has(id)))
        return false;
    return targetId !== sourceParentId;
}

export type SortKey = 'name' | 'date' | 'type' | 'size';
export type SortDir = 'asc' | 'desc';

type Sortable = { name: string; updatedAt?: string | null; createdAt?: string | null; sizeBytes?: number; kind?: string; itemCount?: number };

export function compareItems(a: Sortable, b: Sortable, key: SortKey, dir: SortDir): number {
    const text = (x: string, y: string) => x.localeCompare(y, undefined, { sensitivity: 'base', numeric: true });
    let result = 0;
    if (key === 'date')
        result = (a.updatedAt ?? a.createdAt ?? '').localeCompare(b.updatedAt ?? b.createdAt ?? '');
    else if (key === 'size')
        result = (a.sizeBytes ?? a.itemCount ?? 0) - (b.sizeBytes ?? b.itemCount ?? 0);
    else if (key === 'type')
        result = text(a.kind ?? '', b.kind ?? '');
    if (result === 0)
        result = text(a.name, b.name);
    return dir === 'asc' ? result : -result;
}

export function invalidNameReason(raw: string, { allowPath = false } = {}): 'empty' | 'chars' | null {
    const value = raw.trim();
    if (!value || value === '.' || value === '..')
        return 'empty';
    const bad = allowPath ? /[:*?"<>|]/ : /[\\/:*?"<>|]/;
    return bad.test(value) ? 'chars' : null;
}
