import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    addTodoBoardMembers,
    fetchTodoBoardMembers,
    patchTodoBoardMemberRole,
    removeTodoBoardMember,
    type TodoBoardMember,
    type TodoBoardMembersList,
} from '@entities/todo';
import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { useUserPublic } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { sortByRuLabel, userPickerSortLabel } from '@shared/lib/sortByRuLabel';
import { useI18n } from '@shared/i18n';

type TodoBoardMembersModalProps = {
    boardId: number;
    boardTitle: string;
    onClose: () => void;
    onMembersChanged?: () => void;
    themeVarsStyle?: CSSProperties;
};

export function TodoBoardMembersModal({ boardId, boardTitle, onClose, onMembersChanged, themeVarsStyle }: TodoBoardMembersModalProps) {
    const { t } = useI18n();
    const [members, setMembers] = useState<TodoBoardMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [addRole, setAddRole] = useState<'editor' | 'viewer'>('editor');
    const [instant, setInstant] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [busyUserId, setBusyUserId] = useState<number | null>(null);

    const applyList = (data: TodoBoardMembersList) => {
        setMembers(data.items);
    };

    const reload = useCallback(() => {
        setLoading(true);
        setError(null);
        return fetchTodoBoardMembers(boardId)
            .then(applyList)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : t('todoPage.errors.load')))
            .finally(() => setLoading(false));
    }, [boardId, t]);

    useEffect(() => {
        void reload();
        let cancelled = false;
        void listColleaguesAsUsers()
            .then((list) => {
                if (!cancelled)
                    setUsers(list.filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u)));
            })
            .catch(() => {
                if (!cancelled)
                    setUsers([]);
            });
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
    const memberIdList = useMemo(() => members.map((m) => m.user_id), [members]);

    const memberPublicById = useUserPublic(memberIdList);

    const usersById = useMemo(() => {
        const map = new Map<number, User>();
        for (const u of users)
            map.set(u.id, u);
        return map;
    }, [users]);

    const pickableUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return sortByRuLabel(users
            .filter((u) => !memberIds.has(u.id))
            .filter((u) => {
                if (!q)
                    return true;
                const name = `${u.display_name ?? ''} ${u.email ?? ''}`.toLowerCase();
                return name.includes(q);
            }), userPickerSortLabel).slice(0, 40);
    }, [users, memberIds, userSearch]);

    const userLabel = (u: User) => u.display_name?.trim() || u.email || `id ${u.id}`;

    const initials = (label: string) => {
        const parts = label.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0)
            return '?';
        if (parts.length === 1)
            return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    const memberLabel = (userId: number) => {
        const u = usersById.get(userId);
        if (u)
            return userLabel(u);
        const pub = memberPublicById.get(userId);
        if (pub)
            return pub.display_name?.trim() || pub.email || `#${userId}`;
        return `#${userId}`;
    };

    const memberSubtitle = (userId: number) => {
        const u = usersById.get(userId);
        if (u)
            return u.email ?? null;
        const pub = memberPublicById.get(userId);
        return pub?.email ?? null;
    };

    const memberAvatar = (userId: number) => {
        const u = usersById.get(userId);
        if (u?.picture)
            return u.picture;
        const pub = memberPublicById.get(userId);
        return pub?.picture ?? null;
    };

    const togglePick = (id: number) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const handleAdd = async () => {
        if (selectedIds.length === 0)
            return;
        setSubmitting(true);
        setError(null);
        try {
            const data = await addTodoBoardMembers(boardId, {
                userIds: selectedIds,
                role: addRole,
                instant,
            });
            applyList(data);
            setSelectedIds([]);
            onMembersChanged?.();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : t('todoPage.members.addError'));
        }
        finally {
            setSubmitting(false);
        }
    };

    const handleRoleChange = async (userId: number, role: 'editor' | 'viewer') => {
        if (members.find((m) => m.user_id === userId)?.role === 'owner')
            return;
        setBusyUserId(userId);
        try {
            const data = await patchTodoBoardMemberRole(boardId, userId, role);
            applyList(data);
            onMembersChanged?.();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : t('todoPage.errors.saveBoard'));
        }
        finally {
            setBusyUserId(null);
        }
    };

    const handleRemove = async (userId: number) => {
        if (members.find((m) => m.user_id === userId)?.role === 'owner')
            return;
        setBusyUserId(userId);
        try {
            const data = await removeTodoBoardMember(boardId, userId);
            applyList(data);
            onMembersChanged?.();
        }
        catch (e: unknown) {
            setError(e instanceof Error ? e.message : t('todoPage.members.removeError'));
        }
        finally {
            setBusyUserId(null);
        }
    };

    if (typeof document === 'undefined')
        return null;

    return createPortal(
        <div className="todo-members__backdrop" style={themeVarsStyle} onClick={onClose}>
            <div className="todo-members__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="todo-members-title">
                <div className="todo-members__head">
                    <div className="todo-members__head-text">
                        <h2 id="todo-members-title" className="todo-members__title">{t('todoPage.members.title')}</h2>
                        <p className="todo-members__subtitle">{boardTitle}</p>
                    </div>
                    <button type="button" className="todo-members__close" onClick={onClose} aria-label={t('todoPage.close')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {error && <p className="todo-members__error" role="alert">{error}</p>}

                {loading ? (
                    <p className="todo-members__status">{t('todoPage.loading')}</p>
                ) : (
                    <ul className="todo-members__list">
                        {members.map((m) => {
                            const label = memberLabel(m.user_id);
                            const sub = memberSubtitle(m.user_id);
                            const avatar = memberAvatar(m.user_id);
                            const isOwner = m.role === 'owner';
                            return (
                                <li key={m.user_id} className="todo-members__row">
                                    <div className="todo-members__user">
                                        {avatar ? (
                                            <img className="todo-members__avatar" src={avatar} alt="" />
                                        ) : (
                                            <span className={`todo-members__avatar todo-members__avatar--ph${isOwner ? ' todo-members__avatar--owner' : ''}`}>
                                                {initials(label)}
                                            </span>
                                        )}
                                        <span className="todo-members__user-text">
                                            <span className="todo-members__user-name">{label}</span>
                                            {sub && <span className="todo-members__user-sub">{sub}</span>}
                                        </span>
                                    </div>
                                    <div className="todo-members__row-actions">
                                        {isOwner ? (
                                            <span className="todo-members__role-badge">{t('todoPage.members.owner')}</span>
                                        ) : (
                                            <select
                                                className="todo-members__role-select"
                                                value={m.role === 'viewer' ? 'viewer' : 'editor'}
                                                disabled={busyUserId === m.user_id}
                                                onChange={(e) => void handleRoleChange(m.user_id, e.target.value as 'editor' | 'viewer')}
                                            >
                                                <option value="editor">{t('todoPage.members.roleEditor')}</option>
                                                <option value="viewer">{t('todoPage.members.roleViewer')}</option>
                                            </select>
                                        )}
                                        {!isOwner && (
                                            <button
                                                type="button"
                                                className="todo-members__remove"
                                                disabled={busyUserId === m.user_id}
                                                onClick={() => void handleRemove(m.user_id)}
                                            >
                                                {t('todoPage.members.remove')}
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <section className="todo-members__add">
                    <h3 className="todo-members__add-title">{t('todoPage.members.addSection')}</h3>
                    <input
                        className="todo-members__search"
                        type="search"
                        placeholder={t('todoPage.boards.employeesSearch')}
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                    />
                    {selectedIds.length > 0 && (
                        <p className="todo-members__picked">{t('todoPage.members.selectedCount').replace('{count}', String(selectedIds.length))}</p>
                    )}
                    <ul className="todo-members__pick-list">
                        {pickableUsers.map((u) => {
                            const label = userLabel(u);
                            const on = selectedIds.includes(u.id);
                            return (
                                <li key={u.id}>
                                    <button
                                        type="button"
                                        className={`todo-members__pick-row${on ? ' todo-members__pick-row--on' : ''}`}
                                        onClick={() => togglePick(u.id)}
                                    >
                                        {u.picture ? (
                                            <img className="todo-members__avatar todo-members__avatar--sm" src={u.picture} alt="" />
                                        ) : (
                                            <span className="todo-members__avatar todo-members__avatar--ph todo-members__avatar--sm">
                                                {initials(label)}
                                            </span>
                                        )}
                                        <span className="todo-members__pick-text">
                                            <span className="todo-members__pick-name">{label}</span>
                                            {u.email && u.email !== label && (
                                                <span className="todo-members__pick-sub">{u.email}</span>
                                            )}
                                        </span>
                                        <span className={`todo-members__pick-mark${on ? ' todo-members__pick-mark--on' : ''}`} aria-hidden="true">
                                            {on && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                        {pickableUsers.length === 0 && (
                            <li className="todo-members__pick-empty">{t('todoPage.boards.employeesEmpty') || '—'}</li>
                        )}
                    </ul>
                    <div className="todo-members__add-options">
                        <label className="todo-members__label">
                            <span>{t('todoPage.members.roleLabel')}</span>
                            <select value={addRole} onChange={(e) => setAddRole(e.target.value as 'editor' | 'viewer')} disabled={submitting}>
                                <option value="editor">{t('todoPage.members.roleEditor')}</option>
                                <option value="viewer">{t('todoPage.members.roleViewer')}</option>
                            </select>
                        </label>
                        <label className="todo-members__check">
                            <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} disabled={submitting} />
                            <span>{t('todoPage.members.instantAdd')}</span>
                        </label>
                    </div>
                    <button
                        type="button"
                        className="todo-members__submit"
                        disabled={submitting || selectedIds.length === 0}
                        onClick={() => void handleAdd()}
                    >
                        {submitting ? t('todoPage.saving') : t('todoPage.members.addBtn')}
                    </button>
                </section>
            </div>
        </div>,
        document.body,
    );
}
