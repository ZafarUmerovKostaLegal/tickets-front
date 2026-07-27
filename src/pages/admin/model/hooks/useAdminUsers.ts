import { useState, useCallback, useMemo, useEffect } from 'react';
import { getUsersPage, getPositions, setUserRole, setUserBlocked, setUserArchived, setTimeTrackingRole, setUserPosition, invalidateUsersListCache, type User, } from '@entities/user';
import type { AdminMetrics } from '../types';
import type { AdminUserFieldPendingConfirm } from '../AdminContext.types';
import { TT_POSITIONS_FALLBACK, type TTRole } from '../constants';

const ADMIN_USERS_PAGE_SIZE = 24;
type ClosePosDropdown = () => void;

export function useAdminUsers(closePosDropdown: ClosePosDropdown) {
    const [users, setUsers] = useState<User[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [roleFilter, setRoleFilterState] = useState<string>('all');
    const [includeArchived, setIncludeArchivedState] = useState(false);
    const [userActionError, setUserActionError] = useState<string | null>(null);
    const [savingUserId, setSavingUserId] = useState<number | null>(null);
    const [pendingUserFieldChange, setPendingUserFieldChange] = useState<AdminUserFieldPendingConfirm>(null);
    const [apiPositions, setApiPositions] = useState<string[]>([...TT_POSITIONS_FALLBACK]);
    const [metrics, setMetrics] = useState<AdminMetrics>({
        totalUsers: 0,
        activeUsers: 0,
        blockedUsers: 0,
        archivedUsers: 0,
        roles: [],
    });

    useEffect(() => {
        const t = window.setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => window.clearTimeout(t);
    }, [search]);
    const setRoleFilter = useCallback((value: string) => {
        setRoleFilterState(value);
        setPage(1);
    }, []);
    const setIncludeArchived = useCallback((value: boolean) => {
        setIncludeArchivedState(value);
        setPage(1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        getPositions()
            .then((list) => {
                if (!cancelled && list.length > 0)
                    setApiPositions(list);
            })
            .catch(() => {  });
        return () => {
            cancelled = true;
        };
    }, []);

    const positions = useMemo(() => {
        const seen = new Set<string>();
        const canonical: string[] = [];
        for (const p of apiPositions) {
            const v = p.trim();
            const k = v.toLowerCase();
            if (v && !seen.has(k)) {
                seen.add(k);
                canonical.push(v);
            }
        }
        const extra: string[] = [];
        for (const u of users) {
            const v = (u.position || '').trim();
            const k = v.toLowerCase();
            if (v && !seen.has(k)) {
                seen.add(k);
                extra.push(v);
            }
        }
        extra.sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
        return [...canonical, ...extra];
    }, [apiPositions, users]);

    const loadUsers = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getUsersPage({
                includeArchived,
                skip: (page - 1) * ADMIN_USERS_PAGE_SIZE,
                limit: ADMIN_USERS_PAGE_SIZE,
                q: debouncedSearch,
                role: roleFilter,
            }, signal);
            setUsers(result.items);
            setTotalCount(result.total);
            setMetrics({
                totalUsers: result.summary.total,
                activeUsers: result.summary.active,
                blockedUsers: result.summary.blocked,
                archivedUsers: result.summary.archived,
                roles: result.summary.roles,
            });
        }
        catch (e) {
            if (signal?.aborted)
                return;
            setError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей');
        }
        finally {
            if (!signal?.aborted)
                setLoading(false);
        }
    }, [includeArchived, page, debouncedSearch, roleFilter]);

    useEffect(() => {
        const controller = new AbortController();
        void loadUsers(controller.signal);
        return () => controller.abort();
    }, [loadUsers]);

    const applyUserUpdate = useCallback(async (user: User, action: () => Promise<User>) => {
        setSavingUserId(user.id);
        setUserActionError(null);
        try {
            const updated = await action();
            invalidateUsersListCache();
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
            await loadUsers();
        }
        catch (e) {
            setUserActionError(e instanceof Error ? e.message : 'Не удалось обновить пользователя');
        }
        finally {
            setSavingUserId(null);
        }
    }, [loadUsers]);

    const handleToggleBlocked = useCallback((u: User) => {
        applyUserUpdate(u, () => setUserBlocked(u.id, !u.is_blocked));
    }, [applyUserUpdate]);
    const handleToggleArchived = useCallback((u: User) => {
        applyUserUpdate(u, () => setUserArchived(u.id, !u.is_archived));
    }, [applyUserUpdate]);
    const handleRoleChange = useCallback((u: User, roleValue: string) => {
        if ((u.role || '').trim() === roleValue.trim())
            return;
        setPendingUserFieldChange({ kind: 'role', user: u, newRole: roleValue });
    }, []);
    const handleTTRoleChange = useCallback((u: User, ttRole: TTRole) => {
        if (u.time_tracking_role === ttRole)
            return;
        setPendingUserFieldChange({ kind: 'tt', user: u, newTtRole: ttRole });
    }, []);
    const dismissPendingUserFieldChange = useCallback(() => {
        setPendingUserFieldChange(null);
    }, []);
    const confirmPendingUserFieldChange = useCallback(async () => {
        const snap = pendingUserFieldChange;
        if (!snap)
            return;
        if (snap.kind === 'role') {
            await applyUserUpdate(snap.user, () => setUserRole(snap.user.id, snap.newRole));
        }
        else {
            await applyUserUpdate(snap.user, () => setTimeTrackingRole(snap.user.id, snap.newTtRole));
        }
        setPendingUserFieldChange(null);
    }, [pendingUserFieldChange, applyUserUpdate]);
    const handlePositionChange = useCallback((u: User, pos: string | null) => {
        applyUserUpdate(u, () => setUserPosition(u.id, pos));
        closePosDropdown();
    }, [applyUserUpdate, closePosDropdown]);

    return {
        users,
        positions,
        loading,
        error,
        search,
        setSearch,
        roleFilter,
        setRoleFilter,
        includeArchived,
        setIncludeArchived,
        filteredUsers: users,
        page,
        setPage,
        totalCount,
        pageSize: ADMIN_USERS_PAGE_SIZE,
        metrics,
        loadUsers,
        userActionError,
        savingUserId,
        handleToggleBlocked,
        handleToggleArchived,
        handleRoleChange,
        handleTTRoleChange,
        handlePositionChange,
        pendingUserFieldChange,
        confirmPendingUserFieldChange,
        dismissPendingUserFieldChange,
    };
}
