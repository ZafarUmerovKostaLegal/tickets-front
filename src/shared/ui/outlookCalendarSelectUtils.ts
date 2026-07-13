export type OutlookCalendarOption = { id: string; name: string };

export function isKostaCalendarName(name: string): boolean {
    const n = name.trim();
    if (!n)
        return false;
    return /kosta\s*legal|kostalegal|kosta-?legal/i.test(n);
}

export function displayOutlookCalendarLabel(name: string): string {
    if (isKostaCalendarName(name))
        return 'Kosta Legal';
    return name;
}

type Opt = { id: string; name: string; isKosta: boolean };

export function buildOutlookCalendarOptions(
    calendars: readonly OutlookCalendarOption[],
    defaultLabel: string,
    allCalendars?: { id: string; label: string },
): Opt[] {
    const def: Opt = { id: 'default', name: defaultLabel, isKosta: false };
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
        ? [{ id: allCalendars.id, name: allCalendars.label, isKosta: false } satisfies Opt]
        : [];

    if (kosta.length > 0)
        return [...allOpt, ...kosta, def, ...other];
    return [...allOpt, def, ...other];
}
