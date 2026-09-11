import type { InternalExtension } from '../model/types';

export function parseInternalExtension(raw: unknown): InternalExtension | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isFinite(id) || id <= 0)
        return null;
    return {
        id,
        fullName: String(o.full_name ?? o.fullName ?? '').trim(),
        extension: String(o.extension ?? '').trim(),
    };
}

export function parseInternalExtensionList(data: unknown): InternalExtension[] {
    if (!Array.isArray(data))
        return [];
    const out: InternalExtension[] = [];
    for (const row of data) {
        const parsed = parseInternalExtension(row);
        if (parsed)
            out.push(parsed);
    }
    return out;
}
