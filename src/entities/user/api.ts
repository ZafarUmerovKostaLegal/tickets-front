import { apiFetch } from '@shared/api';
import { useSessionCookieOnly } from '@shared/config';
import { removeAccessToken, setSessionCookieHint } from '@shared/lib/auth';
import { createQueryCache } from '@shared/lib/queryCache';
import { clearClientSessionSecrets } from '@shared/lib/authSessionCleanup';
import type { User, MicrosoftUser } from './model/types';
import { normalizeUser } from './lib/normalizeUser';

const USERS_LIST_TTL_MS = 5 * 60_000;
const _usersCache = createQueryCache<User[]>({
    ttlMs: USERS_LIST_TTL_MS,
    storageKey: 'users:false',
});

export function invalidateUsersListCache(): void {
    _usersCache.invalidate();
}

const POSITIONS_TTL_MS = 30 * 60_000;
const _positionsCache = createQueryCache<string[]>({
    ttlMs: POSITIONS_TTL_MS,
    storageKey: 'positions',
});

async function _fetchPositionsFromApi(): Promise<string[]> {
    const res = await apiFetch('/api/v1/positions');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        throw new Error('Не удалось загрузить список должностей');
    const data = await res.json().catch(() => null) as { positions?: unknown } | null;
    const raw = data?.positions;
    if (!Array.isArray(raw))
        return [];
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}


export async function getPositions(): Promise<string[]> {
    return _positionsCache.fetch('positions', _fetchPositionsFromApi);
}

export function invalidatePositionsCache(): void {
    _positionsCache.invalidate();
}
export async function getMe(): Promise<User> {
    const res = await apiFetch('/api/v1/users/me', { skipAuthRedirectOn401: true });
    if (res.status === 401) {
        removeAccessToken();
        if (useSessionCookieOnly())
            setSessionCookieHint(false);
        clearClientSessionSecrets();
        throw new Error('Не авторизован');
    }
    if (!res.ok)
        throw new Error('Не удалось загрузить профиль');
    return normalizeUser(await res.json());
}
export async function getUser(id: number): Promise<User> {
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
async function _fetchUsersFromApi(includeArchived: boolean): Promise<User[]> {
    const params = new URLSearchParams();
    params.set('include_archived', String(includeArchived));
    const res = await apiFetch(`/api/v1/users?${params.toString()}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Доступ запрещён (нужны права на каталог пользователей)');
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователей');
    const list = await res.json() as unknown[];
    return Array.isArray(list) ? list.map(normalizeUser) : [];
}

export async function getUsers(includeArchived = false): Promise<User[]> {
    return _usersCache.fetch(`users:${includeArchived}`, () => _fetchUsersFromApi(includeArchived));
}
export async function setUserRole(userId: number, role: string): Promise<User> {
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
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Не удалось изменить роль');
    }
    const user = normalizeUser(await res.json());
    _usersCache.invalidate();
    return user;
}
export async function setUserBlocked(userId: number, isBlocked: boolean): Promise<User> {
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
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Не удалось изменить блокировку');
    }
    const user = normalizeUser(await res.json());
    _usersCache.invalidate();
    return user;
}
export async function setUserArchived(userId: number, isArchived: boolean): Promise<User> {
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
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Не удалось изменить архивный статус');
    }
    const user = normalizeUser(await res.json());
    _usersCache.invalidate();
    return user;
}
export async function setTimeTrackingRole(userId: number, timeTrackingRole: 'user' | 'manager' | null): Promise<User> {
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
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Не удалось изменить роль учёта времени');
    }
    return normalizeUser(await res.json());
}
export async function patchMyWeeklyCapacityHours(hours: number): Promise<User> {
    const res = await apiFetch('/api/v1/users/me/weekly-capacity-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_capacity_hours: hours }),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 400) {
        const err = await res.json().catch(() => null);
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Недопустимое значение нормы часов');
    }
    if (res.status === 503)
        throw new Error('Сервис учёта времени недоступен');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Не удалось сохранить норму часов');
    }
    return normalizeUser(await res.json());
}
export async function setUserInitials(userId: number, initials: string | null): Promise<User> {
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
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Инициалы должны состоять из 3–8 букв');
    }
    if (res.status === 404)
        throw new Error('Пользователь не найден');
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Не удалось сохранить инициалы');
    }
    const user = normalizeUser(await res.json());
    _usersCache.invalidate();
    return user;
}
export async function setUserPosition(userId: number, position: string | null): Promise<User> {
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
        throw new Error((err as {
            detail?: string;
        } | null)?.detail ?? 'Не удалось изменить должность');
    }
    return normalizeUser(await res.json());
}
export async function uploadDesktopBackground(file: File): Promise<User> {
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
export async function deleteDesktopBackground(): Promise<User> {
    const res = await apiFetch('/api/v1/users/me/desktop-background', {
        method: 'DELETE',
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        throw new Error('Не удалось удалить фон');
    return normalizeUser(await res.json());
}
export async function getMicrosoftUsers(): Promise<MicrosoftUser[]> {
    const res = await apiFetch('/api/v1/users/microsoft');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 403)
        throw new Error('Токены Microsoft Graph не найдены — войдите через Microsoft');
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователей Microsoft');
    return res.json();
}
