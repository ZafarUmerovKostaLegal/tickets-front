const MEETING_ROOM_EMAILS = new Set([
    'smallmeetingroom@kostalegal.com',
    'largemeetingroom@kostalegal.com',
]);
function normalizeEmail(value) {
    if (!value)
        return '';
    return value.trim().toLowerCase();
}
export function isMeetingRoomAccountEmail(email) {
    const normalized = normalizeEmail(email);
    return normalized.length > 0 && MEETING_ROOM_EMAILS.has(normalized);
}
export function isMeetingRoomAccount(user) {
    return isMeetingRoomAccountEmail(user?.email);
}
/** Paths meeting-room accounts may open (settings is UI chrome, not a route). */
export function isMeetingRoomAllowedPath(pathname) {
    const path = (pathname || '/').split('?')[0] || '/';
    if (path === '/home' || path.startsWith('/home/'))
        return true;
    if (path === '/call-schedule' || path.startsWith('/call-schedule/'))
        return true;
    return false;
}
