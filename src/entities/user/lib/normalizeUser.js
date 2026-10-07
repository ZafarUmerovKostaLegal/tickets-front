function str(v) {
    if (v == null)
        return '';
    return String(v);
}
function strOrNull(v) {
    const s = str(v).trim();
    return s ? s : null;
}
function num(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim()) {
        const n = Number(v);
        if (Number.isFinite(n))
            return n;
    }
    return 0;
}
function bool(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
}
function normalizeTimeTrackingRole(v) {
    if (v == null || v === '')
        return null;
    const s = str(v).trim().toLowerCase().replace(/ё/g, 'е');
    if (s === 'user' || s === 'employee' || s === 'пользователь' || s === 'сотрудник')
        return 'user';
    if (s === 'manager' || s === 'менеджер')
        return 'manager';
    return null;
}
function numOrNull(v) {
    if (v == null || v === '')
        return null;
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim()) {
        const n = Number(v);
        if (Number.isFinite(n))
            return n;
    }
    return null;
}
function normalizePermissions(raw) {
    if (raw == null || typeof raw !== 'object')
        return undefined;
    const o = raw;
    if (typeof o.v !== 'number' || !Number.isFinite(o.v))
        return undefined;
    return o;
}
export function normalizeUser(raw) {
    if (raw == null || typeof raw !== 'object') {
        throw new Error('Invalid user payload');
    }
    const o = raw;
    const timeTrackingRole = normalizeTimeTrackingRole(o.time_tracking_role ?? o.timeTrackingRole);
    const weekly = o.weekly_capacity_hours ?? o.weeklyCapacityHours;
    return {
        id: num(o.id),
        azure_oid: strOrNull(o.azure_oid ?? o.azureOid) ?? undefined,
        email: str(o.email),
        display_name: strOrNull(o.display_name ?? o.displayName),
        picture: strOrNull(o.picture),
        role: str(o.role),
        position: strOrNull(o.position),
        is_blocked: bool(o.is_blocked ?? o.isBlocked),
        is_archived: bool(o.is_archived ?? o.isArchived),
        weekly_capacity_hours: weekly === undefined ? undefined : numOrNull(weekly),
        time_tracking_role: timeTrackingRole,
        created_at: str(o.created_at ?? o.createdAt),
        updated_at: strOrNull(o.updated_at ?? o.updatedAt),
        desktop_background: strOrNull(o.desktop_background ?? o.desktopBackground),
        initials: strOrNull(o.initials),
        permissions: normalizePermissions(o.permissions),
    };
}
