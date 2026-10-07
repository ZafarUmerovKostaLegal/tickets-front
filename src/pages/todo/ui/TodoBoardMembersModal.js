import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { addTodoBoardMembers, fetchTodoBoardMembers, patchTodoBoardMemberRole, removeTodoBoardMember, } from '@entities/todo';
import { loadTodoDirectoryUsers } from '@entities/todo/lib/todoDirectoryUsers';
import { useUserPublic } from '@shared/hooks';
import { sortByRuLabel, userPickerSortLabel } from '@shared/lib/sortByRuLabel';
import { useI18n } from '@shared/i18n';
export function TodoBoardMembersModal({ boardId, boardTitle, onClose, onMembersChanged, themeVarsStyle }) {
    const { t } = useI18n();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [addRole, setAddRole] = useState('editor');
    const [instant, setInstant] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [busyUserId, setBusyUserId] = useState(null);
    const applyList = (data) => {
        setMembers(data.items);
    };
    const reload = useCallback(() => {
        setLoading(true);
        setError(null);
        return fetchTodoBoardMembers(boardId)
            .then(applyList)
            .catch((e) => setError(e instanceof Error ? e.message : t('todoPage.errors.load')))
            .finally(() => setLoading(false));
    }, [boardId, t]);
    useEffect(() => {
        void reload();
        let cancelled = false;
        void loadTodoDirectoryUsers()
            .then((list) => {
            if (!cancelled)
                setUsers(list);
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
        const map = new Map();
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
    const userLabel = (u) => u.display_name?.trim() || u.email || `id ${u.id}`;
    const initials = (label) => {
        const parts = label.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0)
            return '?';
        if (parts.length === 1)
            return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };
    const memberLabel = (userId) => {
        const u = usersById.get(userId);
        if (u)
            return userLabel(u);
        const pub = memberPublicById.get(userId);
        if (pub)
            return pub.display_name?.trim() || pub.email || `#${userId}`;
        return `#${userId}`;
    };
    const memberSubtitle = (userId) => {
        const u = usersById.get(userId);
        if (u)
            return u.email ?? null;
        const pub = memberPublicById.get(userId);
        return pub?.email ?? null;
    };
    const memberAvatar = (userId) => {
        const u = usersById.get(userId);
        if (u?.picture)
            return u.picture;
        const pub = memberPublicById.get(userId);
        return pub?.picture ?? null;
    };
    const togglePick = (id) => {
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
        catch (e) {
            setError(e instanceof Error ? e.message : t('todoPage.members.addError'));
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleRoleChange = async (userId, role) => {
        if (members.find((m) => m.user_id === userId)?.role === 'owner')
            return;
        setBusyUserId(userId);
        try {
            const data = await patchTodoBoardMemberRole(boardId, userId, role);
            applyList(data);
            onMembersChanged?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('todoPage.errors.saveBoard'));
        }
        finally {
            setBusyUserId(null);
        }
    };
    const handleRemove = async (userId) => {
        if (members.find((m) => m.user_id === userId)?.role === 'owner')
            return;
        setBusyUserId(userId);
        try {
            const data = await removeTodoBoardMember(boardId, userId);
            applyList(data);
            onMembersChanged?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('todoPage.members.removeError'));
        }
        finally {
            setBusyUserId(null);
        }
    };
    if (typeof document === 'undefined')
        return null;
    return createPortal(_jsx("div", { className: "todo-members__backdrop", style: themeVarsStyle, onClick: onClose, children: _jsxs("div", { className: "todo-members__modal", onClick: (e) => e.stopPropagation(), role: "dialog", "aria-labelledby": "todo-members-title", children: [_jsxs("div", { className: "todo-members__head", children: [_jsxs("div", { className: "todo-members__head-text", children: [_jsx("h2", { id: "todo-members-title", className: "todo-members__title", children: t('todoPage.members.title') }), _jsx("p", { className: "todo-members__subtitle", children: boardTitle })] }), _jsx("button", { type: "button", className: "todo-members__close", onClick: onClose, "aria-label": t('todoPage.close'), children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), error && _jsx("p", { className: "todo-members__error", role: "alert", children: error }), loading ? (_jsx("p", { className: "todo-members__status", children: t('todoPage.loading') })) : (_jsx("ul", { className: "todo-members__list", children: members.map((m) => {
                        const label = memberLabel(m.user_id);
                        const sub = memberSubtitle(m.user_id);
                        const avatar = memberAvatar(m.user_id);
                        const isOwner = m.role === 'owner';
                        return (_jsxs("li", { className: "todo-members__row", children: [_jsxs("div", { className: "todo-members__user", children: [avatar ? (_jsx("img", { className: "todo-members__avatar", src: avatar, alt: "" })) : (_jsx("span", { className: `todo-members__avatar todo-members__avatar--ph${isOwner ? ' todo-members__avatar--owner' : ''}`, children: initials(label) })), _jsxs("span", { className: "todo-members__user-text", children: [_jsx("span", { className: "todo-members__user-name", children: label }), sub && _jsx("span", { className: "todo-members__user-sub", children: sub })] })] }), _jsxs("div", { className: "todo-members__row-actions", children: [isOwner ? (_jsx("span", { className: "todo-members__role-badge", children: t('todoPage.members.owner') })) : (_jsxs("select", { className: "todo-members__role-select", value: m.role === 'viewer' ? 'viewer' : 'editor', disabled: busyUserId === m.user_id, onChange: (e) => void handleRoleChange(m.user_id, e.target.value), children: [_jsx("option", { value: "editor", children: t('todoPage.members.roleEditor') }), _jsx("option", { value: "viewer", children: t('todoPage.members.roleViewer') })] })), !isOwner && (_jsx("button", { type: "button", className: "todo-members__remove", disabled: busyUserId === m.user_id, onClick: () => void handleRemove(m.user_id), children: t('todoPage.members.remove') }))] })] }, m.user_id));
                    }) })), _jsxs("section", { className: "todo-members__add", children: [_jsx("h3", { className: "todo-members__add-title", children: t('todoPage.members.addSection') }), _jsx("input", { className: "todo-members__search", type: "search", placeholder: t('todoPage.boards.employeesSearch'), value: userSearch, onChange: (e) => setUserSearch(e.target.value) }), selectedIds.length > 0 && (_jsx("p", { className: "todo-members__picked", children: t('todoPage.members.selectedCount').replace('{count}', String(selectedIds.length)) })), _jsxs("ul", { className: "todo-members__pick-list", children: [pickableUsers.map((u) => {
                                    const label = userLabel(u);
                                    const on = selectedIds.includes(u.id);
                                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: `todo-members__pick-row${on ? ' todo-members__pick-row--on' : ''}`, onClick: () => togglePick(u.id), children: [u.picture ? (_jsx("img", { className: "todo-members__avatar todo-members__avatar--sm", src: u.picture, alt: "" })) : (_jsx("span", { className: "todo-members__avatar todo-members__avatar--ph todo-members__avatar--sm", children: initials(label) })), _jsxs("span", { className: "todo-members__pick-text", children: [_jsx("span", { className: "todo-members__pick-name", children: label }), u.email && u.email !== label && (_jsx("span", { className: "todo-members__pick-sub", children: u.email }))] }), _jsx("span", { className: `todo-members__pick-mark${on ? ' todo-members__pick-mark--on' : ''}`, "aria-hidden": "true", children: on && (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) })) })] }) }, u.id));
                                }), pickableUsers.length === 0 && (_jsx("li", { className: "todo-members__pick-empty", children: t('todoPage.boards.employeesEmpty') || '—' }))] }), _jsxs("div", { className: "todo-members__add-options", children: [_jsxs("label", { className: "todo-members__label", children: [_jsx("span", { children: t('todoPage.members.roleLabel') }), _jsxs("select", { value: addRole, onChange: (e) => setAddRole(e.target.value), disabled: submitting, children: [_jsx("option", { value: "editor", children: t('todoPage.members.roleEditor') }), _jsx("option", { value: "viewer", children: t('todoPage.members.roleViewer') })] })] }), _jsxs("label", { className: "todo-members__check", children: [_jsx("input", { type: "checkbox", checked: instant, onChange: (e) => setInstant(e.target.checked), disabled: submitting }), _jsx("span", { children: t('todoPage.members.instantAdd') })] })] }), _jsx("button", { type: "button", className: "todo-members__submit", disabled: submitting || selectedIds.length === 0, onClick: () => void handleAdd(), children: submitting ? t('todoPage.saving') : t('todoPage.members.addBtn') })] })] }) }), document.body);
}
