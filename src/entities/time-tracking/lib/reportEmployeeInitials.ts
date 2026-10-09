const REPORT_INITIALS_RE = /^[A-ZА-Я]{1,8}$/;

export function initialsFromDisplayName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '';
    if (parts.length === 1)
        return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Swap name-derived codes (AA) for the single system user whose stored initials differ. */
export function systemInitialsForDisplayedCode(
    displayed: string,
    users: ReadonlyArray<{ display_name?: string | null; initials?: string | null }>,
): string {
    const current = displayed.trim().toUpperCase();
    if (!current)
        return displayed;
    const hits: string[] = [];
    for (const user of users) {
        const stored = resolveReportEmployeeInitials({
            stored: user.initials,
            displayName: user.display_name,
        });
        const derived = initialsFromDisplayName(user.display_name ?? '');
        if (!stored || !derived || stored === derived)
            continue;
        if (current === derived || current === stored)
            hits.push(stored);
    }
    const unique = [...new Set(hits)];
    return unique.length === 1 ? unique[0]! : displayed;
}

export function resolveReportEmployeeInitials(params: {
    stored?: string | null;
    displayName?: string | null;
    email?: string | null;
}): string {
    const stored = (params.stored ?? '')
        .trim()
        .toUpperCase()
        .replace(/Ё/g, 'Е');
    if (REPORT_INITIALS_RE.test(stored))
        return stored;
    const name = (params.displayName ?? '').trim() || (params.email ?? '').trim();
    return initialsFromDisplayName(name);
}
