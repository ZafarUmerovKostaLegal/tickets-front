import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addChatRoomMembers, fetchChatRoomMembers, patchChatGroupRoom, removeChatRoomMember } from '@entities/chat';
import { showConfirm } from '@shared/ui/app-dialog/appDialogGate';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';
const AVATAR_COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774', '#5b9bd5'];
function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++)
        h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
function memberRoleLabel(role) {
    if (role === 'admin')
        return 'администратор';
    return 'участник';
}
function roomKindLabel(roomType) {
    if (roomType === 'channel')
        return 'канал';
    if (roomType === 'group')
        return 'группа';
    if (roomType === 'company')
        return 'общий чат';
    if (roomType === 'dm')
        return 'личный чат';
    return 'чат';
}
export function KostaDailyRoomMembersModal({ open, roomId, roomTitle, roomType, canManageMembers, employees, currentUserId, labelByUserId, onClose, onMembersChanged, onRenamed, onDeleted, }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [addQuery, setAddQuery] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [titleDraft, setTitleDraft] = useState(roomTitle);
    const [titleSaving, setTitleSaving] = useState(false);
    const [removingUserId, setRemovingUserId] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
    const employeeById = useMemo(() => {
        const map = new Map();
        for (const emp of employees)
            map.set(emp.id, emp);
        return map;
    }, [employees]);
    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin')
                return -1;
            if (b.role === 'admin' && a.role !== 'admin')
                return 1;
            return labelByUserId(a.user_id).localeCompare(labelByUserId(b.user_id), 'ru', { sensitivity: 'base' });
        });
    }, [members, labelByUserId]);
    const addCandidates = useMemo(() => {
        const q = addQuery.trim().toLowerCase();
        return employees.filter((emp) => {
            if (memberIds.has(emp.id))
                return false;
            if (currentUserId != null && emp.id === currentUserId)
                return false;
            if (!q)
                return true;
            const name = labelByUserId(emp.id).toLowerCase();
            return name.includes(q) || (emp.email?.toLowerCase().includes(q) ?? false);
        });
    }, [employees, memberIds, addQuery, currentUserId, labelByUserId]);
    const loadMembers = useCallback(async () => {
        if (roomId == null)
            return;
        setLoading(true);
        setLoadError(null);
        try {
            const items = await fetchChatRoomMembers(roomId);
            setMembers(items);
        }
        catch (e) {
            setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить участников');
            setMembers([]);
        }
        finally {
            setLoading(false);
        }
    }, [roomId]);
    useEffect(() => {
        if (!open || roomId == null) {
            setMembers([]);
            setLoadError(null);
            setAddQuery('');
            setSelected(new Set());
            setSaveError(null);
            setAddOpen(false);
            setTitleDraft(roomTitle);
            setTitleSaving(false);
            setRemovingUserId(null);
            setDeleting(false);
            return;
        }
        setTitleDraft(roomTitle);
        void loadMembers();
    }, [open, roomId, roomTitle, loadMembers]);
    const toggle = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const handleAdd = async () => {
        if (roomId == null || selected.size === 0)
            return;
        setSaving(true);
        setSaveError(null);
        try {
            const updated = await addChatRoomMembers(roomId, [...selected]);
            setMembers(updated);
            setSelected(new Set());
            setAddQuery('');
            setAddOpen(false);
            onMembersChanged?.();
        }
        catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Не удалось добавить участников');
        }
        finally {
            setSaving(false);
        }
    };
    const canEditGroup = canManageMembers && roomType === 'group';
    const titleDirty = titleDraft.trim() !== roomTitle.trim() && titleDraft.trim().length > 0;
    const handleRename = async () => {
        const next = titleDraft.trim();
        if (roomId == null || !next || next === roomTitle.trim())
            return;
        setTitleSaving(true);
        setSaveError(null);
        try {
            await patchChatGroupRoom(roomId, next);
            onRenamed?.();
        }
        catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Не удалось переименовать группу');
        }
        finally {
            setTitleSaving(false);
        }
    };
    const handleRemoveMember = async (userId, name) => {
        if (roomId == null)
            return;
        const ok = await showConfirm({
            title: 'Исключить участника?',
            message: `${name} больше не будет видеть сообщения этой группы.`,
            confirmLabel: 'Исключить',
            cancelLabel: 'Отмена',
            variant: 'danger',
        });
        if (!ok)
            return;
        setRemovingUserId(userId);
        setSaveError(null);
        try {
            const updated = await removeChatRoomMember(roomId, userId);
            setMembers(updated);
            onMembersChanged?.();
        }
        catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Не удалось исключить участника');
        }
        finally {
            setRemovingUserId(null);
        }
    };
    const handleDeleteGroup = async () => {
        if (!onDeleted)
            return;
        const ok = await showConfirm({
            title: 'Удалить группу?',
            message: `Группа «${roomTitle}» и её сообщения будут удалены для всех участников.`,
            confirmLabel: 'Удалить',
            cancelLabel: 'Отмена',
            variant: 'danger',
        });
        if (!ok)
            return;
        setDeleting(true);
        setSaveError(null);
        try {
            await onDeleted();
        }
        catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Не удалось удалить группу');
            setDeleting(false);
        }
    };
    const subtitle = `${roomKindLabel(roomType)} · ${members.length} ${members.length === 1 ? 'участник' : members.length < 5 ? 'участника' : 'участников'}`;
    return (_jsxs(KostaDailyChatModalShell, { open: open, title: roomTitle, ariaLabel: `Участники: ${roomTitle}`, onClose: onClose, className: "kd-tg__modal--members", footer: addOpen && canManageMembers ? (_jsxs("div", { className: "kd-tg__modal-actions", children: [_jsx("button", { type: "button", className: "kd-tg__modal-btn", onClick: () => { setAddOpen(false); setSelected(new Set()); setAddQuery(''); setSaveError(null); }, disabled: saving, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "kd-tg__modal-btn kd-tg__modal-btn--primary", onClick: () => void handleAdd(), disabled: saving || selected.size === 0, children: saving ? 'Добавление…' : `Добавить${selected.size > 0 ? ` (${selected.size})` : ''}` })] })) : undefined, children: [_jsx("p", { className: "kd-tg__modal-hint", children: subtitle }), canEditGroup ? (_jsxs("label", { className: "kd-tg__modal-field", children: [_jsx("span", { className: "kd-tg__modal-label", children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435" }), _jsxs("span", { className: "kd-tg__modal-title-row", children: [_jsx("input", { type: "text", className: "kd-tg__modal-input", value: titleDraft, maxLength: 200, onChange: (e) => setTitleDraft(e.target.value), "aria-label": "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0433\u0440\u0443\u043F\u043F\u044B" }), _jsx("button", { type: "button", className: "kd-tg__modal-btn kd-tg__modal-btn--primary", onClick: () => void handleRename(), disabled: !titleDirty || titleSaving || deleting, children: titleSaving ? '…' : 'Сохранить' })] })] })) : null, loading ? (_jsx("p", { className: "kd-tg__modal-members-status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432\u2026" })) : loadError ? (_jsx("p", { className: "kd-tg__modal-error", role: "alert", children: loadError })) : (_jsx("ul", { className: "kd-tg__modal-members kd-tg__modal-members--view", role: "list", children: sortedMembers.length === 0 ? (_jsx("li", { className: "kd-tg__modal-members-empty", role: "listitem", children: "\u041D\u0435\u0442 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432" })) : sortedMembers.map((member) => {
                    const name = labelByUserId(member.user_id);
                    const emp = employeeById.get(member.user_id);
                    const meta = emp?.position?.trim() || emp?.email?.trim() || memberRoleLabel(member.role);
                    const isMe = currentUserId != null && member.user_id === currentUserId;
                    return (_jsx("li", { role: "listitem", children: _jsxs("div", { className: "kd-tg__modal-member kd-tg__modal-member--readonly", children: [_jsx("span", { className: "kd-tg__modal-member-avatar", style: { background: avatarColor(name) }, "aria-hidden": true, children: initials(name) }), _jsxs("span", { className: "kd-tg__modal-member-body", children: [_jsxs("span", { className: "kd-tg__modal-member-name", children: [name, isMe ? _jsx("span", { className: "kd-tg__modal-member-you", children: "\u0432\u044B" }) : null] }), _jsx("span", { className: "kd-tg__modal-member-meta", children: meta })] }), member.role === 'admin' ? (_jsx("span", { className: "kd-tg__modal-member-badge", children: "\u0430\u0434\u043C\u0438\u043D" })) : null, canEditGroup && !isMe ? (_jsx("button", { type: "button", className: "kd-tg__modal-member-remove", onClick: () => void handleRemoveMember(member.user_id, name), disabled: removingUserId != null || deleting, children: removingUserId === member.user_id ? '…' : 'Исключить' })) : null] }) }, member.user_id));
                }) })), canManageMembers && !addOpen ? (_jsx("button", { type: "button", className: "kd-tg__modal-add-members-btn", onClick: () => setAddOpen(true), disabled: loading, children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432" })) : null, canManageMembers && addOpen ? (_jsxs("div", { className: "kd-tg__modal-add-section", children: [_jsxs("label", { className: "kd-tg__modal-field", children: [_jsxs("span", { className: "kd-tg__modal-label", children: ["\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432", selected.size > 0 ? (_jsx("span", { className: "kd-tg__modal-label-badge", children: selected.size })) : null] }), _jsx("input", { type: "search", className: "kd-tg__modal-input", value: addQuery, onChange: (e) => setAddQuery(e.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432", autoFocus: true })] }), _jsx("ul", { className: "kd-tg__modal-members", role: "list", children: addCandidates.length === 0 ? (_jsx("li", { className: "kd-tg__modal-members-empty", role: "listitem", children: "\u0412\u0441\u0435 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438 \u0443\u0436\u0435 \u0432 \u0433\u0440\u0443\u043F\u043F\u0435" })) : addCandidates.map((emp) => {
                            const name = labelByUserId(emp.id);
                            return (_jsx("li", { role: "listitem", children: _jsxs("label", { className: `kd-tg__modal-member${selected.has(emp.id) ? ' kd-tg__modal-member--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: selected.has(emp.id), onChange: () => toggle(emp.id) }), _jsx("span", { className: "kd-tg__modal-check-box", "aria-hidden": true }), _jsx("span", { className: "kd-tg__modal-member-avatar", style: { background: avatarColor(name) }, "aria-hidden": true, children: initials(name) }), _jsxs("span", { className: "kd-tg__modal-member-body", children: [_jsx("span", { className: "kd-tg__modal-member-name", children: name }), emp.email ? (_jsx("span", { className: "kd-tg__modal-member-meta", children: emp.email })) : null] })] }) }, emp.id));
                        }) })] })) : null, canEditGroup ? (_jsx("button", { type: "button", className: "kd-tg__modal-delete-group", onClick: () => void handleDeleteGroup(), disabled: deleting || titleSaving || removingUserId != null, children: deleting ? 'Удаление…' : 'Удалить группу' })) : null, saveError ? _jsx("p", { className: "kd-tg__modal-error", role: "alert", children: saveError }) : null] }));
}
