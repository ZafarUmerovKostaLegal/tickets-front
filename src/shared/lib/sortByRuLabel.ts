
export function compareRuLabels(a: string, b: string): number {
    return a.trim().localeCompare(b.trim(), 'ru', { sensitivity: 'base', numeric: true });
}

export function sortByRuLabel<T>(items: readonly T[], getLabel: (item: T) => string): T[] {
    return [...items].sort((a, b) => compareRuLabels(getLabel(a), getLabel(b)));
}

export function userPickerSortLabel(u: {
    display_name?: string | null;
    displayName?: string | null;
    email?: string | null;
    id?: number;
}): string {
    const name = (u.display_name ?? u.displayName ?? '').trim();
    if (name)
        return name;
    const email = (u.email ?? '').trim();
    if (email)
        return email;
    return u.id != null ? String(u.id) : '';
}
