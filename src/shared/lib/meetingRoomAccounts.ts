const MEETING_ROOM_EMAILS: ReadonlySet<string> = new Set([
    'smallmeetingroom@kostalegal.com',
    'largemeetingroom@kostalegal.com',
]);

function normalizeEmail(value: string | null | undefined): string {
    if (!value)
        return '';
    return value.trim().toLowerCase();
}

export function isMeetingRoomAccountEmail(email: string | null | undefined): boolean {
    const normalized = normalizeEmail(email);
    return normalized.length > 0 && MEETING_ROOM_EMAILS.has(normalized);
}

export function isMeetingRoomAccount(user: { email?: string | null } | null | undefined): boolean {
    return isMeetingRoomAccountEmail(user?.email);
}

/** Paths meeting-room accounts may open (settings is UI chrome, not a route). */
export function isMeetingRoomAllowedPath(pathname: string): boolean {
    const path = (pathname || '/').split('?')[0] || '/';
    if (path === '/home' || path.startsWith('/home/'))
        return true;
    if (path === '/call-schedule' || path.startsWith('/call-schedule/'))
        return true;
    return false;
}
