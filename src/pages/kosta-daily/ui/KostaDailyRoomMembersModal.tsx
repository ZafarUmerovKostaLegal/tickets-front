import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
import { addChatRoomMembers, fetchChatRoomMembers, type ChatRoomMember } from '@entities/chat';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';

export type KostaDailyRoomMembersModalProps = {
    open: boolean;
    roomId: number | null;
    roomTitle: string;
    roomType: string;
    canManageMembers: boolean;
    employees: TimeTrackingUserRow[];
    currentUserId?: number | null;
    labelByUserId: (id: number) => string;
    onClose: () => void;
    onMembersChanged?: () => void;
};

const AVATAR_COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774', '#5b9bd5'];

function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++)
        h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function memberRoleLabel(role: string): string {
    if (role === 'admin')
        return 'администратор';
    return 'участник';
}

function roomKindLabel(roomType: string): string {
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

export function KostaDailyRoomMembersModal({
    open,
    roomId,
    roomTitle,
    roomType,
    canManageMembers,
    employees,
    currentUserId,
    labelByUserId,
    onClose,
    onMembersChanged,
}: KostaDailyRoomMembersModalProps) {
    const [members, setMembers] = useState<ChatRoomMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [addQuery, setAddQuery] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    const memberIds = useMemo(
        () => new Set(members.map((m) => m.user_id)),
        [members],
    );

    const employeeById = useMemo(() => {
        const map = new Map<number, TimeTrackingUserRow>();
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
        catch (e: unknown) {
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
            return;
        }
        void loadMembers();
    }, [open, roomId, loadMembers]);

    const toggle = (id: number) => {
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
        catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : 'Не удалось добавить участников');
        }
        finally {
            setSaving(false);
        }
    };

    const subtitle = `${roomKindLabel(roomType)} · ${members.length} ${
        members.length === 1 ? 'участник' : members.length < 5 ? 'участника' : 'участников'
    }`;

    return (
        <KostaDailyChatModalShell
            open={open}
            title={roomTitle}
            ariaLabel={`Участники: ${roomTitle}`}
            onClose={onClose}
            className="kd-tg__modal--members"
            footer={addOpen && canManageMembers ? (
                <div className="kd-tg__modal-actions">
                    <button type="button" className="kd-tg__modal-btn" onClick={() => { setAddOpen(false); setSelected(new Set()); setAddQuery(''); setSaveError(null); }} disabled={saving}>
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="kd-tg__modal-btn kd-tg__modal-btn--primary"
                        onClick={() => void handleAdd()}
                        disabled={saving || selected.size === 0}
                    >
                        {saving ? 'Добавление…' : `Добавить${selected.size > 0 ? ` (${selected.size})` : ''}`}
                    </button>
                </div>
            ) : undefined}
        >
            <p className="kd-tg__modal-hint">{subtitle}</p>

            {loading ? (
                <p className="kd-tg__modal-members-status">Загрузка участников…</p>
            ) : loadError ? (
                <p className="kd-tg__modal-error" role="alert">{loadError}</p>
            ) : (
                <ul className="kd-tg__modal-members kd-tg__modal-members--view" role="list">
                    {sortedMembers.length === 0 ? (
                        <li className="kd-tg__modal-members-empty" role="listitem">Нет участников</li>
                    ) : sortedMembers.map((member) => {
                        const name = labelByUserId(member.user_id);
                        const emp = employeeById.get(member.user_id);
                        const meta = emp?.position?.trim() || emp?.email?.trim() || memberRoleLabel(member.role);
                        const isMe = currentUserId != null && member.user_id === currentUserId;
                        return (
                            <li key={member.user_id} role="listitem">
                                <div className="kd-tg__modal-member kd-tg__modal-member--readonly">
                                    <span
                                        className="kd-tg__modal-member-avatar"
                                        style={{ background: avatarColor(name) }}
                                        aria-hidden
                                    >
                                        {initials(name)}
                                    </span>
                                    <span className="kd-tg__modal-member-body">
                                        <span className="kd-tg__modal-member-name">
                                            {name}
                                            {isMe ? <span className="kd-tg__modal-member-you">вы</span> : null}
                                        </span>
                                        <span className="kd-tg__modal-member-meta">{meta}</span>
                                    </span>
                                    {member.role === 'admin' ? (
                                        <span className="kd-tg__modal-member-badge">админ</span>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {canManageMembers && !addOpen ? (
                <button
                    type="button"
                    className="kd-tg__modal-add-members-btn"
                    onClick={() => setAddOpen(true)}
                    disabled={loading}
                >
                    Добавить участников
                </button>
            ) : null}

            {canManageMembers && addOpen ? (
                <div className="kd-tg__modal-add-section">
                    <label className="kd-tg__modal-field">
                        <span className="kd-tg__modal-label">
                            Выберите сотрудников
                            {selected.size > 0 ? (
                                <span className="kd-tg__modal-label-badge">{selected.size}</span>
                            ) : null}
                        </span>
                        <input
                            type="search"
                            className="kd-tg__modal-input"
                            value={addQuery}
                            onChange={(e) => setAddQuery(e.target.value)}
                            placeholder="Поиск сотрудников"
                            autoFocus
                        />
                    </label>

                    <ul className="kd-tg__modal-members" role="list">
                        {addCandidates.length === 0 ? (
                            <li className="kd-tg__modal-members-empty" role="listitem">Все сотрудники уже в группе</li>
                        ) : addCandidates.map((emp) => {
                            const name = labelByUserId(emp.id);
                            return (
                                <li key={emp.id} role="listitem">
                                    <label className={`kd-tg__modal-member${selected.has(emp.id) ? ' kd-tg__modal-member--on' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={selected.has(emp.id)}
                                            onChange={() => toggle(emp.id)}
                                        />
                                        <span className="kd-tg__modal-check-box" aria-hidden />
                                        <span
                                            className="kd-tg__modal-member-avatar"
                                            style={{ background: avatarColor(name) }}
                                            aria-hidden
                                        >
                                            {initials(name)}
                                        </span>
                                        <span className="kd-tg__modal-member-body">
                                            <span className="kd-tg__modal-member-name">{name}</span>
                                            {emp.email ? (
                                                <span className="kd-tg__modal-member-meta">{emp.email}</span>
                                            ) : null}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}

            {saveError ? <p className="kd-tg__modal-error" role="alert">{saveError}</p> : null}
        </KostaDailyChatModalShell>
    );
}
