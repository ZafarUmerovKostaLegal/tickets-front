import { isMeetingRoomAccount } from './meetingRoomAccounts';

function emailLocalPart(email: string | null | undefined): string {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized)
        return '';
    const at = normalized.indexOf('@');
    return at === -1 ? normalized : normalized.slice(0, at);
}

/** Legal Hub is open to every signed-in employee. Meeting-room kiosks stay on home and the call schedule. */
export function canAccessLegalHub(user: { email?: string | null } | null | undefined): boolean {
    if (user == null || isMeetingRoomAccount(user))
        return false;
    return emailLocalPart(user.email).length > 0;
}
