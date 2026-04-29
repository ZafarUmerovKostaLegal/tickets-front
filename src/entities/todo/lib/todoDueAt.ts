export function cardDueDateTimeToIso(dueDate?: string, dueTime?: string): string | null {
    if (!dueDate?.trim())
        return null;
    const raw = dueTime?.trim() || '23:59';
    const [hPart, mPart] = raw.split(':');
    const h = Number.parseInt(hPart ?? '23', 10);
    const m = Number.parseInt(mPart ?? '59', 10);
    const hh = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 23;
    const mm = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 59;
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date(`${dueDate.trim()}T${pad(hh)}:${pad(mm)}:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export function isoDueToParts(iso: string | null | undefined): {
    dueDate?: string;
    dueTime?: string;
    dueAtIso?: string;
} {
    if (!iso)
        return {};
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return {};
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
        dueAtIso: iso,
        dueDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        dueTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
}
