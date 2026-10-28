import { TIME_TRACKING_ROLE_META, TIME_TRACKING_ROLES } from '../model/constants';
export function resolveTimeTrackingPositionRole(pos) {
    const key = pos?.trim().toLowerCase();
    if (!key)
        return null;
    return TIME_TRACKING_ROLES.find((r) => r.toLowerCase() === key) ?? null;
}
/** Accent color for known TT job titles (case-insensitive). */
export function resolveTimeTrackingPositionColor(pos) {
    const role = resolveTimeTrackingPositionRole(pos);
    return role ? TIME_TRACKING_ROLE_META[role].color : null;
}
