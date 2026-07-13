const REPORT_INITIALS_RE = /^[A-ZА-Я]{1,8}$/;

export function initialsFromDisplayName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '';
    if (parts.length === 1)
        return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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
