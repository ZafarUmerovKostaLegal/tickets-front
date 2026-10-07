export function isKostaCalendarName(name) {
    const n = name.trim();
    if (!n)
        return false;
    return /kosta\s*legal|kostalegal|kosta-?legal/i.test(n);
}
export function displayOutlookCalendarLabel(name) {
    if (isKostaCalendarName(name))
        return 'Kosta Legal';
    return name;
}
export function buildOutlookCalendarOptions(calendars, defaultLabel, allCalendars) {
    const def = { id: 'default', name: defaultLabel, isKosta: false };
    const rest = [...calendars].map((c) => ({
        id: c.id,
        name: c.name,
        isKosta: isKostaCalendarName(c.name),
    }));
    const kosta = rest.filter((o) => o.isKosta);
    const other = rest
        .filter((o) => !o.isKosta)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    const allOpt = allCalendars
        ? [{ id: allCalendars.id, name: allCalendars.label, isKosta: false }]
        : [];
    if (kosta.length > 0)
        return [...allOpt, ...kosta, def, ...other];
    return [...allOpt, def, ...other];
}
