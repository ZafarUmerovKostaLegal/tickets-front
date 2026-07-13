import { useState, useCallback, useMemo, useEffect } from 'react';
import { getUsers, getPositions, setUserRole, setUserBlocked, setUserArchived, setTimeTrackingRole, setUserPosition, type User, } from '@entities/user';
import { isHiddenSystemUser } from '@shared/lib';
import type { AdminMetrics } from '../types';
import type { AdminUserFieldPendingConfirm } from '../AdminContext.types';
import { TT_POSITIONS_FALLBACK, type TTRole } from '../constants';
type ClosePosDropdown = () => void;
export function useAdminUsers(closePosDropdown: ClosePosDropdown) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [userActionError, setUserActionError] = useState<string | null>(null);
    const [savingUserId, setSavingUserId] = useState<number | null>(null);
    const [pendingUserFieldChange, setPendingUserFieldChange] = useState<AdminUserFieldPendingConfirm>(null);
    const [apiPositions, setApiPositions] = useState<string[]>([...TT_POSITIONS_FALLBACK]);
    useEffect(() => {
        let cancelled = false;
        getPositions()
            .then((list) => {
                if (!cancelled && list.length > 0)
                    setApiPositions(list);
            })
            .catch(() => { /* оставляем фоллбэк */ });
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
    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await getUsers(includeArchived);
            const filtered = list.filter((u) => !isHiddenSystemUser(u));
            setUsers(filtered);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей');
        }
        finally {
            setLoading(false);
        }
    }, [includeArchived]);
    useEffect(() => {
        loadUsers();
    }, [loadUsers]);
    const metrics = useMemo((): AdminMetrics => {
        const totalUsers = users.length;
        const activeUsers = users.filter((u) => !u.is_blocked && !u.is_archived).length;
        const blockedUsers = users.filter((u) => u.is_blocked).length;
        const archivedUsers = users.filter((u) => u.is_archived).length;
        const rolesMap = new Map<string, number>();
        users.forEach((u) => {
            const key = (u.role || 'Не указано').trim();
            rolesMap.set(key, (rolesMap.get(key) ?? 0) + 1);
        });
        const roles = Array.from(rolesMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        return { totalUsers, activeUsers, blockedUsers, archivedUsers, roles };
    }, [users]);
    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        const roleValue = roleFilter === 'all' ? null : roleFilter;
        return users.filter((u) => {
            if (roleValue && (u.role || '').trim() !== roleValue)
                return false;
            if (!q)
                return true;
            return ((u.display_name || '').toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.role || '').toLowerCase().includes(q));
        });
    }, [users, search, roleFilter]);
    const applyUserUpdate = useCallback(async (user: User, action: () => Promise<User>) => {
        setSavingUserId(user.id);
        setUserActionError(null);
        try {
            const updated = await action();
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        }
        catch (e) {
            setUserActionError(e instanceof Error ? e.message : 'Не удалось обновить пользователя');
        }
        finally {
            setSavingUserId(null);
        }
    }, []);
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
        filteredUsers,
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
