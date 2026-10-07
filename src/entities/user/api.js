import { apiFetch } from '@shared/api';
import { isSessionCookieOnly } from '@shared/config';
import { removeAccessToken, setSessionCookieHint } from '@shared/lib/auth';
import { createQueryCache } from '@shared/lib/queryCache';
import { clearClientSessionSecrets } from '@shared/lib/authSessionCleanup';
import { invalidatePublicUserCache } from './lib/publicUserCache';
import { invalidatePartnersCache } from './publicApi';
import { normalizeUser } from './lib/normalizeUser';
const USERS_LIST_TTL_MS = 5 * 60_000;
const _usersCache = createQueryCache({
    ttlMs: USERS_LIST_TTL_MS,
    storageKey: 'users:false',
});
function invalidateUserDirectoryCaches(userId) {
    _usersCache.invalidate();
    invalidatePartnersCache();
    invalidatePublicUserCache(userId === undefined ? undefined : [userId]);
}
export function invalidateUsersListCache() {
    invalidateUserDirectoryCaches();
}
const POSITIONS_TTL_MS = 30 * 60_000;
const _positionsCache = createQueryCache({
    ttlMs: POSITIONS_TTL_MS,
    storageKey: 'positions',
});
async function _fetchPositionsFromApi() {
    const res = await apiFetch('/api/v1/positions');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        throw new Error('Не удалось загрузить список должностей');
    const data = await res.json().catch(() => null);
    const raw = data?.positions;
    if (!Array.isArray(raw))
        return [];
    return raw.filter((x) => typeof x === 'string' && x.trim().length > 0);
}
export async function getPositions() {
    return _positionsCache.fetch('positions', _fetchPositionsFromApi);
}
export function invalidatePositionsCache() {
    _positionsCache.invalidate();
}
export async function getMe() {
    const res = await apiFetch('/api/v1/users/me', { skipAuthRedirectOn401: true });
    if (res.status === 401) {
        removeAccessToken();
        if (isSessionCookieOnly())
            setSessionCookieHint(false);
        clearClientSessionSecrets();
        throw new Error('Не авторизован');
    }
    if (!res.ok)
        throw new Error('Не удалось загрузить профиль');
    return normalizeUser(await res.json());
}
export async function getUser(id) {
    const res = await apiFetch(`/api/v1/users/${id}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён');
    if (res.status === 404)
        throw new Error('Пользователь не найден');
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователя');
    return normalizeUser(await res.json());
}
async function _fetchUsersFromApi(includeArchived) {
    const params = new URLSearchParams();
    params.set('include_archived', String(includeArchived));
    const res = await apiFetch(`/api/v1/users?${params.toString()}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён (нужны права на каталог пользователей)');
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователей');
    const list = await res.json();
    return Array.isArray(list) ? list.map(normalizeUser) : [];
}
export async function getUsers(includeArchived = false) {
    return _usersCache.fetch(`users:${includeArchived}`, () => _fetchUsersFromApi(includeArchived));
}
export async function getUsersPage(params = {}, signal) {
    const q = new URLSearchParams();
    q.set('include_archived', String(Boolean(params.includeArchived)));
    q.set('skip', String(params.skip ?? 0));
    q.set('limit', String(params.limit ?? 24));
    if (params.q?.trim())
        q.set('q', params.q.trim());
    if (params.role?.trim() && params.role.trim() !== 'all')
        q.set('role', params.role.trim());
    const res = await apiFetch(`/api/v1/users?${q.toString()}`, { signal });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён (нужны права на каталог пользователей)');
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователей');
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items.map((u) => normalizeUser(u)) : [];
    const summary = data.summary ?? {};
    return {
        items,
        total: Number(data.total ?? items.length),
        skip: Number(data.skip ?? params.skip ?? 0),
        limit: Number(data.limit ?? params.limit ?? 24),
        summary: {
            total: Number(summary.total ?? data.total ?? items.length),
            active: Number(summary.active ?? 0),
            blocked: Number(summary.blocked ?? 0),
            archived: Number(summary.archived ?? 0),
            roles: Array.isArray(summary.roles)
                ? summary.roles.map((r) => ({ name: String(r.name || 'Не указано'), count: Number(r.count || 0) }))
                : [],
        },
    };
}
export async function setUserRole(userId, role) {
    const res = await apiFetch(`/api/v1/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён (нужна роль Администратор)');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось изменить роль');
    }
    const user = normalizeUser(await res.json());
    invalidateUserDirectoryCaches(userId);
    return user;
}
export async function setUserBlocked(userId, isBlocked) {
    const res = await apiFetch(`/api/v1/users/${userId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_blocked: isBlocked }),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён (нужна роль Администратор)');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось изменить блокировку');
    }
    const user = normalizeUser(await res.json());
    invalidateUserDirectoryCaches(userId);
    return user;
}
export async function setUserArchived(userId, isArchived) {
    const res = await apiFetch(`/api/v1/users/${userId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived }),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён (нужна роль Администратор)');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось изменить архивный статус');
    }
    const user = normalizeUser(await res.json());
    invalidateUserDirectoryCaches(userId);
    return user;
}
export async function setTimeTrackingRole(userId, timeTrackingRole) {
    const res = await apiFetch(`/api/v1/users/${userId}/time-tracking-role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_tracking_role: timeTrackingRole }),
    });
    if (res.status === 400)
        throw new Error('Недопустимое значение роли учёта времени');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён');
    if (res.status === 404)
        throw new Error('Пользователь не найден');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось изменить роль учёта времени');
    }
    const user = normalizeUser(await res.json());
    invalidateUserDirectoryCaches(userId);
    return user;
}
export async function patchMyWeeklyCapacityHours(hours) {
    const res = await apiFetch('/api/v1/users/me/weekly-capacity-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_capacity_hours: hours }),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 400) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Недопустимое значение нормы часов');
    }
    if (res.status === 503)
        throw new Error('Сервис учёта времени недоступен');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось сохранить норму часов');
    }
    return normalizeUser(await res.json());
}
export async function setUserInitials(userId, initials) {
    const res = await apiFetch(`/api/v1/users/${userId}/initials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initials: initials ?? null }),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён');
    if (res.status === 400) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Инициалы должны состоять из 3–8 букв');
    }
    if (res.status === 404)
        throw new Error('Пользователь не найден');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось сохранить инициалы');
    }
    const user = normalizeUser(await res.json());
    invalidateUserDirectoryCaches(userId);
    return user;
}
export async function setUserPosition(userId, position) {
    const res = await apiFetch(`/api/v1/users/${userId}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: position ?? null }),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён');
    if (res.status === 404)
        throw new Error('Пользователь не найден');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось изменить должность');
    }
    const user = normalizeUser(await res.json());
    invalidateUserDirectoryCaches(userId);
    return user;
}
export async function uploadDesktopBackground(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch('/api/v1/users/me/desktop-background', {
        method: 'POST',
        body: formData,
    });
    if (res.status === 400)
        throw new Error('Неверный формат или размер файла (максимум 5 МБ, форматы: jpg, png, gif, webp)');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        throw new Error('Не удалось загрузить фон');
    return normalizeUser(await res.json());
}
export async function deleteDesktopBackground() {
    const res = await apiFetch('/api/v1/users/me/desktop-background', {
        method: 'DELETE',
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        throw new Error('Не удалось удалить фон');
    return normalizeUser(await res.json());
}
export async function getMicrosoftUsers() {
    const res = await apiFetch('/api/v1/users/microsoft');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Токены Microsoft Graph не найдены — войдите через Microsoft');
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователей Microsoft');
    return res.json();
}
