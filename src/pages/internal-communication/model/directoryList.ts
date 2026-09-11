import type { InternalExtension } from '@entities/internal-communication';

export type InternalExtensionModalState = InternalExtension | 'new' | null;

export function normalizeInternalExtensionSearch(value: string): string {
    return value.trim().toLocaleLowerCase('ru-RU');
}

export function sortInternalExtensions(rows: InternalExtension[]): InternalExtension[] {
    return [...rows].sort((a, b) =>
        a.extension.localeCompare(b.extension, undefined, { numeric: true }),
    );
}

export function filterInternalExtensions(rows: InternalExtension[], query: string): InternalExtension[] {
    const sorted = sortInternalExtensions(rows);
    const q = normalizeInternalExtensionSearch(query);
    if (!q)
        return sorted;
    return sorted.filter(
        (row) =>
            normalizeInternalExtensionSearch(row.fullName).includes(q)
            || normalizeInternalExtensionSearch(row.extension).includes(q),
    );
}

export function internalExtensionInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function applyCreatedInternalExtension(
    prev: InternalExtension[],
    created: InternalExtension,
): InternalExtension[] {
    return [...prev.filter((row) => row.id !== created.id), created];
}

export function applyUpdatedInternalExtension(
    prev: InternalExtension[],
    updated: InternalExtension,
): InternalExtension[] {
    return prev.map((row) => (row.id === updated.id ? updated : row));
}

export function applyDeletedInternalExtension(prev: InternalExtension[], id: number): InternalExtension[] {
    return prev.filter((row) => row.id !== id);
}

export function editingInternalExtension(
    modal: InternalExtensionModalState,
): InternalExtension | null {
    if (modal == null || modal === 'new')
        return null;
    return modal;
}
