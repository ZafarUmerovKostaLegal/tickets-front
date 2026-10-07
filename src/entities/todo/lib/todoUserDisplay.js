export function buildTodoUserByIdMap(users) {
    const m = new Map();
    for (const u of users)
        m.set(u.id, u);
    return m;
}
export function publicUserAsUser(userId, pub) {
    return {
        id: pub.id || userId,
        email: pub.email ?? '',
        display_name: pub.display_name ?? null,
        picture: pub.picture ?? null,
        role: '',
        position: pub.position ?? null,
        is_blocked: false,
        is_archived: !!pub.is_archived,
        time_tracking_role: null,
        created_at: '',
        updated_at: null,
        desktop_background: null,
    };
}
export function todoUserPickLabel(u) {
    return u.display_name?.trim() || u.email || `Участник №${u.id}`;
}
export function todoInitialFromDisplayLabel(label) {
    for (const ch of label.trim()) {
        if (/[\p{L}]/u.test(ch))
            return ch.toUpperCase();
    }
    const t = label.trim();
    return t ? t[0].toUpperCase() : '?';
}
export function todoUserPickInitial(u) {
    return todoInitialFromDisplayLabel(todoUserPickLabel(u));
}
export function todoParticipantLabel(userById, uid) {
    const u = userById.get(uid);
    if (u)
        return todoUserPickLabel(u);
    return `Участник №${uid}`;
}
