export function compareRuLabels(a, b) {
    return a.trim().localeCompare(b.trim(), 'ru', { sensitivity: 'base', numeric: true });
}
export function sortByRuLabel(items, getLabel) {
    return [...items].sort((a, b) => compareRuLabels(getLabel(a), getLabel(b)));
}
export function userPickerSortLabel(u) {
    const name = (u.display_name ?? u.displayName ?? '').trim();
    if (name)
        return name;
    const email = (u.email ?? '').trim();
    if (email)
        return email;
    return u.id != null ? String(u.id) : '';
}
